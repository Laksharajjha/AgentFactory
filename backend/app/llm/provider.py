from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple, Type
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings


class BaseLLMProvider(ABC):
    """Abstract interface for LLM execution providers with model routing."""

    def select_model(self, complex_task: bool = False) -> str:
        if complex_task and settings.ENABLE_COMPLEX_MODEL:
            return settings.GEMINI_COMPLEX_MODEL
        return settings.GEMINI_MODEL

    @abstractmethod
    async def generate_structured(
        self,
        session: AsyncSession,
        workforce_id: str,
        agent_id: Optional[str],
        operation: str,
        system_instruction: str,
        prompt: str,
        response_schema: Type[BaseModel],
        complex_task: bool = False,
        fallback_data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[BaseModel, Dict[str, Any]]:
        pass
