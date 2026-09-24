import { supabase } from './supabase'
import { canPreview, previewOf, previewOfUrl } from './preview'
import type {
  ActivityEvent, AssetKind, Community, EarnedBadge, MarketAsset,
  MemberCommunity, Message, Notification, OwnAsset, PixelTransaction, PlatformStats, Profile,
  ProfileOverview, Space, SpaceBadge, SpaceCategory, SpaceMessage, SpaceStats, Conversation,
  CommunityMember, CommunityOverview, CommunityPost, CommunityRank, CommunityRequest,
  CommunityRelation, CommunityBan, CommunityAuditEntry,
  AssetPageItem, AssetDay, CreatorAssetRow, Collaborator, UsernameRecord,
  AssetRequest, OwnedAsset, AssetReview, CreatorPage,
  CommunityEvent, EventPage, EventAttendee, BuildTarget, CommunityMoneyRow,
  AccountStanding, Violation, Appeal, Letter, Ticket, TicketMessage, TicketTopic,
  World,
  WorldGenre, WorldMedium, WorldMaturity, WorldStanding,
  Face,
} from '@/types/db'

const SPACE_FIELDS =
  'id, owner_id, slug, name, description, category, cover_url, is_published, visit_count, ' +
  'like_count, favorite_count, dislike_count, update_count, published_at, created_at, updated_at, ' +
  'emblem_url, thumbnail_urls, genre, content_id, ' +
  'chat_enabled, chat_greeting, chat_slowmode_seconds, ' +
  'owner:profiles!spaces_owner_id_fkey (id, username, display_name, avatar_url, is_online, is_admin, is_guest)'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

// ------------------------------------------------------------------ public

export async function getPlatformStats(): Promise<PlatformStats> {
  const rows = unwrap(await supabase.rpc('platform_stats'))
  return (Array.isArray(rows) ? rows[0] : rows) as PlatformStats
}

export async function getRecentActivity(limit = 12): Promise<ActivityEvent[]> {
  return unwrap(await supabase.rpc('recent_activity', { limit_count: limit })) ?? []
}

// ------------------------------------------------------------------ spaces

export type SpaceSort = 'trending' | 'new' | 'popular'

export async function listSpaces(options: {
  sort?: SpaceSort
  category?: SpaceCategory | 'all'
  search?: string
  limit?: number
} = {}): Promise<Space[]> {
  const { sort = 'trending', category = 'all', search, limit = 24 } = options
  let query = supabase.from('spaces').select(SPACE_FIELDS).eq('is_published', true).limit(limit)

  if (category !== 'all') query = query.eq('category', category)
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)

  query = sort === 'new'
    ? query.order('published_at', { ascending: false })
    : sort === 'popular'
      ? query.order('like_count', { ascending: false })
      : query.order('visit_count', { ascending: false })

  return (unwrap(await query) as unknown as Space[]) ?? []
}

export async function listSpacesByOwner(ownerId: string, includeDrafts: boolean): Promise<Space[]> {
  let query = supabase.from('spaces').select(SPACE_FIELDS).eq('owner_id', ownerId)
  if (!includeDrafts) query = query.eq('is_published', true)
  return (unwrap(await query.order('updated_at', { ascending: false })) as unknown as Space[]) ?? []
}

export async function getSpace(username: string, slug: string): Promise<Space | null> {
  const owner = await getProfileByUsername(username)
  if (!owner) return null
  const { data, error } = await supabase
    .from('spaces').select(SPACE_FIELDS).eq('owner_id', owner.id).eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Space | null) ?? null
}

export async function logSpaceUpdate(spaceId: string, note: string) {
  unwrap(await supabase.from('space_updates').insert({ space_id: spaceId, note: note || null }).select('id').single())
}

export async function leaveSpace() {
  await supabase.rpc('leave_space')
}

