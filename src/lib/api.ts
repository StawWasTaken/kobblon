import { supabase } from './supabase'
import {
  canPreview, previewOf, previewOfUrl, PREVIEW_TYPE, PREVIEW_EXTENSION,
  CARD_MARK, cardIsCurrent,
} from './preview'
import { drawPortrait, drawItemCard, type PortraitLook } from './portrait'
import { formatOf, socketFor, type WornFit } from '@/engine'
import { FLOOR_FACE } from './mannequin'
import { plainFace } from './plainFace'
import { timeAgo } from './format'
import type {
  ActivityEvent, AssetKind, BoardRow, BoardSide, Community, EarnedBadge,
  ForumPerson, ForumRelated, ForumTagOption, ForumWritten, MarketAsset,
  OwnerBoard, PersonPlace, WorldBoard, WorldBoardRow,
  MemberCommunity, Message, Notification, OwnAsset, PixelTransaction, PlatformStats, Profile,
  ProfileOverview, Space, SpaceBadge, SpaceCategory, SpaceMessage, SpaceStats, Conversation,
  CommunityMember, CommunityOverview, CommunityPost, CommunityRank, CommunityRequest,
  CommunityRelation, CommunityBan, CommunityAuditEntry,
  AssetPageItem, AssetDay, CreatorAssetRow, Collaborator, UsernameRecord,
  AssetRequest, OwnedAsset, AssetReview, CreatorPage,
  CommunityEvent, EventPage, EventAttendee, BuildTarget, CommunityMoneyRow,
  AccountStanding, AccountLock, Violation, Appeal, Letter, Ticket, TicketMessage, TicketTopic,
  World, Quest, QuestCounted, QuestRequest, StaffCommunity,
  Behaviour, ModerationRow, StaffModerationRow, TicketDevice,
  WorldGenre, WorldMedium, WorldMaturity, WorldStanding, AvatarRule, AvatarPiece, AvatarItem, AvatarKind, AvatarSlot,
  TicketStatus, BehaviourBand, ViolationAction, ModeratedBy,
  ForumBoard, ForumTopic, ForumReply, ForumSort, ForumStatus,} from '@/types/db'

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

/**
 * Is this community name free, and would Kobby allow it.
 *
 * `forCommunity` is the one being renamed, so editing a word in the middle
 * of a name and putting it back does not come back as taken.
 */
export async function checkCommunityName(
  candidate: string,
  forCommunity?: string,
): Promise<{ ok: boolean; reason: string | null }> {
  const rows = unwrap(await supabase.rpc('check_community_name', {
    candidate,
    for_community: forCommunity ?? null,
  })) as { ok: boolean; reason: string | null }[]
  return rows?.[0] ?? { ok: false, reason: 'That name could not be checked.' }
}

/** The owner or an admin of the community. Free, unlike a username. */
export async function renameCommunity(community: string, name: string): Promise<string> {
  return unwrap(await supabase.rpc('rename_community', {
    target: community,
    new_name: name,
  })) as string
}

/** The names a community used to go by, newest first. */
export async function communityNameHistory(
  community: string,
): Promise<{ name: string; changed_at: string }[]> {
  const rows = unwrap(await supabase.rpc('community_name_history_of', { target: community }))
  return (rows as { name: string; changed_at: string }[]) ?? []
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
  /** Best friends, and which way round anybody has asked. */
  are_best: boolean
  best_asked_by_me: boolean
  best_asked_of_me: boolean
}

/** One person in one of the lists on the friends page. */
export type PersonRow = Profile & {
  since: string
  /** Guests wear the guest face, so the lists carry that too. */
  link_id: string | null
  /** A best friend, which is why they are at the top of the list. */
  best?: boolean
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
    are_best: false, best_asked_by_me: false, best_asked_of_me: false,
  }
}

/**
 * Best friends: asking, answering, and stepping back.
 *
 * Three doors because a request is three things somebody can do with it, and
 * the fourth - refusing - is `answerBestFriend(target, false)`, which is the
 * same row ending up in the same state as taking your own asking back.
 */
export async function askBestFriend(target: string) {
  unwrap(await supabase.rpc('ask_best_friend', { target }))
}

export async function answerBestFriend(target: string, yes: boolean) {
  unwrap(await supabase.rpc('answer_best_friend', { target, yes }))
}

/** Back to ordinary friends, or taking back the asking. Either person may. */
export async function unbestFriend(target: string) {
  unwrap(await supabase.rpc('unbest_friend', { target }))
}

/** Taking back a friend request you sent. */
export async function cancelFriendRequest(target: string) {
  unwrap(await supabase.rpc('cancel_friend_request', { target }))
}

