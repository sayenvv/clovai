"""Central LLM configuration loaded from environment variables."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.workflows.schemas import WorkflowModelConfig


def _read_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    return float(raw)


def _read_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    return int(raw)


def _read_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def model_supports_sampling_parameters(model: str) -> bool:
    """Return False for reasoning models that reject temperature and related sampling knobs."""
    normalized = model.strip().lower()
    if normalized.startswith("gpt-5"):
        return False
    if re.match(r"^o\d", normalized):
        return False
    return True


@dataclass(frozen=True, slots=True)
class LlmSettings:
    provider: str
    model: str
    temperature: float
    top_p: float
    max_tokens: int
    presence_penalty: float
    frequency_penalty: float
    seed: int | None
    stream: bool
    openai_api_key: str
    openai_base_url: str | None
    azure_openai_endpoint: str | None
    azure_openai_api_key: str | None

    @property
    def is_configured(self) -> bool:
        provider = self.provider.strip().lower()
        if provider in {"azure", "azure-openai", "azure_openai"}:
            return bool(self.azure_openai_endpoint and self.azure_openai_api_key)
        return bool(self.openai_api_key)


def apply_chat_completion_limits(
    payload: dict,
    settings: LlmSettings,
    *,
    max_tokens: int,
    temperature: float | None = None,
) -> None:
    """Apply provider-appropriate token and sampling fields to a chat completion payload."""
    if model_supports_sampling_parameters(settings.model):
        payload["temperature"] = settings.temperature if temperature is None else temperature
        payload["top_p"] = settings.top_p
        payload["max_tokens"] = max_tokens
    else:
        payload["max_completion_tokens"] = max_tokens


def _first_env(*names: str) -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return ""


def _resolve_provider() -> str:
    explicit = _first_env("LLM_PROVIDER")
    if explicit:
        return explicit.lower()
    if _first_env("AZURE_OPENAI_ENDPOINT") and _first_env("AZURE_OPENAI_API_KEY"):
        return "azure-openai"
    if _first_env("OPENAI_API_KEY"):
        return "openai"
    return "openai"


def _resolve_model(provider: str) -> str:
    explicit = _first_env("LLM_MODEL", "OPENAI_MODEL")
    if explicit:
        return explicit
    if provider in {"azure", "azure-openai", "azure_openai"}:
        return (
            _first_env(
                "AZURE_OPENAI_DEPLOYMENT",
                "AZURE_OPENAI_DEPLOYMENT_NAME",
                "AZURE_OPENAI_MODEL",
            )
            or "gpt-4o"
        )
    return "gpt-4o"


def get_llm_settings() -> LlmSettings:
    seed_raw = os.getenv("LLM_SEED", "").strip()
    seed = int(seed_raw) if seed_raw else None
    openai_base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
    azure_endpoint = _first_env("AZURE_OPENAI_ENDPOINT") or None
    azure_api_key = _first_env("AZURE_OPENAI_API_KEY") or None
    provider = _resolve_provider()
    model = _resolve_model(provider)

    return LlmSettings(
        provider=provider,
        model=model,
        temperature=_read_float("LLM_TEMPERATURE", 0.7),
        top_p=_read_float("LLM_TOP_P", 1.0),
        max_tokens=_read_int("LLM_MAX_TOKENS", 4096),
        presence_penalty=_read_float("LLM_PRESENCE_PENALTY", 0.0),
        frequency_penalty=_read_float("LLM_FREQUENCY_PENALTY", 0.0),
        seed=seed,
        stream=_read_bool("LLM_STREAM", default=False),
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_base_url=openai_base_url,
        azure_openai_endpoint=azure_endpoint,
        azure_openai_api_key=azure_api_key,
    )


def llm_settings_to_workflow_model_config(
    settings: LlmSettings | None = None,
) -> WorkflowModelConfig:
    from app.modules.workflows.schemas import WorkflowModelConfig

    resolved = settings or get_llm_settings()
    return WorkflowModelConfig(
        provider=resolved.provider,
        model=resolved.model,
        temperature=resolved.temperature,
        top_p=resolved.top_p,
        max_tokens=resolved.max_tokens,
        presence_penalty=resolved.presence_penalty,
        frequency_penalty=resolved.frequency_penalty,
        seed=resolved.seed,
        stream=resolved.stream,
    )


def _is_azure_provider(provider: str) -> bool:
    return provider.strip().lower() in {"azure", "azure-openai", "azure_openai"}


def chat_completions_url(settings: LlmSettings | None = None) -> str:
    resolved = settings or get_llm_settings()
    if _is_azure_provider(resolved.provider):
        endpoint = (resolved.azure_openai_endpoint or "").rstrip("/")
        deployment = resolved.model
        api_version = _first_env("AZURE_OPENAI_API_VERSION") or "2024-08-01-preview"
        return (
            f"{endpoint}/openai/deployments/{deployment}/chat/completions"
            f"?api-version={api_version}"
        )
    base = (resolved.openai_base_url or "https://api.openai.com/v1").rstrip("/")
    return f"{base}/chat/completions"


def chat_completions_headers(settings: LlmSettings | None = None) -> dict[str, str]:
    resolved = settings or get_llm_settings()
    headers = {"Content-Type": "application/json"}
    if _is_azure_provider(resolved.provider):
        if resolved.azure_openai_api_key:
            headers["api-key"] = resolved.azure_openai_api_key
        return headers
    if resolved.openai_api_key:
        headers["Authorization"] = f"Bearer {resolved.openai_api_key}"
    return headers


def openai_chat_completions_url(settings: LlmSettings | None = None) -> str:
    """Backward-compatible alias for chat completion endpoint resolution."""
    return chat_completions_url(settings)