export async function hasLiked(spaceId: string, userId: string) {
  const { data } = await supabase
    .from('space_likes').select('space_id').eq('space_id', spaceId).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

/*
 * Guests are kept out of anything that leaves a mark, by the database rather
 * than by hiding buttons. That refusal arrives as a policy error, which is
 * nobody's idea of an explanation, so it is turned into a sentence here
 * rather than at every button that could hit it.
 */
const guestWords: Record<string, string> = {
  space_likes: 'Guests cannot like Spaces. Make an account and you can.',
  space_dislikes: 'Guests cannot rate Spaces. Make an account and you can.',
  space_favorites: 'Guests cannot keep Spaces. Make an account and you can.',
  space_watchers: 'Guests cannot follow a Space. Make an account and you can.',
}

function markError(table: string, message: string) {
  return new Error(
    message.includes('row-level security')
      ? guestWords[table] ?? 'Guests cannot do that. Make an account and you can.'
      : message,
  )
}

export async function setLiked(spaceId: string, userId: string, liked: boolean) {
  const result = liked
    ? await supabase.from('space_likes').insert({ space_id: spaceId, user_id: userId })
    : await supabase.from('space_likes').delete().eq('space_id', spaceId).eq('user_id', userId)
  if (result.error) throw markError('space_likes', result.error.message)
}

// ---------------------------------------------------------------- profiles

/** The name behind a number, for a link like /u/1042/stawrer. */
/**
 * Where an address that has moved goes now: a Space or Community slug that
 * changed with its name, or a username somebody used to have.
 */
export async function addressNow(
  kind: 'space' | 'community' | 'person',
  old: string,
): Promise<string | null> {
  return (unwrap(await supabase.rpc('address_now', { kind, old_slug: old })) as string | null) ?? null
}

// ------------------------------------------------------------------ Discord

/**
 * Starting a Discord link. The function answers with where to send somebody;
 * the exchange, and the writing of the tie, happen where the secret lives.
 */
export async function startDiscordLink(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>('discord/start')

  if (error) {
    /*
     * Saying "not set up" for every failure hid a missing deployment behind a
     * missing secret. The function says which it is; anything else is said as
     * itself.
     */
    const status = (error as { context?: { status?: number } }).context?.status
    if (status === 404) throw new Error('The Discord function is not deployed yet.')
    if (status === 503) throw new Error('Discord is not set up on this Kobblon yet.')
    if (status === 401) throw new Error('Sign in again, then try connecting Discord.')
    throw new Error(error.message || 'Discord could not be reached just now.')
  }

  if (!data?.url) throw new Error('Discord did not say where to go.')
  return data.url
}

export async function unlinkDiscord() {
  unwrap(await supabase.rpc('unlink_discord'))
}

/** Who may see your Discord handle. Your display name is on your profile either way. */
export type DiscordVisibility = 'everyone' | 'friends' | 'nobody'

export async function setDiscordVisibility(whoSees: DiscordVisibility) {
  unwrap(await supabase.rpc('set_discord_visibility', { who_sees: whoSees }))
}

/** Somebody's handle, when they have said you may have it. */
export async function discordHandleOf(userId: string): Promise<string | null> {
  return (unwrap(await supabase.rpc('discord_handle_of', { target: userId })) as string | null) ?? null
}

/** The Kobblon account a Discord id belongs to, if it belongs to one. */
export async function profileByDiscord(
  discord: string,
): Promise<{ username: string; content_id: number | null } | null> {
  const rows = unwrap(await supabase.rpc('profile_by_discord', { discord }))
  return (Array.isArray(rows) ? rows[0] : rows) ?? null
}

export async function usernameById(contentId: number): Promise<string | null> {
  return (unwrap(await supabase.rpc('username_by_id', { target: contentId })) as string | null) ?? null
}

export async function spaceById(contentId: number): Promise<{ owner_username: string; slug: string } | null> {
  const rows = unwrap(await supabase.rpc('space_by_id', { target: contentId })) as
    { owner_username: string; slug: string }[]
  return rows?.[0] ?? null
}

export async function communitySlugById(contentId: number): Promise<string | null> {
  return (unwrap(await supabase.rpc('community_by_id', { target: contentId })) as string | null) ?? null
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles').select('*').ilike('username', username).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

/**
 * Everyone matches, yourself included: People is a directory, not a list of
 * strangers, so searching your own name has to find you. Friends passes
 * `excludeId` because you cannot befriend yourself.
 */
export async function searchProfiles(
  term: string, excludeId?: string, limit = 12,
): Promise<Profile[]> {
  if (!term.trim()) return []
  let query = supabase.from('profiles').select('*')
    .or(`username.ilike.%${term.trim()}%,display_name.ilike.%${term.trim()}%`)
    .order('username').limit(limit)
  if (excludeId) query = query.neq('id', excludeId)
  return (unwrap(await query) as Profile[]) ?? []
}

export type PeopleSort = 'active' | 'new' | 'name'

/**
 * Everybody, for the People page. Unlike searchProfiles this leaves nobody
 * out: your own account is in the list, and so are guests, because they are
 * here the same as anybody else and hiding them would be a lie about who is
 * on the platform.
 */
export async function listPeople(
  { search = '', sort = 'active', limit = 48 }:
  { search?: string; sort?: PeopleSort; limit?: number } = {},
): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').limit(limit)

  const term = search.trim()
  if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%,bio.ilike.%${term}%`)

  query = sort === 'new'
    ? query.order('created_at', { ascending: false })
    : sort === 'name'
      ? query.order('username')
      : query.order('is_online', { ascending: false }).order('last_seen_at', { ascending: false })

  return (unwrap(await query) as Profile[]) ?? []
}

/**
 * A guest deciding to stay. The email and password are linked to the same
 * account by Supabase before this runs, so nothing they did is lost.
 */
export async function claimGuestAccount(details: {
  username: string
  displayName: string
  birthDate: string
  gender: string
  avatarUrl: string | null
}) {
  unwrap(await supabase.rpc('claim_guest_account', {
    new_username: details.username,
    new_display_name: details.displayName,
    new_birth_date: details.birthDate,
    new_gender: details.gender || null,
    new_avatar_url: details.avatarUrl,
  }))
}

/** What a name change costs. The database charges it; this is for the copy. */
export const USERNAME_CHANGE_COST = 250

export async function changeUsername(name: string): Promise<string> {
  return unwrap(await supabase.rpc('change_username', { new_name: name })) as string
}

export async function usernameHistory(userId: string): Promise<UsernameRecord[]> {
  return (unwrap(await supabase.rpc('username_history_of', { target: userId })) as UsernameRecord[]) ?? []
}

export async function updateProfile(id: string, patch: Partial<Pick<Profile,
  'display_name' | 'bio' | 'avatar_url' | 'username' | 'accent_color'>>) {
  unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('id').single())
}

/**
 * Saying that somebody is here, and what they are doing. Called on a minute
 * by the page frame rather than once at sign in, which is what makes the
 * little dots mean anything.
 */
export async function touchPresence(online: boolean, doing?: 'around' | 'building') {
  await supabase.rpc('touch_presence', { online, doing: doing ?? null })
}

/** Anybody who stopped saying anything is no longer online. */
export async function sweepPresence() {
  await supabase.rpc('sweep_presence')
}

// ----------------------------------------------------------------- friends

/** Where you stand with one person, answered in one go. */
export type Standing = {
  are_friends: boolean
  request_sent: boolean
  request_received: boolean
  request_id: string | null
  friendship_id: string | null
  i_follow: boolean
  follows_me: boolean
  i_blocked: boolean
  they_blocked: boolean
  i_ignore: boolean
}

/** One person in one of the lists on the friends page. */
export type PersonRow = Profile & {
  since: string
  /** Guests wear the guest face, so the lists carry that too. */
  link_id: string | null
  i_ignore: boolean
}

/** The lists a friends page can draw. */
export type PeopleList =
  'friends' | 'requests' | 'sent' | 'followers' | 'following' | 'blocked' | 'ignored'

export async function standingWith(target: string): Promise<Standing> {
  const rows = unwrap(await supabase.rpc('standing_with', { target }))
  const row = (Array.isArray(rows) ? rows[0] : rows) as Standing | undefined
  return row ?? {
    are_friends: false, request_sent: false, request_received: false,
    request_id: null, friendship_id: null, i_follow: false, follows_me: false,
    i_blocked: false, they_blocked: false, i_ignore: false,
  }
}

export async function peopleList(target: string, which: PeopleList): Promise<PersonRow[]> {
  return (unwrap(await supabase.rpc('people_list', { target, which })) as PersonRow[]) ?? []
}

export async function sendFriendRequest(requesterId: string, addresseeId: string) {
  unwrap(await supabase.from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId }).select('id').single())
}

export async function respondToFriendRequest(id: string, accept: boolean) {
  if (!accept) {
    const { error } = await supabase.from('friendships').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return
  }
  unwrap(await supabase.from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', id).select('id').single())
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from('friendships').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Stopping being friends with somebody whose friendship you have not got to hand. */
export async function unfriend(userId: string, otherId: string) {
  const { error } = await supabase.from('friendships').delete()
    .or(`and(requester_id.eq.${userId},addressee_id.eq.${otherId}),` +
        `and(requester_id.eq.${otherId},addressee_id.eq.${userId})`)
  if (error) throw new Error(error.message)
}

// ------------------------------------------------------- blocking, ignoring

/**
 * Blocking undoes the friendship, both follows and any request either way,
 * and nothing can be built back across it until it is lifted. Ignoring leaves
 * all of that standing and only stops them reaching you.
 */
export async function blockPerson(targetId: string) {
  unwrap(await supabase.rpc('block_person', { target: targetId }))
}

export async function unblockPerson(targetId: string) {
  unwrap(await supabase.rpc('unblock_person', { target: targetId }))
}

export async function ignorePerson(targetId: string) {
  unwrap(await supabase.rpc('ignore_person', { target: targetId }))
}

export async function unignorePerson(targetId: string) {
  unwrap(await supabase.rpc('unignore_person', { target: targetId }))
}

// -------------------------------------------------------------------- chat

export async function startConversation(otherId: string): Promise<string> {
  return unwrap(await supabase.rpc('start_conversation', { other: otherId })) as string
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const rows = unwrap(await supabase.from('messages')
    .select('id, conversation_id, sender_id, body, created_at, edited_at, is_removed')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false }).limit(100)) as Message[]
  return (rows ?? []).reverse()
}

export async function editMessage(id: number, body: string) {
  unwrap(await supabase.from('messages').update({ body: body.trim() })
    .eq('id', id).select('id').single())
}

export async function deleteMessage(id: number) {
  unwrap(await supabase.from('messages').update({ is_removed: true })
    .eq('id', id).select('id').single())
}

/**
 * Everyone you can talk to, whether or not you have yet. Friends with an
 * existing conversation carry it; the rest open one on first message.
 */
export async function chatRoster(): Promise<Conversation[]> {
  const [conversations, friends] = await Promise.all([
    myConversations(),
    supabase.auth.getUser().then(({ data }) =>
      data.user ? peopleList(data.user.id, 'friends') : []),
  ])

  const spokenTo = new Set(
    conversations.flatMap((c) => (c.is_group ? [] : c.members.map((m) => m.id))),
  )

  // Friends you have never written to still belong in the list; somebody who
  // is no longer a friend does not, and the database leaves their chat out.
  const quiet = friends
    .filter((person) => !spokenTo.has(person.id))
    .map<Conversation>((person) => ({
      id: `friend:${person.id}`,
      title: null,
      is_group: false,
      last_message_at: person.since,
      last_message: null,
      unread_count: 0,
      ignored: person.i_ignore,
      members: [{
        id: person.id,
        username: person.username,
        display_name: person.display_name,
        avatar_url: person.avatar_url,
        is_online: person.is_online,
        in_space_id: person.in_space_id,
      }],
    }))

  return [...conversations, ...quiet]
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  unwrap(await supabase.from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('id, conversation_id, sender_id, body, created_at').single())
}

export async function markConversationRead(conversationId: string, userId: string) {
  await supabase.from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', userId)
}

// ----------------------------------------------------------- notifications

export async function listNotifications(userId: string): Promise<Notification[]> {
  return (unwrap(await supabase.from('notifications')
    .select('*, actor:profiles!actor_id (username, display_name, avatar_url, is_guest), ' +
      'space:spaces!space_id (name, slug), world:worlds!world_id (name, slug, content_id)')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(40)) as unknown as Notification[]) ?? []
}

export async function markNotificationsRead(userId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
}

// ------------------------------------------------------------- moderation

export async function submitReport(input: {
  reporterId: string
  targetType: 'profile' | 'space' | 'message' | 'ad' | 'asset' | 'community' | 'style'
  targetId: string
  reason: string
  details: string
}) {
  unwrap(await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details || null,
  }).select('id').single())
}

// ------------------------------------------------------- Kobblon Create

export const assetBucket = 'uploads'

/*
 * The bucket the cards read from. It holds a small picture of a piece of
 * content and nothing else: the work itself stays in the private bucket
 * above. A preview exists only while the content is listed in Create, which
 * is exactly while its page shows the same picture to anybody.
 */
export const previewBucket = 'previews'

export function previewUrl(path?: string | null): string | null {
  if (!path) return null
  return supabase.storage.from(previewBucket).getPublicUrl(path).data.publicUrl
}

/**
 * Draws a preview for a piece of content and hangs it on the row, so a link
 * to it pasted anywhere shows the work rather than a Kobblon banner.
 *
 * Nothing depends on this working: a browser that cannot decode the file, or
 * a network that drops, leaves the content without a picture and everything
 * else carries on.
 */
export async function makeAssetPreview(input: {
  assetId: string
  userId: string
  kind: AssetKind
  file?: File
  url?: string | null
}): Promise<string | null> {
  if (!canPreview(input.kind)) return null

  const drawn = input.file
    ? await previewOf(input.file, input.kind)
    : input.url
      ? await previewOfUrl(input.url, input.kind)
      : null
  if (!drawn) return null

  const path = `${input.userId}/${crypto.randomUUID()}.jpg`
  const put = await supabase.storage
    .from(previewBucket)
    .upload(path, drawn, { contentType: 'image/jpeg', upsert: false })
  if (put.error) return null

  const saved = await supabase.from('assets')
    .update({ preview_path: path }).eq('id', input.assetId).select('id').single()
  if (saved.error) {
    await supabase.storage.from(previewBucket).remove([path])
    return null
  }

  return path
}

/** Takes a preview down, for content that has been unlisted or deleted. */
export async function removeAssetPreview(path?: string | null) {
  if (!path) return
  await supabase.storage.from(previewBucket).remove([path])
}

/** What a piece of content is currently pointing at, if anything. */
export async function assetPreviewPath(assetId: string): Promise<string | null> {
  const { data } = await supabase.from('assets')
    .select('preview_path').eq('id', assetId).maybeSingle()
  return (data as { preview_path?: string | null } | null)?.preview_path ?? null
}

/**
 * Uploads live in a private bucket, so there is no lasting link to a file.
 * A preview asks for a short-lived signed URL instead, and only gets one for
 * content that is listed or for your own files.
 *
 * This keeps the file from being addressable. It cannot stop a browser from
 * showing a picture it has been given, and nothing here pretends it can:
 * what protects the work is that using it in a Space goes through the
 * permission check, not that the pixels are unreachable.
 */
export async function assetUrl(path: string, seconds = 900): Promise<string | null> {
  const { data } = await supabase.storage.from(assetBucket).createSignedUrl(path, seconds)
  return data?.signedUrl ?? null
}

/**
 * A Space stores a reference, not a file: "kob://IMG-1042". Resolving one
 * looks the item up and asks for a short-lived link to show it. The answers
 * are kept for the life of the page so a grid of tiles does not ask twice
 * for the same thing.
 */
const refCache = new Map<string, Promise<string | null>>()

export const isAssetRef = (value?: string | null): value is string =>
  typeof value === 'string' && value.startsWith('kob://')

export function assetRefTag(value: string) {
  return value.replace('kob://', '').toUpperCase()
}

export function resolveAssetRef(value: string): Promise<string | null> {
  const cached = refCache.get(value)
  if (cached) return cached

  const work = (async () => {
    const number = Number(assetRefTag(value).split('-')[1])
    if (!Number.isFinite(number)) return null
    const path = await resolveOwnedRef(number)
    if (!path) return null
    return assetUrl(path, 3600)
  })()

  refCache.set(value, work)
  return work
}

export async function rateAsset(assetId: string, up: boolean | null) {
  const { data: session } = await supabase.auth.getUser()
  const me = session.user?.id
  if (!me) throw new Error('Sign in first.')

  if (up === null) {
    unwrap(await supabase.from('asset_ratings').delete()
      .eq('asset_id', assetId).eq('user_id', me).select('asset_id'))
    return
  }
  unwrap(await supabase.from('asset_ratings')
    .upsert({ asset_id: assetId, user_id: me, up }, { onConflict: 'asset_id,user_id' })
    .select('asset_id').single())
}

export async function listAssetReviews(assetId: string): Promise<AssetReview[]> {
  return (unwrap(await supabase.rpc('asset_reviews_of', { target: assetId })) as AssetReview[]) ?? []
}

export async function writeAssetReview(assetId: string, body: string) {
  const { data: session } = await supabase.auth.getUser()
  const me = session.user?.id
  if (!me) throw new Error('Sign in first.')
  unwrap(await supabase.from('asset_reviews')
    .upsert({ asset_id: assetId, user_id: me, body: body.trim() }, { onConflict: 'asset_id,user_id' })
    .select('id').single())
}

export async function removeAssetReview(id: string) {
  unwrap(await supabase.from('asset_reviews').delete().eq('id', id).select('id'))
}

/** Other things the same person has made, for the row under an item. */
export async function listAssetsByCreator(creatorId: string, exceptId?: string): Promise<MarketAsset[]> {
  return (unwrap(await supabase.rpc('assets_by_creator', {
    target: creatorId, except_id: exceptId ?? null, limit_count: 12,
  })) as MarketAsset[]) ?? []
}

/**
 * A reference only resolves for somebody who has the thing. The id in an
 * address bar is just a number: without it being in your inventory, this
 * answers with nothing.
 */
export async function resolveOwnedRef(contentId: number): Promise<string | null> {
  const rows = unwrap(await supabase.rpc('resolve_asset_ref', {
    target_content_id: contentId,
  })) as { file_path: string }[]
  return rows?.[0]?.file_path ?? null
}

/** Putting content into a Space you own. Checked once, at that moment. */
export async function useAssetInSpace(spaceId: string, contentId: number): Promise<string> {
  return unwrap(await supabase.rpc('use_asset_in_space', {
    space: spaceId, target_content_id: contentId,
  })) as string
}

/** The file behind a reference a Space is already using, for its visitors. */
export async function spaceAssetPath(spaceId: string, contentId: number): Promise<string | null> {
  return (unwrap(await supabase.rpc('space_asset_path', {
    space: spaceId, target_content_id: contentId,
  })) as string | null) ?? null
}

export async function dropFromInventory(assetId: string) {
  unwrap(await supabase.rpc('drop_from_inventory', { target: assetId }))
}

export async function requestAssetUse(assetId: string, note: string) {
  const { data: session } = await supabase.auth.getUser()
  const me = session.user?.id
  if (!me) throw new Error('Sign in first.')
  unwrap(await supabase.from('asset_grants')
    .insert({ asset_id: assetId, user_id: me, note: note.trim() || null })
    .select('asset_id').single())
}

export async function withdrawAssetRequest(assetId: string) {
  const { data: session } = await supabase.auth.getUser()
  unwrap(await supabase.from('asset_grants').delete()
    .eq('asset_id', assetId).eq('user_id', session.user?.id ?? '').select('asset_id'))
}

export async function answerAssetRequest(assetId: string, asker: string, accept: boolean) {
  unwrap(await supabase.rpc('answer_asset_request', { target: assetId, asker, accept }))
}

export async function listAssetRequests(): Promise<AssetRequest[]> {
  return (unwrap(await supabase.rpc('asset_requests_for_me')) as AssetRequest[]) ?? []
}

/** Everything in your inventory: your own, verified, and what you have taken. */
export async function listInventory(kind?: AssetKind): Promise<OwnedAsset[]> {
  return (unwrap(await supabase.rpc('my_inventory', {
    kind_filter: kind ?? null,
  })) as OwnedAsset[]) ?? []
}

export type AssetSort = 'new' | 'used' | 'rated' | 'cheap'

export async function listAssets(options: {
  kind?: AssetKind | 'all'
  search?: string
  limit?: number
  sort?: AssetSort
  creator?: string
} = {}): Promise<MarketAsset[]> {
  const { kind = 'all', search, limit = 24, sort = 'new', creator } = options
  return unwrap(await supabase.rpc('list_assets', {
    kind_filter: kind === 'all' ? null : kind,
    search: search?.trim() || null,
    limit_count: limit,
    sort,
    creator: creator ?? null,
  })) ?? []
}

/** The most somebody may charge for each kind of thing. */
export const priceCeilings: Record<AssetKind, number> = {
  image: 100, audio: 250, video: 500, font: 300, model: 750,
}

export async function buyAsset(assetId: string) {
  unwrap(await supabase.rpc('buy_asset', { target: assetId }))
}

export async function getCreatorPage(username: string): Promise<CreatorPage | null> {
  const rows = unwrap(await supabase.rpc('creator_page', { target: username })) as CreatorPage[]
  return rows?.[0] ?? null
}

export async function listOwnAssets(userId: string): Promise<OwnAsset[]> {
  return (unwrap(await supabase.from('assets')
    .select('id, kind, name, description, file_path, status, review_note, byte_size, download_count, content_id, is_public, created_at')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })) as unknown as OwnAsset[]) ?? []
}

/** One upload with its creator, looked up by the number it carries. */
export async function getAsset(contentId: number): Promise<AssetPageItem | null> {
  const rows = unwrap(await supabase.rpc('get_asset', { target_content_id: contentId })) as AssetPageItem[]
  return rows?.[0] ?? null
}

/**
 * A view or a download. Counts, never who: the creator needs to know their
 * work is being used, not who looked at it.
 */
export async function recordAssetEvent(assetId: string, kind: 'view' | 'use') {
  await supabase.rpc('record_asset_event', { target: assetId, event_kind: kind })
}

export async function assetAnalytics(assetId: string): Promise<AssetDay[]> {
  return (unwrap(await supabase.rpc('asset_analytics', { target: assetId })) as AssetDay[]) ?? []
}

export async function creatorAnalytics(userId: string): Promise<CreatorAssetRow[]> {
  return (unwrap(await supabase.rpc('creator_analytics', { target: userId })) as CreatorAssetRow[]) ?? []
}

/**
 * A creator may rename, re-describe and unlist their own upload. Everything
 * else on the row is pinned by the database, so this cannot publish anything.
 */
/**
 * The details of an upload. Not the price: selling costs Brix, so that goes
 * through listForSale and unlistForSale, and the database ignores a price
 * written straight to the row.
 */
export async function updateAsset(id: string, patch: {
  name?: string
  description?: string | null
  is_public?: boolean
}) {
  // Taking something out of Create takes its card picture down with it. The
  // row forgets the picture by itself, so the path has to be read first.
  const dropping = patch.is_public === false ? await assetPreviewPath(id) : null

  unwrap(await supabase.from('assets').update(patch).eq('id', id).select('id').single())

  if (dropping) await removeAssetPreview(dropping)
}

/**
 * Makes sure a piece of content has a card picture, drawing one from the file
 * if it has none. Used for work uploaded before previews existed, and for
 * anything put back into Create.
 */
export async function ensureAssetPreview(asset: {
  id: string
  kind: AssetKind
  creator_id?: string | null
  file_path: string
}, me: string): Promise<string | null> {
  if (!canPreview(asset.kind)) return null
  if (await assetPreviewPath(asset.id)) return null

  const url = await assetUrl(asset.file_path, 300)
  if (!url) return null

  return makeAssetPreview({ assetId: asset.id, userId: me, kind: asset.kind, url })
}

// ------------------------------------------------------- Space collaborators

export async function listCollaborators(spaceId: string): Promise<Collaborator[]> {
  return (unwrap(await supabase.rpc('space_collaborators_list', { target: spaceId })) as Collaborator[]) ?? []
}

export async function addCollaborator(spaceId: string, userId: string) {
  unwrap(await supabase.from('space_collaborators')
    .insert({ space_id: spaceId, user_id: userId }).select('space_id').single())
}

export async function removeCollaborator(spaceId: string, userId: string) {
  unwrap(await supabase.from('space_collaborators').delete()
    .eq('space_id', spaceId).eq('user_id', userId).select('space_id'))
}

/** Spaces somebody else owns that you have been asked to work on. */
export async function listSharedSpaces(): Promise<Space[]> {
  return (unwrap(await supabase.rpc('spaces_shared_with_me')) as Space[]) ?? []
}

/**
 * Uploads the file, then records it as pending. Nothing the browser can call
 * sets a status, so an upload stays invisible until the review pipeline
 * approves it.
 */
export async function uploadAsset(input: {
  userId: string
  file: File
  kind: AssetKind
  name: string
  description: string
  /** Set when the upload is being made for a Community rather than a person. */
  communityId?: string | null
}): Promise<OwnAsset> {
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${input.userId}/${crypto.randomUUID()}.${extension}`

  /*
   * A Kobblon part file is .kbfl, which no browser has a type for, so it
   * arrives with an empty one and the bucket refuses it. It is JSON, and
   * saying so here is the difference between an upload and a shrug.
   */
  const contentType = input.file.type
    || (extension === 'kbfl' ? 'application/json' : 'application/octet-stream')

  const uploaded = await supabase.storage
    .from(assetBucket)
    .upload(path, input.file, { contentType, upsert: false })
  if (uploaded.error) throw new Error(uploaded.error.message)

  try {
    const made = unwrap(await supabase.from('assets').insert({
      creator_id: input.userId,
      kind: input.kind,
      name: input.name.trim(),
      description: input.description.trim() || null,
      file_path: path,
      byte_size: input.file.size,
      community_id: input.communityId ?? null,
    }).select('id, kind, name, description, file_path, status, review_note, byte_size, download_count, content_id, is_public, created_at')
      .single()) as unknown as OwnAsset

    // The card picture, drawn from the file that is still in hand.
    await makeAssetPreview({
      assetId: made.id, userId: input.userId, kind: input.kind, file: input.file,
    }).catch(() => null)

    return made
  } catch (err) {
    // Never leave a file in storage with no row pointing at it.
    await supabase.storage.from(assetBucket).remove([path])
    throw err
  }
}

/**
 * Deleting an upload. The database decides whether it may go and says why
 * when it may not, so a picture an ad is holding refuses with the name of the
 * ad rather than failing silently. It hands back the stored file, which is
 * taken away afterwards.
 */
export async function deleteAsset(id: string) {
  const picture = await assetPreviewPath(id)
  const path = unwrap(await supabase.rpc('delete_asset', { target: id })) as string
  if (path) await supabase.storage.from(assetBucket).remove([path])
  await removeAssetPreview(picture)
}

// --------------------------------------------------------- profile picture

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${userId}/${Date.now()}.${extension}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

// ------------------------------------------------------------- favourites

export async function isFavorite(spaceId: string, userId: string) {
  const { data } = await supabase
    .from('space_favorites').select('space_id')
    .eq('space_id', spaceId).eq('user_id', userId).maybeSingle()
  return Boolean(data)
}

export async function setFavorite(spaceId: string, userId: string, on: boolean) {
  const result = on
    ? await supabase.from('space_favorites').insert({ space_id: spaceId, user_id: userId })
    : await supabase.from('space_favorites').delete().eq('space_id', spaceId).eq('user_id', userId)
  if (result.error) throw new Error(result.error.message)
}

/** Spaces somebody might like, minus their own and minus their refusals. */
export async function listRecommended(limit = 12): Promise<Space[]> {
  return (unwrap(await supabase.rpc('recommended_spaces', { limit_count: limit })) as Space[]) ?? []
}

/** Where they have been, most recent first, one line per Space. */
export async function listRecentlyVisited(limit = 12): Promise<Space[]> {
  return (unwrap(await supabase.rpc('recently_visited', { limit_count: limit })) as Space[]) ?? []
}

/** Saying no to a recommendation, which is a promise that it stays gone. */
export async function hideSpace(spaceId: string) {
  unwrap(await supabase.rpc('hide_space', { target: spaceId }))
}

export async function listFavoriteSpaces(userId: string): Promise<Space[]> {
  const { data: rows } = await supabase
    .from('space_favorites').select('space_id').eq('user_id', userId)
  const ids = (rows ?? []).map((r) => r.space_id)
  if (!ids.length) return []
  return (unwrap(await supabase.from('spaces').select(SPACE_FIELDS)
    .in('id', ids).eq('is_published', true)) as unknown as Space[]) ?? []
}

// ----------------------------------------------------------------- follows

export async function isFollowing(followerId: string, followingId: string) {
  const { data } = await supabase
    .from('follows').select('follower_id')
    .eq('follower_id', followerId).eq('following_id', followingId).maybeSingle()
  return Boolean(data)
}

/** People you follow, and people who follow you. */
export async function listFollows(userId: string, side: 'followers' | 'following'): Promise<Profile[]> {
  const column = side === 'followers' ? 'following_id' : 'follower_id'
  const other = side === 'followers' ? 'follower_id' : 'following_id'
  const rows = unwrap(await supabase.from('follows').select(other).eq(column, userId)) as
    Record<string, string>[]
  const ids = (rows ?? []).map((row) => row[other])
  if (!ids.length) return []
  return (unwrap(await supabase.from('profiles').select('*').in('id', ids)) as Profile[]) ?? []
}

export async function setFollowing(followerId: string, followingId: string, on: boolean) {
  const result = on
    ? await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
    : await supabase.from('follows').delete()
        .eq('follower_id', followerId).eq('following_id', followingId)
  if (result.error) throw new Error(result.error.message)
}

// ------------------------------------------------------------------ badges

export async function listSpaceBadges(spaceId: string): Promise<SpaceBadge[]> {
  return (unwrap(await supabase.from('space_badges').select('*')
    .eq('space_id', spaceId).order('created_at')) as unknown as SpaceBadge[]) ?? []
}

export async function createSpaceBadge(input: {
  spaceId: string
  name: string
  description: string
  iconUrl: string | null
}): Promise<SpaceBadge> {
  return unwrap(await supabase.from('space_badges').insert({
    space_id: input.spaceId,
    name: input.name.trim(),
    description: input.description.trim() || null,
    icon_url: input.iconUrl,
  }).select('*').single()) as unknown as SpaceBadge
}

export async function updateSpaceBadge(id: string, patch: Partial<Pick<SpaceBadge,
  'name' | 'description' | 'is_enabled' | 'icon_url'>>) {
  unwrap(await supabase.from('space_badges').update(patch).eq('id', id).select('id').single())
}

export async function deleteSpaceBadge(id: string) {
  const { error } = await supabase.from('space_badges').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Only the Space owner can award, enforced in the database. */
export async function awardBadge(badgeId: string, recipientId: string): Promise<boolean> {
  return unwrap(await supabase.rpc('award_badge', { badge: badgeId, recipient: recipientId })) as boolean
}

export async function listEarnedBadges(userId: string): Promise<EarnedBadge[]> {
  return unwrap(await supabase.rpc('earned_badges', { target: userId })) ?? []
}

// ------------------------------------------------------------- communities

export async function getProfileOverview(userId: string): Promise<ProfileOverview> {
  const rows = unwrap(await supabase.rpc('profile_overview', { target: userId }))
  return (Array.isArray(rows) ? rows[0] : rows) as ProfileOverview
}

export async function listMemberCommunities(userId: string): Promise<MemberCommunity[]> {
  return unwrap(await supabase.rpc('member_communities', { target: userId })) ?? []
}

export async function listCommunities(search?: string): Promise<Community[]> {
  let query = supabase.from('communities').select('*')
    .eq('is_public', true).order('member_count', { ascending: false }).limit(40)
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)
  return (unwrap(await query) as unknown as Community[]) ?? []
}

export async function getCommunity(slug: string): Promise<Community | null> {
  const { data, error } = await supabase
    .from('communities').select('*').eq('slug', slug).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Community | null) ?? null
}

