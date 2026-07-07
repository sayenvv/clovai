import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Home, Moon, Sun } from 'lucide-react'
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

const PROFILE_INITIALS = 'Y'

/** Profile menu — letter avatar trigger with theme toggle and navigation. */
export const ProfileMenu = memo(function ProfileMenu() {
  const { theme, toggleTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full p-0" aria-label="Open menu">
          <UserAvatar seed="profile" initials={PROFILE_INITIALS} size="sm" ringClassName="ring-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
