"""Fetch and execute orchestration graphs for a workspace tab."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.db.repositories import (
    create_orchestration_api_key,
    list_orchestration_api_keys,
    revoke_orchestration_api_key,
)
from app.modules.workflows.orchestration.factory import OrchestrationPatternError
from app.modules.workflows.orchestration.family import (
    WorkflowFamilyNotFoundError,
    load_workflow_family,
)
from app.modules.workflows.orchestration.normalize import from_orchestrate_payload
from app.modules.workflows.orchestration.runner import OrchestrationRunner
from app.modules.workflows.orchestration.runs import RUN_STORE

router = APIRouter(prefix="/orchestrate", tags=["orchestrate"])
RUNNER = OrchestrationRunner()


class OrchestrateTab(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    tab_id: str
    parent_tab_id: str | None = None
    is_root: bool = False
    definition: dict[str, Any]


class OrchestrateWorkflowResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    workspace_id: str
    tab_id: str
    root_tab_id: str
    definition: dict[str, Any]
    tabs: list[OrchestrateTab] = Field(default_factory=list)


class OrchestrateRunRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    inputs: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


class OrchestrateResumeRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    approved_edge_ids: set[str] = Field(default_factory=set)
    reviewer_feedback: str = ""
    previous_output: Any = None


class CreateOrchestrationApiKeyRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    name: str = "API key"


class OrchestrationApiKeyCreated(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    name: str
    key_prefix: str
    api_key: str
    workspace_id: str
    page_id: str
    is_active: bool


class OrchestrationApiKeySummary(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    name: str
    key_prefix: str
    workspace_id: str
    page_id: str
    is_active: bool
    last_used_at: str | None = None
    created_at: str


def _validate_path_identifier(name: str, value: str) -> None:
    if (
        not value
        or value in {".", ".."}
        or len(value) > 128
        or any(
            character not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
            for character in value
        )
    ):
        raise HTTPException(status_code=400, detail=f"Invalid {name}")


@router.get(
    "/{workspace_id}/tabs/{tab_id}",
    response_model=OrchestrateWorkflowResponse,
    summary="Fetch the entire workflow JSON for a workspace tab",
)
async def get_orchestrate_workflow(
    workspace_id: str,
    tab_id: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> OrchestrateWorkflowResponse:
    _validate_path_identifier("workspace_id", workspace_id)
    _validate_path_identifier("tab_id", tab_id)
    try:
        root_tab_id, family, parents = load_workflow_family(session, workspace_id, tab_id)
    except WorkflowFamilyNotFoundError:
        raise HTTPException(status_code=404, detail="Workflow not found for workspace tab") from None

    tabs = [
        OrchestrateTab(
            tab_id=page_id,
            parent_tab_id=parents.get(page_id),
            is_root=page_id == root_tab_id,
            definition=definition,
        )
        for page_id, definition in family.items()
    ]
    return OrchestrateWorkflowResponse(
        workspace_id=workspace_id,
        tab_id=tab_id,
        root_tab_id=root_tab_id,
        definition=family[root_tab_id],
        tabs=tabs,
    )


def _sse_frame(payload: dict[str, Any]) -> str:
    event_type = str(payload.get("type") or "message")
    return f"event: {event_type}\ndata: {json.dumps(payload, default=str)}\n\n"


@router.get(
    "/pending",
    summary="List human-in-the-loop approval requests waiting on orchestration runs",
)
async def list_pending_orchestrate_requests(
    workspace_id: Annotated[str | None, Query(alias="workspaceId")] = None,
) -> dict[str, Any]:
    if workspace_id:
        _validate_path_identifier("workspace_id", workspace_id)
    requests = RUNNER.pending_requests(workspace_id)
    return {"count": len(requests), "requests": requests}


@router.post(
    "/{workspace_id}/tabs/{tab_id}/run",
    summary="Execute the orchestration pattern for a tab as SSE events",
)
async def run_orchestrate_workflow(
    workspace_id: str,
    tab_id: str,
    body: OrchestrateRunRequest,
    session: Annotated[Session, Depends(get_db_session)],
) -> StreamingResponse:
    family = await get_orchestrate_workflow(workspace_id, tab_id, session)
    payload = family.model_dump(mode="json", by_alias=True)
    try:
        document = from_orchestrate_payload(payload)
    except Exception as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in RUNNER.stream_new_run(
                workspace_id=workspace_id,
                tab_id=tab_id,
                root_tab_id=family.root_tab_id,
                spec=document.spec,
                nested=document.nested,
                inputs=body.inputs,
                metadata=body.metadata,
                dry_run=body.dry_run,
            ):
                yield _sse_frame(event)
        except OrchestrationPatternError as error:
            yield _sse_frame({"type": "run_failed", "data": {"error": str(error)}})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post(
    "/runs/{run_id}/resume",
    summary="Resume a waiting orchestration run as SSE events",
)
async def resume_orchestrate_workflow(
    run_id: str,
    body: OrchestrateResumeRequest,
) -> StreamingResponse:
    if RUN_STORE.get(run_id) is None:
        raise HTTPException(status_code=404, detail="Orchestration run not found")

    async def event_stream() -> AsyncIterator[str]:
        async for event in RUNNER.stream_resume(
            run_id,
            approved_edge_ids=body.approved_edge_ids,
            reviewer_feedback=body.reviewer_feedback,
            previous_output=body.previous_output,
        ):
            yield _sse_frame(event)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def _key_summary(record) -> OrchestrationApiKeySummary:
    return OrchestrationApiKeySummary(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        workspace_id=record.workspace_id,
        page_id=record.page_id,
        is_active=record.is_active,
        last_used_at=record.last_used_at.isoformat() if record.last_used_at else None,
        created_at=record.created_at.isoformat(),
    )


@router.post(
    "/{workspace_id}/tabs/{page_id}/keys",
    response_model=OrchestrationApiKeyCreated,
    summary="Create a customer API key bound to this main workflow tab",
)
async def create_workflow_api_key(
    workspace_id: str,
    page_id: str,
    body: CreateOrchestrationApiKeyRequest,
    session: Annotated[Session, Depends(get_db_session)],
    user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
) -> OrchestrationApiKeyCreated:
    _validate_path_identifier("workspace_id", workspace_id)
    _validate_path_identifier("page_id", page_id)
    try:
        created = create_orchestration_api_key(
            session,
            workspace_id=workspace_id,
            page_id=page_id,
            name=body.name,
            created_by_user_id=user_id or "local-user",
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    record = created.record
    return OrchestrationApiKeyCreated(
        id=record.id,
        name=record.name,
        key_prefix=record.key_prefix,
        api_key=created.secret,
        workspace_id=record.workspace_id,
        page_id=record.page_id,
        is_active=record.is_active,
    )


@router.get(
    "/{workspace_id}/keys",
    response_model=list[OrchestrationApiKeySummary],
    summary="List customer API keys for a workspace",
)
async def list_workflow_api_keys(
    workspace_id: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> list[OrchestrationApiKeySummary]:
    _validate_path_identifier("workspace_id", workspace_id)
    return [_key_summary(record) for record in list_orchestration_api_keys(session, workspace_id)]


@router.delete(
    "/keys/{key_id}",
    response_model=OrchestrationApiKeySummary,
    summary="Revoke a customer API key",
)
async def revoke_workflow_api_key(
    key_id: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> OrchestrationApiKeySummary:
    record = revoke_orchestration_api_key(session, key_id)
    if record is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return _key_summary(record)
