/**
 * Handing an experience to the Launcher.
 *
 * The Launcher is a player, not a browser for Kobblon: it opens, loads the
 * thing somebody pressed Play on, and puts them in it. Everything else stays
 * here on the website, so the only thing the site has to do is hand over an
 * id.
 *
 * Nothing personal goes in that link beyond a single-use code. A protocol
 * URL ends up in shell history, process lists and crash logs, so nothing
 * that is worth anything a minute later may travel there - but a code from
 * `mint_app_code` is worth exactly one exchange, expires in two minutes and
 * cannot be spent twice, which is the case it was invented for. It is how
 * the Workspace already signs in.
 *
 * It is what makes Staw's ask work: press Play signed in as johndoe and
 * johndoe arrives in the World; press it in another browser signed in as
 * janedoe and janedoe does. The browser's session decides, and nothing is
 * remembered on the machine.
 */

import { mintAppCode } from '@/lib/api'

/** What the Launcher will accept. Anything else it refuses outright. */
const ID = /^[A-Za-z0-9_-]{1,64}$/
/** The alphabet `mint_app_code` writes in, checked before it goes in a URL. */
const CODE = /^[A-Za-z0-9_-]{32,128}$/

export const playLink = (experienceId: string, code?: string) => {
  if (!ID.test(experienceId)) throw new Error('That is not an experience id.')
  if (!code) return `kobblon://play/${experienceId}`
  if (!CODE.test(code)) throw new Error('That is not a sign in code.')
  return `kobblon://play/${experienceId}?code=${code}`
}

/**
 * Opening a World in the Workspace to build it.
 *
 * The same shape as playing one and for the same reasons: an id and nothing
 * else. Whether the account may actually edit it is the Workspace's
 * question, asked over HTTPS once it has a session - a protocol link is a
 * thing anybody can type, so it can never be the thing that grants
 * permission.
 *
 * **New contract.** The Workspace has to answer `kobblon://edit/<id>`. Until
 * it does, this behaves exactly as `play` does against a machine with no
 * Launcher: nothing opens and the caller is told, which is why it takes the
 * same `onMissing`.
 */
export const editLink = (worldId: string) => {
  if (!ID.test(worldId)) throw new Error('That is not a world id.')
  return `kobblon://edit/${worldId}`
}

/**
 * Tries to open the Launcher, and says whether it looks like it worked.
 *
 * There is no way to ask a browser whether a desktop application is
 * installed, so this waits to see whether the page got hidden, which is what
 * happens when another application takes the screen. If it did not, the
 * caller offers the download. Silently doing nothing is the one wrong answer.
 */
export async function play(experienceId: string, onMissing: () => void) {
  /*
   * A code if there is a session to mint one from, and no code otherwise.
   *
   * Failing to mint must not stop somebody playing: the Launcher signs in
   * by hand perfectly well, and a World that will not open because a
   * sign-in call timed out is a worse outcome than arriving signed out.
   */
  let code: string | undefined
  try { code = await mintAppCode('launcher') } catch { code = undefined }
  return handOver(playLink(experienceId, code), onMissing)
}

/** Open a World in the Workspace, or say nothing happened. */
export function editInWorkspace(worldId: string, onMissing: () => void) {
  return handOver(editLink(worldId), onMissing)
}

function handOver(link: string, onMissing: () => void) {
  const started = Date.now()
  let answered = false

  const settle = () => {
    if (answered) return
    answered = true
    document.removeEventListener('visibilitychange', hidden)
  }

  const hidden = () => {
    if (document.hidden) settle()
  }

  document.addEventListener('visibilitychange', hidden)
  window.location.href = link

  window.setTimeout(() => {
    if (answered || document.hidden) { settle(); return }
    // A slow machine can take a moment; a missing app never comes back.
    if (Date.now() - started > 2500) { settle(); return }
    settle()
    onMissing()
  }, 1200)
}
