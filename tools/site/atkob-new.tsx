/*
 * At Kobblon, redesigned. Not a reskin - these four pages get rebuilt.
 *
 * The brief, in Staw's words: the old Roblox vibe, and the energy of the
 * light drawing he liked, done properly this time. Properly means our
 * own things do the work - our wordmark, our mascots, our faces, our
 * blue, our words - inside the two ideas that made those pages feel the
 * way they did:
 *
 *   1. the titled panel: every block names itself in a coloured strip,
 *      so a page reads as a notice board rather than a sheet;
 *   2. the toy surface: thick dark strokes, a solid lip under every
 *      shape, glossy pressable buttons, a sky behind it all, and things
 *      sticking out over edges.
 *
 * `?page=about|policies|support|download`.
 *
 * It is self-contained on purpose. These pages are being replaced, so
 * drawing them here against real components would mean half-changing the
 * components first; once Staw picks this, the pieces become real ones in
 * `src/components/about/` and the pages are rewritten onto them.
 */
import { createRoot } from 'react-dom/client'

const CSS = `
:root {
  --sky: #d6e8ff;
  --sky-deep: #b9d6fb;
  --paper: #ffffff;
  --cream: #fff6dd;
  --ink: #141735;
  --blue: #1b34e8;
  --blue-deep: #122295;
  --green: #22a74d;
  --green-deep: #157235;
  --red: #e33b2e;
  --red-deep: #a32317;
  --gold: #f0a81b;
  --gold-deep: #b07400;
  --violet: #7b3fe4;
  --violet-deep: #54269f;
  --w: 3px;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--sky); color: var(--ink); font-family: Inter, system-ui, sans-serif; }
a { color: inherit; }
.k-display { font-family: 'bd-gravel-vf', Inter, sans-serif; font-weight: 900; letter-spacing: -.01em; }

/* A panel: a named strip over a body, with a solid lip under it. */
.k-panel {
  border: var(--w) solid var(--ink);
  border-radius: 16px;
  background: var(--paper);
  box-shadow: 0 6px 0 0 var(--deep, var(--blue-deep));
  overflow: hidden;
}
.k-strip {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 14px;
  background: linear-gradient(180deg, var(--c, var(--blue)) 0%, var(--deep, var(--blue-deep)) 100%);
  border-bottom: var(--w) solid var(--ink);
  color: #fff;
}
.k-strip h2 { margin: 0; font-size: 15px; text-transform: uppercase; letter-spacing: .05em; }
.k-strip .k-more { margin-left: auto; font-size: 12px; font-weight: 800; opacity: .9; text-decoration: none; }
.k-strip .k-more:hover { text-decoration: underline; }
.k-body { padding: 16px 18px; }

/* Pressable. Squishes onto its own edge. */
.k-press {
  display: inline-flex; align-items: center; gap: 8px;
  border: var(--w) solid var(--ink); border-radius: 999px;
  background-image: linear-gradient(180deg, rgb(255 255 255 / .28), rgb(255 255 255 / 0) 58%);
  background-color: var(--c, var(--blue));
  color: #fff; font: 800 15px Inter, sans-serif; text-decoration: none;
  padding: 10px 20px; cursor: pointer;
  box-shadow: 0 5px 0 0 var(--deep, var(--blue-deep));
  transition: transform 170ms cubic-bezier(.3,1.6,.5,1), box-shadow 170ms cubic-bezier(.3,1.6,.5,1);
}
.k-press:active { transform: translateY(5px); box-shadow: 0 0 0 0 var(--deep); transition-duration: 60ms; }
.k-press.lg { font-size: 19px; padding: 14px 30px; }
.k-press.pale { background-color: var(--paper); color: var(--ink); --deep: #9fb6d4; }
.k-press.off { background-color: #c9d6e6; color: #5d6880; --deep: #9fb0c6; cursor: default; }

.k-wave { display: block; width: 100%; height: 48px; }
.k-tilt { transition: transform 180ms ease; }
.k-tilt:hover { transform: rotate(0deg) translateY(-3px); }
@media (prefers-reduced-motion: reduce) { .k-tilt, .k-press { transition: none; } }
.k-sticker { position: absolute; pointer-events: none; filter: drop-shadow(0 3px 0 rgb(0 0 0 / .2)); }
.k-rule { border: 0; border-top: 2px dashed #cddcf0; margin: 12px 0; }
.k-lead { font-size: 15px; line-height: 1.6; color: #39415f; }
.k-small { font-size: 13px; line-height: 1.55; color: #5a6480; }
`

