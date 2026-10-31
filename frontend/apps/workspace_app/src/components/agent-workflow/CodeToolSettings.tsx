import { memo, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { CheckCircle2, Loader2, Play, Save, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import {
  checkCode,
  getCodeTool,
  listCodeTools,
  runCode,
  sandboxStatus,
  saveCodeTool,
  type CodeRunResult,
  type CodeTool,
  type SandboxStatus,
} from '@/services/code-tools-api'
import { cn } from '@/utils/cn'

const TEMPLATE = `def run(text: str, times: int = 1):
    """Repeat the text. The agent passes the arguments; return JSON values (dict, list, str, number)."""
    return {"result": text * times}
`

const SANDBOX_LABEL: Record<SandboxStatus['sandbox'], string> = {
  docker: 'a fresh container (no network)',
  hyperlight: 'a Hyperlight micro-VM',
  local: 'a local process (development only)',
  off: 'nowhere: code tools are off',
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text || '{}') as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Arguments to try the code with: each of `run`'s parameters, empty. */
function exampleArguments(schema: Record<string, unknown>): string {
  const properties = (schema.properties ?? {}) as Record<string, { type?: string }>
  const blank: Record<string, unknown> = {}
  for (const [name, property] of Object.entries(properties)) {
    blank[name] = property.type === 'integer' || property.type === 'number' ? 0 : property.type === 'boolean' ? false : property.type === 'array' ? [] : property.type === 'object' ? {} : ''
  }
  return JSON.stringify(blank, null, 2)
}

/** Tab indents with four spaces instead of leaving the editor. */
function indentOnTab(event: KeyboardEvent<HTMLTextAreaElement>, onChange: (value: string) => void) {
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  const area = event.currentTarget
  const { selectionStart: start, selectionEnd: end, value } = area
  onChange(`${value.slice(0, start)}    ${value.slice(end)}`)
  requestAnimationFrame(() => area.setSelectionRange(start + 4, start + 4))
}

/**
 * A code tool's Python: written here, saved to the backend (`/code-tools`) and named by the workflow as
 * `codeToolId`. Every run, here or by an agent, happens in the server's sandbox, never in the browser.
 */
export const CodeToolSettings = memo(function CodeToolSettings({
  codeToolId,
  name,
  description,
  inputSchemaText,
  onLinked,
}: {
  codeToolId?: string
  name: string
  description: string
  inputSchemaText?: string
  onLinked: (codeToolId: string) => void
}) {
  const [source, setSource] = useState(TEMPLATE)
  const [savedSource, setSavedSource] = useState<string | null>(null)
  const [timeoutSeconds, setTimeoutSeconds] = useState(30)
  const [argsText, setArgsText] = useState('{\n  "text": "hi",\n  "times": 2\n}')
  const [result, setResult] = useState<CodeRunResult | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<'run' | 'save' | 'check' | null>(null)
  const [sandbox, setSandbox] = useState<SandboxStatus | null>(null)
  const [saved, setSaved] = useState<CodeTool[]>([])

  useEffect(() => {
    void sandboxStatus().then(setSandbox).catch(() => setSandbox(null))
    void listCodeTools().then(setSaved).catch(() => setSaved([]))
  }, [])

  useEffect(() => {
    if (!codeToolId) {
      setSavedSource(null)
      return
    }
    let cancelled = false
    getCodeTool(codeToolId)
      .then((tool) => {
        if (cancelled) return
        setSource(tool.source ?? '')
        setSavedSource(tool.source ?? '')
        setTimeoutSeconds(tool.timeoutSeconds)
        setArgsText(exampleArguments(tool.inputSchema))
      })
      .catch((error: unknown) => !cancelled && setProblem(error instanceof Error ? error.message : String(error)))
    return () => {
      cancelled = true
    }
  }, [codeToolId])

  const args = useMemo(() => parseObject(argsText), [argsText])
  const dirty = savedSource === null || source !== savedSource
  const maxTimeout = sandbox?.maxTimeoutSeconds ?? 600

  const attempt = async (kind: 'run' | 'save' | 'check', action: () => Promise<void>) => {
    setBusy(kind)
    setProblem(null)
    try {
      await action()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(null)
    }
  }

  const check = () =>
    attempt('check', async () => {
      const { inputSchema } = await checkCode(source)
      setArgsText(exampleArguments(inputSchema))
      setResult(null)
    })

  const run = () =>
    attempt('run', async () => {
      setResult(await runCode(source, args ?? {}, timeoutSeconds))
    })

  const save = () =>
    attempt('save', async () => {
      // Only a JSON Schema of run's arguments is sent; a placeholder such as {"input": "string"} is not one
      const parsed = inputSchemaText?.trim() ? parseObject(inputSchemaText) : null
      const schema = parsed && parsed.type === 'object' && parsed.properties && typeof parsed.properties === 'object' ? parsed : null
      const tool = await saveCodeTool(
        { name: name.trim() || 'code_tool', description, source, timeoutSeconds, ...(schema ? { inputSchema: schema } : {}) },
        codeToolId,
      )
      setSavedSource(tool.source ?? source)
      setSaved((previous) => [...previous.filter((item) => item.id !== tool.id), tool].sort((a, b) => a.name.localeCompare(b.name)))
      if (tool.id !== codeToolId) onLinked(tool.id)
    })

  return (
    <>
      <PanelSection title="Code">
        {saved.length > 0 ? (
          <Field label="Saved code tool" hint="Use one you already wrote, or write a new one below">
            <Select value={codeToolId ?? ''} onChange={(event) => event.target.value && onLinked(event.target.value)}>
              <option value="">{codeToolId ? 'Unknown tool' : 'New code tool…'}</option>
              {saved.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field
          label="Python"
          hint="Define run(...) with named arguments. The agent calls it; what it returns goes back to the model, print() goes to the log."
        >
          <Textarea
            rows={14}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            onKeyDown={(event) => indentOnTab(event, setSource)}
            aria-label="Python source"
          />
        </Field>

        <Field label="Timeout" hint={`Seconds before a call is stopped (at most ${maxTimeout})`}>
          <Input
            type="number"
            min={1}
            max={maxTimeout}
            value={timeoutSeconds}
            onChange={(event) => setTimeoutSeconds(Math.max(1, Math.min(maxTimeout, Number(event.target.value) || 1)))}
            className="w-24"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="h-7 gap-1 text-[11.5px]" disabled={busy !== null || !dirty} onClick={() => void save()}>
            {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {codeToolId ? 'Save changes' : 'Save tool'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11.5px]" disabled={busy !== null} onClick={() => void check()}>
            {busy === 'check' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Check
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {!codeToolId ? 'Not saved yet: the agent can use it once saved.' : dirty ? 'Unsaved changes.' : 'Saved.'}
          </span>
        </div>
        {problem ? <p className="text-[11px] text-destructive">{problem}</p> : null}
      </PanelSection>

      <PanelSection title="Try it">
        <Field label="Arguments" hint="JSON passed to run(...)">
          <Textarea
            rows={4}
            spellCheck={false}
            className="font-mono text-xs"
            value={argsText}
            onChange={(event) => setArgsText(event.target.value)}
            aria-invalid={args === null}
          />
          {args === null ? <p className="text-[11px] text-destructive">Arguments must be a JSON object.</p> : null}
        </Field>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-[11.5px]"
            disabled={busy !== null || args === null || sandbox?.available === false}
            onClick={() => void run()}
          >
            {busy === 'run' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          {sandbox ? (
            <span className={cn('flex items-center gap-1 text-[11px]', sandbox.available ? 'text-muted-foreground' : 'text-destructive')}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {sandbox.available ? `Runs in ${SANDBOX_LABEL[sandbox.sandbox]}` : sandbox.reason}
            </span>
          ) : null}
        </div>
        {result ? (
          <div
            className={cn(
              'space-y-1.5 rounded-md border p-2.5 text-[11.5px]',
              result.ok ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-red-500/30 bg-red-500/[0.05]',
            )}
          >
            <p className="flex items-center gap-1 font-medium text-foreground">
              {result.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
              {result.ok ? 'Returned' : result.timedOut ? 'Stopped at the timeout' : `Failed${result.line ? ` on line ${result.line}` : ''}`}
              <span className="ml-auto font-normal tabular-nums text-muted-foreground">{result.durationMs} ms</span>
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
              {result.ok ? JSON.stringify(result.result, null, 2) : result.error}
            </pre>
            {result.logs ? (
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all border-t pt-1.5 font-mono text-[11px] text-muted-foreground">
                {result.logs}
              </pre>
            ) : null}
          </div>
        ) : null}
      </PanelSection>
    </>
  )
})
