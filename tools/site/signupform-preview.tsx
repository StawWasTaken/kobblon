/*
 * The signup form with nothing around it: no router, no AuthProvider.
 *
 * Which is exactly how the Launcher mounts it. Both of those have taken a
 * panel down in an application before - `useAuth` throwing without its
 * provider, and a `<Link>` outside a router - and both are invisible here
 * unless something mounts the form the way an application does. So this
 * page deliberately supplies neither.
 *
 * The two policy links are the thing to look at: with `onPolicy` they are
 * buttons that call back, and without it they are plain addresses rather
 * than routed links.
 */
import { createRoot } from 'react-dom/client'
import { SignupForm } from '@/components/auth/SignupForm'
import '@/index.css'

function Page() {
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-xs text-muted">No router, no provider, no onPolicy</p>
          <div className="w-full max-w-md rounded-2xl border-2 border-white/10 bg-ink-card p-5">
            <SignupForm onSent={() => {}} />
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs text-muted">The same, with onPolicy</p>
          <div className="w-full max-w-md rounded-2xl border-2 border-white/10 bg-ink-card p-5">
            <SignupForm onSent={() => {}} onPolicy={(which) => window.alert(which)} />
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