const TONE = {
  blue: ['var(--blue)', 'var(--blue-deep)'],
  green: ['var(--green)', 'var(--green-deep)'],
  red: ['var(--red)', 'var(--red-deep)'],
  gold: ['var(--gold)', 'var(--gold-deep)'],
  violet: ['var(--violet)', 'var(--violet-deep)'],
} as const

type Tone = keyof typeof TONE

function vars(tone: Tone): React.CSSProperties {
  const [c, deep] = TONE[tone]
  return { ['--c' as string]: c, ['--deep' as string]: deep }
}

function Panel({ title, tone = 'blue', more, turn = 0, className, bodyless, style, children }: {
  title: string; tone?: Tone; more?: string; turn?: number
  className?: string; bodyless?: boolean; style?: React.CSSProperties; children: React.ReactNode
}) {
  return (
    <section className={`k-panel k-tilt ${className ?? ''}`}
      style={{ ...vars(tone), transform: turn ? `rotate(${turn}deg)` : undefined, ...style }}>
      <div className="k-strip">
        <h2 className="k-display">{title}</h2>
        {more && <a className="k-more" href="#">{more} ▸</a>}
      </div>
      {bodyless ? children : <div className="k-body">{children}</div>}
    </section>
  )
}

function Press({ tone = 'blue', big, pale, off, children }: {
  tone?: Tone; big?: boolean; pale?: boolean; off?: boolean; children: React.ReactNode
}) {
  return (
    <button className={`k-press${big ? ' lg' : ''}${pale ? ' pale' : ''}${off ? ' off' : ''}`}
      style={vars(tone)} disabled={off}>{children}</button>
  )
}

