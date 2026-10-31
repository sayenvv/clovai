import { STORAGE_KEYS } from '@/constants'
import { SIGNED_OUT_EVENT, authorizedFetch, signOutAllTabs, signOutGeneration, storeAuthTokens } from '@/services/api-auth'
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
  /** What the account may do: "admin" publishes shared workflows (from the API's accessRole). */
  accessRole?: string
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
  /** "admin" for accounts that manage shared workflows; absent or "user" otherwise. */
  accessRole?: 'admin' | 'user'
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

async function authRequest(
  path: string,
  body: unknown,
): Promise<{ body: Record<string, unknown> } | { error: string }> {
  let response: Response
  try {
    response = await authorizedFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { error: 'Could not reach the Eleven Nodes API.' }
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    return { error: apiError(payload) || `Request failed (${response.status}).` }
  }
  if (payload) storeAuthTokens(payload)
  return { body: payload ?? {} }
}

function apiError(payload: Record<string, unknown> | null): string {
  const detail = payload?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg
  }
  return ''
}

function rememberAccount(account: ProjectAccount) {
  const accounts = readAccounts().filter((item) => item.email !== account.email && item.id !== account.id)
  writeAccounts([...accounts, account])
}

function accountFromBody(body: Record<string, unknown>): ProjectAccount | null {
  const raw = (body.account ?? null) as Record<string, unknown> | null
  if (!raw || typeof raw.email !== 'string' || typeof raw.id !== 'string') return null
  const instance = instanceFromBody({ instance: raw.instance })
  return {
    id: raw.id,
    email: raw.email,
    fullName: typeof raw.fullName === 'string' ? raw.fullName : raw.email,
    role: (typeof raw.role === 'string' ? raw.role : 'developer') as ProjectRole,
    passwordHash: '',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    instance,
  }
}

function instanceFromBody(body: Record<string, unknown>): ProjectInstance | null {
  const raw = body.instance as Record<string, unknown> | null | undefined
  if (!raw || typeof raw.workspaceId !== 'string') return null
  const accountType = raw.accountType === 'company' ? 'company' : 'individual'
  return {
    accountType,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : 'Workspace',
    workspaceId: raw.workspaceId,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  }
}

function cacheAccount(
  body: Record<string, unknown>,
): { account: ProjectAccount } | { error: string } {
  const account = accountFromBody(body)
  if (!account) return { error: 'The API did not return an account.' }
  rememberAccount(account)
  return { account }
}

async function loadCurrentAccount(): Promise<{ account: ProjectAccount } | { error: string }> {
  let response: Response
  try {
    response = await authorizedFetch('/api/v1/auth/me')
  } catch {
    return { error: 'Could not reach the Eleven Nodes API.' }
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) return { error: apiError(payload) || 'Could not load your account.' }
  return cacheAccount(payload ?? {})
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

/** Local canvas identity used while auth is bypassed for testing. */
const DEV_TEST_SESSION: ProjectSession = {
  accountId: 'sayenvvpba@gmail.com',
  email: 'sayenvvpba@gmail.com',
  fullName: 'Local test',
  role: 'developer',
  workspaceId: 'ws_f12cb11a5794',
  displayName: 'orchestration sample',
  accountType: 'individual',
}

export function getSession(): ProjectSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.projectSession)
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectSession
      if (parsed?.accountId && parsed.workspaceId && parsed.email) return parsed
    }
  } catch {
    // Fall through to the local test session.
  }
  // Opt-in only: a built-in test user would otherwise stand in for "no session", so signing out
  // (or opening a new tab) silently showed you as signed in as someone else
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_TEST_SESSION === 'true') return DEV_TEST_SESSION
  return null
}

let restoring: Promise<void> | null = null

/**
 * Make the session the account the sign-in tokens belong to (`/auth/me`). The session is kept per
 * browser tab while the tokens are shared, so a new tab (or one opened from the Admin Center) would
 * otherwise show no account, or the local test one. Without valid tokens nothing changes.
 */
