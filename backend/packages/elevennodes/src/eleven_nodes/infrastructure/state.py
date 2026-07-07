"""Default workflow state store implementations."""

import asyncio
from copy import deepcopy

from eleven_nodes.domain.models import WorkflowRun
from eleven_nodes.ports.state import StateStore


class InMemoryStateStore(StateStore):
    """Concurrency-safe, process-local state storage."""

    def __init__(self) -> None:
        self._runs: dict[str, WorkflowRun] = {}
        self._lock = asyncio.Lock()

    async def save(self, run: WorkflowRun) -> None:
        async with self._lock:
            self._runs[run.run_id] = deepcopy(run)

    async def get(self, run_id: str) -> WorkflowRun | None:
        async with self._lock:
            run = self._runs.get(run_id)
            return deepcopy(run) if run is not None else None
