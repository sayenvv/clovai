import { memo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Field, PanelSection } from '@/components/agent-workflow/FormField'
import { DEFAULT_HTTP_TOOL, type HttpToolConfig } from '@/types/agent-workflow'
import { cn } from '@/utils/cn'

const METHODS: HttpToolConfig['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function jsonError(text: string | undefined): string | null {
  if (!text?.trim()) return null
  try {
    JSON.parse(text)
    return null
  } catch {
    return 'Not valid JSON yet.'
  }
}

function seconds(value: string): number | undefined {
  const number = Number(value)
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : undefined
}

/**
 * An HTTP tool's request, its key and, for a long-running job, how to wait for it. The backend sends the
 * request; `{{ args.<name> }}` fills in what the model passes.
 */
export const HttpToolSettings = memo(function HttpToolSettings({
  http = DEFAULT_HTTP_TOOL,
  onChange,
}: {
  http?: HttpToolConfig
  onChange: (http: HttpToolConfig) => void
}) {
  const update = (patch: Partial<HttpToolConfig>) => onChange({ ...http, ...patch })
  const sendsBody = http.method !== 'GET' && http.method !== 'DELETE'

  return (
    <>
      <PanelSection title="Request">
        <Field label="URL" hint="Use {{ args.<name> }} for an argument, such as …/orders/{{ args.orderId }}">
          <div className="flex gap-1.5">
            <Select
              className="w-[96px] shrink-0 font-mono text-xs"
              value={http.method}
              onChange={(event) => update({ method: event.target.value as HttpToolConfig['method'] })}
              aria-label="Method"
            >
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </Select>
            <Input
              className="font-mono text-xs"
              value={http.url}
              onChange={(event) => update({ url: event.target.value })}
              placeholder="https://api.example.com/orders/{{ args.orderId }}"
            />
          </div>
        </Field>
        <JsonField label="Headers" hint='A JSON object, such as {"Accept": "application/json"}' value={http.headers} onChange={(headers) => update({ headers })} placeholder='{ "Accept": "application/json" }' />
        <JsonField label="Query parameters" hint="A JSON object; values may use {{ args.<name> }}" value={http.query} onChange={(query) => update({ query })} placeholder='{ "status": "{{ args.status }}" }' />
        {sendsBody ? (
          <JsonField label="Body" hint="JSON sent as the request body" value={http.body} onChange={(body) => update({ body })} placeholder='{ "orderId": "{{ args.orderId }}" }' rows={5} />
        ) : null}
        <Field label="Timeout (seconds)" hint="For each request, up to 120">
          <Input
            type="number"
            min={1}
            max={120}
            value={http.timeoutSeconds ?? ''}
            placeholder="30"
            onChange={(event) => update({ timeoutSeconds: seconds(event.target.value) })}
          />
        </Field>
      </PanelSection>

      <PanelSection title="Authentication">
        <Field label="Type">
          <Select
            value={http.authVariable !== undefined ? (http.authType ?? 'bearer') : ''}
            onChange={(event) =>
              event.target.value
                ? update({ authType: event.target.value as HttpToolConfig['authType'], authVariable: http.authVariable ?? '' })
                : update({ authType: undefined, authVariable: undefined, authHeader: undefined })
            }
          >
            <option value="">None</option>
            <option value="bearer">Bearer token</option>
            <option value="header">API key header</option>
            <option value="basic">Basic (user:password)</option>
          </Select>
        </Field>
        {http.authVariable !== undefined ? (
          <>
            <Field label="Secret variable" hint="The name of a secret in Settings → Variables. The key is read when the call is made and never saved in the workflow.">
              <Input
                className="font-mono text-xs"
                value={http.authVariable}
                onChange={(event) => update({ authVariable: event.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                placeholder="ORDERS_API_KEY"
              />
            </Field>
            {http.authType === 'header' ? (
              <Field label="Header name">
                <Input className="font-mono text-xs" value={http.authHeader ?? ''} onChange={(event) => update({ authHeader: event.target.value })} placeholder="X-Api-Key" />
              </Field>
            ) : null}
          </>
        ) : null}
      </PanelSection>

      <PanelSection title="Long-running job">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={Boolean(http.longRunning)}
            onChange={(event) => update({ longRunning: event.target.checked })}
          />
          <span>
            <span className="font-medium text-foreground">Wait for the job to finish</span>
            <span className="block text-muted-foreground">
              The request starts a job; the tool checks its status until it is done, then returns the result.
            </span>
          </span>
        </label>
        <div className={cn('space-y-4', !http.longRunning && 'hidden')}>
          <Field label="Status URL" hint="Empty: the Location header of a 202 reply. {{ start.body.<field> }} reads the first reply, such as a job id.">
            <Input
              className="font-mono text-xs"
              value={http.statusUrl ?? ''}
              onChange={(event) => update({ statusUrl: event.target.value })}
              placeholder="https://api.example.com/jobs/{{ start.body.jobId }}"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Check every (s)">
              <Input type="number" min={1} value={http.intervalSeconds ?? ''} placeholder="5" onChange={(event) => update({ intervalSeconds: seconds(event.target.value) })} />
            </Field>
            <Field label="Give up after (s)">
              <Input type="number" min={1} max={1800} value={http.jobTimeoutSeconds ?? ''} placeholder="600" onChange={(event) => update({ jobTimeoutSeconds: seconds(event.target.value) })} />
            </Field>
          </div>
          <Field label="Done when" hint="Empty: when the status stops answering 202. Reads response.status and response.body.">
            <Input className="font-mono text-xs" value={http.doneWhen ?? ''} onChange={(event) => update({ doneWhen: event.target.value })} placeholder="{{ response.body.state == 'succeeded' }}" />
          </Field>
          <Field label="Failed when" hint="Optional">
            <Input className="font-mono text-xs" value={http.failedWhen ?? ''} onChange={(event) => update({ failedWhen: event.target.value })} placeholder="{{ response.body.state == 'failed' }}" />
          </Field>
          <Field label="Result" hint="Optional: what to return once done. Empty: the status reply's body.">
            <Input className="font-mono text-xs" value={http.result ?? ''} onChange={(event) => update({ result: event.target.value })} placeholder="{{ response.body.output }}" />
          </Field>
        </div>
      </PanelSection>
    </>
  )
})

function JsonField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  hint: string
  value?: string
  onChange: (value: string) => void
  placeholder: string
  rows?: number
}) {
  const error = jsonError(value)
  return (
    <Field label={label} hint={hint}>
      <Textarea rows={rows} className="font-mono text-xs" value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} />
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </Field>
  )
}
