/**
 * Agents in the exported JSON each carry their own model configuration: their model client and
 * model, their temperature, and the workflow's defaults for the rest. The shared top-level
 * `modelConfig` is dropped from the view (the run spec keeps it; the backend requires it).
 */

import type { Diagram } from '@/components/designer/diagram-types'
import { resolveModelProvider } from '@/components/agent-workflow/model-providers'
import type { WorkflowBuildSpec, WorkflowModelConfig } from '@/types/workflow-build-spec'

export function withAgentModelConfigs<Spec extends Pick<WorkflowBuildSpec, 'agents' | 'modelConfig'>>(
  spec: Spec,
  diagram: Diagram,
): Omit<Spec, 'modelConfig'> {
  const defaults = spec.modelConfig
  const agents = spec.agents.map((agent) => {
    const config = diagram.nodes.find((node) => node.id === agent.id)?.agent
    const provider = resolveModelProvider(config)?.id ?? defaults.provider
    const modelConfig: WorkflowModelConfig = {
      ...defaults,
      provider,
      model: config?.model?.trim() || defaults.model,
      temperature: typeof config?.temperature === 'number' ? config.temperature : defaults.temperature,
    }
    // A server URL only belongs to the local client it was set for.
    if (provider !== defaults.provider) delete modelConfig.baseUrl
    // The user's own saved model: endpoint and key live on the server, referenced by id.
    if (config?.modelConnectionId) {
      delete modelConfig.baseUrl
      return { ...agent, modelConfig: { connectionId: config.modelConnectionId, ...modelConfig } }
    }
    return { ...agent, modelConfig }
  })
  const { modelConfig: _shared, ...rest } = spec
  return { ...rest, agents } as Omit<Spec, 'modelConfig'>
}
