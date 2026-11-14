from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import AgentModel, WorkforceModel


class BudgetExhaustedError(Exception):
    pass


class BudgetManager:
    """Enforces token budgets, iteration limits, and LLM request ceilings."""

    @staticmethod
    async def check_can_execute(
        session: AsyncSession,
        workforce_id: str,
        agent_id: Optional[str] = None,
    ) -> Tuple[bool, str]:
        wf_res = await session.execute(
            select(WorkforceModel).where(WorkforceModel.id == workforce_id)
        )
        workforce = wf_res.scalar_one_or_none()
        if not workforce:
            return False, f"Workforce {workforce_id} not found"

        if workforce.llm_calls_made >= workforce.max_llm_calls:
            return (
                False,
                f"Workforce LLM call limit reached ({workforce.llm_calls_made}/{workforce.max_llm_calls})",
            )

        if workforce.tokens_used >= workforce.token_budget:
            return (
                False,
                f"Global workforce token budget exhausted ({workforce.tokens_used}/{workforce.token_budget})",
            )

        if agent_id:
            ag_res = await session.execute(
                select(AgentModel).where(AgentModel.id == agent_id)
            )
            agent = ag_res.scalar_one_or_none()
            if agent:
                if agent.iterations_used >= agent.max_iterations:
                    return (
                        False,
                        f"Agent {agent.name} max iterations reached ({agent.iterations_used}/{agent.max_iterations})",
                    )
                if agent.tokens_used >= agent.token_budget:
                    return (
                        False,
                        f"Agent {agent.name} token budget exhausted ({agent.tokens_used}/{agent.token_budget})",
                    )

        return True, "OK"

    @staticmethod
    def get_max_output_tokens(requested_max: Optional[int] = None) -> int:
        if requested_max is None:
            return settings.MAX_OUTPUT_TOKENS
        return min(requested_max, settings.MAX_OUTPUT_TOKENS)
