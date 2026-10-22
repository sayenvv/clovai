export type AdminUserStatus = 'active' | 'invited' | 'suspended'
export type AdminUserRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type WorkflowStatus = 'published' | 'draft' | 'archived'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminUserRole
  status: AdminUserStatus
  workflows: number
  lastActive: string
  joinedAt: string
  /** Extended profile fields for the detail page. */
  company: string
  country: string
  timezone: string
  plan: 'Free' | 'Pro' | 'Team' | 'Enterprise'
  phone?: string
  title?: string
  totalSpendUsd: number
  avgMonthlyUsd: number
}

export interface UserWorkflow {
  id: string
  userId: string
  name: string
  status: WorkflowStatus
  agents: number
  runs30d: number
  /** Estimated LLM + compute cost for the last 30 days, USD. */
  estimatedMonthlyUsd: number
  /** Blended cost per run in USD. */
  costPerRunUsd: number
  model: string
  updatedAt: string
  description: string
}

export interface AdminActivityEvent {
  id: string
  type: 'signup' | 'login' | 'workflow' | 'run' | 'security' | 'invite'
  actor: string
  summary: string
  detail?: string
  at: string
}

export interface AdminWorkflowRow {
  id: string
  name: string
  owner: string
  status: WorkflowStatus
  runs30d: number
  agents: number
  updatedAt: string
}

export interface AdminRole {
  id: string
  name: string
  description: string
  members: number
  permissions: string[]
}

export const ADMIN_USERS: AdminUser[] = [
  {
    id: 'u1',
    name: 'Aanya Sharma',
    email: 'aanya@elevennodes.dev',
    role: 'owner',
    status: 'active',
    workflows: 4,
    lastActive: '2m ago',
    joinedAt: '2025-11-02',
    company: 'Eleven Nodes',
    country: 'India',
    timezone: 'Asia/Kolkata',
    plan: 'Enterprise',
    phone: '+91 98765 43210',
    title: 'Founder',
    totalSpendUsd: 4820,
    avgMonthlyUsd: 612,
  },
  {
    id: 'u2',
    name: 'Marcus Chen',
    email: 'marcus@acme.io',
    role: 'admin',
    status: 'active',
    workflows: 3,
    lastActive: '18m ago',
    joinedAt: '2026-01-14',
    company: 'Acme Robotics',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    plan: 'Team',
    phone: '+1 415 555 0198',
    title: 'Head of Automation',
    totalSpendUsd: 2140,
    avgMonthlyUsd: 385,
  },
  {
    id: 'u3',
    name: 'Priya Patel',
    email: 'priya@acme.io',
    role: 'editor',
    status: 'active',
    workflows: 2,
    lastActive: '1h ago',
    joinedAt: '2026-02-03',
    company: 'Acme Robotics',
    country: 'India',
    timezone: 'Asia/Kolkata',
    plan: 'Team',
    title: 'Workflow Engineer',
    totalSpendUsd: 980,
    avgMonthlyUsd: 210,
  },
  {
    id: 'u4',
    name: 'Jordan Lee',
    email: 'jordan@northstar.ai',
    role: 'editor',
    status: 'invited',
    workflows: 0,
    lastActive: '—',
    joinedAt: '2026-07-18',
    company: 'Northstar AI',
    country: 'Singapore',
    timezone: 'Asia/Singapore',
    plan: 'Pro',
    title: 'Product Ops',
    totalSpendUsd: 0,
    avgMonthlyUsd: 0,
  },
  {
    id: 'u5',
    name: 'Sofia Alvarez',
    email: 'sofia@northstar.ai',
    role: 'viewer',
    status: 'active',
    workflows: 2,
    lastActive: '3h ago',
    joinedAt: '2026-03-21',
    company: 'Northstar AI',
    country: 'Spain',
    timezone: 'Europe/Madrid',
    plan: 'Pro',
    title: 'Analyst',
    totalSpendUsd: 340,
    avgMonthlyUsd: 68,
  },
  {
    id: 'u6',
    name: 'Noah Kim',
    email: 'noah@acme.io',
    role: 'viewer',
    status: 'suspended',
    workflows: 1,
    lastActive: '12d ago',
    joinedAt: '2026-04-09',
    company: 'Acme Robotics',
    country: 'South Korea',
    timezone: 'Asia/Seoul',
    plan: 'Free',
    title: 'Intern',
    totalSpendUsd: 42,
    avgMonthlyUsd: 12,
  },
]

