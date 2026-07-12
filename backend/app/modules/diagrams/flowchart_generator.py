"""Generate flowchart diagrams from natural-language prompts."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

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
        "fc-start-end",
        "fc-process",
        "fc-decision",
        "fc-subprocess",
        "fc-connector",
        "fc-off-page",
        "fc-delay",
        "fc-event",
        "fc-parallel-gate",
        "fc-or-gate",
        "fc-rectangle",
        "fc-circle",
        "fc-ellipse",
        "fc-input-output",
        "fc-display",
        "fc-database",
        "fc-data-store",
        "fc-document",
        "fc-note",
        "fc-text",
        "fc-aws-lambda",
        "fc-aws-s3",
        "fc-aws-sqs",
        "fc-aws-sns",
        "fc-aws-api-gateway",
        "fc-aws-dynamodb",
        "fc-aws-eventbridge",
        "fc-aws-step-functions",
        "fc-gcp-cloud-functions",
        "fc-gcp-cloud-run",
        "fc-gcp-pub-sub",
        "fc-gcp-cloud-storage",
        "fc-gcp-firestore",
        "fc-gcp-bigquery",
    }
)


class GeneratedFlowNode(BaseModel):
    key: str = Field(min_length=1, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=1, max_length=120)
    palette_id: str = Field(default="fc-process", max_length=40)


class GeneratedFlowEdge(BaseModel):
    from_key: str = Field(min_length=1, max_length=40)
    to_key: str = Field(min_length=1, max_length=40)
    label: str = Field(default="", max_length=160)


class FlowchartGenerationPlan(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=2000)
    nodes: list[GeneratedFlowNode] = Field(min_length=1, max_length=24)
    edges: list[GeneratedFlowEdge] = Field(default_factory=list, max_length=40)


class ChatHistoryMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class GenerateFlowchartRequest(BaseModel):
    prompt: str = Field(min_length=4, max_length=8000)
    diagram_name: str = Field(default="", max_length=200)
    history: list[ChatHistoryMessage] = Field(default_factory=list, max_length=12)


class GenerateFlowchartResponse(BaseModel):
    plan: FlowchartGenerationPlan
    reply: str
    model: str
    origin: str


def _slugify_key(label: str, index: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    if not slug:
        slug = f"step_{index + 1}"
    if not slug[0].isalpha():
        slug = f"step_{slug}"
    return slug[:40]


def _normalize_palette_id(value: str) -> str:
    normalized = value.strip()
    if normalized in ALLOWED_PALETTE_IDS:
        return normalized
    lowered = normalized.lower()
    aliases = {
        "start": "fc-start-end",
        "end": "fc-start-end",
        "terminator": "fc-start-end",
        "process": "fc-process",
        "action": "fc-process",
        "decision": "fc-decision",
        "diamond": "fc-decision",
        "database": "fc-database",
        "db": "fc-database",
        "io": "fc-input-output",
        "input": "fc-input-output",
        "output": "fc-input-output",
        "document": "fc-document",
        "lambda": "fc-aws-lambda",
        "s3": "fc-aws-s3",
        "api": "fc-aws-api-gateway",
        "function": "fc-aws-lambda",
    }
    if lowered in aliases:
        return aliases[lowered]
    return "fc-process"


def _normalize_plan_dict(raw: dict) -> dict:
    nodes = raw.get("nodes") or []
    normalized_nodes = []
    seen_keys: set[str] = set()
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        key = str(node.get("key") or _slugify_key(str(node.get("label") or f"step_{index + 1}"), index))
        if key in seen_keys:
            key = f"{key}_{index + 1}"
        seen_keys.add(key)
        normalized_nodes.append(
            {
                "key": key,
                "label": str(node.get("label") or key.replace("_", " ").title())[:120],
                "palette_id": _normalize_palette_id(str(node.get("palette_id") or "fc-process")),
            }
        )

    node_keys = {node["key"] for node in normalized_nodes}
    normalized_edges = []
    for edge in raw.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        from_key = str(edge.get("from_key") or edge.get("from") or "")
        to_key = str(edge.get("to_key") or edge.get("to") or "")
        if from_key not in node_keys or to_key not in node_keys or from_key == to_key:
            continue
        normalized_edges.append(
            {
                "from_key": from_key,
                "to_key": to_key,
                "label": str(edge.get("label") or "")[:160],
            }
        )

    title = str(raw.get("title") or raw.get("diagram_name") or "Generated flowchart")[:200]
    summary = str(raw.get("summary") or raw.get("description") or "")[:2000]
    return {
        "title": title,
        "summary": summary,
        "nodes": normalized_nodes,
        "edges": normalized_edges,
    }


def _parse_plan_json(text: str) -> FlowchartGenerationPlan | None:
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
        return FlowchartGenerationPlan.model_validate(_normalize_plan_dict(payload))
    except ValidationError:
        return None


def _template_plan(prompt: str, diagram_name: str) -> FlowchartGenerationPlan:
    title = diagram_name.strip() or "Generated flowchart"
    topic = prompt.strip() or "the requested process"
    start = "start"
    process = "process"
    decision = "decision"
    done = "end"
    return FlowchartGenerationPlan(
        title=title,
        summary=f"Template flowchart drafted for: {topic[:240]}",
        nodes=[
            GeneratedFlowNode(key=start, label="Start", palette_id="fc-start-end"),
            GeneratedFlowNode(key=process, label="Do work", palette_id="fc-process"),
            GeneratedFlowNode(key=decision, label="Success?", palette_id="fc-decision"),
            GeneratedFlowNode(key=done, label="End", palette_id="fc-start-end"),
        ],
        edges=[
            GeneratedFlowEdge(from_key=start, to_key=process),
            GeneratedFlowEdge(from_key=process, to_key=decision),
            GeneratedFlowEdge(from_key=decision, to_key=done, label="Yes"),
            GeneratedFlowEdge(from_key=decision, to_key=process, label="No — retry"),
        ],
    )


def _json_schema_prompt() -> str:
    palette_list = "|".join(sorted(ALLOWED_PALETTE_IDS))
    return (
        "Return a single JSON object with this exact shape:\n"
        "{\n"
        '  "title": "string",\n'
        '  "summary": "short assistant-facing summary of the flowchart",\n'
        '  "nodes": [\n'
        "    {\n"
        '      "key": "snake_case_unique_id",\n'
        '      "label": "Display label",\n'
        f'      "palette_id": "{palette_list}"\n'
        "    }\n"
        "  ],\n"
        '  "edges": [\n'
        '    { "from_key": "node_key", "to_key": "node_key", "label": "optional connector label" }\n'
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- Use 3-12 nodes with unique snake_case keys.\n"
        "- Prefer fc-start-end for start/end, fc-process for steps, fc-decision for branches.\n"
        "- Use cloud palette ids (fc-aws-*, fc-gcp-*) when the user mentions those services.\n"
        "- Connect nodes with edges that form a clear flow (avoid cycles unless intentional loops).\n"
        "- Keep labels short and readable.\n"
        "- summary should be 1-2 sentences describing what you built.\n"
        "- Return JSON only. No markdown fences or commentary."
    )


def _build_chat_payload(
    settings,
    prompt: str,
    diagram_name: str,
    history: list[ChatHistoryMessage],
) -> dict:
    system = (
        "You are Eleven Nodes AI, an expert flowchart and architecture diagram designer. "
        "You turn natural language into clear flowchart plans as strictly valid JSON."
    )

    messages: list[dict] = [{"role": "system", "content": system}]
    for item in history[-8:]:
        messages.append({"role": item.role, "content": item.content[:4000]})

    user_prompt = (
        "Design a flowchart diagram for Eleven Nodes Diagram Generator.\n\n"
        f"User request:\n{prompt.strip()}\n\n"
    )
    if diagram_name.strip():
        user_prompt += f"Preferred diagram title: {diagram_name.strip()}\n\n"
    if history:
        user_prompt += (
            "This is a follow-up. Revise or regenerate the flowchart to match the latest request "
            "while keeping useful structure from the conversation when it still fits.\n\n"
        )
    user_prompt += _json_schema_prompt()
    messages.append({"role": "user", "content": user_prompt})

    payload: dict = {
        "messages": messages,
        "response_format": {"type": "json_object"},
    }

    apply_chat_completion_limits(
        payload,
        settings,
        max_tokens=min(settings.max_tokens, 4096),
        temperature=min(settings.temperature, 0.45),
    )

    if not _is_azure_provider(settings.provider):
        payload["model"] = settings.model

    return payload


def _llm_plan(
    prompt: str,
    diagram_name: str,
    history: list[ChatHistoryMessage],
) -> FlowchartGenerationPlan | None:
    settings = get_llm_settings()
    if not settings.is_configured:
        return None

    provider = settings.provider.strip().lower()
    if provider not in {"openai", "azure", "azure-openai", "azure_openai"}:
        return None

    payload = _build_chat_payload(settings, prompt, diagram_name, history)
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


def _assistant_reply(plan: FlowchartGenerationPlan, origin: str) -> str:
    if plan.summary.strip():
        base = plan.summary.strip()
    else:
        base = (
            f"Created “{plan.title}” with {len(plan.nodes)} shapes "
            f"and {len(plan.edges)} connectors."
        )
    if origin == "template":
        return f"{base} (template draft — configure the server LLM for AI generation.)"
    return base


def generate_flowchart_plan(request: GenerateFlowchartRequest) -> GenerateFlowchartResponse:
    settings = get_llm_settings()
    llm_plan = _llm_plan(request.prompt, request.diagram_name, request.history)

    if llm_plan:
        origin = "azure-openai" if _is_azure_provider(settings.provider) else "openai"
        return GenerateFlowchartResponse(
            plan=llm_plan,
            reply=_assistant_reply(llm_plan, origin),
            model=settings.model,
            origin=origin,
        )

    plan = _template_plan(request.prompt, request.diagram_name)
    return GenerateFlowchartResponse(
        plan=plan,
        reply=_assistant_reply(plan, "template"),
        model=settings.model,
        origin="template",
    )
