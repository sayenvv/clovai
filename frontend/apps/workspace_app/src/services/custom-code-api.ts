/**
 * Custom code: tools, middlewares, skills and context providers users write in Python.
 *
 * The functions here have the shape of the planned `/api/v1/custom-code` routes (list, create,
 * update, delete, publish, test). Until that API exists the blocks are kept in local storage for
 * the signed-in account, and `testCustomCode` reports that the sandbox is not available yet.
 * Swapping in the API means replacing these bodies; the callers stay the same.
 */
import { STORAGE_KEYS } from '@/constants'
import { getSession } from '@/services/project-auth-store'

export type CustomCodeKind = 'tool' | 'middleware' | 'skill' | 'context_provider'

/**
 * Who sees a block: its author (`private`), the author's workspace collaborators (`workspace`,
 * once workspaces have members), or every user (`public`). Only the author edits it.
 */
export type CustomCodeVisibility = 'private' | 'workspace' | 'public'

/** Where a middleware runs: around the agent's whole turn, each model call, or each tool call. */
export type MiddlewareTarget = 'agent' | 'chat' | 'function'

export interface CustomCode {
  id: string
  kind: CustomCodeKind
  name: string
  description: string
  /** The Python source the sandbox runs. */
  source: string
  /** Tools: JSON Schema for the arguments the model passes. */
  inputSchema?: string
  /** Skills: the instructions added to the agent that uses it. */
  instructions?: string
  /** Middlewares: what the middleware wraps. */
  middlewareTarget?: MiddlewareTarget
  visibility: CustomCodeVisibility
  ownerId: string
  ownerEmail: string
  version: number
  createdAt: string
  updatedAt: string
}

export type CustomCodeInput = Pick<
  CustomCode,
  'kind' | 'name' | 'description' | 'source' | 'inputSchema' | 'instructions' | 'middlewareTarget' | 'visibility'
>

export interface CustomCodeTestResult {
  ok: boolean
  output?: unknown
  logs: string
  durationMs?: number
  error?: string
}

const CHANGE_EVENT = 'eleven-nodes-custom-code'

function readAll(): CustomCode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customCode)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as CustomCode[]) : []
  } catch {
    return []
  }
}

function writeAll(blocks: CustomCode[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.customCode, JSON.stringify(blocks))
  } catch {
    throw new Error('Could not save the custom code in this browser.')
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function currentUser(): { id: string; email: string } {
  const session = getSession()
  return { id: session?.accountId ?? '', email: session?.email ?? '' }
}

/** Whether the signed-in user wrote this block, and so may edit, publish or delete it. */
export function isOwnCustomCode(block: CustomCode): boolean {
  return block.ownerId === currentUser().id
}

/** The blocks the signed-in user can use: their own, and everyone's public ones. */
export async function listCustomCode(): Promise<CustomCode[]> {
  const me = currentUser().id
  return readAll()
    .filter((block) => block.ownerId === me || block.visibility === 'public')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function createCustomCode(input: CustomCodeInput): Promise<CustomCode> {
  const user = currentUser()
  const now = new Date().toISOString()
  const block: CustomCode = {
    ...input,
    id: crypto.randomUUID(),
    ownerId: user.id,
    ownerEmail: user.email,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  writeAll([...readAll(), block])
  return block
}

export async function updateCustomCode(id: string, input: CustomCodeInput): Promise<CustomCode> {
  const blocks = readAll()
  const current = blocks.find((block) => block.id === id)
  if (!current) throw new Error('This custom code no longer exists.')
  if (!isOwnCustomCode(current)) throw new Error('Only its author can change this custom code.')
  const next: CustomCode = { ...current, ...input, version: current.version + 1, updatedAt: new Date().toISOString() }
  writeAll(blocks.map((block) => (block.id === id ? next : block)))
  return next
}

export async function deleteCustomCode(id: string): Promise<void> {
  const blocks = readAll()
  const current = blocks.find((block) => block.id === id)
  if (current && !isOwnCustomCode(current)) throw new Error('Only its author can delete this custom code.')
  writeAll(blocks.filter((block) => block.id !== id))
}

/** Run the block once in the sandbox with `input`. Needs the custom-code API, which is not built yet. */
export async function testCustomCode(_block: CustomCodeInput, _input: unknown): Promise<CustomCodeTestResult> {
  return {
    ok: false,
    logs: '',
    error: 'Test runs need the code sandbox on the server, which is not available yet. Your code is saved and will run once it is.',
  }
}

/** Notify `listener` when blocks change here or in another tab. */
export function subscribeCustomCode(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEYS.customCode) listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}
