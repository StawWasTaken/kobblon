/*
 * Your avatar, in a room of its own.
 *
 * It lived in the corner of the shop before: a picture the size of a stamp
 * beside a grid of things to buy. Which is the wrong way round - the avatar
 * is the thing, and the shop is where you go to change it. Staw asked for a
 * page for it and this is that page.
 *
 * Nothing here is new machinery. The face, the wardrobe and what is worn are
 * the same calls the shop makes, and `FaceStage` is the same compositor that
 * draws a person on a card, a profile and a comment. So what you see on this
 * page is exactly what everybody else sees, rather than a preview of it.
 */
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faStore, faXmark, faFaceSmile, faCheck, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { FaceStage } from '@/components/style/FaceStage'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  faceUrl, myFaces, myStyle, styleImage, wearFace, wearStyleItem,
} from '@/lib/api'
import type { StyleItem } from '@/lib/api'
import type { Face, WornStyle } from '@/types/db'
import { cn } from '@/lib/cn'

/** The slots, in the order somebody thinks about them. */
const slots: { value: StyleItem['slot']; label: string }[] = [
  { value: 'hat', label: 'Hats' },
  { value: 'hair', label: 'Hair' },
  { value: 'face', label: 'Face' },
  { value: 'accessory', label: 'Accessories' },
  { value: 'frame', label: 'Frames' },
]

/** A style row turned into what `FaceStage` draws. */
const asWorn = (item: StyleItem): WornStyle => ({
  id: item.id,
  name: item.name,
  url: styleImage(item.image_path),
  x: item.x,
  y: item.y,
  width: item.width,
  rotation: item.rotation,
  flipped: item.flipped,
  layer: item.layer,
})

