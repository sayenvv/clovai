import { useMemo, useSyncExternalStore } from 'react'

export type TraceExporter = 'otlp-http' | 'otlp-grpc' | 'console'
export type LogLevel = 'debug' | 'info' | 'warning' | 'error'

/** Per-workflow runtime settings: observability, logging and execution limits. */
export interface WorkflowConfiguration {
  tracingEnabled: boolean
  captureSensitiveData: boolean
  openTelemetryEnabled: boolean
  otelExporter: TraceExporter
  otelEndpoint: string
  otelServiceName: string
  otelHeaders: string
  traceSampleRate: number
  metricsEnabled: boolean
  logLevel: LogLevel
  persistExecutionHistory: boolean
  maxIterations: number
  timeoutSeconds: number
  retryAttempts: number
  checkpointingEnabled: boolean
}

export const DEFAULT_WORKFLOW_CONFIGURATION: WorkflowConfiguration = {
  tracingEnabled: true,
  captureSensitiveData: false,
  openTelemetryEnabled: false,
  otelExporter: 'otlp-http',
  otelEndpoint: 'http://localhost:4318',
  otelServiceName: 'agent-workflow',
  otelHeaders: '',
  traceSampleRate: 1,
  metricsEnabled: false,
  logLevel: 'info',
  persistExecutionHistory: true,
  maxIterations: 20,
  timeoutSeconds: 300,
  retryAttempts: 0,
  checkpointingEnabled: false,
}

const STORAGE_KEY = 'eleven-nodes.workflow-configuration'

const EMPTY: Partial<WorkflowConfiguration> = {}

let configs: Record<string, Partial<WorkflowConfiguration>> = load()
const listeners = new Set<() => void>()

function load(): Record<string, Partial<WorkflowConfiguration>> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch {
    // Storage full or blocked: keep the settings for this session only.
  }
  listeners.forEach((listener) => listener())
}

/** A workflow's settings: its saved overrides on top of the config defaults (mega-menu.json). */
export function getWorkflowConfiguration(
  workflowId: string,
  defaults?: Partial<WorkflowConfiguration>,
): WorkflowConfiguration {
  return { ...DEFAULT_WORKFLOW_CONFIGURATION, ...defaults, ...configs[workflowId] }
}

export function updateWorkflowConfiguration(workflowId: string, patch: Partial<WorkflowConfiguration>) {
  configs = { ...configs, [workflowId]: { ...configs[workflowId], ...patch } }
  persist()
}

export function resetWorkflowConfiguration(workflowId: string) {
  const { [workflowId]: _removed, ...rest } = configs
  configs = rest
  persist()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useWorkflowConfiguration(
  workflowId: string,
  defaults?: Partial<WorkflowConfiguration>,
): WorkflowConfiguration {
  const overrides = useSyncExternalStore(subscribe, () => configs[workflowId] ?? EMPTY)
  return useMemo(
    () => ({ ...DEFAULT_WORKFLOW_CONFIGURATION, ...defaults, ...overrides }),
    [defaults, overrides],
  )
}
