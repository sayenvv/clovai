"""Persist, validate, test, and execute JSON workflow definitions."""

from __future__ import annotations

from typing import Annotated
from urllib.parse import unquote

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.db.repositories import (
    PersistenceActor,
    load_workflow_definition,
    save_workflow_definition,
)

from app.modules.workflows.workflow_generator import (
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    generate_workflow_plan,
)
from app.modules.workflows.executor_source_generator import (
    GenerateExecutorSourceRequest,
    GenerateExecutorSourceResponse,
    generate_executor_source,
)
from app.modules.workflows.instruction_generator import (
    GenerateInstructionsRequest,
    GenerateInstructionsResponse,
    generate_agent_instructions,
)
from app.modules.workflows import (
    ApprovalRequiredError,
    RuntimeConfigurationError,
    WorkflowBuildSpec,
    WorkflowDefinitionError,
    WorkflowExecutionRequest,
    WorkflowRunResponse,
    WorkflowRunFailedError,
    WorkflowRuntimeService,
    WorkflowValidationReport,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])

RUNTIME_SERVICE = WorkflowRuntimeService()


@router.post(
    "/generate-instructions",
    response_model=GenerateInstructionsResponse,
    summary="Generate agent system instructions from name and description",
)
async def generate_instructions(body: GenerateInstructionsRequest) -> GenerateInstructionsResponse:
    try:
        return generate_agent_instructions(body)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post(
    "/generate-executor-source",
    response_model=GenerateExecutorSourceResponse,
    summary="Generate Eleven Nodes executor handler Python source",
)
async def generate_executor_source_route(
    body: GenerateExecutorSourceRequest,
) -> GenerateExecutorSourceResponse:
    try:
        return generate_executor_source(body)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post(
    "/generate-workflow",
    response_model=GenerateWorkflowResponse,
    summary="Generate a complete workflow plan from a natural-language prompt",
)
async def generate_workflow_route(body: GenerateWorkflowRequest) -> GenerateWorkflowResponse:
    try:
        return generate_workflow_plan(body)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


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


def _load_workflow_spec(
    session: Session,
    workspace_id: str,
    page_id: str,
) -> WorkflowBuildSpec:
    _validate_path_identifier("workspace_id", workspace_id)
    _validate_path_identifier("page_id", page_id)
    payload = load_workflow_definition(session, workspace_id, page_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Workflow build spec not found")
    try:
        return WorkflowBuildSpec.model_validate(payload)
    except ValidationError as error:
        raise HTTPException(
            status_code=422,
            detail={"message": "Stored workflow JSON is invalid", "errors": error.errors()},
        ) from error


def _definition_error(error: WorkflowDefinitionError) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail=error.report.model_dump(mode="json", by_alias=True),
    )


@router.put("/{workspace_id}/pages/{page_id}")
async def save_workflow_build_spec(
    workspace_id: str,
    page_id: str,
    spec: WorkflowBuildSpec,
    session: Annotated[Session, Depends(get_db_session)],
    user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    user_email: Annotated[str | None, Header(alias="X-User-Email")] = None,
    user_name: Annotated[str | None, Header(alias="X-User-Name")] = None,
    user_role: Annotated[str | None, Header(alias="X-User-Role")] = None,
    workspace_name: Annotated[str | None, Header(alias="X-Workspace-Name")] = None,
    account_type: Annotated[str | None, Header(alias="X-Account-Type")] = None,
) -> dict:
    """Upsert a workflow JSON document and provision its parent records."""
    _validate_path_identifier("workspace_id", workspace_id)
    _validate_path_identifier("page_id", page_id)
    if spec.meta.workspace_id != workspace_id or spec.meta.page_id != page_id:
        raise HTTPException(
            status_code=409,
            detail="Path workspace/page IDs must match spec.meta",
        )

    resolved_user_id = user_id or "local-user"
    actor = PersistenceActor(
        user_id=resolved_user_id,
        email=(user_email or f"{resolved_user_id}@local.invalid").strip().lower(),
        full_name=unquote(user_name) if user_name else "Local user",
        role=user_role if user_role in {"student", "developer", "manager", "founder", "other"} else "developer",
        workspace_name=unquote(workspace_name) if workspace_name else spec.meta.workflow_name,
        account_type=account_type if account_type in {"company", "individual"} else "individual",
    )

    try:
        stored = save_workflow_definition(session, spec, actor)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except IntegrityError as error:
        raise HTTPException(status_code=409, detail="Workflow ownership data conflicts") from error

    return {
        "workspaceId": stored.workspace_id,
        "pageId": stored.page_id,
        "workflowId": stored.workflow_id,
        "databaseRecordId": stored.record_id,
        "savedAt": stored.saved_at.isoformat(),
    }


@router.get("/{workspace_id}/pages/{page_id}")
async def load_workflow_build_spec(
    workspace_id: str,
    page_id: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> dict:
    return _load_workflow_spec(session, workspace_id, page_id).model_dump(
        mode="json", by_alias=True
    )


@router.post(
    "/{workspace_id}/pages/{page_id}/validate",
    response_model=WorkflowValidationReport,
    summary="Validate and compile a saved workflow definition",
)
async def validate_workflow(
    workspace_id: str,
    page_id: str,
    session: Annotated[Session, Depends(get_db_session)],
) -> WorkflowValidationReport:
    spec = _load_workflow_spec(session, workspace_id, page_id)
    return RUNTIME_SERVICE.validate(spec)


@router.post(
    "/{workspace_id}/pages/{page_id}/test",
    response_model=WorkflowRunResponse,
    summary="Test a workflow without calling a language model",
)
async def test_workflow(
    workspace_id: str,
    page_id: str,
    request: WorkflowExecutionRequest,
    session: Annotated[Session, Depends(get_db_session)],
) -> WorkflowRunResponse:
    spec = _load_workflow_spec(session, workspace_id, page_id)
    try:
        return await RUNTIME_SERVICE.test(spec, request)
    except WorkflowDefinitionError as error:
        raise _definition_error(error) from error
    except WorkflowRunFailedError as error:
        raise HTTPException(
            status_code=502,
            detail=error.response.model_dump(mode="json", by_alias=True),
        ) from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error


@router.post(
    "/{workspace_id}/pages/{page_id}/execute",
    response_model=WorkflowRunResponse,
    summary="Execute a workflow with the Eleven Nodes runtime",
)
async def execute_workflow(
    workspace_id: str,
    page_id: str,
    request: WorkflowExecutionRequest,
    session: Annotated[Session, Depends(get_db_session)],
) -> WorkflowRunResponse:
    spec = _load_workflow_spec(session, workspace_id, page_id)
    try:
        return await RUNTIME_SERVICE.execute(spec, request)
    except WorkflowDefinitionError as error:
        raise _definition_error(error) from error
    except ApprovalRequiredError as error:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "approval_required",
                "message": str(error),
                "requiredEdgeIds": error.edge_ids,
            },
        ) from error
    except RuntimeConfigurationError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except WorkflowRunFailedError as error:
        raise HTTPException(
            status_code=502,
            detail=error.response.model_dump(mode="json", by_alias=True),
        ) from error
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail=str(error)) from error
