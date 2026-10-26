import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AdminAuthGate } from '@/hooks/use-admin-auth'
import { ApplicationProvider } from '@/hooks/use-application'
import { ThemeProvider } from '@/hooks/use-theme'
import { router } from '@/routes'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Sign-in first: the providers below call admin-only APIs as soon as they mount */}
      <AdminAuthGate>
        <ApplicationProvider>
          <RouterProvider router={router} />
        </ApplicationProvider>
      </AdminAuthGate>
    </ThemeProvider>
  </StrictMode>,
)
