import { STORAGE_KEYS } from '@/constants'
import {
  AGENT_WORKFLOW_TOOL_ID,
  createWorkflowWorkspaceDocument,
  saveWorkflowDocumentForWorkspace,
} from '@/components/agent-workflow/workflow-storage'

export type ProjectAccountType = 'company' | 'individual'
export type ProjectRole = 'student' | 'developer' | 'manager' | 'founder' | 'other'

export const PROJECT_ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'developer', label: 'Developer' },
  { value: 'manager', label: 'Manager' },
  { value: 'founder', label: 'Founder' },
  { value: 'other', label: 'Other' },
]

export interface ProjectInstance {
  accountType: ProjectAccountType
  displayName: string
  workspaceId: string
  createdAt: string
}

/** User account — created before any workspace instance. */
export interface ProjectAccount {
  id: string
  fullName: string
  role: ProjectRole
  email: string
  passwordHash: string
  createdAt: string
  /** Present once the user has created a workspace instance. */
  instance: ProjectInstance | null
  /** @deprecated legacy flat fields — migrated on read */
  accountType?: ProjectAccountType
  displayName?: string
  workspaceId?: string
}

/** Canvas session — only set after the user opens an instance. */
export interface ProjectSession {
  accountId: string
  email: string
  fullName: string
  role: ProjectRole
  workspaceId: string
  displayName: string
  accountType: ProjectAccountType
}

export interface CreateAccountInput {
  fullName: string
  role: ProjectRole
  email: string
  password: string
}

export interface CreateInstanceInput {
  accountType: ProjectAccountType
  displayName: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`eleven-nodes:v1:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function migrateAccount(raw: ProjectAccount): ProjectAccount {
  if (raw.instance !== undefined) {
    return {
      ...raw,
      fullName: raw.fullName || raw.displayName || raw.email,
      instance: raw.instance,
    }
  }

  // Legacy shape: account + workspace created together.
  if (raw.workspaceId) {
    return {
      id: raw.id,
      fullName: raw.displayName || raw.fullName || raw.email,
      role: raw.role,
      email: raw.email,
      passwordHash: raw.passwordHash,
      createdAt: raw.createdAt,
      instance: {
        accountType: raw.accountType ?? 'individual',
        displayName: raw.displayName || raw.fullName || 'Workspace',
        workspaceId: raw.workspaceId,
        createdAt: raw.createdAt,
      },
    }
  }

  return {
    id: raw.id,
    fullName: raw.fullName || raw.displayName || raw.email,
    role: raw.role,
    email: raw.email,
    passwordHash: raw.passwordHash,
    createdAt: raw.createdAt,
    instance: null,
  }
}

function readAccounts(): ProjectAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.projectAccounts)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ProjectAccount[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(migrateAccount)
  } catch {
    return []
  }
}

function writeAccounts(accounts: ProjectAccount[]): void {
  localStorage.setItem(STORAGE_KEYS.projectAccounts, JSON.stringify(accounts))
}

export function listAccounts(): ProjectAccount[] {
  return readAccounts()
}

export function hasAccounts(): boolean {
  return readAccounts().length > 0
}

export function accountHasInstance(account: ProjectAccount): boolean {
  return Boolean(account.instance?.workspaceId)
}

export function getSession(): ProjectSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.projectSession)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProjectSession
    if (!parsed?.accountId || !parsed.workspaceId || !parsed.email) return null
    return parsed
  } catch {
    return null
  }
}

export function setSession(session: ProjectSession): void {
  sessionStorage.setItem(STORAGE_KEYS.projectSession, JSON.stringify(session))
  window.dispatchEvent(new Event('eleven-nodes-project-session'))
}

export function logout(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.projectSession)
  } catch {
    // private mode
  }
  window.dispatchEvent(new Event('eleven-nodes-project-session'))
}

function toSession(account: ProjectAccount): ProjectSession | null {
  if (!account.instance) return null
  return {
    accountId: account.id,
    email: account.email,
    fullName: account.fullName,
    role: account.role,
    workspaceId: account.instance.workspaceId,
    displayName: account.instance.displayName,
    accountType: account.instance.accountType,
  }
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<{ account: ProjectAccount } | { error: string }> {
  const email = normalizeEmail(input.email)
  const fullName = input.fullName.trim()
  const password = input.password

  if (!fullName) return { error: 'Enter your full name.' }
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters.' }

  const accounts = readAccounts()
  if (accounts.some((account) => account.email === email)) {
    return { error: 'An account with this email already exists. Sign in instead.' }
  }

  const account: ProjectAccount = {
    id: `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    fullName,
    role: input.role,
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
    instance: null,
  }

  writeAccounts([...accounts, account])
  return { account }
}