/** Per-user workflows with estimated monthly price (mock). */
export const USER_WORKFLOWS: UserWorkflow[] = [
  {
    id: 'uw1',
    userId: 'u1',
    name: 'Invoice Extractor',
    status: 'draft',
    agents: 4,
    runs30d: 47,
    estimatedMonthlyUsd: 86,
    costPerRunUsd: 1.83,
    model: 'gpt-4.1',
    updatedAt: 'Yesterday',
    description: 'Parses vendor PDFs into structured line items with human review.',
  },
  {
    id: 'uw2',
    userId: 'u1',
    name: 'Platform Ops Digest',
    status: 'published',
    agents: 3,
    runs30d: 210,
    estimatedMonthlyUsd: 168,
    costPerRunUsd: 0.8,
    model: 'claude-sonnet',
    updatedAt: 'Today',
    description: 'Daily ops summary across failed runs and approval queues.',
  },
  {
    id: 'uw3',
    userId: 'u1',
    name: 'Customer Health Score',
    status: 'published',
    agents: 5,
    runs30d: 320,
    estimatedMonthlyUsd: 256,
    costPerRunUsd: 0.8,
    model: 'gpt-4.1-mini',
    updatedAt: '2 days ago',
    description: 'Scores accounts from usage + support signals.',
  },
  {
    id: 'uw4',
    userId: 'u1',
    name: 'Security Alert Triage',
    status: 'published',
    agents: 2,
    runs30d: 95,
    estimatedMonthlyUsd: 102,
    costPerRunUsd: 1.07,
    model: 'gpt-4.1',
    updatedAt: '4 days ago',
    description: 'Classifies auth anomalies and drafts owner alerts.',
  },
  {
    id: 'uw5',
    userId: 'u2',
    name: 'Lead Enrichment',
    status: 'published',
    agents: 5,
    runs30d: 428,
    estimatedMonthlyUsd: 214,
    costPerRunUsd: 0.5,
    model: 'gpt-4.1-mini',
    updatedAt: 'Today',
    description: 'Enriches inbound leads and scores ICP fit.',
  },
  {
    id: 'uw6',
    userId: 'u2',
    name: 'Onboarding Concierge',
    status: 'published',
    agents: 6,
    runs30d: 189,
    estimatedMonthlyUsd: 142,
    costPerRunUsd: 0.75,
    model: 'claude-sonnet',
    updatedAt: '3 days ago',
    description: 'Guided onboarding emails with approval gates.',
  },
  {
    id: 'uw7',
    userId: 'u2',
    name: 'Quote Assistant',
    status: 'draft',
    agents: 3,
    runs30d: 28,
    estimatedMonthlyUsd: 29,
    costPerRunUsd: 1.04,
    model: 'gpt-4.1',
    updatedAt: '1 week ago',
    description: 'Drafts commercial quotes from CRM opportunities.',
  },
  {
    id: 'uw8',
    userId: 'u3',
    name: 'Support Triage',
    status: 'published',
    agents: 3,
    runs30d: 312,
    estimatedMonthlyUsd: 156,
    costPerRunUsd: 0.5,
    model: 'gpt-4.1-mini',
    updatedAt: 'Today',
    description: 'Routes tickets by urgency and product area.',
  },
  {
    id: 'uw9',
    userId: 'u3',
    name: 'KB Article Drafter',
    status: 'published',
    agents: 2,
    runs30d: 64,
    estimatedMonthlyUsd: 54,
    costPerRunUsd: 0.84,
    model: 'claude-sonnet',
    updatedAt: '5 days ago',
    description: 'Turns resolved tickets into draft help articles.',
  },
  {
    id: 'uw10',
    userId: 'u5',
    name: 'Legacy CRM Sync',
    status: 'archived',
    agents: 2,
    runs30d: 0,
    estimatedMonthlyUsd: 0,
    costPerRunUsd: 0,
    model: 'gpt-4.1-mini',
    updatedAt: '2 weeks ago',
    description: 'One-way sync from legacy CRM — archived.',
  },
  {
    id: 'uw11',
    userId: 'u5',
    name: 'Weekly Usage Report',
    status: 'published',
    agents: 1,
    runs30d: 8,
    estimatedMonthlyUsd: 18,
    costPerRunUsd: 2.25,
    model: 'gpt-4.1',
    updatedAt: 'Yesterday',
    description: 'Compiles weekly product usage for leadership.',
  },
  {
    id: 'uw12',
    userId: 'u6',
    name: 'Sandbox Demo Flow',
    status: 'draft',
    agents: 2,
    runs30d: 12,
    estimatedMonthlyUsd: 12,
    costPerRunUsd: 1.0,
    model: 'gpt-4.1-mini',
    updatedAt: '12 days ago',
    description: 'Training sandbox for demo walkthroughs.',
  },
]

export type AdminNotificationKind = 'run' | 'security' | 'invite' | 'system' | 'billing'

export interface AdminNotification {
  id: string
  kind: AdminNotificationKind
  title: string
  body: string
  at: string
  unread: boolean
}

export const ADMIN_NOTIFICATIONS: AdminNotification[] = [
  {
    id: 'n1',
    kind: 'run',
    title: 'Invoice Extractor failed',
    body: 'LLM timeout on run_9c1a · retry scheduled',
    at: '2m ago',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'invite',
    title: 'Jordan Lee accepted invite',
    body: 'Joined as Editor · Acme Robotics',
    at: '26m ago',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'security',
    title: 'API token rotated',
    body: 'Workspace token ·••••·9k2a was rotated',
    at: '3h ago',
    unread: true,
  },
  {
    id: 'n4',
    kind: 'system',
    title: 'Support Triage published',
    body: 'Priya Patel shipped Support Triage v3',
    at: '1d ago',
    unread: false,
  },
  {
    id: 'n5',
    kind: 'billing',
    title: 'Credits at 82% used',
    body: 'Pro plan · 18% remaining this cycle',
    at: '1d ago',
    unread: false,
  },
]

export const ADMIN_ACTIVITY: AdminActivityEvent[] = [
  {
    id: 'a1',
    type: 'run',
    actor: 'Marcus Chen',
    summary: 'Executed Lead Enrichment workflow',
    detail: 'run_8f2c · 4 agents · 12.4s',
    at: '2 minutes ago',
  },
  {
    id: 'a2',
    type: 'invite',
    actor: 'Aanya Sharma',
    summary: 'Invited Jordan Lee as Editor',
    at: '26 minutes ago',
  },
  {
    id: 'a3',
    type: 'workflow',
    actor: 'Priya Patel',
    summary: 'Published Support Triage v3',
    detail: '3 agents · HITL approval enabled',
    at: '1 hour ago',
  },
  {
    id: 'a4',
    type: 'security',
    actor: 'System',
    summary: 'Rotated workspace API token',
    detail: 'token ·••••·9k2a',
    at: '3 hours ago',
  },
  {
    id: 'a5',
    type: 'login',
    actor: 'Sofia Alvarez',
    summary: 'Signed in from Chrome · Mumbai',
    at: '5 hours ago',
  },
  {
    id: 'a6',
    type: 'signup',
    actor: 'Jordan Lee',
    summary: 'Accepted workspace invite',
    at: 'Yesterday',
  },
  {
    id: 'a7',
    type: 'run',
    actor: 'Aanya Sharma',
    summary: 'Run failed on Invoice Extractor',
    detail: 'LLM timeout · retry scheduled',
    at: 'Yesterday',
  },
]

