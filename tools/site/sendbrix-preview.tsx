/*
 * The Send Brix popup on its own, so the arithmetic line can be looked at
 * without a session and a friend to send to.
 *
 * It belongs to the website rather than to the Workspace, so it is mounted
 * with the providers the website gives it. The share is read from the
 * database on open; with nobody signed in that read fails and the popup
 * falls back to the five per cent it is told to assume, which is the state
 * worth seeing drawn as much as the happy one.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { AuthProvider } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { SendBrixDialog } from '@/components/social/SendBrixDialog'
import '@/index.css'

function Alone() {
  const [open, setOpen] = useState(true)
  return (
    <div className="min-h-screen bg-ink p-6">
      <SendBrixDialog
        open={open}
        onClose={() => setOpen(false)}
        to="22222222-2222-2222-2222-222222222222"
        name="A Normal Person"
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider><ToastProvider><Alone /></ToastProvider></AuthProvider>,
)
