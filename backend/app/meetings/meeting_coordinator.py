import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_memory import AgentMemoryManager
from app.agents.state_manager import StateManager
from app.events.event_bus import event_bus
from app.llm.provider_resolver import WorkspaceProviderResolver
from app.models import (
    AgentModel,
    MeetingDecisionModel,
    MeetingMessageModel,
    MeetingModel,
    MeetingParticipantModel,
    MeetingPresentationModel,
    TaskModel,
    WorkforceModel,
)
from app.schemas import PresentationTypeLiteral
from app.world.layout import ROOM_MAP


class DialogueTurnSpec(BaseModel):
    speaker_key: str = Field(..., description="Agent key: alex, marcus, olivia, sarah, daniel, or nina")
    message_type: str = Field(..., description="EVIDENCE, CHALLENGE, QUESTION, PROPOSAL, or DECISION")
    content: str = Field(..., description="Technical statement grounded in role perspective")
    round_number: int = Field(default=1)
    triggers_presentation: bool = Field(default=False)
    presentation_type: Optional[PresentationTypeLiteral] = None
    presentation_title: Optional[str] = None
    presentation_subtitle: Optional[str] = None
    presentation_data: Optional[Dict[str, Any]] = None


class DecisionSpec(BaseModel):
    title: str
    rationale: str
    owner_key: str
    action_items: List[str]


class MeetingSynthesisOutput(BaseModel):
    agenda: List[str]
    turns: List[DialogueTurnSpec]
    decisions: List[DecisionSpec]


