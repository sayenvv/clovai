import { memo, useEffect, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Moon, Settings, Sun, Workflow } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTES } from '@/constants'
import { logout } from '@/services/project-auth-store'
import { ensureTokenUsage, readTokenUsage, refreshTokenUsage, subscribeTokenUsage } from '@/services/token-usage-store'
import { cn } from '@/utils/cn'

interface ProfileMenuProps {
  showSignOut?: boolean
  userInitials?: string
  userLabel?: string
  /** Dropdown placement — use `right` / `start` in a left sidebar rail. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  triggerClassName?: string
  avatarSize?: 'xs' | 'sm' | 'md'
  /** The workspace's settings, listed in the menu (the editor has no separate settings button). */
  settings?: {
    onOpenWorkflowSettings?: () => void
    canvasView?: {
      showGrid: boolean
      onShowGridChange: (on: boolean) => void
      snapToGrid: boolean
      onSnapToGridChange: (on: boolean) => void
      showMap?: boolean
      onShowMapChange?: (on: boolean) => void
    }
  }
}

const ITEM = 'h-7 gap-2 rounded-[2px] py-0 text-[11.5px] [&_svg]:!h-3.5 [&_svg]:!w-3.5 [&_svg]:text-primary'
const CHECK_ITEM = 'h-7 rounded-[2px] py-0 text-[11.5px] [&_svg]:text-primary'
const LABEL = 'px-2 pb-0.5 pt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'

/** Profile menu — letter avatar trigger with theme toggle and navigation. */
export const ProfileMenu = memo(function ProfileMenu({
  showSignOut = false,
  userInitials = 'Y',
  userLabel,
  side = 'bottom',
  align = 'end',
  triggerClassName,
  avatarSize = 'sm',
  settings,
}: ProfileMenuProps) {
  const { theme, toggleTheme } = useTheme()
  // The label is "email" or "email · Admin"
  const [email, role] = (userLabel ?? '').split(' · ')
  const isAdmin = role === 'Admin'
  const usage = useSyncExternalStore(subscribeTokenUsage, readTokenUsage, () => null)
  const plan = usage?.planName

  useEffect(() => {
    if (userLabel) void ensureTokenUsage()
  }, [userLabel])

  return (
    // The plan can change on the server (an upgrade, an admin): read it again whenever the menu opens
    <DropdownMenu onOpenChange={(open) => open && userLabel && void refreshTokenUsage()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8 rounded-full p-0', triggerClassName)}
          aria-label="Open profile menu"
        >
          <UserAvatar seed="profile" initials={userInitials} size={avatarSize} ringClassName="ring-0" />
        </Button>
      </DropdownMenuTrigger>
      {/* In the workspace style: square corners, compact rows, orange icons, caps section labels */}
      <DropdownMenuContent side={side} align={align} sideOffset={8} className="w-60 rounded-[3px] p-1">
        {userLabel && (
          <>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <UserAvatar seed="profile" initials={userInitials} size="sm" ringClassName="ring-0" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-foreground">{email}</p>
                <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {isAdmin ? 'Admin' : 'Member'}
                  {plan ? (
                    <span
                      className={cn(
                        'rounded-[2px] border px-1 py-px tracking-[0.08em]',
                        plan.toLowerCase() === 'free' ? 'border-border text-muted-foreground' : 'border-primary/40 bg-primary/10 text-primary',
                      )}
                    >
                      {plan}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {settings?.onOpenWorkflowSettings ? (
          <DropdownMenuItem className={ITEM} onSelect={() => settings.onOpenWorkflowSettings?.()}>
            <Workflow />
            Workflow settings…
          </DropdownMenuItem>
        ) : null}
        {settings?.canvasView ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={LABEL}>Canvas</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className={CHECK_ITEM}
              checked={settings.canvasView.showGrid}
              onCheckedChange={(checked) => settings.canvasView?.onShowGridChange(checked === true)}
              onSelect={(event) => event.preventDefault()}
            >
              Show grid
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className={CHECK_ITEM}
              checked={settings.canvasView.snapToGrid}
              onCheckedChange={(checked) => settings.canvasView?.onSnapToGridChange(checked === true)}
              onSelect={(event) => event.preventDefault()}
            >
              Snap to grid
            </DropdownMenuCheckboxItem>
            {settings.canvasView.onShowMapChange ? (
              <DropdownMenuCheckboxItem
                className={CHECK_ITEM}
                checked={settings.canvasView.showMap ?? true}
                onCheckedChange={(checked) => settings.canvasView?.onShowMapChange?.(checked === true)}
                onSelect={(event) => event.preventDefault()}
              >
                Show map
              </DropdownMenuCheckboxItem>
            ) : null}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className={LABEL}>Appearance</DropdownMenuLabel>
        <DropdownMenuItem className={ITEM} onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={ITEM}>
          <Link to={ROUTES.workspaceSettings()}>
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        {showSignOut && (
          <DropdownMenuItem
            className={cn(ITEM, 'text-red-600 focus:text-red-600 dark:text-red-400 [&_svg]:!text-red-600 dark:[&_svg]:!text-red-400')}
            onSelect={() => {
              logout()
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