export function restoreSessionFromServer(): Promise<void> {
  restoring ??= (async () => {
    const generation = signOutGeneration()
    try {
      const response = await authorizedFetch('/api/v1/auth/me')
      // Signed out while this check was on its way: its answer is about the account that just signed out
      if (generation !== signOutGeneration()) return
      if (response.status === 401) {
        // The tokens are gone or no longer valid (e.g. signed out in another tab): so is this session
        if (getSession()) logout()
        return
      }
      if (!response.ok) return
      const body = (await response.json()) as { account?: ProjectAccount }
      const session = body.account ? toSession(body.account) : null
      const current = getSession()
      // The tokens belong to another account that has no workspace yet: this tab must not keep
      // showing the previous account, so it signs out (onboarding then picks up the new one)
      if (!session && body.account && current && current.accountId !== body.account.id) {
        clearSession() // only this tab's stale session: the tokens are the other account's, keep them
        return
      }
      if (
        session &&
        (current?.accountId !== session.accountId ||
          current?.fullName !== session.fullName ||
          current?.workspaceId !== session.workspaceId ||
          current?.accessRole !== session.accessRole)
      ) {
        setSession(session)
      }
    } catch {
      // Offline or no API: keep whatever session there is
    } finally {
      restoring = null
    }
  })()
  return restoring
}

export function setSession(session: ProjectSession): void {
  sessionStorage.setItem(STORAGE_KEYS.projectSession, JSON.stringify(session))
  window.dispatchEvent(new Event('eleven-nodes-project-session'))
}

export function logout(): void {
  signOutAllTabs()
  clearSession()
}

// Signed out in another tab: this tab's session goes too
if (typeof window !== 'undefined') {
  window.addEventListener(SIGNED_OUT_EVENT, () => clearSession())
}

/** Forget this tab's session without signing out (the shared tokens stay). */
export function clearSession(): void {
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
    accessRole: account.accessRole === 'admin' ? 'admin' : 'user',
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
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const result = await authRequest('/api/v1/auth/register', {
    email,
    password,
    fullName,
    role: input.role,
  })
  if ('error' in result) return result
  return cacheAccount(result.body)
}

export async function loginAccount(
  emailRaw: string,
  password: string,
): Promise<{ account: ProjectAccount } | { error: string }> {
  const email = normalizeEmail(emailRaw)
  if (!email || !password) return { error: 'Enter email and password.' }

  const result = await authRequest('/api/v1/auth/login', { userId: email, password })
  if ('error' in result) return result
  return loadCurrentAccount()
}

export async function loginWithGoogle(
  code: string,
): Promise<{ account: ProjectAccount } | { error: string }> {
  const result = await authRequest('/api/v1/auth/google', { code })
  if ('error' in result) return result
  const account = accountFromBody(result.body)
  if (!account) return { error: 'Google sign-in did not return an account.' }
  rememberAccount(account)
  return { account }
}

/** Updates the password on the Eleven Nodes API. */
/** Change the signed-in account's own password. `currentPassword` may be empty only for a Google account that never had one. */
export async function changeAccountPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ ok: true } | { error: string }> {
  if (newPassword.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (newPassword !== confirmPassword) return { error: 'Passwords do not match.' }

  const result = await authRequest('/api/v1/auth/change-password', { currentPassword, newPassword })
  if ('error' in result) return result
  return { ok: true }
}

export async function createInstanceForAccount(
  accountId: string,
  input: CreateInstanceInput,
): Promise<{ session: ProjectSession } | { error: string }> {
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
  if (accounts[index].instance) {
    return { error: 'An instance already exists for this account. Open it instead.' }
  }

  const result = await authRequest('/api/v1/instances', {
    accountType: input.accountType,
    displayName,
  })
  if ('error' in result) return result
  const instance = instanceFromBody(result.body)
  if (!instance) return { error: 'Could not create the instance.' }

  const doc = createWorkflowWorkspaceDocument(
    input.accountType === 'company' ? `${displayName} workflow` : 'Main workflow',
  )
  doc.workspaceId = instance.workspaceId
  saveWorkflowDocumentForWorkspace(instance.workspaceId, doc)

  const nextAccount: ProjectAccount = { ...accounts[index], instance }
  const nextAccounts = [...accounts]
  nextAccounts[index] = nextAccount
  writeAccounts(nextAccounts)

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
