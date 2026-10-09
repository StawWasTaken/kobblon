/**
 * Handing an experience to the Launcher.
 *
 * The Launcher is a player, not a browser for Kobblon: it opens, loads the
 * thing somebody pressed Play on, and puts them in it. Everything else stays
 * here on the website, so the only thing the site has to do is hand over an
 * id.
 *
 * Nothing personal goes in that link. A protocol URL ends up in shell
 * history, process lists and crash logs, so it carries an id and nothing
 * else. Signing in is a separate conversation over HTTPS.
 */

/** What the Launcher will accept. Anything else it refuses outright. */
const ID = /^[A-Za-z0-9_-]{1,64}$/

export const playLink = (experienceId: string) => {
  if (!ID.test(experienceId)) throw new Error('That is not an experience id.')
  return `kobblon://play/${experienceId}`
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
export function play(experienceId: string, onMissing: () => void) {
  return handOver(playLink(experienceId), onMissing)
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
