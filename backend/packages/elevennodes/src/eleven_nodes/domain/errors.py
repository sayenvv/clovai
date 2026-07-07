"""Framework-specific exceptions."""


class ElevenNodesError(Exception):
    """Base exception for all ElevenNodes errors."""


class InvalidWorkflowError(ElevenNodesError):
    """Raised when a workflow graph is invalid."""


class DuplicateNodeError(InvalidWorkflowError):
    """Raised when a workflow contains the same node identifier twice."""


class NodeNotFoundError(InvalidWorkflowError):
    """Raised when a workflow references a node that does not exist."""


class InvalidStateTransitionError(ElevenNodesError):
    """Raised when execution state is changed in an invalid order."""


class AgentExecutionError(ElevenNodesError):
    """Raised when an agent cannot complete its work."""

    def __init__(self, node_id: str, cause: BaseException) -> None:
        self.node_id = node_id
        self.cause = cause
        super().__init__(f"Agent at node '{node_id}' failed: {cause}")


class WorkflowExecutionError(ElevenNodesError):
    """Raised when a workflow run fails and error propagation is enabled."""

    def __init__(self, run_id: str, failures: dict[str, str]) -> None:
        self.run_id = run_id
        self.failures = failures
        failed_nodes = ", ".join(sorted(failures))
        super().__init__(f"Workflow run '{run_id}' failed at: {failed_nodes}")
