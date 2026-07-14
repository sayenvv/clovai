import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Home, LogOut, Moon, Sun } from 'lucide-react'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { useTheme } from '@/hooks/use-theme'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_NAME } from '@/constants'
import { logout } from '@/services/project-auth-store'
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
}

/** Profile menu — letter avatar trigger with theme toggle and navigation. */
export const ProfileMenu = memo(function ProfileMenu({
  showSignOut = false,
  userInitials = 'Y',
  userLabel,
  side = 'bottom',
  align = 'end',
  triggerClassName,
  avatarSize = 'sm',
}: ProfileMenuProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <DropdownMenu>
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
      <DropdownMenuContent side={side} align={align} sideOffset={8} className="w-56">
        {userLabel && (
          <>
            <div className="px-2 py-1.5">
              <p className="truncate text-xs text-muted-foreground">{userLabel}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">
            <Home />
            Back to {APP_NAME}
          </Link>
        </DropdownMenuItem>
        {showSignOut && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                logout()
              }}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
