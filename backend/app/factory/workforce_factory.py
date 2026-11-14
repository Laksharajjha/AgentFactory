import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.events.event_bus import event_bus
from app.models import AgentModel, TaskDependencyModel, TaskModel
from app.world.layout import INITIAL_EMPLOYEES


class PlannedTaskBlueprint(BaseModel):
    key: str
    title: str
    description: str
    assigned_agent_key: str
    target_room_id: str
    priority: str = "HIGH"
    depends_on_keys: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)


class WorkforcePlanBlueprint(BaseModel):
    objective_summary: str
    required_capabilities: List[str]
    agents: List[Dict[str, Any]]
    tasks: List[PlannedTaskBlueprint]
    validation_passed: bool = True


class WorkforceFactory:
    """Parses user objectives and project archives into a validated workforce & dependency-ordered task plan."""

    @staticmethod
    def build_workforce_plan(
        objective: str,
        project_summary: Optional[Dict[str, Any]] = None,
    ) -> WorkforcePlanBlueprint:
        langs = (project_summary or {}).get("languages", ["TypeScript", "Python"])
        stack_label = ", ".join(langs)

        tasks: List[PlannedTaskBlueprint] = [
            PlannedTaskBlueprint(
                key="task_exec_intake",
                title="Executive Objective Decomposition & Risk Charter",
                description=(
                    f"Analyze incoming request ('{objective[:140]}') in the CEO Office, define scope boundaries "
                    f"for stack ({stack_label}), and dispatch workstreams across Architecture, Engineering, and QA."
                ),
                assigned_agent_key="alex",
                target_room_id="ceo_office",
                priority="CRITICAL",
                depends_on_keys=[],
                deliverables=[
                    "Executive Workstream Charter",
                    "Company Risk Governance Baseline",
                ],
            ),
            PlannedTaskBlueprint(
                key="task_product_scope",
                title="Refactoring Impact Matrix & Milestone Prioritization",
                description=(
                    "Classify architectural and security weaknesses by user impact, establish phased delivery gates, "
                    "and prevent scope creep during service extraction."
                ),
                assigned_agent_key="olivia",
                target_room_id="product_room",
                priority="HIGH",
                depends_on_keys=["task_exec_intake"],
                deliverables=[
                    "Prioritized Refactoring Backlog",
                    "Canary Rollout Acceptance Criteria",
                ],
            ),
            PlannedTaskBlueprint(
                key="task_arch_audit",
                title="Service Boundary & Coupling Topology Analysis",
                description=(
                    "Move to System Architecture Lab, inspect module dependencies and tight coupling, "
                    "and design a hexagonal boundary decomposition blueprint."
                ),
                assigned_agent_key="marcus",
                target_room_id="architecture_lab",
                priority="CRITICAL",
                depends_on_keys=["task_exec_intake"],
                deliverables=[
                    "Target Hexagonal Service Topology Diagram",
                    "Coupling Bottleneck Inventory",
                ],
            ),
            PlannedTaskBlueprint(
                key="task_backend_security",
                title="API Contract Audit & Zero-Trust Security Hardening",
                description=(
                    "Inspect backend route controllers, authentication token scopes, webhook deserialization, "
                    "and database transaction safety in the Backend Engineering Room and Security Room."
                ),
                assigned_agent_key="sarah",
                target_room_id="security_room",
                priority="CRITICAL",
                depends_on_keys=["task_exec_intake"],
                deliverables=[
                    "v2 Zero-Trust Auth & HMAC Middleware Spec",
                    "Idempotent API Contract Envelope",
                ],
            ),
            PlannedTaskBlueprint(
                key="task_frontend_sync",
                title="Client State Store & Sequenced Event Synchronization Review",
                description=(
                    "Evaluate frontend state architecture, WebSocket sequence reconciliation, and strict TypeScript contract alignment."
                ),
                assigned_agent_key="daniel",
                target_room_id="frontend_room",
                priority="HIGH",
                depends_on_keys=["task_exec_intake"],
                deliverables=[
                    "Normalized Store Reconciliation Spec",
                    "Strict Client-Server Type Contracts",
                ],
            ),
            PlannedTaskBlueprint(
                key="task_qa_baseline",
                title="Regression Baseline & Security Verification Matrix",
                description=(
                    "Move to QA Laboratory, audit automated test coverage gaps, and establish mandatory contract snapshot "
                    "and security regression gates prior to refactoring."
                ),
                assigned_agent_key="nina",
                target_room_id="qa_lab",
                priority="HIGH",
                depends_on_keys=["task_exec_intake"],
                deliverables=[
                    "Golden API Contract Regression Suite",
                    "Security Fuzzing & Race Condition Matrix",
                ],
            ),
        ]

        return WorkforcePlanBlueprint(
            objective_summary=objective,
            required_capabilities=[
                "workforce_orchestration",
                "system_architecture",
                "requirements_engineering",
                "code_analysis",
                "security_hardening",
                "ui_architecture",
                "regression_analysis",
            ],
            agents=INITIAL_EMPLOYEES,
            tasks=tasks,
            validation_passed=True,
        )

    @staticmethod
    async def materialize_tasks(
        session: AsyncSession,
        workforce_id: str,
        plan: WorkforcePlanBlueprint,
        agents: List[AgentModel],
    ) -> List[TaskModel]:
        agent_by_key = {a.agent_key: a for a in agents}
        default_ws_id = next((a.workspace_id for a in agents if a.workspace_id), None)
        created_by_key: Dict[str, TaskModel] = {}
        ordered_tasks: List[TaskModel] = []

        for bp in plan.tasks:
            assigned_agent = agent_by_key.get(bp.assigned_agent_key)
            task_id = f"tsk_{uuid.uuid4().hex[:8]}"
            task = TaskModel(
                id=task_id,
                workforce_id=workforce_id,
                workspace_id=(assigned_agent.workspace_id if assigned_agent and assigned_agent.workspace_id else default_ws_id),
                title=bp.title,
                description=bp.description,
                assigned_agent_id=assigned_agent.id if assigned_agent else None,
                priority=bp.priority,
                status="PENDING",
                progress=0,
                target_room_id=bp.target_room_id,
                deliverables=bp.deliverables,
                execution_history=[],
            )
            session.add(task)
            created_by_key[bp.key] = task
            ordered_tasks.append(task)

        await session.commit()

        for bp in plan.tasks:
            task = created_by_key[bp.key]
            for dep_key in bp.depends_on_keys:
                dep_task = created_by_key.get(dep_key)
                if dep_task:
                    session.add(
                        TaskDependencyModel(
                            task_id=task.id,
                            depends_on_task_id=dep_task.id,
                        )
                    )
        await session.commit()

        for task in ordered_tasks:
            ag = next((a for a in agents if a.id == task.assigned_agent_id), None)
            await event_bus.emit(
                session=session,
                workforce_id=workforce_id,
                event_type="TASK_CREATED",
                entity_id=task.id,
                payload={
                    "task_id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "assigned_agent_id": task.assigned_agent_id,
                    "assigned_agent_name": ag.name if ag else None,
                    "priority": task.priority,
                    "status": task.status,
                    "target_room_id": task.target_room_id,
                    "deliverables": task.deliverables,
                },
            )

        return ordered_tasks
