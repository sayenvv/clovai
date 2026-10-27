import { memo } from 'react'
import { Code2, History, House, Plus, Server, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ADMIN_CENTER_URL, APP_NAME, DASHBOARD_TAB_LINK } from '@/constants'
import { useSession } from '@/hooks/use-session'
import type { CanvasViewSettings } from '@/components/agent-workflow/SettingsMenu'
import { ProfileMenu } from '@/components/shared/ProfileMenu'
import { AdminBadge } from '@/components/shared/AdminBadge'
import { cn } from '@/utils/cn'

export type AppRailView = 'editor' | 'executions' | 'configuration' | 'deployments' | 'code' | 'settings'

interface WorkspaceAppRailProps {
  view: AppRailView
  onViewChange: (view: AppRailView) => void
  /** Opens the block library (the rail's "+"). */
  onAddBlocks: () => void
  addBlocksOpen?: boolean
  onAskAi?: () => void
  onNavigateHome?: () => void
  /** Listed in the profile menu at the bottom. */
  onOpenSettings?: () => void
  canvasView?: CanvasViewSettings
}

function RailTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="px-2 py-1 text-xs font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

const ITEM =
  'relative flex h-8 w-8 items-center justify-center rounded-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

function RailItem({
  label,
  icon: Icon,
  active = false,
  onClick,
  href,
  newTab = false,
}: {
  label: string
  icon: LucideIcon
  active?: boolean
  onClick?: () => void
  href?: string
  newTab?: boolean
}) {
  const className = cn(
    ITEM,
    active ? 'bg-accent text-foreground' : 'text-foreground/85 hover:bg-white/10 hover:text-foreground',
  )
  const content = <Icon className="h-4 w-4" strokeWidth={1.75} />
  return (
    <RailTip label={label}>
      {href ? (
        <a href={href} aria-label={label} className={className} {...(newTab ? DASHBOARD_TAB_LINK : {})}>
          {content}
        </a>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={className}>
          {content}
        </button>
      )}
    </RailTip>
  )
}

/**
 * The narrow deep-blue rail down the left edge: the logo, add blocks and Workflow AI, then the
 * workspace's areas (editor, runs, configuration, deployments), links out, then help and the account.
 */
export const WorkspaceAppRail = memo(function WorkspaceAppRail({
  view,
  onViewChange,
  onAddBlocks,
  addBlocksOpen = false,
  onAskAi,
  onNavigateHome,
  onOpenSettings,
  canvasView,
}: WorkspaceAppRailProps) {
  const session = useSession()
  const isAdmin = session?.accessRole === 'admin'
  const email = session?.email ?? ''

  return (
    <nav
      aria-label="Workspace"
      className="rail-surface relative z-50 flex h-full w-10 shrink-0 flex-col items-center gap-1.5 bg-background py-2"
    >
      <TooltipProvider delayDuration={200}>
        <RailTip label={`${APP_NAME} home`}>
          <button
            type="button"
            onClick={onNavigateHome}
            aria-label={`${APP_NAME} home`}
            className="mb-3 mt-1 flex h-8 w-8 items-center justify-center rounded-[3px] hover:bg-white/10"
          >
            <img src="/brand/mark-white.svg" alt="" className="h-5 w-5" />
          </button>
        </RailTip>

        <RailTip label={addBlocksOpen ? 'Close blocks' : 'Add blocks'}>
          <button
            type="button"
            onClick={onAddBlocks}
            aria-label="Add blocks"
            aria-pressed={addBlocksOpen}
            className={cn(ITEM, 'text-[#FFE6CF] hover:bg-white/10')}
          >
            <Plus className={cn('h-5 w-5 transition-transform', addBlocksOpen && 'rotate-45')} strokeWidth={2} />
          </button>
        </RailTip>
        {onAskAi ? (
          <RailTip label="Ask Workflow AI">
            <button type="button" onClick={onAskAi} aria-label="Ask Workflow AI" className={cn(ITEM, 'hover:bg-white/10')}>
              <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[#FFC83D] text-[#3B2A00]">
                <Sparkles className="h-3 w-3" strokeWidth={2.25} />
              </span>
            </button>
          </RailTip>
        ) : null}

        <div className="my-2 h-px w-5 bg-white/20" aria-hidden />

        <RailItem label="Workspace" icon={House} active={view === 'editor'} onClick={() => onViewChange('editor')} />
        <RailItem label="Executions" icon={History} active={view === 'executions'} onClick={() => onViewChange('executions')} />
        <RailItem label="Configuration" icon={SlidersHorizontal} active={view === 'configuration'} onClick={() => onViewChange('configuration')} />
        <RailItem label="Deployments" icon={Server} active={view === 'deployments'} onClick={() => onViewChange('deployments')} />
        <RailItem label="Custom code" icon={Code2} active={view === 'code'} onClick={() => onViewChange('code')} />

        <div className="my-2 h-px w-5 bg-white/20" aria-hidden />

        {isAdmin ? <RailItem label="Admin Center" icon={ShieldCheck} href={ADMIN_CENTER_URL} newTab /> : null}

        {/* The signed-in account; settings open from its menu */}
        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="relative" title={email ? (isAdmin ? `${email} · Admin` : email) : 'Profile'}>
            <ProfileMenu
              showSignOut={Boolean(session)}
              userInitials={(email || 'U').slice(0, 1).toUpperCase()}
              userLabel={email ? `${email}${isAdmin ? ' · Admin' : ''}` : undefined}
              side="right"
              align="end"
              avatarSize="xs"
              triggerClassName="h-6 w-6 hover:bg-white/10"
              settings={{ onOpenWorkflowSettings: onOpenSettings, canvasView }}
            />
            <AdminBadge show={isAdmin} />
          </div>
        </div>
      </TooltipProvider>
    </nav>
  )
})
