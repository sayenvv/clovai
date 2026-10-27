import { memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Globe, Loader2, Lock, Play, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/agent-workflow/FormField'
import { PythonCodeEditorField } from '@/components/agent-workflow/PythonCodeEditorField'
import {
  CUSTOM_CODE_KINDS,
  CUSTOM_CODE_KIND_ORDER,
  DEFAULT_TOOL_INPUT_SCHEMA,
} from '@/components/agent-workflow/custom-code-templates'
import {
  createCustomCode,
  deleteCustomCode,
  isOwnCustomCode,
  testCustomCode,
  updateCustomCode,
  type CustomCode,
  type CustomCodeInput,
  type CustomCodeKind,
  type CustomCodeTestResult,
  type CustomCodeVisibility,
  type MiddlewareTarget,
} from '@/services/custom-code-api'
import { cn } from '@/utils/cn'

const VISIBILITY: Array<{ value: CustomCodeVisibility; label: string; hint: string; icon: typeof Lock; disabled?: boolean }> = [
  { value: 'private', label: 'Private', hint: 'Only you', icon: Lock },
  { value: 'workspace', label: 'Workspace', hint: 'You and collaborators (coming soon)', icon: Users, disabled: true },
  { value: 'public', label: 'Public', hint: 'Every user', icon: Globe },
]

// The test panel's height, dragged like VS Code's bottom panel; remembered in this browser
const TEST_HEIGHT_KEY = 'eleven-nodes-custom-code-test-height'
const TEST_MIN_HEIGHT = 96
const CODE_MIN_HEIGHT = 120

// The settings column's width, dragged by its right edge; remembered in this browser
const SETTINGS_WIDTH_KEY = 'eleven-nodes-custom-code-settings-width'
const SETTINGS_MIN_WIDTH = 220
const SETTINGS_MAX_WIDTH = 560
const SETTINGS_DEFAULT_WIDTH = 300

function storedSettingsWidth(): number {
  try {
    const value = Number(window.localStorage.getItem(SETTINGS_WIDTH_KEY))
    return Number.isFinite(value) && value >= SETTINGS_MIN_WIDTH ? Math.min(value, SETTINGS_MAX_WIDTH) : SETTINGS_DEFAULT_WIDTH
  } catch {
    return SETTINGS_DEFAULT_WIDTH
  }
}

// Whether each panel is open; a panel dragged below half its minimum snaps shut, as in VS Code
const SETTINGS_OPEN_KEY = 'eleven-nodes-custom-code-settings-open'
const TEST_OPEN_KEY = 'eleven-nodes-custom-code-test-open'

function storedOpen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== '0'
  } catch {
    return true
  }
}

function storeValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the panels open at their defaults next time.
  }
}

/**
 * A closed panel: a thin strip with three dots on the edge it opens from. Click it to open the
 * panel, or drag it out to the size you want.
 */
function CollapsedGrip({
  orientation,
  label,
  onPointerDown,
  onOpen,
}: {
  /** `vertical`: a strip down the side (settings); `horizontal`: one along the bottom (test). */
  orientation: 'vertical' | 'horizontal'
  label: string
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onOpen: () => void
}) {
  const vertical = orientation === 'vertical'
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group/grip flex shrink-0 items-center justify-center bg-[hsl(var(--chrome))] transition-colors hover:bg-primary/[0.08]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        vertical ? 'w-2 cursor-col-resize flex-col gap-[3px] border-r border-border' : 'h-2 cursor-row-resize gap-[3px] border-t border-border',
      )}
    >
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="size-[3px] rounded-full bg-foreground/35 transition-colors group-hover/grip:bg-primary" aria-hidden />
      ))}
    </div>
  )
}

/**
 * The three dots in the middle of an open panel's edge line, the same grip a closed panel shows,
 * so the line reads as draggable. Faint at rest, orange with the line on hover.
 */
function SashDots({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const vertical = orientation === 'vertical'
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-[3px] rounded-[2px] border border-border bg-[hsl(var(--chrome))]',
        vertical ? 'flex-col px-[2px] py-1' : 'px-1 py-[2px]',
      )}
    >
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="size-[3px] rounded-full bg-foreground/35 transition-colors group-hover/sash:bg-primary" />
      ))}
    </span>
  )
}

