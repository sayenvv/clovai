"""Generate multi-agent workflow plans from natural-language prompts."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.core.llm_settings import (
    _is_azure_provider,
    apply_chat_completion_limits,
    chat_completions_headers,
    chat_completions_url,
    get_llm_settings,
)

ALLOWED_PALETTE_IDS = frozenset(
    {
        "aw-agent",
        "aw-llm-agent",
        "aw-specialist",
        "aw-planner",
        "aw-reviewer",
        "aw-router",
        "aw-tool-agent",
    }
)

ExecutionType = Literal["sequential", "parallel", "human-in-the-loop", "conditional"]


class GeneratedAgent(BaseModel):
    key: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    palette_id: str = Field(default="aw-agent", max_length=40)
    instructions: str = Field(default="", max_length=8000)
    tools: list[str] = Field(default_factory=list, max_length=6)


class GeneratedEdge(BaseModel):
    from_key: str = Field(min_length=1, max_length=40)
    to_key: str = Field(max_length=40)
    label: str = Field(default="", max_length=120)
    human_approval: bool = False


class WorkflowGenerationPlan(BaseModel):
    workflow_name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    execution_type: ExecutionType = "sequential"
    agents: list[GeneratedAgent] = Field(min_length=1, max_length=12)
    edges: list[GeneratedEdge] = Field(default_factory=list, max_length=24)


class GenerateWorkflowRequest(BaseModel):
    prompt: str = Field(min_length=8, max_length=8000)
    workflow_name: str = Field(default="", max_length=200)


class GenerateWorkflowResponse(BaseModel):
    plan: WorkflowGenerationPlan
    model: str
    origin: str


def _slugify_key(label: str, index: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    if not slug:
        slug = f"agent_{index + 1}"
    if not slug[0].isalpha():
        slug = f"agent_{slug}"
    return slug[:40]


def _normalize_palette_id(value: str) -> str:
    normalized = value.strip()
    if normalized in ALLOWED_PALETTE_IDS:
        return normalized
    return "aw-agent"


def _normalize_plan_dict(raw: dict) -> dict:
    agents = raw.get("agents") or []
    normalized_agents = []
    seen_keys: set[str] = set()
    for index, agent in enumerate(agents):
        if not isinstance(agent, dict):
            continue
        key = str(agent.get("key") or _slugify_key(str(agent.get("name") or f"agent_{index + 1}"), index))
        if key in seen_keys:
            key = f"{key}_{index + 1}"
        seen_keys.add(key)
        normalized_agents.append(
            {
                "key": key,
                "name": str(agent.get("name") or key.replace("_", " ").title())[:120],
                "description": str(agent.get("description") or "")[:2000],
                "palette_id": _normalize_palette_id(str(agent.get("palette_id") or "aw-agent")),
                "instructions": str(agent.get("instructions") or "")[:8000],
                "tools": [str(tool)[:80] for tool in (agent.get("tools") or [])[:6]],
            }
        )

    agent_keys = {agent["key"] for agent in normalized_agents}
    normalized_edges = []
    for edge in raw.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        from_key = str(edge.get("from_key") or edge.get("from") or "")
        to_key = str(edge.get("to_key") or edge.get("to") or "")
        if from_key not in agent_keys or to_key not in agent_keys:
            continue
        normalized_edges.append(
            {
                "from_key": from_key,
                "to_key": to_key,
                "label": str(edge.get("label") or "")[:120],
                "human_approval": bool(edge.get("human_approval", False)),
            }
        )

    execution_type = str(raw.get("execution_type") or "sequential")
    if execution_type not in {"sequential", "parallel", "human-in-the-loop", "conditional"}:
        execution_type = "sequential"

    workflow_name = str(raw.get("workflow_name") or "Generated workflow")[:200]
    return {
        "workflow_name": workflow_name,
        "description": str(raw.get("description") or "")[:4000],
        "execution_type": execution_type,
        "agents": normalized_agents,
        "edges": normalized_edges,
    }


def _parse_plan_json(text: str) -> WorkflowGenerationPlan | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    try:
        return WorkflowGenerationPlan.model_validate(_normalize_plan_dict(payload))
    except ValidationError:
        return None


def _template_plan(prompt: str, workflow_name: str) -> WorkflowGenerationPlan:
    name = workflow_name.strip() or "Generated workflow"
    topic = prompt.strip() or "the requested task"
    planner_key = "planner"
    worker_key = "worker"
    return WorkflowGenerationPlan(
        workflow_name=name,
        description=f"Auto-drafted workflow for: {topic[:280]}",
        execution_type="sequential",
        agents=[
            GeneratedAgent(
                key=planner_key,
                name="Planner",
                description="Breaks the request into a clear execution plan.",
                palette_id="aw-planner",
                instructions=(
                    f"## Planner\n\n### Role\nAnalyze the user request and produce a concise plan.\n\n"
                    f"### Request\n{topic}\n\n"
                    "### Guidelines\n- Output structured steps for the next agent.\n"
                    "- Keep the plan actionable and brief."
                ),
            ),
            GeneratedAgent(
                key=worker_key,
                name="Executor",
                description="Executes the plan and returns the final result.",
                palette_id="aw-agent",
                instructions=(
                    f"## Executor\n\n### Role\nComplete the workflow using the planner output.\n\n"
                    f"### Original request\n{topic}\n\n"
                    "### Guidelines\n- Follow the prior agent output.\n"
                    "- Return a polished final answer."
                ),
            ),
        ],
        edges=[GeneratedEdge(from_key=planner_key, to_key=worker_key)],
    )


def _json_schema_prompt() -> str:
    return (
        "Return a single JSON object with this exact shape:\n"
        "{\n"
        '  "workflow_name": "string",\n'
        '  "description": "string",\n'
        '  "execution_type": "sequential|parallel|human-in-the-loop|conditional",\n'
        '  "agents": [\n'
        "    {\n"
        '      "key": "snake_case_unique_id",\n'
        '      "name": "Display name",\n'
        '      "description": "What this agent does",\n'
        '      "palette_id": "aw-agent|aw-llm-agent|aw-specialist|aw-planner|aw-reviewer|aw-router|aw-tool-agent",\n'
        '      "instructions": "Markdown system prompt",\n'
        '      "tools": ["optional tool label"]\n'
        "    }\n"
        "  ],\n"
        '  "edges": [\n'
        '    { "from_key": "agent_key", "to_key": "agent_key", "label": "", "human_approval": false }\n'
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- Use 2-6 agents with unique snake_case keys.\n"
        "- Connect agents with edges that form a runnable DAG (no cycles).\n"
        "- Use aw-reviewer and human_approval=true for human review steps.\n"
        "- Use aw-router for branching workflows.\n"
        "- Instructions must be Markdown with ## Role and ## Guidelines.\n"
        "- Return JSON only. No markdown fences or commentary."
    )


def _build_chat_payload(settings, prompt: str, workflow_name: str) -> dict:
    user_prompt = (
        "Design a multi-agent workflow for Eleven Nodes.\n\n"
        f"User prompt:\n{prompt.strip()}\n\n"
    )
    if workflow_name.strip():
        user_prompt += f"Preferred workflow name: {workflow_name.strip()}\n\n"
    user_prompt += _json_schema_prompt()

    payload: dict = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert workflow architect for multi-agent automation. "
                    "You output strictly valid JSON matching the requested schema."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    apply_chat_completion_limits(
        payload,
        settings,
        max_tokens=min(settings.max_tokens, 4096),
        temperature=min(settings.temperature, 0.5),
    )

    if not _is_azure_provider(settings.provider):
        payload["model"] = settings.model

    return payload


def _llm_plan(prompt: str, workflow_name: str) -> WorkflowGenerationPlan | None:
    settings = get_llm_settings()
    if not settings.is_configured:
        return None

    provider = settings.provider.strip().lower()
    if provider not in {"openai", "azure", "azure-openai", "azure_openai"}:
        return None

    payload = _build_chat_payload(settings, prompt, workflow_name)
    request = urllib.request.Request(
        chat_completions_url(settings),
        data=json.dumps(payload).encode("utf-8"),
        headers=chat_completions_headers(settings),
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        return _parse_plan_json(str(content))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM request failed ({error.code}): {detail}") from error
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
        return None


def generate_workflow_plan(request: GenerateWorkflowRequest) -> GenerateWorkflowResponse:
    settings = get_llm_settings()
    llm_plan = _llm_plan(request.prompt, request.workflow_name)

    if llm_plan:
        origin = "azure-openai" if _is_azure_provider(settings.provider) else "openai"
        return GenerateWorkflowResponse(plan=llm_plan, model=settings.model, origin=origin)

    return GenerateWorkflowResponse(
        plan=_template_plan(request.prompt, request.workflow_name),
        model=settings.model,
        origin="template",
    )
