import { Link } from 'react-router-dom'
import {
  Bell,
  CreditCard,
  ShieldAlert,
  UserPlus,
  Workflow,
  Zap,
} from 'lucide-react'
import {
  ADMIN_NOTIFICATIONS,
  type AdminNotificationKind,
} from '@/components/admin-center/mock-data'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROUTES } from '@/constants'
import { cn } from '@/utils/cn'

const NOTIFICATION_ICON: Record<AdminNotificationKind, typeof Bell> = {
  run: Workflow,
  security: ShieldAlert,
  invite: UserPlus,
  system: Zap,
  billing: CreditCard,
}

export function AdminNotificationsMenu() {
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
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
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
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
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
                        item.unread
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground',
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
