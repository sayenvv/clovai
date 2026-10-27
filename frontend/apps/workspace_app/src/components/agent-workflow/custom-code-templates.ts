import { Layers, Plug, Sparkles, Wrench, type LucideIcon } from 'lucide-react'
import type { CustomCodeKind } from '@/services/custom-code-api'

export interface CustomCodeKindMeta {
  label: string
  /** One line under the kind in the picker. */
  description: string
  icon: LucideIcon
  /** The starter source a new block of this kind opens with. */
  template: string
  /** A sample input for the test panel. */
  sampleInput: string
}

/**
 * Each kind's starter code. Every block is one Python module the sandbox imports; it calls the
 * named entry point with plain JSON values and sends back what it returns (also JSON).
 */
export const CUSTOM_CODE_KINDS: Record<CustomCodeKind, CustomCodeKindMeta> = {
  tool: {
    label: 'Tool',
    description: 'A function an agent can call, with typed arguments',
    icon: Wrench,
    template: `def run(args: dict) -> dict:
    """Called when the agent uses this tool.

    args: the arguments the model passed, matching the input schema.
    Return a JSON-serialisable value; the agent sees it as the tool result.
    """
    city = args.get("city", "")
    return {"city": city, "forecast": "sunny", "temperatureC": 24}
`,
    sampleInput: '{\n  "city": "Paris"\n}',
  },
  middleware: {
    label: 'Middleware',
    description: 'Runs around agent, model or tool calls to inspect, change or block them',
    icon: Layers,
    template: `def before(call: dict) -> dict:
    """Runs before the call. Return the call (changed or not).

    call["messages"]: the messages about to be sent (agent and model calls)
    call["arguments"]: the tool arguments (tool calls)
    Set call["block"] = "reason" to stop the call.
    """
    for message in call.get("messages", []):
        message["text"] = message.get("text", "").replace("password", "[redacted]")
    return call


def after(call: dict, result: dict) -> dict:
    """Runs after the call. Return the result (changed or not)."""
    return result
`,
    sampleInput: '{\n  "messages": [{ "role": "user", "text": "my password is hunter2" }]\n}',
  },
  skill: {
    label: 'Skill',
    description: 'Instructions plus optional helper functions an agent gains as a whole',
    icon: Sparkles,
    template: `# Helper functions the agent can call while using this skill.
# Each public function becomes a tool; its docstring is the tool's description.


def word_count(text: str) -> int:
    """Count the words in a piece of text."""
    return len(text.split())
`,
    sampleInput: '{\n  "function": "word_count",\n  "args": { "text": "one two three" }\n}',
  },
  context_provider: {
    label: 'Context provider',
    description: 'Adds memory or knowledge to an agent before each call',
    icon: Plug,
    template: `def invoking(context: dict) -> dict:
    """Runs before every model call of the agent that uses this provider.

    context["messages"]: the conversation so far
    context["agent"]: the agent's id and name
    Return {"instructions": "..."} to add to the agent's instructions,
    and/or {"messages": [...]} to add messages before the conversation.
    """
    return {"instructions": "Today's date is available as the user's local date."}


def invoked(context: dict, response: dict) -> None:
    """Runs after the model answered; use it to remember things."""
    return None
`,
    sampleInput: '{\n  "messages": [{ "role": "user", "text": "What should I do today?" }],\n  "agent": { "id": "planner", "name": "Planner" }\n}',
  },
}

export const CUSTOM_CODE_KIND_ORDER: CustomCodeKind[] = ['tool', 'middleware', 'skill', 'context_provider']

export const DEFAULT_TOOL_INPUT_SCHEMA = `{
  "type": "object",
  "properties": {
    "city": { "type": "string", "description": "The city to look up" }
  },
  "required": ["city"]
}`
