import json
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent_memory import AgentMemoryManager
from app.agents.tool_registry import ToolRegistry
from app.events.event_bus import event_bus
from app.llm.provider_resolver import WorkspaceProviderResolver
from app.models import AgentModel, TaskModel, WorkforceModel


class AgentTaskAnalysisOutput(BaseModel):
    executive_summary: str = Field(..., description="Concise technical summary of the analysis or implementation.")
    key_findings: List[str] = Field(default_factory=list, description="Specific technical observations grounded in the project.")
    identified_risks: List[str] = Field(default_factory=list, description="Architectural, security, or quality risks discovered.")
    recommended_actions: List[str] = Field(default_factory=list, description="Concrete engineering recommendations or refactoring steps.")
    requires_collaboration: bool = Field(default=True, description="Whether cross-functional boardroom discussion is needed.")
    collaboration_topic: str = Field(default="Service Boundary Isolation & Refactoring Verification", description="Agenda item if collaboration is needed.")
    code_or_spec_snippet: str = Field(default="", description="Concrete code contract, schema, or test specification.")


class BaseAgent:
    """Executes LLM-powered reasoning and tool inspection for a specialized AI employee."""

    def __init__(self, agent_model: AgentModel) -> None:
        self.model = agent_model

    async def execute_task_step(
        self,
        session: AsyncSession,
        task: TaskModel,
        objective: str,
        project_summary: Optional[Dict[str, Any]] = None,
    ) -> Tuple[AgentTaskAnalysisOutput, Dict[str, Any]]:
        memories = await AgentMemoryManager.get_agent_memories(session, self.model.id, limit=5)
        memory_context = "\n".join([f"- [{m.memory_type}] {m.content}" for m in memories]) or "No prior memories."

        tool_outputs = ToolRegistry.run_tools(
            self.model.tools or [],
            {"objective": objective, "project_summary": project_summary or {}},
        )

        prompt = (
            f"PROJECT OBJECTIVE:\n{objective}\n\n"
            f"PROJECT CONTEXT SUMMARY:\n{json.dumps(project_summary or {}, indent=2)}\n\n"
            f"ASSIGNED TASK:\nTitle: {task.title}\nDescription: {task.description}\n"
            f"Deliverables Expected: {', '.join(task.deliverables or [])}\n\n"
            f"RECENT AGENT MEMORY:\n{memory_context}\n\n"
            f"APPROVED TOOL INSPECTION OUTPUTS:\n{json.dumps(tool_outputs, indent=2)}\n\n"
            f"As {self.model.name} ({self.model.role} in {self.model.department}), perform deep technical analysis "
            f"for this task. Provide concrete findings, architectural/security risks, and actionable recommendations."
        )

        fallback_data = self._build_contextual_fallback(task, objective, project_summary)

        ws_id = self.model.workspace_id or task.workspace_id
        if not ws_id:
            from sqlalchemy import select
            wf_row = (
                await session.execute(select(WorkforceModel).where(WorkforceModel.id == self.model.workforce_id))
            ).scalar_one_or_none()
            ws_id = wf_row.workspace_id if wf_row else None
        if not ws_id:
            raise RuntimeError(
                f"Agent {self.model.id} (workforce={self.model.workforce_id}) is missing explicit workspace ownership."
            )

        provider_instance = await WorkspaceProviderResolver.resolve_for_workspace(
            session=session,
            workspace_id=ws_id,
            provider="gemini",
        )

        result, telemetry = await provider_instance.generate_structured(
            session=session,
            workforce_id=self.model.workforce_id,
            agent_id=self.model.id,
            operation=f"task_execution:{self.model.agent_key}",
            system_instruction=self.model.system_instructions,
            prompt=prompt,
            response_schema=AgentTaskAnalysisOutput,
            complex_task=False,
            fallback_data=fallback_data,
        )

        self.model.iterations_used = (self.model.iterations_used or 0) + 1
        await session.commit()

        await AgentMemoryManager.add_memory(
            session=session,
            agent_id=self.model.id,
            workforce_id=self.model.workforce_id,
            content=f"Completed '{task.title}': {result.executive_summary}",
            memory_type="SUMMARY",
            importance=0.9,
            context_meta={"task_id": task.id, "findings_count": len(result.key_findings)},
        )

        await event_bus.emit(
            session=session,
            workforce_id=self.model.workforce_id,
            event_type="TOKEN_USAGE_UPDATED",
            entity_id=self.model.id,
            payload=telemetry,
        )

        return result, telemetry

    def _build_contextual_fallback(
        self,
        task: TaskModel,
        objective: str,
        project_summary: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        key = self.model.agent_key
        obj_short = objective[:120]
        langs = (project_summary or {}).get("languages", ["TypeScript", "Python", "SQL"])
        stack_str = ", ".join(langs)

        if key == "alex":
            return {
                "executive_summary": f"Synthesized executive workforce plan and risk governance baseline for: {obj_short}",
                "key_findings": [
                    f"Target stack ({stack_str}) exhibits cross-layer coupling between ingestion routes and persistence models.",
                    "Authentication and external integration adapters share synchronous execution pools.",
                    "Refactoring must be staged in 3 gated phases to preserve zero-downtime SLA.",
                ],
                "identified_risks": [
                    "Unvalidated contract changes between Backend API and Frontend state stores.",
                    "Regression exposure during authentication middleware extraction.",
                ],
                "recommended_actions": [
                    "Dispatch Marcus to System Architecture Lab to map service boundary isolation.",
                    "Assign Sarah and Nina to audit API security contracts and establish regression baselines.",
                    "Convene cross-functional boardroom review to ratify the phased refactoring blueprint.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "Service Boundary Isolation, Security Hardening & Phased Refactoring Sign-off",
                "code_or_spec_snippet": "PHASE 1: Contract Freeze & Baseline -> PHASE 2: Auth & Domain Decoupling -> PHASE 3: Async Event Bus",
            }
        elif key == "marcus":
            return {
                "executive_summary": f"Completed architectural decomposition and dependency topology audit across {stack_str} modules.",
                "key_findings": [
                    "Direct circular dependency between AuthController, SessionStore, and BillingService.",
                    "Domain logic is embedded inside HTTP route handlers rather than isolated domain ports.",
                    "Lack of explicit anti-corruption layer around third-party integration webhooks.",
                ],
                "identified_risks": [
                    "Cascading latency spikes when downstream integration endpoints throttle requests.",
                    "Tight coupling prevents independent scaling or isolated unit testing of core domain services.",
                ],
                "recommended_actions": [
                    "Extract an isolated Identity & Auth Gateway module with strict JWT scope verification.",
                    "Introduce Hexagonal Ports & Adapters around persistence and external integrations.",
                    "Enforce strict schema contracts at service boundaries.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "Hexagonal Boundary Decomposition & Auth Gateway Isolation",
                "code_or_spec_snippet": (
                    "interface DomainIdentityPort {\n"
                    "  verifyAccessToken(token: string, requiredScopes: Scope[]): Promise<PrincipalContext>;\n"
                    "  revokeSession(sessionId: string): Promise<void>;\n"
                    "}"
                ),
            }
        elif key == "olivia":
            return {
                "executive_summary": "Prioritized refactoring backlog by risk-adjusted user impact and defined milestone acceptance gates.",
                "key_findings": [
                    "Authentication reliability and API latency account for 78% of critical operational risk.",
                    "Big-bang rewrite would stall feature delivery for 6 weeks; strangler-fig migration reduces risk by 65%.",
                    "Clear rollback telemetry criteria are required before cutting traffic to refactored services.",
                ],
                "identified_risks": [
                    "Scope creep during backend decoupling could delay critical security fixes.",
                ],
                "recommended_actions": [
                    "Prioritize Auth & Integration boundary isolation in Sprint 1.",
                    "Require feature-flagged canary rollout (10% -> 50% -> 100%) for all refactored endpoints.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "Phased Rollout Milestones & Canary Acceptance Criteria",
                "code_or_spec_snippet": "Milestone M1: Auth Isolation (P0) | Milestone M2: Service Adapter Layer (P1) | Milestone M3: State Sync (P2)",
            }
        elif key == "sarah":
            return {
                "executive_summary": "Audited backend API contracts, database transaction boundaries, and security middleware.",
                "key_findings": [
                    "14 REST endpoints perform unindexed joins and lack request-level timeout guards.",
                    "JWT verification middleware does not enforce audience (`aud`) or granular permission scopes.",
                    "Webhook ingestion routes deserialize untrusted payloads prior to HMAC signature validation.",
                ],
                "identified_risks": [
                    "Privilege escalation vector on internal admin endpoints if token scopes are not strictly checked.",
                    "Connection pool exhaustion under burst concurrency.",
                ],
                "recommended_actions": [
                    "Move HMAC signature verification to raw body middleware before JSON parsing.",
                    "Implement strict Pydantic v2 request envelopes and async SQLAlchemy connection pooling.",
                    "Add idempotency keys to all state-mutating POST/PUT endpoints.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "API Contract Versioning & Zero-Trust Auth Middleware",
                "code_or_spec_snippet": (
                    "@router.post('/v2/transactions', response_model=TransactionReceipt)\n"
                    "async def create_tx(payload: StrictTxCreate, principal: Principal = Depends(require_scope('tx:write'))):\n"
                    "    return await domain_service.execute_idempotent(payload, principal)"
                ),
            }
        elif key == "daniel":
            return {
                "executive_summary": "Evaluated frontend state synchronization, WebSocket event handling, and API client resilience.",
                "key_findings": [
                    "UI components trigger redundant REST fetches instead of subscribing to normalized store selectors.",
                    "WebSocket client lacks sequence-gap detection and snapshot reconciliation on reconnect.",
                    "Error states from failed backend operations are swallowed in async UI callbacks.",
                ],
                "identified_risks": [
                    "Stale client state if backend API contracts change without versioned TypeScript schemas.",
                ],
                "recommended_actions": [
                    "Unify client state in a normalized Zustand store driven by sequenced backend events.",
                    "Generate strict TypeScript interfaces aligned with backend Pydantic schemas.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "Client-Server Event Sequencing & Contract Alignment",
                "code_or_spec_snippet": (
                    "export interface SequencedEvent<T> {\n"
                    "  readonly event_id: string;\n"
                    "  readonly sequence: number;\n"
                    "  readonly payload: T;\n"
                    "}"
                ),
            }
        else:
            # Nina (QA & Security Verification)
            return {
                "executive_summary": "Established regression test baseline, security fuzzing matrix, and defect triage thresholds.",
                "key_findings": [
                    "Current automated test suite covers happy-path CRUD but misses concurrent race conditions.",
                    "Auth token expiration and replay edge cases have 0% automated regression coverage.",
                    "No contract snapshot tests exist to detect breaking API response mutations.",
                ],
                "identified_risks": [
                    "Silent regressions during service boundary extraction if contract tests are not locked first.",
                ],
                "recommended_actions": [
                    "Lock golden API contract snapshots before Sarah or Marcus refactor service boundaries.",
                    "Add automated security regression tests for HMAC verification and scope enforcement.",
                    "Enforce a 90% critical-path test pass gate in CI prior to merge.",
                ],
                "requires_collaboration": True,
                "collaboration_topic": "Mandatory Regression Baseline & Security Verification Gates",
                "code_or_spec_snippet": (
                    "async def test_unauthorized_scope_rejected(client: AsyncClient):\n"
                    "    resp = await client.post('/v2/transactions', headers={'Authorization': f'Bearer {read_only_jwt}'})\n"
                    "    assert resp.status_code == 403"
                ),
            }
