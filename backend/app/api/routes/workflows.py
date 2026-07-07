"""Persist, validate, test, and execute JSON workflow definitions."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

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

# Repo root: backend/app/api/routes/workflows.py -> parents[4]
REPO_ROOT = Path(__file__).resolve().parents[4]
DATA_ROOT = REPO_ROOT / "data" / "workflows"
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


def _spec_path(workspace_id: str, page_id: str) -> Path:
    _validate_path_identifier("workspace_id", workspace_id)
    _validate_path_identifier("page_id", page_id)
    return DATA_ROOT / workspace_id / f"{page_id}.json"


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


def _load_workflow_spec(workspace_id: str, page_id: str) -> WorkflowBuildSpec:
    path = _spec_path(workspace_id, page_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Workflow build spec not found")
    try:
        return WorkflowBuildSpec.model_validate_json(path.read_text(encoding="utf-8"))
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
) -> dict:
    """Write build spec JSON to data/workflows/{workspace_id}/{page_id}.json."""
    if spec.meta.workspace_id != workspace_id or spec.meta.page_id != page_id:
        raise HTTPException(
            status_code=409,
            detail="Path workspace/page IDs must match spec.meta",
        )

    saved_at = datetime.now(UTC).isoformat()
    payload = spec.model_dump(mode="json", by_alias=True)
    payload["meta"]["savedAt"] = saved_at

    path = _spec_path(workspace_id, page_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "workspaceId": workspace_id,
        "pageId": page_id,
        "workflowId": spec.meta.workflow_id,
        "filePath": str(path.relative_to(REPO_ROOT)),
        "savedAt": saved_at,
    }


@router.get("/{workspace_id}/pages/{page_id}")
async def load_workflow_build_spec(
    workspace_id: str,
    page_id: str,
) -> dict:
    return _load_workflow_spec(workspace_id, page_id).model_dump(mode="json", by_alias=True)


@router.post(
    "/{workspace_id}/pages/{page_id}/validate",
    response_model=WorkflowValidationReport,
    summary="Validate and compile a saved workflow definition",
)
async def validate_workflow(
    workspace_id: str,
    page_id: str,
) -> WorkflowValidationReport:
    spec = _load_workflow_spec(workspace_id, page_id)
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
) -> WorkflowRunResponse:
    spec = _load_workflow_spec(workspace_id, page_id)
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
    summary="Execute a workflow with Microsoft Agent Framework",
)
async def execute_workflow(
    workspace_id: str,
    page_id: str,
    request: WorkflowExecutionRequest,
) -> WorkflowRunResponse:
    spec = _load_workflow_spec(workspace_id, page_id)
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