/** Taking back a request to join a Community. */
export async function cancelJoinRequest(community: string) {
  unwrap(await supabase.rpc('cancel_join_request', { community }))
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

/**
 * Edit a message, and hand back what the server actually stored.
 *
 * Not what was typed. The censor runs on the update as well as the insert,
 * so the row that comes back can be masked - and a window that painted the
 * typed text instead showed the person their own line uncensored until they
 * reloaded, which is the one case where the filter looks like it did
 * nothing.
 */
export async function editMessage(id: number, body: string): Promise<Message> {
  return unwrap(await supabase.from('messages').update({ body: body.trim() })
    .eq('id', id).select('*').single()) as Message
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
    | 'avatar_item' | 'outfit' | 'forum_topic' | 'forum_post'
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
  /** For a mesh: the Decal it wears, so the card shows the dressed model. */
  skin?: string | null
  /** For a mesh: the angle to take it from, when somebody has chosen one. */
  angle?: { yaw: number; pitch: number } | null
}): Promise<string | null> {
  if (!canPreview(input.kind)) return null

  const drawn = input.file
    ? await previewOf(input.file, input.kind, input.skin, input.angle)
    : input.url
      ? await previewOfUrl(input.url, input.kind, input.skin, input.angle)
      : null
  if (!drawn) return null

  /*
   * Named and typed by what was actually drawn, rather than by what previews
   * used to be. They are WebP now, because JPEG cannot say "transparent" and
   * a cut-out Decal came out on a black rectangle; a file called .jpg served
   * as image/jpeg while holding WebP bytes is the next bug along.
   */
  const path = `${input.userId}/${crypto.randomUUID()}.${CARD_MARK}.${PREVIEW_EXTENSION}`
  const put = await supabase.storage
    .from(previewBucket)
    .upload(path, drawn, { contentType: drawn.type || PREVIEW_TYPE, upsert: false })
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
/*
 * Signed links already handed out, so a page does not buy the same one
 * twice.
 *
 * Every model, texture and preview asked for its own signature every time
 * it was drawn - a round trip each, repeated on every render, every page and
 * every reload. Worse than the waiting: a fresh signature is a **new URL**,
 * so the browser's own cache missed a picture it already had and downloaded
 * it again. Staw: "images take time to load, previews take time to load".
 *
 * Kept for the life of the tab and reused until a minute before it expires,
 * which is what makes a reload show the pictures it showed a second ago. In
 * flight is shared too: twenty tiles of one thing are one signature.
 *
 * It grants nothing: a signature is handed to this browser for files it was
 * allowed to ask about, and keeping it is the browser holding what it was
 * already given. It dies with the tab.
 */
const SIGNED = 'kob.signed'
const SIGNED_EARLY = 60_000

type SignedLink = { url: string; until: number }

const signing = new Map<string, Promise<string | null>>()

function signedAll(): Record<string, SignedLink> {
  try {
    return JSON.parse(sessionStorage.getItem(SIGNED) ?? '{}') as Record<string, SignedLink>
  } catch {
    return {}
  }
}

function signedKept(path: string): string | null {
  const one = signedAll()[path]
  if (!one || one.until - SIGNED_EARLY < Date.now()) return null
  return one.url
}

function keepSigned(path: string, url: string, seconds: number) {
  try {
    const all = signedAll()
    all[path] = { url, until: Date.now() + seconds * 1000 }
    // Anything already dead goes on the way past, so this cannot grow for
    // ever on a long session.
    for (const [name, one] of Object.entries(all)) {
      if (one.until < Date.now()) delete all[name]
    }
    sessionStorage.setItem(SIGNED, JSON.stringify(all))
  } catch {
    // A full or refused storage means asking again, which is what it did
    // before this existed.
  }
}

export function assetUrl(path: string, seconds = 900): Promise<string | null> {
  const kept = signedKept(path)
  if (kept) return Promise.resolve(kept)

  const already = signing.get(path)
  if (already) return already

  const work = (async () => {
    const { data } = await supabase.storage.from(assetBucket).createSignedUrl(path, seconds)
    const url = data?.signedUrl ?? null
    if (url) keepSigned(path, url, seconds)
    return url
  })().finally(() => { signing.delete(path) })

  signing.set(path, work)
  return work
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

/**
 * The Decal behind an id somebody typed, if they may use it.
 *
 * Takes `IMG-1042` or `1042`, because somebody copying a tag off a page gets
 * the whole thing and somebody typing it from memory does not. What comes
 * back is the row's real id, or null - and null covers both "no such Decal"
 * and "not one you may use", deliberately: the difference between those two
 * is whether a private upload exists, which is not a question an id box
 * should answer.
 */
export async function decalBehind(tag: string): Promise<{ id: string; name: string } | null> {
  const number = Number(String(tag).trim().replace(/^[A-Za-z]+-/, ''))
  if (!Number.isFinite(number) || number <= 0) return null

  const { data } = await supabase.from('assets')
    .select('id, name, kind, status, is_public, creator_id')
    .eq('content_id', number)
    .maybeSingle()

  if (!data || data.kind !== 'image') return null
  return { id: data.id as string, name: data.name as string }
}

/** The most somebody may charge for each kind of thing. */
export const priceCeilings: Record<AssetKind, number> = {
  image: 100, audio: 250, video: 500, font: 300, build: 750, mesh: 750,
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
    .select('id, kind, name, description, file_path, preview_path, status, review_note, byte_size, download_count, content_id, is_public, created_at')
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
 * Makes sure a piece of content has a card picture, and that the one it has
 * can say what it needs to say.
 *
 * Two reasons to draw one. The obvious: there is none, for work uploaded
 * before previews existed and for anything put back into Create.
 *
 * The second one is mine to own. Cards used to be written as JPEG, and JPEG
 * has no alpha - so every transparent Decal had its transparency flattened
 * to black when its card was drawn, and every mesh was photographed on a
 * painted square. That was invisible for as long as nothing read these
 * pictures. The moment the readers started returning them, every one of
 * those old cards appeared, black box and all, and a Decal that had always
 * looked right by falling back to its own file suddenly did not.
 *
 * Changing the format fixed nothing already drawn. So the extension is the
 * test: a stored card that is not `.webp` was made by the code that could
 * not keep transparency, and is drawn again. That is a fact about the file,
 * not a guess about its age - there is no timestamp on a preview and none is
 * needed.
 *
 * Only its owner can do this, because only its owner is given the file. So
 * it happens the next time they open their own page, and the old picture is
 * taken down only once the new one is saved.
 */
export async function ensureAssetPreview(asset: {
  id: string
  kind: AssetKind
  creator_id?: string | null
  file_path: string
  /** For a mesh: the stored path of the Decal it wears, if any. */
  texture_path?: string | null
}, me: string): Promise<string | null> {
  if (!canPreview(asset.kind)) return null

  /*
   * Current means drawn by today's drawing, not merely drawn. The mark in
   * the name says which generation made it; see `CARD_MARK`.
   */
  const had = await assetPreviewPath(asset.id)
  if (had && cardIsCurrent(had)) return null

  const url = await assetUrl(asset.file_path, 300)
  if (!url) return null

  /*
   * Dressed, when it wears something. Drawing the card from the model alone
   * gave a grey shape beside a textured viewer on the same page - one item,
   * two pictures, and the card is the one that travels.
   */
  const skin = asset.kind === 'mesh' && asset.texture_path
    ? await assetUrl(asset.texture_path, 300).catch(() => null)
    : null

  const drawn = await makeAssetPreview({
    assetId: asset.id, userId: me, kind: asset.kind, url, skin,
  })
  // Only once the new one is saved: a failure here leaves the card it had
  // rather than leaving it with none at all.
  if (drawn && had && had !== drawn) await removeAssetPreview(had)
  return drawn
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
  /**
   * Put it on the Creator Marketplace straight away.
   *
   * Off unless somebody says so. Uploading is not publishing: a texture made
   * for one World should not end up in a shop because nobody found a switch,
   * and a thing can be listed later from its own page whenever its maker
   * decides it is worth sharing.
   */
  listed?: boolean
  /**
   * The Decal a mesh wears.
   *
   * Either a picture uploaded in the same breath - which becomes a Decal of
   * its own, unlisted, owned by whoever uploaded the mesh - or the id of one
   * that already exists. A mesh with no texture is a grey shape, and making
   * somebody upload the shape, find the Decal page and come back is three
   * steps for one thought.
   */
  texture?: { file: File } | { id: string }
}): Promise<OwnAsset> {
  const extension = input.file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${input.userId}/${crypto.randomUUID()}.${extension}`

  /*
   * A Kobblon part file is .kbfl, which no browser has a type for, so it
   * arrives with an empty one and the bucket refuses it. It is JSON, and
   * saying so here is the difference between an upload and a shrug.
   */
  const contentType = typeOf(input.file)
    || (extension === 'kbfl' ? 'application/json' : 'application/octet-stream')

  const uploaded = await supabase.storage
    .from(assetBucket)
    .upload(path, input.file, { contentType, upsert: false })
  if (uploaded.error) throw new Error(uploaded.error.message)

  /*
   * The Decal first, if one is coming with it.
   *
   * Before the mesh rather than after, so a mesh never exists undressed: if
   * the picture is refused, nothing has been made, and somebody tries again
   * rather than finding a grey shape they have to go and fix. It is a Decal
   * in its own right - its own page, its own owner, its own screening - and
   * it is never listed on the Marketplace by being a texture. Whether the
   * mesh goes on the Marketplace is the mesh's business.
   */
  let wearing: string | null = null
  try {
    if (input.texture && 'file' in input.texture) {
      const decal = await uploadAsset({
        userId: input.userId,
        file: input.texture.file,
        kind: 'image',
        name: `${input.name.trim()} texture`.slice(0, 60),
        description: '',
        communityId: input.communityId ?? null,
        listed: false,
      })
      wearing = decal.id
    } else if (input.texture) {
      wearing = input.texture.id
    }
  } catch (err) {
    await supabase.storage.from(assetBucket).remove([path])
    throw err
  }

  try {
    const made = unwrap(await supabase.from('assets').insert({
      creator_id: input.userId,
      kind: input.kind,
      name: input.name.trim(),
      description: input.description.trim() || null,
      file_path: path,
      byte_size: input.file.size,
      community_id: input.communityId ?? null,
      is_public: input.listed === true,
      texture_id: wearing,
    }).select('id, kind, name, description, file_path, preview_path, status, review_note, byte_size, download_count, content_id, is_public, created_at')
      .single()) as unknown as OwnAsset

    // The card picture, drawn from the file that is still in hand, and
    // wearing whatever Decal was chosen a moment ago.
    await makeAssetPreview({
      assetId: made.id, userId: input.userId, kind: input.kind, file: input.file,
      skin: wearing ? await skinUrl(wearing) : null,
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
/**
 * A short-lived address for the Decal a mesh is about to wear, so the card
 * can be drawn with it. Null rather than throwing: a card is worth having
 * undressed, and never worth failing an upload over.
 */
async function skinUrl(decalId: string): Promise<string | null> {
  const { data } = await supabase.from('assets')
    .select('file_path').eq('id', decalId).maybeSingle()
  const path = (data as { file_path?: string } | null)?.file_path
  return path ? await assetUrl(path).catch(() => null) : null
}

/**
 * Draws a mesh's card again, from whatever it is wearing now.
 *
 * The picture is normally taken at upload from the file in hand. Once the
 * mesh can be redressed or its model replaced, that picture goes stale, and
 * a stale card is the kind of wrong that nobody reports because it looks
 * like a decision somebody made.
 *
 * Goes through `get_asset`, so the texture it draws with is the one the
 * server agrees this person may see.
 */
export async function redrawMesh(
  assetId: string,
  userId: string,
  angle?: { yaw: number; pitch: number } | null,
): Promise<string | null> {
  const { data } = await supabase.from('assets')
    .select('content_id').eq('id', assetId).maybeSingle()
  const contentId = (data as { content_id?: number } | null)?.content_id
  if (!contentId) return null

  const full = await getAsset(contentId)
  if (!full || full.kind !== 'mesh') return null

  const [url, skin] = await Promise.all([
    assetUrl(full.file_path),
    full.texture_path ? assetUrl(full.texture_path) : null,
  ])
  if (!url) return null

  const old = await assetPreviewPath(assetId)
  const path = await makeAssetPreview({
    assetId, userId, kind: 'mesh', url, skin, angle,
  })
  // Only once the new one is saved, so a failure leaves the old card rather
  // than no card.
  if (path && old && old !== path) await removeAssetPreview(old)
  return path
}

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
    .upload(path, file, { contentType: typeOf(file), upsert: true })
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

/**
 * Taking a post down.
 *
 * Through a function rather than an update, and the reason is worth keeping
 * because it is not an obvious one. `update community_posts set is_removed
 * = true` is refused - "new row violates row-level security policy" - and
 * the policy it means is the *read* one, not the write one. Postgres runs a
 * table's SELECT policies against the new row of an UPDATE as well, and
 * `community_posts_read` is `using (not is_removed ...)`, so the row this
 * statement writes is a row the author may no longer read, and the write is
 * refused for that reason and no other. Writing the post and editing it
 * both worked; only taking it down did not, which is why it reached Staw as
 * "we cant delete any" rather than as anything a test caught.
 *
 * Widening the read policy to let an author see their own removed posts
 * would also have fixed it, and would have meant removed posts coming back
 * on the wall. So: a `security definer` function, which checks the same
 * three rights the policy would have - the author, somebody who may
 * moderate the wall, or somebody who may manage the Community when it is an
 * announcement - and writes past the policy once it is satisfied.
 */
export async function removeCommunityPost(id: number) {
  unwrap(await supabase.rpc('remove_community_post', { target: id }))
}

/**
 * The Community somebody puts at the front of their profile.
 *
 * `null` takes it back off. The database checks they are actually in it;
 * this only asks.
 */
export async function setPrimaryCommunity(communityId: string | null) {
  unwrap(await supabase.rpc('set_primary_community', { target: communityId }))
}

/**
 * Sending Brix to somebody, with Kobblon's cut taken out of what arrives.
 *
 * The sender pays `amount`; `cut` of it is the house's and `arrived` is what
 * the other person actually gets. The split is the database's to decide and
 * is read back from it rather than worked out here - a number this page
 * calculates is a number that can disagree with the one that moved.
 */
export async function sendBrix(
  to: string, amount: number, note?: string | null,
): Promise<{ sent: number; cut: number; arrived: number; balance: number }> {
  const rows = unwrap(await supabase.rpc('send_brix', {
    to_user: to, amount, note: note?.trim() || null,
  })) as { sent: number; cut: number; arrived: number; balance: number }[]
  if (!rows?.[0]) throw new Error('That did not send.')
  return rows[0]
}

/** What share of a gift Kobblon keeps, as a whole number of per cent. */
export async function sendingShare(): Promise<number> {
  return (unwrap(await supabase.rpc('sending_share')) as number) ?? 5
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
    .from('avatars').upload(path, file, { contentType: typeOf(file, 'image/png'), upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

export const uploadSpaceImage = uploadCommunityImage


/*
 * Style is gone.
 *
 * It was the flat avatar - a picture with other pictures pasted over it at
 * coordinates - and its shop. The Catalog and the three-dimensional avatar
 * replaced both, so everything that read or wrote it has gone with it rather
 * than being left as a second way to do the same thing that nothing calls.
 *
 * The tables are still there and still hold every row. Dropping them is one
 * migration whenever Staw is sure nobody wants the old data back; the faces
 * in them have already been carried across by 0115.
 */

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

/**
 * What a locked-out account is told, and the way back in.
 *
 * Asked only when the row already says somebody is shut out - the profile
 * carries `is_suspended`, so a platform where nobody is suspended makes none
 * of these calls.
 */
export async function accountStanding(): Promise<AccountLock | null> {
  const rows = unwrap(await supabase.rpc('my_account_standing')) as AccountLock[] | null
  return rows?.[0] ?? null
}

/**
 * Coming back after a suspension has run out.
 *
 * Time does not lift it by itself: somebody has to say they are back, which
 * is the moment the rules can be put in front of them again. Refuses a
 * suspension still running and refuses a termination outright, and says so.
 */
export async function reactivateAccount(): Promise<boolean> {
  return (unwrap(await supabase.rpc('reactivate_my_account')) as boolean) ?? false
}

/**
 * Saying you have read it.
 *
 * One door for a warning and for a suspension whose time is spent, because
 * to the person pressing it they are the same sentence. Comes back saying
 * which of the two happened, so the page can say the right thing instead
 * of reloading and guessing.
 */
export async function acknowledgeStanding(): Promise<'warning_cleared' | 'back' | 'nothing'> {
  const what = unwrap(await supabase.rpc('acknowledge_my_standing'))
  return (what as 'warning_cleared' | 'back' | 'nothing') ?? 'nothing'
}

/** Calling off a deletion while there is still something to call off. */
export async function reopenAccount(target: string, why?: string) {
  unwrap(await supabase.rpc('reopen_account', { target, why: why ?? null }))
}

/** The real one. Superadmin, and only on an account already on its way out. */
export async function eraseAccount(target: string) {
  unwrap(await supabase.rpc('erase_account', { target }))
}

export async function listViolations(): Promise<Violation[]> {
  const { data, error } = await supabase
    .from('violations')
    .select('id, rule, action, reason, target_type, target_id, blocks, expires_at, is_void, void_reason, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Violation[]
}

/**
 * The behaviour bar, asked of the server every time rather than remembered.
 *
 * It climbs by being read on a later day - each decision's weight fades
 * across its own window - so a copy held anywhere would be a value captured
 * before the thing that decides it moved. There is nothing to cache here.
 */
export async function getBehaviour(): Promise<Behaviour | null> {
  const rows = unwrap(await supabase.rpc('my_behaviour')) as Behaviour[] | null
  return rows?.[0] ?? null
}

/**
 * Everything that has happened to this account: the decisions and the chat
 * suspensions, newest first, each one saying which rank decided it. Kobby is
 * the automated one, and comes back as a rank rather than an id because
 * handing a browser the id of the moderator who suspended somebody is how a
 * moderator gets harassed.
 */
export async function moderationHistory(): Promise<ModerationRow[]> {
  return (unwrap(await supabase.rpc('my_moderation_history')) as ModerationRow[]) ?? []
}

export async function listAppeals(): Promise<Appeal[]> {
  const { data, error } = await supabase
    .from('appeals')
    .select('id, violation_id, body, status, decision_note, decided_at, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Appeal[]
}

/* ------------------------------------------------- the staff appeal queue */

export type AppealRow = {
  id: number
  status: 'open' | 'upheld' | 'declined' | 'worsened'
  body: string
  created_at: string
  decision_note: string | null
  decided_at: string | null
  decided_rank: StaffRank | 'staff' | null
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  score: number
  band: BehaviourBand
  /** Which kind of decision is being argued with: a violation, or a timeout. */
  subject: 'violation' | 'timeout'
  /** First go or second. Nobody gets a third. */
  attempt: number
  violation_id: number | null
  timeout_id: string | null
  action: ViolationAction
  rule: string
  rule_ord: number | null
  rule_title: string | null
  gravity: number | null
  reason: string
  evidence: string | null
  target_type: string | null
  target_id: string | null
  blocks: string[]
  is_void: boolean
  expires_at: string | null
  decided_on: string
  /** Which rank decided the thing being appealed. Never who. */
  by_rank: ModeratedBy
  waiting_hours: number
}

/**
 * The appeals waiting to be answered.
 *
 * `decide_appeal` has existed since 0072 with nothing calling it, so every
 * appeal written from the standing page has been sitting unread while its
 * writer was told a person would look at it. This is the door.
 */
export async function appealQueue(which: 'open' | 'answered' | 'all' = 'open') {
  return (unwrap(await supabase.rpc('appeal_queue', { which })) as AppealRow[]) ?? []
}

export type AppealOutcome = 'upheld' | 'declined' | 'worsened'

export async function appealCounts(): Promise<{
  waiting: number; oldest_hours: number
  upheld_30d: number; declined_30d: number; worsened_30d: number
}> {
  const rows = unwrap(await supabase.rpc('appeal_counts')) as {
    waiting: number; oldest_hours: number
    upheld_30d: number; declined_30d: number; worsened_30d: number
  }[]
  return rows?.[0] ?? {
    waiting: 0, oldest_hours: 0, upheld_30d: 0, declined_30d: 0, worsened_30d: 0,
  }
}

/**
 * Answering one, three ways.
 *
 * Upholding voids the decision, or lifts the timeout, and lifts a
 * suspension nothing else holds. Worsening moves it one rung up and leaves
 * the original standing, because an appeal that found worse does not erase
 * what was already found.
 */
export async function decideAppeal(appeal: number, outcome: AppealOutcome, note: string) {
  unwrap(await supabase.rpc('decide_appeal', { appeal, outcome, note }))
}

/**
 * Appointing a moderator or an admin, which is a superadmin's.
 *
 * Superadmin is not one of the three words this takes, deliberately: that
 * rank is granted in the database by somebody who already holds it,
 * because a panel that can promote only has to be stolen once.
 */
export async function setStaffRank(
  target: string,
  rank: 'none' | 'moderator' | 'admin',
): Promise<string> {
  return unwrap(await supabase.rpc('set_staff_rank', { target, rank })) as string
}

export async function fileAppeal(violationId: number, body: string): Promise<number> {
  return unwrap(await supabase.rpc('file_appeal', { violation: violationId, body })) as number
}

/** The same, about a chat or voice suspension rather than a violation. */
export async function fileAppealForTimeout(timeout: string, body: string): Promise<number> {
  return unwrap(await supabase.rpc('file_appeal_for_timeout', { timeout, body })) as number
}

/**
 * The one tap on the suspension card: "I did not say that."
 *
 * The words are written by the database, not here, so the Launcher and the
 * website cannot put two different claims in somebody's mouth.
 */
export async function iDidNotSayThat(timeout: string): Promise<number> {
  return unwrap(await supabase.rpc('i_did_not_say_that', { timeout })) as number
}

/** Goes used, when the window shuts, and whether another may be written. */
export async function myTimeoutAppealState(timeout: string): Promise<{
  used: number
  closes_at: string | null
  may: boolean
}> {
  const rows = unwrap(await supabase.rpc('my_timeout_appeal_state', { timeout })) as {
    used: number; closes_at: string | null; may: boolean
  }[] | null
  return rows?.[0] ?? { used: 0, closes_at: null, may: false }
}

/**
 * Whether this account may type and whether it may speak, asked of the
 * server rather than worked out from a row the client happens to hold.
 *
 * The Launcher asks this on joining and after every suspension card: a
 * client that greys the text box and leaves the microphone live is a voice
 * suspension that does not exist.
 */
export async function mayISpeak(): Promise<{
  chat: boolean
  voice: boolean
  until: string | null
  why: string | null
}> {
  const rows = unwrap(await supabase.rpc('may_i_speak')) as {
    chat: boolean; voice: boolean; until: string | null; why: string | null
  }[] | null
  return rows?.[0] ?? { chat: true, voice: true, until: null, why: null }
}

/**
 * A line the Launcher heard in voice chat, handed over to be read.
 *
 * One call per transcribed utterance. `whereAt` is whatever the
 * application calls the place it was said, kept so a moderator can tell
 * where it happened; nothing is looked up from it. Censored on the way in
 * by the same patterns chat goes through.
 */
export async function heardInVoice(said: string, whereAt?: string): Promise<number | null> {
  return (unwrap(await supabase.rpc('heard_in_voice', {
    said, where_at: whereAt ?? null,
  })) as number | null) ?? null
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

/**
 * The tickets on the Support page: this person's own, and nobody else's.
 *
 * The `eq` is the whole of the fix for what Staw found - "WHY CAN I SEE
 * TICKETS MADE BY OTHER PEOPLE" - and it is worth saying what it is not.
 * `tickets_read` lets a moderator read every ticket, on purpose, because
 * that is what the console's Support queue is built on. So a moderator
 * asking this table for everything gets everything, correctly, and the
 * help page was asking for everything. It asks for theirs now.
 *
 * This narrowing is a page saying what it wants, not a wall. The wall is
 * the policy, and it still holds for anybody who is not staff.
 */
export async function listTickets(): Promise<Ticket[]> {
  const { data: who } = await supabase.auth.getUser()
  const me = who?.user?.id
  if (!me) return []

  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, topic, subject, status, contact_email, first_name, device, wants_human, updated_at, created_at')
    .eq('user_id', me)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Ticket[]
}

/* -------------------------------------------------- the staff ticket queue */

export type TicketRow = {
  id: number
  topic: TicketTopic
  subject: string
  status: TicketStatus
  first_name: string | null
  contact_email: string | null
  device: TicketDevice | null
  wants_human: boolean
  username: string | null
  user_id: string
  /** The first message, so a queue can be triaged without opening each one. */
  opener: string | null
  replies: number
  /** Whether the last word was theirs, which is the real order of work. */
  waiting_on_us: boolean
  created_at: string
  updated_at: string
}

/** Urgent first, then whoever has been waiting longest. Staff only. */
export async function ticketQueue(
  which: 'open' | 'urgent' | 'closed' | 'all' = 'open',
) {
  return (unwrap(await supabase.rpc('ticket_queue', { which })) as TicketRow[]) ?? []
}

export async function ticketCounts(): Promise<{
  open_now: number; urgent: number; waiting: number; closed_today: number
}> {
  const rows = unwrap(await supabase.rpc('ticket_counts')) as {
    open_now: number; urgent: number; waiting: number; closed_today: number
  }[]
  return rows?.[0] ?? { open_now: 0, urgent: 0, waiting: 0, closed_today: 0 }
}

/** Moving a ticket along without writing on it. Staff only. */
export async function setTicketStatus(ticket: number, status: TicketStatus) {
  unwrap(await supabase.rpc('set_ticket_status', { ticket, status }))
}

export async function getTicket(id: number): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, topic, subject, contact_email, first_name, device, wants_human, updated_at, created_at')
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

export async function openTicket(card: {
  topic: TicketTopic
  subject: string
  body: string
  contact_email?: string | null
  first_name?: string | null
  device?: TicketDevice | null
  wants_human?: boolean
}): Promise<number> {
  return unwrap(await supabase.rpc('open_ticket', {
    topic: card.topic,
    subject: card.subject,
    body: card.body,
    contact_email: card.contact_email ?? null,
    first_name: card.first_name ?? null,
    device: card.device ?? null,
    wants_human: card.wants_human ?? false,
  })) as number
}

/**
 * Writing on a ticket.
 *
 * `as_staff` is which hat: left off, whichever the writer holds, which is
 * what the console wants. `false` is the person's own name, which is what
 * the Support page wants - and what a moderator reading their own help page
 * got wrong before, answering themselves as Kobblon. The database refuses
 * either hat to somebody who has no right to it; this only says which was
 * meant.
 */
export async function replyTicket(id: number, body: string, asStaff?: boolean) {
  unwrap(await supabase.rpc('reply_ticket', {
    ticket: id,
    body,
    as_staff: asStaff ?? null,
  }))
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

/**
 * How a decision of yours stands on appeals: goes used, when the window
 * shuts, and whether another one may be written now. Straight from the
 * server, because the four walls are the server's to decide.
 */
export async function myAppealState(violation: number): Promise<{
  used: number
  closes_at: string | null
  may: boolean
}> {
  const rows = unwrap(await supabase.rpc('my_appeal_state', { violation })) as {
    used: number; closes_at: string | null; may: boolean
  }[] | null
  return rows?.[0] ?? { used: 0, closes_at: null, may: false }
}

export async function getAppeal(violationId: number): Promise<Appeal | null> {
  const { data, error } = await supabase
    .from('appeals')
    .select('id, violation_id, body, status, decision_note, decided_at, created_at')
    .eq('violation_id', violationId)
    // The latest go, since 0223 allows a second one. `maybeSingle` threw the
    // moment anybody used theirs.
    .order('attempt', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Appeal | null) ?? null
}

// ------------------------------------------------------------------ worlds

const WORLD_FIELDS = 'id, owner_id, is_published, archived_at, updated_at, content_id, slug, name, description, creator_name, cover_url, emblem_url, runtime_version, visit_count, like_count, dislike_count, favourite_count, genre, maturity, published_at'

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

/**
 * The Worlds this person has been in, most recent first.
 *
 * `world_visits` keeps one row per person per World per day, so the same
 * World played all week is several rows and the list has to fold them: the
 * first time a World appears is the last day it was played, and every later
 * row for it is the same World on an older day.
 *
 * No `eq` on the person. The row-level policy on `world_visits` allows each
 * account its own rows and nothing else, which is the only place that can
 * be enforced - a filter written here would be a filter anybody could take
 * back out.
 */
export async function listRecentlyPlayedWorlds(limit = 12): Promise<World[]> {
  const { data, error } = await supabase
    .from('world_visits')
    .select(`on_day, world:worlds (${WORLD_FIELDS})`)
    .order('on_day', { ascending: false })
    .limit(limit * 4)
  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const out: World[] = []
  for (const row of (data ?? []) as unknown as { world: World | null }[]) {
    const world = row.world
    if (!world || world.is_published === false || seen.has(world.id)) continue
    seen.add(world.id)
    out.push(world)
    if (out.length >= limit) break
  }
  return out
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
/** A badge a World hands out. `content_id` is the number used in scripts. */
export type WorldBadge = {
  id: string
  content_id: number
  world_id: string
  name: string
  description: string | null
  icon_url: string | null
  is_enabled: boolean
  awarded_count: number
}

/** Something a World sells. Free is allowed - a pass can be a key. */
export type WorldPass = {
  id: string
  content_id: number
  world_id: string
  name: string
  description: string | null
  icon_url: string | null
  price: number
  is_for_sale: boolean
}

export async function badgesOf(worldId: string): Promise<WorldBadge[]> {
  return (unwrap(await supabase.rpc('badges_of', { wanted: worldId })) as WorldBadge[]) ?? []
}

export async function passesOf(worldId: string): Promise<WorldPass[]> {
  return (unwrap(await supabase.rpc('passes_of', { wanted: worldId })) as WorldPass[]) ?? []
}

/**
 * Makes one and hands back its number.
 *
 * The number is the point: it is what somebody pastes into a script in the
 * Workspace to award the badge or check for the pass. The database refuses
 * anybody who does not own the World, so this does not check first - asking
 * twice only means two ways to be wrong.
 */
export async function makeWorldBadge(
  worldId: string, name: string, description?: string | null,
): Promise<number> {
  return unwrap(await supabase.rpc('make_world_badge', {
    wanted: worldId, called: name, about: description ?? null,
  })) as number
}

export async function makeWorldPass(
  worldId: string, name: string, description?: string | null, price = 0,
): Promise<number> {
  return unwrap(await supabase.rpc('make_world_pass', {
    wanted: worldId, called: name, about: description ?? null, costs: price,
  })) as number
}

/** Somebody in a server right now, as the server list hands them over. */
export type PlayerThere = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_changed_at: string | null
}

/** A running server, with the faces of the people in it. */
export type RunningServer = {
  id: string
  capacity: number
  how_many: number
  people: PlayerThere[]
}

/**
 * The servers of a World, with who is in each.
 *
 * Presence here is a claim that expires: somebody counts as playing while
 * they have said so recently. Nobody can be relied on to say goodbye - an
 * application is closed, a connection drops - so a list built on joins and
 * leaves alone would only ever grow. Read this again rather than keeping it;
 * it is true for about a minute and a half.
 */
export async function serversOf(worldId: string, faces = 6): Promise<RunningServer[]> {
  return (unwrap(await supabase.rpc('servers_of', { wanted: worldId, faces })) as RunningServer[]) ?? []
}

/** How many people are in a World right now, across every server. */
export async function playingNow(worldId: string): Promise<number> {
  return (unwrap(await supabase.rpc('playing_now', { wanted: worldId })) as number) ?? 0
}

/** A World the people who played this one also played. */
export type AlsoJoined = {
  id: string
  content_id: number
  slug: string | null
  name: string
  emblem_url: string | null
  cover_url: string | null
  creator_name: string | null
  like_count: number
  dislike_count: number
  playing: number
}

/**
 * Worlds joined by the people who joined this one.
 *
 * Built from what people actually did, so it is empty until they have done
 * it. A World nobody has played alongside anything else recommends nothing,
 * and that is the honest answer rather than a filler row.
 */
export async function alsoJoined(worldId: string, howMany = 6): Promise<AlsoJoined[]> {
  return (unwrap(await supabase.rpc('also_joined', { wanted: worldId, how_many: howMany })) as AlsoJoined[]) ?? []
}

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
/**
 * What a file actually is, when the browser will not say.
 *
 * A `File` carries the type the operating system gave it, and sometimes that
 * is an empty string: a file dragged from an archive, one whose extension the
 * machine does not recognise, a few older Windows setups. Supabase then sends
 * `application/octet-stream`, which no bucket of ours allows, and the error
 * that comes back names the type the bucket refused - so somebody uploading a
 * perfectly ordinary PNG is told that PNG is not supported.
 *
 * That message cost a round of confusion already. The extension is a worse
 * source of truth than the file's own bytes, but it is a far better one than
 * a blank, and the bucket still refuses anything it does not allow.
 */
const TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  json: 'application/json', kbfl: 'application/json',
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'model/obj',
  txt: 'text/plain',
}

/**
 * What to tell storage a file is.
 *
 * Our own mapping wins over the browser's, which is the opposite of what
 * this did. `file.type` is whatever the operating system's media-type table
 * says, and for the formats Kobblon invented or cares about that table is
 * either empty or wrong: `.kbfl` is nothing anywhere, and some systems map
 * `.obj` to `application/x-tgif`, which the bucket refuses. Trusting it
 * meant the same upload working on one laptop and failing on another.
 *
 * Every entry in `TYPES` is a deliberate statement about an extension we
 * accept, and the bucket's allowlist is written to match it. The browser is
 * the fallback, for everything we have not got an opinion about.
 */
export function typeOf(file: File, fallback = 'application/octet-stream') {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return TYPES[extension] ?? (file.type || fallback)
}

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
    .upload(path, file, { contentType: typeOf(file), upsert: false })
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

// ------------------------------------------------------------------ staff

/*
 * The Kobblon account's panel.
 *
 * Every one of these is a thin call onto a function that refuses anybody who
 * is not an admin and writes down what was done. Nothing here is a check:
 * `is_admin` in the browser decides whether to draw a button, and the
 * database decides whether anything happens. If these two ever disagree the
 * database wins, which is the only arrangement worth having.
 */

export type StaffPerson = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  content_id: number
  pixels: number
  is_verified: boolean
  is_moderator: boolean
  is_suspended: boolean
  is_admin: boolean
  /** Wears the k without holding any keys. Power implies it either way. */
  has_staff_badge: boolean
  is_guest: boolean
  created_at: string
  /** Closed for good: a termination still standing on their record. */
  is_banned: boolean
  /** When a suspension runs out. Null on a ban, which never does. */
  suspended_until: string | null
  /** What is already on the record, so this decision knows the last one. */
  past_sanctions: number
  is_superadmin: boolean
  /** False when the account was made without one, or is a guest. */
  has_email: boolean
  /** Staff made this guest real and the site is waiting for a password. */
  must_set_password: boolean
  /** On its way out, and the day the data actually goes. */
  closed_at: string | null
  erase_after: string | null
}

/** What the People panel can be asked for, beyond a name. */
export type PeopleFilter =
  | 'staff' | 'admin' | 'moderator' | 'verified'
  | 'guest' | 'real' | 'suspended' | 'banned' | 'closing'
  | 'no_email' | 'klub'

export type PeopleOrder = 'rank' | 'new' | 'old' | 'rich' | 'poor' | 'name'

export type PeopleQuery = {
  search?: string
  kind?: PeopleFilter | null
  minPixels?: number | null
  maxPixels?: number | null
  joinedSince?: string | null
  joinedBefore?: string | null
  order?: PeopleOrder
  limit?: number
}

/**
 * A sanction handed out without a report behind it.
 *
 * The same thing `takeReport` writes - a violation on the record, the mail,
 * the appeal - for staff acting on somebody they already know about. There
 * is no `termination` here and there is not going to be: closing an account
 * is `banAccount`, which the moderation worker is refused by name.
 */
export type SanctionAction = 'warning' | 'chat_suspension' | 'suspension'

export async function sanctionAccount(input: {
  target: string
  action: SanctionAction
  why: string
  rule?: string
  days?: number | null
}): Promise<{ action: string; violation: number; until: string | null }> {
  return unwrap(await supabase.rpc('sanction_account', {
    target: input.target,
    action: input.action,
    why: input.why,
    which_rule: input.rule ?? 'other',
    days: input.days ?? null,
  })) as { action: string; violation: number; until: string | null }
}

/** Closing an account. A person's decision: the worker is refused this. */
export async function banAccount(target: string, why: string, rule = 'other') {
  unwrap(await supabase.rpc('ban_account', { target, said: why, which_rule: rule }))
}

/** Undoing one. Voids the terminations rather than deleting the record. */
export async function liftAccountBan(target: string, why: string): Promise<number> {
  return unwrap(await supabase.rpc('lift_account_ban', { target, said: why })) as number
}

export type FlaggedTerm = {
  id: number
  pattern: string
  decision: 'ok' | 'review' | 'block'
  reason: string | null
  scope: string
  created_at: string
}

export type AdminLogEntry = {
  id: number
  admin_id: string | null
  action: string
  subject_id: string | null
  subject_label: string | null
  detail: Record<string, unknown>
  created_at: string
}

/**
 * The People panel's question, whole.
 *
 * Every filter is optional and the database treats nothing as "do not
 * care", so asking for a name and nothing else is what it always was. The
 * filtering is there rather than here for the usual reason: rows a browser
 * never asked for are rows it cannot be trusted to hide.
 */
export async function findPeopleAsStaff(query: string | PeopleQuery = {}): Promise<StaffPerson[]> {
  const asked: PeopleQuery = typeof query === 'string' ? { search: query } : query
  return unwrap(await supabase.rpc('admin_find_people', {
    search: asked.search ?? null,
    only_kind: asked.kind ?? null,
    min_pixels: asked.minPixels ?? null,
    max_pixels: asked.maxPixels ?? null,
    joined_since: asked.joinedSince ?? null,
    joined_before: asked.joinedBefore ?? null,
    order_by: asked.order ?? 'rank',
    how_many: asked.limit ?? 50,
  })) as StaffPerson[]
}

/**
 * A guest made into a real account, by a superadmin.
 *
 * Nothing they made is touched and nothing is signed out: the same row,
 * the same id, the same session in whatever tab they left open. What
 * changes is that the account is no longer throwaway and the site has a
 * password to ask them for when they come back.
 */
/**
 * Signing up without an email.
 *
 * Supabase wants an address for every account it holds, so one made
 * without one gets a stand-in at a domain that receives nothing - and that
 * has to happen behind the service role, in the `register` function, or
 * every account made this way sends a confirmation email into the void.
 * What comes back is a session, the same as signing in.
 */
export async function registerWithoutEmail(details: {
  username: string
  password: string
  displayName: string
  birthDate: string
  gender: string
}): Promise<{ access_token: string; refresh_token: string }> {
  const { data, error } = await supabase.functions.invoke('register', {
    body: {
      action: 'signup',
      username: details.username,
      password: details.password,
      display_name: details.displayName,
      birth_date: details.birthDate,
      gender: details.gender,
    },
  })

  if (error) {
    const response = (error as { context?: Response }).context
    const detail = await response?.json?.().catch(() => null)
    throw new Error(detail?.error ?? 'That did not go through. Try again.')
  }

  return data as { access_token: string; refresh_token: string }
}

/**
 * The password somebody is asked for after staff made their guest account
 * real. Only the account the site is actually waiting on; the function
 * checks that itself, against the caller's own token.
 */
export async function setMyFirstPassword(password: string) {
  const { error } = await supabase.functions.invoke('register', {
    body: { action: 'set-password', password },
  })
  if (error) {
    const response = (error as { context?: Response }).context
    const detail = await response?.json?.().catch(() => null)
    throw new Error(detail?.error ?? 'That did not go through. Try again.')
  }
}

export async function makeAccountReal(target: string) {
  unwrap(await supabase.rpc('admin_make_real', { target }))
}

/** Any flag left undefined is left alone, rather than sent back as it was. */
export async function setStanding(target: string, change: {
  verified?: boolean
  moderator?: boolean
  suspended?: boolean
  /** The Kobblon k on its own. A mark, not a permission. */
  staffBadge?: boolean
  why?: string
}) {
  unwrap(await supabase.rpc('admin_set_standing', {
    target,
    verified: change.verified ?? null,
    moderator: change.moderator ?? null,
    suspended: change.suspended ?? null,
    why: change.why ?? null,
    staff_badge: change.staffBadge ?? null,
  }))
}

/** Negative takes. Returns the balance afterwards, which may not be what
 *  was asked for: taking more than somebody has takes what they have. */
export async function moveBrixAsStaff(target: string, amount: number, why?: string) {
  return unwrap(await supabase.rpc('admin_move_brix', {
    target, amount, why: why ?? null,
  })) as number
}

/** Somebody else's bar, for a staff panel. Moderator and up. */
export async function behaviourOf(target: string): Promise<{
  score: number
  band: Behaviour['band']
  cleared_at: string | null
  timeout_minutes: number
} | null> {
  const rows = unwrap(await supabase.rpc('behaviour_of', { target })) as
    { score: number; band: Behaviour['band']; cleared_at: string | null; timeout_minutes: number }[] | null
  return rows?.[0] ?? null
}

export async function moderationHistoryOf(target: string): Promise<StaffModerationRow[]> {
  return (unwrap(await supabase.rpc('moderation_history_of', { target })) as
    StaffModerationRow[]) ?? []
}

/**
 * Put somebody back to a hundred. A superadmin's, and the server is where
 * that is decided: `clear_behaviour` calls `require_superadmin` whatever a
 * panel chose to draw. Returns the score afterwards, which is a hundred.
 */
export async function clearBehaviour(target: string, note?: string) {
  return unwrap(await supabase.rpc('clear_behaviour', {
    target, note: note?.trim() || null,
  })) as number
}

export async function notifyAsStaff(target: string, message: string) {
  unwrap(await supabase.rpc('admin_notify', { target, message }))
}

/** Returns how many it reached. Guests and suspended accounts are skipped. */
export async function notifyEveryone(message: string) {
  return unwrap(await supabase.rpc('admin_notify_everyone', { message })) as number
}

export async function deleteAccountAsStaff(target: string, why: string) {
  unwrap(await supabase.rpc('admin_delete_account', { target, why }))
}

export async function listFlaggedTerms(): Promise<FlaggedTerm[]> {
  return unwrap(await supabase.rpc('admin_terms')) as FlaggedTerm[]
}

export async function saveFlaggedTerm(term: {
  id?: number | null
  pattern: string
  decision: FlaggedTerm['decision']
  reason?: string | null
  scope?: string
}) {
  return unwrap(await supabase.rpc('admin_save_term', {
    term_id: term.id ?? null,
    pattern: term.pattern,
    decision: term.decision,
    reason: term.reason ?? null,
    scope: term.scope ?? 'all',
  })) as number
}

export async function deleteFlaggedTerm(termId: number) {
  unwrap(await supabase.rpc('admin_delete_term', { term_id: termId }))
}

/** Whether a pattern catches a piece of text, before it is saved. */
export async function tryFlaggedTerm(pattern: string, sample: string) {
  return unwrap(await supabase.rpc('admin_try_term', { pattern, sample })) as boolean
}

export async function listAdminLog(limit = 60): Promise<AdminLogEntry[]> {
  return unwrap(
    await supabase
      .from('admin_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
  ) as AdminLogEntry[]
}

export type RecordEntry = {
  id: number
  action: string
  by_id: string | null
  by_username: string | null
  subject_id: string | null
  subject_label: string | null
  detail: Record<string, unknown>
  created_at: string
}

/**
 * The record, filtered where it is kept.
 *
 * Filtering in the browser would only hide rows out of the sixty it was
 * handed, which answers no question anybody actually has. `staff_record`
 * refuses anybody who is not an admin and joins the name of whoever did
 * it, which the table itself cannot give.
 */
export async function staffRecord(filter: {
  what?: string | null
  term?: string | null
  sinceHours?: number | null
  limit?: number
} = {}): Promise<RecordEntry[]> {
  return unwrap(await supabase.rpc('staff_record', {
    what: filter.what || null,
    term: filter.term || null,
    since_hours: filter.sinceHours ?? null,
    how_many: filter.limit ?? 60,
  })) as RecordEntry[]
}

/** Which kinds of thing are in the record, commonest first. */
export async function staffRecordKinds(): Promise<{ action: string; how_many: number }[]> {
  return unwrap(await supabase.rpc('staff_record_kinds')) as
    { action: string; how_many: number }[]
}

// --------------------------------------------- changing a mesh afterwards

/** What changing a mesh's picture or its model costs, in Brix. */
export const MESH_EDIT_PRICE = 10

/**
 * Dressing a mesh in a Decal, or taking one off.
 *
 * Returns what it cost, which is nothing when the Decal is being removed or
 * when it was already wearing that one. The server decides both the price
 * and whether the Decal may be worn at all; this only asks.
 */
export async function redressMesh(assetId: string, decalId: string | null) {
  return unwrap(await supabase.rpc('redress_mesh', {
    target: assetId, decal: decalId,
  })) as number
}

/**
 * Replacing the model itself.
 *
 * The file goes to storage first and the path is handed over, which is the
 * shape every other upload has. The server checks the path is in the
 * caller's own folder before believing it, and puts the asset back to
 * pending - a new model has not been screened, and leaving it approved would
 * make this the way around screening.
 */
export async function replaceMeshFile(assetId: string, userId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'glb'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage
    .from(assetBucket)
    .upload(path, file, { contentType: typeOf(file), upsert: false })
  if (error) throw new Error(error.message)

  try {
    return unwrap(await supabase.rpc('replace_mesh_file', {
      target: assetId, new_path: path, new_size: file.size,
    })) as number
  } catch (err) {
    // Never leave a file in storage that nothing points at.
    await supabase.storage.from(assetBucket).remove([path])
    throw err
  }
}

// ---------------------------------------------------------------- avatars

/**
 * The bucket pictures that are worn live in.
 *
 * Public, because a shirt is seen by everybody who sees the person wearing
 * it. Wearing is publishing, and the item's own page shows the same picture
 * at full size to anybody.
 */
export const catalogBucket = 'catalog'

/**
 * The address of a worn picture.
 *
 * Two buckets hold these: `catalog` for everything made since the Catalog
 * existed, and `faces` for the ones that were in Style and were carried
 * across without moving their files. The row says which, so nothing has to
 * guess from a path - and guessing by age is the rule that works until
 * somebody uploads a face.
 */
export function catalogUrl(
  path?: string | null, bucket: string = catalogBucket,
): string | null {
  if (!path) return null
  return supabase.storage.from(bucket || catalogBucket).getPublicUrl(path).data.publicUrl
}

/**
 * The picture to show for something you wear.
 *
 * The drawn card when there is one - the body wearing it for clothes, the
 * model for an accessory - and the thing's own picture otherwise, which is
 * right for a face and is what everything made before cards existed has.
 *
 * One function because three pages and a landing rail ask this, and the day
 * one of them forgets the fallback is the day somebody's shirt is a blank
 * square on one page and fine on the next.
 */
export function cardFor(item: {
  kind?: string | null
  preview_path?: string | null
  /** The card the Creator Hub already drew for this item's model. */
  mesh_preview_path?: string | null
  image_path?: string | null
  image_bucket?: string | null
}): string | null {
  /*
   * A shirt or trousers never falls back to its own picture, because its
   * own picture is the template sheet - the thing somebody paid for. Staw:
   * "i want the previews for both trousers & shirts to be on dummies even
   * in 2d instead of the template cuz then people can steal it and reupload
   * it". Showing it at card size next to a Buy button is handing it over.
   *
   * Null here means "there is no card yet", and `WornPicture` answers that
   * by drawing the mannequin in the browser rather than showing nothing.
   */
  if ((item.kind === 'shirt' || item.kind === 'trousers') && !item.preview_path) {
    return null
  }
  /*
   * A body part has no picture of its own at all - it is a shape the engine
   * builds - so without a saved card there is nothing to fall back to. Null
   * rather than the empty address the fallbacks below would hand back, so
   * `WornPicture` draws it instead of showing a torn mark.
   */
  if (item.kind === 'bodypart' && !item.preview_path) return null
  // Drawn for this item, then the model's own card, then the thing itself.
  //
  // The middle one is the answer to accessories showing nothing: a mesh in
  // the Marketplace already has a picture, drawn at upload from the file the
  // browser was holding, and an accessory *is* that mesh. Reaching for it
  // costs no drawing, no signing and no WebGL context, any of which failing
  // is what left a shirt icon on the shelf.
  if (item.preview_path) return catalogUrl(item.preview_path)
  if (item.mesh_preview_path) return previewUrl(item.mesh_preview_path)
  return catalogUrl(item.image_path, item.image_bucket ?? undefined)
}

/**
 * Draws the card for something somebody made, if it has none or has a stale
 * one, and keeps it.
 *
 * The same rule as `ensureAssetPreview` and for the same reason: a card is
 * drawn once and is then a file in a bucket for ever, so a fix to the
 * drawing reaches nothing already made unless something redraws it. Current
 * means drawn by today's drawing - `CARD_MARK` in the name says which
 * generation made it - not merely drawn.
 *
 * Best effort. A card that will not draw leaves the item showing its own
 * picture, which for a shirt is its template and is not nothing.
 */
export async function ensureAvatarCard(item: AvatarItem, me: string): Promise<string | null> {
  // A face is its own card; drawing a body to show one would hide it.
  if (item.kind === 'face') return null
  if (item.preview_path && cardIsCurrent(item.preview_path)) return null

  const [meshUrl, textureUrl] = await Promise.all([
    item.mesh_path ? assetUrl(item.mesh_path, 300).catch(() => null) : null,
    item.texture_path ? assetUrl(item.texture_path, 300).catch(() => null) : null,
  ])

  const had = item.preview_path ?? null
  const drawn = await drawAvatarCard(item.id, me, {
    kind: item.kind,
    slot: item.slot,
    imageUrl: item.image_path
      ? catalogUrl(item.image_path, item.image_bucket ?? undefined)
      : null,
    meshUrl,
    meshFormat: item.mesh_path ? formatOf(item.mesh_path) : null,
    textureUrl,
    shape: item.shape ?? null,
  })

  // Only once the new one is saved, so a failure leaves the card it had
  // rather than leaving it with none.
  if (drawn && had && had !== drawn) {
    await supabase.storage.from(catalogBucket).remove([had])
  }
  return drawn
}

/**
 * The face the mannequin wears, fetched once and remembered.
 *
 * FACE-1119, the free one everybody starts with - so the rig on a card, on
 * an item page and in the create dialog is the same person. A drawn stand-in
 * when it cannot be fetched, which is not a nicety: a bare page, the
 * Workspace and a card drawn before anybody signs in all need a face, and
 * one that fails to load leaves the blank head this exists to avoid.
 */
let askedForFace: Promise<string> | null = null

export function mannequinFace(): Promise<string> {
  if (!askedForFace) {
    askedForFace = avatarItemPage(FLOOR_FACE)
      .then((found) => {
        const picture = found?.image_path
          ? catalogUrl(found.image_path, found.image_bucket ?? undefined)
          : null
        return picture ?? plainFace()
      })
      .catch(() => plainFace())
  }
  return askedForFace
}

/** Forgets it, which only a test or a hot reload wants. */
export function forgetMannequinFace() {
  askedForFace = null
}

/**
 * Where an accessory sits, as its maker placed it.
 *
 * Applied on top of the automatic fit, so `null` is "wherever the measuring
 * put it" and is a real answer rather than a missing one.
 */
export async function setAvatarFit(id: string, fit: WornFit | null) {
  unwrap(await supabase.rpc('set_avatar_fit', { target: id, fit }))
}

/**
 * Draws the card again whatever is there now.
 *
 * `ensureAvatarCard` is the one that decides; this is the one somebody
 * presses when the picture is missing and they want to know why. It throws
 * rather than returning null quietly, because the whole point of pressing it
 * is to find out.
 */
export async function redrawAvatarCard(item: AvatarItem, me: string): Promise<string | null> {
  return ensureAvatarCard({ ...item, preview_path: null }, me)
}

/**
 * Screens an avatar item, which only a moderator or an admin may do.
 *
 * The page offers it on what it can see; the server decides. An item cannot
 * be screened by the person who made it, and that refusal is the database's,
 * not this function's.
 */
export async function reviewAvatarItem(
  id: string, decision: 'approved' | 'rejected', note?: string,
) {
  unwrap(await supabase.rpc('review_avatar_item', {
    target: id, decision, note: note ?? null,
  }))
}

/**
 * One Catalog item, by its number, for its own page.
 *
 * Comes back null for something that was never screened or does not exist -
 * which the page shows as "no such thing" rather than as an error, because
 * to somebody following an old link those are the same event.
 */
export async function avatarItemPage(wanted: number): Promise<AvatarItem | null> {
  const rows = unwrap(await supabase.rpc('avatar_item_page', { wanted })) as AvatarItem[]
  return rows?.[0] ?? null
}

/**
 * Takes something out of the Catalog and pays its buyers back.
 *
 * Returns how many Brix went out. Only a moderator or an admin; the server
 * decides that, and it refuses the maker even for their own thing - taking
 * something back off people is a moderator's act whoever made it.
 */
export async function removeAvatarItem(id: string, note?: string): Promise<number> {
  return unwrap(await supabase.rpc('remove_avatar_item', {
    target: id, note: note ?? null,
  })) as number
}

/**
 * Stars something, or takes the star off. Hands back the new count, which is
 * the server's rather than the page's guess at what its own press did.
 */
export async function favouriteAvatarItem(id: string, on: boolean): Promise<number> {
  return unwrap(await supabase.rpc('favourite_avatar_item', {
    target: id, on_off: on,
  })) as number
}

/** Everything somebody has starred, newest first. */
export async function myFavouriteAvatarItems(): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('my_favourite_avatar_items')) as AvatarItem[]) ?? []
}

/**
 * What somebody uploaded to the Marketplace and nobody has judged yet.
 *
 * Carries the maker with it, because screening is looking at the thing *and*
 * at who made it - a queue of titles and uuids asks somebody to decide
 * blind. Empty for anybody who may not screen, decided by the database.
 */
export type ScreeningAsset = {
  id: string
  kind: AssetKind
  name: string
  description: string | null
  file_path: string
  preview_path: string | null
  thumbnail_path: string | null
  byte_size: number
  created_at: string
  creator_id: string
  creator_username: string
  creator_display_name: string
  creator_is_suspended: boolean
}

/**
 * The same line with the bad words taken out.
 *
 * One call, one answer, and the same terms that judge a username. This is
 * the whole of what a chat window has to do to be moderated: hand it to
 * `ChatService` as its `screen`, and what leaves the machine is what came
 * back from here rather than what was typed.
 *
 * It refuses when it cannot tell. The filter being unreachable is not
 * permission - that would make a dropped connection the way round it - and
 * `ChatService` says as much to whoever typed it.
 *
 * `setSupabaseClient` means this works from the Launcher and the Workspace
 * too, against whatever session they hold.
 */
/** A chat suspension somebody is under, or has just come out of. */
export type ChatStanding = {
  id: string
  until: string
  minutes: number
  reason: string
  source: 'machine' | 'staff'
  seen: boolean
  over: boolean
  /** The line that was acted on, already censored, or null for an older row. */
  evidence: string | null
  rule: string | null
  rule_ord: number | null
  rule_title: string | null
  gravity: number | null
  /**
   * Which ways of talking are suspended. Read it rather than assuming
   * chat: a row saying `['chat','voice']` and a client that only greys out
   * the text box is a voice suspension that does not exist.
   */
  channels: string[]
}

/**
 * Whether this person may talk, asked of the server.
 *
 * Null is the ordinary answer. The row is the authority - a suspension
 * lives on the server with a time on it, so leaving and coming back,
 * signing in elsewhere, or clearing a browser changes nothing, which is
 * the whole point of it.
 */
export async function myChatStanding(): Promise<ChatStanding | null> {
  const { data, error } = await supabase.rpc('my_chat_standing')
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as ChatStanding | undefined
  return row ?? null
}

/** Say the card has been read, so it is not shown again. */
export async function chatCardSeen(which: string, ended = false) {
  await supabase.rpc('chat_card_seen', { which, ended })
}

export async function screenSay(
  text: string,
): Promise<{ allowed: boolean; clean: string; reason?: string }> {
  const { data, error } = await supabase.rpc('screen_say', { words: text })
  if (error) throw new Error(error.message)
  const said = (Array.isArray(data) ? data[0] : data) as
    { allowed: boolean; clean: string | null; reason: string | null } | null
  /*
   * No answer is not permission, and it is not a licence to send the raw
   * line either: the caller sends `clean`, so `clean` has to be something
   * safe when there is nothing to go on.
   */
  if (!said) return { allowed: false, clean: '', reason: 'That could not be checked.' }
  return {
    allowed: said.allowed,
    clean: said.clean ?? '',
    reason: said.reason ?? undefined,
  }
}

export async function screeningQueue(howMany = 50): Promise<ScreeningAsset[]> {
  return (unwrap(await supabase.rpc('screening_queue', { how_many: howMany })) as ScreeningAsset[]) ?? []
}

/**
 * Approves or rejects one, which only a moderator or an admin may do.
 *
 * A note on a rejection is the whole of what the maker is told, so the page
 * asks for one. The server does not require it - a thing can be obvious -
 * but a rejection with nothing said is somebody's work disappearing.
 */
export async function reviewAsset(
  id: string, decision: 'approved' | 'rejected', note?: string,
) {
  unwrap(await supabase.rpc('review_asset', {
    target: id, decision, note: note ?? null,
  }))
}

/** What is waiting to be screened. Empty for anybody who may not screen. */
export async function avatarReviewQueue(howMany = 50): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('avatar_review_queue', { how_many: howMany })) as AvatarItem[]) ?? []
}

/**
 * The sale that is on, if one is.
 *
 * Null when nothing is on, which is the ordinary case. The page uses it to
 * *show* a price; `sale_price` in the database is what somebody is actually
 * charged, and those two agreeing is the whole job - see `priceNow` below.
 */
export type CatalogSale = { percent_off: number; ends_at: string; note: string | null }

export async function saleNow(): Promise<CatalogSale | null> {
  const rows = unwrap(await supabase.rpc('sale_now')) as CatalogSale[]
  return rows?.[0] ?? null
}

/**
 * What something costs today, for showing.
 *
 * **This is a copy of `sale_price` in the database and has to stay one.** A
 * limited is never discounted - somebody paid what a limited cost because it
 * was closing, and a discount a week later is that promise broken - a free
 * thing stays free, and the rest rounds up, so a sale never makes something
 * cost nothing.
 *
 * The server charges its own version. If these two ever disagree the server
 * wins and the page is simply lying, which is why the rule is four lines and
 * not four conditions scattered through a page.
 */
export function priceNow(
  item: { price: number; sells_until?: string | null },
  sale: CatalogSale | null,
): number {
  if (!sale || item.price <= 0) return item.price
  if (item.sells_until) return item.price
  return Math.max(1, Math.ceil((item.price * (100 - sale.percent_off)) / 100))
}

/** Puts the whole Catalog on sale. Kobblon only; the database decides. */
export async function startCatalogSale(
  percent: number, until: string, why?: string,
): Promise<string> {
  return unwrap(await supabase.rpc('start_catalog_sale', {
    percent, until, why: why ?? null,
  })) as string
}

/** Ends whatever sale is on, now. */
export async function endCatalogSale() {
  unwrap(await supabase.rpc('end_catalog_sale'))
}

/**
 * Puts a new picture on a face. Kobblon only, faces only.
 *
 * Everything else keeps the edit card's promise - what it is and the picture
 * on it stay as they are - because somebody who bought it bought that. A
 * face is the house's own furniture and is allowed to be redrawn.
 */
export async function replaceAvatarPicture(id: string, picture: string) {
  unwrap(await supabase.rpc('replace_avatar_picture', { target: id, picture }))
}

// --------------------------------------------------------- the machine

/**
 * What the moderation machine is allowed to do.
 *
 * Off is the shipped state, and the limits Staw set live in the database:
 * it may approve, reject, warn and suspend, and there is no door at all for
 * deleting an account.
 */
export type AiSettings = {
  is_on: boolean
  mode: 'always' | 'slow' | 'busy'
  after_minutes: number
  when_over: number
  may_warn: boolean
  may_suspend: boolean
  model: string
  vision_model: string
  updated_at: string
}

export type AiReview = {
  id: number
  subject: string
  subject_id: string
  decision: string
  reason: string | null
  model: string | null
  created_at: string
}

export async function aiSettings(): Promise<AiSettings | null> {
  const { data } = await supabase.from('ai_settings').select('*').maybeSingle()
  return (data as AiSettings | null) ?? null
}

/**
 * Which models the Groq key can actually use, today.
 *
 * Asked of Groq through the worker rather than written down here, because
 * a name written down is a name that is right until Groq retires it - and
 * the only symptom of that is the machine quietly deciding nothing.
 */
/**
 * Why a call to an edge function did not arrive.
 *
 * supabase-js says "Failed to send a request to the Edge Function" for
 * every network-level failure, and that one sentence covers a function
 * that is not deployed, a gateway refusing the preflight, a function that
 * threw before it could put CORS headers on anything, and a browser
 * extension eating the request. They need four different fixes and the
 * message tells you nothing.
 *
 * So when it happens, ask the function the simplest question there is -
 * `?ping`, which answers before the method check and before the sign-in
 * check - and say which of the four it was. The ping is a plain GET with
 * no headers, so it needs no preflight: if the ping lands and the real
 * call does not, the fault is the preflight and nothing else.
 */
async function whyNoFunction(name: string, said: string): Promise<string> {
  const base = import.meta.env.VITE_SUPABASE_URL ?? ''
  if (!base) return `${said} The site has no Supabase address configured.`

  let ping: Response
  try {
    ping = await fetch(`${base}/functions/v1/${name}?ping`)
  } catch {
    return `${said} The function could not be reached at all - either it is not deployed, or something in this browser is blocking requests to Supabase (an extension, or an ad blocker).`
  }

  if (ping.status === 404) return `${said} There is no function called "${name}" deployed on this project.`
  if (ping.status === 401 || ping.status === 403) {
    return `${said} The gateway is refusing the request before the function runs, which is the "Verify JWT" setting on ${name}: a browser cannot send a token on a preflight. Turn it off for this function; it checks who is asking by itself.`
  }
  if (!ping.ok) return `${said} The function answered ${ping.status} to a plain ping, so it is failing before it runs.`

  const alive = await ping.json().catch(() => null) as
    { hasGroqKey?: boolean; hasServiceKey?: boolean } | null
  if (alive && alive.hasGroqKey === false) {
    return `${said} The function is alive but has no GROQ_API_KEY set.`
  }
  return `${said} The function is alive and answers a plain ping, so what is being refused is the preflight on the real call - check "Verify JWT" on ${name}.`
}

/**
 * Why the machine has done nothing.
 *
 * Four questions in the order they stop being answerable, each with the
 * sentence that step actually produced. "It does not work" has had three
 * different causes on this project - a function that was never deployed,
 * a gateway refusing before the function ran, and a key that did not
 * match - and from the console all three looked the same.
 *
 * Nothing here is privileged: the ping says whether the function exists
 * and whether its secrets are set, as booleans. No key is read, and none
 * could be: they are on the server.
 */
export type MachineStep = {
  step: string
  ok: boolean | null
  said: string
}

export async function checkTheMachine(): Promise<MachineStep[]> {
  const out: MachineStep[] = []
  const base = import.meta.env.VITE_SUPABASE_URL ?? ''

  if (!base) {
    out.push({ step: 'The site knows where Supabase is', ok: false, said: 'VITE_SUPABASE_URL is not set in this build.' })
    return out
  }

  let ping: Response | null = null
  try {
    ping = await fetch(`${base}/functions/v1/moderate?ping`)
  } catch {
    ping = null
  }

  if (!ping) {
    out.push({
      step: 'The worker is deployed',
      ok: false,
      said: 'It could not be reached at all. Either it was never deployed, or something in this browser is blocking Supabase.',
    })
    return out
  }

  if (ping.status === 404) {
    out.push({
      step: 'The worker is deployed',
      ok: false,
      said: 'There is no function called "moderate" on this project. Deploy it: supabase functions deploy moderate.',
    })
    return out
  }

  if (ping.status === 401 || ping.status === 403) {
    out.push({
      step: 'The worker is deployed',
      ok: false,
      said: `The gateway answered ${ping.status} before the function ran. That is "Verify JWT" on the function: turn it off in Edge Functions, moderate, Details. It checks who is asking by itself.`,
    })
    return out
  }

  const alive = await ping.json().catch(() => null) as
    { hasGroqKey?: boolean; hasServiceKey?: boolean } | null

  out.push({ step: 'The worker is deployed', ok: ping.ok, said: ping.ok ? 'It answers.' : `It answered ${ping.status} to a plain ping.` })
  if (!ping.ok) return out

  out.push({
    step: 'Its secrets are set',
    ok: Boolean(alive?.hasGroqKey && alive?.hasServiceKey),
    said: !alive?.hasGroqKey
      ? 'No GROQ_API_KEY on the function, so nothing can be asked of Groq.'
      : !alive?.hasServiceKey
        ? 'No SUPABASE_SERVICE_ROLE_KEY on the function.'
        : 'Both are there.',
  })

  try {
    const models = await groqModels()
    out.push({
      step: 'Your sign-in gets through, and Groq answers',
      ok: true,
      said: `${models.length} models this key can use.`,
    })
  } catch (error) {
    out.push({
      step: 'Your sign-in gets through, and Groq answers',
      ok: false,
      said: error instanceof Error ? error.message : 'It did not answer.',
    })
    return out
  }

  try {
    const waiting = await aiWorkWaiting()
    out.push({
      step: 'It is switched on, with something to read',
      ok: Boolean(waiting?.is_on) && (waiting?.total ?? 0) > 0,
      said: !waiting?.is_on
        ? 'Switched off. Nothing runs until it is on.'
        : waiting.total === 0
          ? 'On, and nothing is waiting - so a run would do nothing, correctly.'
          : `On, with ${waiting.total} waiting.`,
    })
  } catch (error) {
    out.push({
      step: 'It is switched on, with something to read',
      ok: false,
      said: error instanceof Error ? error.message : 'The queue could not be read.',
    })
  }

  try {
    const door = await pokeState()
    out.push({
      step: 'It is woken the moment work lands',
      ok: Boolean(door.wired && door.net_ready),
      said: !door.net_ready
        ? 'pg_net is not on for this project, so the database cannot call out. Database, Extensions, pg_net.'
        : !door.wired
          ? 'No address or key stored, so new work waits for the clock instead. The statement that sets it is in migration 0224.'
          : door.last_at
            ? `Wired. It last knocked ${timeAgo(door.last_at)}.`
            : 'Wired, and it has not had to knock yet.',
    })
  } catch (error) {
    out.push({
      step: 'It is woken the moment work lands',
      ok: false,
      said: error instanceof Error ? error.message : 'That could not be read.',
    })
  }

  return out
}

/**
 * Whether the database can wake the worker by itself, and when it last did.
 *
 * Never the address and never the key: `poke_state` does not return them,
 * on purpose.
 */
export async function pokeState(): Promise<{
  wired: boolean
  net_ready: boolean
  last_at: string | null
}> {
  const rows = unwrap(await supabase.rpc('poke_state')) as {
    wired: boolean; net_ready: boolean; last_at: string | null
  }[] | null
  return rows?.[0] ?? { wired: false, net_ready: false, last_at: null }
}

/**
 * Everything the machine panel shows, in one call.
 *
 * `pokeState` answered whether the door is wired and nothing else, which is
 * a third of the question somebody standing in front of this actually has:
 * is it running, is anything scheduled to run it, and when did it last do
 * something. No address and no key come back - that has not changed and
 * must not.
 */
export type MachinePulse = {
  is_on: boolean
  mode: 'always' | 'slow' | 'busy' | null
  /** The database knows the worker's address and key. */
  wired: boolean
  /** `pg_net` is installed, so a knock can physically go out. */
  net_ready: boolean
  /** The every-minute sweep is scheduled and switched on. */
  beating: boolean
  /** Its cron line, for showing how often. */
  every: string | null
  last_poke_at: string | null
  last_decision_at: string | null
  decided_today: number
  waiting: number
  oldest_minutes: number | null
}

export async function machinePulse(): Promise<MachinePulse | null> {
  const rows = unwrap(await supabase.rpc('machine_pulse')) as MachinePulse[] | null
  return rows?.[0] ?? null
}

/** The numbers the console opens on. Counts only, in one round trip. */
export type StaffOverview = {
  reports_open: number
  appeals_open: number
  tickets_open: number
  tickets_urgent: number
  screening: number
  people_total: number
  people_online: number
  joined_today: number
  sanctions_week: number
  machine_on: boolean
  machine_waiting: number
}

export async function staffOverview(): Promise<StaffOverview | null> {
  const rows = unwrap(await supabase.rpc('staff_overview')) as StaffOverview[] | null
  return rows?.[0] ?? null
}

/**
 * Asking Kobby to draft a change to the word filter.
 *
 * It drafts and nothing else: what comes back is a proposal the console
 * shows, and saving each line goes through `saveFlaggedTerm` under the
 * account that ticked it - so a change to what the house catches is in the
 * staff record as somebody's, not the machine's.
 */
export type KobbyDraft = {
  words: {
    pattern: string
    decision: FlaggedTerm['decision']
    reason: string
    scope: string
  }[]
  note: string
  /** Only when the instruction actually asked for the machine to change. */
  settings: Partial<{ warn: boolean; suspend: boolean; how: 'always' | 'slow' | 'busy' }> | null
}

export async function askKobbyForWords(instruct: string): Promise<KobbyDraft> {
  const { data, error } = await supabase.functions.invoke('moderate', { body: { instruct } })
  if (error) {
    const context = (error as { context?: Response }).context
    if (!context) throw new Error(await whyNoFunction('moderate', error.message))
    const said = await context.json?.().catch(() => null)
    throw new Error(said?.error ?? error.message)
  }
  const out = data as KobbyDraft
  return { words: out.words ?? [], note: out.note ?? '', settings: out.settings ?? null }
}

export async function groqModels(): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('moderate', { body: { list: true } })
  if (error) {
    const context = (error as { context?: Response }).context
    if (!context) throw new Error(await whyNoFunction('moderate', error.message))
    const said = await context.json?.().catch(() => null)
    throw new Error(said?.error ?? error.message)
  }
  return (data as { models?: string[] }).models ?? []
}

export async function setAiSettings(input: Partial<{
  turn_on: boolean
  how: 'always' | 'slow' | 'busy'
  minutes: number
  over: number
  warn: boolean
  suspend: boolean
  which_model: string
  which_vision_model: string
}>) {
  unwrap(await supabase.rpc('set_ai_settings', {
    turn_on: input.turn_on ?? null,
    how: input.how ?? null,
    minutes: input.minutes ?? null,
    over: input.over ?? null,
    warn: input.warn ?? null,
    suspend: input.suspend ?? null,
    which_model: input.which_model ?? null,
    which_vision_model: input.which_vision_model ?? null,
  }))
}

export async function aiRecent(howMany = 50): Promise<AiReview[]> {
  return (unwrap(await supabase.rpc('ai_recent', { how_many: howMany })) as AiReview[]) ?? []
}

/** How much is waiting for the machine right now. */
export async function aiWork(howMany = 20): Promise<{ subject: string; name: string; waiting_minutes: number }[]> {
  return (unwrap(await supabase.rpc('ai_work', { how_many: howMany })) as {
    subject: string; name: string; waiting_minutes: number
  }[]) ?? []
}

/**
 * Sets it going once, now.
 *
 * The worker is an edge function because it holds two keys no browser may
 * have: the service role, and the Groq one. This hands it the signed-in
 * session and the function checks for itself that the asker is Kobblon.
 */
export async function runModeration(): Promise<
  { looked: number; decided: number; unsure: number; trouble?: string[] }
> {
  const { data, error } = await supabase.functions.invoke('moderate', { body: {} })
  if (error) {
    /*
     * The function says *why* in its body - "no GROQ_API_KEY is set" is the
     * one somebody will actually hit - and supabase-js hides that behind a
     * flat "non-2xx". Reading it back is the difference between a console
     * that says what to do and one that says it did not work.
     */
    const context = (error as { context?: Response }).context
    if (!context) throw new Error(await whyNoFunction('moderate', error.message))
    const said = await context.json?.().catch(() => null)
    throw new Error(said?.error ?? error.message)
  }
  return data as { looked: number; decided: number; unsure: number; trouble?: string[] }
}

// ------------------------------------------------------------ the console

/**
 * Somebody's comings and goings, and roughly where from.
 *
 * Staff only, decided in the database. The zone is **what the browser says**
 * - a setting on somebody's own machine - so a console shows it as a hint
 * and never as proof.
 */
export type AccountSession = {
  id: string
  started_at: string
  last_seen_at: string
  ended_at: string | null
  zone: string | null
  country: string | null
  agent: string | null
}

export async function sessionsOf(target: string, howMany = 30): Promise<AccountSession[]> {
  return (unwrap(await supabase.rpc('sessions_of', {
    target, how_many: howMany,
  })) as AccountSession[]) ?? []
}

/** Where people are, counted by zone rather than listed by person. */
export async function wherePeopleAre(sinceDays = 30): Promise<
  { zone: string; country: string | null; how_many: number }[]
> {
  return (unwrap(await supabase.rpc('where_people_are', {
    since_days: sinceDays,
  })) as { zone: string; country: string | null; how_many: number }[]) ?? []
}

/** Saying somebody is here, and keeping it warm. Quiet about failing. */
export async function touchSession(zone: string | null, agent: string | null) {
  await supabase.rpc('touch_session', { zone_name: zone, agent_text: agent })
}

export async function setSessionCountry(country: string) {
  await supabase.rpc('set_session_country', { where_from: country })
}

export async function endSession() {
  await supabase.rpc('end_session')
}

export type ReportRow = {
  id: number
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter_id: string
  reporter_username: string | null
  about_name: string | null
  about_username: string | null
  about_id: string | null
  /* Added in 0176. The console built before it does not read these. */
  outcome?: string | null
  handled_at?: string | null
  subject_label?: string | null
  subject_link?: string | null
  subject_gone?: boolean
  others_open?: number
}

export async function reportQueue(which = 'open', howMany = 100): Promise<ReportRow[]> {
  return (unwrap(await supabase.rpc('report_queue', {
    which, how_many: howMany,
  })) as ReportRow[]) ?? []
}

export async function settleReport(id: number, how: 'actioned' | 'dismissed' | 'open') {
  unwrap(await supabase.rpc('settle_report', { target: id, how }))
}

/**
 * What a staff account is allowed to be shown.
 *
 * Read from the database rather than from a column on a profile, because
 * since 0172 three ranks imply each other and the precedence is decided in
 * one place. Nothing here is a permission: every power is checked again
 * server-side, and this only decides what is worth rendering.
 */
export type StaffRank = 'superadmin' | 'admin' | 'moderator' | 'none'

export async function myStaffRank(): Promise<StaffRank> {
  return (unwrap(await supabase.rpc('my_staff_rank')) as StaffRank) ?? 'none'
}

/** One report, with enough about the person to decide without a second page. */
export type ReportTicket = {
  id: number
  target_type: string
  target_id: string
  reason: string
  details: string | null
  status: string
  outcome: string | null
  handled_note: string | null
  created_at: string
  handled_at: string | null
  handled_by_username: string | null
  reporter_id: string
  reporter_username: string | null
  about_id: string | null
  about_username: string | null
  about_suspended: boolean
  about_suspended_until: string | null
  about_muted_until: string | null
  subject_label: string | null
  subject_link: string | null
  subject_gone: boolean
  past_warnings: number
  past_heavy: number
  past_mutes: number
  other_open: number
}

export async function reportTicket(id: number): Promise<ReportTicket | null> {
  const rows = unwrap(await supabase.rpc('report_ticket', { ticket: id })) as ReportTicket[]
  return rows?.[0] ?? null
}

/**
 * What a report takes: nothing, the content down, a warning, chat suspended,
 * the account suspended, or the account deleted.
 *
 * `termination` is a superadmin's and the machine is refused it by name, both
 * in the database. This passing it does not make it allowed.
 */
export type ReportAction =
  | 'nothing' | 'content_removed' | 'warning'
  | 'chat_suspension'
  /** Chat and voice together: voice is never taken on its own. */
  | 'voice_suspension'
  | 'suspension' | 'termination'

export type TakenReport = {
  action: ReportAction
  report: number
  violation?: number | null
  until?: string | null
  about?: string | null
}

export async function takeReport(input: {
  id: number
  action: ReportAction
  why: string
  rule?: string
  days?: number | null
  note?: string | null
}): Promise<TakenReport> {
  return unwrap(await supabase.rpc('take_report', {
    ticket: input.id,
    action: input.action,
    why: input.why,
    rule: input.rule ?? 'other',
    days: input.days ?? null,
    note: input.note ?? null,
  })) as TakenReport
}

/**
 * Whether the machine has anything to do.
 *
 * One count, so a schedule can ask every minute without reading a queue it
 * throws away. `is_on` and `total` are separate answers on purpose: a quiet
 * platform and a disabled machine look identical if you only ask one.
 */
export type WorkWaiting = {
  is_on: boolean
  mode: string | null
  items: number
  assets: number
  reports: number
  tickets: number
  appeals: number
  /** Chat, Space chat and Community posts waiting to be read. */
  lines: number
  /** Handles, display names and bios waiting to be read. */
  names: number
  total: number
  oldest_minutes: number | null
}

/**
 * The marks beside a name, resolved by the database rather than by a window.
 *
 * `ChatMark` in `@/engine` is the same two words in the same order, and the
 * order is decided server-side so two windows cannot draw them in two.
 *
 * Whoever hands a chat line over fills `marks` from this. A window reading a
 * profile per speaker and deciding for itself is how the tick ends up
 * disagreeing with the database the week a flag changes meaning - which is
 * exactly what happened to `is_admin`.
 */
export async function nameMarks(who: string): Promise<string[]> {
  return (unwrap(await supabase.rpc('name_marks', { who })) as string[]) ?? []
}

/**
 * The same for everybody in a room, in one go.
 *
 * Only the people who wear something come back: a speaker missing from the
 * map wears nothing, which is the common case and not worth a row.
 */
export async function nameMarksFor(who: string[]): Promise<Map<string, string[]>> {
  if (!who.length) return new Map()
  const rows = unwrap(await supabase.rpc('name_marks_for', { who })) as
    { id: string; marks: string[] }[]
  return new Map((rows ?? []).map((row) => [row.id, row.marks ?? []]))
}

/**
 * The same again, for the lists that carry a username and no id.
 *
 * Most of the Catalog is one of those: `browse_market` and its four
 * neighbours select `creator_username` and never `creator_id`, so the only
 * way to ask about those names without rewriting five large functions is
 * to ask by the name itself. It is the same `name_marks` underneath.
 */
export async function nameMarksByName(names: string[]): Promise<Map<string, string[]>> {
  if (!names.length) return new Map()
  const rows = unwrap(await supabase.rpc('name_marks_by_name', { names })) as
    { username: string; marks: string[] }[]
  return new Map((rows ?? []).map((row) => [row.username, row.marks ?? []]))
}

export async function aiWorkWaiting(): Promise<WorkWaiting | null> {
  const rows = unwrap(await supabase.rpc('ai_work_waiting')) as WorkWaiting[]
  return rows?.[0] ?? null
}

/**
 * The notice across the top of the site.
 *
 * Text and an address, never markup: a notice is written by the house today
 * and a line of text that is rendered as HTML is a line of text that can do
 * anything tomorrow.
 */
export type SiteNotice = {
  id: string
  body: string
  link: string | null
  link_words: string | null
  tone: NoticeColour
  ends_at: string | null
}

/**
 * The five a notice can be. Whoever writes it picks one, so these are
 * colours and not moods: `warn` was the site deciding what amber meant.
 */
export type NoticeColour = 'green' | 'blue' | 'red' | 'orange' | 'white'

/**
 * The house account, so a word from Kobblon wears Kobblon's face.
 *
 * Asked once and kept: every notification in a list would otherwise ask
 * again, and the answer is the same for everybody.
 */
let houseKnown: Promise<{
  id: string; username: string; display_name: string
  avatar_url: string | null; avatar_changed_at: string | null
} | null> | null = null

export function houseAccount() {
  if (!houseKnown) {
    houseKnown = (async () => {
      try {
        const answer = await supabase.rpc('house_account')
        const rows = answer.data as {
          id: string; username: string; display_name: string
          avatar_url: string | null; avatar_changed_at: string | null
        }[] | null
        return rows?.[0] ?? null
      } catch {
        // A notification with no picture is a notification; a panel that
        // throws because of one is not.
        return null
      }
    })()
  }
  return houseKnown
}

/** Whatever is up, newest first. Two at the most; the database says so. */
export async function noticesNow(): Promise<SiteNotice[]> {
  return (unwrap(await supabase.rpc('notice_now')) as SiteNotice[]) ?? []
}

export async function putUpNotice(input: {
  words: string
  link?: string | null
  linkWords?: string | null
  tone?: NoticeColour
  until?: string | null
}): Promise<string> {
  return unwrap(await supabase.rpc('put_up_notice', {
    words: input.words,
    where_to: input.link ?? null,
    link_label: input.linkWords ?? null,
    mood: input.tone ?? 'blue',
    until: input.until ?? null,
  })) as string
}

/** One of them by id, or every one that is up when nothing is named. */
export async function takeDownNotice(which?: string) {
  unwrap(await supabase.rpc('take_down_notice', { which: which ?? null }))
}

// ---------------------------------------------------------------- reselling

/**
 * What a limited is going for: the cheapest standing offer, the average of
 * the last ten sales, how many have changed hands, how many are offered.
 *
 * The average is of sales rather than listings - listings are what people
 * hope for, sales are what people paid.
 */
export type ResalePrices = {
  cheapest: number | null
  average: number | null
  sold: number
  offers: number
}

export type ResaleOffer = {
  id: string
  price: number
  listed_at: string
  seller_id: string
  seller_username: string
  seller_display_name: string
  mine: boolean
}

export async function resalePrices(item: string): Promise<ResalePrices> {
  const rows = unwrap(await supabase.rpc('resale_prices', { target: item })) as ResalePrices[]
  return rows?.[0] ?? { cheapest: null, average: null, sold: 0, offers: 0 }
}

export async function resaleOffers(item: string, howMany = 20): Promise<ResaleOffer[]> {
  return (unwrap(await supabase.rpc('resale_offers', {
    target: item, how_many: howMany,
  })) as ResaleOffer[]) ?? []
}

/** Offering one of yours. It stays yours until somebody buys it. */
export async function listResale(item: string, asking: number): Promise<string> {
  return unwrap(await supabase.rpc('list_resale', { target: item, asking })) as string
}

export async function cancelResale(offer: string) {
  unwrap(await supabase.rpc('cancel_resale', { offer }))
}

/** Buying one from somebody. The copy moves; Kobblon takes its usual cut. */
export async function buyResale(offer: string) {
  unwrap(await supabase.rpc('buy_resale', { offer }))
}

// ----------------------------------------------------------------- outfits

/** A saved look: what somebody had on, kept under a name. */
export type Outfit = {
  id: string
  content_id: number
  name: string
  folder_id: string | null
  folder_name: string | null
  body: Record<string, string> | null
  is_public: boolean
  price: number
  maker_share: number
  created_at: string
  pieces: { slot: string; kind: string; name: string; content_id: number }[]
  /*
   * Where it came from, when it was bought rather than put together. Null
   * on your own: that is the whole difference between the two shelves.
   */
  bought_from: string | null
  bought_at: string | null
  maker_username: string | null
  maker_display_name: string | null
}

export type OutfitFolder = { id: string; name: string; created_at: string; how_many: number }

export async function myOutfits(): Promise<Outfit[]> {
  return (unwrap(await supabase.rpc('my_outfits')) as Outfit[]) ?? []
}

export async function myOutfitFolders(): Promise<OutfitFolder[]> {
  return (unwrap(await supabase.rpc('my_outfit_folders')) as OutfitFolder[]) ?? []
}

/**
 * Keeps what somebody is wearing, under a name.
 *
 * The server reads what they have on rather than taking a list from here -
 * an outfit assembled by a page is an outfit that can disagree with the
 * body it was saved from.
 */
export async function saveOutfit(
  name: string, folder?: string | null, over?: string | null,
): Promise<string> {
  return unwrap(await supabase.rpc('save_outfit', {
    outfit_name: name, into_folder: folder ?? null, over_outfit: over ?? null,
  })) as string
}

/** Puts one on. Returns how many pieces went on. */
export async function wearOutfit(id: string): Promise<number> {
  return unwrap(await supabase.rpc('wear_outfit', { target: id })) as number
}

/** Buys every piece of one that the buyer does not already own. */
export async function buyOutfit(id: string): Promise<number> {
  return unwrap(await supabase.rpc('buy_outfit', { target: id })) as number
}

/** Outfits anybody can buy. */
export async function outfitShelf(term?: string, howMany = 40) {
  return (unwrap(await supabase.rpc('outfit_shelf', {
    term: term || null, how_many: howMany,
  })) as (Outfit & {
    owner_username: string
    owner_display_name: string
    owner_is_verified: boolean
    owner_is_staff: boolean
    costs: number
    owned_already: number
  })[]) ?? []
}

/**
 * A folder, renaming one, putting an outfit up for sale, and throwing one
 * away - all of them the owner writing their own rows, which their policy
 * already allows.
 *
 * Written here rather than in the page so the table names live in one file:
 * a page that knows a column name is a page that has to be found again when
 * the column moves.
 */
export async function makeOutfitFolder(name: string): Promise<string> {
  const me = (await supabase.auth.getUser()).data.user?.id
  if (!me) throw new Error('Sign in first.')
  const row = unwrap(await supabase.from('outfit_folders')
    .insert({ owner_id: me, name }).select('id').single()) as { id: string }
  return row.id
}

export async function listOutfit(id: string, listed: boolean, price?: number) {
  unwrap(await supabase.from('outfits')
    .update({
      is_public: listed,
      ...(price === undefined ? {} : { price: Math.max(0, Math.round(price)) }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id).select('id').single())
}

/** Throwing one away. The things in it stay yours; only the look goes. */
export async function removeOutfit(id: string) {
  unwrap(await supabase.from('outfits')
    .update({ is_removed: true, is_public: false, updated_at: new Date().toISOString() })
    .eq('id', id).select('id').single())
}

/**
 * One outfit, on its own page: what it is, who made it, and every piece.
 *
 * Taken by the number in the address rather than by uuid, which is what the
 * rest of the Catalog's pages do. Null when there is no such outfit, or it
 * has been taken down, or it is somebody's private one.
 */
export async function outfitPage(tag: number): Promise<OutfitPage | null> {
  const rows = unwrap(await supabase.rpc('outfit_page', { tag })) as OutfitPage[] | null
  return rows?.[0] ?? null
}

export type OutfitPage = {
  id: string
  content_id: number
  name: string
  price: number
  /** What it costs this person: the pieces they do not already own. */
  costs: number
  owned_already: number
  how_many: number
  maker_share: number
  created_at: string
  owner_id: string
  owner_username: string
  owner_display_name: string
  owner_avatar_url: string | null
  owner_is_verified: boolean
  owner_is_staff: boolean
  /** Yours, so the page offers Wear rather than Buy. */
  mine: boolean
  pieces: {
    item_id: string
    content_id: number
    kind: string
    slot: string
    name: string
    price: number
    image_path: string | null
    image_bucket: string | null
    preview_path: string | null
    owned: boolean
  }[]
}

/**
 * Whether somebody is in the Klub, at a tier or better.
 *
 * Asked of the server rather than read off a profile row, because the row
 * says what was bought and this says whether it is still running - and a
 * membership that has lapsed has to stop working the day it lapses, not
 * the next time somebody signs in.
 */
export async function inTheKlub(
  target?: string, atLeast: 'lite' | 'klub' | 'life' = 'lite',
): Promise<boolean> {
  return unwrap(await supabase.rpc('in_the_klub', {
    target: target ?? null, at_least: atLeast,
  })) as boolean
}

/**
 * The eleven faces, in the order they are offered.
 *
 * `fire` is not a face and sits with them anyway, which is how everybody
 * else's set works too: it is the one thing in a row of expressions that is
 * about the post rather than about how reading it felt. It goes after the
 * happy ones and before the unhappy ones, which is where the eye expects
 * the loud one.
 */
/*
 * The order they are offered in, which is the order they are drawn in.
 *
 * Ten faces and then the flame. It sat seventh, in the middle of the row,
 * and it is the one thing in the set that is not a face - so the row read
 * as two halves with a gap in it rather than as a set. Staw: "just reorder
 * them so the fire isnt in the middle". The faces run from the mildest to
 * the worst-tempered and the flame, which is not an expression at all,
 * goes on the end.
 */
export const FACES = [
  'smile', 'laugh', 'happy-grin', 'winky-grin', 'heart-eyes',
  'sunglasses', 'shocked', 'sad', 'angry', 'skull', 'fire',
] as const

export type Face = (typeof FACES)[number]

export type ReactionCount = { face: Face; how_many: number; mine: boolean }

/**
 * React, change your mind, or take it back.
 *
 * Passing the face you already have takes it off, which is what every
 * reaction control anybody has used does. Returns the face that is now on,
 * or null. Reacting to a World is a Klub thing and the server says so.
 */
export async function react(
  what: 'post' | 'world', which: string, face: Face | null,
): Promise<Face | null> {
  return unwrap(await supabase.rpc('react', { what, which, face })) as Face | null
}

/** What is on one thing: the faces used, how many times, and which is mine. */
export async function reactionsOn(
  what: 'post' | 'world', which: string,
): Promise<ReactionCount[]> {
  return (unwrap(await supabase.rpc('reactions_on', { what, which })) as ReactionCount[]) ?? []
}

/**
 * The same, for a page full of things at once.
 *
 * A wall of twenty posts asking one at a time is twenty round trips before
 * anybody can read the first one.
 */
export async function reactionsOnMany(
  what: 'post' | 'world', whichever: string[],
): Promise<Record<string, ReactionCount[]>> {
  if (!whichever.length) return {}
  const rows = (unwrap(await supabase.rpc('reactions_on_many', {
    what, whichever,
  })) as (ReactionCount & { target_id: string })[]) ?? []

  const by: Record<string, ReactionCount[]> = {}
  for (const row of rows) {
    (by[row.target_id] ??= []).push({ face: row.face, how_many: row.how_many, mine: row.mine })
  }
  return by
}

/**
 * A moderator taking an outfit down.
 *
 * Not the owner's `removeOutfit`, deliberately: an owner deleting their own
 * look and a moderator taking one down are two different events, and only
 * one of them has a reason, a log entry and a word to the person.
 */
export async function takeDownOutfit(id: string, note?: string): Promise<boolean> {
  return unwrap(await supabase.rpc('take_down_outfit', {
    target: id, note: note ?? null,
  })) as boolean
}

/** A new name on a saved look, and nothing else about it moves. */
export async function renameOutfit(id: string, name: string) {
  unwrap(await supabase.rpc('rename_outfit', { outfit: id, new_name: name }))
}

/**
 * This outfit, but what I have on now.
 *
 * Keeps the name, the folder, the price and the Catalog listing - the whole
 * point of pressing Update rather than saving a new one. Returns how many
 * pieces it ended up with. The server reads what is worn rather than taking
 * a list from here, so an outfit cannot be saved as something the body is
 * not actually wearing.
 */
export async function restyleOutfit(id: string): Promise<number> {
  return unwrap(await supabase.rpc('restyle_outfit', { outfit: id })) as number
}

/**
 * Changing something you made, for a fee.
 *
 * Staw: "we also should let people update the mesh & texture & name &
 * description & position & price of their accessories for 60 brix". Every
 * field is optional and left out means "leave it" - a dialog that sends
 * every field back sends the value it happened to be holding, which is the
 * one from before somebody else's change.
 *
 * Comes back `nothing` when nothing moved (and nothing is charged),
 * `changed`, or `pending` when a new mesh or picture sent it back to be
 * looked at again.
 */
export async function updateAvatarItem(item: string, change: {
  name?: string
  description?: string
  meshId?: string | null
  textureId?: string | null
  fit?: WornFit | null
  price?: number
}): Promise<'nothing' | 'changed' | 'pending'> {
  return unwrap(await supabase.rpc('update_avatar_item', {
    item,
    new_name: change.name ?? null,
    new_description: change.description ?? null,
    new_mesh: change.meshId ?? null,
    new_texture: change.textureId ?? null,
    new_fit: change.fit ?? null,
    new_price: change.price ?? null,
  })) as 'nothing' | 'changed' | 'pending'
}

/** What a change to a published item costs. Read, never assumed. */
export async function itemEditPrice(): Promise<number> {
  return (unwrap(await supabase.rpc('item_edit_price')) as number) ?? 60
}

/** What each kind of avatar item costs to make, and who may make one. */
export async function avatarRules(): Promise<AvatarRule[]> {
  return (unwrap(await supabase.rpc('avatar_rules')) as AvatarRule[]) ?? []
}

/**
 * Everything needed to draw one person: their colours and what they have on.
 *
 * Comes back as a row per worn thing. Somebody wearing nothing is a single
 * row with a null slot rather than no rows, so "has no avatar" and "does not
 * exist" stay different answers - a suspended person returns nothing at all.
 */
/**
 * What somebody is wearing, as rows.
 *
 * Called `avatarOf` until the Workspace read round 47, went looking for it
 * and found `avatarOf` in `@/lib/avatars` instead - which returns a profile
 * picture. Two exported functions with one name and two meanings, and the
 * round pointed at the wrong one. Renamed rather than explained.
 *
 * For drawing a figure, use `lookOf` below; this is the rows it is built
 * from.
 */
export async function wornBy(userId: string): Promise<AvatarPiece[]> {
  return (unwrap(await supabase.rpc('avatar_of', { target: userId })) as AvatarPiece[]) ?? []
}

/** What somebody has, to choose from when dressing. */
export async function myAvatarItems(): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('my_avatar_items')) as AvatarItem[]) ?? []
}

/** What somebody has made, for their own Create page. */
export async function myMadeAvatarItems(forCommunity?: string | null): Promise<AvatarItem[]> {
  // Null is you personally, and that means your own things only - a
  // Community's live on its own list, under its own Working as.
  const rows = unwrap(await supabase.rpc('my_made_avatar_items', {
    for_community: forCommunity ?? null,
  })) as AvatarItem[] | null
  return rows ?? []
}

/**
 * Hands a thing to wear over to a Community, or takes it back.
 *
 * For everything made for a Community before there was a column saying so:
 * it reads as its maker's own work, on their shop and with their name in the
 * byline, and nothing but its maker knows otherwise.
 */
export async function moveAvatarItemMaker(itemId: string, toCommunity: string | null) {
  unwrap(await supabase.rpc('move_avatar_item_maker', {
    item_id: itemId, to_community: toCommunity,
  }))
}

/** How the Catalog may be ordered. There is no "best rated": nothing rates these yet. */
export type ShelfOrder = 'newest' | 'oldest' | 'cheapest' | 'dearest' | 'taken'

/** The Catalog. `kind` of null is everything. */
/** The narrowing somebody asked for beyond a name and a kind. */
export type ShelfFilters = {
  /** In Brix. Null either side means no bound on that side. */
  least?: number | null
  most?: number | null
  onlyLimited?: boolean
  onlyFree?: boolean
}

/**
 * What to put in front of somebody, scored by the server.
 *
 * One reader for both places it is shown - the shelf under the avatar and
 * the Catalog's own row - because two ideas of what somebody wants is how a
 * shop recommends a hat on one page and the same person a skirt on the
 * next. The ranking is in `recommended_avatar_items`, where it can be read
 * and argued with.
 *
 * Comes back in `avatar_shelf`'s own columns, so every card that draws a
 * Catalog item draws these with no new code.
 */
export async function recommendedAvatarItems(howMany = 12): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('recommended_avatar_items', {
    how_many: howMany,
  })) as AvatarItem[]) ?? []
}

export async function avatarShelf(
  kind?: AvatarKind | null,
  term?: string,
  howMany = 60,
  madeBy?: string | null,
  order: ShelfOrder = 'newest',
  filters: ShelfFilters = {},
): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('avatar_shelf', {
    of_kind: kind ?? null,
    term: term ?? null,
    how_many: howMany,
    least_price: filters.least ?? null,
    most_price: filters.most ?? null,
    only_limited: filters.onlyLimited ?? false,
    only_free: filters.onlyFree ?? false,
    made_by: madeBy ?? null,
    sort_by: order,
  })) as AvatarItem[]) ?? []
}

/**
 * A shop: what one person sells, or what a Community sells.
 *
 * Only what is on sale - approved, listed, still up. What somebody is still
 * making lives in the Create tab, which is where it can say what it is
 * waiting for; a shop that showed it would be showing strangers something
 * nobody can buy.
 */
export async function shopShelf(
  owner: { user: string } | { community: string },
  howMany = 60,
): Promise<AvatarItem[]> {
  return (unwrap(await supabase.rpc('shop_shelf', {
    owner_user: 'user' in owner ? owner.user : null,
    owner_community: 'community' in owner ? owner.community : null,
    how_many: howMany,
  })) as AvatarItem[]) ?? []
}

/** How many things are on that shelf, for a tab that counts before it opens. */
export async function shopSize(
  owner: { user: string } | { community: string },
): Promise<number> {
  return (unwrap(await supabase.rpc('shop_size', {
    owner_user: 'user' in owner ? owner.user : null,
    owner_community: 'community' in owner ? owner.community : null,
  })) as number) ?? 0
}

/**
 * Changing what you wrote about something you made, and what it costs.
 *
 * Not what it is: the kind, the slot and the picture are fixed once anybody
 * can buy it, or somebody could sell one thing and deliver another.
 */
export async function editAvatarItem(
  id: string, name: string, description: string, price: number,
) {
  unwrap(await supabase.rpc('edit_avatar_item', {
    target: id, new_name: name, about: description, cost: price,
  }))
}

/** Off the shelf, still on everybody wearing it. Reversible. */
export async function archiveAvatarItem(id: string, archived: boolean) {
  unwrap(await supabase.rpc('archive_avatar_item', { target: id, archived }))
}

/**
 * Gone. The server refuses while anybody else owns one, and says so - that
 * is a rule about other people's things, not a warning this page invents.
 */
export async function deleteAvatarItem(id: string) {
  unwrap(await supabase.rpc('delete_avatar_item', { target: id }))
}

export async function buyAvatarItem(id: string) {
  unwrap(await supabase.rpc('buy_avatar_item', { target: id }))
}

/**
 * Buys a basket. Every item or none - the server does that, not this.
 *
 * Returns how many were bought. A refusal names the item that stopped it and
 * nothing has been charged, which is the only honest way to fail halfway
 * through a list somebody is paying for.
 */
export async function buyAvatarItems(ids: string[]): Promise<number> {
  return unwrap(await supabase.rpc('buy_avatar_items', { targets: ids })) as number
}

export async function wearAvatarItem(id: string) {
  unwrap(await supabase.rpc('wear_avatar_item', { target: id }))
}

export async function takeOffSlot(slot: AvatarSlot) {
  unwrap(await supabase.rpc('take_off_slot', { which: slot }))
}

/**
 * Takes off one particular thing.
 *
 * The door to use now that a socket may hold several: with two hats on,
 * "take off the hat slot" names both of them, and a cross beside one row
 * means that row. `takeOffSlot` is still right for emptying a whole slot on
 * purpose, and keeps every rule - the guest lock, the face floor - because
 * it goes through this one per row.
 */
export async function takeOffItem(id: string) {
  unwrap(await supabase.rpc('take_off_item', { target: id }))
}

/** Null puts every part back to the colour the engine starts with. */
export async function setBodyColours(colours: Record<string, string> | null) {
  unwrap(await supabase.rpc('set_body_colours', { colours }))
}

/**
 * Lists it, or takes it down, and says what it costs while listing.
 *
 * The price belongs here rather than to making one: Staw's rule is that you
 * do not need a price to upload something, only to put it on sale. Leaving
 * `price` out keeps whatever it already had, which is what taking something
 * down and putting it back should do.
 */
export async function listAvatarItem(id: string, listed: boolean, price?: number) {
  unwrap(await supabase.rpc('list_avatar_item', {
    target: id, listed, cost: typeof price === 'number' ? price : null,
  }))
}

/**
 * Sets, or clears, the moment a limited stops selling.
 *
 * Kobblon's only - the server decides that, not this call. `until` is an ISO
 * moment in the future, or null to make it an ordinary item again.
 */
export async function setLimited(id: string, until: string | null) {
  unwrap(await supabase.rpc('set_limited', { target: id, until }))
}

/**
 * Makes an avatar item. The server charges for it and decides whether this
 * person may make one at all, so this passes the answer along rather than
 * checking anything first.
 */
/** Hangs a drawn card on something you made. */
export async function setAvatarPreview(id: string, path: string | null) {
  unwrap(await supabase.rpc('set_avatar_preview', { target: id, picture: path }))
}

/**
 * Draws the card for something just made, and keeps it.
 *
 * After the thing exists rather than before: the card is a picture of the
 * item, and an item that failed to be made should not leave a picture of
 * itself in a bucket. Best effort - a card that did not draw leaves the
 * item showing its own picture, which is right for a face and merely plain
 * for a shirt.
 */
export async function drawAvatarCard(
  id: string, userId: string,
  item: {
    kind: string; slot: string
    imageUrl?: string | null
    meshUrl?: string | null
    /** The real one, from the row's `file_path`: a signed address hides it. */
    meshFormat?: string | null
    textureUrl?: string | null
    /** Which shape in the engine, for a body part. */
    shape?: string | null
  },
): Promise<string | null> {
  /*
   * The mannequin's face goes in here rather than being fetched by the
   * drawing, which must not talk to the database - and it is awaited before
   * the draw rather than during it, so a card is never drawn headless
   * because a request was still in flight.
   */
  const drawn = await drawItemCard({
    ...item,
    faceUrl: await mannequinFace().catch(() => null),
  }).catch(() => null)
  if (!drawn) return null

  const path = `${userId}/card-${crypto.randomUUID()}.webp`
  const put = await supabase.storage.from(catalogBucket)
    .upload(path, drawn, { contentType: 'image/webp', upsert: false })
  if (put.error) return null

  try {
    await setAvatarPreview(id, path)
  } catch {
    await supabase.storage.from(catalogBucket).remove([path])
    return null
  }
  return path
}

export async function createAvatarItem(input: {
  kind: AvatarKind
  slot: AvatarSlot
  name: string
  description?: string
  /** Left out until it is listed: making one needs no price. */
  price?: number | null
  imagePath?: string | null
  meshId?: string | null
  textureId?: string | null
  /** The Community it belongs to, if it is not yours. */
  communityId?: string | null
  /**
   * Which shape in the engine, for a body part. There is no file to send:
   * the engine builds the geometry, and the row names which one.
   */
  shape?: string | null
}): Promise<string> {
  return unwrap(await supabase.rpc('create_avatar_item', {
    item_kind: input.kind,
    item_slot: input.slot,
    item_name: input.name,
    about: input.description ?? '',
    cost: typeof input.price === 'number' ? input.price : null,
    picture: input.imagePath ?? null,
    model: input.meshId ?? null,
    texture: input.textureId ?? null,
    maker: input.communityId ?? null,
    form: input.shape ?? null,
  })) as string
}

/**
 * Puts a worn picture in the catalog bucket.
 *
 * Under the uploader's own folder, which is what the bucket's policy allows
 * and nothing else - the same arrangement as previews, so one person cannot
 * write over another's shirt by guessing a name.
 */
export async function uploadCatalogImage(userId: string, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const put = await supabase.storage.from(catalogBucket)
    .upload(path, file, { contentType: typeOf(file, 'image/png'), upsert: false })
  if (put.error) throw new Error(put.error.message)
  return path
}

/**
 * Takes somebody's profile picture from their avatar, and keeps it.
 *
 * Called after anything that changes how they look. Nothing waits on it and
 * nothing fails because of it: a portrait that did not draw leaves the one
 * they had, which is wrong for a moment rather than broken.
 *
 * WebP with alpha, like every other picture Kobblon draws, so a head sits on
 * whatever colour the page behind it is.
 */
/**
 * What somebody is wearing, as a look anything can draw.
 *
 * One assembly, and that is the point of it existing. The avatar page built
 * this for the stage and `refreshPortrait` built it again for the picture,
 * and the second copy quietly left out the mesh format and the placement -
 * so a profile picture was drawn with the accessory missing or sitting
 * somewhere else, which is Staw's "the picture is made from zero, not from
 * the avatar". Two assemblies of the same thing is two answers to one
 * question, and the one nobody is looking at is the wrong one.
 *
 * Signing is a request per model, so this is awaited once and handed round
 * rather than done again per renderer.
 */
export async function lookOf(userId: string): Promise<PortraitLook> {
  return buildLook(await wornBy(userId).catch(() => []))
}

/**
 * What a saved outfit looks like, drawn the same way a person is.
 *
 * `outfit_look` answers in `avatar_of`'s own columns, so this is `lookOf`
 * with a different list of rows and not a second idea of what an avatar is.
 * Staw: "for outfits, i want to see each outfit in 3d" - and an outfit drawn
 * by its own code is an outfit that looks subtly unlike the body it goes on.
 */
export async function lookOfOutfit(outfitId: string): Promise<PortraitLook> {
  const rows = (unwrap(await supabase.rpc('outfit_look', { outfit: outfitId })) as AvatarPiece[]) ?? []
  return buildLook(rows)
}

/** The rows, resolved into addresses something can actually draw. */
async function buildLook(worn: AvatarPiece[]): Promise<PortraitLook> {
  const pieces = await Promise.all(
    worn.filter((piece) => piece.slot).map(async (piece) => ({
      slot: piece.slot!,
      /*
       * Where it hangs, answered here rather than by each renderer. The
       * wardrobe speaks in slots and the rig in sockets, and a client left
       * to map between them is a second opinion about what a hat does.
       * Null means a slot that hangs from nothing - clothing, which is
       * painted onto the body rather than attached to it.
       */
      point: socketFor(piece.slot!),
      itemId: piece.item_id,
      kind: piece.kind ?? '',
      name: piece.item_name,
      contentId: piece.content_id,
      cardUrl: cardFor(piece),
      price: piece.price ?? null,
      imageUrl: catalogUrl(piece.image_path, piece.image_bucket ?? undefined),
      meshUrl: piece.mesh_path ? await assetUrl(piece.mesh_path).catch(() => null) : null,
      meshFormat: piece.mesh_format ?? (piece.mesh_path ? formatOf(piece.mesh_path) : null),
      textureUrl: piece.texture_path ? await assetUrl(piece.texture_path).catch(() => null) : null,
      fit: piece.fit ?? null,
      /** Which shape in the engine, for a body part. */
      shape: piece.shape ?? null,
      /** When it stopped selling, so a profile can say it was a limited. */
      sellsUntil: piece.sells_until ?? null,
    })),
  )

  return { body: worn[0]?.body ?? null, pieces }
}

/**
 * Draws somebody's profile picture from the avatar they are actually
 * wearing, and keeps it.
 *
 * It takes a person rather than a look on purpose: a caller that assembles
 * its own is a caller that can assemble it differently, which is exactly
 * what went wrong. The only way to get a portrait is from the database.
 */
export async function refreshPortrait(userId: string): Promise<string | null> {
  const drawn = await drawPortrait(await lookOf(userId)).catch(() => null)
  if (!drawn) return null

  /*
   * A new name each time rather than writing over the old one. A picture
   * served from a public bucket is cached by every browser and every chat
   * that has ever shown it, and overwriting the file leaves all of them
   * showing the old face for as long as their cache holds.
   */
  const path = `${userId}/portrait-${Date.now()}.webp`
  const put = await supabase.storage.from('avatars')
    .upload(path, drawn, { contentType: 'image/webp', upsert: false })
  if (put.error) return null

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const saved = await supabase.from('profiles')
    .update({ avatar_url: url }).eq('id', userId).select('id').single()
  if (saved.error) {
    await supabase.storage.from('avatars').remove([path])
    return null
  }
  return url
}

/* ---------------------------------------------------------- appearances */

/**
 * The appearances this person may wear.
 *
 * `default` is in the answer for everybody and has no date on it. The rest
 * are what they claimed, with the day they claimed it, which is the thing
 * that makes a seasonal one worth having: it says they were here that year.
 */
export async function myAppearances() {
  const rows = unwrap(await supabase.rpc('my_appearances'))
  return (rows ?? []) as { appearance: string; claimed_at: string | null }[]
}

/**
 * What is being given away today, or nothing.
 *
 * Asked of the database rather than worked out from the clock on this
 * machine: a date here is a guess about a rule, and the rule lives where
 * the claim is checked. A browser set to December does not get christmas.
 */
export async function appearanceOnOffer() {
  const which = unwrap(await supabase.rpc('appearance_on_offer'))
  return (which ?? null) as string | null
}

/** Take the one on offer. It is applied straight away, which Staw asked for. */
export async function claimAppearance(which: string) {
  unwrap(await supabase.rpc('claim_appearance', { which }))
}

/** Wear one that has already been claimed. */
export async function wearAppearance(which: string) {
  unwrap(await supabase.rpc('set_appearance', { which }))
}

// ------------------------------------------------------------------ quests

/*
 * The quest tab.
 *
 * Everything here is one RPC each, because every one of these is a thing
 * the database has to decide rather than a row the browser may read: how
 * far somebody has got, whether today's claim is still there, whether a
 * reward has been taken. A page that worked any of that out from rows it
 * selected would be a page that could be told a different answer.
 */
export async function questBoard(): Promise<Quest[]> {
  return (unwrap(await supabase.rpc('quest_board')) as Quest[]) ?? []
}

/** Says you are doing it, which is also where the counting starts from. */
export async function startQuest(id: string) {
  unwrap(await supabase.rpc('start_quest', { quest: id }))
}

/** Takes the reward. Returns the balance it left behind. */
export async function claimQuest(id: string): Promise<number> {
  return unwrap(await supabase.rpc('claim_quest', { quest: id })) as number
}

/**
 * One board of accounts, either side of the switch.
 *
 * Fifty rows and one total each: the ledger behind the Brix boards stays
 * private to the person it belongs to, and nothing here says what anybody
 * bought or when.
 *
 * A side with no honest answer comes back empty rather than wrong - a
 * Community cannot own a World, so there is no Communities side to either
 * World board, and `worth` on that side would be a second copy of `brix`.
 */
export async function leaderboard(board: OwnerBoard, side: BoardSide): Promise<BoardRow[]> {
  return (unwrap(await supabase.rpc('leaderboard', { board, side })) as BoardRow[]) ?? []
}

/** A board of Worlds: most liked, or most visited. */
export async function worldLeaderboard(board: WorldBoard): Promise<WorldBoardRow[]> {
  return (unwrap(await supabase.rpc('world_leaderboard', { board })) as WorldBoardRow[]) ?? []
}

/**
 * What one account has on every player board, and where that puts them.
 *
 * Takes a person, because the profile shows somebody else's: left empty it
 * reads whoever is asking, which is what the leaderboard page wants.
 */
export async function personPlaces(who?: string): Promise<PersonPlace[]> {
  return (unwrap(await supabase.rpc('person_places', who ? { who } : {})) as PersonPlace[]) ?? []
}

export async function dailyWaiting(): Promise<boolean> {
  return (unwrap(await supabase.rpc('daily_waiting')) as boolean) ?? false
}

export async function claimDaily(): Promise<number> {
  return unwrap(await supabase.rpc('claim_daily')) as number
}

/** A verified creator asking for their World to be one. */
export async function requestWorldQuest(input: {
  world: string
  minutes: number
  reward: number
  tag?: string | null
}): Promise<string> {
  return unwrap(await supabase.rpc('request_world_quest', {
    world: input.world,
    minutes: input.minutes,
    reward: input.reward,
    tag: input.tag?.trim() || null,
  })) as string
}

/**
 * Writing one outright, which is a superadmin's and nobody else's.
 *
 * No fee, no approval and no waiting: the board belongs to Kobblon, and the
 * request path above is for a creator asking for one about their own World.
 * Any kind, including time in a World, as long as the World is named.
 */
export async function addQuest(input: {
  title: string
  counted: QuestCounted
  goal: number
  reward: number
  lead?: string | null
  tag?: string | null
  background?: string | null
  until?: string | null
  world?: string | null
}): Promise<string> {
  return unwrap(await supabase.rpc('add_quest', {
    title: input.title.trim(),
    counted: input.counted,
    goal: input.goal,
    reward: input.reward,
    lead: input.lead?.trim() || null,
    tag: input.tag?.trim() || null,
    background: input.background?.trim() || null,
    until: input.until || null,
    world: input.world || null,
  })) as string
}

export async function myQuestRequests(): Promise<QuestRequest[]> {
  return (unwrap(await supabase.rpc('my_quest_requests')) as QuestRequest[]) ?? []
}

// ------------------------------------------------- communities, for staff

/*
 * The Communities panel.
 *
 * Every one of these is a rank the database decides, not this file: the
 * console hides what a rank cannot do so nobody presses a button to be
 * told no, and the function refuses it anyway so hiding it is a courtesy
 * rather than the security.
 */
export type CommunityTab = 'all' | 'flagged' | 'closed' | 'verified'

export async function staffCommunities(
  { look = null, which = 'all', howMany = 50 }:
  { look?: string | null; which?: CommunityTab; howMany?: number } = {},
): Promise<StaffCommunity[]> {
  return (unwrap(await supabase.rpc('staff_communities', {
    look, which, how_many: howMany,
  })) as StaffCommunity[]) ?? []
}

/** Moderator and up: opens a report, so it lands where reports are read. */
export async function flagCommunity(id: string, why: string): Promise<number> {
  return unwrap(await supabase.rpc('flag_community', { community: id, why })) as number
}

/** Admin and up. */
export async function verifyCommunity(id: string, yes: boolean, why?: string) {
  return unwrap(await supabase.rpc('verify_community', {
    community: id, yes, why: why?.trim() || null,
  })) as boolean
}

/** Admin and up. Returns when the real data goes, two months out. */
/*
 * `staff` on the front of both, because 0034 already has a
 * `close_community` that is the owner shutting their own Community, and it
 * holds nothing for two months. Different thing, different name.
 */
export async function staffCloseCommunity(id: string, why: string): Promise<string> {
  return unwrap(await supabase.rpc('staff_close_community', { community: id, why })) as string
}

export async function staffReopenCommunity(id: string, why?: string) {
  unwrap(await supabase.rpc('staff_reopen_community', {
    community: id, why: why?.trim() || null,
  }))
}

/** Superadmin. Named apart from the owner's own `transfer_community`. */
export async function staffTransferCommunity(id: string, toWhom: string, why?: string) {
  unwrap(await supabase.rpc('staff_transfer_community', {
    community: id, to_whom: toWhom, why: why?.trim() || null,
  }))
}

/** Superadmin, and only on one that has been closed. */
export async function eraseCommunity(id: string) {
  unwrap(await supabase.rpc('erase_community', { community: id }))
}

/* ------------------------------------------------------------- economy */

export type EconomyNow = {
  in_circulation: number
  holders: number
  richest: number
  average: number
  minted: number
  burned: number
  movements: number
  limiteds: number
  resold: number
}

export type EconomyDay = {
  day: string
  minted: number
  burned: number
  net: number
  held: number
}

export type EconomyKind = { kind: string; came: number; went: number; movements: number }

export type LimitedRow = {
  item_id: string
  content_id: number
  name: string
  price: number
  sells_until: string
  closed: boolean
  sold_total: number
  sold_window: number
  average_window: number
  average_before: number
  cheapest: number | null
  offers: number
}

/** What the currency looks like right now. Admin and up; the database says so. */
export async function economyNow(): Promise<EconomyNow> {
  const rows = unwrap(await supabase.rpc('economy_now')) as EconomyNow[]
  return rows?.[0] ?? {
    in_circulation: 0, holders: 0, richest: 0, average: 0,
    minted: 0, burned: 0, movements: 0, limiteds: 0, resold: 0,
  }
}

/** A day a row, oldest first, with days of no movement still in it. */
export async function economyFlow(days = 30): Promise<EconomyDay[]> {
  return (unwrap(await supabase.rpc('economy_flow', { days })) ?? []) as EconomyDay[]
}

/** Where it came from and where it went, by the ledger's own reason. */
export async function economyByKind(days = 30): Promise<EconomyKind[]> {
  return (unwrap(await supabase.rpc('economy_by_kind', { days })) ?? []) as EconomyKind[]
}

/** The limiteds and what they have been going for. */
export async function limitedMarket(days = 30): Promise<LimitedRow[]> {
  return (unwrap(await supabase.rpc('limited_market', { days })) ?? []) as LimitedRow[]
}

/*
 * The shutters.
 *
 * One row that says whether the website is drawing itself or showing the
 * maintenance notice, and it is readable signed out because the first thing
 * the site does is ask - before anybody has signed in.
 *
 * It is a curtain and not a lock: the API carries on while it is down, and
 * anything that must actually be closed is closed in the database. Said
 * again here because this is the function somebody will reach for when they
 * mean the other thing.
 */
export type SiteState = {
  maintenance: boolean
  note: string | null
  set_at: string
  set_by: string | null
}

export async function siteState(): Promise<SiteState | null> {
  const { data, error } = await supabase
    .from('site_state')
    .select('maintenance, note, set_at, set_by')
    .maybeSingle()
  /*
   * A failure is not a shut site. The row is read on every load by
   * everybody, so a hiccup that answered "maintenance" would take the
   * website down for the length of the hiccup - the one direction this must
   * never fail in.
   */
  if (error) return null
  return (data as SiteState) ?? null
}

/** Throw the switch. Admins and superadmins only; the database decides. */
export async function setMaintenance(shut: boolean, words?: string): Promise<SiteState> {
  return unwrap(await supabase.rpc('set_maintenance', {
    shut,
    words: words?.trim() ? words.trim() : null,
  })) as SiteState
}

/* ---------------------------------------------------------------- forum */

/**
 * Attachments live in their own public bucket.
 *
 * Public because a thread whose screenshot nobody can see is a thread with
 * no screenshot, and a signed link that expires is a thread that rots a
 * month after it was useful. The folder is the uploader's own id, which is
 * what the storage policy checks, so nothing can be written against
 * somebody else's name.
 */
export const forumBucket = 'forum'

export function forumImageUrl(path: string): string {
  return supabase.storage.from(forumBucket).getPublicUrl(path).data.publicUrl
}

/**
 * Whether an attachment is a clip rather than a picture.
 *
 * Decided from the ending of the stored path, because the path is all a
 * reader has: the post carries `images` and nothing else, and asking the
 * bucket for the type of every attachment on a page is a round trip per
 * thumbnail to learn something the filename already says.
 *
 * It is the uploader's own extension, so it is only as true as they were -
 * a `.mp4` that is really a picture renders as a clip that will not play.
 * That is a wrong thumbnail and not a hole: nothing here is executed, and
 * what the browser actually does with the bytes is decided by the type
 * storage recorded, not by this.
 */
const CLIP_ENDINGS = ['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v']

export function isForumClip(path: string): boolean {
  const dot = path.lastIndexOf('.')
  return dot > -1 && CLIP_ENDINGS.includes(path.slice(dot + 1).toLowerCase())
}

/**
 * Puts one attachment up and hands back its path, or throws with the
 * reason.
 *
 * Still called `uploadForumImage` and still the one path for both, because
 * the bucket, the folder rule and the size limit are the same for a clip as
 * for a picture - only the list of types storage accepts differs, and that
 * is 0284's business rather than this function's.
 */
export async function uploadForumImage(file: File, userId: string): Promise<string> {
  const dot = file.name.lastIndexOf('.')
  const ending = dot > -1 ? file.name.slice(dot + 1).toLowerCase() : 'png'
  const path = `${userId}/${crypto.randomUUID()}.${ending}`
  const put = await supabase.storage.from(forumBucket)
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false })
  if (put.error) throw new Error(put.error.message)
  return path
}

/** The categories, each with what is going on in it. */
export async function forumBoards(): Promise<ForumBoard[]> {
  return (unwrap(await supabase.rpc('forum_boards')) as ForumBoard[]) ?? []
}

/**
 * A board, or the whole forum when no category is named - which is what
 * the shelves on the front page are.
 */
export async function forumTopics(input: {
  category?: string | null
  sort?: ForumSort
  limit?: number
  offset?: number
  unanswered?: boolean
} = {}): Promise<ForumTopic[]> {
  return (unwrap(await supabase.rpc('forum_topics_list', {
    in_category: input.category ?? null,
    in_sort: input.sort ?? 'active',
    in_limit: input.limit ?? 20,
    in_offset: input.offset ?? 0,
    in_unanswered: input.unanswered ?? false,
  })) as ForumTopic[]) ?? []
}

/** One topic. Null rather than a throw when it is not there to be read. */
export async function forumTopic(id: number): Promise<ForumTopic | null> {
  const rows = (unwrap(await supabase.rpc('forum_topic', { in_id: id })) as ForumTopic[]) ?? []
  return rows[0] ?? null
}

export async function forumReplies(
  topic: number, limit = 50, offset = 0,
): Promise<ForumReply[]> {
  return (unwrap(await supabase.rpc('forum_replies', {
    in_topic: topic, in_limit: limit, in_offset: offset,
  })) as ForumReply[]) ?? []
}

/** Opening a topic. Returns its number, which is where the page then goes. */
export async function forumCreateTopic(input: {
  category: string; title: string; body: string; images?: string[]
}): Promise<number> {
  return unwrap(await supabase.rpc('forum_topic_create', {
    in_category: input.category,
    in_title: input.title,
    in_body: input.body,
    in_images: input.images ?? [],
  })) as number
}

export async function forumReply(input: {
  topic: number; body: string; images?: string[]; replyTo?: number | null
}): Promise<number> {
  return unwrap(await supabase.rpc('forum_reply', {
    in_topic: input.topic,
    in_body: input.body,
    in_images: input.images ?? [],
    in_reply_to: input.replyTo ?? null,
  })) as number
}

export async function forumEdit(
  what: 'topic' | 'post', id: number, body: string, title?: string,
): Promise<void> {
  unwrap(await supabase.rpc('forum_edit', {
    in_what: what, in_id: id, in_body: body, in_title: title ?? null,
  }))
}

/** The author deleting their own, or staff taking it down. Same flag. */
export async function forumRemove(what: 'topic' | 'post', id: number): Promise<void> {
  unwrap(await supabase.rpc('forum_remove', { in_what: what, in_id: id }))
}

/** Staff marking a topic. The server refuses a mark the category has not got. */
export async function forumSetStatus(topic: number, status: ForumStatus): Promise<void> {
  unwrap(await supabase.rpc('forum_set_status', { in_topic: topic, in_status: status }))
}

export async function forumSetFlags(
  topic: number, flags: { pinned?: boolean; locked?: boolean },
): Promise<void> {
  unwrap(await supabase.rpc('forum_set_flags', {
    in_topic: topic,
    in_pinned: flags.pinned ?? null,
    in_locked: flags.locked ?? null,
  }))
}

/** The person who asked saying what answered them. Staff can too. */
export async function forumMarkAnswer(post: number): Promise<void> {
  unwrap(await supabase.rpc('forum_mark_answer', { in_post: post }))
}

/** The one mark. Pressing it again takes it off; returns whether it is on. */
export async function forumLike(what: 'topic' | 'post', id: number): Promise<boolean> {
  return unwrap(await supabase.rpc('forum_like', { in_what: what, in_id: id })) as boolean
}

/**
 * Having read it. One account, once, ever - a guest moves nothing, which is
 * why this can be called without checking first and does nothing when
 * nobody is signed in.
 */
/**
 * Say that this thread has been read.
 *
 * Signed in, the database keys the reading to the account and refuses a
 * second one the same day, so calling this twice costs nothing and this
 * note is only about everybody else: signed out there is nobody to key on,
 * so the server counts whatever it is told, and the once-a-day rule has to
 * live here. It is kept per topic per day in `localStorage`, which stops a
 * refresh or a page that mounts twice counting twice and stops nothing
 * else - 0286 says at length why that is accepted for this one number.
 *
 * A browser with storage blocked asks every time. That is the right way
 * round: the alternative is a reader who never counts at all.
 */
const SEEN_KEY = 'kobblon.forum.seen'

function askedToday(topic: number): boolean {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const had = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, string>
    if (had[topic] === today) return true
    /* Yesterday's entries are not worth carrying, so only today's is kept. */
    const keep: Record<string, string> = {}
    for (const [id, day] of Object.entries(had)) if (day === today) keep[id] = day
    keep[topic] = today
    localStorage.setItem(SEEN_KEY, JSON.stringify(keep))
  } catch {
    /* No storage, no memory of having asked. Ask. */
  }
  return false
}

export async function forumSeen(topic: number): Promise<void> {
  if (askedToday(topic)) return
  await supabase.rpc('forum_seen', { in_topic: topic })
}


/* ------------------------------------------------------- forum profiles */

/** What else to read after this one. */
export async function forumRelated(topic: number, howMany = 5): Promise<ForumRelated[]> {
  const rows = unwrap(await supabase.rpc('forum_related', {
    in_topic: topic, in_limit: howMany,
  }))
  return (rows as ForumRelated[]) ?? []
}

/** Somebody's forum profile, by username. */
export async function forumProfile(username: string): Promise<ForumPerson | null> {
  const rows = (unwrap(await supabase.rpc('forum_profile', {
    in_username: username,
  })) as ForumPerson[]) ?? []
  return rows[0] ?? null
}

/** Everything somebody has written on the forum, newest first. */
export async function forumPostsOf(
  who: string, howMany = 20, from = 0,
): Promise<ForumWritten[]> {
  const rows = unwrap(await supabase.rpc('forum_posts_of', {
    in_user: who, in_limit: howMany, in_offset: from,
  }))
  return (rows as ForumWritten[]) ?? []
}

/** The tags somebody may pick, and the one nobody may. */
export async function forumTagList(): Promise<ForumTagOption[]> {
  const rows = unwrap(await supabase.rpc('forum_tag_list'))
  return (rows as ForumTagOption[]) ?? []
}

/**
 * Your own tag and your own bio, both at once.
 *
 * A bio of null hands the question back to your Kobblon profile rather
 * than leaving an empty sentence on the forum.
 */
export async function setForumProfile(tag: string | null, bio: string | null): Promise<void> {
  unwrap(await supabase.rpc('set_forum_profile', { in_tag: tag, in_bio: bio }))
}
