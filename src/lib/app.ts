/**
 * Kobblon on the desktop.
 *
 * The Launcher shows this website and keeps the engine native, so these pages
 * are the same pages in both places. A handful of things still have to know
 * which one they are in: a Play button opens an experience in the native
 * runtime rather than a new tab, and a page that tells somebody to download
 * the Launcher should not say so inside the Launcher.
 *
 * The app tells us it is there by injecting `window.kobblon` from a preload
 * script. Nothing here trusts a page that merely claims to be the app: the
 * bridge is created by the shell, and the worst a faked flag can do is hide a
 * download link.
 */

export type AppBridge = {
  /** What the shell is, so a page can say so honestly. */
  readonly client: 'launcher' | 'creator'
  readonly version: string
  /** Hands an experience to the native runtime. Resolves once it has it. */
  play(experienceId: string): Promise<void>
  /** Opens a link in the person's real browser rather than inside the app. */
  openOutside(url: string): void
}

declare global {
  interface Window {
    kobblon?: AppBridge
  }
}

export const bridge = (): AppBridge | null =>
  (typeof window !== 'undefined' && window.kobblon?.play ? window.kobblon : null)

export const inApp = () => bridge() !== null

/**
 * Starting an experience, from wherever you are.
 *
 * Inside the Launcher this hands the id straight to the native runtime. In a
 * browser it uses the protocol handler, which opens the Launcher if it is
 * installed. The caller decides what to show when it is not.
 */
export async function play(experienceId: string) {
  const app = bridge()
  if (app) {
    await app.play(experienceId)
    return 'app' as const
  }

  window.location.href = `kobblon://play/${encodeURIComponent(experienceId)}`
  return 'protocol' as const
}

/** A link that should leave the app, such as somewhere that is not Kobblon. */
export function openOutside(url: string) {
  const app = bridge()
  if (app) app.openOutside(url)
  else window.open(url, '_blank', 'noreferrer,noopener')
}
