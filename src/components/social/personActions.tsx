import { useState } from 'react'
import {
  faBan, faCircleCheck, faEyeSlash, faEye, faUserMinus, faUnlock, faFlag,
} from '@fortawesome/free-solid-svg-icons'
import type { MenuItem } from '@/components/ui/Menu'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import {
  blockPerson, ignorePerson, unblockPerson, unfriend, unignorePerson,
} from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

type Person = { id: string; display_name: string; username: string }

type Standing = {
  are_friends?: boolean
  i_blocked?: boolean
  i_ignore?: boolean
}

type Ask = {
  kind: 'unfriend' | 'ignore' | 'unignore' | 'block' | 'unblock'
  person: Person
}

/**
 * The things you can do about a person, wherever their name appears.
 *
 * Blocking and unfriending cannot be undone by pressing the button again, so
 * both are asked about first, and the question says what actually happens
 * rather than asking whether you are sure.
 */
export function usePersonActions(onChanged?: () => void) {
  const { profile } = useAuth()
  const toast = useToast()
  const [ask, setAsk] = useState<Ask | null>(null)

  const run = async (deed: Ask) => {
    const name = deed.person.display_name
    try {
      if (deed.kind === 'unfriend') {
        if (!profile) return
        await unfriend(profile.id, deed.person.id)
        toast(`${name} is no longer a friend.`, 'success')
      } else if (deed.kind === 'ignore') {
        await ignorePerson(deed.person.id)
        toast(`Ignoring ${name}.`, 'success')
      } else if (deed.kind === 'unignore') {
        await unignorePerson(deed.person.id)
        toast(`${name} is no longer ignored.`, 'success')
      } else if (deed.kind === 'block') {
        await blockPerson(deed.person.id)
        toast(`${name} is blocked.`, 'success')
      } else {
        await unblockPerson(deed.person.id)
        toast(`${name} is no longer blocked.`, 'success')
      }
      onChanged?.()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    }
  }

  /**
   * The menu entries for one person, given where you stand with them.
   *
   * In two groups, and the grouping is the point. Staw, on the profile's
   * menu: "i would like the more button to be reordered correctly and
   * properly". What was there ran Report, Remove friend, Ignore, Block -
   * the heaviest thing in the list second, the two that only change how
   * quiet somebody is sitting between two that do not. So: how you two
   * stand first, then a line, then the two that are about them rather than
   * about the pair of you.
   *
   * `onReport` is passed by whoever has a report dialog to open. It goes in
   * the second group rather than at the top, where it was.
   */
  const itemsFor = (
    person: Person,
    standing: Standing,
    extras?: { onReport?: () => void },
  ): MenuItem[] => {
    if (person.id === profile?.id) return []
    const items: MenuItem[] = []

    if (standing.i_blocked) {
      items.push({
        label: 'Unblock', icon: faUnlock, separated: true,
        onSelect: () => setAsk({ kind: 'unblock', person }),
      })
      return items
    }

    /* How you two stand. */
    if (standing.are_friends) {
      items.push({
        label: 'Remove friend', icon: faUserMinus, separated: true,
        onSelect: () => setAsk({ kind: 'unfriend', person }),
      })
    }

    items.push(
      standing.i_ignore
        ? {
            label: 'Stop ignoring', icon: faEye,
            separated: !standing.are_friends,
            onSelect: () => void run({ kind: 'unignore', person }),
          }
        : {
            label: 'Ignore', icon: faEyeSlash,
            separated: !standing.are_friends,
            onSelect: () => setAsk({ kind: 'ignore', person }),
          },
    )

    /* About them. */
    if (extras?.onReport) {
      items.push({
        label: 'Report', icon: faFlag, danger: true, separated: true,
        onSelect: extras.onReport,
      })
    }

    items.push({
      label: 'Block', icon: faBan, danger: true, separated: !extras?.onReport,
      onSelect: () => setAsk({ kind: 'block', person }),
    })

    return items
  }

  const name = ask?.person.display_name ?? ''

  const dialog = (
    <>
      <Confirm
        open={ask?.kind === 'unfriend'}
        onClose={() => setAsk(null)}
        onConfirm={async () => { if (ask) await run(ask) }}
        title={`Remove ${name}?`}
        lead={`You and ${name} stop being friends.`}
        points={[
          'Your chat leaves both of your lists, and neither of you can write to the other.',
          'What either of you wrote is kept, and comes back if you become friends again.',
          'They are not told about this.',
        ]}
        confirmText="Remove friend"
        icon={faUserMinus}
      />

      <Confirm
        open={ask?.kind === 'ignore'}
        onClose={() => setAsk(null)}
        onConfirm={async () => { if (ask) await run(ask) }}
        title={`Ignore ${name}?`}
        lead={`You stay friends. ${name} is simply quieter.`}
        points={[
          'Nothing they do reaches you as a notification.',
          'Their messages are covered until you tap one to read it.',
          'They are not told, and you can stop ignoring them whenever you like.',
        ]}
        confirmText="Ignore"
        icon={faEyeSlash}
        tone="primary"
      />

      <Confirm
        open={ask?.kind === 'block'}
        onClose={() => setAsk(null)}
        onConfirm={async () => { if (ask) await run(ask) }}
        title={`Block ${name}?`}
        lead={`This ends everything between you and ${name}, straight away.`}
        points={[
          'If you are friends, you stop being friends.',
          'Neither of you follows the other any more.',
          'Neither of you can write to the other, send a request, or follow.',
          'They are not told, and you can unblock them from your friends page.',
        ]}
        confirmText="Block"
        icon={faBan}
      />

      <Confirm
        open={ask?.kind === 'unblock'}
        onClose={() => setAsk(null)}
        onConfirm={async () => { if (ask) await run(ask) }}
        title={`Unblock ${name}?`}
        lead={`${name} will be able to reach you again.`}
        points={[
          'They can send you a friend request and follow you.',
          'You are not friends again: that is a fresh request either way.',
        ]}
        confirmText="Unblock"
        icon={faCircleCheck}
        tone="primary"
      />
    </>
  )

  /** The ones with nothing to warn about, done on the spot. */
  const act = (kind: 'unignore', person: Person) => void run({ kind, person })

  return { itemsFor, dialog, askFor: setAsk, act }
}
