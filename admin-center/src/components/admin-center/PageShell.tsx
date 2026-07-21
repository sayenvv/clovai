import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CreditCard,
  LogOut,
  Settings,
  ShieldAlert,
  UserPlus,
  UserRound,
  Workflow,
  Zap,
} from 'lucide-react'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import {
  ADMIN_NOTIFICATIONS,
  type AdminNotificationKind,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_NAME, MAIN_APP_URL, ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'relative z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-xl',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 truncate text-[11.5px] leading-none text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <span className="mx-1 hidden h-6 w-px bg-border/60 md:block" aria-hidden />
        <AdminNotificationsMenu />
        <ThemeToggle />
        <AdminProfileMenu />
      </div>
    </header>
  )
}

export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)}>{children}</div>
}

export function EmptyHint({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

const NOTIFICATION_ICON: Record<
  AdminNotificationKind,
  typeof Bell
> = {
  run: Workflow,
  security: ShieldAlert,
  invite: UserPlus,
  system: Zap,
  billing: CreditCard,
}

function AdminNotificationsMenu() {
  const unreadCount = ADMIN_NOTIFICATIONS.filter((item) => item.unread).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3.5 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-muted-foreground"
            asChild
          >
            <Link to={ROUTES.activity}>View all</Link>
          </Button>
        </div>
        <div className="max-h-[22rem] overflow-y-auto py-1">
          {ADMIN_NOTIFICATIONS.map((item) => {
            const Icon = NOTIFICATION_ICON[item.kind]
            return (
              <DropdownMenuItem
                key={item.id}
                className="cursor-pointer items-start gap-3 rounded-none px-3.5 py-2.5 focus:bg-accent/60"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-border/60',
                    item.unread
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted/50 text-muted-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-[12.5px] leading-snug',
                        item.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
                      )}
                    >
                      {item.title}
                    </span>
                    {item.unread && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {item.body}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground/80">
                    {item.at}
                  </span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AdminProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-2 rounded-full border border-border/70 bg-card/60 px-2.5 hover:bg-accent/50"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[11px] font-semibold text-primary-foreground">
            AS
            <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-card bg-emerald-500" />
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-[11.5px] font-semibold leading-none">Aanya Sharma</span>
            <span className="mt-1 block truncate text-[10px] leading-none text-muted-foreground">
              Owner
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{APP_NAME} Admin</p>
          <p className="text-xs text-muted-foreground">aanya@elevennodes.dev</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={ROUTES.settings} className="cursor-pointer">
            <Settings className="mr-2 h-3.5 w-3.5" />
            Preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={MAIN_APP_URL} className="cursor-pointer">
            <UserRound className="mr-2 h-3.5 w-3.5" />
            Back to {APP_NAME}
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={MAIN_APP_URL} className="cursor-pointer text-muted-foreground">
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
