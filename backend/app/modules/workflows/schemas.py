"""Validated API contracts for JSON workflow definitions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class WorkflowModel(BaseModel):
    """Strict camelCase model shared by workflow API payloads."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class SchemaBlock(WorkflowModel):
    raw: str = ""
    parsed: dict[str, Any] = Field(default_factory=dict)


class WorkflowMeta(WorkflowModel):
    schema_version: str
    workspace_id: str = Field(min_length=1)
    page_id: str = Field(min_length=1)
    page_name: str = Field(min_length=1)
    workflow_id: str = Field(min_length=1)
    workflow_name: str = Field(min_length=1)
    workflow_version: int = Field(ge=1)
    workflow_type: Literal["sequential", "groupchat", "magnetic", "handoff", "parallel"]
    execution_mode: Literal["standard", "human-in-the-loop"]
    status: Literal["draft", "validated", "deployed", "archived"]
    description: str = ""
    created_at: datetime
    updated_at: datetime
    saved_at: datetime | None = None


class WorkflowModelConfig(WorkflowModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    temperature: float = Field(ge=0, le=2)
    top_p: float = Field(ge=0, le=1)
    max_tokens: int = Field(gt=0)
    presence_penalty: float = Field(ge=-2, le=2)
    frequency_penalty: float = Field(ge=-2, le=2)
    seed: int | None = None
    stream: bool = False


class WorkflowAgentSpec(WorkflowModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    description: str = ""
    instructions: str = ""
    system_prompt: str = ""
    user_prompt: str = ""
    is_manager: bool | None = None
    is_orchestrator: bool | None = None
    tool_ids: list[str] = Field(default_factory=list)
    response_schema: SchemaBlock = Field(default_factory=SchemaBlock)
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkflowToolSpec(WorkflowModel):
    id: str = Field(min_length=1)
    agent_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    description: str = ""
    tool_type: Literal["api", "function", "database", "webhook", "custom", "mcp"]
    configuration: dict[str, Any] = Field(default_factory=dict)
    input_schema: SchemaBlock = Field(default_factory=SchemaBlock)
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkflowEdgeSpec(WorkflowModel):
    id: str = Field(min_length=1)
    from_agent_id: str = Field(min_length=1)
    to_agent_id: str = Field(min_length=1)
    label: str = ""
    human_approval: bool = False
    approval_role: str = "reviewer"
    approval_message: str = "Please review and approve this step to continue."


class WorkflowRetryPolicy(WorkflowModel):
    max_retries: int = Field(ge=0, le=10)
    retry_delay_seconds: float = Field(ge=0, le=300)


class WorkflowLoggingSettings(WorkflowModel):
    enabled: bool = True
    level: Literal["debug", "info", "warning", "error"] = "info"


class WorkflowSettings(WorkflowModel):
    timeout_seconds: float = Field(gt=0, le=3600)
    stream_response: bool = False
    retry_policy: WorkflowRetryPolicy
    logging: WorkflowLoggingSettings
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkflowBuildSpec(WorkflowModel):
    meta: WorkflowMeta
    model_config_data: WorkflowModelConfig = Field(alias="modelConfig")
    agents: list[WorkflowAgentSpec]
    tools: list[WorkflowToolSpec] = Field(default_factory=list)
    edges: list[WorkflowEdgeSpec] = Field(default_factory=list)
    settings: WorkflowSettings


class WorkflowValidationIssue(WorkflowModel):
    severity: Literal["error", "warning"]
    code: str
    message: str
    path: str | None = None


class WorkflowValidationSummary(WorkflowModel):
    agent_count: int
    tool_count: int
    edge_count: int
    execution_layers: list[list[str]] = Field(default_factory=list)
    approval_edge_ids: list[str] = Field(default_factory=list)


class WorkflowValidationReport(WorkflowModel):
    valid: bool
    workflow_id: str
    schema_version: str
    issues: list[WorkflowValidationIssue] = Field(default_factory=list)
    summary: WorkflowValidationSummary


class WorkflowExecutionRequest(WorkflowModel):
    inputs: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    approved_edge_ids: set[str] = Field(default_factory=set)
    raise_on_error: bool = False


class WorkflowNodeRun(WorkflowModel):
    agent_id: str
    status: str
    output: Any = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    started_at: datetime | None = None
    completed_at: datetime | None = None


class WorkflowRunResponse(WorkflowModel):
    run_id: str
    workflow_id: str
    status: str
    mode: Literal["test", "execute"]
    outputs: dict[str, Any]
    failures: dict[str, str]
    nodes: dict[str, WorkflowNodeRun]
    started_at: datetime
    completed_at: datetime
