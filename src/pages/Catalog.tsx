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
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { CatalogShelf } from '@/components/catalog/CatalogShelf'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { faShirt, faUser, faPlus } from '@fortawesome/free-solid-svg-icons'

export default function Catalog() {
  useTitle('Catalog')
  const { profile } = useAuth()

  return (
    <Page className="space-y-5">
      <PageHeader
        title="Catalog"
        lead="Everything you can put on an avatar."
        icon={faShirt}
        actions={profile ? (
          <>
            <Button to="/avatar" variant="subtle" icon={faUser}>My Avatar</Button>
            <Button to="/create/avatar" icon={faPlus}>Make one</Button>
          </>
        ) : undefined}
      />
      <CatalogShelf />
    </Page>
  )
}
