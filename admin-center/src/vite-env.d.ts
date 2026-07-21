/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAIN_APP_URL?: string
  readonly VITE_CONFIG_CONSOLE_URL?: string
  readonly VITE_AGENT_WORKFLOW_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