export const ADMIN_WORKFLOWS: AdminWorkflowRow[] = [
  {
    id: 'w1',
    name: 'Lead Enrichment',
    owner: 'Marcus Chen',
    status: 'published',
    runs30d: 428,
    agents: 5,
    updatedAt: 'Today',
  },
  {
    id: 'w2',
    name: 'Support Triage',
    owner: 'Priya Patel',
    status: 'published',
    runs30d: 312,
    agents: 3,
    updatedAt: 'Today',
  },
  {
    id: 'w3',
    name: 'Invoice Extractor',
    owner: 'Aanya Sharma',
    status: 'draft',
    runs30d: 47,
    agents: 4,
    updatedAt: 'Yesterday',
  },
  {
    id: 'w4',
    name: 'Onboarding Concierge',
    owner: 'Marcus Chen',
    status: 'published',
    runs30d: 189,
    agents: 6,
    updatedAt: '3 days ago',
  },
  {
    id: 'w5',
    name: 'Legacy CRM Sync',
    owner: 'Sofia Alvarez',
    status: 'archived',
    runs30d: 0,
    agents: 2,
    updatedAt: '2 weeks ago',
  },
]

export const ADMIN_ROLES: AdminRole[] = [
  {
    id: 'r1',
    name: 'Owner',
    description: 'Full control of billing, members, and platform settings.',
    members: 1,
    permissions: ['users.manage', 'billing.manage', 'workflows.publish', 'access.manage', 'settings.manage'],
  },
  {
    id: 'r2',
    name: 'Admin',
    description: 'Manage members, workflows, and operational settings.',
    members: 1,
    permissions: ['users.manage', 'workflows.publish', 'access.view', 'settings.view'],
  },
  {
    id: 'r3',
    name: 'Editor',
    description: 'Create and run agent workflows; cannot change billing.',
    members: 2,
    permissions: ['workflows.edit', 'workflows.run', 'users.view'],
  },
  {
    id: 'r4',
    name: 'Viewer',
    description: 'Read-only access to dashboards and workflow results.',
    members: 2,
    permissions: ['workflows.view', 'users.view'],
  },
]

export const DASHBOARD_METRICS = {
  totalUsers: 1284,
  activeWorkflows: 86,
  runs30d: 12480,
  successRate: 97.4,
}

export function getUser(id: string): AdminUser | undefined {
  return ADMIN_USERS.find((user) => user.id === id)
}

export function getWorkflowsForUser(userId: string): UserWorkflow[] {
  return USER_WORKFLOWS.filter((workflow) => workflow.userId === userId).sort(
    (a, b) => b.estimatedMonthlyUsd - a.estimatedMonthlyUsd,
  )
}

export function userMonthlyEstimate(userId: string): number {
  return getWorkflowsForUser(userId).reduce((sum, workflow) => sum + workflow.estimatedMonthlyUsd, 0)
}

export { formatCurrency, formatNumber, initials } from '@/utils/format'

/** Signed-in admin for header chrome (mock). */
export const CURRENT_ADMIN = {
  name: 'Aanya Sharma',
  email: 'aanya@elevennodes.dev',
  roleLabel: 'Owner',
} as const

export type DiagramNodeKind = 'trigger' | 'agent' | 'tool' | 'approval' | 'output'
export type WorkflowLogLevel = 'info' | 'warn' | 'error' | 'success'

export interface WorkflowDiagramNode {
  id: string
  label: string
  kind: DiagramNodeKind
  x: number
  y: number
}

export interface WorkflowDiagramEdge {
  id: string
  from: string
  to: string
  label?: string
}

export interface WorkflowDiagram {
  width: number
  height: number
  nodes: WorkflowDiagramNode[]
  edges: WorkflowDiagramEdge[]
}

export type WorkflowExecutionStatus =
  | 'succeeded'
  | 'failed'
  | 'running'
  | 'waiting_approval'
  | 'cancelled'

export interface WorkflowLogStep {
  id: string
  level: WorkflowLogLevel
  nodeId?: string
  nodeLabel?: string
  message: string
  detail?: string
  /** ISO-ish display time within the run */
  at: string
  durationMs?: number
}

export interface ExecutionResources {
  /** Peak CPU utilization 0–100 */
  cpuPct: number
  /** Peak memory used (MB) */
  memoryMb: number
  memoryLimitMb: number
  promptTokens: number
  completionTokens: number
  toolCalls: number
  networkKb: number
  /** Worker / queue seconds billed */
  computeSeconds: number
}

export interface ExecutionCredits {
  /** Platform credits consumed this run */
  total: number
  llm: number
  tools: number
  compute: number
  approval: number
}

export interface WorkflowExecution {
  id: string
  runId: string
  userId: string
  workflowId: string
  status: WorkflowExecutionStatus
  startedAt: string
  finishedAt?: string
  durationLabel: string
  trigger: string
  summary: string
  tokens: number
  estimatedCostUsd: number
  resources: ExecutionResources
  credits: ExecutionCredits
  steps: WorkflowLogStep[]
}

export interface WorkflowTrackingStats {
  executionCount: number
  succeeded: number
  failed: number
  waiting: number
  running: number
  successRate: number
  totalCredits: number
  totalCostUsd: number
  totalTokens: number
  avgCpuPct: number
  avgMemoryMb: number
  totalToolCalls: number
  totalComputeSeconds: number
  creditBreakdown: {
    llm: number
    tools: number
    compute: number
    approval: number
  }
}

/** @deprecated Prefer WorkflowLogStep inside WorkflowExecution */
export type WorkflowLogEntry = WorkflowLogStep & {
  userId: string
  workflowId: string
  runId: string
}

const NODE_W = 168
const NODE_H = 56
const GAP_X = 56
const GAP_Y = 88

function layoutChain(
  steps: Array<{ id: string; label: string; kind: DiagramNodeKind }>,
): WorkflowDiagram {
  const nodes = steps.map((step, index) => ({
    ...step,
    x: 40 + index * (NODE_W + GAP_X),
    y: 80,
  }))
  const edges = steps.slice(0, -1).map((step, index) => ({
    id: `e-${step.id}-${steps[index + 1]!.id}`,
    from: step.id,
    to: steps[index + 1]!.id,
  }))
  return {
    width: Math.max(640, 80 + steps.length * (NODE_W + GAP_X)),
    height: 220,
    nodes,
    edges,
  }
}

