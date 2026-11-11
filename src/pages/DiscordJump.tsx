import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useTitle } from '@/hooks/useTitle'
import { profileByDiscord } from '@/lib/api'
import { profileLink } from '@/lib/links'

/**
 * kobblon.com/d/<discord id> lands on whoever that Discord account belongs
 * to. Nothing else about them is said here, and an id nobody has tied to an
 * account says so rather than guessing.
 */
export default function DiscordJump() {
  const { id = '' } = useParams()
  useTitle('Finding them')

  const [where, setWhere] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    void profileByDiscord(id)
      .then((found) => live && setWhere(found ? profileLink(found) : null))
      .catch(() => live && setWhere(null))
    return () => { live = false }
  }, [id])

  if (where === undefined) {
    return <Page><Skeleton className="h-40 w-full rounded-2xl" /></Page>
  }

  if (where) return <Navigate to={where} replace />

  return (
    <Page>
      <Card>
        <EmptyState
          mood="noResults"
          title="Nobody here"
          body="No Kobblon account has tied that Discord account to itself."
          action={<Button to="/people">Find people</Button>}
        />
      </Card>
    </Page>
  )
}
