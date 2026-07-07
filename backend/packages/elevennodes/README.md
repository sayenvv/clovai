# ElevenNodes

ElevenNodes is a lightweight, provider-neutral Python framework for composing and running
multi-agent workflows. It uses class-based design, explicit abstractions, and clean architecture
so applications can replace agents, persistence, event delivery, and model providers independently.

## Architecture

- `domain`: framework entities, immutable value objects, statuses, events, and errors.
- `ports`: abstract `Agent`, `StateStore`, and `EventPublisher` boundaries.
- `application`: validated workflow graphs and the orchestration use case.
- `infrastructure`: optional in-memory and function-based adapters.

Dependencies point inward: the orchestration core does not know about OpenAI, Anthropic,
databases, web frameworks, or queue vendors.

## Install

From this repository during development:

```bash
pip install -e backend/packages/elevennodes
```

After publishing the distribution:

```bash
pip install eleven-nodes
```

The distribution is named `eleven-nodes`; Python code imports it as `eleven_nodes`.

## Quick start

```python
import asyncio

from eleven_nodes import Agent, AgentContext, AgentResult, Orchestrator, WorkflowBuilder


class ResearchAgent(Agent):
    async def execute(self, context: AgentContext) -> AgentResult:
        topic = context.inputs["topic"]
        return AgentResult(output=f"Research about {topic}")


class WriterAgent(Agent):
    async def execute(self, context: AgentContext) -> str:
        research = context.dependency_results["research"].output
        return f"Draft using: {research}"


async def main() -> None:
    workflow = (
        WorkflowBuilder("content-pipeline", name="Content team")
        .add_agent(ResearchAgent("research"))
        .add_agent(WriterAgent("writer"), depends_on=["research"])
        .build()
    )

    result = await Orchestrator().run(workflow, inputs={"topic": "multi-agent systems"})
    print(result.outputs["writer"])


asyncio.run(main())
```

Nodes in the same topological layer execute concurrently. An agent receives only a read-only
`AgentContext`, including initial inputs and the results/messages of its declared dependencies.

## Extending the framework

Subclass `Agent` to integrate any model or tool provider. Implement `StateStore` for durable run
state (for example PostgreSQL or Redis), and `EventPublisher` for telemetry, queues, or streaming.
The built-in `FunctionAgent`, `InMemoryStateStore`, and `InMemoryEventPublisher` are useful for
small applications and tests. Pass a state store or event publisher to `Orchestrator`; when they
are omitted, execution remains stateless and emits no external events.

## Microsoft Agent Framework

Install Agent Framework Core for custom clients, or select the provider integration you use:

```bash
pip install -e "backend/packages/elevennodes[microsoft]"
# OpenAI and Azure OpenAI clients:
pip install -e "backend/packages/elevennodes[openai]"
# Microsoft Foundry clients:
pip install -e "backend/packages/elevennodes[foundry]"
# Every Microsoft Agent Framework integration:
pip install -e "backend/packages/elevennodes[all-microsoft]"
```

Wrap any Microsoft Agent Framework agent while keeping the orchestration core provider-neutral:

```python
from agent_framework import Agent as FrameworkAgent
from agent_framework.openai import OpenAIChatClient
from eleven_nodes import MicrosoftAgent, Orchestrator, WorkflowBuilder

researcher = FrameworkAgent(
    client=OpenAIChatClient(),
    name="Researcher",
    instructions="Research the supplied topic and cite the important facts.",
)
workflow = (
    WorkflowBuilder("research")
    .add_agent(MicrosoftAgent("researcher", researcher))
    .build()
)

result = await Orchestrator().run(
    workflow,
    inputs={"prompt": "Compare agent orchestration patterns."},
)
print(result.outputs["researcher"])
```

`MicrosoftAgent` accepts all Agent Framework implementations with the public `run` contract,
including Foundry and A2A agents. It preserves structured response values, framework messages,
token usage, finish reason, and response identifiers in `AgentResult`. Provide a
`session_resolver` when conversation state should be restored from application storage; sessions
are not shared implicitly because Agent Framework sessions are specific to an agent/provider.

The reusable behavioral contracts are:

- `Agent`: provider or tool execution, with shared lifecycle hooks.
- `WorkflowRunner`: workflow execution and run retrieval.
- `ContextFactory`: controls the isolated input each agent receives.
- `ResultAdapter`: converts provider-specific responses into `AgentResult`.
- `StateStore`: persistence for workflow runs.
- `EventPublisher`: delivery of orchestration events.

Inherit from these classes when behavior must be replaced. `Message`, `AgentContext`,
`AgentResult`, `WorkflowRun`, and `WorkflowResult` are domain data objects; compose and pass them
rather than subclassing them.

### Agent lifecycle

`Agent.run()` is the reusable template method called by the orchestrator. Custom agents must
implement `execute()` and may override lifecycle hooks without replacing orchestration logic:

```python
class ObservableAgent(Agent):
    async def before_execute(self, context: AgentContext) -> None:
        print(f"starting {context.node_id}")

    async def execute(self, context: AgentContext) -> AgentResult:
        return AgentResult(output="done")

    async def on_error(self, context: AgentContext, error: Exception) -> None:
        print(f"failed: {error}")
```
