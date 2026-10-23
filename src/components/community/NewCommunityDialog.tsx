import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ImageDrop } from '@/components/community/ImageDrop'
import { useAuth } from '@/hooks/useAuth'
import { createCommunityFull, uploadCommunityImage } from '@/lib/api'
import { slugify } from '@/lib/format'
import { cn } from '@/lib/cn'
import { CurrencyMark } from '@/components/brand/Currency'

export const COMMUNITY_COST = 100

const policies = [
  { value: 'open', label: 'Anyone can join', note: 'People join straight away.' },
  { value: 'approval', label: 'Manual approval', note: 'You let people in one at a time.' },
] as const

/**
 * Making a Community is a popup over wherever you are, the way everything
 * else on Kobblon that asks a few questions is. You never lose the page
 * you were on, and the rail behind it still shows the ones you are in.
 */
export function NewCommunityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emblem, setEmblem] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [joinPolicy, setJoinPolicy] = useState<'open' | 'approval'>('open')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = slugify(name)
  const affordable = (profile?.pixels ?? 0) >= COMMUNITY_COST

  const reset = () => {
    setName('')
    setDescription('')
    setEmblem(null)
    setCover(null)
    setJoinPolicy('open')
    setError(null)
  }

  const close = () => {
    if (pending) return
    reset()
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      setError('The name needs at least three letters or numbers.')
      return
    }
    if (!emblem) {
      setError('An emblem is needed.')
      return
    }

    setPending(true)
    setError(null)
    try {
      const [iconUrl, bannerUrl] = await Promise.all([
        uploadCommunityImage(profile.id, emblem, 'emblem'),
        cover ? uploadCommunityImage(profile.id, cover, 'cover') : Promise.resolve(null),
      ])

      await createCommunityFull({ name, slug, description, iconUrl, bannerUrl, joinPolicy })
      await refreshProfile()
      toast('Community created.', 'success')
      reset()
      onClose()
      navigate(`/c/${slug}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That did not save.'
      setError(message.includes('duplicate') ? 'That name is taken.' : message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Create Community"
      description="A place for people building around the same thing."
      size="lg"
      footer={
        <>
          {!affordable && (
            <p className="mr-auto text-sm text-danger">
              You need <CurrencyMark /> {COMMUNITY_COST}. You have {profile?.pixels ?? 0}.
            </p>
          )}
          <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
          <Button
            type="submit"
            form="new-community"
            loading={pending}
            disabled={!affordable}
          >
            <CurrencyMark />
            {COMMUNITY_COST}
          </Button>
        </>
      }
    >
      <form id="new-community" onSubmit={submit} className="space-y-5">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          required
          hint={`${name.length}/50${slug ? ` · kobblon.com/c/${slug}` : ''}`}
          error={error}
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          className="min-h-[7rem]"
          hint={`${description.length}/1000`}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <ImageDrop
            label="Emblem"
            required
            file={emblem}
            onChange={setEmblem}
            note="Square. Cut to shape when you pick it."
          />

          <ImageDrop
            label="Cover photo"
            aspect="wide"
            file={cover}
            onChange={setCover}
            note="Wide. It fades into the page behind the name."
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Joining
          </legend>
          <div className="space-y-2">
            {policies.map((policy) => (
              <label
                key={policy.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                  joinPolicy === policy.value
                    ? 'border-brand-bright bg-brand/15'
                    : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
                )}
              >
                <input
                  type="radio"
                  name="join-policy"
                  value={policy.value}
                  checked={joinPolicy === policy.value}
                  onChange={() => setJoinPolicy(policy.value)}
                  className="mt-0.5 accent-brand-bright"
                />
                <span>
                  <span className="block text-sm font-bold">{policy.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{policy.note}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}

/* The popup belongs to the Community shell, so the rail and the pages inside
   it all open the same one rather than each carrying a copy. */
const NewCommunityContext = createContext<() => void>(() => {})

export const useNewCommunity = () => useContext(NewCommunityContext)

export function NewCommunityProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)

  // A guest has nothing to make a Community with, so they are told rather
  // than handed a form that cannot be sent.
  const ask = () => {
    if (!profile || profile.is_guest) {
      toast('Make an account and you can start a Community.', 'info')
      return
    }
    setOpen(true)
  }

  return (
    <NewCommunityContext.Provider value={ask}>
      {children}
      <NewCommunityDialog open={open} onClose={() => setOpen(false)} />
    </NewCommunityContext.Provider>
  )
}
