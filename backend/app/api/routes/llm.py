"""Expose server-managed LLM configuration to the frontend."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.llm_settings import get_llm_settings, llm_settings_to_workflow_model_config
from app.modules.workflows.schemas import WorkflowModelConfig

router = APIRouter(prefix="/llm", tags=["llm"])


class PublicLlmConfig(WorkflowModelConfig):
    """Workflow model settings sourced from environment variables."""

    configured: bool
    source: str = "environment"


@router.get("/config", response_model=PublicLlmConfig, summary="Read server LLM configuration")
async def read_llm_config() -> PublicLlmConfig:
    settings = get_llm_settings()
    model_config = llm_settings_to_workflow_model_config(settings)
    return PublicLlmConfig(
        **model_config.model_dump(by_alias=True),
        configured=settings.is_configured,
        source="environment",
    )