function layoutBranch(
  root: { id: string; label: string; kind: DiagramNodeKind },
  branches: Array<{ id: string; label: string; kind: DiagramNodeKind }>,
  merge: { id: string; label: string; kind: DiagramNodeKind },
): WorkflowDiagram {
  const startX = 40
  const midX = startX + NODE_W + GAP_X
  const endX = midX + NODE_W + GAP_X
  const branchStartY = 36
  const nodes: WorkflowDiagramNode[] = [
    { ...root, x: startX, y: branchStartY + ((branches.length - 1) * GAP_Y) / 2 },
    ...branches.map((branch, index) => ({
      ...branch,
      x: midX,
      y: branchStartY + index * GAP_Y,
    })),
    { ...merge, x: endX, y: branchStartY + ((branches.length - 1) * GAP_Y) / 2 },
  ]
  const edges: WorkflowDiagramEdge[] = [
    ...branches.map((branch) => ({
      id: `e-${root.id}-${branch.id}`,
      from: root.id,
      to: branch.id,
    })),
    ...branches.map((branch) => ({
      id: `e-${branch.id}-${merge.id}`,
      from: branch.id,
      to: merge.id,
    })),
  ]
  return {
    width: endX + NODE_W + 40,
    height: branchStartY + branches.length * GAP_Y + 24,
    nodes,
    edges,
  }
}

/** Read-only diagrams keyed by user workflow id. */
export const WORKFLOW_DIAGRAMS: Record<string, WorkflowDiagram> = {
  uw1: layoutChain([
    { id: 'n1', label: 'Invoice upload', kind: 'trigger' },
    { id: 'n2', label: 'Parse PDF', kind: 'agent' },
    { id: 'n3', label: 'OCR tool', kind: 'tool' },
    { id: 'n4', label: 'Human review', kind: 'approval' },
    { id: 'n5', label: 'ERP write', kind: 'output' },
  ]),
  uw2: layoutChain([
    { id: 'n1', label: 'Cron · 08:00', kind: 'trigger' },
    { id: 'n2', label: 'Collect failures', kind: 'agent' },
    { id: 'n3', label: 'Draft digest', kind: 'agent' },
    { id: 'n4', label: 'Slack post', kind: 'output' },
  ]),
  uw3: layoutBranch(
    { id: 'n1', label: 'Nightly sync', kind: 'trigger' },
    [
      { id: 'n2', label: 'Usage agent', kind: 'agent' },
      { id: 'n3', label: 'Support agent', kind: 'agent' },
      { id: 'n4', label: 'Billing agent', kind: 'agent' },
    ],
    { id: 'n5', label: 'Health score', kind: 'output' },
  ),
  uw4: layoutChain([
    { id: 'n1', label: 'Auth webhook', kind: 'trigger' },
    { id: 'n2', label: 'Classify risk', kind: 'agent' },
    { id: 'n3', label: 'Owner alert', kind: 'output' },
  ]),
  uw5: layoutBranch(
    { id: 'n1', label: 'New lead', kind: 'trigger' },
    [
      { id: 'n2', label: 'Clearbit', kind: 'tool' },
      { id: 'n3', label: 'LinkedIn', kind: 'tool' },
    ],
    { id: 'n4', label: 'ICP score', kind: 'agent' },
  ),
  uw6: layoutChain([
    { id: 'n1', label: 'Signup event', kind: 'trigger' },
    { id: 'n2', label: 'Plan path', kind: 'agent' },
    { id: 'n3', label: 'Draft email', kind: 'agent' },
    { id: 'n4', label: 'Approve send', kind: 'approval' },
    { id: 'n5', label: 'SendGrid', kind: 'output' },
  ]),
  uw7: layoutChain([
    { id: 'n1', label: 'CRM opportunity', kind: 'trigger' },
    { id: 'n2', label: 'Quote agent', kind: 'agent' },
    { id: 'n3', label: 'PDF tool', kind: 'tool' },
    { id: 'n4', label: 'Sales review', kind: 'approval' },
  ]),
  uw8: layoutBranch(
    { id: 'n1', label: 'Ticket created', kind: 'trigger' },
    [
      { id: 'n2', label: 'Urgency', kind: 'agent' },
      { id: 'n3', label: 'Product area', kind: 'agent' },
    ],
    { id: 'n4', label: 'Route queue', kind: 'output' },
  ),
  uw9: layoutChain([
    { id: 'n1', label: 'Resolved ticket', kind: 'trigger' },
    { id: 'n2', label: 'Draft article', kind: 'agent' },
    { id: 'n3', label: 'Editor review', kind: 'approval' },
    { id: 'n4', label: 'Publish KB', kind: 'output' },
  ]),
  uw10: layoutChain([
    { id: 'n1', label: 'Legacy poll', kind: 'trigger' },
    { id: 'n2', label: 'Map fields', kind: 'agent' },
    { id: 'n3', label: 'CRM upsert', kind: 'output' },
  ]),
  uw11: layoutChain([
    { id: 'n1', label: 'Weekly cron', kind: 'trigger' },
    { id: 'n2', label: 'Aggregate usage', kind: 'agent' },
    { id: 'n3', label: 'Email report', kind: 'output' },
  ]),
  uw12: layoutChain([
    { id: 'n1', label: 'Demo start', kind: 'trigger' },
    { id: 'n2', label: 'Sample agent', kind: 'agent' },
    { id: 'n3', label: 'Show result', kind: 'output' },
  ]),
}

type WorkflowExecutionSeed = Omit<WorkflowExecution, 'resources' | 'credits'>

