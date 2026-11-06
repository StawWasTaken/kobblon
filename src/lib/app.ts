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
 * `mint_app_code` is worth exactly one exchange, expires in ten minutes and
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

/** A server's id, which is a uuid and is checked before it goes in a URL. */
const ROOM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Where to play, and optionally *which copy* of it.
 *
 * `room` is the one from `world_servers`, and it is what makes Join on a
 * friend mean "where they are" rather than "that World, somewhere". Without
 * it the Launcher opens whichever server it likes, which for somebody
 * following a friend is the one thing they did not ask for.
 *
 * It is a hint and never a permission: a room id is a thing anybody can
 * type, and whether that account may be in that room is decided by
 * `join_world_server` over HTTPS, which is where it has always been
 * decided. A full room, a closed one or a private one refuses there.
 */
export const playLink = (experienceId: string, code?: string, room?: string) => {
  if (!ID.test(experienceId)) throw new Error('That is not an experience id.')
  if (code && !CODE.test(code)) throw new Error('That is not a sign in code.')
  if (room && !ROOM.test(room)) throw new Error('That is not a server id.')

  const asked = [
    code ? `code=${code}` : '',
    room ? `room=${room}` : '',
  ].filter(Boolean)

  return asked.length
    ? `kobblon://play/${experienceId}?${asked.join('&')}`
    : `kobblon://play/${experienceId}`
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
export const editLink = (worldId: string, code?: string) => {
  if (!ID.test(worldId)) throw new Error('That is not a world id.')
  if (!code) return `kobblon://edit/${worldId}`
  if (!CODE.test(code)) throw new Error('That is not a sign in code.')
  return `kobblon://edit/${worldId}?code=${code}`
}

/**
 * Tries to open the Launcher, and says whether it looks like it worked.
 *
 * There is no way to ask a browser whether a desktop application is
 * installed, so this waits to see whether the page got hidden, which is what
 * happens when another application takes the screen. If it did not, the
 * caller offers the download. Silently doing nothing is the one wrong answer.
 */
export async function play(experienceId: string, onMissing: () => void, room?: string) {
  /*
   * A code if there is a session to mint one from, and no code otherwise.
   *
   * Failing to mint must not stop somebody playing: the Launcher signs in
   * by hand perfectly well, and a World that will not open because a
   * sign-in call timed out is a worse outcome than arriving signed out.
   */
  let code: string | undefined
  try { code = await mintAppCode('launcher') } catch { code = undefined }
  return handOver(playLink(experienceId, code, room), onMissing)
}

/**
 * Open a World in the Workspace, or say nothing happened.
 *
 * It carries a code for the same reason playing one does: pressing Edit
 * while signed in as somebody is the whole of what signing in to the
 * Workspace should take. The code is minted for `creator`, so it cannot be
 * spent on the Launcher, and a failure to mint is not a failure to open -
 * the Workspace still has its own sign-in page.
 */
export async function editInWorkspace(worldId: string, onMissing: () => void) {
  let code: string | undefined
  try { code = await mintAppCode('creator') } catch { code = undefined }
  return handOver(editLink(worldId, code), onMissing)
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
