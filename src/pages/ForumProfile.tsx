import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  faArrowUpRightFromSquare, faUserPlus, faFlag, faPen, faCheck, faComment,
  faCalendarDays, faEllipsis,
} from '@fortawesome/free-solid-svg-icons'
import { faDiscord } from '@fortawesome/free-brands-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Glyph } from '@/components/brand/Glyph'
import { Menu } from '@/components/ui/Menu'
import { NameMarks } from '@/components/brand/Verified'
import { Skeleton, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { ReportDialog } from '@/components/social/ReportDialog'
import { usePersonActions } from '@/components/social/personActions'
import { ForumShell, BOARD_COLOUR } from '@/components/forum/Shell'
import { Markup } from '@/components/forum/Markup'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useExactTitle } from '@/hooks/useTitle'
import {
  forumBoards, forumPostsOf, forumProfile, forumTagList, sendFriendRequest,
  setForumProfile, standingWith,
} from '@/lib/api'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ForumPerson, ForumTagOption, ForumWritten } from '@/types/db'

/**
 * Somebody, on the forum.
 *
 * Staw: "i want forum profiles (a bit more professioanl, same pfp, by
 * default the same bio as your normal profile but if you edit your forum
 * profile bio then it'll be different, discord handle if connected, badges
 * ofc, username, button to see kobblon profile, add friend, block/ignore,
 * report, and see all posts and we see the tag, editable directly onto that
 * profile page)".
 *
 * More professional meaning: no cover art, no Brix, no badges wall, no
 * Worlds. What is on this page is what somebody reading a thread wants to
 * know about the person who wrote it - who they are, what they do, how
 * long they have been here, how much they have written, and how to reach
 * the rest of them. The Kobblon profile is one button away and is where
 * everything else lives.
 *
 * The bio is the Kobblon one until the day they write a forum one, and the
 * database answers that at the moment of use rather than copying it here -
 * a copy taken once would still be quoting a sentence somebody rewrote
 * last year.
 *
 * Editable in place, by the person it belongs to and nobody else. The
 * server decides that; `is_me` only decides what is drawn.
 */
