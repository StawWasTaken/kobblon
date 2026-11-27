/*
 * The toy box: a proposal, not a page.
 *
 * Three drawings in one file - the landing page, the logged-in Home and
 * Get Kobblon - built on one small set of tokens at the top so that the
 * whole feel moves from one place. Nothing here is wired to the site; it
 * exists to be looked at and argued with.
 *
 * The rule the drawings follow: a panel is an object lying on a table,
 * not a window into software. Thick stroke, a solid coloured lip under
 * it, and something sticking out over the edge so no shape reads as a
 * rectangle a machine drew.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'

const TOKENS = `
:root {
  --sky: #d8e9ff;
  --cloud: #f3f8ff;
  --paper: #ffffff;
  --ink: #15183a;
  --stroke: #15183a;
  --blue: #1b34e8;
  --blue-deep: #122295;
  --orange: #ff7a1a;
  --orange-deep: #c25400;
  --grass: #2ecc63;
  --grass-deep: #1b8f42;
  --purple: #7b3fe4;
  --purple-deep: #54269f;
  --gold: #f5b21a;
  --gold-deep: #b87d00;
  --red: #e33b2e;
  --red-deep: #a32317;
  --lip: 6px;
  --stroke-w: 3px;
  --r: 18px;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, system-ui, sans-serif; color: var(--ink); background: var(--sky); }
.tb-display { font-family: 'bd-gravel-vf', Inter, sans-serif; font-weight: 900; letter-spacing: -0.02em; line-height: 0.95; }

/* A frame is the one shape everything is made of. */
.tb-frame {
  background: var(--cloud);
  border: var(--stroke-w) solid var(--stroke);
  border-radius: var(--r);
  box-shadow: 0 var(--lip) 0 0 var(--col, var(--blue)), 0 var(--lip) 0 var(--stroke-w) var(--stroke);
  position: relative;
}
.tb-frame.paper { background: var(--paper); }

