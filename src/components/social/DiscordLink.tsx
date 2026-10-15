import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import { faLink, faLinkSlash, faCopy } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Choices } from '@/components/ui/Choices'
import { Confirm } from '@/components/ui/Confirm'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { setDiscordVisibility, startDiscordLink, unlinkDiscord } from '@/lib/api'
import type { DiscordVisibility } from '@/lib/api'
import { profileLink } from '@/lib/links'

const troubles: Record<string, string> = {
  refused: 'Discord did not say yes, so nothing changed.',
  expired: 'That took too long. Start it again.',
  failed: 'Discord could not be asked just now. Try again shortly.',
}

/**
 * Discord, tied to a Kobblon account.
 *
 * The tie is written by the edge function once Discord has said who somebody
 * is, so it means something: anybody with the Discord id can be sent to the
 * Kobblon profile, and nobody can claim an account that is not theirs.
 */
export function DiscordLink() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [letting, setLetting] = useState(false)
  const [seen, setSeen] = useState<DiscordVisibility>(profile?.discord_visibility ?? 'friends')

  useEffect(() => {
    setSeen(profile?.discord_visibility ?? 'friends')
  }, [profile?.discord_visibility])

  const choose = async (next: DiscordVisibility) => {
    const was = seen
    setSeen(next)
    try {
      await setDiscordVisibility(next)
      await refreshProfile()
    } catch (err) {
      setSeen(was)
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    }
  }

  const said = params.get('discord')

  useEffect(() => {
    if (!said) return
    if (said === 'linked') {
      toast('Discord linked.', 'success')
      void refreshProfile()
    } else if (troubles[said]) {
      toast(troubles[said], 'error')
    }
    params.delete('discord')
    setParams(params, { replace: true })
  }, [said, params, setParams, toast, refreshProfile])

  const linked = Boolean(profile?.discord_id)
  const jumpLink = profile ? `https://kobblon.com${profileLink(profile)}` : ''

  const connect = async () => {
    setBusy(true)
    try {
      window.location.href = await startDiscordLink()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#5865F2] text-lg text-white">
          <Glyph icon={faDiscord} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-extrabold">Discord</h3>
          <p className="text-sm text-muted">
            {linked
              ? <>Tied to <span className="font-bold text-white">{profile?.discord_display ?? 'your Discord'}</span>.</>
              : 'Tie your Discord account to this one, so people can find you either way.'}
          </p>
        </div>

        {linked ? (
          <Button variant="subtle" icon={faLinkSlash} onClick={() => setLetting(true)}>
            Unlink
          </Button>
        ) : (
          <Button icon={faLink} onClick={connect} disabled={busy}>
            {busy ? 'One moment' : 'Connect Discord'}
          </Button>
        )}
      </div>

      {linked && (
        <div className="rounded-xl border border-ink-line bg-ink-raised p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Who can see your Discord handle
          </p>
          <p className="mt-1 text-xs text-muted">
            Your Discord name is on your profile for anybody. The handle, the one people
            search for, is yours to give out.
          </p>
          <Choices
            className="mt-2"
            size="sm"
            label="Who can see your Discord handle"
            value={seen}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'friends', label: 'Friends' },
              { value: 'nobody', label: 'Nobody' },
            ]}
            onChange={(next) => void choose(next as DiscordVisibility)}
          />
        </div>
      )}

      {linked && (
        <div className="rounded-xl border border-ink-line bg-ink-raised p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Your link, for anywhere that takes one
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-ink px-3 py-2 text-xs">
              {jumpLink}
            </code>
            <Button
              size="sm"
              variant="ghost"
              icon={faCopy}
              onClick={() => {
                void navigator.clipboard?.writeText(jumpLink)
                toast('Copied.', 'success')
              }}
            >
              Copy
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Put it in your Discord profile. Anybody who has your Discord id also lands on your
            profile through kobblon.com/d/{profile?.discord_id}.
          </p>
        </div>
      )}

      <Confirm
        open={letting}
        onClose={() => setLetting(false)}
        onConfirm={async () => {
          try {
            await unlinkDiscord()
            await refreshProfile()
            toast('Discord unlinked.', 'success')
          } catch (err) {
            toast(err instanceof Error ? err.message : 'That did not work.', 'error')
          }
        }}
        title="Unlink Discord?"
        lead="The two accounts stop knowing about each other."
        points={[
          'Your Discord id no longer leads to your Kobblon profile.',
          'Nothing is deleted, and you can tie them together again whenever.',
        ]}
        confirmText="Unlink"
        icon={faLinkSlash}
      />
    </Card>
  )
}
