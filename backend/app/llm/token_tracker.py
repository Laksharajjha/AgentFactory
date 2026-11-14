import uuid
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AgentModel, LLMRequestModel, TokenUsageModel, WorkforceModel

# Known Gemini API per-1M token pricing (USD)
MODEL_PRICING_PER_1M: Dict[str, Dict[str, float]] = {
    "gemini-3.1-flash-lite": {"input": 0.075, "output": 0.30},
    "gemini-3.5-flash-lite": {"input": 0.075, "output": 0.30},
    "gemini-2.5-flash-lite": {"input": 0.075, "output": 0.30},
    "gemini-2.5-flash": {"input": 0.15, "output": 0.60},
    "gemini-3-flash": {"input": 0.15, "output": 0.60},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
    "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
}


def estimate_cost_usd(model_id: str, input_tokens: int, output_tokens: int, is_live_api: bool = True) -> float:
    if not is_live_api:
        return 0.0
    pricing = None
    for key, rates in MODEL_PRICING_PER_1M.items():
        if key in model_id.lower():
            pricing = rates
            break
    if not pricing:
        pricing = {"input": 0.15, "output": 0.60}
    cost = (input_tokens / 1_000_000.0) * pricing["input"] + (output_tokens / 1_000_000.0) * pricing["output"]
    return round(cost, 6)


class TokenTracker:
    """Records every LLM request and maintains per-agent and global token ledgers."""

    @staticmethod
    async def record_request(
        session: AsyncSession,
        workforce_id: str,
        agent_id: Optional[str],
        model_id: str,
        operation: str,
        input_tokens: int,
        output_tokens: int,
        duration_ms: float,
        success: bool = True,
        is_live_api: bool = True,
        error_message: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        total_tokens = input_tokens + output_tokens
        cost_usd = estimate_cost_usd(model_id, input_tokens, output_tokens, is_live_api=is_live_api)

        wf_res = await session.execute(
            select(WorkforceModel).where(WorkforceModel.id == workforce_id)
        )
        workforce = wf_res.scalar_one_or_none()
        ws_id = workspace_id or (workforce.workspace_id if workforce else None)
        usr_id = workforce.user_id if workforce else None

        req_record = LLMRequestModel(
            id=f"req_{uuid.uuid4().hex[:10]}",
            workforce_id=workforce_id,
            user_id=usr_id,
            workspace_id=ws_id,
            agent_id=agent_id,
            model_id=model_id,
            operation=operation,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            duration_ms=round(duration_ms, 2),
            estimated_cost_usd=cost_usd,
            success=success,
            is_live_api=is_live_api,
            error_message=error_message,
        )
        session.add(req_record)

        if workforce and success:
            workforce.tokens_used = (workforce.tokens_used or 0) + total_tokens
            workforce.llm_calls_made = (workforce.llm_calls_made or 0) + 1

        if agent_id and success:
            ag_res = await session.execute(
                select(AgentModel).where(AgentModel.id == agent_id)
            )
            agent = ag_res.scalar_one_or_none()
            if agent:
                agent.tokens_used = (agent.tokens_used or 0) + total_tokens

        usage_res = await session.execute(
            select(TokenUsageModel).where(
                TokenUsageModel.workforce_id == workforce_id,
                TokenUsageModel.agent_id == agent_id,
                TokenUsageModel.model_id == model_id,
            )
        )
        usage_row = usage_res.scalars().first()
        if not usage_row:
            usage_row = TokenUsageModel(
                id=f"tu_{uuid.uuid4().hex[:10]}",
                workforce_id=workforce_id,
                user_id=usr_id,
                workspace_id=ws_id,
                agent_id=agent_id,
                model_id=model_id,
                input_tokens=input_tokens if success else 0,
                output_tokens=output_tokens if success else 0,
                total_tokens=total_tokens if success else 0,
                estimated_cost_usd=cost_usd if success else 0.0,
            )
            session.add(usage_row)
        elif success:
            usage_row.input_tokens += input_tokens
            usage_row.output_tokens += output_tokens
            usage_row.total_tokens += total_tokens
            usage_row.estimated_cost_usd = round((usage_row.estimated_cost_usd or 0.0) + cost_usd, 6)

        await session.commit()
        return {
            "request_id": req_record.id,
            "workforce_id": workforce_id,
            "workspace_id": ws_id,
            "agent_id": agent_id,
            "model_id": model_id,
            "operation": operation,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": cost_usd,
            "is_live_api": is_live_api,
            "workforce_tokens_used": workforce.tokens_used if workforce else total_tokens,
            "workforce_calls_made": workforce.llm_calls_made if workforce else 1,
        }
