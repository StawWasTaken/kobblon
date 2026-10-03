/*
 * `/catalog`, which is now a doorway rather than a page.
 *
 * The shop lives on the avatar page, beside the body it dresses - Staw's
 * call, and the reason is that buying something and seeing it on yourself
 * are one activity that used to be two pages. This address keeps working
 * because links to it exist, the top bar's search points at it, and an
 * address that quietly stops resolving is worse than one that redirects.
 *
 * The search term is carried across, so searching the Catalog from the top
 * bar still lands on the results.
 */
import { Navigate, useSearchParams } from 'react-router-dom'

export default function Catalog() {
  const [params] = useSearchParams()
  const now = new URLSearchParams(params)
  now.set('tab', 'marketplace')
  return <Navigate to={`/avatar?${now.toString()}`} replace />
}
