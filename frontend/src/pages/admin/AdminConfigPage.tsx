import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { APP_NAME } from '@/constants'
import {
  Download,
  Eye,
  FilePlus2,
  Loader2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { validateAppConfig, type ValidationResult } from '@/schemas/config.schema'
import { defaultAppConfig } from '@/config/default-config'
import { useConfigById, useSaveConfig, useUpdateConfig } from '@/hooks/use-config'
import type { AppConfig } from '@/types/config'
import { downloadJson } from '@/utils/download'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { UploadDropzone } from './UploadDropzone'
import { JsonEditor } from './JsonEditor'
import { ValidationPanel } from './ValidationPanel'
import { ConfigPreview } from './ConfigPreview'
import { ConfigList } from './ConfigList'

function parseAndValidate(jsonText: string): ValidationResult {
  try {
    return validateAppConfig(JSON.parse(jsonText))
  } catch (error) {
    return {
      success: false,
      issues: [
        {
          path: '(root)',
          message: `Invalid JSON: ${error instanceof Error ? error.message : 'could not parse'}`,
        },
      ],
    }
  }
}

export default function AdminConfigPage() {
  const [jsonText, setJsonText] = useState('')
  const [configName, setConfigName] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const saveMutation = useSaveConfig()
  const updateMutation = useUpdateConfig()
  const { data: editingRecord } = useConfigById(editingId)

  useEffect(() => {
    document.title = `Configuration Console — ${APP_NAME}`
  }, [])

  // When an existing configuration is chosen for editing, load it into the editor.
  useEffect(() => {
    if (editingRecord) {
      setJsonText(JSON.stringify(editingRecord.config, null, 2))
      setConfigName(editingRecord.name)
      setValidation(null)
      toast.info(`Loaded "${editingRecord.name}" v${editingRecord.version} into the editor.`)
    }
  }, [editingRecord])

  const validConfig: AppConfig | null = useMemo(
    () => (validation?.success && validation.data ? validation.data : null),
    [validation],
  )

  const handleFileRead = useCallback((content: string, fileName: string) => {
    setJsonText(content)
    setEditingId(null)
    setConfigName(fileName.replace(/\.json$/i, ''))
    setValidation(parseAndValidate(content))
  }, [])

  const handleValidate = () => {
    const result = parseAndValidate(jsonText)
    setValidation(result)
    if (result.success) toast.success('Configuration is valid.')
    else toast.error(`Found ${result.issues.length} validation issue(s).`)
  }

  const handlePreview = () => {
    const result = parseAndValidate(jsonText)
    setValidation(result)
    if (result.success) setPreviewOpen(true)
    else toast.error('Fix validation issues before previewing.')
  }

  const handleSave = () => {
    const result = parseAndValidate(jsonText)
    setValidation(result)
    if (!result.success || !result.data) {
      toast.error('Cannot save an invalid configuration.')
      return
    }
    const name = configName.trim() || result.data.meta.name

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, config: result.data, name },
        {
          onSuccess: (record) => toast.success(`Updated "${record.name}" (v${record.version}).`),
          onError: (error) => toast.error(error.message),
        },
      )
    } else {
      saveMutation.mutate(
        { name, config: result.data },
        {
          onSuccess: (record) => {
            toast.success(`Saved "${record.name}" as version ${record.version}.`)
            setEditingId(record.id)
          },
          onError: (error) => toast.error(error.message),
        },
      )
    }
  }

  const loadSample = () => {
    setJsonText(JSON.stringify(defaultAppConfig, null, 2))
    setConfigName('My custom config')
    setEditingId(null)
    setValidation(null)
    toast.info('Sample configuration loaded — edit it and save as a new version.')
  }

  const downloadSample = () => {
    downloadJson(defaultAppConfig, 'clovai-sample-config.json')
  }

  const isSaving = saveMutation.isPending || updateMutation.isPending

  return (
    <div className="container max-w-6xl py-12 md:py-16">
      <header className="mb-10">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Configuration Console</h1>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Upload, validate and version the JSON that drives the entire UI. Only one configuration is
          active at a time — activating a version applies it to the whole site instantly.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <section className="flex flex-col gap-5" aria-label="Configuration editor">
          <UploadDropzone onFileRead={handleFileRead} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="config-name">Configuration name</Label>
            <Input
              id="config-name"
              value={configName}
              onChange={(event) => setConfigName(event.target.value)}
              placeholder="e.g. Spring launch config"
            />
          </div>

          <JsonEditor value={jsonText} onChange={setJsonText} />

          {validation && <ValidationPanel result={validation} />}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleValidate} disabled={!jsonText.trim()}>
              <ShieldCheck /> Validate
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={!jsonText.trim()}>
              <Eye /> Preview
            </Button>
            <Button variant="gradient" onClick={handleSave} disabled={!jsonText.trim() || isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {editingId ? 'Update configuration' : 'Save to database'}
            </Button>
            {editingId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null)
                  setJsonText('')
                  setConfigName('')
                  setValidation(null)
                }}
              >
                <FilePlus2 /> New
              </Button>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-label="Saved configurations">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Saved configurations
            </h2>
            <Badge variant="outline" className="font-normal">
              One active at a time
            </Badge>
          </div>

          <ConfigList
            onEdit={setEditingId}
            onFeedback={(message, isError) => (isError ? toast.error(message) : toast.success(message))}
          />

          <div className="mt-2 rounded-xl border border-dashed bg-muted/30 p-5">
            <h3 className="text-sm font-semibold">Need a starting point?</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Load the current default configuration into the editor, tweak it, then save it as a new
              version — or download it as a file to edit locally.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={loadSample}>
                <FilePlus2 /> Load sample
              </Button>
              <Button size="sm" variant="ghost" onClick={downloadSample}>
                <Download /> Download JSON
              </Button>
            </div>
          </div>
        </section>
      </div>

      <ConfigPreview config={validConfig} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  )
}
