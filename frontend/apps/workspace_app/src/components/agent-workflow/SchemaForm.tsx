import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

/**
 * A question's answer form, drawn from its JSON Schema (an ask_user step's `responseSchema`). Each property is
 * one input; `x-widget` (set by the agent that asked, through `form(...)`) picks how it is drawn, else its type
 * does: an `enum` is a radio list (a select when long), a boolean a toggle, an array of choices checkboxes.
 */

export interface FormField {
  type?: string
  title?: string
  description?: string
  enum?: string[]
  items?: { type?: string; enum?: string[] }
  format?: string
  'x-widget'?: string
}

export interface FormSchema {
  properties?: Record<string, FormField>
  required?: string[]
}

type Widget = 'text' | 'textarea' | 'radio' | 'select' | 'checkboxes' | 'toggle' | 'number' | 'date'

function widgetOf(field: FormField): Widget {
  const hinted = field['x-widget']
  if (hinted === 'textarea' || hinted === 'radio' || hinted === 'select' || hinted === 'checkboxes' || hinted === 'toggle') return hinted
  if (field.type === 'boolean') return 'toggle'
  if (field.type === 'number' || field.type === 'integer') return 'number'
  if (field.type === 'array') return 'checkboxes'
  if (field.format === 'date') return 'date'
  if (field.enum?.length) return field.enum.length > 6 ? 'select' : 'radio'
  return 'text'
}

function filled(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null
}

const INPUT =
  'w-full rounded border border-border bg-background px-2 py-1.5 text-[12px] outline-none focus:border-foreground/30 disabled:opacity-60'

export function SchemaForm({
  schema,
  busy = false,
  submitLabel = 'Send answer',
  onSubmit,
}: {
  schema: FormSchema | null | undefined
  busy?: boolean
  submitLabel?: string
  onSubmit: (answer: Record<string, unknown>) => void
}) {
  const fields = Object.entries(schema?.properties ?? { text: { type: 'string', 'x-widget': 'textarea' } })
  const required = new Set(schema?.properties ? (schema.required ?? []) : ['text'])
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.filter(([, field]) => widgetOf(field) === 'toggle').map(([name]) => [name, false])),
  )
  const set = (name: string, value: unknown) => setValues((previous) => ({ ...previous, [name]: value }))
  const ready = fields.every(([name]) => !required.has(name) || filled(values[name]))
  const single = fields.length === 1

  const submit = () => {
    const answer = Object.fromEntries(
      fields
        .filter(([name]) => filled(values[name]))
        .map(([name, field]) => [name, widgetOf(field) === 'number' ? Number(values[name]) : typeof values[name] === 'string' ? (values[name] as string).trim() : values[name]]),
    )
    onSubmit(answer)
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) submit()
      }}
    >
      {fields.map(([name, field]) => {
        const widget = widgetOf(field)
        const label = field.title || (single ? '' : name.replace(/_/g, ' '))
        const options = field.enum ?? field.items?.enum ?? []
        const id = `form-${name}`
        return (
          <fieldset key={name} className="space-y-1.5" disabled={busy}>
            {label && widget !== 'toggle' ? (
              <legend className="mb-1 text-[12px] font-medium text-foreground">
                {label}
                {required.has(name) ? <span className="text-muted-foreground"> *</span> : null}
              </legend>
            ) : null}
            {field.description ? <p className="text-[11px] text-muted-foreground">{field.description}</p> : null}

            {widget === 'radio' ? (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label || name}>
                {options.map((option) => {
                  const active = values[name] === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => set(name, option)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11.5px] transition-colors',
                        active ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground hover:border-foreground/40',
                      )}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            ) : widget === 'checkboxes' ? (
              <div className="grid gap-1">
                {options.map((option) => {
                  const chosen = Array.isArray(values[name]) ? (values[name] as string[]) : []
                  return (
                    <label key={option} className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-foreground"
                        checked={chosen.includes(option)}
                        onChange={(event) => set(name, event.target.checked ? [...chosen, option] : chosen.filter((item) => item !== option))}
                      />
                      {option}
                    </label>
                  )
                })}
              </div>
            ) : widget === 'select' ? (
              <select id={id} className={INPUT} value={String(values[name] ?? '')} onChange={(event) => set(name, event.target.value)}>
                <option value="" disabled>
                  Choose…
                </option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : widget === 'toggle' ? (
              <label className="flex cursor-pointer items-center justify-between gap-3 text-[12px] text-foreground">
                <span>
                  {label}
                  {required.has(name) ? <span className="text-muted-foreground"> *</span> : null}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(values[name])}
                  onClick={() => set(name, !values[name])}
                  className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', values[name] ? 'bg-foreground' : 'bg-muted-foreground/30')}
                >
                  <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-[left]', values[name] ? 'left-[18px]' : 'left-0.5')} />
                </button>
              </label>
            ) : widget === 'textarea' ? (
              <textarea
                id={id}
                rows={single ? 2 : 3}
                className={cn(INPUT, 'resize-none')}
                value={String(values[name] ?? '')}
                onChange={(event) => set(name, event.target.value)}
                placeholder={single ? 'Your answer' : ''}
                aria-label={label || name}
              />
            ) : (
              <input
                id={id}
                type={widget === 'number' ? 'number' : widget === 'date' ? 'date' : 'text'}
                className={INPUT}
                value={String(values[name] ?? '')}
                onChange={(event) => set(name, event.target.value)}
                aria-label={label || name}
              />
            )}
          </fieldset>
        )
      })}
      <Button type="submit" size="sm" className="h-7 text-[11.5px]" disabled={busy || !ready}>
        {submitLabel}
      </Button>
    </form>
  )
}