/** Follow the pointer until it is released, with the resize cursor on the whole page meanwhile. */
function trackDrag(cursor: 'row-resize' | 'col-resize', onMove: (event: PointerEvent) => void): void {
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function storedTestHeight(): number {
  try {
    const value = Number(window.localStorage.getItem(TEST_HEIGHT_KEY))
    return Number.isFinite(value) && value >= TEST_MIN_HEIGHT ? value : 220
  } catch {
    return 220
  }
}

function draftFor(kind: CustomCodeKind): CustomCodeInput {
  return {
    kind,
    name: '',
    description: '',
    source: CUSTOM_CODE_KINDS[kind].template,
    inputSchema: kind === 'tool' ? DEFAULT_TOOL_INPUT_SCHEMA : undefined,
    instructions: kind === 'skill' ? '' : undefined,
    middlewareTarget: kind === 'middleware' ? 'chat' : undefined,
    visibility: 'private',
  }
}

function fromBlock(block: CustomCode): CustomCodeInput {
  const { kind, name, description, source, inputSchema, instructions, middlewareTarget, visibility } = block
  return { kind, name, description, source, inputSchema, instructions, middlewareTarget, visibility }
}

/** Python identifiers only: the name is how agents and workflows refer to the block. */
function nameProblem(name: string): string | null {
  if (!name.trim()) return 'Give it a name'
  if (!/^[a-z_][a-z0-9_]*$/.test(name.trim())) return 'Use lowercase letters, digits and _ (e.g. get_weather)'
  return null
}

function jsonProblem(text: string | undefined): string | null {
  if (!text?.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Not valid JSON'
  }
}

/**
 * Write or edit a custom code block: its kind, name and settings on the left, the Python source
 * and a test run on the right. Blocks someone else wrote open read-only.
 */
export const CustomCodeEditor = memo(function CustomCodeEditor({
  block,
  initialKind = 'tool',
  onSaved,
  onDeleted,
  onCancel,
}: {
  /** The block to edit; none to write a new one. */
  block?: CustomCode | null
  initialKind?: CustomCodeKind
  onSaved: (block: CustomCode) => void
  onDeleted: () => void
  onCancel: () => void
}) {
  const editing = Boolean(block)
  const readOnly = Boolean(block && !isOwnCustomCode(block))
  const [draft, setDraft] = useState<CustomCodeInput>(() => (block ? fromBlock(block) : draftFor(initialKind)))
  const [sampleInput, setSampleInput] = useState(CUSTOM_CODE_KINDS[initialKind].sampleInput)
  const [testResult, setTestResult] = useState<CustomCodeTestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [touched, setTouched] = useState(false)
  // Set when a drag moved the pointer, so the click that ends it doesn't also toggle a grip
  const draggedRef = useRef(false)

  // The test panel under the code: dragged to any height, or shut completely
  const [testOpen, setTestOpen] = useState(() => storedOpen(TEST_OPEN_KEY))
  const [testHeight, setTestHeight] = useState(storedTestHeight)
  const columnRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => storeValue(TEST_HEIGHT_KEY, String(Math.round(testHeight))), [testHeight])
  useEffect(() => storeValue(TEST_OPEN_KEY, testOpen ? '1' : '0'), [testOpen])

  // Drag the line between code and test (or the closed panel's grip): the code shrinks as the
  // panel grows; below half its minimum the panel snaps shut.
  const startTestResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    draggedRef.current = false
    const startY = event.clientY
    const startHeight = testOpen ? testHeight : 0
    const column = columnRef.current?.getBoundingClientRect().height ?? 600
    const max = Math.max(TEST_MIN_HEIGHT, column - CODE_MIN_HEIGHT)
    trackDrag('row-resize', (move) => {
      draggedRef.current = true
      const next = startHeight + startY - move.clientY
      if (next < TEST_MIN_HEIGHT / 2) {
        setTestOpen(false)
        return
      }
      setTestOpen(true)
      setTestHeight(Math.min(max, Math.max(TEST_MIN_HEIGHT, next)))
    })
  }

  // The settings column: dragged by its right edge to any width, or shut completely
  const [settingsOpen, setSettingsOpen] = useState(() => storedOpen(SETTINGS_OPEN_KEY))
  const [settingsWidth, setSettingsWidth] = useState(storedSettingsWidth)
  useEffect(() => storeValue(SETTINGS_WIDTH_KEY, String(Math.round(settingsWidth))), [settingsWidth])
  useEffect(() => storeValue(SETTINGS_OPEN_KEY, settingsOpen ? '1' : '0'), [settingsOpen])
  const startSettingsResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    draggedRef.current = false
    const startX = event.clientX
    const startWidth = settingsOpen ? settingsWidth : 0
    trackDrag('col-resize', (move) => {
      draggedRef.current = true
      const next = startWidth + move.clientX - startX
      if (next < SETTINGS_MIN_WIDTH / 2) {
        setSettingsOpen(false)
        return
      }
      setSettingsOpen(true)
      setSettingsWidth(Math.min(SETTINGS_MAX_WIDTH, Math.max(SETTINGS_MIN_WIDTH, next)))
    })
  }
  /** A grip's click opens its panel, unless the click only ended a drag. */
  const openFromGrip = (open: () => void) => () => {
    if (!draggedRef.current) open()
    draggedRef.current = false
  }
  useEffect(() => {
    const kind = block?.kind ?? initialKind
    setDraft(block ? fromBlock(block) : draftFor(kind))
    setSampleInput(CUSTOM_CODE_KINDS[kind].sampleInput)
    setTestResult(null)
    setTouched(false)
  }, [block, initialKind])

  const patch = (next: Partial<CustomCodeInput>) => setDraft((current) => ({ ...current, ...next }))

  // A new block can still switch kind; it then starts from that kind's template.
  const changeKind = (kind: CustomCodeKind) => {
    if (editing || kind === draft.kind) return
    setDraft((current) => ({ ...draftFor(kind), name: current.name, description: current.description, visibility: current.visibility }))
    setSampleInput(CUSTOM_CODE_KINDS[kind].sampleInput)
    setTestResult(null)
  }

  const nameError = touched ? nameProblem(draft.name) : null
  const schemaError = draft.kind === 'tool' ? jsonProblem(draft.inputSchema) : null
  const sampleError = jsonProblem(sampleInput)

  const save = async () => {
    setTouched(true)
    if (nameProblem(draft.name) || schemaError) return
    setSaving(true)
    try {
      const input = { ...draft, name: draft.name.trim(), description: draft.description.trim() }
      const saved = block ? await updateCustomCode(block.id, input) : await createCustomCode(input)
      toast.success(block ? 'Custom code saved' : `${CUSTOM_CODE_KINDS[draft.kind].label} created`)
      onSaved(saved)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the custom code')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!block || !window.confirm(`Delete “${block.name}”? Workflows that use it will stop working.`)) return
    try {
      await deleteCustomCode(block.id)
      toast.success('Custom code deleted')
      onDeleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the custom code')
    }
  }

  const runTest = async () => {
    if (sampleError) return
    setTesting(true)
    try {
      setTestResult(await testCustomCode(draft, sampleInput.trim() ? JSON.parse(sampleInput) : {}))
    } finally {
      setTesting(false)
    }
  }

  const meta = CUSTOM_CODE_KINDS[draft.kind]

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[hsl(var(--canvas))]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-[hsl(var(--chrome))] px-4 py-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] bg-primary/10 text-primary">
          <meta.icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold text-foreground">
            {editing ? block?.name : `New custom ${meta.label.toLowerCase()}`}
          </h2>
          <p className="truncate text-[11px] text-muted-foreground">
            {readOnly
              ? `By ${block?.ownerEmail || 'another user'} · read-only`
              : 'Python that runs in an isolated sandbox: no access to your keys, the database or other users'}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Settings: resizable by the line on its right edge; closed, a grip with three dots */}
        {!settingsOpen ? (
          <CollapsedGrip
            orientation="vertical"
            label="Show settings"
            onPointerDown={startSettingsResize}
            onOpen={openFromGrip(() => setSettingsOpen(true))}
          />
        ) : (
        <div className="relative flex min-h-0 shrink-0 flex-col border-r border-border" style={{ width: settingsWidth }}>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize settings (double-click to hide)"
            onPointerDown={startSettingsResize}
            onDoubleClick={() => setSettingsOpen(false)}
            className="group/sash absolute inset-y-0 -right-[4px] z-10 w-[6px] cursor-col-resize"
          >
            <span className="absolute inset-y-0 left-[2px] w-[2px] bg-primary opacity-0 transition-opacity delay-150 group-hover/sash:opacity-100 group-active/sash:opacity-100 group-active/sash:delay-0" />
            <SashDots orientation="vertical" />
          </div>
          <div className="scrollbar-subtle min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <Field label="Kind">
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Kind">
                {CUSTOM_CODE_KIND_ORDER.map((kind) => {
                  const item = CUSTOM_CODE_KINDS[kind]
                  const active = draft.kind === kind
                  return (
                    <button
                      key={kind}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={editing && !active}
                      onClick={() => changeKind(kind)}
                      title={item.description}
                      className={cn(
                        'flex items-center gap-1.5 rounded-[3px] border px-2 py-1.5 text-left text-[11.5px] transition-colors',
                        active
                          ? 'border-primary bg-primary/[0.06] text-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                    >
                      <item.icon className={cn('h-3.5 w-3.5 shrink-0', active && 'text-primary')} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{meta.description}</p>
            </Field>

            <Field label="Name">
              <Input
                value={draft.name}
                disabled={readOnly}
                placeholder={draft.kind === 'tool' ? 'get_weather' : 'my_' + draft.kind}
                onChange={(event) => patch({ name: event.target.value })}
                onBlur={() => setTouched(true)}
                className="font-mono text-xs"
              />
              {nameError ? <p className="text-[11px] text-destructive">{nameError}</p> : null}
            </Field>

            <Field label="Description" hint={draft.kind === 'tool' ? 'The model reads this to decide when to call the tool' : undefined}>
              <Textarea
                rows={3}
                value={draft.description}
                disabled={readOnly}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>

            {draft.kind === 'middleware' ? (
              <Field label="Runs around">
                <Select
                  value={draft.middlewareTarget ?? 'chat'}
                  disabled={readOnly}
                  onChange={(event) => patch({ middlewareTarget: event.target.value as MiddlewareTarget })}
                >
                  <option value="agent">The agent's whole turn</option>
                  <option value="chat">Each model call</option>
                  <option value="function">Each tool call</option>
                </Select>
              </Field>
            ) : null}

            {draft.kind === 'skill' ? (
              <Field label="Instructions" hint="Added to the instructions of every agent that uses this skill">
                <Textarea
                  rows={5}
                  value={draft.instructions ?? ''}
                  disabled={readOnly}
                  onChange={(event) => patch({ instructions: event.target.value })}
                />
              </Field>
            ) : null}

            {draft.kind === 'tool' ? (
              <Field label="Input schema" hint="JSON Schema for the arguments the model passes">
                <Textarea
                  rows={8}
                  value={draft.inputSchema ?? ''}
                  disabled={readOnly}
                  onChange={(event) => patch({ inputSchema: event.target.value })}
                  className="font-mono text-xs"
                />
                {schemaError ? <p className="text-[11px] text-destructive">{schemaError}</p> : null}
              </Field>
            ) : null}

            <Field label="Visibility">
              <div className="space-y-1" role="radiogroup" aria-label="Visibility">
                {VISIBILITY.map(({ value, label, hint, icon: Icon, disabled }) => {
                  const active = draft.visibility === value
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={readOnly || disabled}
                      onClick={() => patch({ visibility: value })}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[3px] border px-2.5 py-1.5 text-left transition-colors',
                        active ? 'border-primary bg-primary/[0.06]' : 'border-border hover:border-foreground/25',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="text-[12px] font-medium text-foreground">{label}</span>
                      <span className="ml-auto truncate text-[10.5px] text-muted-foreground">{hint}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>
        )}

        {/* Code (fills the column) and the test panel under it */}
        <div ref={columnRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <PythonCodeEditorField
              value={draft.source}
              onChange={(source) => patch({ source })}
              fileName={`${draft.name.trim() || draft.kind}.py`}
              disabled={readOnly}
              fill
              statusBar
              expandable={false}
              // Edge to edge, like an IDE editor group: no frame around the code
              className="min-h-0 flex-1 rounded-none border-0 focus-within:border-0 focus-within:shadow-none"
            />
          </div>

          {!testOpen ? (
            <CollapsedGrip
              orientation="horizontal"
              label="Show test panel"
              onPointerDown={startTestResize}
              onOpen={openFromGrip(() => setTestOpen(true))}
            />
          ) : (
          <section
            className="relative flex shrink-0 flex-col border-t border-border bg-[hsl(var(--chrome))]"
            style={{ height: testHeight }}
            aria-label="Test"
          >
            {/* Drag to resize; the line lights up like VS Code's sash */}
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize test panel (double-click to hide)"
              onPointerDown={startTestResize}
              onDoubleClick={() => setTestOpen(false)}
              className="group/sash absolute inset-x-0 -top-[3px] z-10 h-[6px] cursor-row-resize"
            >
              <span className="absolute inset-x-0 top-[2px] h-[2px] bg-primary opacity-0 transition-opacity delay-150 group-hover/sash:opacity-100 group-active/sash:opacity-100 group-active/sash:delay-0" />
              <SashDots orientation="horizontal" />
            </div>
            <div className="flex h-9 shrink-0 items-center gap-2 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Test</span>
              {testResult ? (
                <span
                  className={cn(
                    'flex items-center gap-1 text-[10.5px]',
                    testResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400',
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', testResult.ok ? 'bg-emerald-500' : 'bg-amber-500')} aria-hidden />
                  {testResult.ok ? `Passed${testResult.durationMs ? ` in ${testResult.durationMs} ms` : ''}` : 'Failed'}
                </span>
              ) : null}
              <Button
                size="sm"
                className="ml-auto h-6 gap-1.5 rounded-[2px] px-2.5 text-[11px]"
                onClick={() => void runTest()}
                disabled={testing || Boolean(sampleError)}
              >
                {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                Run
              </Button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 border-t border-border md:grid-cols-2">
              <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
                <div className="flex h-7 shrink-0 items-center justify-between px-3 text-[10.5px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">Input</span>
                  <span className={cn('font-mono', sampleError && 'text-destructive')}>{sampleError ? 'Invalid JSON' : 'JSON'}</span>
                </div>
                <textarea
                  value={sampleInput}
                  onChange={(event) => setSampleInput(event.target.value)}
                  aria-label="Sample input (JSON)"
                  spellCheck={false}
                  className="scrollbar-subtle min-h-0 flex-1 resize-none bg-background px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none"
                />
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="flex h-7 shrink-0 items-center px-3 text-[10.5px] font-medium text-foreground/80">Output</div>
                <pre
                  className={cn(
                    'scrollbar-subtle min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-background px-3 py-2 font-mono text-[11px] leading-relaxed',
                    testResult && !testResult.ok ? 'text-amber-700 dark:text-amber-400' : 'text-foreground/80',
                    !testResult && 'text-muted-foreground',
                  )}
                >
                  {testResult
                    ? testResult.ok
                      ? `${JSON.stringify(testResult.output, null, 2)}${testResult.logs ? `\n\n${testResult.logs}` : ''}`
                      : testResult.error
                    : 'Run the code to see its output and logs here.'}
                </pre>
              </div>
            </div>
          </section>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-2.5">
        {editing && !readOnly ? (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-[2px] text-xs text-destructive hover:text-destructive" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 rounded-[2px] text-xs" onClick={onCancel}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {readOnly ? null : (
            <Button size="sm" className="h-8 rounded-[2px] text-xs" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {editing ? 'Save' : 'Create'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
