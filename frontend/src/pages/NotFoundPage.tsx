import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants'

export default function NotFoundPage() {
  return (
    <div className="container flex flex-col items-center justify-center gap-5 py-32 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Compass className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or was moved.
        </p>
      </div>
      <Button asChild>
        <Link to={ROUTES.home}>Back to home</Link>
      </Button>
    </div>
  )
}
