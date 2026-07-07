"""Generate Eleven Nodes executor handler source from workflow metadata."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

from pydantic import BaseModel, Field

from app.core.llm_settings import (
    _is_azure_provider,
    apply_chat_completion_limits,
    chat_completions_headers,
    chat_completions_url,
    get_llm_settings,
)


class GenerateExecutorSourceRequest(BaseModel):
    executor_name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    handler_kind: str = Field(default="class", pattern="^(class|function)$")
    executor_id: str = Field(default="custom_executor", min_length=1, max_length=120)
    input_type: str = Field(default="str", max_length=40)
    output_type: str = Field(default="str", max_length=40)


class GenerateExecutorSourceResponse(BaseModel):
    source: str
    model: str
    origin: str


def _slugify_executor_id(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.strip().lower()).strip("_")
    return slug or "custom_executor"


def _normalize_python(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    cleaned = re.sub(
        r"\bfrom\s+agent_framework(?:\.[A-Za-z0-9_]+)?\s+import\b",
        "from elevennodes import",
        cleaned,
    )
    cleaned = re.sub(r"\bimport\s+agent_framework(?:\.[A-Za-z0-9_]+)?\b", "import elevennodes", cleaned)
    cleaned = cleaned.replace("agent_framework.", "elevennodes.")
    cleaned = re.sub(r"\bagent_framework\b", "elevennodes", cleaned)
    cleaned = re.sub(r"Microsoft Agent Framework", "Eleven Nodes", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"Agent Framework", "Eleven Nodes", cleaned, flags=re.IGNORECASE)
    return cleaned


def _template_class_source(
    executor_name: str,
    description: str,
    executor_id: str,
    input_type: str,
    output_type: str,
) -> str:
    class_name = "".join(part.capitalize() for part in re.split(r"[^a-zA-Z0-9]+", executor_name) if part)
    class_name = class_name or "CustomExecutor"
    if not class_name.endswith("Executor"):
        class_name = f"{class_name}Executor"

    role = description.strip() or f"Process messages for the {executor_name} workflow step."
    return (
        "from elevennodes import Executor, WorkflowContext, handler\n\n\n"
        f'class {class_name}(Executor):\n'
        f'    """{role}"""\n\n'
        "    @handler\n"
        f"    async def handle(self, message: {input_type}, ctx: WorkflowContext[{output_type}]) -> None:\n"
        "        result = str(message).strip()\n"
        "        await ctx.send_message(result)\n"
        "        # await ctx.yield_output(result)\n"
    )


def _template_function_source(
    executor_name: str,
    description: str,
    executor_id: str,
    input_type: str,
    output_type: str,
) -> str:
    safe_id = _slugify_executor_id(executor_id or executor_name)
    function_name = safe_id if safe_id.isidentifier() else "custom_executor"
    role = description.strip() or f"Transform messages for the {executor_name} workflow step."
    return (
        "from elevennodes import WorkflowContext, executor\n\n\n"
        f'@executor(id="{safe_id}")\n'
        f"async def {function_name}(message: {input_type}, ctx: WorkflowContext[{output_type}]) -> None:\n"
        f'    """{role}"""\n'
        "    result = str(message).strip()\n"
        "    await ctx.send_message(result)\n"
    )


def _template_source(request: GenerateExecutorSourceRequest) -> str:
    if request.handler_kind == "function":
        return _template_function_source(
            request.executor_name,
            request.description,
            request.executor_id,
            request.input_type,
            request.output_type,
        )
    return _template_class_source(
        request.executor_name,
        request.description,
        request.executor_id,
        request.input_type,
        request.output_type,
    )


def _build_chat_payload(settings, request: GenerateExecutorSourceRequest) -> dict:
    kind_hint = (
        "Use a class that subclasses Executor with an @handler decorated async method."
        if request.handler_kind == "class"
        else 'Use an @executor(id="...") decorated async function.'
    )
    prompt = (
        "Write Python handler source for an Eleven Nodes workflow executor.\n"
        f"Executor display name: {request.executor_name}\n"
        f"Description: {request.description or 'General workflow executor step'}\n"
        f"Handler pattern: {request.handler_kind}\n"
        f"Executor id: {request.executor_id}\n"
        f"Input type: {request.input_type}\n"
        f"Output type: {request.output_type}\n\n"
        "Requirements:\n"
        "- Imports MUST come from `elevennodes` only (e.g. `from elevennodes import Executor, WorkflowContext, handler`).\n"
        "- Never import or mention agent_framework.\n"
        f"- {kind_hint}\n"
        "- Use `await ctx.send_message(...)` to forward results downstream.\n"
        "- Include a commented `# await ctx.yield_output(...)` example when useful.\n"
        "- Return only valid Python source. No markdown fences or explanation."
    )
    payload: dict = {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write concise Python workflow executor handlers for Eleven Nodes. "
                    "Always use elevennodes imports."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    }

    apply_chat_completion_limits(
        payload,
        settings,
        max_tokens=min(settings.max_tokens, 2048),
        temperature=min(settings.temperature, 0.4),
    )

    if not _is_azure_provider(settings.provider):
        payload["model"] = settings.model

    return payload


def _llm_source(request: GenerateExecutorSourceRequest) -> str | None:
    settings = get_llm_settings()
    if not settings.is_configured:
        return None

    provider = settings.provider.strip().lower()
    if provider not in {"openai", "azure", "azure-openai", "azure_openai"}:
        return None

    payload = _build_chat_payload(settings, request)
    http_request = urllib.request.Request(
        chat_completions_url(settings),
        data=json.dumps(payload).encode("utf-8"),
        headers=chat_completions_headers(settings),
        method="POST",
    )

    try:
        with urllib.request.urlopen(http_request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        text = _normalize_python(str(content))
        return text or None
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM request failed ({error.code}): {detail}") from error
    except (urllib.error.URLError, KeyError, IndexError, json.JSONDecodeError, TimeoutError):
        return None


def generate_executor_source(request: GenerateExecutorSourceRequest) -> GenerateExecutorSourceResponse:
    settings = get_llm_settings()
    llm_text = _llm_source(request)

    if llm_text:
        origin = "azure-openai" if _is_azure_provider(settings.provider) else "openai"
        return GenerateExecutorSourceResponse(
            source=llm_text,
            model=settings.model,
            origin=origin,
        )

    return GenerateExecutorSourceResponse(
        source=_template_source(request),
        model=settings.model,
        origin="template",
    )
