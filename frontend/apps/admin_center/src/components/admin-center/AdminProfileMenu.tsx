import { Link } from 'react-router-dom'
import { LogOut, Settings, UserRound } from 'lucide-react'
import { UserAvatar } from '@/components/admin-center/UserAvatar'
import { CURRENT_ADMIN } from '@/components/admin-center/mock-data'
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

export function AdminProfileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-2 rounded-full border border-border/70 bg-card/60 px-2.5 hover:bg-accent/50"
        >
          <UserAvatar name={CURRENT_ADMIN.name} size="sm" variant="brand" online />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-[11.5px] font-semibold leading-none">
              {CURRENT_ADMIN.name}
            </span>
            <span className="mt-1 block truncate text-[10px] leading-none text-muted-foreground">
              {CURRENT_ADMIN.roleLabel}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{APP_NAME} Admin</p>
          <p className="text-xs text-muted-foreground">{CURRENT_ADMIN.email}</p>
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
