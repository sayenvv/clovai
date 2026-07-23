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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** Pure JS SHA-256 — used when SubtleCrypto is unavailable (HTTP over LAN IP). */
function sha256Hex(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const bitLen = bytes.length * 8
  const withOne = bytes.length + 1
  const padLen = (withOne % 64 <= 56 ? 56 : 120) - (withOne % 64)
  const total = withOne + padLen + 8
  const msg = new Uint8Array(total)
  msg.set(bytes)
  msg[bytes.length] = 0x80
  const view = new DataView(msg.buffer)
  view.setUint32(total - 4, bitLen >>> 0, false)
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false)

  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false)
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[j] + w[j]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, H[i], false)
  return bytesToHex(out)
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`eleven-nodes:v1:${password}`)
  // SubtleCrypto is missing on non-secure origins (e.g. http://192.168.x.x).
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data)
    return bytesToHex(new Uint8Array(digest))
  }
  return sha256Hex(data)
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
