/*
 * The toast in the corner, over a page, in whichever theme the root is set
 * to.
 *
 * One pane and not two side by side, which was the first attempt and was
 * wrong twice over: the toast is `fixed`, so both panes' toasts land in the
 * same corner of the window, and the theme variables are declared on
 * `:root`, so `data-theme` on a div inside the page changes nothing at all.
 * The theme is flipped on `document.documentElement` instead, which is what
 * the site itself does.
 */
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import '@/index.css'

function Shout() {
  const say = useToast()
  useEffect(() => {
    say('Saved as a draft.', 'success')
    say('That did not work.', 'error')
    say('It is up on Home.', 'info')
  }, [say])
  return (
    <Card className="space-y-3 p-5">
      <p className="font-display text-lg font-extrabold">A page behind it</p>
      <p className="text-sm text-muted">
        The toast arrives over whatever is here and leaves on its own.
      </p>
      <Button variant="yes" onClick={() => say('Said again.', 'success')}>Say it again</Button>
    </Card>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-6">
    <ToastProvider>
      <Shout />
    </ToastProvider>
  </div>,
)
