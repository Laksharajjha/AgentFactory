from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List


@dataclass
class ToolDefinition:
    name: str
    category: str  # github, filesystem, terminal, artifacts, research
    description: str
    permission_required: str
    allowed_agent_keys: List[str]
    timeout_seconds: int = 30
    resource_tier: str = "STANDARD"
    requires_approval_gate: bool = False
    input_schema: Dict[str, Any] = field(default_factory=dict)
    output_schema: Dict[str, Any] = field(default_factory=dict)
    handler: Callable[..., Any] | None = None
