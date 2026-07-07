"""Event publishing abstraction."""

from abc import ABC, abstractmethod
from collections.abc import Iterable

from eleven_nodes.domain.models import ExecutionEvent


class EventPublisher(ABC):
    """Boundary for telemetry, callbacks, queues, or event streams."""

    @abstractmethod
    async def publish(self, event: ExecutionEvent) -> None:
        """Publish one orchestration event."""

    async def publish_many(self, events: Iterable[ExecutionEvent]) -> None:
        """Publish multiple events using the implementation's single-event behavior."""
        for event in events:
            await self.publish(event)
