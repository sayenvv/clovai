import { createContext, useContext } from 'react'
import type { WorkflowModelConfig } from '@/types/workflow-build-spec'

/**
 * The workflow's own model: what an agent without a model of its own runs on (and what a test run uses
 * for it). Agents read it to show the model they inherit.
 */
export const WorkflowModelContext = createContext<WorkflowModelConfig | null>(null)

export const useWorkflowModel = () => useContext(WorkflowModelContext)

/** Changes the workflow's model (the run chat's model picker); null where it cannot be changed. */
export const WorkflowModelChangeContext = createContext<((patch: Partial<WorkflowModelConfig>) => void) | null>(null)

export const useWorkflowModelChange = () => useContext(WorkflowModelChangeContext)
