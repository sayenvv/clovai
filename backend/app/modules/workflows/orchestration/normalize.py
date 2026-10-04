"""Unwrap GET /api/orchestrate payloads into a root spec plus nested tabs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.modules.workflows.schemas import WorkflowBuildSpec


class OrchestratePayloadError(ValueError):
    """Raised when an orchestrate envelope cannot be turned into workflow specs."""


@dataclass(frozen=True, slots=True)
class OrchestrationDocument:
    spec: WorkflowBuildSpec
    nested: dict[str, WorkflowBuildSpec] = field(default_factory=dict)


def from_orchestrate_payload(payload: dict[str, Any]) -> OrchestrationDocument:
    definition = payload.get("definition")
    if not isinstance(definition, dict):
        raise OrchestratePayloadError("Orchestrate payload is missing a workflow definition.")

    spec = WorkflowBuildSpec.model_validate(definition)
    nested: dict[str, WorkflowBuildSpec] = {}
    root_page_id = spec.meta.page_id

    for tab in payload.get("tabs") or []:
        if not isinstance(tab, dict):
            continue
        tab_id = tab.get("tabId")
        tab_definition = tab.get("definition")
        if not isinstance(tab_id, str) or not isinstance(tab_definition, dict):
            continue
        if tab_id == root_page_id:
            continue
        nested[tab_id] = WorkflowBuildSpec.model_validate(tab_definition)

    return OrchestrationDocument(spec=spec, nested=nested)