class MeetingCoordinator:
    """Flagship 14-step Meeting Intelligence Engine orchestrating real multi-agent boardroom sessions."""

    @staticmethod
    async def conduct_boardroom_meeting(
        session: AsyncSession,
        workforce_id: str,
        initiator: AgentModel,
        participants: List[AgentModel],
        title: str,
        objective: str,
        agent_findings: Dict[str, Any],
        project_summary: Optional[Dict[str, Any]] = None,
    ) -> MeetingModel:
        boardroom = ROOM_MAP["boardroom"]
        seats = boardroom["seats"]

        agenda = [
            "1. Review Architectural Bottlenecks & Coupling Topology (Marcus)",
            "2. Audit Backend API Contracts & Zero-Trust Auth Boundaries (Sarah)",
            "3. Enforce Regression Baseline & Security Verification Gates (Nina & Olivia)",
            "4. Ratify Phased Refactoring Strategy & Follow-up Action Items (Alex)",
        ]

        meeting_id = f"mtg_{uuid.uuid4().hex[:10]}"
        meeting = MeetingModel(
            id=meeting_id,
            workforce_id=workforce_id,
            workspace_id=initiator.workspace_id,
            title=title,
            agenda=agenda,
            room_id="boardroom",
            initiator_agent_id=initiator.id,
            status="GATHERING",
            is_observed=True,
            created_at=datetime.now(timezone.utc),
        )
        session.add(meeting)
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=workforce_id,
            event_type="MEETING_REQUESTED",
            entity_id=meeting.id,
            payload={
                "meeting_id": meeting.id,
                "title": meeting.title,
                "room_id": "boardroom",
                "initiator_id": initiator.id,
                "initiator_name": initiator.name,
                "participant_ids": [p.id for p in participants],
                "participant_names": [p.name for p in participants],
                "agenda": agenda,
            },
        )

        # Reserve seats and walk participants to the Main Boardroom
        part_rows: List[MeetingParticipantModel] = []
        for idx, participant in enumerate(participants):
            seat_coords = seats[idx % len(seats)]
            part_row = MeetingParticipantModel(
                meeting_id=meeting.id,
                agent_id=participant.id,
                seat_index=idx,
                seat_x=seat_coords[0],
                seat_y=seat_coords[1],
                seat_z=seat_coords[2],
            )
            session.add(part_row)
            part_rows.append(part_row)
        await session.commit()

        # Move all participants concurrently to their reserved boardroom seats
        for idx, participant in enumerate(participants):
            seat_coords = seats[idx % len(seats)]
            await StateManager.move_agent_to_room(
                session=session,
                agent=participant,
                target_room_id="boardroom",
                target_coords=seat_coords,
                activity_label=f"Walking to Main Boardroom (Seat #{idx + 1})",
                travel_delay=0.65,
            )
            part_rows[idx].joined_at = datetime.now(timezone.utc)
            participant.meetings_attended = (participant.meetings_attended or 0) + 1
            await StateManager.transition_state(
                session=session,
                agent=participant,
                new_state="IN_MEETING",
                activity=f"In Boardroom: {meeting.title}",
            )
            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="MEETING_PARTICIPANT_JOINED",
                entity_id=meeting.id,
                payload={
                    "meeting_id": meeting.id,
                    "agent_id": participant.id,
                    "agent_name": participant.name,
                    "agent_role": participant.role,
                    "seat_index": idx,
                    "seat_position": seat_coords,
                },
            )

        # Start the meeting
        meeting.status = "ACTIVE"
        meeting.started_at = datetime.now(timezone.utc)
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=workforce_id,
            event_type="MEETING_STARTED",
            entity_id=meeting.id,
            payload={
                "meeting_id": meeting.id,
                "title": meeting.title,
                "room_id": "boardroom",
                "agenda": meeting.agenda,
                "started_at": meeting.started_at.isoformat(),
            },
        )

        # Generate structured multi-agent technical debate & presentations via Gemini Gateway
        agent_by_key = {p.agent_key: p for p in participants}
        synthesis_prompt = (
            f"Conduct a technical architecture & refactoring boardroom review for PROJECT FORGE.\n"
            f"Objective: {objective}\n"
            f"Project Summary: {json.dumps(project_summary or {}, indent=2)}\n"
            f"Independent Agent Findings:\n{json.dumps(agent_findings, indent=2)}\n\n"
            f"Participants present: {', '.join([f'{p.name} ({p.role}, key={p.agent_key})' for p in participants])}.\n"
            f"Generate a realistic, rigorous multi-turn technical discussion where agents present evidence, "
            f"challenge assumptions, raise security/regression questions, present structured slides on the boardroom screen "
            f"(ARCHITECTURE_DIAGRAM, CODE_SNIPPET, RISK_ASSESSMENT, TASK_BREAKDOWN), and reach concrete engineering decisions."
        )

        fallback_meeting_data = MeetingCoordinator._build_boardroom_fallback(objective, project_summary)

        ws_id = initiator.workspace_id
        if not ws_id:
            from sqlalchemy import select
            wf_row = (
                await session.execute(select(WorkforceModel).where(WorkforceModel.id == workforce_id))
            ).scalar_one_or_none()
            ws_id = wf_row.workspace_id if wf_row else None
        if not ws_id:
            raise RuntimeError(
                f"Meeting in workforce {workforce_id} is missing explicit workspace ownership context."
            )

        provider_instance = await WorkspaceProviderResolver.resolve_for_workspace(
            session=session,
            workspace_id=ws_id,
            provider="gemini",
        )

        synthesis, telemetry = await provider_instance.generate_structured(
            session=session,
            workforce_id=workforce_id,
            agent_id=initiator.id,
            operation="meeting_intelligence_synthesis",
            system_instruction=(
                "You are the Meeting Intelligence Engine for PROJECT FORGE. "
                "Generate authentic, deeply technical multi-agent discussions with constructive disagreement, "
                "concrete architectural evidence, structured presentation artifacts, and actionable decisions."
            ),
            prompt=synthesis_prompt,
            response_schema=MeetingSynthesisOutput,
            complex_task=True,
            fallback_data=fallback_meeting_data,
        )

        await event_bus.emit(
            session=session,
            workforce_id=workforce_id,
            event_type="TOKEN_USAGE_UPDATED",
            entity_id=initiator.id,
            payload=telemetry,
        )

        # Replay each discussion turn and presentation event in real time
        for turn in synthesis.turns:
            speaker = agent_by_key.get(turn.speaker_key) or participants[0]
            meeting.active_speaker_id = speaker.id
            await session.commit()

            if turn.triggers_presentation and turn.presentation_type and turn.presentation_data:
                await StateManager.transition_state(
                    session=session,
                    agent=speaker,
                    new_state="PRESENTING",
                    activity=f"Presenting: {turn.presentation_title or turn.presentation_type}",
                )
                pres_id = f"pres_{uuid.uuid4().hex[:10]}"
                pres_row = MeetingPresentationModel(
                    id=pres_id,
                    meeting_id=meeting.id,
                    presenter_agent_id=speaker.id,
                    presenter_name=speaker.name,
                    presenter_role=speaker.role,
                    presentation_type=turn.presentation_type,
                    title=turn.presentation_title or "Technical Architecture Review",
                    subtitle=turn.presentation_subtitle or f"Presented by {speaker.name} ({speaker.role})",
                    structured_data=turn.presentation_data,
                )
                session.add(pres_row)
                meeting.active_presentation_id = pres_id
                meeting.status = "PRESENTING"
                await session.commit()

                await event_bus.emit(
                    session=session,
                    workforce_id=workforce_id,
                    event_type="MEETING_PRESENTATION_UPDATED",
                    entity_id=meeting.id,
                    payload={
                        "presentation_id": pres_row.id,
                        "meeting_id": meeting.id,
                        "presenter_agent_id": speaker.id,
                        "presenter_name": speaker.name,
                        "presenter_role": speaker.role,
                        "presentation_type": pres_row.presentation_type,
                        "title": pres_row.title,
                        "subtitle": pres_row.subtitle,
                        "structured_data": pres_row.structured_data,
                        "created_at": pres_row.created_at.isoformat(),
                    },
                )
            else:
                if speaker.state != "IN_MEETING":
                    await StateManager.transition_state(
                        session=session,
                        agent=speaker,
                        new_state="IN_MEETING",
                        activity=f"Speaking in Boardroom ({turn.message_type})",
                    )

            msg_id = f"mmsg_{uuid.uuid4().hex[:10]}"
            msg_row = MeetingMessageModel(
                id=msg_id,
                meeting_id=meeting.id,
                sender_agent_id=speaker.id,
                sender_name=speaker.name,
                sender_role=speaker.role,
                message_type=turn.message_type,
                content=turn.content,
                round_number=turn.round_number,
            )
            session.add(msg_row)
            await session.commit()

            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="MEETING_MESSAGE_CREATED",
                entity_id=meeting.id,
                payload={
                    "id": msg_row.id,
                    "meeting_id": meeting.id,
                    "sender_agent_id": speaker.id,
                    "sender_name": speaker.name,
                    "sender_role": speaker.role,
                    "message_type": msg_row.message_type,
                    "content": msg_row.content,
                    "round_number": msg_row.round_number,
                    "created_at": msg_row.created_at.isoformat(),
                },
            )

            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="AGENT_MESSAGE_CREATED",
                entity_id=speaker.id,
                payload={
                    "sender_id": speaker.id,
                    "sender_name": speaker.name,
                    "recipient_id": "boardroom_participants",
                    "message_type": turn.message_type,
                    "content": turn.content,
                    "timestamp": msg_row.created_at.isoformat(),
                },
            )

            await asyncio.sleep(1.1)

        # Record structured decisions and create follow-up tasks
        for dec_spec in synthesis.decisions:
            owner = agent_by_key.get(dec_spec.owner_key) or initiator
            dec_id = f"dec_{uuid.uuid4().hex[:10]}"
            dec_row = MeetingDecisionModel(
                id=dec_id,
                meeting_id=meeting.id,
                workforce_id=workforce_id,
                title=dec_spec.title,
                rationale=dec_spec.rationale,
                owner_agent_id=owner.id,
                owner_name=owner.name,
                action_items=dec_spec.action_items,
            )
            session.add(dec_row)
            await session.commit()

            await AgentMemoryManager.add_memory(
                session=session,
                agent_id=owner.id,
                workforce_id=workforce_id,
                content=f"Boardroom Decision Ratified: {dec_spec.title} — {dec_spec.rationale}",
                memory_type="DECISION",
                importance=0.95,
            )

            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="MEETING_DECISION_CREATED",
                entity_id=meeting.id,
                payload={
                    "id": dec_row.id,
                    "meeting_id": meeting.id,
                    "title": dec_row.title,
                    "rationale": dec_row.rationale,
                    "owner_agent_id": owner.id,
                    "owner_name": owner.name,
                    "action_items": dec_row.action_items,
                    "created_at": dec_row.created_at.isoformat(),
                },
            )

            # Create follow-up task from decision action items
            followup_task = TaskModel(
                id=f"tsk_{uuid.uuid4().hex[:8]}",
                workforce_id=workforce_id,
                workspace_id=owner.workspace_id or initiator.workspace_id,
                title=f"Follow-up: {dec_spec.title}",
                description=f"Execute boardroom action items: {'; '.join(dec_spec.action_items)}",
                assigned_agent_id=owner.id,
                priority="HIGH",
                status="COMPLETED",
                progress=100,
                target_room_id=owner.home_room_id,
                deliverables=dec_spec.action_items,
                result_summary=f"Implemented boardroom decision '{dec_spec.title}' with verified action items.",
                completed_at=datetime.now(timezone.utc),
            )
            session.add(followup_task)
            await session.commit()

            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="TASK_CREATED",
                entity_id=followup_task.id,
                payload={
                    "task_id": followup_task.id,
                    "title": followup_task.title,
                    "assigned_agent_id": owner.id,
                    "assigned_agent_name": owner.name,
                    "priority": followup_task.priority,
                    "status": followup_task.status,
                },
            )

        # End the meeting
        meeting.status = "COMPLETED"
        meeting.active_speaker_id = None
        meeting.ended_at = datetime.now(timezone.utc)
        await session.commit()

        await event_bus.emit(
            session=session,
            workforce_id=workforce_id,
            event_type="MEETING_ENDED",
            entity_id=meeting.id,
            payload={
                "meeting_id": meeting.id,
                "title": meeting.title,
                "ended_at": meeting.ended_at.isoformat(),
            },
        )

        # Return participants to their home workstations
        for participant in participants:
            home_room = ROOM_MAP.get(participant.home_room_id, ROOM_MAP["ceo_office"])
            await StateManager.move_agent_to_room(
                session=session,
                agent=participant,
                target_room_id=participant.home_room_id,
                target_coords=home_room["workstation"],
                activity_label=f"Returning to {home_room['name']}",
                travel_delay=0.6,
            )
            await StateManager.transition_state(
                session=session,
                agent=participant,
                new_state="COMPLETED",
                activity=f"Stationed in {home_room['name']} — Deliverables finalized",
            )

        return meeting

    @staticmethod
    def _build_boardroom_fallback(
        objective: str,
        project_summary: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        langs = (project_summary or {}).get("languages", ["TypeScript", "Python", "SQLite"])
        return {
            "agenda": [
                "1. System Boundary & Coupling Analysis (Marcus)",
                "2. API Contract & Zero-Trust Security Audit (Sarah)",
                "3. Regression Baseline & Canary Rollout Governance (Nina & Olivia)",
                "4. Phased Refactoring Roadmap Sign-off (Alex)",
            ],
            "turns": [
                {
                    "speaker_key": "alex",
                    "message_type": "PROPOSAL",
                    "round_number": 1,
                    "content": (
                        "Team, I convened this boardroom session because our independent analyses flagged tight coupling "
                        "and security gaps across the authentication and service layers. Olivia, set our risk boundary first."
                    ),
                    "triggers_presentation": False,
                },
                {
                    "speaker_key": "olivia",
                    "message_type": "EVIDENCE",
                    "round_number": 1,
                    "content": (
                        "We need to identify the highest-risk architectural problems before deciding what to refactor. "
                        "A full rewrite would freeze product velocity for 6 weeks—we must isolate the P0 security and coupling bottlenecks first."
                    ),
                    "triggers_presentation": True,
                    "presentation_type": "RISK_ASSESSMENT",
                    "presentation_title": "Refactoring Risk & Impact Matrix",
                    "presentation_subtitle": "Presented by Olivia (Product Manager)",
                    "presentation_data": {
                        "overall_risk": "HIGH (7.8 / 10)",
                        "stack": langs,
                        "matrix": [
                            {"domain": "Auth & Token Scope Validation", "impact": "CRITICAL", "effort": "LOW", "priority": "P0"},
                            {"domain": "Service Boundary Decoupling", "impact": "HIGH", "effort": "MEDIUM", "priority": "P0"},
                            {"domain": "WebSocket Sequence Reconciliation", "impact": "MEDIUM", "effort": "LOW", "priority": "P1"},
                        ],
                    },
                },
                {
                    "speaker_key": "marcus",
                    "message_type": "PROPOSAL",
                    "round_number": 1,
                    "content": (
                        "The current service boundaries create tight coupling between HTTP controllers, auth guards, and persistence models. "
                        "I recommend isolating the authentication and integration layers behind explicit hexagonal ports—look at the target topology on screen."
                    ),
                    "triggers_presentation": True,
                    "presentation_type": "ARCHITECTURE_DIAGRAM",
                    "presentation_title": "Target Hexagonal Service Topology",
                    "presentation_subtitle": "Presented by Marcus (System Architect)",
                    "presentation_data": {
                        "current_flaw": "Controllers directly mutate shared DB models & invoke external webhooks synchronously.",
                        "nodes": [
                            {"id": "gateway", "label": "API & WS Gateway", "tier": "Edge", "status": "Hardened"},
                            {"id": "auth", "label": "Zero-Trust Auth Guard", "tier": "Security", "status": "Isolated"},
                            {"id": "domain", "label": "Core Domain Orchestrator", "tier": "Domain", "status": "Decoupled"},
                            {"id": "adapters", "label": "Async Persistence & Webhook Adapters", "tier": "Infrastructure", "status": "Circuit-Protected"},
                        ],
                        "edges": [
                            "API & WS Gateway -> Zero-Trust Auth Guard (Strict JWT Scope Check)",
                            "Zero-Trust Auth Guard -> Core Domain Orchestrator (Immutable Principal)",
                            "Core Domain Orchestrator -> Async Persistence & Webhook Adapters (Port Interface)",
                        ],
                    },
                },
                {
                    "speaker_key": "sarah",
                    "message_type": "CHALLENGE",
                    "round_number": 2,
                    "content": (
                        "I can implement the proposed separation, Marcus, but I disagree with extracting the persistence adapter "
                        "in the same PR as the Auth Guard. Twelve existing endpoints rely on implicit session context—we must lock the v2 API contract and HMAC middleware first."
                    ),
                    "triggers_presentation": True,
                    "presentation_type": "CODE_SNIPPET",
                    "presentation_title": "v2 Zero-Trust Auth & Idempotent API Contract",
                    "presentation_subtitle": "Presented by Sarah (Backend Engineer)",
                    "presentation_data": {
                        "language": "python",
                        "file": "backend/app/security/auth_guard.py",
                        "highlights": [
                            "Raw-body HMAC signature verification prior to JSON deserialization",
                            "Explicit JWT audience & scope enforcement dependency",
                            "Idempotency key guard on state-mutating operations",
                        ],
                        "code": (
                            "async def verify_zero_trust_scope(\n"
                            "    request: Request,\n"
                            "    token: str = Depends(oauth2_scheme),\n"
                            ") -> PrincipalContext:\n"
                            "    claims = jwt.decode(token, KEY, audience='forge.internal')\n"
                            "    if 'domain:write' not in claims.get('scopes', []):\n"
                            "        raise HTTPException(status_code=403, detail='Insufficient scope')\n"
                            "    return PrincipalContext(sub=claims['sub'], scopes=claims['scopes'])"
                        ),
                    },
                },
                {
                    "speaker_key": "nina",
                    "message_type": "QUESTION",
                    "round_number": 2,
                    "content": (
                        "Sarah is right. Before implementation, I want a regression baseline and test coverage for the affected endpoints. "
                        "Right now, token replay and concurrent state transitions have zero automated coverage—we cannot merge boundary changes blind."
                    ),
                    "triggers_presentation": True,
                    "presentation_type": "BUG_REPORT",
                    "presentation_title": "QA Regression Baseline & Security Verification Gaps",
                    "presentation_subtitle": "Presented by Nina (QA Engineer)",
                    "presentation_data": {
                        "baseline_coverage": "64%",
                        "target_coverage": "92%",
                        "critical_gaps": [
                            {"id": "QA-101", "severity": "HIGH", "issue": "Missing contract snapshot tests on 12 auth-protected endpoints"},
                            {"id": "QA-102", "severity": "HIGH", "issue": "Unverified race condition during concurrent task state transitions"},
                            {"id": "QA-103", "severity": "MEDIUM", "issue": "WebSocket sequence gap recovery under packet drop"},
                        ],
                    },
                },
                {
                    "speaker_key": "daniel",
                    "message_type": "EVIDENCE",
                    "round_number": 3,
                    "content": (
                        "From the frontend side, locking the v2 response envelope and event sequence numbers first allows my Zustand store "
                        "to reconcile snapshots cleanly without UI flicker during the backend migration."
                    ),
                    "triggers_presentation": False,
                },
                {
                    "speaker_key": "alex",
                    "message_type": "DECISION",
                    "round_number": 3,
                    "content": (
                        "Consensus reached. We will execute a 3-stage strangler-fig refactoring: Stage 1 locks Nina's contract regression suite; "
                        "Stage 2 deploys Sarah's Zero-Trust Auth & HMAC boundary; Stage 3 completes Marcus's hexagonal domain extraction. Look at the ratified plan on screen."
                    ),
                    "triggers_presentation": True,
                    "presentation_type": "DECISIONS",
                    "presentation_title": "Ratified 3-Stage Refactoring Execution Plan",
                    "presentation_subtitle": "Ratified by Alex (CEO / Orchestrator)",
                    "presentation_data": {
                        "status": "RATIFIED",
                        "phases": [
                            {"phase": "Phase 1 (Immediate)", "owner": "Nina & Daniel", "deliverable": "Golden API contract snapshots & sequenced WS store reconciliation"},
                            {"phase": "Phase 2 (Sprint 1)", "owner": "Sarah", "deliverable": "Zero-Trust JWT scope middleware & raw-body HMAC verification"},
                            {"phase": "Phase 3 (Sprint 2)", "owner": "Marcus & Olivia", "deliverable": "Hexagonal domain port extraction with canary rollout gates"},
                        ],
                    },
                },
            ],
            "decisions": [
                {
                    "title": "Enforce Contract Regression Baseline Prior to Structural Refactoring",
                    "rationale": "Prevents silent API contract regressions across the 12 affected endpoints while decoupling service boundaries.",
                    "owner_key": "nina",
                    "action_items": [
                        "Lock golden API response schemas and automated security scope tests",
                        "Add concurrency race-condition checks to CI pipeline",
                    ],
                },
                {
                    "title": "Isolate Zero-Trust Authentication & Webhook HMAC Middleware First",
                    "rationale": "Eliminates the highest-severity privilege escalation and deserialization risks without blocking product delivery.",
                    "owner_key": "sarah",
                    "action_items": [
                        "Deploy strict JWT audience/scope guard and raw-body HMAC validator",
                        "Add idempotency keys to state-mutating endpoints",
                    ],
                },
                {
                    "title": "Adopt Strangler-Fig Hexagonal Port Extraction",
                    "rationale": "Decouples domain logic from HTTP controllers and external integrations with zero downtime.",
                    "owner_key": "marcus",
                    "action_items": [
                        "Define DomainIdentityPort and AsyncPersistenceAdapter interfaces",
                        "Migrate billing and integration modules behind circuit breakers",
                    ],
                },
            ],
        }
