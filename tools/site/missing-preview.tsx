/*
 * Staw's mark at the sizes it actually gets used at.
 *
 * It stands in for every picture on the site now, from a 24px avatar in a
 * chat row to a page-wide banner, so the only honest check is the whole
 * range at once: the mark is a share of its box and the cap stops it
 * becoming the furniture on a big one.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { Avatar } from '@/components/ui/Avatar'
import { Emblem } from '@/components/community/Emblem'
import { Picture } from '@/components/brand/Picture'

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-6">
      <h2 className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted">{title}</h2>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </section>
  )
}

function Page() {
  return (
    <div className="min-h-screen bg-ink text-ink-text">
      <Row title="Avatars, every size">
        {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
          <Avatar key={size} name="Staw" size={size} />
        ))}
        <Avatar name="Gone" size="xl" unavailable />
      </Row>
      <Row title="Emblems">
        <Emblem name="Kobblon" className="h-10 w-10" />
        <Emblem name="Kobblon" className="h-16 w-16" rounded="rounded-2xl" />
      </Row>
      <Row title="A cover, and one that will not load">
        <Picture src={null} alt="No cover" className="aspect-[16/10] w-72 rounded-2xl border border-ink-line" />
        <Picture src="/nothing-here.png" alt="Broken" why="This picture could not load" className="aspect-[16/10] w-72 rounded-2xl border border-ink-line" />
      </Row>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
