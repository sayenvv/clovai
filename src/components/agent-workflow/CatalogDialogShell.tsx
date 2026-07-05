import { memo, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface CatalogDialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: ReactNode
  title: string
  description: string
  count: number
  countLabel?: string
  query: string
  onQueryChange: (value: string) => void
  searchPlaceholder: string
  filters?: ReactNode
  children: ReactNode
}

/** Shared searchable catalog dialog layout (agent store, workflow library). */
export const CatalogDialogShell = memo(function CatalogDialogShell({
  open,
  onOpenChange,
  icon,
  title,
  description,
  count,
  countLabel = 'items',
  query,
  onQueryChange,
  searchPlaceholder,
  filters,
  children,
}: CatalogDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">{description}</DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 tabular-nums">
              {count} {countLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-9"
            />
          </div>
          {filters}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
})