export default function ForumProfile() {
  const { username = '' } = useParams()
  const { profile: me } = useAuth()
  const toast = useToast()

  const [person, setPerson] = useState<ForumPerson | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [reporting, setReporting] = useState(false)

  const boards = useAsync(forumBoards, [])
  const tags = useAsync(forumTagList, [])

  const read = async () => {
    setLoading(true)
    const one = await forumProfile(username)
    setPerson(one)
    setLoading(false)
    return one
  }

  useEffect(() => { void read() /* eslint-disable-next-line */ }, [username])

  const written = useAsync(
    () => (person ? forumPostsOf(person.user_id, 30) : Promise.resolve([])),
    [person?.user_id],
  )

  const standing = useAsync(
    () => (person && me && !person.is_me
      ? standingWith(person.user_id)
      : Promise.resolve(null)),
    [person?.user_id, me?.id],
  )

  const actions = usePersonActions(() => void standing.reload())

  useExactTitle(person ? `${person.display_name} | Kobblon Forum` : 'Kobblon Forum')

  if (loading) {
    return (
      <ForumShell boards={boards.data ?? []} loading={boards.loading}>
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="mt-5 h-64 rounded-2xl" />
      </ForumShell>
    )
  }

  if (!person) {
    return (
      <ForumShell boards={boards.data ?? []} loading={boards.loading}>
        <div className="rounded-2xl border border-white/10 py-16">
          <EmptyState
            title="Nobody here by that name."
            body="The account may have been closed, or the name may have been changed."
            action={<Button to="/forum" variant="subtle">Back to the forum</Button>}
          />
        </div>
      </ForumShell>
    )
  }

  const them = {
    id: person.user_id,
    display_name: person.display_name,
    username: person.username,
  }

  return (
    <ForumShell boards={boards.data ?? []} loading={boards.loading}>
      <div className="max-w-4xl">
        <header className="rounded-2xl border border-white/10 bg-ink-card/40 p-6">
          <div className="flex flex-wrap items-start gap-5">
            <Avatar
              src={person.avatar_url}
              name={person.display_name}
              personId={person.user_id}
              size="xl"
            />

            <div className="min-w-0 flex-1">
              <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-2xl font-extrabold tracking-tight">
                <span className="truncate">{person.display_name}</span>
                <NameMarks id={person.user_id} className="text-[0.7em]" />
              </h1>
              <p className="mt-0.5 text-sm font-bold text-white/35">@{person.username}</p>

              {person.tag_labels.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {person.tags.map((code, i) => (
                    <span
                      key={code}
                      className={cn(
                        'rounded-lg border px-2 py-0.5 text-[11px] font-extrabold',
                        /* Staff is the given one, so it is the one in our
                           own blue; a word somebody chose is quieter. */
                        code === 'staff'
                          ? 'border-brand-bright/40 bg-brand/15 text-brand-bright'
                          : 'border-white/15 bg-white/[0.07] text-white/65',
                      )}
                    >
                      {person.tag_labels[i]}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-white/40">
                <span className="inline-flex items-center gap-1.5">
                  <Glyph icon={faCalendarDays} className="text-[11px]" />
                  Here since {timeAgo(person.joined_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Glyph icon={faComment} className="text-[11px]" />
                  {formatCount(person.topic_count)} topics
                  {' · '}
                  {formatCount(person.post_count)} replies
                </span>
                {person.discord && (
                  <span className="inline-flex items-center gap-1.5">
                    <Glyph icon={faDiscord} className="text-[11px] text-[#5865F2]" />
                    {person.discord}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* What they have written about themselves. */}
          <div className="mt-5 border-t border-white/[0.07] pt-5">
            {editing ? (
              <EditProfile
                person={person}
                options={tags.data ?? []}
                onDone={async () => { setEditing(false); await read() }}
                onCancel={() => setEditing(false)}
              />
            ) : person.bio ? (
              <Markup body={person.bio} className="text-sm text-white/70" />
            ) : (
              <p className="text-sm text-white/30">
                {person.is_me
                  ? 'You have not said anything about yourself yet.'
                  : 'They have not said anything about themselves.'}
              </p>
            )}
          </div>

          {!editing && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                to={`/u/${person.username}`}
                size="sm"
                variant="subtle"
                icon={faArrowUpRightFromSquare}
              >
                Kobblon profile
              </Button>

              {person.is_me ? (
                <Button size="sm" variant="ghost" icon={faPen} onClick={() => setEditing(true)}>
                  Edit forum profile
                </Button>
              ) : me ? (
                <>
                  {!standing.data?.are_friends && !standing.data?.request_sent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={faUserPlus}
                      onClick={async () => {
                        try {
                          await sendFriendRequest(me.id, person.user_id)
                          toast('Asked.', 'success')
                          standing.reload()
                        } catch (wrong) {
                          toast(
                            wrong instanceof Error ? wrong.message : 'That did not send.',
                            'error',
                          )
                        }
                      }}
                    >
                      Add friend
                    </Button>
                  )}
                  {standing.data?.request_sent && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-white/40">
                      <Glyph icon={faCheck} className="text-[11px]" />
                      Asked
                    </span>
                  )}
                  {standing.data?.are_friends && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-space/40 bg-space/10 px-2.5 py-1.5 text-xs font-bold text-space-bright">
                      <Glyph icon={faCheck} className="text-[11px]" />
                      Friends
                    </span>
                  )}

                  <Menu
                    label={`What to do about ${person.display_name}`}
                    items={actions.itemsFor(them, standing.data ?? {}, {
                      onReport: () => setReporting(true),
                    })}
                    trigger={
                      <span className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white">
                        <Glyph icon={faEllipsis} />
                      </span>
                    }
                  />
                </>
              ) : (
                <Button size="sm" variant="ghost" icon={faFlag} to="/login">
                  Sign in to report
                </Button>
              )}
            </div>
          )}
        </header>

        <Written rows={written.data ?? []} loading={written.loading} who={person} />
      </div>

      {actions.dialog}

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="profile"
        targetId={person.user_id}
        targetName={person.display_name}
      />
    </ForumShell>
  )
}

/* ------------------------------------------------------------- editing */

/**
 * The tag and the bio, on the page they belong to.
 *
 * Staw: "editable directly onto that profile page". So no settings page
 * and no dialog - the card turns into the form and back.
 *
 * The automatic tag is not in the list, because it is not a choice. It is
 * named underneath instead, so somebody wearing it knows why it is there
 * rather than going looking for the switch that turns it off.
 */
function EditProfile({
  person, options, onDone, onCancel,
}: {
  person: ForumPerson
  options: ForumTagOption[]
  onDone: () => void | Promise<void>
  onCancel: () => void
}) {
  const toast = useToast()
  /* The chosen one, which is the tag that is not the automatic one. */
  const [tag, setTag] = useState(person.tags.find((one) => one !== 'staff') ?? '')
  const [bio, setBio] = useState(person.bio_is_own ? (person.bio ?? '') : '')
  const [saving, setSaving] = useState(false)

  const pickable = options.filter((one) => !one.automatic)
  const given = person.tags.includes('staff')

  const save = async () => {
    setSaving(true)
    try {
      await setForumProfile(tag || null, bio.trim() || null)
      await onDone()
    } catch (wrong) {
      toast(wrong instanceof Error ? wrong.message : 'That did not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        What you do
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pick on={tag === ''} onPress={() => setTag('')}>No tag</Pick>
        {pickable.map((one) => (
          <Pick key={one.code} on={tag === one.code} onPress={() => setTag(one.code)}>
            {one.label}
          </Pick>
        ))}
      </div>
      {given && (
        <p className="mt-2 text-xs text-white/35">
          Staff is given rather than chosen, so it stays beside whichever of these you pick.
        </p>
      )}

      <p className="mt-6 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        About you, on the forum
      </p>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value.slice(0, 500))}
        rows={4}
        placeholder={
          person.bio_is_own
            ? 'Say something about yourself.'
            : 'Leave this empty to keep using your Kobblon bio.'
        }
        className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-brand-bright"
      />
      <p className="mt-1.5 text-xs text-white/30">
        {bio.trim()
          ? `${bio.length} of 500`
          : 'Empty means your Kobblon bio is used here, and keeps up with it when you change it.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="yes" loading={saving} onClick={() => void save()}>Save</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function Pick({ on, onPress, children }: {
  on: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={on}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-xs font-extrabold transition-colors',
        on
          ? 'border-brand-bright bg-brand/20 text-white'
          : 'border-white/10 bg-ink-raised text-white/55 hover:border-white/25 hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------ what they wrote */

function Written({
  rows, loading, who,
}: {
  rows: ForumWritten[]
  loading: boolean
  who: ForumPerson
}) {
  return (
    <section className="mt-8">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">
        Everything they have written
      </p>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-white/35">
          {who.is_me ? 'You have not posted yet.' : 'Nothing yet.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-ink-card/40">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`}>
              <Link
                to={row.kind === 'topic' ? `/forum/t/${row.id}` : `/forum/t/${row.topic_id}#post-${row.id}`}
                className="group block px-4 py-3.5 transition-colors hover:bg-white/[0.03]"
              >
                <span className="flex items-center gap-2">
                  <span className={cn(
                    'h-2 w-2 shrink-0 rounded-sm',
                    BOARD_COLOUR[row.category] ?? 'bg-white/30',
                  )} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white/85 transition-colors group-hover:text-brand-bright">
                    {row.title}
                  </span>
                  <span className="shrink-0 rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/45">
                    {row.kind === 'topic' ? 'Topic' : 'Reply'}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-white/40">{row.body}</span>
                <span className="mt-1 block text-[11px] font-bold text-white/25">
                  {row.category_name} · {timeAgo(row.created_at)}
                  {row.edited_at && ' (edited)'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