// --------------------------------------------------------- community events

export async function listCommunityEvents(
  communityId: string, upcomingOnly = false,
): Promise<CommunityEvent[]> {
  return (unwrap(await supabase.rpc('community_events_list', {
    target: communityId, upcoming_only: upcomingOnly,
  })) as CommunityEvent[]) ?? []
}

export async function getEvent(contentId: number): Promise<EventPage | null> {
  const rows = unwrap(await supabase.rpc('event_by_id', { target: contentId })) as EventPage[]
  return rows?.[0] ?? null
}

export async function listEventAttendees(eventId: string): Promise<EventAttendee[]> {
  return (unwrap(await supabase.rpc('event_attendees', {
    target: eventId, limit_count: 24,
  })) as EventAttendee[]) ?? []
}

export async function setEventAttendance(eventId: string, going: boolean) {
  unwrap(await supabase.rpc('set_event_attendance', { target: eventId, going }))
}

export async function saveEvent(input: {
  id?: string
  community_id: string
  title: string
  subtitle: string | null
  description: string | null
  cover_url: string | null
  starts_at: string
  ends_at: string | null
}) {
  if (input.id) {
    const { id, ...patch } = input
    unwrap(await supabase.from('community_events').update(patch).eq('id', id).select('id').single())
    return
  }
  unwrap(await supabase.from('community_events').insert(input).select('id').single())
}