function hashSeed(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

function buildResourcesAndCredits(
  seed: WorkflowExecutionSeed,
): Pick<WorkflowExecution, 'resources' | 'credits'> {
  const hash = hashSeed(seed.runId)
  const promptTokens = Math.round(seed.tokens * (0.55 + (hash % 18) / 100))
  const completionTokens = Math.max(0, seed.tokens - promptTokens)
  const toolCalls = Math.max(
    seed.steps.filter(
      (step) =>
        step.nodeLabel?.toLowerCase().includes('tool') ||
        step.detail?.includes('http=') ||
        step.detail?.includes('provider='),
    ).length,
    hash % 3,
  )
  const cpuPct = Math.min(96, 28 + (hash % 55) + (seed.status === 'failed' ? 8 : 0))
  const memoryLimitMb = 1024
  const memoryMb = Math.min(
    memoryLimitMb - 32,
    180 + (hash % 420) + Math.round(seed.tokens / 120),
  )
  const networkKb = 120 + (hash % 900) + toolCalls * 40
  const computeSeconds = Math.max(
    1,
    Math.round(
      seed.steps.reduce((sum, step) => sum + (step.durationMs ?? 400), 0) / 1000 +
        (hash % 7),
    ),
  )

  const llmCredits = Number(((promptTokens + completionTokens) / 1000 * 1.35).toFixed(2))
  const toolCredits = Number((toolCalls * 0.45 + networkKb / 500).toFixed(2))
  const computeCredits = Number((computeSeconds * 0.08 + cpuPct / 80).toFixed(2))
  const approvalCredits = Number(
    (
      seed.steps.filter((step) => step.nodeLabel?.toLowerCase().includes('review') || step.nodeLabel?.toLowerCase().includes('approv')).length *
      0.75
    ).toFixed(2),
  )
  const total = Number(
    (llmCredits + toolCredits + computeCredits + approvalCredits).toFixed(2),
  )

  return {
    resources: {
      cpuPct,
      memoryMb,
      memoryLimitMb,
      promptTokens,
      completionTokens,
      toolCalls,
      networkKb,
      computeSeconds,
    },
    credits: {
      total,
      llm: llmCredits,
      tools: toolCredits,
      compute: computeCredits,
      approval: approvalCredits,
    },
  }
}

export const WORKFLOW_EXECUTIONS: WorkflowExecutionSeed[] = [
  {
    id: 'ex1',
    runId: 'run_9a1c',
    userId: 'u1',
    workflowId: 'uw1',
    status: 'failed',
    startedAt: 'Yesterday · 16:40:12',
    finishedAt: 'Yesterday · 16:42:08',
    durationLabel: '1m 56s',
    trigger: 'Manual upload · invoice_acme_q2.pdf',
    summary: 'Failed at Parse PDF after OCR confidence warning',
    tokens: 18420,
    estimatedCostUsd: 1.92,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Invoice upload',
        message: 'Run started from file drop',
        detail: 'file=invoice_acme_q2.pdf · size=2.4MB · pages=6',
        at: '16:40:12',
        durationMs: 120,
      },
      {
        id: 's2',
        level: 'info',
        nodeId: 'n2',
        nodeLabel: 'Parse PDF',
        message: 'Extracting line items with gpt-4.1',
        detail: 'prompt_tokens=4200 · attempt 1/3',
        at: '16:40:14',
        durationMs: 18200,
      },
      {
        id: 's3',
        level: 'warn',
        nodeId: 'n3',
        nodeLabel: 'OCR tool',
        message: 'Low-confidence OCR on page 4',
        detail: 'confidence=0.41 · region=table_body · fallback=human_review',
        at: '16:40:33',
        durationMs: 2400,
      },
      {
        id: 's4',
        level: 'info',
        nodeId: 'n2',
        nodeLabel: 'Parse PDF',
        message: 'Retrying extraction with higher temperature',
        detail: 'attempt 2/3 · temperature=0.4',
        at: '16:40:36',
        durationMs: 45200,
      },
      {
        id: 's5',
        level: 'error',
        nodeId: 'n2',
        nodeLabel: 'Parse PDF',
        message: 'LLM timeout while extracting line items',
        detail: 'error=ETIMEDOUT · model=gpt-4.1 · deadline=45s · run aborted',
        at: '16:42:08',
      },
    ],
  },
  {
    id: 'ex2',
    runId: 'run_88bf',
    userId: 'u1',
    workflowId: 'uw1',
    status: 'succeeded',
    startedAt: '2 days ago · 10:55:01',
    finishedAt: '2 days ago · 11:08:44',
    durationLabel: '13m 43s',
    trigger: 'Email inbound · invoices@acme.io',
    summary: 'Invoice INV-2044 approved and synced to NetSuite',
    tokens: 22110,
    estimatedCostUsd: 2.14,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Invoice upload',
        message: 'Attachment accepted from email ingest',
        detail: 'message_id=msg_771 · from=ap@vendor.com',
        at: '10:55:01',
        durationMs: 90,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Parse PDF',
        message: 'Extracted 18 line items',
        detail: 'model=gpt-4.1 · confidence=0.93',
        at: '10:55:48',
        durationMs: 21400,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'OCR tool',
        message: 'OCR completed for scanned appendix',
        detail: 'pages=2 · avg_confidence=0.88',
        at: '10:56:10',
        durationMs: 3100,
      },
      {
        id: 's4',
        level: 'info',
        nodeId: 'n4',
        nodeLabel: 'Human review',
        message: 'Queued for approval',
        detail: 'assignee=Aanya Sharma',
        at: '10:56:12',
      },
      {
        id: 's5',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Human review',
        message: 'Approved by Aanya Sharma',
        detail: 'waited 6m 12s · edits=2 field corrections',
        at: '11:02:24',
        durationMs: 372000,
      },
      {
        id: 's6',
        level: 'success',
        nodeId: 'n5',
        nodeLabel: 'ERP write',
        message: 'Invoice INV-2044 synced to NetSuite',
        detail: 'external_id=NS-88421 · status=posted',
        at: '11:08:44',
        durationMs: 1800,
      },
    ],
  },
  {
    id: 'ex3',
    runId: 'run_7c0e',
    userId: 'u1',
    workflowId: 'uw1',
    status: 'waiting_approval',
    startedAt: 'Today · 09:12:04',
    durationLabel: '41m+',
    trigger: 'API · POST /ingest/invoice',
    summary: 'Waiting on human review for vendor mismatch',
    tokens: 15200,
    estimatedCostUsd: 1.41,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Invoice upload',
        message: 'API ingest accepted payload',
        detail: 'client=erp-bridge · request_id=req_441',
        at: '09:12:04',
        durationMs: 80,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Parse PDF',
        message: 'Parsed header + 11 lines',
        detail: 'vendor_guess=Northwind Supplies',
        at: '09:12:41',
        durationMs: 16800,
      },
      {
        id: 's3',
        level: 'warn',
        nodeId: 'n3',
        nodeLabel: 'OCR tool',
        message: 'Vendor tax ID does not match master data',
        detail: 'expected=GSTIN29… · found=GSTIN27…',
        at: '09:12:55',
        durationMs: 1900,
      },
      {
        id: 's4',
        level: 'info',
        nodeId: 'n4',
        nodeLabel: 'Human review',
        message: 'Paused for approval',
        detail: 'reason=vendor_mismatch · SLA=2h',
        at: '09:12:56',
      },
    ],
  },
  {
    id: 'ex4',
    runId: 'run_ops12',
    userId: 'u1',
    workflowId: 'uw2',
    status: 'succeeded',
    startedAt: 'Today · 08:00:00',
    finishedAt: 'Today · 08:01:12',
    durationLabel: '1m 12s',
    trigger: 'Cron · 08:00 IST',
    summary: 'Ops digest posted to #platform-alerts',
    tokens: 6400,
    estimatedCostUsd: 0.42,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Cron · 08:00',
        message: 'Scheduled run fired',
        at: '08:00:00',
        durationMs: 40,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Collect failures',
        message: 'Found 4 failed runs in the last 24h',
        detail: 'sources=workflow_runner · window=24h',
        at: '08:00:18',
        durationMs: 6200,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Draft digest',
        message: 'Digest drafted (842 chars)',
        detail: 'model=claude-sonnet',
        at: '08:00:54',
        durationMs: 9800,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Slack post',
        message: 'Posted to #platform-alerts',
        detail: 'ts=1718.442 · channel=C04OPS',
        at: '08:01:12',
        durationMs: 900,
      },
    ],
  },
  {
    id: 'ex5',
    runId: 'run_ops11',
    userId: 'u1',
    workflowId: 'uw2',
    status: 'succeeded',
    startedAt: 'Yesterday · 08:00:00',
    finishedAt: 'Yesterday · 08:01:28',
    durationLabel: '1m 28s',
    trigger: 'Cron · 08:00 IST',
    summary: 'Digest posted with retry backlog warning',
    tokens: 7100,
    estimatedCostUsd: 0.48,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Cron · 08:00',
        message: 'Scheduled run fired',
        at: '08:00:00',
        durationMs: 35,
      },
      {
        id: 's2',
        level: 'warn',
        nodeId: 'n2',
        nodeLabel: 'Collect failures',
        message: '3 runs still in retry backlog',
        detail: 'oldest=run_55ab · age=6h',
        at: '08:00:22',
        durationMs: 7100,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Draft digest',
        message: 'Included backlog section in digest',
        at: '08:01:02',
        durationMs: 11200,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Slack post',
        message: 'Posted to #platform-alerts',
        at: '08:01:28',
        durationMs: 850,
      },
    ],
  },
  {
    id: 'ex6',
    runId: 'run_hs90',
    userId: 'u1',
    workflowId: 'uw3',
    status: 'succeeded',
    startedAt: '2 days ago · 02:00:00',
    finishedAt: '2 days ago · 02:10:44',
    durationLabel: '10m 44s',
    trigger: 'Nightly sync',
    summary: 'Scored 214 accounts · 12 marked at-risk',
    tokens: 48200,
    estimatedCostUsd: 3.2,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Nightly sync',
        message: 'Pulling CRM + product usage snapshots',
        at: '02:00:00',
        durationMs: 4200,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Usage agent',
        message: 'Usage features computed for 214 accounts',
        at: '02:03:12',
        durationMs: 88000,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Support agent',
        message: 'Support signals attached',
        detail: 'open_tickets=37',
        at: '02:06:01',
        durationMs: 54000,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Billing agent',
        message: 'Payment delinquency flags updated',
        at: '02:08:20',
        durationMs: 41000,
      },
      {
        id: 's5',
        level: 'success',
        nodeId: 'n5',
        nodeLabel: 'Health score',
        message: 'Scored 214 accounts · 12 marked at-risk',
        detail: 'write=warehouse.health_scores',
        at: '02:10:44',
        durationMs: 6200,
      },
    ],
  },
  {
    id: 'ex7',
    runId: 'run_sec3',
    userId: 'u1',
    workflowId: 'uw4',
    status: 'failed',
    startedAt: '4 days ago · 19:22:01',
    finishedAt: '4 days ago · 19:22:09',
    durationLabel: '8s',
    trigger: 'Auth webhook',
    summary: 'Rejected malformed auth payload',
    tokens: 920,
    estimatedCostUsd: 0.08,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Auth webhook',
        message: 'Webhook received',
        detail: 'source=auth0 · event=login_anomaly',
        at: '19:22:01',
        durationMs: 60,
      },
      {
        id: 's2',
        level: 'error',
        nodeId: 'n2',
        nodeLabel: 'Classify risk',
        message: 'Unexpected token shape from auth webhook',
        detail: 'payload.missing=geo · schema=v3 · rejected',
        at: '19:22:09',
        durationMs: 420,
      },
    ],
  },
  {
    id: 'ex8',
    runId: 'run_8f2c',
    userId: 'u2',
    workflowId: 'uw5',
    status: 'succeeded',
    startedAt: 'Today · just now',
    finishedAt: '2 minutes ago',
    durationLabel: '9.4s',
    trigger: 'Form submit · /leads',
    summary: 'Lead enriched · ICP score 87 (LinkedIn rate-limited)',
    tokens: 5100,
    estimatedCostUsd: 0.31,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'New lead',
        message: 'Lead created from website form',
        detail: 'email=casey@orbit.dev · company=Orbit',
        at: '00:00',
        durationMs: 50,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Clearbit',
        message: 'Company profile hydrated',
        detail: 'employees=120 · industry=SaaS',
        at: '00:02',
        durationMs: 2100,
      },
      {
        id: 's3',
        level: 'warn',
        nodeId: 'n3',
        nodeLabel: 'LinkedIn',
        message: 'Rate limited · used Clearbit-only path',
        detail: 'http=429 · retry_after=60s',
        at: '00:04',
        durationMs: 800,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'ICP score',
        message: 'Lead enriched · score 87',
        detail: 'tier=A · next=sales_sequence',
        at: '00:09',
        durationMs: 3200,
      },
    ],
  },
  {
    id: 'ex9',
    runId: 'run_onb7',
    userId: 'u2',
    workflowId: 'uw6',
    status: 'waiting_approval',
    startedAt: '3 days ago · 09:26:00',
    durationLabel: '14m+',
    trigger: 'Signup event',
    summary: 'Email draft waiting for send approval',
    tokens: 8900,
    estimatedCostUsd: 0.66,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Signup event',
        message: 'New user signed up',
        detail: 'plan=Team · locale=en-US',
        at: '09:26:00',
        durationMs: 40,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Plan path',
        message: 'Selected Team onboarding path',
        at: '09:26:11',
        durationMs: 4100,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Draft email',
        message: 'Personalized welcome email drafted',
        detail: 'subject="Welcome to Acme Robotics"',
        at: '09:26:40',
        durationMs: 9200,
      },
      {
        id: 's4',
        level: 'info',
        nodeId: 'n4',
        nodeLabel: 'Approve send',
        message: 'Waiting for human approval',
        detail: 'queued 14m · assignee=Marcus Chen',
        at: '09:26:41',
      },
    ],
  },
  {
    id: 'ex10',
    runId: 'run_onb6',
    userId: 'u2',
    workflowId: 'uw6',
    status: 'failed',
    startedAt: '4 days ago · 15:10:22',
    finishedAt: '4 days ago · 15:11:08',
    durationLabel: '46s',
    trigger: 'Signup event',
    summary: 'SendGrid rejected recipient domain',
    tokens: 7600,
    estimatedCostUsd: 0.55,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Signup event',
        message: 'New user signed up',
        detail: 'email=test@invalid.local',
        at: '15:10:22',
        durationMs: 35,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Plan path',
        message: 'Selected Free onboarding path',
        at: '15:10:30',
        durationMs: 2800,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Draft email',
        message: 'Draft ready',
        at: '15:10:51',
        durationMs: 7600,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Approve send',
        message: 'Auto-approved (policy: Free tier)',
        at: '15:10:52',
        durationMs: 20,
      },
      {
        id: 's5',
        level: 'error',
        nodeId: 'n5',
        nodeLabel: 'SendGrid',
        message: 'Send failed · invalid recipient domain',
        detail: 'smtp=550 · domain=invalid.local',
        at: '15:11:08',
        durationMs: 1100,
      },
    ],
  },
  {
    id: 'ex11',
    runId: 'run_sup2',
    userId: 'u3',
    workflowId: 'uw8',
    status: 'succeeded',
    startedAt: '1 hour ago',
    finishedAt: '1 hour ago',
    durationLabel: '4.1s',
    trigger: 'Ticket created',
    summary: 'Ticket #4412 routed to Billing',
    tokens: 2800,
    estimatedCostUsd: 0.18,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Ticket created',
        message: 'Zendesk webhook received',
        detail: 'ticket=#4412',
        at: '00:00',
        durationMs: 45,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Urgency',
        message: 'Classified urgency=high',
        at: '00:01',
        durationMs: 1600,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Product area',
        message: 'Classified area=billing',
        at: '00:02',
        durationMs: 1400,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Route queue',
        message: 'Ticket #4412 routed to Billing',
        detail: 'queue=billing_l1 · assignee=round_robin',
        at: '00:04',
        durationMs: 500,
      },
    ],
  },
  {
    id: 'ex12',
    runId: 'run_sup1',
    userId: 'u3',
    workflowId: 'uw8',
    status: 'succeeded',
    startedAt: 'Yesterday · 13:05:00',
    finishedAt: 'Yesterday · 13:05:06',
    durationLabel: '6.2s',
    trigger: 'Ticket created',
    summary: 'Routed with ambiguous urgency default',
    tokens: 3100,
    estimatedCostUsd: 0.2,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Ticket created',
        message: 'Zendesk webhook received',
        detail: 'ticket=#4390',
        at: '13:05:00',
        durationMs: 40,
      },
      {
        id: 's2',
        level: 'warn',
        nodeId: 'n2',
        nodeLabel: 'Urgency',
        message: 'Ambiguous urgency · defaulted to medium',
        detail: 'confidence=0.48',
        at: '13:05:02',
        durationMs: 1800,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Product area',
        message: 'Classified area=product',
        at: '13:05:04',
        durationMs: 1500,
      },
      {
        id: 's4',
        level: 'success',
        nodeId: 'n4',
        nodeLabel: 'Route queue',
        message: 'Ticket #4390 routed to Product',
        at: '13:05:06',
        durationMs: 400,
      },
    ],
  },
  {
    id: 'ex13',
    runId: 'run_kb4',
    userId: 'u3',
    workflowId: 'uw9',
    status: 'waiting_approval',
    startedAt: '5 days ago · 10:18:00',
    durationLabel: '—',
    trigger: 'Resolved ticket',
    summary: 'KB draft held for editor review',
    tokens: 11200,
    estimatedCostUsd: 0.74,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Resolved ticket',
        message: 'Ticket marked solved',
        detail: 'ticket=#4201',
        at: '10:18:00',
        durationMs: 30,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Draft article',
        message: 'Generated 640-word draft',
        detail: 'model=claude-sonnet',
        at: '10:19:40',
        durationMs: 22000,
      },
      {
        id: 's3',
        level: 'info',
        nodeId: 'n3',
        nodeLabel: 'Editor review',
        message: 'Draft held for edits by Priya Patel',
        detail: 'status=in_review',
        at: '10:20:01',
      },
    ],
  },
  {
    id: 'ex14',
    runId: 'run_rpt1',
    userId: 'u5',
    workflowId: 'uw11',
    status: 'succeeded',
    startedAt: 'Yesterday · 07:00:00',
    finishedAt: 'Yesterday · 07:00:38',
    durationLabel: '38s',
    trigger: 'Weekly cron',
    summary: 'Weekly report delivered to leadership@',
    tokens: 9400,
    estimatedCostUsd: 0.88,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Weekly cron',
        message: 'Weekly job started',
        at: '07:00:00',
        durationMs: 25,
      },
      {
        id: 's2',
        level: 'success',
        nodeId: 'n2',
        nodeLabel: 'Aggregate usage',
        message: 'Aggregated DAU/WAU and feature adoption',
        detail: 'rows=1.2M scanned',
        at: '07:00:22',
        durationMs: 18000,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Email report',
        message: 'Weekly report delivered to leadership@',
        detail: 'recipients=4 · provider=ses',
        at: '07:00:38',
        durationMs: 1400,
      },
    ],
  },
  {
    id: 'ex15',
    runId: 'run_demo1',
    userId: 'u6',
    workflowId: 'uw12',
    status: 'succeeded',
    startedAt: '12 days ago · 18:32:50',
    finishedAt: '12 days ago · 18:33:08',
    durationLabel: '18s',
    trigger: 'Demo start',
    summary: 'Sandbox run completed with fixture data',
    tokens: 1200,
    estimatedCostUsd: 0.06,
    steps: [
      {
        id: 's1',
        level: 'info',
        nodeId: 'n1',
        nodeLabel: 'Demo start',
        message: 'Sandbox session opened',
        at: '18:32:50',
        durationMs: 20,
      },
      {
        id: 's2',
        level: 'info',
        nodeId: 'n2',
        nodeLabel: 'Sample agent',
        message: 'Fixture prompt executed',
        detail: 'fixture=demo_v1.json',
        at: '18:33:01',
        durationMs: 9000,
      },
      {
        id: 's3',
        level: 'success',
        nodeId: 'n3',
        nodeLabel: 'Show result',
        message: 'Sandbox run completed with fixture data',
        at: '18:33:08',
        durationMs: 200,
      },
    ],
  },
]

