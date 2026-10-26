import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { errorMessage } from '@/api/config'
import { listPromptRules, savePromptRule, type PromptRule } from '@/api/prompt-rules'
import { EmptyHint, PageBody, PageHeader } from '@/components/admin-center/PageShell'
import { PremiumCard } from '@/components/admin-center/PremiumCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

const TEXTAREA_CLASS =
  'w-full rounded-md border border-input bg-transparent px-2.5 py-2 font-mono text-[11.5px] leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** One "field: Heading" line per required field, in order. */
const fieldsText = (rule: PromptRule) =>
  rule.requiredFields.map((field) => `${field}: ${rule.fieldHeadings[field] ?? field}`).join('\n')

function parseFields(text: string): Pick<PromptRule, 'requiredFields' | 'fieldHeadings'> {
  const entries = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [field, ...heading] = line.split(':')
      return [field.trim(), heading.join(':').trim() || field.trim()] as const
    })
  return { requiredFields: entries.map(([field]) => field), fieldHeadings: Object.fromEntries(entries) }
}

/** One rule, edited and saved on its own. */
function RuleCard({ rule, onSaved }: { rule: PromptRule; onSaved: (rule: PromptRule) => void }) {
  const [fields, setFields] = useState(fieldsText(rule))
  const [suffix, setSuffix] = useState(rule.requiredSuffix)
  const [marker, setMarker] = useState(rule.suffixMarker)
  const [active, setActive] = useState(rule.isActive)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const draft = {
    ...parseFields(fields),
    requiredSuffix: suffix,
    suffixMarker: marker,
    isActive: active,
  }
  const dirty =
    JSON.stringify(draft) !==
    JSON.stringify({
      ...parseFields(fieldsText(rule)),
      requiredSuffix: rule.requiredSuffix,
      suffixMarker: rule.suffixMarker,
      isActive: rule.isActive,
    })

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      onSaved(await savePromptRule(rule.pattern, rule.promptKey, draft))
    } catch (reason) {
      setError(errorMessage(reason, 'Could not save the rule.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PremiumCard className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] font-semibold">{rule.promptKey}</p>
          {rule.description && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{rule.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Switch checked={active} onCheckedChange={setActive} aria-label={`${rule.promptKey} active`} />
            Active
          </label>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[11.5px] font-semibold"
            onClick={() => void save()}
            disabled={busy || !dirty}
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
      {error && (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-3">
        <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
          Required fields — one per line as field: heading (appended under the heading when the prompt leaves it out)
          <textarea
            rows={Math.max(2, fields.split('\n').length)}
            value={fields}
            onChange={(event) => setFields(event.target.value)}
            className={TEXTAREA_CLASS}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
          Required suffix (appended to the prompt; write literal braces as {'{{ }}'})
          <textarea
            rows={suffix ? 10 : 2}
            value={suffix}
            onChange={(event) => setSuffix(event.target.value)}
            className={TEXTAREA_CLASS}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-medium text-muted-foreground">
          Suffix marker (the suffix is skipped when the prompt already contains this text)
          <Input value={marker} onChange={(event) => setMarker(event.target.value)} className="h-8 font-mono text-[12px]" />
        </label>
      </div>
    </PremiumCard>
  )
}

/**
 * Configuration → Prompt rules: how a workflow's custom orchestration prompts are completed
 * before they run (missing ``{fields}``, and required endings such as the progress ledger's JSON).
 */
export function PromptRulesView() {
  const [rules, setRules] = useState<PromptRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    listPromptRules()
      .then((stored) => live && setRules(stored))
      .catch((reason: unknown) => live && setError(errorMessage(reason, 'Could not load the prompt rules.')))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  const patterns = [...new Set(rules.map((rule) => rule.pattern))]

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Prompt rules"
        description="A workflow's custom orchestration prompt replaces the framework's default. These rules add what it must still contain — the fields the framework fills in and required output formats — so runs don't fail to parse."
      />
      <PageBody>
        {error && (
          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11.5px] text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <EmptyHint title="Loading…" hint="Fetching prompt rules." />
        ) : rules.length === 0 ? (
          <EmptyHint title="No prompt rules" hint="Run the database migrations to seed the default rules." />
        ) : (
          patterns.map((pattern) => (
            <section key={pattern} className="mb-6">
              <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pattern}</h2>
              <div className="grid gap-3">
                {rules
                  .filter((rule) => rule.pattern === pattern)
                  .map((rule) => (
                    <RuleCard
                      key={`${rule.id}-${rule.updatedAt}`}
                      rule={rule}
                      onSaved={(saved) => setRules(rules.map((item) => (item.id === saved.id ? saved : item)))}
                    />
                  ))}
              </div>
            </section>
          ))
        )}
      </PageBody>
    </>
  )
}
