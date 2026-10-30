import { useEffect, useState } from 'react'

/*
 * Which version of Kobblon this is.
 *
 * Staw, 25 October: "show somewhere that the Kobblon website is at its
 * 'V3.4' right now and make that in december it'll be automatically in the
 * 'V3.5'". Then, the same day: "the 3.4 is actually the version of the
 * whole platform (includes website & launcher, the workspace is
 * different)".
 *
 * So this number is **the platform's**: the website and the Launcher move
 * on it together, and the Workspace keeps its own. That is why it is not
 * called the site version and why the footer does not say "website" - a
 * person reporting something quotes one number for the place they were in,
 * and two numbers for one platform is how a bug report ends up naming the
 * wrong half of it.
 *
 * A list of versions and the day each one starts, read against the clock
 * rather than written into the build. It is done this way for one reason:
 * the alternative is remembering to change a number on the first of
 * December, and the version somebody is looking at would be whatever was
 * last deployed rather than what Kobblon actually is. The deployed bundle
 * from November says 3.5 in December on its own.
 *
 * The clock the list is read against is the viewer's, which means somebody
 * whose machine is a day ahead reads the new number a day early.
 *
 * **That is why the list is now the fallback and not the answer.** Staw: "i wanna make it so
 * that we dont have to update the text for the versions manually but for
 * example when the website displays that its at the V3.5 then every other
 * thing, the website, the launcher & workspace all display it at the same
 * time". Three products reading three bundled lists against three machine
 * clocks is three answers that are usually the same, and "usually" is not
 * what one platform version means. So the number comes from the database
 * now - `platform_version()`, read against the server's `current_date` -
 * and the list below is what a page draws before that answer arrives, and
 * what it keeps if the call never lands.
 *
 * Keep the list roughly current anyway. It is the offline answer, and a
 * Launcher splash with no network draws it.
 *
 * Adding one: put it at the top with the day it starts. The list is read
 * downwards and the first one that has begun wins, so it stays in date
 * order, newest first.
 */
const releases: { from: string; name: string }[] = [
  { from: '2026-12-01', name: '3.5' },
  { from: '2026-10-01', name: '3.4' },
]

/** The current platform version, as `3.4`. */
export function platformVersion(now: Date = new Date()): string {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (releases.find((one) => one.from <= today) ?? releases[releases.length - 1]).name
}

/** The current platform version, as `V3.4`, which is how Staw writes it. */
export function platformVersionLabel(now: Date = new Date()): string {
  return `V${platformVersion(now)}`
}

/* ------------------------------------------------------- what the server says */

/**
 * The version the database holds, which is the one that counts.
 *
 * Cached for the life of the page, because this is a label in a footer and
 * an About box: it does not change while somebody is looking at it, and a
 * request per mount would be one per page on a site where the footer is on
 * every page. The promise itself is the cache, so ten components mounting
 * at once make one call between them.
 *
 * It never throws. A version number is not worth a broken page, and the
 * bundled list above is a correct answer on almost every day of the year -
 * the one it gets wrong is the day a release starts, which is exactly the
 * day the server is there to settle.
 */
export type PlatformVersion = {
  name: string
  /** The next one and its day, when one is scheduled. */
  next?: { name: string; on: string }
  /** False when this came from the bundled list rather than the server. */
  live: boolean
}

let asked: Promise<PlatformVersion> | null = null

export function platformVersionFromServer(): Promise<PlatformVersion> {
  asked ??= (async () => {
    try {
      const { fetchPlatformVersion } = await import('@/lib/api')
      const said = await fetchPlatformVersion()
      if (said?.name) return said
    } catch {
      /* The fallback below is the whole handling. */
    }
    return { name: platformVersion(), live: false }
  })()
  return asked
}

/**
 * The version, for a component: the bundled answer first, the server's the
 * moment it lands.
 *
 * Written as a hook rather than left to each caller because there are three
 * places on this site that draw it and there will be more, and the thing
 * that goes wrong otherwise is the one this project keeps hitting - a value
 * read once at mount, before the thing that decides it has answered.
 */
export function usePlatformVersion(): PlatformVersion {
  const [said, setSaid] = useState<PlatformVersion>(() => ({ name: platformVersion(), live: false }))
  useEffect(() => {
    let wanted = true
    void platformVersionFromServer().then((got) => { if (wanted) setSaid(got) })
    return () => { wanted = false }
  }, [])
  return said
}
