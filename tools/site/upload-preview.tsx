/*
 * The upload popup with nothing around it.
 *
 * Mounted the way Kobblon Workspace mounts it: no AuthProvider, no toast, no
 * WorkingAs, and a profile named rather than looked up. If this page renders,
 * the seam holds; if it throws, the popup has quietly grown a dependency on
 * the website again.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { UploadDialog } from '@/components/create/UploadDialog'
import '@/index.css'

function Alone() {
  const [open, setOpen] = useState(true)
  return (
    <div className="min-h-screen bg-ink p-6">
      <UploadDialog
        open={open}
        onClose={() => setOpen(false)}
        onUploaded={() => setOpen(false)}
        uploadAs={{ profileId: '11111111-1111-1111-1111-111111111111' }}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Alone />)