export async function cancelEvent(id: string, cancelled: boolean) {
  unwrap(await supabase.from('community_events')
    .update({ is_cancelled: cancelled }).eq('id', id).select('id').single())
}

export async function deleteEvent(id: string) {
  unwrap(await supabase.from('community_events').delete().eq('id', id).select('id'))
}

// ----------------------------------------------- making things for a Community

/** The Communities you are allowed to make things for. */
export async function listBuildTargets(): Promise<BuildTarget[]> {
  return (unwrap(await supabase.rpc('communities_i_build_for')) as BuildTarget[]) ?? []
}

/** A Community's uploads, drafts and all, for the people who run it. */
export async function listCommunityUploads(communityId: string): Promise<OwnAsset[]> {
  return (unwrap(await supabase.rpc('community_uploads', {
    target: communityId,
  })) as OwnAsset[]) ?? []
}

export async function communityAnalytics(communityId: string): Promise<CreatorAssetRow[]> {
  return (unwrap(await supabase.rpc('community_analytics', {
    target: communityId,
  })) as CreatorAssetRow[]) ?? []
}

export async function listCommunitySpacesManaged(communityId: string): Promise<Space[]> {
  return (unwrap(await supabase.rpc('community_spaces_managed', {
    target: communityId,
  })) as unknown as Space[]) ?? []
}

export async function listCommunityAssets(communityId: string): Promise<MarketAsset[]> {
  return (unwrap(await supabase.rpc('community_assets', {
    target: communityId, limit_count: 40,
  })) as MarketAsset[]) ?? []
}

/** Making a Space for a Community, from Create, as that Community. */
export async function buildSpaceForCommunity(spaceId: string, communityId: string) {
  unwrap(await supabase.rpc('link_space_to_community', { space: spaceId, community: communityId }))
}

export async function closeCommunity(communityId: string, closed: boolean) {
  unwrap(await supabase.rpc('close_community', { target: communityId, closed }))
}

export async function transferCommunity(communityId: string, toUser: string) {
  unwrap(await supabase.rpc('transfer_community', { target: communityId, to_user: toUser }))
}

/** Redeeming a code. The database decides what it is worth, and says why not. */
export async function redeemCode(code: string): Promise<{ reward: number; message: string }> {
  const rows = unwrap(await supabase.rpc('redeem_code', { entered: code }))
  const row = (Array.isArray(rows) ? rows[0] : rows) as { reward: number; message: string }
  return row ?? { reward: 0, message: 'Code accepted.' }
}

/** Your own movements, as far back as you ask and of the kinds you ask for. */
export async function myTransactions(
  { days = 30, kinds = null }: { days?: number; kinds?: string[] | null } = {},
): Promise<PixelTransaction[]> {
  return (unwrap(await supabase.rpc('my_transactions', { days, kinds })) as PixelTransaction[]) ?? []
}

