import { memo, useState } from 'react'
import { CheckCircle2, Circle, Loader2, Pencil, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/utils/format'
import {
  useActivateConfig,
  useConfigList,
  useDeleteConfig,
} from '@/hooks/use-config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ConfigRecordSummary } from '@/types/config'

interface ConfigListProps {
  onEdit: (id: string) => void
  onFeedback: (message: string, isError?: boolean) => void
}

const ConfigRow = memo(function ConfigRow({
  record,
  onEdit,
  onFeedback,
}: {
  record: ConfigRecordSummary
  onEdit: (id: string) => void
  onFeedback: ConfigListProps['onFeedback']
}) {
  const activate = useActivateConfig()
  const remove = useDeleteConfig()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const handleActivate = () => {
    activate.mutate(record.id, {
      onSuccess: () => onFeedback(`"${record.name}" v${record.version} is now the active configuration.`),
      onError: (error) => onFeedback(error.message, true),
    })
  }

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      setTimeout(() => setConfirmingDelete(false), 3000)
      return
    }
    remove.mutate(record.id, {
      onSuccess: () => onFeedback(`Deleted "${record.name}" v${record.version}.`),
      onError: (error) => onFeedback(error.message, true),
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/25 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {record.isActive ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label="Active" />
        ) : (
          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/40" aria-hidden />
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{record.name}</span>
            <Badge variant="secondary" className="tabular-nums">
              v{record.version}
            </Badge>
            {record.isActive && <Badge variant="success">Active</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDateTime(record.createdAt)} · Updated {formatDateTime(record.updatedAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {!record.isActive && (
          <Button size="sm" variant="outline" onClick={handleActivate} disabled={activate.isPending}>
            {activate.isPending ? <Loader2 className="animate-spin" /> : null}
            Activate
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEdit(record.id)} aria-label={`Edit ${record.name}`}>
          <Pencil />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={record.isActive || remove.isPending}
          aria-label={`Delete ${record.name}`}
          className={confirmingDelete ? 'text-destructive hover:text-destructive' : undefined}
        >
          {remove.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {confirmingDelete && 'Confirm?'}
        </Button>
      </div>
    </div>
  )
})

/** All stored configuration versions with activate / edit / delete actions. */
export const ConfigList = memo(function ConfigList({ onEdit, onFeedback }: ConfigListProps) {
  const { data: records, isPending } = useConfigList()

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!records?.length) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No configurations saved yet. Upload a JSON file to get started.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {records.map((record) => (
        <ConfigRow key={record.id} record={record} onEdit={onEdit} onFeedback={onFeedback} />
      ))}
    </div>
  )
})