function Wave({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div style={{ background: top, lineHeight: 0 }}>
      <svg className="k-wave" viewBox="0 0 1200 48" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 26 C 160 0, 260 48, 420 24 S 680 0, 840 26 S 1060 48, 1200 20 L1200 48 L0 48 Z" fill={bottom} />
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ bar */

const TABS = ['What is Kobblon', 'Forum', 'Support', 'Policies', 'Get it']

function Bar({ at }: { at: string }) {
  return (
    <div style={{ background: 'var(--blue)', borderBottom: '3px solid var(--ink)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/brand/wordmark.png" alt="Kobblon" style={{ height: 30, marginRight: 8 }} />
        {TABS.map(t => (
          <a key={t} href="#" style={{
            textDecoration: 'none', color: '#fff', fontWeight: 800, fontSize: 14,
            padding: '7px 13px', borderRadius: 999,
            border: t === at ? '3px solid var(--ink)' : '3px solid transparent',
            background: t === at ? '#fff' : 'transparent',
            ...(t === at ? { color: 'var(--ink)', boxShadow: '0 3px 0 0 var(--ink)' } : {}),
          }}>{t}</a>
        ))}
        <div style={{ flex: 1 }} />
        <Press tone="green">Sign up!</Press>
      </div>
    </div>
  )
}

function Hero({ art, title, says, children, tall }: {
  art: string; title: React.ReactNode; says?: string; children?: React.ReactNode; tall?: boolean
}) {
  return (
    <div style={{ position: 'relative', borderBottom: '3px solid var(--ink)', overflow: 'hidden' }}>
      <img src={art} alt="" aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgb(10 14 40 / .35), rgb(10 14 40 / .72))' }} />
      <div style={{ position: 'relative', maxWidth: 1120, margin: '0 auto', padding: tall ? '64px 18px 72px' : '40px 18px 46px' }}>
        <h1 className="k-display" style={{ margin: 0, color: '#fff', fontSize: tall ? 54 : 40, lineHeight: 1.03, textShadow: '0 4px 0 rgb(0 0 0 / .35)' }}>{title}</h1>
        {says && <p style={{ color: '#dbe6ff', fontWeight: 600, fontSize: 17, marginTop: 14, maxWidth: 560 }}>{says}</p>}
        {children}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- about */

function About() {
  return (
    <>
      <Bar at="What is Kobblon" />
      <Hero art="/about/towers-sunset.webp" tall
        title={<><img src="/about/wordmark-brush.webp" alt="Kobblon" style={{ display: 'block', width: 300, marginBottom: 18 }} />People build things here.<br />Then they stand inside them.</>}>
        <div style={{ marginTop: 24, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <Press tone="green" big>Make an account!</Press>
          <Press pale>Look around first</Press>
        </div>
        <img src="/icons/ui/reaction-heart-eyes.png" alt="" className="k-sticker" style={{ display: 'none' }} />
      </Hero>

      <div style={{ background: 'var(--sky)', padding: '28px 18px 10px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1fr) 20rem' }}>
          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Panel title="Made by people" tone="blue" more="the whole story">
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <img src="/mascot/kobby.gif" alt="" aria-hidden="true" style={{ width: 96, flexShrink: 0 }} />
                <div>
                  <p className="k-display" style={{ fontSize: 28, margin: '0 0 8px', lineHeight: 1.1 }}>
                    A person made every single thing on this website.
                  </p>
                  <p className="k-lead" style={{ margin: 0 }}>
                    Every World, every hat, every face, every word. Nothing on
                    Kobblon was generated and nothing on Kobblon ever will be. We
                    are the other thing.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Worlds" tone="red" more="see them all" bodyless>
              <img src="/brand/landing-interior.png" alt="" aria-hidden="true"
                style={{ display: 'block', width: '100%', height: 280, objectFit: 'cover', borderBottom: '3px solid var(--ink)' }} />
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 18 }}>
                <p className="k-lead" style={{ margin: 0, flex: 1 }}>
                  Obbies, tycoons, hangouts, things nobody has a word for yet.
                  Walk into any of them. The quiet ones are the good ones.
                </p>
                <Press tone="green">play!</Press>
              </div>
            </Panel>

            <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1fr 1fr' }}>
              <Panel title="No bots. None." tone="green" turn={-0.6}>
                <p className="k-lead" style={{ margin: 0 }}>
                  If it says four people are playing, it is four people. We would
                  rather look quiet than lie about it.
                </p>
              </Panel>
              <Panel title="Free, the good kind" tone="gold" turn={0.6}>
                <p className="k-lead" style={{ margin: 0 }}>
                  Make an account, build a World, put it out. Nothing is paywalled
                  on the way in.
                </p>
              </Panel>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Panel title="Communities" tone="violet" more="more" bodyless>
              <img src="/about/marketplace.png" alt="" aria-hidden="true"
                style={{ display: 'block', width: '100%', height: 130, objectFit: 'cover', borderBottom: '3px solid var(--ink)' }} />
              <div style={{ padding: '14px 16px' }}>
                <p className="k-small" style={{ margin: 0 }}>
                  Fan clubs, build teams and whatever else people start. Each one
                  has a wall and a bank.
                </p>
              </div>
            </Panel>

            <Panel title="Somebody reads it" tone="gold" more="the rules">
              <div style={{ display: 'flex', gap: 14 }}>
                <img src="/mascot/construction_worker.png" alt="" aria-hidden="true"
                  style={{ width: 64, height: 80, objectFit: 'contain', flexShrink: 0 }} />
                <div>
                  <p className="k-display" style={{ margin: '0 0 6px', fontSize: 17 }}>Report anything, anywhere.</p>
                  <p className="k-small" style={{ margin: 0 }}>
                    Your name never travels with a report. Moderation is people,
                    and the only thing a machine does here is point one of them at
                    it.
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="New here?" tone="green">
              <div style={{ textAlign: 'center' }}>
                <img src="/mascot/newbie.png" alt="" aria-hidden="true" style={{ width: 96 }} />
                <p className="k-display" style={{ fontSize: 20, margin: '8px 0 12px' }}>See you in there.</p>
                <Press tone="green">Make an account!</Press>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      <Wave top="var(--sky)" bottom="var(--cream)" />
      <div style={{ background: 'var(--cream)', padding: '10px 18px 46px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <Panel title="Go on then. Build one." tone="blue" bodyless>
            <div style={{ position: 'relative' }}>
              <img src="/brand/waves.png" alt="" aria-hidden="true"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', inset: 0, background: 'rgb(8 12 36 / .55)' }} />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 22, padding: '22px 20px' }}>
                <img src="/about/can.png" alt="" aria-hidden="true" style={{ width: 110, transform: 'rotate(-6deg)' }} />
                <div>
                  <p style={{ color: '#e7eeff', fontSize: 15, lineHeight: 1.6, margin: '0 0 14px', maxWidth: 560 }}>
                    Worlds are built in Kobblon Workspace, on the desktop. Publish
                    one and it is here, ready for people, two minutes later.
                  </p>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Press>Get Workspace</Press>
                    <a href="#" style={{ color: '#cfdcff', fontWeight: 700, fontSize: 13 }}>or start in the Creator Hub</a>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ download */

const DOORS = [
  {
    icon: '/brand/favicon.png', tone: 'blue' as Tone, name: 'Kobblon', who: 'to play',
    what: 'Worlds, your friends, all of it. This is the one you want.',
    plat: ['Windows', 'macOS'], mascot: '/mascot/newbie.png', turn: -1,
  },
  {
    icon: '/brand/favicon-creator.png', tone: 'gold' as Tone, name: 'Kobblon Workspace', who: 'to build',
    what: 'Where the Worlds get made. Bricks, scripts, the lot.',
    plat: ['Windows'], mascot: '/mascot/construction_worker.png', turn: 1,
  },
]

function Download() {
  return (
    <>
      <Bar at="Get it" />
      <Hero art="/brand/waves.png" title="Get Kobblon!" says="Two programs. One to play in, one to build in. Neither is out yet." />
      <div style={{ background: 'var(--sky)', padding: '34px 18px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 26, gridTemplateColumns: '1fr 1fr' }}>
          {DOORS.map(d => (
            <Panel key={d.name} title={d.who} tone={d.tone} turn={d.turn} className="k-door">
              <div style={{ textAlign: 'center', position: 'relative' }}>
                <img src={d.mascot} alt="" aria-hidden="true" className="k-sticker"
                  style={{ width: 62, right: -6, top: -10, transform: `rotate(${d.turn * 9}deg)` }} />
                <img src={d.icon} alt="" style={{ width: 104, height: 104, border: '3px solid var(--ink)', borderRadius: 22 }} />
                <p className="k-display" style={{ fontSize: 26, margin: '12px 0 6px' }}>{d.name}</p>
                <p className="k-small" style={{ margin: '0 0 14px', minHeight: 40 }}>{d.what}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
                  {d.plat.map(p => (
                    <span key={p} style={{ border: '3px solid var(--ink)', borderRadius: 999, padding: '3px 12px', fontWeight: 800, fontSize: 12, background: '#fff' }}>{p}</span>
                  ))}
                </div>
                <Press off>Not out yet!</Press>
                <p className="k-small" style={{ margin: '10px 0 0' }}>Nobody here is guessing at a date.</p>
              </div>
            </Panel>
          ))}
        </div>
      </div>
      <Wave top="var(--sky)" bottom="var(--cream)" />
      <div style={{ background: 'var(--cream)', padding: '6px 18px 46px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Panel title="Until then" tone="green">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <img src="/mascot/kobby.gif" alt="" aria-hidden="true" style={{ width: 72 }} />
              <p className="k-lead" style={{ margin: 0, flex: 1 }}>
                Everything else works in here. Make an account, pick a face, put
                a hat on it, and have a look round the Worlds that are up.
              </p>
              <Press tone="green">Make an account!</Press>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------ policies */

const DOCS = [
  ['Terms of Use', 'What you agree to by being here.', '12 Nov 2026'],
  ['Privacy', 'What we hold about you, and what we do not.', '12 Nov 2026'],
  ['Community guidelines', 'What gets you a warning and what gets you gone.', '3 Nov 2026'],
  ['Creator terms', 'Who owns what you upload. You do.', '28 Oct 2026'],
  ['Brix and money', 'Buying, selling, payouts and refunds.', '28 Oct 2026'],
  ['Parents', 'What a parent can switch off.', '14 Oct 2026'],
  ['Cookies', 'The two we set, and why.', '14 Oct 2026'],
  ['Takedowns', 'Somebody used your thing. Tell us.', '2 Oct 2026'],
  ['Law enforcement', 'How a request is handled.', '2 Oct 2026'],
]

function Policies() {
  return (
    <>
      <Bar at="Policies" />
      <Hero art="/brand/background.png" title="The rules, written out."
        says="Nine documents. Plain words where plain words are allowed." />
      <div style={{ background: 'var(--sky)', padding: '30px 18px 20px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1fr) 19rem' }}>
          <Panel title="Everything written down" tone="blue" bodyless>
            <div>
              {DOCS.map(([name, what, when], i) => (
                <a key={name} href="#" style={{
                  display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
                  padding: '13px 18px', borderTop: i ? '2px solid #e4ecf8' : 'none',
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue)', border: '2px solid var(--ink)', flexShrink: 0 }} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="k-display" style={{ display: 'block', fontSize: 17 }}>{name}</span>
                    <span className="k-small">{what}</span>
                  </span>
                  <span className="k-small" style={{ whiteSpace: 'nowrap' }}>{when}</span>
                  <span style={{ fontWeight: 900, color: 'var(--blue)' }}>▸</span>
                </a>
              ))}
            </div>
          </Panel>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Panel title="Ask Kobby" tone="violet">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <img src="/mascot/kobby.gif" alt="" aria-hidden="true" style={{ width: 64 }} />
                <p className="k-small" style={{ margin: 0 }}>
                  Not sure which one covers your thing? Ask, and you get pointed at
                  the right paragraph.
                </p>
              </div>
              <div style={{ marginTop: 12 }}><Press tone="violet">Ask a question</Press></div>
            </Panel>

            <Panel title="Two doors" tone="gold">
              <p className="k-small" style={{ margin: '0 0 12px' }}>
                Something to report, or something to take down. Both reach a person.
              </p>
              <div style={{ display: 'grid', gap: 10 }}>
                <Press tone="gold">Report something</Press>
                <Press pale>Ask for a takedown</Press>
              </div>
            </Panel>

            <Panel title="The honest bit" tone="green">
              <p className="k-small" style={{ margin: 0 }}>
                A lawyer did not write these. They say what we actually do, and
                they get fixed when they are wrong.
              </p>
            </Panel>
          </div>
        </div>
      </div>
      <div style={{ height: 40, background: 'var(--sky)' }} />
    </>
  )
}

/* ------------------------------------------------------------- support */

const HELP = [
  { name: 'Your account', tone: 'blue' as Tone, items: ['I cannot get in', 'Changing your username', 'Somebody else is in my account', 'Deleting an account'] },
  { name: 'Brix, buying and building', tone: 'gold' as Tone, items: ['Where Brix come from', 'A purchase did not arrive', 'Getting paid for what you make', 'Refunds'] },
  { name: 'Safety and what is held about you', tone: 'green' as Tone, items: ['Reporting somebody', 'Blocking somebody', 'What a parent can switch off', 'What we hold about you'] },
  { name: 'Everything else', tone: 'violet' as Tone, items: ['A World will not load', 'The Workspace crashed', 'Something looks wrong', 'Telling us about a bug'] },
]

function Support() {
  return (
    <>
      <Bar at="Support" />
      <Hero art="/brand/banner3.png" title="Stuck? Say so."
        says="A person answers these. Usually the same day, sometimes the same hour." />
      <div style={{ background: 'var(--sky)', padding: '30px 18px 18px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1fr) 19rem' }}>
          <div style={{ display: 'grid', gap: 18 }}>
            {HELP.map((g, i) => (
              <Panel key={g.name} title={g.name} tone={g.tone} more="all of them" turn={i % 2 ? 0.4 : -0.4} bodyless>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {g.items.map((item, n) => (
                    <a key={item} href="#" style={{
                      display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                      padding: '12px 16px',
                      borderTop: n > 1 ? '2px solid #e4ecf8' : 'none',
                      borderRight: n % 2 === 0 ? '2px solid #e4ecf8' : 'none',
                      fontWeight: 700, fontSize: 14,
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--ink)', flexShrink: 0 }} />
                      {item}
                    </a>
                  ))}
                </div>
              </Panel>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <Panel title="Ask Kobby" tone="blue">
              <div style={{ textAlign: 'center' }}>
                <img src="/mascot/kobby.gif" alt="" aria-hidden="true" style={{ width: 84 }} />
                <p className="k-small" style={{ margin: '6px 0 12px' }}>
                  Type it in your own words. If Kobby cannot sort it, it goes to a
                  person with what you already said attached.
                </p>
                <Press>Ask Kobby</Press>
              </div>
            </Panel>
            <Panel title="Still stuck?" tone="red">
              <p className="k-small" style={{ margin: '0 0 12px' }}>
                Write to a person. Say what you were doing and what happened.
              </p>
              <Press tone="red">Send a message</Press>
            </Panel>
          </div>
        </div>
      </div>
      <div style={{ height: 40, background: 'var(--sky)' }} />
    </>
  )
}

/* --------------------------------------------------------------- shell */

const PAGES = { about: About, download: Download, policies: Policies, support: Support }
const which = (new URLSearchParams(location.search).get('page') ?? 'about') as keyof typeof PAGES
const Shown = PAGES[which] ?? About

createRoot(document.getElementById('root')!).render(
  <>
    <style>{CSS}</style>
    <Shown />
  </>,
)
