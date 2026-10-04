"""In-memory orchestration run records for SSE resume and pending approvals."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from app.modules.workflows.schemas import WorkflowBuildSpec, WorkflowExecutionRequest


def _utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass
class OrchestrationRunRecord:
    run_id: str
    workspace_id: str
    tab_id: str
    root_tab_id: str
    pattern: str
    spec: WorkflowBuildSpec
    nested: dict[str, WorkflowBuildSpec]
    inputs: dict[str, Any]
    metadata: dict[str, Any]
    dry_run: bool
    approved_edge_ids: set[str]
    revision_count: int = 0
    status: str = "running"
    required_edge_ids: list[str] = field(default_factory=list)
    previous_output: Any = None
    last_response: dict[str, Any] | None = None
    created_at: datetime = field(default_factory=_utc_now)
    updated_at: datetime = field(default_factory=_utc_now)

    def execution_request(
        self,
        *,
        extra_approved: set[str] | None = None,
        reviewer_feedback: str = "",
        previous_output: Any = None,
    ) -> WorkflowExecutionRequest:
        approved = set(self.approved_edge_ids)
        if extra_approved:
            approved.update(extra_approved)
        return WorkflowExecutionRequest(
            inputs=self.inputs,
            metadata=self.metadata,
            approved_edge_ids=approved,
            reviewer_feedback=reviewer_feedback,
            previous_output=previous_output if previous_output is not None else self.previous_output,
            revision_count=self.revision_count,
        )


class OrchestrationRunStore:
    def __init__(self) -> None:
        self._runs: dict[str, OrchestrationRunRecord] = {}
        self._lock = Lock()

    def clear(self) -> None:
        with self._lock:
            self._runs.clear()

    def put(self, record: OrchestrationRunRecord) -> OrchestrationRunRecord:
        with self._lock:
            record.updated_at = _utc_now()
            self._runs[record.run_id] = record
            return record

    def get(self, run_id: str) -> OrchestrationRunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def waiting(
        self,
        workspace_id: str | None = None,
        tab_id: str | None = None,
    ) -> list[OrchestrationRunRecord]:
        with self._lock:
            records = [
                record
                for record in self._runs.values()
                if record.status == "waiting_approval"
            ]
        if workspace_id:
            records = [record for record in records if record.workspace_id == workspace_id]
        if tab_id:
            records = [record for record in records if record.tab_id == tab_id]
        return sorted(records, key=lambda record: record.updated_at, reverse=True)


RUN_STORE = OrchestrationRunStore()
