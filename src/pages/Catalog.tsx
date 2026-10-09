/*
 * The Catalog, its own page again.
 *
 * It was folded into the avatar page for a few hours and Staw took it back
 * out: the shop sitting beside the body reads well in a screenshot and badly
 * in use, because the shelf is wide and the body is not, and squeezing both
 * into one screen makes each of them worse than it was alone.
 *
 * What is kept is the split that came out of the attempt. The shelf is a
 * component rather than a page body, so it can be mounted anywhere - which
 * is how a page took it in the first place, and is the right shape whatever
 * ends up mounting it next.
 */
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { CatalogShelf } from '@/components/catalog/CatalogShelf'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { faUser, faPlus } from '@fortawesome/free-solid-svg-icons'

export default function Catalog() {
  useTitle('Catalog')
  const { profile } = useAuth()

  /*
   * Wide again. The narrow column Staw asked for on signed-in pages is for
   * pages you read; a shop is a page you survey, and at 68rem the shelf
   * dropped to three cards a row with the rest of the screen empty beside
   * it. He named this one, the avatar, the homepage and Discover as the
   * four that want the room.
   */
  return (
    <Page width="wide" className="space-y-5">
      {/* The heading, the search and the word rail all belong to the shelf,
          so there is one search box on the page rather than two. */}
      <CatalogShelf
        hero
        actions={profile ? (
          <>
            <Button to="/avatar" variant="subtle" icon={faUser}>My Avatar</Button>
            <Button to="/create/avatar" icon={faPlus}>Make one</Button>
          </>
        ) : undefined}
      />
    </Page>
  )
}
