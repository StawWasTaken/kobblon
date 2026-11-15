/*
 * A picture drawn inside the writing, with nothing around the box.
 *
 * `pictures_by_name` has no `inline` row on it yet, so the website itself
 * has nothing to draw - this hands the box its own resolver, which is the
 * same prop the Launcher will pass for its GIFs and its own emoji. What is
 * being checked is the mechanism: the token becomes a picture, the writing
 * read back out of the box is still the token, and the caret counts the
 * token's characters rather than the picture's zero.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { WritingBox } from '@/components/chat/WritingBox'
import { runsOf } from '@/lib/rich'
import type { PictureAt } from '@/lib/rich'
import '@/index.css'

const TOKEN = /^:(kob|brix):/

const pictures: PictureAt = (input, at) => {
  if (input[at] !== ':') return null
  const hit = TOKEN.exec(input.slice(at))
  if (!hit) return null
  return {
    length: hit[0].length,
    url: hit[1] === 'kob' ? '/brand/logomark.png' : '/brand/brix.png',
    alt: hit[1],
  }
}

function Page() {
  const [value, setValue] = useState('look at **this** :kob: and :brix: in a sentence')
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <div className="max-w-xl space-y-4">
        <p className="text-xs text-muted">The box, with its own picture resolver</p>
        <div className="rounded-xl border-2 border-ink-line bg-ink-card p-3">
          <WritingBox id="demo" value={value} onChange={setValue} pictures={pictures} />
        </div>

        <p className="text-xs text-muted">What the box reports as the writing</p>
        <pre className="whitespace-pre-wrap rounded-xl border-2 border-ink-line bg-ink-card p-3 text-xs">
          {JSON.stringify(value)}
        </pre>

        <p className="text-xs text-muted">The same text as a sent message</p>
        <div className="rounded-xl border-2 border-ink-line bg-ink-card p-3 text-sm">
          {runsOf(value, pictures).map((run, at) => (run.picture ? (
            <img
              key={at}
              src={run.picture.url}
              alt={run.picture.alt}
              className="inline-block h-[1.35em] w-auto -mt-[0.2em] align-middle"
            />
          ) : (
            <span
              key={at}
              className={run.marks.includes('bold') ? 'font-bold' : undefined}
            >
              {run.text}
            </span>
          )))}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