export function getUserWorkflow(userId: string, workflowId: string): UserWorkflow | undefined {
  return USER_WORKFLOWS.find(
    (workflow) => workflow.id === workflowId && workflow.userId === userId,
  )
}

export function getWorkflowDiagram(workflowId: string): WorkflowDiagram {
  return (
    WORKFLOW_DIAGRAMS[workflowId] ??
    layoutChain([
      { id: 'n1', label: 'Trigger', kind: 'trigger' },
      { id: 'n2', label: 'Agent', kind: 'agent' },
      { id: 'n3', label: 'Output', kind: 'output' },
    ])
  )
}

export function getWorkflowExecutions(
  userId: string,
  workflowId: string,
): WorkflowExecution[] {
  return WORKFLOW_EXECUTIONS.filter(
    (execution) => execution.userId === userId && execution.workflowId === workflowId,
  ).map((seed) => ({
    ...seed,
    ...buildResourcesAndCredits(seed),
  }))
}

export function getWorkflowTrackingStats(
  userId: string,
  workflowId: string,
): WorkflowTrackingStats {
  const executions = getWorkflowExecutions(userId, workflowId)
  const succeeded = executions.filter((item) => item.status === 'succeeded').length
  const failed = executions.filter((item) => item.status === 'failed').length
  const waiting = executions.filter((item) => item.status === 'waiting_approval').length
  const running = executions.filter((item) => item.status === 'running').length
  const totalCredits = executions.reduce((sum, item) => sum + item.credits.total, 0)
  const totalCostUsd = executions.reduce((sum, item) => sum + item.estimatedCostUsd, 0)
  const totalTokens = executions.reduce((sum, item) => sum + item.tokens, 0)
  const totalToolCalls = executions.reduce((sum, item) => sum + item.resources.toolCalls, 0)
  const totalComputeSeconds = executions.reduce(
    (sum, item) => sum + item.resources.computeSeconds,
    0,
  )
  const avgCpuPct =
    executions.length === 0
      ? 0
      : executions.reduce((sum, item) => sum + item.resources.cpuPct, 0) / executions.length
  const avgMemoryMb =
    executions.length === 0
      ? 0
      : executions.reduce((sum, item) => sum + item.resources.memoryMb, 0) / executions.length

  return {
    executionCount: executions.length,
    succeeded,
    failed,
    waiting,
    running,
    successRate:
      executions.length === 0 ? 0 : Number(((succeeded / executions.length) * 100).toFixed(1)),
    totalCredits: Number(totalCredits.toFixed(2)),
    totalCostUsd: Number(totalCostUsd.toFixed(2)),
    totalTokens,
    avgCpuPct: Number(avgCpuPct.toFixed(1)),
    avgMemoryMb: Number(avgMemoryMb.toFixed(0)),
    totalToolCalls,
    totalComputeSeconds,
    creditBreakdown: {
      llm: Number(executions.reduce((sum, item) => sum + item.credits.llm, 0).toFixed(2)),
      tools: Number(executions.reduce((sum, item) => sum + item.credits.tools, 0).toFixed(2)),
      compute: Number(executions.reduce((sum, item) => sum + item.credits.compute, 0).toFixed(2)),
      approval: Number(
        executions.reduce((sum, item) => sum + item.credits.approval, 0).toFixed(2),
      ),
    },
  }
}

export function getWorkflowLogs(userId: string, workflowId: string): WorkflowLogEntry[] {
  return getWorkflowExecutions(userId, workflowId).flatMap((execution) =>
    execution.steps.map((step) => ({
      ...step,
      userId,
      workflowId,
      runId: execution.runId,
    })),
  )
}

export const DIAGRAM_NODE_SIZE = { width: NODE_W, height: NODE_H } as const

