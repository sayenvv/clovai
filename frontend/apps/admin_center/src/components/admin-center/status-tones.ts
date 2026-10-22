import type {
  AdminActivityEvent,
  AdminUserStatus,
  WorkflowExecutionStatus,
  WorkflowLogLevel,
  WorkflowStatus,
} from '@/components/admin-center/mock-data'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral'

export const USER_STATUS_TONE: Record<AdminUserStatus, BadgeTone> = {
  active: 'success',
  invited: 'warning',
  suspended: 'danger',
}

export const WORKFLOW_STATUS_TONE: Record<WorkflowStatus, BadgeTone> = {
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
}

export const ACTIVITY_TONE: Record<AdminActivityEvent['type'], BadgeTone> = {
  signup: 'info',
  login: 'neutral',
  workflow: 'violet',
  run: 'success',
  security: 'danger',
  invite: 'warning',
}

export const EXECUTION_STATUS_TONE: Record<WorkflowExecutionStatus, BadgeTone> = {
  succeeded: 'success',
  failed: 'danger',
  running: 'info',
  waiting_approval: 'warning',
  cancelled: 'neutral',
}

export const LOG_LEVEL_TONE: Record<WorkflowLogLevel, BadgeTone> = {
  success: 'success',
  warn: 'warning',
  error: 'danger',
  info: 'info',
}
