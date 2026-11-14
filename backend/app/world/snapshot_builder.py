import asyncio
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

_init_lock = asyncio.Lock()

from app.agents.agent_memory import AgentMemoryManager
from app.agents.agent_registry import AgentRegistry
from app.config import settings
from app.llm.gemini_provider import gemini_provider
from app.models import (
    AgentEventModel,
    AgentModel,
    LLMRequestModel,
    MeetingDecisionModel,
    MeetingMessageModel,
    MeetingModel,
    MeetingParticipantModel,
    MeetingPresentationModel,
    TaskDependencyModel,
    TaskModel,
    UserModel,
    WorkforceModel,
)
from app.schemas import (
    AgentMemorySchema,
    AgentProfileSchema,
    MeetingDecisionSchema,
    MeetingMessageSchema,
    MeetingParticipantSchema,
    MeetingPresentationSchema,
    MeetingSchema,
    TaskSchema,
    TokenUsageSummarySchema,
    WorldEventSchema,
    WorldSnapshotSchema,
)
from app.world.layout import ROOMS


class SnapshotBuilder:
    """Builds complete, validated world snapshots and CEO Command Centre telemetry from SQLite."""

    @staticmethod
    async def ensure_default_workforce(session: AsyncSession) -> WorkforceModel:
        async with _init_lock:
            res = await session.execute(
                select(WorkforceModel).order_by(desc(WorkforceModel.created_at)).limit(1)
            )
            wf = res.scalar_one_or_none()
            if wf:
                return wf

            u_res = await session.execute(
                select(UserModel).where(UserModel.id == "usr_director")
            )
            user = u_res.scalar_one_or_none()
            if not user:
                user = UserModel(id="usr_director", name="Executive Director", role="Founder")
                session.add(user)

            wf = WorkforceModel(
                id="wf_forge_default",
                user_id=user.id,
                name="Project Forge Core Engineering",
                objective=(
                    "Standby in virtual headquarters. Submit a software project objective or ZIP archive "
                    "to dispatch the autonomous workforce."
                ),
                status="READY",
                simulation_speed=1.0,
                is_paused=False,
                token_budget=settings.GLOBAL_TOKEN_BUDGET,
                tokens_used=0,
                llm_calls_made=0,
                max_llm_calls=settings.MAX_WORKFORCE_CALLS,
            )
            session.add(wf)
            await session.commit()

            await AgentRegistry.create_workforce_agents(session, wf, emit_events=True)
            return wf

    @staticmethod
    async def serialize_agent(session: AsyncSession, agent: AgentModel) -> AgentProfileSchema:
        memories = await AgentMemoryManager.get_agent_memories(session, agent.id, limit=10)
        mem_schemas = [
            AgentMemorySchema(
                id=m.id,
                agent_id=m.agent_id,
                memory_type=m.memory_type,
                content=m.content,
                importance=m.importance,
                context_meta=m.context_meta,
                created_at=m.created_at,
            )
            for m in memories
        ]
        target_pos = None
        if agent.target_x is not None and agent.target_y is not None and agent.target_z is not None:
            target_pos = [agent.target_x, agent.target_y, agent.target_z]

        return AgentProfileSchema(
            id=agent.id,
            workforce_id=agent.workforce_id,
            agent_key=agent.agent_key,
            name=agent.name,
            role=agent.role,
            department=agent.department,
            personality=agent.personality,
            system_instructions=agent.system_instructions,
            capabilities=agent.capabilities or [],
            tools=agent.tools or [],
            memory_enabled=agent.memory_enabled,
            state=agent.state,  # type: ignore[arg-type]
            current_activity=agent.current_activity,
            current_room_id=agent.current_room_id,
            home_room_id=agent.home_room_id,
            target_room_id=agent.target_room_id,
            position=[agent.position_x, agent.position_y, agent.position_z],
            target_position=target_pos,
            current_task_id=agent.current_task_id,
            avatar_config=agent.avatar_config or {},
            max_iterations=agent.max_iterations,
            iterations_used=agent.iterations_used,
            token_budget=agent.token_budget,
            tokens_used=agent.tokens_used,
            tasks_completed=agent.tasks_completed,
            tasks_failed=agent.tasks_failed,
            meetings_attended=agent.meetings_attended,
            recent_error=agent.recent_error,
            state_changed_at=agent.state_changed_at,
            memories=mem_schemas,
        )

    @staticmethod
    async def serialize_tasks(
        session: AsyncSession,
        workforce_id: str,
        agents_by_id: Dict[str, AgentModel],
    ) -> List[TaskSchema]:
        res = await session.execute(
            select(TaskModel)
            .where(TaskModel.workforce_id == workforce_id)
            .order_by(TaskModel.created_at)
        )
        tasks = list(res.scalars().all())
        if not tasks:
            return []

        task_ids = [t.id for t in tasks]
        dep_res = await session.execute(
            select(TaskDependencyModel).where(TaskDependencyModel.task_id.in_(task_ids))
        )
        deps = list(dep_res.scalars().all())
        dep_map: Dict[str, List[str]] = {}
        for d in deps:
            dep_map.setdefault(d.task_id, []).append(d.depends_on_task_id)

        out: List[TaskSchema] = []
        for t in tasks:
            ag = agents_by_id.get(t.assigned_agent_id or "")
            out.append(
                TaskSchema(
                    id=t.id,
                    workforce_id=t.workforce_id,
                    title=t.title,
                    description=t.description,
                    assigned_agent_id=t.assigned_agent_id,
                    assigned_agent_name=ag.name if ag else None,
                    priority=t.priority,
                    status=t.status,
                    progress=t.progress,
                    target_room_id=t.target_room_id,
                    dependencies=dep_map.get(t.id, []),
                    deliverables=t.deliverables or [],
                    result_summary=t.result_summary,
                    structured_output=t.structured_output,
                    execution_history=t.execution_history or [],
                    deadline=t.deadline,
                    created_at=t.created_at,
                    completed_at=t.completed_at,
                )
            )
        return out

    @staticmethod
    async def serialize_meeting(
        session: AsyncSession,
        meeting: MeetingModel,
        agents_by_id: Dict[str, AgentModel],
    ) -> MeetingSchema:
        p_res = await session.execute(
            select(MeetingParticipantModel)
            .where(MeetingParticipantModel.meeting_id == meeting.id)
            .order_by(MeetingParticipantModel.seat_index)
        )
        participants_rows = list(p_res.scalars().all())
        part_schemas: List[MeetingParticipantSchema] = []
        for pr in participants_rows:
            ag = agents_by_id.get(pr.agent_id)
            part_schemas.append(
                MeetingParticipantSchema(
                    agent_id=pr.agent_id,
                    agent_name=ag.name if ag else pr.agent_id,
                    agent_role=ag.role if ag else "Participant",
                    seat_index=pr.seat_index,
                    seat_position=[pr.seat_x, pr.seat_y, pr.seat_z],
                    joined_at=pr.joined_at,
                )
            )

        m_res = await session.execute(
            select(MeetingMessageModel)
            .where(MeetingMessageModel.meeting_id == meeting.id)
            .order_by(MeetingMessageModel.created_at)
        )
        msg_schemas = [
            MeetingMessageSchema(
                id=m.id,
                meeting_id=m.meeting_id,
                sender_agent_id=m.sender_agent_id,
                sender_name=m.sender_name,
                sender_role=m.sender_role,
                message_type=m.message_type,
                content=m.content,
                round_number=m.round_number,
                created_at=m.created_at,
            )
            for m in m_res.scalars().all()
        ]

        pres_res = await session.execute(
            select(MeetingPresentationModel)
            .where(MeetingPresentationModel.meeting_id == meeting.id)
            .order_by(MeetingPresentationModel.created_at)
        )
        pres_schemas = [
            MeetingPresentationSchema(
                id=p.id,
                meeting_id=p.meeting_id,
                presenter_agent_id=p.presenter_agent_id,
                presenter_name=p.presenter_name,
                presenter_role=p.presenter_role,
                presentation_type=p.presentation_type,  # type: ignore[arg-type]
                title=p.title,
                subtitle=p.subtitle,
                structured_data=p.structured_data or {},
                created_at=p.created_at,
            )
            for p in pres_res.scalars().all()
        ]

        dec_res = await session.execute(
            select(MeetingDecisionModel)
            .where(MeetingDecisionModel.meeting_id == meeting.id)
            .order_by(MeetingDecisionModel.created_at)
        )
        dec_schemas = [
            MeetingDecisionSchema(
                id=d.id,
                meeting_id=d.meeting_id,
                title=d.title,
                rationale=d.rationale,
                owner_agent_id=d.owner_agent_id,
                owner_name=d.owner_name,
                action_items=d.action_items or [],
                created_at=d.created_at,
            )
            for d in dec_res.scalars().all()
        ]

        return MeetingSchema(
            id=meeting.id,
            workforce_id=meeting.workforce_id,
            title=meeting.title,
            agenda=meeting.agenda or [],
            room_id=meeting.room_id,
            initiator_agent_id=meeting.initiator_agent_id,
            status=meeting.status,
            active_speaker_id=meeting.active_speaker_id,
            active_presentation_id=meeting.active_presentation_id,
            is_observed=meeting.is_observed,
            participants=part_schemas,
            messages=msg_schemas,
            presentations=pres_schemas,
            decisions=dec_schemas,
            created_at=meeting.created_at,
            started_at=meeting.started_at,
            ended_at=meeting.ended_at,
        )

    @staticmethod
    async def build_token_usage_summary(
        session: AsyncSession,
        workforce: WorkforceModel,
        agents: List[AgentModel],
    ) -> TokenUsageSummarySchema:
        req_res = await session.execute(
            select(LLMRequestModel)
            .where(LLMRequestModel.workforce_id == workforce.id)
            .order_by(desc(LLMRequestModel.created_at))
        )
        requests = list(req_res.scalars().all())

        total_in = sum(r.input_tokens for r in requests if r.success)
        total_out = sum(r.output_tokens for r in requests if r.success)
        total_tok = sum(r.total_tokens for r in requests if r.success)
        total_cost = round(sum((r.estimated_cost_usd or 0.0) for r in requests if r.success), 6)
        live_calls = sum(1 for r in requests if r.is_live_api and r.success)
        fallback_calls = sum(1 for r in requests if (not r.is_live_api) and r.success)

        by_agent = [
            {
                "agent_id": a.id,
                "agent_name": a.name,
                "role": a.role,
                "tokens_used": a.tokens_used,
                "token_budget": a.token_budget,
                "utilization_pct": round((a.tokens_used / max(1, a.token_budget)) * 100, 1),
                "iterations_used": a.iterations_used,
                "max_iterations": a.max_iterations,
            }
            for a in agents
        ]

        recent_reqs = [
            {
                "id": r.id,
                "agent_id": r.agent_id,
                "model_id": r.model_id,
                "operation": r.operation,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "total_tokens": r.total_tokens,
                "duration_ms": r.duration_ms,
                "estimated_cost_usd": r.estimated_cost_usd,
                "is_live_api": r.is_live_api,
                "success": r.success,
                "created_at": r.created_at.isoformat(),
            }
            for r in requests[:20]
        ]

        limits = gemini_provider.get_model_limits(settings.GEMINI_MODEL)
        provider_status = (
            f"LIVE GEMINI MODE: Paced to Free Tier ({limits['rpm']} RPM • 250K TPM • {limits['rpd']} RPD | Today: {limits['rpd_used']}/{limits['rpd']} RPD)"
            if gemini_provider.is_live_configured()
            else f"DEMO MODE: No API key configured. Free Tier Ready ({limits['label']}: {limits['rpm']} RPM • {limits['rpd']} RPD)."
        )

        return TokenUsageSummarySchema(
            workforce_id=workforce.id,
            global_token_budget=workforce.token_budget,
            total_input_tokens=total_in,
            total_output_tokens=total_out,
            total_tokens_used=total_tok,
            llm_calls_made=workforce.llm_calls_made,
            max_llm_calls=workforce.max_llm_calls,
            live_api_calls=live_calls,
            fallback_calls=fallback_calls,
            estimated_cost_usd=total_cost,
            provider_status=provider_status,
            active_model=limits["model_id"],
            by_agent=by_agent,
            recent_requests=recent_reqs,
        )

    @staticmethod
    async def build_world_snapshot(
        session: AsyncSession,
        workforce_id: Optional[str] = None,
    ) -> WorldSnapshotSchema:
        if workforce_id:
            wf_res = await session.execute(
                select(WorkforceModel).where(WorkforceModel.id == workforce_id)
            )
            workforce = wf_res.scalar_one_or_none()
            if not workforce:
                workforce = await SnapshotBuilder.ensure_default_workforce(session)
        else:
            workforce = await SnapshotBuilder.ensure_default_workforce(session)

        agents = await AgentRegistry.get_workforce_agents(session, workforce.id)
        if not agents:
            agents = await AgentRegistry.create_workforce_agents(session, workforce, emit_events=False)

        agents_by_id = {a.id: a for a in agents}
        agent_schemas = [await SnapshotBuilder.serialize_agent(session, a) for a in agents]
        task_schemas = await SnapshotBuilder.serialize_tasks(session, workforce.id, agents_by_id)

        mtg_res = await session.execute(
            select(MeetingModel)
            .where(MeetingModel.workforce_id == workforce.id)
            .order_by(desc(MeetingModel.created_at))
        )
        meetings = list(mtg_res.scalars().all())
        meeting_schemas = [
            await SnapshotBuilder.serialize_meeting(session, m, agents_by_id) for m in meetings
        ]

        active_meeting = next(
            (m for m in meeting_schemas if m.status in ("GATHERING", "ACTIVE", "PRESENTING")),
            meeting_schemas[0] if meeting_schemas else None,
        )

        active_presentation: Optional[MeetingPresentationSchema] = None
        if active_meeting and active_meeting.presentations:
            active_presentation = active_meeting.presentations[-1]

        token_usage = await SnapshotBuilder.build_token_usage_summary(session, workforce, agents)

        evt_res = await session.execute(
            select(AgentEventModel)
            .where(AgentEventModel.workforce_id == workforce.id)
            .order_by(desc(AgentEventModel.sequence))
            .limit(60)
        )
        events = list(reversed(list(evt_res.scalars().all())))
        event_schemas = [
            WorldEventSchema(
                event_id=e.id,
                sequence=e.sequence,
                workforce_id=e.workforce_id,
                event_type=e.event_type,  # type: ignore[arg-type]
                entity_id=e.entity_id,
                payload=e.payload or {},
                timestamp=e.created_at,
            )
            for e in events
        ]

        # Build Alex's CEO Office Command Centre Overview
        completed_tasks = [t for t in task_schemas if t.status == "COMPLETED"]
        failed_tasks = [t for t in task_schemas if t.status == "FAILED"]
        all_decisions = [d.model_dump() for m in meeting_schemas for d in m.decisions]
        all_deliverables = [
            {"task_title": t.title, "agent": t.assigned_agent_name, "deliverables": t.deliverables, "summary": t.result_summary}
            for t in completed_tasks
        ]
        major_risks = [
            "Tight coupling between authentication middleware and domain service controllers",
            "Missing JWT audience/scope enforcement and raw-body HMAC validation on webhooks",
            "0% automated regression snapshot coverage on 12 auth-protected endpoints prior to refactoring",
        ]

        health_score = 98 if not failed_tasks else max(60, 98 - len(failed_tasks) * 15)
        ceo_overview = {
            "orchestrator": "Alex (Chief Executive / Orchestrator)",
            "office_room_id": "ceo_office",
            "company_health_score": health_score,
            "company_health_status": "OPTIMAL" if health_score >= 90 else "ATTENTION_REQUIRED",
            "active_project": {
                "id": workforce.id,
                "name": workforce.name,
                "objective": workforce.objective,
                "status": workforce.status,
            },
            "employee_workload": [
                {
                    "agent_id": a.id,
                    "name": a.name,
                    "role": a.role,
                    "state": a.state,
                    "room_id": a.current_room_id,
                    "tasks_completed": a.tasks_completed,
                    "tokens_used": a.tokens_used,
                    "token_budget": a.token_budget,
                }
                for a in agent_schemas
            ],
            "pending_decisions": (
                ["Ratify 3-Stage Strangler-Fig Refactoring Blueprint in Main Boardroom"]
                if workforce.status == "RUNNING" and not all_decisions
                else []
            ),
            "ratified_decisions": all_decisions,
            "major_risks": major_risks,
            "token_expenditure": {
                "used": token_usage.total_tokens_used,
                "budget": token_usage.global_token_budget,
                "calls_made": token_usage.llm_calls_made,
                "max_calls": token_usage.max_llm_calls,
                "estimated_cost_usd": token_usage.estimated_cost_usd,
            },
            "completed_deliverables": all_deliverables,
        }

        return WorldSnapshotSchema(
            workforce_id=workforce.id,
            workforce_name=workforce.name,
            objective=workforce.objective,
            workforce_status=workforce.status,
            simulation_speed=workforce.simulation_speed,
            is_paused=workforce.is_paused,
            project_summary=workforce.project_summary,
            final_report=workforce.final_report,
            rooms=ROOMS,
            agents=agent_schemas,
            tasks=task_schemas,
            meetings=meeting_schemas,
            active_meeting=active_meeting,
            active_presentation=active_presentation,
            token_usage=token_usage,
            recent_events=event_schemas,
            ceo_overview=ceo_overview,
        )
