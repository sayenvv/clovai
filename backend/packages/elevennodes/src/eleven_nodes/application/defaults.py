"""Default implementations of application-level extension contracts."""

from typing import Any

from eleven_nodes.application.abstractions import ContextFactory, ResultAdapter
from eleven_nodes.application.workflow import Workflow, WorkflowNode
from eleven_nodes.domain.models import AgentContext, AgentResult, WorkflowRun


class DependencyContextFactory(ContextFactory):
    """Build context from workflow inputs and completed dependencies."""

    def create(self, workflow: Workflow, run: WorkflowRun, node: WorkflowNode) -> AgentContext:
        dependency_results = {
            dependency: run.nodes[dependency].result
            for dependency in node.dependencies
            if run.nodes[dependency].result is not None
        }
        messages = tuple(
            message for result in dependency_results.values() for message in result.messages
        )
        return AgentContext.create(
            run_id=run.run_id,
            workflow_id=workflow.workflow_id,
            node_id=node.node_id,
            inputs=run.inputs,
            dependency_results=dependency_results,
            messages=messages,
            metadata=run.metadata,
        )


class DefaultResultAdapter(ResultAdapter):
    """Preserve AgentResult objects and wrap all other values as output."""

    def adapt(self, value: Any) -> AgentResult:
        if isinstance(value, AgentResult):
            return value
        return AgentResult(output=value)
