import { memo, useEffect, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Field } from '@/components/agent-workflow/FormField'
import {
  VARIABLE_NAME_PATTERN,
  type EnvVariable,
  type EnvVariableInput,
} from '@/services/variables-api'

const EMPTY: EnvVariableInput = { name: '', description: '', secret: true, value: '', scope: 'user' }

/** Add or edit an environment variable. Secret values are sent once and never shown again. */
export const VariableDialog = memo(function VariableDialog({
  open,
  onOpenChange,
  variable,
  onSave,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The variable being edited; none to add one. */
  variable?: EnvVariable | null
  onSave: (input: EnvVariableInput, id?: string) => Promise<EnvVariable>
  /** Prefill for a new variable, e.g. a suggested name. */
  defaults?: Partial<EnvVariableInput>
}) {
  const [form, setForm] = useState<EnvVariableInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [reveal, setReveal] = useState(false)
  const editing = Boolean(variable)

  useEffect(() => {
    if (!open) return
    setReveal(false)
    setForm(
      variable
        ? {
            name: variable.name,
            description: variable.description,
            secret: variable.secret,
            value: variable.secret ? '' : (variable.value ?? ''),
            scope: variable.scope,
          }
        : { ...EMPTY, ...defaults },
    )
    // `defaults` is read once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, variable])

  const set = (patch: Partial<EnvVariableInput>) => setForm((previous) => ({ ...previous, ...patch }))
  const nameValid = VARIABLE_NAME_PATTERN.test(form.name)
  // A stored secret can be kept by leaving the value empty.
  const keepsSecret = editing && variable?.secret && form.secret && variable.hasValue
  const missing = !nameValid || (!keepsSecret && !form.value?.length)

  const submit = async () => {
    setSaving(true)
    try {
      await onSave(form, variable?.id)
      toast.success(editing ? 'Variable updated' : 'Variable saved')
      onOpenChange(false)
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not save the variable.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit variable' : 'Add variable'}</DialogTitle>
          <DialogDescription>
            Refer to it by name from models and tools. Secret values are stored encrypted and never shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <Field
            label="Name"
            hint={form.name && !nameValid ? 'Use capitals, digits and underscores, e.g. OPENAI_API_KEY' : undefined}
          >
            <Input
              value={form.name}
              onChange={(event) => set({ name: event.target.value.toUpperCase().replace(/[\s-]+/g, '_') })}
              placeholder="OPENAI_API_KEY"
              className="font-mono text-xs"
              autoFocus={!editing}
            />
          </Field>
          <Field
            label="Value"
            hint={keepsSecret ? 'A value is saved. Leave empty to keep it.' : form.secret ? 'Sent once, stored encrypted.' : undefined}
          >
            <div className="relative">
              <Input
                type={form.secret && !reveal ? 'password' : 'text'}
                autoComplete="new-password"
                value={form.value ?? ''}
                onChange={(event) => set({ value: event.target.value })}
                placeholder={keepsSecret ? '••••••••••••' : form.secret ? 'sk-…' : 'https://…'}
                className="pr-9 font-mono text-xs"
              />
              {form.secret ? (
                <button
                  type="button"
                  onClick={() => setReveal((value) => !value)}
                  aria-label={reveal ? 'Hide value' : 'Show value'}
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              ) : null}
            </div>
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(event) => set({ description: event.target.value })}
              placeholder="Production OpenAI key"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
            <span>
              <span className="block text-[12.5px] font-medium text-foreground">Secret</span>
              <span className="block text-[11px] text-muted-foreground">Hide the value after saving</span>
            </span>
            <Switch checked={form.secret} onCheckedChange={(secret) => set({ secret })} />
          </label>
          <Field label="Visible to">
            <Select value={form.scope} onChange={(event) => set({ scope: event.target.value as EnvVariableInput['scope'] })}>
              <option value="user">Only me</option>
              <option value="workspace">Everyone in this workspace</option>
            </Select>
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || missing} onClick={() => void submit()}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {editing ? 'Save changes' : 'Save variable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})