export default function MyAvatar() {
  const { profile, refreshProfile } = useAuth()
  const say = useToast()
  useTitle('My Avatar')

  const [tab, setTab] = useState<'wardrobe' | 'faces'>('wardrobe')
  const [slot, setSlot] = useState<StyleItem['slot'] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const wardrobe = useAsync(myStyle, [])
  const faces = useAsync(myFaces, [])

  /*
   * What is worn is read from the wardrobe rather than kept beside it. A
   * second copy would be a second thing to put right after every change,
   * and the two would disagree the first time one of them failed.
   */
  const owned = wardrobe.data ?? []
  const wearing = owned.filter((one) => one.worn).map(asWorn)
  const showing = slot ? owned.filter((one) => one.slot === slot) : owned

  const face = profile?.avatar_url ?? null

  const change = async (what: string, run: () => Promise<void>) => {
    setBusy(what)
    try {
      await run()
      await Promise.all([wardrobe.reload(), refreshProfile()])
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(null)
    }
  }

  /*
   * A guest has no wardrobe to show - nothing they take is kept past the
   * browser they took it in. So this says that, rather than showing an empty
   * page that reads as a fault.
   */
  if (profile?.is_guest) {
    return (
      <Page>
        <EmptyState
          title="An avatar needs an account"
          body="A guest can look around, but there is nowhere to keep a face and a hat. Make an account and everything you pick stays yours."
          action={<Button to="/signup" variant="yes">Make an account</Button>}
        />
      </Page>
    )
  }

  return (
    <Page className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- you */}
        <div className="space-y-4">
          <Card className="space-y-4 p-6">
            <div className="mx-auto w-full max-w-[18rem]">
              <FaceStage
                src={face}
                name={profile?.display_name ?? 'You'}
                items={wearing}
                className="w-full"
              />
            </div>

            <div className="text-center">
              <p className="font-display text-lg">{profile?.display_name}</p>
              <p className="text-sm text-muted">@{profile?.username}</p>
            </div>

            <p className="text-center text-xs text-muted">
              This is exactly how you appear to everybody else — on a card, on
              a profile, beside anything you say.
            </p>
          </Card>

          {/* Taking things off, from the picture rather than from a list
              somewhere else. */}
          <Card className="space-y-3 p-4">
            <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-wider">
              <FontAwesomeIcon icon={faShirt} className="text-white/40" />
              Wearing
              <Badge>{wearing.length}</Badge>
            </h2>

            {wearing.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing on yet. Put something on from your wardrobe, or go
                and find something.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {owned.filter((one) => one.worn).map((item) => (
                  <button
                    key={item.id}
                    disabled={busy === item.id}
                    onClick={() => change(item.id, () => wearStyleItem(item.id, false))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-raised px-2 py-1 text-xs font-bold text-white/75 transition-colors hover:border-danger/50 hover:text-white disabled:opacity-50"
                  >
                    {item.name}
                    <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                  </button>
                ))}
              </div>
            )}

            <Button to="/style" variant="subtle" size="sm" className="w-full">
              <FontAwesomeIcon icon={faStore} />
              Find more in the Catalog
            </Button>
          </Card>
        </div>

        {/* -------------------------------------------- what you can put on */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 font-display text-2xl">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-brand-bright" />
                My Avatar
              </h1>
              <p className="text-sm text-muted">
                Everything you own, and every face you have.
              </p>
            </div>
            <Tabs
              look="line"
              label="Wardrobe or faces"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'wardrobe' as const, label: 'Wardrobe', count: owned.length || null },
                { value: 'faces' as const, label: 'Faces', count: faces.data?.length ?? null },
              ]}
            />
          </div>

          {tab === 'wardrobe' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                <SlotChip label="Everything" on={slot === null} onPick={() => setSlot(null)} />
                {slots.map((one) => (
                  <SlotChip
                    key={one.value}
                    label={one.label}
                    count={owned.filter((it) => it.slot === one.value).length}
                    on={slot === one.value}
                    onPick={() => setSlot(one.value)}
                  />
                ))}
              </div>

              {wardrobe.loading && <Skeleton className="h-64" />}

              {!wardrobe.loading && showing.length === 0 && (
                <EmptyState
                  title={slot ? 'Nothing of that kind yet' : 'Your wardrobe is empty'}
                  body="Anything you take from the Catalog turns up here, ready to put on."
                  action={<Button to="/style" variant="yes">Open the Catalog</Button>}
                />
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {showing.map((item) => (
                  <Card key={item.id} className="space-y-2 p-3">
                    {/*
                      * Shown on your own face rather than on its own, so
                      * what you are looking at is the thing you would get
                      * rather than a picture of it floating.
                      */}
                    <FaceStage
                      src={face}
                      name={profile?.display_name ?? 'You'}
                      items={[asWorn(item)]}
                      className="w-full"
                    />
                    <p className="truncate text-sm font-bold">{item.name}</p>
                    <Button
                      size="sm"
                      variant={item.worn ? 'subtle' : 'yes'}
                      disabled={busy === item.id}
                      onClick={() => change(item.id, () => wearStyleItem(item.id, !item.worn))}
                      className="w-full"
                    >
                      {item.worn ? (
                        <><FontAwesomeIcon icon={faXmark} />Take off</>
                      ) : (
                        <><FontAwesomeIcon icon={faCheck} />Put on</>
                      )}
                    </Button>
                  </Card>
                ))}
              </div>
            </>
          )}

          {tab === 'faces' && (
            <>
              {faces.loading && <Skeleton className="h-64" />}

              {!faces.loading && (faces.data?.length ?? 0) === 0 && (
                <EmptyState
                  title="No faces yet"
                  body="A face is the picture underneath everything else. Yours is whatever you uploaded until you take one."
                  action={<Button to="/style" variant="yes">Find a face</Button>}
                />
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {(faces.data ?? []).map((one: Face) => {
                  const mine = face === faceUrl(one.image_path)
                  return (
                    <Card key={one.id} className="space-y-2 p-3">
                      <FaceStage
                        src={faceUrl(one.image_path)}
                        name={one.name}
                        items={wearing}
                        className="w-full"
                      />
                      <p className="truncate text-sm font-bold">{one.name}</p>
                      <Button
                        size="sm"
                        variant={mine ? 'subtle' : 'yes'}
                        disabled={busy === one.id || mine}
                        onClick={() => change(one.id, () => wearFace(one.id))}
                        className="w-full"
                      >
                        <FontAwesomeIcon icon={mine ? faCheck : faFaceSmile} />
                        {mine ? 'Wearing' : 'Wear it'}
                      </Button>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  )
}

function SlotChip({ label, count, on, onPick }: {
  label: string
  count?: number
  on: boolean
  onPick: () => void
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        'rounded-lg border px-3 py-1.5 font-display text-xs uppercase tracking-wide transition-colors',
        on
          ? 'border-brand bg-brand/15 text-link'
          : 'border-ink-line bg-ink-raised text-white/60 hover:text-white',
      )}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 text-white/35">{count}</span>}
    </button>
  )
}