/* Pressable: squish down onto the lip, spring back. */
.tb-press {
  border: var(--stroke-w) solid var(--stroke);
  border-radius: 999px;
  background: var(--col, var(--blue));
  color: #fff;
  font: 800 16px Inter, sans-serif;
  padding: 12px 24px;
  cursor: pointer;
  box-shadow: 0 var(--lip) 0 0 var(--deep, var(--blue-deep)), 0 var(--lip) 0 var(--stroke-w) var(--stroke);
  transition: transform 180ms cubic-bezier(.3,1.6,.5,1), box-shadow 180ms cubic-bezier(.3,1.6,.5,1);
}
.tb-press:active {
  transform: translateY(var(--lip));
  box-shadow: 0 0 0 0 var(--deep), 0 0 0 var(--stroke-w) var(--stroke);
  transition-duration: 60ms;
}
.tb-press.big { font-size: 22px; padding: 18px 38px; --lip: 8px; }
.tb-press.quiet { background: var(--paper); color: var(--ink); --deep: #c3d4ea; }

/* A sticker breaks out over an edge and never sits in the grid. */
.tb-sticker { position: absolute; pointer-events: none; filter: drop-shadow(0 3px 0 rgba(0,0,0,.18)); }
@keyframes tb-float { 0%,100% { transform: translateY(0) rotate(var(--t,0deg)); } 50% { transform: translateY(-7px) rotate(var(--t,0deg)); } }
.tb-float { animation: tb-float 4s ease-in-out infinite; }
.tb-wig { transition: transform 160ms ease; }
.tb-wig:hover { transform: rotate(var(--t,0deg)) scale(1.03) translateY(-3px); }
@media (prefers-reduced-motion: reduce) { .tb-float { animation: none; } .tb-wig { transition: none; } }

.tb-badge {
  display: inline-block; border: var(--stroke-w) solid var(--stroke); border-radius: 999px;
  background: var(--col, var(--gold)); color: #fff; font: 900 13px Inter, sans-serif;
  padding: 5px 14px; text-transform: uppercase; letter-spacing: .04em;
  box-shadow: 0 3px 0 0 var(--stroke);
}
.tb-mark { /* marker underline under a heading */
  background-image: linear-gradient(var(--col, var(--blue)), var(--col, var(--blue)));
  background-size: 100% 8px; background-repeat: no-repeat; background-position: 0 92%;
  border-radius: 2px; padding: 0 4px;
}
.tb-wave { display: block; width: 100%; height: 56px; }
.tb-studs { background-image: radial-gradient(circle at 10px 10px, rgba(21,24,58,.10) 5px, transparent 6px); background-size: 28px 28px; }
.tb-shelf { display: flex; gap: 18px; flex-wrap: wrap; }
.tb-pic { border: var(--stroke-w) solid var(--stroke); border-radius: 14px; object-fit: cover; display: block; }
`

function Wave({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div style={{ background: top, lineHeight: 0 }}>
      <svg className="tb-wave" viewBox="0 0 1200 56" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30 C 150 0, 250 56, 400 30 S 650 0, 800 30 S 1050 56, 1200 24 L1200 56 L0 56 Z" fill={bottom} />
      </svg>
    </div>
  )
}

function Sticker({ src, size = 86, turn = -8, style, float = true }: {
  src: string; size?: number; turn?: number; style?: React.CSSProperties; float?: boolean
}) {
  return (
    <img
      src={src} alt="" aria-hidden="true" width={size} height={size}
      className={`tb-sticker${float ? ' tb-float' : ''}`}
      style={{ ['--t' as string]: `${turn}deg`, transform: `rotate(${turn}deg)`, ...style }}
    />
  )
}

/* ---------------------------------------------------------------- landing */

function Landing() {
  return (
    <div>
      <div style={{ background: 'var(--sky)', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/brand/wordmark-lightmode.png" alt="kobblon" style={{ height: 42 }} />
        <div style={{ flex: 1 }} />
        <button className="tb-press quiet">Log in</button>
        <button className="tb-press" style={{ ['--col' as string]: 'var(--grass)', ['--deep' as string]: 'var(--grass-deep)' }}>Sign up!</button>
      </div>

      <div style={{ background: 'var(--sky)', padding: '10px 28px 70px', position: 'relative', overflow: 'hidden' }}>
        <Sticker src="/stickers/plunk/excited.png" size={104} turn={-12} style={{ left: '1%', bottom: 40 }} />
        <Sticker src="/stickers/plunk/smug.png" size={84} turn={14} style={{ right: '4%', top: 10 }} />
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 34, alignItems: 'center' }}>
          <div>
            <h1 className="tb-display" style={{ fontSize: 68, margin: '18px 0 10px' }}>
              People build things <span className="tb-mark">here!</span>
            </h1>
            <p style={{ fontSize: 22, fontWeight: 600, margin: '0 0 26px', maxWidth: 440 }}>
              Then they stand inside them. With their friends. It is free!
            </p>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button className="tb-press big" style={{ ['--col' as string]: 'var(--grass)', ['--deep' as string]: 'var(--grass-deep)' }}>Make an account!</button>
              <a href="#" style={{ fontWeight: 700, color: 'var(--blue-deep)' }}>Look around first!</a>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div className="tb-frame tb-wig" style={{ ['--col' as string]: 'var(--red)', ['--t' as string]: '-2deg', transform: 'rotate(-2deg)', padding: 10 }}>
              <img className="tb-pic" src="/brand/landing-towers.webp" alt="" style={{ width: '100%', height: 300 }} />
              <div style={{ position: 'absolute', right: -26, bottom: -22 }}>
                <button className="tb-press" style={{ ['--col' as string]: 'var(--red)', ['--deep' as string]: 'var(--red-deep)', borderRadius: 999, width: 92, height: 92, fontSize: 20 }}>play!</button>
              </div>
            </div>
            <Sticker src="/mascot/newbie.png" size={96} turn={9} style={{ left: -34, bottom: -34 }} />
          </div>
        </div>
      </div>

      <Wave top="var(--sky)" bottom="#fff5d6" />
      <div style={{ background: '#fff5d6', padding: '30px 28px 50px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 18 }}>
          {[
            { tag: 'BUILD!', col: 'var(--grass)', deep: 'var(--grass-deep)', line: 'Drag bricks about until it is a place. No course to finish first.', shift: 0 },
            { tag: 'MEET!', col: 'var(--gold)', deep: 'var(--gold-deep)', line: 'Your friends walk in and say something stupid. That is the whole product.', shift: 60 },
            { tag: 'SHARE!', col: 'var(--blue)', deep: 'var(--blue-deep)', line: 'Put it out. Real people play it. No bots. None!', shift: 24 },
          ].map(r => (
            <div key={r.tag} className="tb-frame paper tb-wig" style={{ ['--col' as string]: r.deep, marginLeft: r.shift, padding: '16px 20px', display: 'flex', gap: 18, alignItems: 'center', maxWidth: 760 }}>
              <span className="tb-badge" style={{ ['--col' as string]: r.col, fontSize: 16, padding: '9px 18px' }}>{r.tag}</span>
              <span style={{ fontWeight: 600, fontSize: 17 }}>{r.line}</span>
            </div>
          ))}
        </div>
      </div>

      <Wave top="#fff5d6" bottom="var(--sky)" />
      <div className="tb-studs" style={{ background: 'var(--sky)', padding: '36px 28px 70px' }}>
        <h2 className="tb-display" style={{ fontSize: 40, textAlign: 'center', margin: '0 0 28px' }}>
          <span className="tb-mark" style={{ ['--col' as string]: 'var(--purple)' }}>Worlds people made!</span>
        </h2>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 26, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {[
            { art: '/brand/banner2.png', name: 'Crossroads, again', t: -3, w: 330, h: 210, col: 'var(--blue)' },
            { art: '/brand/landing-interior.png', name: 'Someone’s kitchen', t: 2, w: 270, h: 180, col: 'var(--orange)' },
            { art: '/about/towers-sunset.webp', name: 'The quiet one', t: -1, w: 300, h: 240, col: 'var(--grass)' },
          ].map(w => (
            <div key={w.name} className="tb-frame tb-wig" style={{ ['--col' as string]: w.col, ['--t' as string]: `${w.t}deg`, transform: `rotate(${w.t}deg)`, padding: 9, width: w.w }}>
              <img className="tb-pic" src={w.art} alt="" style={{ width: '100%', height: w.h }} />
              <div className="tb-display" style={{ fontSize: 20, padding: '9px 4px 3px' }}>{w.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- home */

const TABS = [
  { name: 'Home', col: 'var(--blue)', icon: '/icons/ui/overview.png' },
  { name: 'Avatar', col: 'var(--orange)', icon: '/icons/ui/avatar.png' },
  { name: 'Friends', col: 'var(--grass)', icon: '/icons/ui/people.png' },
  { name: 'Library', col: 'var(--purple)', icon: '/icons/ui/assets.png' },
  { name: 'Klub', col: 'var(--gold)', icon: '/icons/ui/klub.png' },
]

function Home() {
  return (
    <div style={{ background: 'var(--sky)', minHeight: 900 }}>
      <div style={{ background: 'var(--blue)', borderBottom: '3px solid var(--stroke)', padding: '12px 22px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <img src="/brand/wordmark.png" alt="kobblon" style={{ height: 34 }} />
        <div className="tb-frame paper" style={{ ['--col' as string]: 'var(--blue-deep)', ['--lip' as string]: '4px', flex: 1, maxWidth: 420, padding: '8px 16px', fontWeight: 600, color: '#6b7390' }}>Find a World!</div>
        <div style={{ flex: 1 }} />
        <span className="tb-badge" style={{ ['--col' as string]: 'var(--gold)' }}>1 240 brix</span>
        <img src="/brand/guest.png" alt="" style={{ height: 40, width: 40, borderRadius: 10, border: '3px solid var(--stroke)', background: '#fff' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '216px 1fr', gap: 26, padding: '26px 24px 60px', maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {TABS.map((t, i) => (
            <button key={t.name} className="tb-press tb-wig" style={{
              ['--col' as string]: i === 0 ? t.col : 'var(--paper)',
              ['--deep' as string]: i === 0 ? 'var(--blue-deep)' : '#c3d4ea',
              ['--t' as string]: `${i % 2 ? 1.5 : -1.5}deg`,
              color: i === 0 ? '#fff' : 'var(--ink)',
              borderRadius: 16, transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`,
              display: 'flex', alignItems: 'center', gap: 11, justifyContent: 'flex-start', fontSize: 17,
            }}>
              <img src={t.icon} alt="" style={{ height: 24, width: 24, filter: i === 0 ? 'brightness(0) invert(1)' : 'brightness(0)' }} />
              {t.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <h1 className="tb-display" style={{ fontSize: 46, margin: 0 }}>Welcome back, staw!</h1>
            <span style={{ fontWeight: 600, opacity: .7 }}>Still up?</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 22, alignItems: 'start' }}>
            <div className="tb-frame" style={{ ['--col' as string]: 'var(--blue)', padding: 12, position: 'relative' }}>
              <span className="tb-badge" style={{ ['--col' as string]: 'var(--red)', position: 'absolute', top: -14, left: 18, transform: 'rotate(-3deg)' }}>keep going</span>
              <img className="tb-pic" src="/brand/landing-interior.png" alt="" style={{ width: '100%', height: 220 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px 2px' }}>
                <div>
                  <div className="tb-display" style={{ fontSize: 24 }}>Kobbleston Towers</div>
                  <div style={{ fontWeight: 600, opacity: .7, fontSize: 14 }}>you left a wall half built</div>
                </div>
                <div style={{ flex: 1 }} />
                <button className="tb-press" style={{ ['--col' as string]: 'var(--grass)', ['--deep' as string]: 'var(--grass-deep)' }}>Open it!</button>
              </div>
            </div>

            <div className="tb-frame paper" style={{ ['--col' as string]: 'var(--gold)', padding: 16, position: 'relative' }}>
              <Sticker src="/stickers/plunk/determined.png" size={64} turn={12} style={{ right: -22, top: -26 }} />
              <div className="tb-display" style={{ fontSize: 24, marginBottom: 10 }}>Quests</div>
              {[['Visit a World you have never been in', true], ['Say hello to somebody', false], ['Put one brick down', false]].map(([q, done]) => (
                <div key={q as string} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: '2px dashed #d7e2f3', fontWeight: 600, fontSize: 14 }}>
                  <span style={{
                    width: 20, height: 20, flex: '0 0 20px', borderRadius: 6, border: '3px solid var(--stroke)',
                    background: done ? 'var(--grass)' : '#fff',
                  }} />
                  <span style={{ opacity: done ? .55 : 1, textDecoration: done ? 'line-through' : 'none' }}>{q as string}</span>
                </div>
              ))}
              <button className="tb-press" style={{ ['--col' as string]: 'var(--gold)', ['--deep' as string]: 'var(--gold-deep)', width: '100%', marginTop: 14 }}>Claim 50 brix!</button>
            </div>
          </div>

          <div className="tb-frame paper" style={{ ['--col' as string]: 'var(--grass)', padding: '14px 18px 22px' }}>
            <div className="tb-display" style={{ fontSize: 26, marginBottom: 6 }}>Who is about!</div>
            <div className="tb-shelf" style={{ alignItems: 'flex-end', paddingTop: 14, justifyContent: 'space-between' }}>
              {[
                { n: 'plunk', s: 'in Crossroads', t: -4, on: true, face: '/stickers/plunk/excited.png' },
                { n: 'mira', s: 'building', t: 3, on: true, face: '/stickers/plunk/determined.png' },
                { n: 'tog', s: 'last seen 2h', t: -2, on: false, face: '/stickers/plunk/relieved.png' },
                { n: 'bee', s: 'in a kitchen', t: 5, on: true, face: '/stickers/plunk/smug.png' },
              ].map(f => (
                <div key={f.n} className="tb-frame tb-wig" style={{
                  ['--col' as string]: f.on ? 'var(--grass-deep)' : '#9fb0c8', ['--lip' as string]: '5px',
                  ['--t' as string]: `${f.t}deg`, transform: `rotate(${f.t}deg)`, padding: 8, flex: '1 1 0', background: '#fff',
                  opacity: f.on ? 1 : .75,
                }}>
                  <img src={f.face} alt="" style={{ width: '100%', height: 84, objectFit: 'contain' }} />
                  <div className="tb-display" style={{ fontSize: 18 }}>{f.n}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: .7 }}>{f.s}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="tb-display" style={{ fontSize: 30, margin: '4px 0 14px' }}>
              <span className="tb-mark" style={{ ['--col' as string]: 'var(--red)' }}>Worlds for you!</span>
            </h2>
            <div className="tb-shelf">
              {[
                { a: '/brand/banner2.png', n: 'Crossroads, again', w: 300, h: 170, t: -2, col: 'var(--red)' },
                { a: '/about/towers-sunset.webp', n: 'Sunset tower', w: 240, h: 170, t: 2, col: 'var(--purple)' },
                { a: '/brand/landing-towers.webp', n: 'Big empty field', w: 240, h: 170, t: -1, col: 'var(--blue)' },
              ].map(w => (
                <div key={w.n} className="tb-frame tb-wig" style={{ ['--col' as string]: w.col, ['--t' as string]: `${w.t}deg`, transform: `rotate(${w.t}deg)`, padding: 8, width: w.w }}>
                  <img className="tb-pic" src={w.a} alt="" style={{ width: '100%', height: w.h }} />
                  <div className="tb-display" style={{ fontSize: 18, paddingTop: 7 }}>{w.n}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, opacity: .7 }}>4 people in it</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- download */

function Download() {
  return (
    <div style={{ background: 'var(--sky)', minHeight: 820 }}>
      <div style={{ background: 'var(--blue)', borderBottom: '3px solid var(--stroke)', padding: '12px 22px', display: 'flex', gap: 22, alignItems: 'center' }}>
        <img src="/brand/wordmark.png" alt="kobblon" style={{ height: 30 }} />
        {['What is Kobblon', 'Forum', 'Support', 'Policies', 'Get it'].map((t, i) => (
          <span key={t} style={{ color: '#fff', fontWeight: 700, opacity: i === 4 ? 1 : .72, borderBottom: i === 4 ? '3px solid #fff' : 'none', paddingBottom: 3 }}>{t}</span>
        ))}
      </div>

      <div style={{ position: 'relative', borderBottom: '3px solid var(--stroke)' }}>
        <img src="/brand/waves.png" alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />
        <h1 className="tb-display" style={{ position: 'absolute', left: 40, bottom: 22, margin: 0, fontSize: 52, color: '#fff', textShadow: '0 4px 0 rgba(0,0,0,.35)' }}>Get Kobblon!</h1>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', padding: '46px 24px 70px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 34 }}>
        {[
          {
            icon: '/brand/favicon.png', col: 'var(--blue)', deep: 'var(--blue-deep)', t: -1.5,
            who: 'to play', name: 'Kobblon', what: 'Worlds, your friends, all of it. This is the one you want.',
            plat: ['Windows', 'macOS'], state: 'Not out yet!', sticker: '/stickers/plunk/excited.png',
          },
          {
            icon: '/brand/favicon-creator.png', col: 'var(--orange)', deep: 'var(--orange-deep)', t: 2,
            who: 'to build', name: 'Kobblon Workspace', what: 'Where the Worlds get made. Bricks, scripts, the lot.',
            plat: ['Windows'], state: 'Not out yet!', sticker: '/mascot/construction_worker.png',
          },
        ].map(d => (
          <div key={d.name} className="tb-frame paper tb-wig" style={{
            ['--col' as string]: d.col, ['--t' as string]: `${d.t}deg`, transform: `rotate(${d.t}deg)`,
            padding: '26px 22px 22px', textAlign: 'center', position: 'relative',
          }}>
            <Sticker src={d.sticker} size={74} turn={d.t > 0 ? 14 : -14} style={{ right: -24, top: -28 }} />
            <img src={d.icon} alt="" style={{ display: 'block', margin: '0 auto', height: 104, width: 104, borderRadius: 22, border: '3px solid var(--stroke)' }} />
            <div className="tb-badge" style={{ ['--col' as string]: d.col, margin: '14px 0 8px' }}>{d.who}</div>
            <div className="tb-display" style={{ fontSize: 30 }}>{d.name}</div>
            <p style={{ fontWeight: 600, fontSize: 15, opacity: .8, minHeight: 46 }}>{d.what}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
              {d.plat.map(p => (
                <span key={p} style={{ border: '3px solid var(--stroke)', borderRadius: 999, padding: '4px 12px', fontWeight: 700, fontSize: 13, background: '#fff' }}>{p}</span>
              ))}
            </div>
            <button className="tb-press" disabled style={{ ['--col' as string]: '#cdd8e8', ['--deep' as string]: '#a9b6c9', color: '#5c6680', cursor: 'default', width: '100%' }}>{d.state}</button>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: .65, marginTop: 10 }}>Nobody here is guessing at a date.</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ shell */

const VIEWS = { Landing, Home, Download }

function Preview() {
  const [at, setAt] = useState<keyof typeof VIEWS>('Landing')
  const View = VIEWS[at]
  return (
    <>
      <style>{TOKENS}</style>
      <div style={{ position: 'fixed', zIndex: 50, right: 14, bottom: 14, display: 'flex', gap: 8 }}>
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map(k => (
          <button key={k} className="tb-press" style={{
            ['--col' as string]: k === at ? 'var(--ink)' : 'var(--paper)',
            ['--deep' as string]: k === at ? '#000' : '#c3d4ea',
            color: k === at ? '#fff' : 'var(--ink)', fontSize: 13, padding: '7px 14px', ['--lip' as string]: '4px',
          }} onClick={() => setAt(k)}>{k}</button>
        ))}
      </div>
      <View />
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Preview />)