export async function loginAccount(
  emailRaw: string,
  password: string,
): Promise<{ account: ProjectAccount } | { error: string }> {
  const email = normalizeEmail(emailRaw)
  if (!email || !password) return { error: 'Enter email and password.' }

  const account = readAccounts().find((item) => item.email === email)
  if (!account) return { error: 'No account found for this email. Create an account first.' }

  const passwordHash = await hashPassword(password)
  if (passwordHash !== account.passwordHash) {
    return { error: 'Incorrect password.' }
  }

  return { account }
}

/** Local-only reset — updates the password hash for an account on this device. */
export async function resetAccountPassword(
  emailRaw: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ ok: true } | { error: string }> {
  const email = normalizeEmail(emailRaw)
  if (!email || !email.includes('@')) return { error: 'Enter a valid email address.' }
  if (newPassword.length < 6) return { error: 'Password must be at least 6 characters.' }
  if (newPassword !== confirmPassword) return { error: 'Passwords do not match.' }

  const accounts = readAccounts()
  const index = accounts.findIndex((item) => item.email === email)
  if (index < 0) return { error: 'No account found for this email on this device.' }

  accounts[index] = {
    ...accounts[index],
    passwordHash: await hashPassword(newPassword),
  }
  writeAccounts(accounts)
  return { ok: true }
}

export function createInstanceForAccount(
  accountId: string,
  input: CreateInstanceInput,
): { session: ProjectSession } | { error: string } {
  const displayName = input.displayName.trim()
  if (!displayName) {
    return {
      error:
        input.accountType === 'company' ? 'Enter a company name.' : 'Enter an instance name.',
    }
  }

  const accounts = readAccounts()
  const index = accounts.findIndex((item) => item.id === accountId)
  if (index < 0) return { error: 'Account not found. Sign in again.' }

  const account = accounts[index]
  if (account.instance) {
    return { error: 'An instance already exists for this account. Open it instead.' }
  }

  const doc = createWorkflowWorkspaceDocument(
    input.accountType === 'company' ? `${displayName} workflow` : 'Main workflow',
  )
  const workspaceId = doc.workspaceId!
  const instance: ProjectInstance = {
    accountType: input.accountType,
    displayName,
    workspaceId,
    createdAt: new Date().toISOString(),
  }

  const nextAccount: ProjectAccount = { ...account, instance }
  const nextAccounts = [...accounts]
  nextAccounts[index] = nextAccount
  writeAccounts(nextAccounts)
  saveWorkflowDocumentForWorkspace(workspaceId, doc)

  const session = toSession(nextAccount)
  if (!session) return { error: 'Could not open the new instance.' }
  setSession(session)
  return { session }
}

export function enterInstance(accountId: string): { session: ProjectSession } | { error: string } {
  const account = readAccounts().find((item) => item.id === accountId)
  if (!account) return { error: 'Account not found. Sign in again.' }
  if (!account.instance) return { error: 'No instance found. Create one first.' }

  const existing = localStorage.getItem(
    STORAGE_KEYS.diagram(AGENT_WORKFLOW_TOOL_ID, account.instance.workspaceId),
  )
  if (!existing) {
    const doc = createWorkflowWorkspaceDocument()
    doc.workspaceId = account.instance.workspaceId
    saveWorkflowDocumentForWorkspace(account.instance.workspaceId, doc)
  }

  const session = toSession(account)
  if (!session) return { error: 'Could not open your instance.' }
  setSession(session)
  return { session }
}

export function getAccountById(accountId: string): ProjectAccount | null {
  return readAccounts().find((account) => account.id === accountId) ?? null
}
