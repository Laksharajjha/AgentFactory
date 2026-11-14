from dataclasses import dataclass
from typing import Any, Dict, List, Set

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"


@dataclass(frozen=True)
class ModelCapabilitySpec:
    model_id: str
    provider: str
    label: str
    rpm: int
    tpm: int
    rpd: int
    min_interval_sec: float
    recommended: bool = False
    supports_complex_reasoning: bool = True


# Authoritative Gemini Model Catalog supported for workspace selection
GEMINI_MODEL_SPECS: Dict[str, ModelCapabilitySpec] = {
    "gemini-3.1-flash-lite": ModelCapabilitySpec(
        model_id="gemini-3.1-flash-lite",
        provider="gemini",
        label="Gemini 3.1 Flash Lite (Verified Live)",
        rpm=15,
        tpm=250_000,
        rpd=500,
        min_interval_sec=4.2,
        recommended=True,
        supports_complex_reasoning=True,
    ),
    "gemini-3.1-flash-lite-preview": ModelCapabilitySpec(
        model_id="gemini-3.1-flash-lite-preview",
        provider="gemini",
        label="Gemini 3.1 Flash Lite Preview",
        rpm=15,
        tpm=250_000,
        rpd=500,
        min_interval_sec=4.2,
        recommended=False,
        supports_complex_reasoning=True,
    ),
    "gemini-3.5-flash-lite": ModelCapabilitySpec(
        model_id="gemini-3.5-flash-lite",
        provider="gemini",
        label="Gemini 3.5 Flash Lite",
        rpm=15,
        tpm=250_000,
        rpd=500,
        min_interval_sec=4.2,
        recommended=False,
        supports_complex_reasoning=True,
    ),
    "gemini-2.5-flash-lite": ModelCapabilitySpec(
        model_id="gemini-2.5-flash-lite",
        provider="gemini",
        label="Gemini 2.5 Flash Lite",
        rpm=10,
        tpm=250_000,
        rpd=20,
        min_interval_sec=6.2,
        recommended=False,
        supports_complex_reasoning=True,
    ),
    "gemini-2.5-flash": ModelCapabilitySpec(
        model_id="gemini-2.5-flash",
        provider="gemini",
        label="Gemini 2.5 Flash",
        rpm=5,
        tpm=250_000,
        rpd=20,
        min_interval_sec=12.5,
        recommended=False,
        supports_complex_reasoning=True,
    ),
    "gemini-3-flash-preview": ModelCapabilitySpec(
        model_id="gemini-3-flash-preview",
        provider="gemini",
        label="Gemini 3 Flash Preview",
        rpm=5,
        tpm=250_000,
        rpd=20,
        min_interval_sec=12.5,
        recommended=False,
        supports_complex_reasoning=True,
    ),
}

# Models known to have 0/0 free-tier quota or deprecated status — explicitly rejected on selection
ZERO_QUOTA_FREE_TIER_MODELS: Set[str] = {
    "gemini-2.5-pro",
    "gemini-3.1-pro",
    "gemini-3.1-pro-preview",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
}

ALLOWED_GEMINI_MODELS: Set[str] = set(GEMINI_MODEL_SPECS.keys())

FALLBACK_MODEL_CHAIN: List[str] = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
]

FREE_TIER_MODEL_LIMITS: Dict[str, Dict[str, Any]] = {
    model_id: {
        "label": spec.label,
        "rpm": spec.rpm,
        "tpm": spec.tpm,
        "rpd": spec.rpd,
        "min_interval_sec": spec.min_interval_sec,
        "recommended": spec.recommended,
    }
    for model_id, spec in GEMINI_MODEL_SPECS.items()
}


def validate_gemini_model_id(model_id: str) -> str:
    """Validates a requested Gemini model ID against the authoritative allowlist and zero-quota blocklist."""
    cleaned = (model_id or "").strip()
    if cleaned in ZERO_QUOTA_FREE_TIER_MODELS:
        raise ValueError(
            f"Model '{cleaned}' is marked zero-quota or deprecated for this tier and cannot be selected. "
            f"Allowed models: {sorted(ALLOWED_GEMINI_MODELS)}"
        )
    if cleaned not in ALLOWED_GEMINI_MODELS:
        raise ValueError(
            f"Unsupported Gemini model '{cleaned}'. Allowed models: {sorted(ALLOWED_GEMINI_MODELS)}"
        )
    return cleaned


def serialize_model_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "model_id": spec.model_id,
            "provider": spec.provider,
            "label": spec.label,
            "rpm": spec.rpm,
            "tpm": spec.tpm,
            "rpd": spec.rpd,
            "min_interval_sec": spec.min_interval_sec,
            "recommended": spec.recommended,
        }
        for spec in GEMINI_MODEL_SPECS.values()
    ]
