import { Link, useInRouterContext } from 'react-router-dom'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

/**
 * A link that works whether or not there is a router above it.
 *
 * The website's components are meant to be used by Kobblon Workspace, which
 * mounts them on their own: no router, no providers, its own window. A
 * `<Link>` in that position does not render wrong — it throws, and takes the
 * panel with it. So the ones that might travel ask first.
 *
 * Inside the website this is a `<Link>` and nothing changes: no page reload,
 * no scroll to the top. Outside it, it is an anchor, which in an application
 * means opening the address in the person's own browser. That is the right
 * behaviour there: the Workspace is not a browser for Kobblon, and a World's
 * page belongs in the browser where somebody is already signed in.
 */
export function Hop({
  to,
  children,
  ...rest
}: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const routed = useInRouterContext()

  if (routed) {
    return <Link to={to} {...rest}>{children}</Link>
  }

  const outside = /^https?:/.test(to) ? to : `https://kobblon.com${to}`
  return <a href={outside} target="_blank" rel="noreferrer" {...rest}>{children}</a>
}
