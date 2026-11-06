/* Staw's playing mark, beside the numbers it will sit with. */
import { createRoot } from 'react-dom/client'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons'
import '@/index.css'

function Row({ size, cls }: { size: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-3 font-bold text-muted ${size}`}>
      <span className="inline-flex items-center gap-1">
        <Glyph icon={faThumbsUp} className="text-[10px]" />
        94%
      </span>
      <span className="inline-flex items-center gap-1 text-space-bright">
        <Icon name="playing" className={cls} />
        8.8K
      </span>
    </span>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-10 text-white">
    <div className="flex items-center gap-6">
      <Icon name="playing" className="h-10 w-10" />
      <Icon name="playing" className="h-6 w-6 text-space-bright" />
      <Icon name="playing" className="h-4 w-4 text-muted" />
    </div>
    <div><Row size="text-[11px]" cls="h-3 w-3" /></div>
    <div><Row size="text-xs" cls="h-3.5 w-3.5" /></div>
  </div>,
)
