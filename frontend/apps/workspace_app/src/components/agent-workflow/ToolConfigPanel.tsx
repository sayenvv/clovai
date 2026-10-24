import { memo, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { isMcpToolNode, listAgentNodes, remapToolToAgent } from '@/components/agent-workflow/tool-agent-mapping'
import { toolFunctionName } from '@/components/agent-workflow/maf-tool'
import { normalizeApprovalMode, type ToolApprovalMode } from '@/types/agent-workflow'
import type { Diagram, DiagramNode } from '@/components/designer/diagram-types'

const APPROVAL_MODES: { value: ToolApprovalMode; label: string }[] = [
  { value: 'never_require', label: 'Never require approval' },
  { value: 'always_require', label: 'Always require approval' },
]

const SCHEMA_PLACEHOLDER = `{
  "type": "object",
  "properties": {
    "location": { "type": "string", "description": "The location to get weather for." }
  },
  "required": ["location"]
}`

interface ToolConfigPanelProps {
  node: DiagramNode
  diagram: Diagram
  onChange: (updater: (previous: Diagram) => Diagram) => void
}

/**
 * A tool's settings, exactly the Agent Framework function tool's: name, description, input schema
 * and approval mode (plus which agent it belongs to, and the URL for an MCP server).
 */
export const ToolConfigPanel = memo(function ToolConfigPanel({ node, diagram, onChange }: ToolConfigPanelProps) {
  const agent = node.agent!
  const agents = listAgentNodes(diagram)
  const isMcp = isMcpToolNode(node)

  const updateTool = (patch: Partial<typeof agent>, label?: string) => {
    onChange((previous) => ({
      ...previous,
      nodes: previous.nodes.map((candidate) =>
        candidate.id !== node.id || !candidate.agent
          ? candidate
          : { ...candidate, label: label ?? candidate.label, agent: { ...candidate.agent, ...patch } },
      ),
    }))
  }

  const schemaError = useMemo(() => {
    const text = agent.inputSchema?.trim()
    if (!text) return null
    try {
      const parsed = JSON.parse(text) as unknown
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? null : 'The schema must be a JSON object.'
    } catch {
      return 'Not valid JSON yet.'
    }
  }, [agent.inputSchema])

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-3">
      <div className="space-y-4 pb-4">
        <Field label="Runs under" hint="The agent that can call this tool">
          <Select
            value={node.mappedAgentId ?? ''}
            onChange={(event) => onChange((previous) => remapToolToAgent(previous, node.id, event.target.value))}
          >
            <option value="" disabled>
              Select agent…
            </option>
            {agents.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </Select>
        </Field>

        <PanelSection title={isMcp ? 'MCP server' : 'Function tool'}>
          <Field
            label="Name"
            hint={`The model calls it as ${toolFunctionName(node.label, node.id)}`}
          >
            <Input value={node.label} onChange={(event) => updateTool({}, event.target.value)} placeholder="get_weather" />
          </Field>

          {isMcp ? (
            <Field label="Server URL" hint="HTTP(S) endpoint of the MCP server">
              <Input
                type="url"
                value={agent.mcpUrl ?? ''}
                onChange={(event) => updateTool({ mcpUrl: event.target.value })}
                placeholder="https://mcp.example.com/sse"
              />
            </Field>
          ) : null}

          <Field label="Description" hint="Tells the model when to use this tool">
            <Textarea
              rows={3}
              value={agent.description}
              onChange={(event) => updateTool({ description: event.target.value })}
              placeholder="Get the weather for a given location."
            />
          </Field>

          {!isMcp ? (
            <Field label="Input schema" hint="JSON Schema for the arguments the model passes">
              <Textarea
                rows={9}
                className="font-mono text-xs"
                value={agent.inputSchema}
                onChange={(event) => updateTool({ inputSchema: event.target.value })}
                placeholder={SCHEMA_PLACEHOLDER}
                aria-invalid={Boolean(schemaError)}
              />
              {schemaError ? <p className="text-[11px] text-destructive">{schemaError}</p> : null}
            </Field>
          ) : null}

          <Field label="Approval mode" hint="Whether a person must approve each call">
            <Select
              value={normalizeApprovalMode(agent.approvalMode)}
              onChange={(event) => updateTool({ approvalMode: event.target.value as ToolApprovalMode })}
            >
              {APPROVAL_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </Select>
          </Field>
        </PanelSection>
      </div>
    </div>
  )
})