export async function listPixelTransactions(userId: string): Promise<PixelTransaction[]> {
  return (unwrap(await supabase.from('pixel_transactions')
    .select('id, amount, kind, note, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false })
    .limit(30)) as unknown as PixelTransaction[]) ?? []
}

// -------------------------------------------------------------- space chat

export async function listSpaceMessages(spaceId: string): Promise<SpaceMessage[]> {
  const rows = unwrap(await supabase.from('space_messages')
    .select('id, space_id, sender_id, body, created_at, ' +
      'sender:profiles!space_messages_sender_id_fkey (username, display_name, avatar_url, is_admin, is_guest)')
    .eq('space_id', spaceId)
    .order('created_at', { ascending: false }).limit(50)) as unknown as SpaceMessage[]
  return (rows ?? []).reverse()
}

export async function sendSpaceMessage(spaceId: string, senderId: string, body: string) {
  unwrap(await supabase.from('space_messages')
    .insert({ space_id: spaceId, sender_id: senderId, body })
    .select('id').single())
}

export async function updateSpaceChatSettings(spaceId: string, patch: {
  chat_enabled?: boolean
  chat_greeting?: string | null
  chat_slowmode_seconds?: number
}) {
  unwrap(await supabase.from('spaces').update(patch).eq('id', spaceId).select('id').single())
}

// ------------------------------------------------------------- moderation

/** Checks a username before signup bothers submitting it. */
export async function checkUsername(candidate: string): Promise<{ ok: boolean; reason: string | null }> {
  const rows = unwrap(await supabase.rpc('check_username', { candidate }))
  return (Array.isArray(rows) ? rows[0] : rows) as { ok: boolean; reason: string | null }
}

/**
 * Signs in with a username. The lookup from username to email runs in the
 * `login` edge function behind the service role key, so nothing here can be
 * used to harvest addresses.
 */
/**
 * The way in without the edge function: the database checks the password and
 * hands back the address only when it is right, so this cannot be used to
 * find out which names exist or to collect addresses. Guessing is bounded by
 * a counter per name, since this has no rate limit of its own.
 */
async function signInThroughTheDatabase(username: string, password: string) {
  const email = unwrap(await supabase.rpc('login_email_for', {
    account_name: username,
    secret: password,
  })) as string | null

  if (!email) throw new Error('Wrong username or password.')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Wrong username or password.')
  return data.session
}

/**
 * Signs in with a username. Supabase signs people in with an email, so the
 * name has to be turned into one first, and that lookup must not be something
 * a browser can do freely or it becomes a way to harvest addresses.
 *
 * The `login` edge function does it behind the service role key. Where that
 * function is not deployed, the same job is done by login_email_for in the
 * database, which only answers a correct password.
 */
export async function signInWithUsername(username: string, password: string) {
  const { data, error } = await supabase.functions.invoke('login', {
    body: { username, password },
  })

  if (error) {
    const response = (error as { context?: Response }).context
    const status = typeof response?.status === 'number' ? response.status : null

    // Only the function's own refusal means the details were wrong.
    if (status === 400) {
      const detail = await response?.json?.().catch(() => null)
      throw new Error(detail?.error ?? 'Wrong username or password.')
    }

    // Anything else means the function did not answer, so the database does
    // the job instead rather than blaming somebody's password for it.
    return await signInThroughTheDatabase(username, password)
  }

  const { access_token, refresh_token } = data as { access_token: string; refresh_token: string }
  const applied = await supabase.auth.setSession({ access_token, refresh_token })
  if (applied.error) throw new Error(applied.error.message)
  return applied.data.session
}

// -------------------------------------------------------------- group chat

export async function myConversations(): Promise<Conversation[]> {
  return (unwrap(await supabase.rpc('my_conversations')) as Conversation[]) ?? []
}

export async function createGroupConversation(title: string, memberIds: string[]): Promise<string> {
  return unwrap(await supabase.rpc('create_group_conversation', {
    title: title.trim(),
    members: memberIds,
  })) as string
}

/** What a conversation is called when it has no name of its own. */
export function conversationName(conversation: Conversation) {
  if (conversation.title) return conversation.title
  const names = conversation.members.map((m) => m.display_name)
  if (!names.length) return 'Empty chat'
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

// ------------------------------------------------------- community details

export async function getCommunityOverview(communityId: string): Promise<CommunityOverview> {
  const rows = unwrap(await supabase.rpc('community_overview', { community: communityId }))
  return (Array.isArray(rows) ? rows[0] : rows) as CommunityOverview
}

export async function listCommunityRoster(communityId: string): Promise<CommunityMember[]> {
  return unwrap(await supabase.rpc('community_roster', { community: communityId })) ?? []
}

export async function listCommunityRequests(communityId: string): Promise<CommunityRequest[]> {
  return unwrap(await supabase.rpc('community_requests', { community: communityId })) ?? []
}

export async function listCommunityRanks(communityId: string): Promise<CommunityRank[]> {
  return (unwrap(await supabase.from('community_ranks').select('*')
    .eq('community_id', communityId)
    .order('rank', { ascending: false })) as unknown as CommunityRank[]) ?? []
}

export async function saveCommunityRank(rank: Partial<CommunityRank> & { community_id: string }) {
  const { id, ...fields } = rank
  const result = id
    ? await supabase.from('community_ranks').update(fields).eq('id', id).select('id').single()
    : await supabase.from('community_ranks').insert(fields).select('id').single()
  unwrap(result)
}

export async function deleteCommunityRank(id: string) {
  const { error } = await supabase.from('community_ranks').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createCommunityFull(input: {
  name: string
  slug: string
  description: string
  iconUrl: string | null
  bannerUrl: string | null
  joinPolicy: 'open' | 'approval'
}): Promise<string> {
  return unwrap(await supabase.rpc('create_community', {
    name: input.name.trim(),
    slug: input.slug,
    description: input.description,
    icon_url: input.iconUrl,
    banner_url: input.bannerUrl,
    join_policy: input.joinPolicy,
  })) as string
}

export async function joinCommunity(communityId: string): Promise<'joined' | 'requested'> {
  return unwrap(await supabase.rpc('join_community', { community: communityId })) as
    'joined' | 'requested'
}

export async function leaveCommunity(communityId: string, userId: string) {
  const { error } = await supabase.from('community_members').delete()
    .eq('community_id', communityId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function answerJoinRequest(communityId: string, applicantId: string, accept: boolean) {
  unwrap(await supabase.rpc('answer_join_request', {
    community: communityId, applicant: applicantId, accept,
  }))
}

export async function setMemberRank(communityId: string, targetId: string, rankId: string) {
  unwrap(await supabase.rpc('set_member_rank', {
    community: communityId, target: targetId, new_rank: rankId,
  }))
}

export async function removeMember(communityId: string, targetId: string, ban = false, reason = '') {
  unwrap(await supabase.rpc('remove_member', {
    community: communityId, target: targetId, ban, reason,
  }))
}

export async function updateCommunity(id: string, patch: Partial<Pick<Community,
  'name' | 'description' | 'icon_url' | 'banner_url' | 'join_policy'>>) {
  unwrap(await supabase.from('communities').update(patch).eq('id', id).select('id').single())
}

// --------------------------------------------------------- community walls

/**
 * The wall and the announcements are separate lists, both newest first. An
 * announcement never shows on the wall and a wall post never pretends to be
 * an announcement.
 */
export async function listCommunityPosts(
  communityId: string, announcements = false,
): Promise<CommunityPost[]> {
  return (unwrap(await supabase.rpc('community_posts_list', {
    target: communityId, announcements, limit_count: 50,
  })) as unknown as CommunityPost[]) ?? []
}

export async function saveAnnouncement(input: {
  id?: number
  communityId: string
  authorId: string
  title: string | null
  body: string
  mediaUrl: string | null
  mediaKind: 'image' | 'video' | null
}) {
  const row = {
    title: input.title,
    body: input.body,
    media_url: input.mediaUrl,
    media_kind: input.mediaKind,
  }
  if (input.id) {
    unwrap(await supabase.from('community_posts').update(row).eq('id', input.id)
      .select('id').single())
    return
  }
  unwrap(await supabase.from('community_posts').insert({
    ...row,
    community_id: input.communityId,
    author_id: input.authorId,
    is_announcement: true,
  }).select('id').single())
}

export async function setPostPinned(id: number, pinned: boolean) {
  unwrap(await supabase.rpc('set_post_pinned', { target: id, pinned }))
}

/**
 * What somebody thinks of a post: yes, no, or nothing. One opinion each, so
 * saying the opposite of what you said before swaps it rather than counting
 * twice.
 */
export async function votePost(id: number, up: boolean | null) {
  unwrap(await supabase.rpc('vote_post', { post: id, up }))
}

export async function likePost(id: number, liked: boolean) {
  const { data: session } = await supabase.auth.getUser()
  const me = session.user?.id
  if (!me) throw new Error('Sign in first.')
  if (liked) {
    unwrap(await supabase.from('post_likes').insert({ post_id: id, user_id: me })
      .select('post_id').single())
    return
  }
  unwrap(await supabase.from('post_likes').delete()
    .eq('post_id', id).eq('user_id', me).select('post_id'))
}

export async function listCommunityMoney(communityId: string): Promise<CommunityMoneyRow[]> {
  return (unwrap(await supabase.rpc('community_money', {
    community: communityId, limit_count: 60,
  })) as CommunityMoneyRow[]) ?? []
}

export async function grantCommunityKubes(
  communityId: string, userId: string, amount: number, note: string,
) {
  unwrap(await supabase.rpc('grant_community_kubes', {
    community: communityId, target: userId, amount, note: note.trim() || null,
  }))
}

export async function editPost(id: number, body: string) {
  unwrap(await supabase.from('community_posts').update({ body }).eq('id', id).select('id').single())
}

export async function postToCommunity(input: {
  communityId: string
  authorId: string
  body: string
  isAnnouncement: boolean
}) {
  unwrap(await supabase.from('community_posts').insert({
    community_id: input.communityId,
    author_id: input.authorId,
    body: input.body.trim(),
    is_announcement: input.isAnnouncement,
  }).select('id').single())
}

export async function removeCommunityPost(id: number) {
  unwrap(await supabase.from('community_posts').update({ is_removed: true })
    .eq('id', id).select('id').single())
}

// ------------------------------------------------------- community Spaces

export async function listCommunitySpaces(communityId: string): Promise<Space[]> {
  const { data: rows } = await supabase.from('community_spaces')
    .select('space_id').eq('community_id', communityId)
  const ids = (rows ?? []).map((r) => r.space_id)
  if (!ids.length) return []
  return (unwrap(await supabase.from('spaces').select(SPACE_FIELDS)
    .in('id', ids).eq('is_published', true)) as unknown as Space[]) ?? []
}

export async function linkSpaceToCommunity(communityId: string, spaceId: string, link: boolean) {
  const result = link
    ? await supabase.from('community_spaces').insert({ community_id: communityId, space_id: spaceId })
    : await supabase.from('community_spaces').delete()
        .eq('community_id', communityId).eq('space_id', spaceId)
  if (result.error) throw new Error(result.error.message)
}

/**
 * Pictures the platform itself shows: avatars, Community emblems and banners,
 * Space emblems, covers and thumbnails. These are ordinary uploads from your
 * machine, not Create content, and they carry no id: an id is for what goes
 * inside a Space.
 */
export async function uploadCommunityImage(userId: string, file: File, kind: 'emblem' | 'cover') {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${userId}/community-${kind}-${Date.now()}.${extension}`
  const { error } = await supabase.storage
    .from('avatars').upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export const uploadSpaceImage = uploadCommunityImage


// -------------------------------------------------------------- the Style shop

/** One thing in the shop, or one thing you own. */
export type StyleItem = {
  id: string
  creator_avatar?: string | null
  content_id: number | null
  name: string
  description?: string | null
  slot: 'hat' | 'hair' | 'face' | 'accessory' | 'frame'
  image_path: string
  x: number
  y: number
  width: number
  rotation: number
  flipped: boolean
  layer: 0 | 1
  price: number
  created_at?: string
  creator_id?: string
  creator_name?: string
  creator_username?: string
  owned?: boolean
  worn?: boolean
  owners?: number
  paid?: number
  mine?: boolean
  is_public?: boolean
}

/** Where a thing sits on a picture, in fractions of it. */
export type Placement = {
  x: number
  y: number
  width: number
  rotation: number
  flipped: boolean
  layer: 0 | 1
}

/**
 * The picture for an accessory. It lives in the bucket that is already
 * public, because a hat has to be drawable by anybody looking at anybody.
 */
export function styleImage(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function uploadStyleImage(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${userId}/style-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('avatars').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export async function publishStyleItem(input: {
  name: string
  description?: string | null
  slot: StyleItem['slot']
  image: string
  place: Placement
  price: number
}): Promise<string> {
  return unwrap(await supabase.rpc('publish_style_item', {
    item_name: input.name.trim(),
    about: input.description?.trim() ?? null,
    slot_name: input.slot,
    image: input.image,
    place: input.place,
    cost: Math.max(0, Math.round(input.price)),
  })) as string
}

export async function placeStyleItem(id: string, place: Placement) {
  unwrap(await supabase.rpc('place_style_item', { target: id, place }))
}

export async function retireStyleItem(id: string) {
  unwrap(await supabase.rpc('retire_style_item', { target: id }))
}

export async function buyStyleItem(id: string) {
  unwrap(await supabase.rpc('buy_style_item', { target: id }))
}

export async function wearStyleItem(id: string, on: boolean) {
  unwrap(await supabase.rpc('wear_style_item', { target: id, on_me: on }))
}

export async function styleShop(
  { search = '', slot = null, limit = 60 }:
  { search?: string; slot?: StyleItem['slot'] | null; limit?: number } = {},
): Promise<StyleItem[]> {
  return (unwrap(await supabase.rpc('style_shop', {
    search: search.trim() || null, slot_name: slot, wanted: limit,
  })) as StyleItem[]) ?? []
}

// ------------------------------------------------------------- moderation

/** What Kobblon knows how to take down. */
export type TakeDownKind = 'asset' | 'world' | 'space' | 'style' | 'face'

/**
 * Removing a piece of content, and telling whoever made it why.
 *
 * The reason is not optional and is shown to the person: "your thing was
 * removed" with no reason is how a platform teaches people that moderation
 * is arbitrary.
 */
export async function takeDown(what: TakeDownKind, which: string, reason: string) {
  unwrap(await supabase.rpc('take_down', { what, which, reason }))
}

/** Undoing a removal. It does not republish: that stays the owner's call. */
export async function putBack(what: TakeDownKind, which: string) {
  unwrap(await supabase.rpc('put_back', { what, which }))
}

// ------------------------------------------------------------------ faces

/**
 * Faces: flat pictures worn on K6's head, the way the first brick-toy
 * avatars wore theirs. Kobblon publishes them and nobody else does.
 */
export async function faceCatalogue(search = '', limit = 60): Promise<Face[]> {
  return (unwrap(await supabase.rpc('face_catalogue', {
    search: search.trim() || null, wanted: limit,
  })) as Face[]) ?? []
}

export async function buyFace(id: string) {
  unwrap(await supabase.rpc('buy_face', { which: id }))
}

export async function myFaces(): Promise<Face[]> {
  return (unwrap(await supabase.rpc('my_faces')) as Face[]) ?? []
}

/** Null takes it off and puts K6 back to its own face. */
export async function wearFace(id: string | null) {
  unwrap(await supabase.rpc('wear_face', { which: id }))
}

/** Where a face answers from. Public: it is a thing in a shop window. */
export function faceUrl(path: string) {
  const base = import.meta.env.VITE_SUPABASE_URL ?? ''
  return `${base}/storage/v1/object/public/faces/${path}`
}

/** Every face Kobblon has, including the ones off the shelf. */
export async function allFaces(): Promise<Face[]> {
  return (unwrap(await supabase.rpc('all_faces')) as Face[]) ?? []
}

/** Changing one. Leaving a field out leaves it alone. */
export async function editFace(id: string, changes: {
  name?: string
  description?: string
  price?: number
  isPublic?: boolean
  file?: File
}): Promise<void> {
  let picture: string | null = null

  if (changes.file) {
    const extension = changes.file.name.split('.').pop()?.toLowerCase() ?? 'png'
    picture = `${crypto.randomUUID()}.${extension}`
    const up = await supabase.storage.from('faces')
      .upload(picture, changes.file, { contentType: changes.file.type || 'image/png' })
    if (up.error) throw new Error(up.error.message)
  }

  const { error } = await supabase.rpc('edit_face', {
    which: id,
    called: changes.name ?? null,
    about: changes.description ?? null,
    cost: changes.price ?? null,
    shown: changes.isPublic ?? null,
    picture,
  })
  if (error) {
    // A new picture that the row never accepted is litter.
    if (picture) await supabase.storage.from('faces').remove([picture])
    throw new Error(error.message)
  }
}

/**
 * Getting rid of one.
 *
 * Says which of the two things happened: a face nobody owns is deleted
 * outright, and one somebody paid for is taken off the shelf and left in
 * their hands. Destroying something people bought is not a tidy-up.
 */
export async function deleteFace(id: string): Promise<'deleted' | 'retired'> {
  const path = unwrap(await supabase.rpc('delete_face', { which: id })) as string | null
  if (!path) return 'retired'
  await supabase.storage.from('faces').remove([path])
  return 'deleted'
}

/**
 * Publishing one. Kobblon only, and that is enforced by the database
 * rather than by this function being hard to find.
 */
export async function publishFace(input: {
  file: File
  name: string
  description?: string
  price?: number
}): Promise<void> {
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${crypto.randomUUID()}.${extension}`
  const up = await supabase.storage.from('faces')
    .upload(path, input.file, { contentType: input.file.type || 'image/png' })
  if (up.error) throw new Error(up.error.message)

  const { error } = await supabase.from('faces').insert({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    image_path: path,
    price: Math.max(0, Math.round(input.price ?? 0)),
  })
  if (error) {
    // Never leave a picture in the bucket with nothing pointing at it.
    await supabase.storage.from('faces').remove([path])
    throw new Error(error.message)
  }
}

export async function myStyle(): Promise<StyleItem[]> {
  return (unwrap(await supabase.rpc('my_style')) as StyleItem[]) ?? []
}

/** The number in a thing's address: STY-1042. */
export const styleTag = (contentId?: number | null) => `STY-${contentId ?? 0}`

export async function styleItem(contentId: number): Promise<StyleItem | null> {
  const rows = unwrap(await supabase.rpc('style_item', { target_content: contentId }))
  const row = (Array.isArray(rows) ? rows[0] : rows) as StyleItem | undefined
  return row ?? null
}

export async function similarStyle(id: string, limit = 12): Promise<StyleItem[]> {
  return (unwrap(await supabase.rpc('similar_style', { target: id, wanted: limit })) as StyleItem[]) ?? []
}

/** Turns a shop row into the shape a picture is drawn from. */
export function asWorn(item: StyleItem) {
  return {
    id: item.id,
    name: item.name,
    url: styleImage(item.image_path),
    x: item.x,
    y: item.y,
    width: item.width,
    rotation: item.rotation,
    flipped: item.flipped,
    layer: item.layer,
  }
}

// ------------------------------------------------------------ space detail

export async function getSpaceStats(spaceId: string): Promise<SpaceStats> {
  const rows = unwrap(await supabase.rpc('space_stats', { target: spaceId }))
  return (Array.isArray(rows) ? rows[0] : rows) as SpaceStats
}

/** Like, dislike, favourite and notify all toggle the same way. */
export async function toggleSpaceFlag(
  table: 'space_likes' | 'space_dislikes' | 'space_favorites' | 'space_watchers',
  spaceId: string,
  userId: string,
  on: boolean,
) {
  const result = on
    ? await supabase.from(table).insert({ space_id: spaceId, user_id: userId })
    : await supabase.from(table).delete().eq('space_id', spaceId).eq('user_id', userId)
  if (result.error) throw markError(table, result.error.message)
}

export async function updateSpace(id: string, patch: Partial<Pick<Space,
  'name' | 'description' | 'category' | 'genre' | 'emblem_url' | 'cover_url' |
  'thumbnail_urls' | 'is_published' | 'chat_enabled' | 'chat_greeting' | 'chat_slowmode_seconds'>>) {
  unwrap(await supabase.from('spaces').update(patch).eq('id', id).select('id').single())
}

export async function getSpaceById(id: string): Promise<Space | null> {
  const { data, error } = await supabase
    .from('spaces').select(SPACE_FIELDS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Space | null) ?? null
}

// -------------------------------------------------------- ads and gifts

export type AdSize = 'banner' | 'box' | 'tall'

export type ShownAd = { id: string; name: string; file_path: string; target_path: string }

/** The kinds of thing an ad is allowed to point at. */
export type AdTarget = 'space' | 'community' | 'event' | 'asset' | 'link'

export type Advertisable = {
  kind: AdTarget
  id: string
  label: string
  note: string
  path: string
}

/** A campaign: the name, the money and the clock that a set of ads share. */
export type Campaign = {
  id: string
  name: string
  budget: number
  spent: number
  is_running: boolean
  ends_at: string | null
  renewed_count: number
  /** What has already been handed back, which is no longer the campaign's. */
  refunded: number
  created_at: string
  ad_count: number
  views: number
  clicks: number
}

/** One ad inside a campaign: a decal, a shape, and somewhere to send people. */
export type CampaignAd = {
  id: string
  size: AdSize
  asset_id: string
  file_path: string
  target_kind: AdTarget
  target_id: string | null
  target_path: string
  views: number
  clicks: number
  is_active: boolean
  created_at: string
}

/** The most Brix a campaign can carry, which is also its longest run. */
export const AD_MAX_KUBES = 2000
export const AD_MAX_DAYS = 30

/** How long that much keeps a campaign up, the same sum the database does. */
export const adDays = (kubes: number) =>
  Math.max(1, Math.min(AD_MAX_DAYS, Math.round((AD_MAX_DAYS * kubes) / AD_MAX_KUBES)))

/**
 * An ad to put in a slot of this size. Asking is what counts a view, so this
 * is called once per slot when a page is drawn and never in a loop.
 */
export async function pickAd(
  size: AdSize, spaceId?: string | null, avoid: string[] = [],
): Promise<ShownAd | null> {
  const rows = unwrap(await supabase.rpc('pick_ad', {
    slot: size,
    space: spaceId ?? null,
    avoid,
  })) as ShownAd[]
  return rows?.[0] ?? null
}

export async function recordAdClick(adId: string) {
  await supabase.rpc('record_ad_click', { target: adId })
}

/**
 * Everything the person signed in may advertise. An ad names the thing it is
 * for rather than an address, and the address is worked out from that thing,
 * so it cannot be pointed at somebody else's work.
 */
export async function listAdvertisable(): Promise<Advertisable[]> {
  return (unwrap(await supabase.rpc('advertisable')) as Advertisable[]) ?? []
}

// ------------------------------------------------------------- campaigns

export async function listCampaigns(): Promise<Campaign[]> {
  return (unwrap(await supabase.rpc('my_campaigns')) as Campaign[]) ?? []
}

export async function listCampaignAds(campaignId: string): Promise<CampaignAd[]> {
  return (unwrap(await supabase.rpc('campaign_ads', { campaign: campaignId })) as CampaignAd[]) ?? []
}

/** Starting a campaign. The budget is paid now and decides how long it runs. */
export async function createCampaign(name: string, kubes: number): Promise<string> {
  return unwrap(await supabase.rpc('create_campaign', {
    campaign_name: name,
    kubes,
  })) as string
}

export async function renameCampaign(campaignId: string, name: string) {
  unwrap(await supabase.rpc('rename_campaign', { target: campaignId, campaign_name: name }))
}

/** Stopping a campaign hands back whatever it did not spend. */
export async function endCampaign(campaignId: string): Promise<number> {
  return unwrap(await supabase.rpc('end_campaign', { target: campaignId })) as number
}

/** Putting a finished campaign back up. Returns when it now comes down. */
export async function renewCampaign(campaignId: string, kubes: number): Promise<string> {
  return unwrap(await supabase.rpc('renew_campaign', { target: campaignId, kubes })) as string
}

/** What a run of that many days costs, the same sum the database does. */
export const adKubesFor = (days: number) =>
  Math.max(10, Math.min(AD_MAX_KUBES, Math.ceil((AD_MAX_KUBES * Math.max(1, Math.min(30, days))) / 30)))

/**
 * Changing how long a campaign runs, counted from now. Longer costs the
 * difference; shorter costs nothing and returns nothing, because a clock you
 * can wind back for Brix is a refund with extra steps.
 */
export async function setCampaignDays(campaignId: string, days: number): Promise<string> {
  return unwrap(await supabase.rpc('set_campaign_days', { target: campaignId, days })) as string
}

/** Taking a finished campaign off the list, ads and all. */
export async function removeCampaign(campaignId: string): Promise<number> {
  return unwrap(await supabase.rpc('remove_campaign', { target: campaignId })) as number
}

// ------------------------------------------------------------------ ads

export type AdDetails = {
  size: AdSize
  assetId: string
  kind: AdTarget
  targetId?: string | null
  /** Only Kobblon's own account may point an ad off the site. */
  outward?: string | null
}

/** Putting an ad into a campaign. It costs nothing: the campaign is paid for. */
export async function addAd(campaignId: string, details: AdDetails): Promise<string> {
  return unwrap(await supabase.rpc('add_ad', {
    campaign: campaignId,
    ad_size: details.size,
    picture: details.assetId,
    kind: details.kind,
    target: details.targetId ?? null,
    outward: details.outward ?? null,
  })) as string
}

/** Changing an ad. What it has been shown and pressed stays with it. */
export async function editAd(adId: string, details: AdDetails) {
  unwrap(await supabase.rpc('edit_ad', {
    target_ad: adId,
    ad_size: details.size,
    picture: details.assetId,
    kind: details.kind,
    target: details.targetId ?? null,
    outward: details.outward ?? null,
  }))
}

/** Taking one ad out of a campaign. The money is the campaign's, so none moves. */
export async function removeAd(adId: string) {
  unwrap(await supabase.rpc('remove_ad', { target: adId }))
}

/** Resting one ad without touching the rest of the campaign. */
export async function pauseAd(adId: string, resting: boolean) {
  unwrap(await supabase.rpc('pause_ad', { target: adId, resting }))
}

// ------------------------------------------------------------- the shop

/**
 * What it costs to put something up at that price: a tenth of it, never less
 * than five and never more than 250. The same sum the database does, so the
 * price can be shown before anybody commits to it.
 */
export const listingFee = (price: number) =>
  Math.max(5, Math.min(250, Math.round((Number(price) || 0) * 0.1)))

/** The share of a sale Kobblon keeps; the rest reaches the creator. */
export const PLATFORM_SHARE = 35

/** The event happening in a community right now, if there is one. */
export type LiveEvent = {
  id: string
  content_id: number | null
  title: string
  subtitle: string | null
  starts_at: string
  ends_at: string | null
  attending_count: number
}

export async function currentEvent(communityId: string): Promise<LiveEvent | null> {
  const rows = unwrap(await supabase.rpc('current_event', { community: communityId })) as LiveEvent[]
  return rows?.[0] ?? null
}

/**
 * Telling the people who said they were going that an event has begun.
 * Nothing here runs on a timer, so the first person through the door does the
 * telling, and it only ever happens once per event.
 */
export async function announceStartedEvents(communityId?: string) {
  await supabase.rpc('announce_started_events', { community: communityId ?? null })
}

/** More like the thing you are looking at, and more from whoever made it. */
export async function listSimilarAssets(assetId: string, limit = 12): Promise<MarketAsset[]> {
  return (unwrap(await supabase.rpc('similar_assets', {
    target: assetId,
    limit_count: limit,
  })) as MarketAsset[]) ?? []
}

/** Putting something up for sale. Returns the fee that was paid. */
export async function listForSale(assetId: string, price: number): Promise<number> {
  return unwrap(await supabase.rpc('list_for_sale', { target: assetId, asking: price })) as number
}

/** Taking it back off sale. Returns what is handed back. */
export async function unlistForSale(assetId: string): Promise<number> {
  return unwrap(await supabase.rpc('unlist_for_sale', { target: assetId })) as number
}

/** Giving Brix to whoever made a Space. Returns what is left. */
export async function donateToSpace(spaceId: string, amount: number): Promise<number> {
  return unwrap(await supabase.rpc('donate_to_space', { space: spaceId, amount })) as number
}

// ------------------------------------------------------------- affiliates

export async function listRelations(
  communityId: string,
  relation: 'ally' | 'enemy',
  onlyPending = false,
): Promise<CommunityRelation[]> {
  return unwrap(await supabase.rpc('community_relations_list', {
    community: communityId, want: relation, only_pending: onlyPending,
  })) ?? []
}

export async function requestAlly(communityId: string, otherId: string) {
  unwrap(await supabase.rpc('request_ally', { community: communityId, other: otherId }))
}

export async function answerAllyRequest(communityId: string, otherId: string, accept: boolean) {
  unwrap(await supabase.rpc('answer_ally_request', {
    community: communityId, other: otherId, accept,
  }))
}

export async function declareEnemy(communityId: string, otherId: string) {
  unwrap(await supabase.rpc('declare_enemy', { community: communityId, other: otherId }))
}

export async function removeRelation(communityId: string, otherId: string) {
  unwrap(await supabase.rpc('remove_relation', { community: communityId, other: otherId }))
}

// ------------------------------------------------- moderation and the log

export async function listCommunityBanned(communityId: string): Promise<CommunityBan[]> {
  return unwrap(await supabase.rpc('community_banned', { community: communityId })) ?? []
}

export async function liftBan(communityId: string, targetId: string) {
  unwrap(await supabase.rpc('lift_ban', { community: communityId, target: targetId }))
}

export async function listCommunityAudit(communityId: string): Promise<CommunityAuditEntry[]> {
  return unwrap(await supabase.rpc('community_audit_log', { community: communityId })) ?? []
}

// ------------------------------------------- standing, appeals and support

export async function getStanding(): Promise<AccountStanding | null> {
  const rows = unwrap(await supabase.rpc('my_standing')) as AccountStanding[] | null
  return rows?.[0] ?? null
}

export async function listViolations(): Promise<Violation[]> {
  const { data, error } = await supabase
    .from('violations')
    .select('id, rule, action, reason, target_type, target_id, blocks, expires_at, is_void, void_reason, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Violation[]
}

export async function listAppeals(): Promise<Appeal[]> {
  const { data, error } = await supabase
    .from('appeals')
    .select('id, violation_id, body, status, decision_note, decided_at, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Appeal[]
}

export async function fileAppeal(violationId: number, body: string): Promise<number> {
  return unwrap(await supabase.rpc('file_appeal', { violation: violationId, body })) as number
}

/** Whether something is switched off for this account, asked of the server. */
export async function blockedFrom(what: string): Promise<boolean> {
  return (unwrap(await supabase.rpc('is_blocked_from', { what })) as boolean) ?? false
}

// ------------------------------------------------------------ the inbox

export async function listMail(): Promise<Letter[]> {
  const { data, error } = await supabase
    .from('mail')
    .select('id, kind, subject, body, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []) as Letter[]
}

export async function unreadMail(): Promise<number> {
  return (unwrap(await supabase.rpc('unread_mail')) as number) ?? 0
}

export async function readLetter(id: number) {
  unwrap(await supabase.rpc('read_mail', { letter: id }))
}

export async function readAllMail() {
  unwrap(await supabase.rpc('read_all_mail'))
}

// ---------------------------------------------------------------- support

export async function listTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, topic, subject, status, updated_at, created_at')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

export async function getTicket(id: number): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, topic, subject, status, updated_at, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Ticket | null) ?? null
}

export async function listTicketMessages(id: number): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, sender_id, from_staff, body, created_at')
    .eq('ticket_id', id)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []) as TicketMessage[]
}

export async function openTicket(
  topic: TicketTopic, subject: string, body: string,
): Promise<number> {
  return unwrap(await supabase.rpc('open_ticket', { topic, subject, body })) as number
}

export async function replyTicket(id: number, body: string) {
  unwrap(await supabase.rpc('reply_ticket', { ticket: id, body }))
}

export async function closeTicket(id: number) {
  unwrap(await supabase.rpc('close_ticket', { ticket: id }))
}

export async function getViolation(id: number): Promise<Violation | null> {
  const { data, error } = await supabase
    .from('violations')
    .select('id, rule, action, reason, target_type, target_id, blocks, expires_at, is_void, void_reason, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Violation | null) ?? null
}

export async function getAppeal(violationId: number): Promise<Appeal | null> {
  const { data, error } = await supabase
    .from('appeals')
    .select('id, violation_id, body, status, decision_note, decided_at, created_at')
    .eq('violation_id', violationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Appeal | null) ?? null
}

// ------------------------------------------------------------------ worlds

const WORLD_FIELDS = 'id, owner_id, is_published, archived_at, updated_at, content_id, slug, name, description, creator_name, cover_url, runtime_version, visit_count, like_count, dislike_count, favourite_count, genre, maturity, published_at'

export type WorldSort = 'trending' | 'new' | 'popular'

/**
 * Worlds to look through.
 *
 * The same shape the Space directory had, because the job is the same one:
 * what is being played, what is new, what people liked.
 */
export async function listWorlds(options: {
  sort?: WorldSort
  genre?: string | 'all'
  search?: string
  limit?: number
} | number = {}): Promise<World[]> {
  // The old call took a count. Anything still doing that keeps working.
  const settings = typeof options === 'number' ? { limit: options } : options
  const { sort = 'new', genre = 'all', search, limit = 24 } = settings

  let query = supabase
    .from('worlds')
    .select(WORLD_FIELDS)
    .eq('is_published', true)
    .eq('is_removed', false)
    .limit(limit)

  if (genre !== 'all') query = query.eq('genre', genre)
  if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)

  query = sort === 'new'
    ? query.order('published_at', { ascending: false })
    : sort === 'popular'
      ? query.order('like_count', { ascending: false })
      : query.order('visit_count', { ascending: false })

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as World[]
}

/** The Worlds somebody kept. */
export async function listFavouriteWorlds(userId: string): Promise<World[]> {
  const { data, error } = await supabase
    .from('world_favourites')
    .select(`world:worlds (${WORLD_FIELDS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as { world: World | null }[])
    .map((row) => row.world)
    .filter(Boolean) as World[]
}

/** What somebody has out, for their profile. */
export async function listWorldsByOwner(ownerId: string, includeDrafts = false): Promise<World[]> {
  let query = supabase.from('worlds').select(WORLD_FIELDS)
    .eq('owner_id', ownerId).eq('is_removed', false)
  if (!includeDrafts) query = query.eq('is_published', true)
  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as World[]
}

/**
 * By the number in its address, which is how the website links to one.
 *
 * The owner comes with it, because "By somebody" on a World's page should
 * lead to that somebody rather than being a piece of text.
 */
export async function getWorld(contentId: number): Promise<World | null> {
  const { data, error } = await supabase
    .from('worlds')
    /*
     * Named by the column, which is the only form that is both unambiguous
     * and safe from a rename.
     *
     * There are three ways from a World to a person, not one: owner_id, and
     * the two junctions world_opinions and world_favourites, which each
     * point at worlds and at profiles and so read as many-to-many. Asking
     * for `profiles` on its own is ambiguous, and asking for a constraint by
     * name breaks the day somebody renames a table.
     */
    .select(`${WORLD_FIELDS}, owner:profiles!owner_id (id, username, display_name, avatar_url, is_admin, is_guest)`)
    .eq('content_id', contentId)
    .eq('is_removed', false)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as World | null) ?? null
}

// ------------------------------------------- signing in to an application

/**
 * A code for a Kobblon application, minted for whoever is signed in here.
 *
 * Worth one exchange and two minutes. It travels through a protocol link, so
 * it is never a session and never a token: those end up in shell history.
 */
export async function mintAppCode(client: 'launcher' | 'creator'): Promise<string> {
  return unwrap(await supabase.rpc('mint_app_code', { which: client })) as string
}

// --------------------------------------------------------- making a World

/**
 * A new World, empty and unpublished.
 *
 * Creator calls this, uploads the manifest to `<id>/manifest.json` in the
 * `worlds` bucket, then publishes. The manifest is a file rather than a
 * column: it is fetched at the start of every session and it only grows.
 */
export async function createWorld(name: string): Promise<World> {
  return unwrap(await supabase.rpc('create_world', { called: name })) as World
}

/** Puts a World out, or takes it back in. */
export async function publishWorld(id: string, out = true): Promise<World> {
  return unwrap(await supabase.rpc('publish_world', { which: id, out_now: out })) as World
}

/** Which pile of somebody's Worlds to look at. */
export type WorldShelf = 'active' | 'published' | 'drafts' | 'archived' | 'all'

/**
 * Everything somebody has built.
 *
 * Archived Worlds are left out unless asked for: putting something away
 * should mean not seeing it.
 */
export async function myWorlds(shelf: WorldShelf = 'active'): Promise<World[]> {
  return (unwrap(await supabase.rpc('my_worlds', { shelf })) as World[]) ?? []
}

/** Putting a World away, or taking it back out. Not the same as unpublishing. */
export async function archiveWorld(id: string, away = true): Promise<World> {
  return unwrap(await supabase.rpc('archive_world', { which: id, away })) as World
}

/**
 * Getting rid of a World for good.
 *
 * The files go with it. What people thought of it is kept, because a
 * moderator looking into a report needs the thing the report is about.
 */
export async function deleteWorld(id: string) {
  unwrap(await supabase.rpc('delete_world', { which: id }))
}

/**
 * Everything about a World that is not its scene.
 *
 * One function, called by the Create pages here and by Creator on the
 * desktop, because two signatures would mean two sets of rules about who may
 * change what. Leaving a field out leaves it alone.
 */
export async function configureWorld(id: string, changes: {
  name?: string
  description?: string
  genre?: string | null
  maturity?: WorldMaturity
  /** A path inside this World's own folder, or '' to take the emblem off. */
  cover?: string
}): Promise<World> {
  return unwrap(await supabase.rpc('configure_world', {
    which: id,
    called: changes.name ?? null,
    about: changes.description ?? null,
    genre: changes.genre ?? null,
    maturity: changes.maturity ?? null,
    cover: changes.cover ?? null,
  })) as World
}

/** The genres, in the order they are shown. One list, shared by both clients. */
export async function worldGenres(): Promise<WorldGenre[]> {
  return (unwrap(await supabase.rpc('world_genre_list')) as WorldGenre[]) ?? []
}

/** What a World shows of itself, in the order it chose. */
export async function worldMedia(worldId: string): Promise<WorldMedium[]> {
  const { data, error } = await supabase
    .from('world_media')
    .select('id, world_id, position, kind, path, created_at')
    .eq('world_id', worldId)
    .order('position')
  if (error) throw new Error(error.message)
  return (data ?? []) as WorldMedium[]
}

/** What the person reading the page has already said about this World. */
export async function myWorldStanding(worldId: string): Promise<WorldStanding> {
  const rows = unwrap(await supabase.rpc('my_world_standing', { which: worldId })) as WorldStanding[]
  return rows?.[0] ?? { opinion: null, favourited: false }
}

/** Liking a World, not liking it, or taking either back with `null`. */
export async function setWorldOpinion(worldId: string, think: boolean | null) {
  unwrap(await supabase.rpc('set_world_opinion', { which: worldId, think }))
}

/** Whether this person has asked to be told when a World changes. */
export async function doIWatchWorld(worldId: string): Promise<boolean> {
  return Boolean(unwrap(await supabase.rpc('do_i_watch_world', { which: worldId })))
}

/** Asking to be told, or asking to stop being told. */
export async function watchWorld(worldId: string, userId: string, on: boolean) {
  const result = on
    ? await supabase.from('world_watchers').insert({ world_id: worldId, user_id: userId })
    : await supabase.from('world_watchers').delete()
        .eq('world_id', worldId).eq('user_id', userId)
  if (result.error) throw new Error(result.error.message)
}

/**
 * The owner saying their World changed, which tells everybody watching.
 *
 * Deliberately a thing somebody does rather than something every save sets
 * off: a platform that says eleven times a day that a wall moved is one
 * whose notifications get switched off.
 */
export async function announceWorldUpdate(worldId: string, note: string) {
  return unwrap(await supabase.rpc('announce_world_update', {
    which: worldId, note: note.trim() || null,
  })) as number
}

/** Keeping a World, or letting it go. */
export async function favouriteWorld(worldId: string, userId: string, on: boolean) {
  const result = on
    ? await supabase.from('world_favourites').insert({ world_id: worldId, user_id: userId })
    : await supabase.from('world_favourites').delete()
        .eq('world_id', worldId).eq('user_id', userId)
  if (result.error) throw new Error(result.error.message)
}

/** Where a World's own files answer from. Public: they are what it shows. */
export function worldFileUrl(path: string) {
  const base = import.meta.env.VITE_SUPABASE_URL ?? ''
  return `${base}/storage/v1/object/public/worlds/${path}`
}

/**
 * A file into a World's own folder.
 *
 * The bucket's policies already say only the owner of that World may write
 * there, so this is not where that is decided; it is only where the path is
 * built, in one place, so that every client agrees on the shape of it.
 */
export async function uploadWorldFile(worldId: string, file: File, as: string) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${worldId}/${as}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('worlds')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** Something a World shows of itself, added to the end of what it shows. */
export async function addWorldMedium(
  worldId: string, kind: 'image' | 'video', path: string, position: number,
) {
  const { error } = await supabase
    .from('world_media')
    .insert({ world_id: worldId, kind, path, position })
  if (error) throw new Error(error.message)
}

/** And taken off again, file and row together. */
export async function removeWorldMedium(medium: WorldMedium) {
  const { error } = await supabase.from('world_media').delete().eq('id', medium.id)
  if (error) throw new Error(error.message)
  // A row with no file is a broken picture; a file with no row is litter.
  await supabase.storage.from('worlds').remove([medium.path]).catch(() => null)
}
