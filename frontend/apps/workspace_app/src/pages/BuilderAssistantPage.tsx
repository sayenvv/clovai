import { useState } from 'react'
import { BuilderChat } from '@/components/agent-workflow/BuilderChat'
import { OLLAMA_DEFAULT_URL } from '@/components/agent-workflow/workflow-model-config'
import { useServerLlmConfig } from '@/hooks/use-server-llm-config'
import type { GenerateWorkflowModel } from '@/services/generate-workflow-api'

/** The builder assistant on its own page, beside the workflow assistant until it replaces it. */
export default function BuilderAssistantPage() {
  const { modelConfig, configured } = useServerLlmConfig()
  const [model, setModel] = useState<GenerateWorkflowModel>({ provider: 'server' })

  return (
    <div className="mx-auto flex h-screen w-full max-w-3xl flex-col">
      <BuilderChat
        model={model}
        onModelChange={setModel}
        serverModel={modelConfig.model}
        llmConfigured={configured}
        ollamaBaseUrl={OLLAMA_DEFAULT_URL}
        chatScope="builder-page"
      />
    </div>
  )
}
