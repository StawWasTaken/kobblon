/* An ad slot with nothing in it, in the three shapes a page can hold. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { EmptySlot } from '@/components/ads/AdBanner'
import { AD_SIZES } from '@/lib/ads'
import '@/index.css'

const frameFor = (size: string) => ({
  maxWidth: AD_SIZES[size].w,
  aspectRatio: `${AD_SIZES[size].w} / ${AD_SIZES[size].h}`,
})

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <EmptySlot wide frame={frameFor('banner')} />
        <div className="flex items-start gap-8">
          <EmptySlot wide={false} frame={frameFor('tall')} />
          <EmptySlot wide={false} frame={frameFor('box')} />
        </div>
      </div>
    </div>
  </MemoryRouter>,
)
