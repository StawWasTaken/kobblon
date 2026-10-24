export type SpaceCategory =
  | 'personal' | 'community' | 'interactive' | 'experiment' | 'story' | 'fan'

export type Profile = {
  id: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  is_online: boolean
  last_seen_at: string
  in_space_id: string | null
  is_moderator: boolean
  /** Wears the Kobblon k with no permission attached. Power implies it too. */
  has_staff_badge?: boolean
  is_admin: boolean
  /** The top rank. Implies admin, which implies moderator. */
  is_superadmin?: boolean
  is_verified: boolean
  is_guest: boolean
  /** False when the account was made without one, or is still a guest. */
  has_email?: boolean
  /** Staff made this guest real; the site asks them for a password. */
  must_set_password?: boolean
  /** The Community shown at the front of their profile, if they picked one. */
  primary_community?: string | null
  /** Which theme appearance they are wearing: 'default', 'halloween', ... */
  appearance?: string | null
  pixels: number
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  content_id: number | null
  /**
   * When they last changed how their avatar looks. A profile picture drawn
   * before this is out of date and is drawn again rather than shown.
   */
  avatar_changed_at?: string | null
  /** The colour somebody chose for their own page. */
  accent_color: string | null
  /** What they are doing, while they are here: around, or building. */
  activity: 'around' | 'building' | null
  /** The Discord account tied to this one, once Discord has vouched for it. */
  discord_id?: string | null
  /** What they call themselves on Discord, which their profile shows. */
  discord_display?: string | null
  discord_visibility?: 'everyone' | 'friends' | 'nobody'
  discord_linked_at?: string | null
  /**
   * Shut out, and until when.
   *
   * On the row rather than worked out, so the page can know before it asks
   * anything: the card that explains a lockout costs a call, and a platform
   * where nobody is suspended should not make that call on every load.
   *
   * A termination carries `is_suspended` too, with no `suspended_until`.
   */
  is_suspended?: boolean
  suspended_until?: string | null
  /** Closed for good. A banned profile is not readable by anybody else. */
  is_banned?: boolean
  /**
   * On its way out, with two months before the data actually goes.
   *
   * Readable by everybody on purpose, unlike a ban: a friend who is gone
   * reads as "Account Deleted" in a list rather than disappearing out of it.
   */
  closed_at?: string | null
  erase_after?: string | null
  created_at: string
}

/**
 * What a shut-out account is told about itself.
 *
 * From `my_account_standing`, which answers for the person asking and nobody
 * else. `can_return` is the one field with a decision in it: a suspension
 * that has run out is not lifted by time passing, somebody has to come back,
 * and this says the door is open.
 */
export type AccountLock = {
  level: LockLevel
  headline: string
  why: string | null
  rule: string | null
  decided_at: string | null
  until: string | null
  violation_id: string | null
  appeal_status: string | null
  can_appeal: boolean
  can_return: boolean
  /**
   * Whether the checkbox on the card is allowed to do anything. A warning
   * is answerable at once, a suspension only once its time is spent, and a
   * closed account never - that one is lifted by a person or not at all.
   */
  can_acknowledge: boolean
  /** Already said they had read it. */
  acknowledged: boolean
  is_banned: boolean
}

export type Space = {
  id: string
  owner_id: string
  slug: string
  name: string
  description: string | null
  category: SpaceCategory
  cover_url: string | null
  emblem_url: string | null
  thumbnail_urls: string[]
  genre: string
  dislike_count: number
  content_id: number | null
  is_published: boolean
  chat_enabled: boolean
  chat_greeting: string | null
  chat_slowmode_seconds: number
  visit_count: number
  like_count: number
  favorite_count: number
  update_count: number
  published_at: string | null
  created_at: string
  updated_at: string
  owner?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'is_admin'>
}

export type PlatformStats = {
  total_visits: number
  published_spaces: number
  total_updates: number
  total_accounts: number
  people_online: number
}

export type ActivityEvent = {
  id: number
  kind: 'space_published' | 'space_updated' | 'space_entered' | 'user_joined'
  created_at: string
  actor_username: string
  actor_display_name: string
  actor_avatar_url: string | null
  space_id: string | null
  space_name: string | null
  space_slug: string | null
}

/**
 * What a piece of content is.
 *
 * `build` is an arrangement of parts made in Kobblon Workspace and published
 * from it - it is not a file anybody uploads here. `mesh` is the geometry a
 * MeshPart draws, a .glb somebody made in Blender. They used to be one kind
 * called `model`, which is why meshes could not be found: the name said it
 * was already covered.
 */
export type AssetKind = 'image' | 'audio' | 'video' | 'font' | 'build' | 'mesh'
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export type MarketAsset = {
  id: string
  kind: AssetKind
  name: string
  description: string | null
  file_path: string
  /**
   * The old picture, in the private `uploads` bucket, so it is signed for.
   * Nothing writes to it any more.
   */
  thumbnail_path: string | null
  /**
   * The card drawn at upload, in the public `previews` bucket, so it is
   * addressed directly. A different bucket from the one above, which is the
   * whole reason they are two fields and not one.
   */
  preview_path?: string | null
  download_count: number
  content_id: number | null
  price?: number
  score?: number | null
  votes?: number
  created_at: string
  creator_username: string
  creator_display_name: string
  creator_avatar_url: string | null
  creator_is_admin: boolean
  /**
   * Whether their name carries the tick: verified by staff, or staff.
   *
   * Separate from `creator_is_admin`, which is about rights. Somebody
   * verified is not staff, and a card that decided the tick from `is_admin`
   * showed it to staff and to nobody else - backwards from what verifying
   * somebody is for.
   */
  creator_is_verified?: boolean | null
}

export type AssetPageItem = MarketAsset & {
  price: number
  i_can_use: boolean
  i_asked: boolean
  votes: number
  score: number | null
  review_count: number
  my_vote: boolean | null
  byte_size: number
  status: ModerationStatus
  is_public: boolean
  review_note: string | null
  updated_at: string
  creator_id: string
  /*
   * What a mesh wears. Null for every other kind, for a mesh nobody has
   * dressed, and - for the path alone - for a Decal this viewer is not
   * allowed to see, which is why the name can be set while the path is not.
   */
  texture_content_id: number | null
  texture_name: string | null
  texture_path: string | null
}

export type AssetDay = { day: string; views: number; uses: number }

export type AssetRequest = {
  asset_id: string
  asset_name: string
  kind: AssetKind
  content_id: number | null
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  note: string | null
  requested_at: string
}

export type CreatorPage = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  is_admin: boolean
  content_id: number | null
  items: number
  uses: number
  joined: string
}

export type AssetReview = {
  id: string
  body: string
  created_at: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_guest: boolean
  up: boolean | null
}

export type OwnedAsset = MarketAsset & {
  source: 'yours' | 'verified' | 'collected'
}

export type CreatorAssetRow = {
  asset_id: string
  name: string
  kind: AssetKind
  content_id: number | null
  status: ModerationStatus
  is_public: boolean
  views: number
  uses: number
  pending_requests: number
  created_at: string
}

export type Collaborator = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type OwnAsset = {
  id: string
  kind: AssetKind
  name: string
  description: string | null
  file_path: string
  /** The card, so a list can tell which ones need drawing again. */
  preview_path?: string | null
  status: ModerationStatus
  review_note: string | null
  content_id: number | null
  byte_size: number
  download_count: number
  is_public: boolean
  created_at: string
  /**
   * Who put it there, on a Community's list.
   *
   * `community_uploads` has always returned this and nothing showed it, which
   * is how somebody ends up looking at a Decal a different account uploaded
   * and wondering why their own things are missing. Absent on your own list,
   * where the answer is you.
   */
  uploaded_by?: string | null
}

export type UsernameRecord = { username: string; changed_at: string }

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'

export type Friendship = {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendshipStatus
  created_at: string
  responded_at: string | null
}

export type Message = {
  id: number
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  edited_at: string | null
  is_removed: boolean
}

export type Notification = {
  id: number
  user_id: string
  kind: 'friend_request' | 'friend_accepted'
    | 'best_friend_request' | 'best_friend_accepted'
    | 'space_like' | 'space_visit' | 'message'
    | 'system' | 'event_started' | 'world_updated' | 'content_removed'
    | 'forum_reply' | 'forum_staff'
  actor_id: string | null
  space_id: string | null
  world_id?: string | null
  /**
   * Where this one leads, when it leads somewhere the other columns cannot
   * say. 0276 added it for forum replies, which are not a friend, a World
   * or a Space, and it is null on everything older.
   */
  link?: string | null
  body: string | null
  is_read: boolean
  created_at: string
  actor?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
  space?: Pick<Space, 'name' | 'slug'> | null
  world?: Pick<World, 'name' | 'slug' | 'content_id'> | null
}

export type SpaceBadge = {
  id: string
  space_id: string
  name: string
  description: string | null
  icon_url: string | null
  is_enabled: boolean
  awarded_count: number
  created_at: string
}

export type EarnedBadge = {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  awarded_at: string
  space_name: string
  space_slug: string
  space_owner: string
}

export type ProfileOverview = {
  follower_count: number
  following_count: number
  friend_count: number
  badge_count: number
}

export type CommunityRole = 'owner' | 'admin' | 'member'

export type Community = {
  id: string
  owner_id: string
  slug: string
  name: string
  description: string | null
  icon_url: string | null
  banner_url: string | null
  join_policy: 'open' | 'approval'
  is_verified: boolean
  member_count: number
  funds: number
  is_removed: boolean
  /**
   * Closed by staff, with two months before the data goes for good.
   *
   * The row stays readable while that runs - migration 0268 - because the
   * members deserve the sentence rather than a page saying it never existed.
   */
  closed_at?: string | null
  closed_reason?: string | null
  erase_after?: string | null
  content_id: number | null
  created_at: string
}

export type CommunityRank = {
  id: string
  community_id: string
  rank: number
  name: string
  can_post_wall: boolean
  can_moderate_wall: boolean
  can_manage_members: boolean
  can_manage_ranks: boolean
  can_manage_community: boolean
  can_manage_spaces: boolean
}

export type CommunityOverview = {
  member_count: number
  request_count: number
  space_count: number
  my_rank_name: string | null
  my_rank_id: string | null
  can_manage_members: boolean
  can_manage_ranks: boolean
  can_manage_community: boolean
  can_manage_spaces: boolean
  can_post_wall: boolean
  can_moderate_wall: boolean
  has_requested: boolean
  is_banned: boolean
}

export type CommunityMember = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_online: boolean
  is_guest: boolean
  is_verified: boolean
  content_id: number | null
  in_space_id: string | null
  rank_id: string | null
  rank_name: string | null
  rank_number: number | null
  joined_at: string
}

export type CommunityRequest = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type CommunityMoneyRow = {
  id: number
  amount: number
  kind: 'sale' | 'grant' | 'adjustment'
  note: string | null
  created_at: string
  actor_username: string | null
  target_username: string | null
  target_display_name: string | null
}

export type CommunityPost = {
  id: number
  community_id: string
  author_id: string
  title: string | null
  body: string
  media_url: string | null
  media_kind: 'image' | 'video' | null
  is_announcement: boolean
  is_pinned: boolean
  like_count: number
  i_like: boolean
  dislike_count: number
  i_dislike: boolean
  created_at: string
  edited_at: string | null
  author_username: string
  author_display_name: string
  author_avatar_url: string | null
  author_is_guest: boolean
  author_is_verified: boolean
  author_content_id: number | null
  author_rank: string | null
  i_can_remove: boolean
  i_can_pin: boolean
}

export type MemberCommunity = {
  id: string
  slug: string
  name: string
  icon_url: string | null
  member_count: number
  content_id: number | null
  role: CommunityRole
  /** The one this person leads with. At most one of them, and it is first. */
  is_primary: boolean
}

export type CommunityEvent = {
  id: string
  content_id: number | null
  title: string
  subtitle: string | null
  description: string | null
  cover_url: string | null
  space_id: string | null
  starts_at: string
  ends_at: string | null
  is_cancelled: boolean
  attending_count: number
  i_am_going: boolean
  community_slug: string
  community_name: string
  community_icon: string | null
  /** Its last moment has been and gone. */
  is_over: boolean
  /** Over, but within the day it stays on the About page before moving
      into Past events. */
  just_over: boolean
}

export type EventPage = CommunityEvent & {
  community_id: string
  i_can_manage: boolean
  community_content_id: number | null
}

export type EventAttendee = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  is_guest: boolean
  content_id: number | null
}

export type BuildTarget = {
  id: string
  slug: string
  name: string
  icon_url: string | null
  content_id: number | null
  funds: number
}

export type PixelTransaction = {
  id: number
  amount: number
  kind: 'signup_grant' | 'daily' | 'purchase' | 'sale' | 'refund' | 'admin'
  note: string | null
  created_at: string
}

export type SpaceMessage = {
  id: number
  space_id: string
  sender_id: string
  body: string
  created_at: string
  sender?: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'is_admin'> | null
}

export type ConversationMember = Pick<
  Profile,
  'id' | 'username' | 'display_name' | 'avatar_url' | 'is_online' | 'in_space_id'
> & { is_guest?: boolean }

export type Conversation = {
  id: string
  title: string | null
  is_group: boolean
  last_message_at: string
  last_message: string | null
  unread_count: number
  members: ConversationMember[]
  /** True when you are ignoring the person on the other side of it. */
  ignored?: boolean
}

export type SpaceStats = {
  active_now: number
  visits: number
  favorites: number
  likes: number
  dislikes: number
  updates: number
  created_at: string
  updated_at: string
  genre: string
  i_like: boolean
  i_dislike: boolean
  i_favorite: boolean
  i_watch: boolean
}

export type CommunityRelation = {
  id: string
  slug: string
  name: string
  icon_url: string | null
  member_count: number
  content_id: number | null
  accepted: boolean
  /** True when the other Community asked us, so there is something to answer. */
  incoming: boolean
  /** True when we hold this relation, so we are the side that can call it off. */
  mine: boolean
}

export type CommunityBan = {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  reason: string | null
  banned_at: string
}

export type CommunityAuditEntry = {
  id: number
  action: string
  detail: string | null
  created_at: string
  actor_username: string | null
  actor_display_name: string | null
  actor_avatar_url: string | null
}

// ------------------------------------------------------ standing and safety

export type StandingLevel = 'clear' | 'warned' | 'limited' | 'suspended' | 'terminated'

/**
 * What `my_account_standing` answers, which is not quite the same list: it
 * says `banned` where the record says `terminated`, because the card is
 * telling somebody what is happening to them rather than naming a sanction.
 */
export type LockLevel = 'clear' | 'warned' | 'limited' | 'suspended' | 'banned'

export type AccountStanding = {
  level: StandingLevel
  headline: string
  live_count: number
  warning_count: number
  blocks: string[]
  until: string | null
}

/*
 * The behaviour bar. Nought to a hundred, a hundred being nothing on record,
 * worked out on the server from the decisions still standing - never stored,
 * so an upheld appeal lifts its weight with nothing to keep in step.
 */
export type BehaviourBand = 'exemplary' | 'good' | 'mixed' | 'poor' | 'critical'

export type Behaviour = {
  score: number
  band: BehaviourBand
  cleared_at: string | null
  cleared_note: string | null
  /** When the bar is next worth more, and when it is full again. */
  next_at: string | null
  full_at: string | null
  /** A closed account, which does not climb back. */
  permanent: boolean
  /** What the next chat suspension would last, which is what the bar buys. */
  timeout_minutes: number
}

/** Mod, Admin, Superadmin, or Kobby - the automated one. Never an id. */
export type ModeratedBy = 'kobby' | 'moderator' | 'admin' | 'superadmin' | 'staff'

/** One thing that has happened to this account, decision or chat suspension. */
export type ModerationRow = {
  key: string
  violation_id: number | null
  kind: 'decision' | 'chat'
  action: ViolationAction | 'chat_timeout'
  rule: string
  /** Its number in the guidelines, so a card can say "rule 5" and mean it. */
  rule_ord: number | null
  rule_title: string | null
  rule_body: string | null
  /** How serious Kobblon calls that rule, 1 to 4. Not how serious this was. */
  gravity: number | null
  /** What was acted on, as it was stored - which is to say already censored. */
  evidence: string | null
  reason: string
  target_type: string | null
  target_id: string | null
  blocks: string[]
  /** Which ways of talking it took away: chat, voice, or both. */
  channels: string[]
  by_rank: ModeratedBy
  at: string
  until: string | null
  is_void: boolean
  void_reason: string | null
  /** Whether it still presses on the bar: a clear leaves it listed but at nought. */
  counts: boolean
  weight: number
  /** The timeout this row is, when it is one. A violation row has none. */
  timeout_id: string | null
  appeal_status: 'open' | 'upheld' | 'declined' | 'worsened' | null
  appeal_body: string | null
  appeal_note: string | null
  appeal_at: string | null
  appeal_decided_at: string | null
  /** All four walls at once: not void, a go left, the last one answered, in time. */
  appealable: boolean
  /** Goes used, of the two anybody gets. */
  appeals_used: number
  /** When the window shuts. Fifteen days, or longer for a closed account. */
  appeal_closes_at: string | null
}

/** The same, about somebody else, for a staff panel. */
export type StaffModerationRow = {
  key: string
  kind: 'decision' | 'chat'
  action: ViolationAction | 'chat_timeout'
  rule: string
  rule_ord: number | null
  gravity: number | null
  evidence: string | null
  reason: string
  channels: string[]
  by_rank: ModeratedBy
  at: string
  until: string | null
  is_void: boolean
  counts: boolean
  weight: number
  appeal_status: 'open' | 'upheld' | 'declined' | 'worsened' | null
}

export type ViolationAction =
  | 'warning' | 'content_removed' | 'feature_block'
  /** Chat and voice together. Voice is never taken on its own. */
  | 'voice_suspension'
  | 'suspension' | 'termination'

export type Violation = {
  id: number
  rule: string
  action: ViolationAction
  reason: string
  target_type: string | null
  target_id: string | null
  blocks: string[]
  expires_at: string | null
  is_void: boolean
  void_reason: string | null
  created_at: string
}

export type Appeal = {
  id: number
  violation_id: number
  body: string
  status: 'open' | 'upheld' | 'declined'
  decision_note: string | null
  decided_at: string | null
  created_at: string
}

export type MailKind =
  | 'moderation' | 'security' | 'support' | 'policy' | 'announcement' | 'money'

export type Letter = {
  id: number
  kind: MailKind
  subject: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}

export type TicketTopic =
  | 'account' | 'money' | 'safety' | 'bug' | 'creator' | 'privacy' | 'other'

/** What they were on when it happened, which halves the questions back. */
export type TicketDevice =
  | 'computer' | 'phone' | 'tablet' | 'console' | 'launcher' | 'other'

/**
 * `in_progress` and `escalated` arrived with the staff queue (0212): the
 * three it had could not say "somebody is on this", and two moderators
 * answering the same ticket is what that costs.
 */
export type TicketStatus =
  | 'open' | 'in_progress' | 'answered' | 'escalated' | 'closed'

export type Ticket = {
  id: number
  topic: TicketTopic
  subject: string
  status: TicketStatus
  /** What they typed into the form. A claim, not proof. */
  contact_email: string | null
  first_name: string | null
  device: TicketDevice | null
  /** They asked for a person to read this one. Sorts to the front. */
  wants_human: boolean
  updated_at: string
  created_at: string
}

export type TicketMessage = {
  id: number
  sender_id: string | null
  from_staff: boolean
  body: string
  created_at: string
}

// ------------------------------------------------------------------ worlds

export type World = {
  id: string
  content_id: number
  slug: string
  name: string
  description: string | null
  creator_name: string | null
  cover_url: string | null
  /** The square mark. Null falls back to the cover, which is wide. */
  emblem_url: string | null
  runtime_version: number
  visit_count: number
  like_count: number
  dislike_count?: number
  favourite_count?: number
  published_at: string | null
  /** One of `world_genres`, or nothing while nobody has said. */
  genre?: string | null
  maturity?: WorldMaturity
  is_published?: boolean
  owner_id?: string | null
  updated_at?: string | null
  /** Set when it has been put away. Not the same as unpublished. */
  archived_at?: string | null
  /** Whoever built it, when the page asked for them. */
  owner?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'is_admin'> | null
}

/** What one person has already said about a World. */
export type WorldStanding = {
  /** True for a like, false for a dislike, nothing for no opinion. */
  opinion: boolean | null
  favourited: boolean
}

/** How grown up a World is, in the same four words the rest of the site uses. */
export type WorldMaturity = 'everyone' | 'mild' | 'moderate' | 'strong'

export type WorldGenre = {
  id: string
  label: string
  position: number
}

/**
 * A picture or a clip a World shows of itself.
 *
 * Not a Marketplace upload: this belongs to the World rather than to
 * anybody who might reuse it, so it lives in the World's own folder and
 * never gets a content id.
 */
export type WorldMedium = {
  id: string
  world_id: string
  position: number
  kind: 'image' | 'video'
  /** A path inside the `worlds` bucket, never an address. */
  path: string
  created_at: string
}

/**
 * A face: a flat picture worn on K6's head.
 *
 * Kobblon's own, and only Kobblon's. A face anybody could upload is a Decal
 * with extra steps, and the Marketplace already has those.
 */
export type Face = {
  id: string
  content_id: number | null
  name: string
  description: string | null
  /** A path in the faces bucket, never an address. */
  image_path: string
  /** In Brix. */
  price: number
  /** Whether the person asking already has it. */
  owned?: boolean
  /** On the shelf. Absent from the Catalog, where everything is. */
  is_public?: boolean
  is_removed?: boolean
  created_at: string
}

// ------------------------------------------------------------ the avatar

/** What a thing you wear is. The slot a `face` goes in is also `face`. */
export type AvatarKind =
  | 'shirt' | 'trousers' | 'tdecal' | 'accessory' | 'hair' | 'face'
  /**
   * A part of the body itself, which is a shape the engine knows how to
   * build rather than a picture or a model. Kobblon's own: the shape has
   * to exist in `@/engine/bodyshapes` before a row can name it.
   */
  | 'bodypart'

export type AvatarSlot =
  | 'shirt' | 'trousers' | 'tdecal' | 'face' | 'hair'
  | 'hat' | 'front' | 'back' | 'neck' | 'waist' | 'leftHand' | 'rightHand'
  /** Where a body part goes. One slot per part, and only the torso so far. */
  | 'torso'

/** What each kind costs to make and the least it may be sold for. */
export type AvatarRule = {
  kind: AvatarKind
  upload_cost: number
  least_price: number
  needs_verified: boolean
  kobblon_only: boolean
}

/**
 * One row of somebody's avatar: their colours, and one thing they wear.
 *
 * The colours repeat on every row because the server answers in one call
 * rather than making a caller put two answers together to draw one person.
 * A person wearing nothing comes back as a single row with a null slot.
 */
export type AvatarPiece = {
  body: Record<string, string> | null
  slot: AvatarSlot | null
  kind: AvatarKind | null
  /**
   * When it stopped or stops selling, so a profile can say a worn thing
   * was a limited. Null for anything always on sale.
   */
  sells_until?: string | null
  item_id: string | null
  content_id: number | null
  item_name: string | null
  /** What it sells for today, which is what an avatar's worth is counted from. */
  price?: number | null
  image_path: string | null
  image_bucket: string | null
  preview_path: string | null
  /** The card the Creator Hub drew for this item's model, if it has one. */
  mesh_preview_path?: string | null
  mesh_path: string | null
  mesh_format: string | null
  texture_path: string | null
  /**
   * Which shape in the engine this is, for a body part. Null for
   * everything else, which is everything that is a picture or a model.
   */
  shape?: string | null
  /** How its maker placed it, applied on top of the automatic fit. */
  fit?: {
    p?: readonly [number, number, number]
    r?: readonly [number, number, number]
    s?: number
  } | null
}

/** Something on a shelf, in the Catalog or in somebody's own things. */
export type AvatarItem = {
  id: string
  content_id: number
  kind: AvatarKind
  slot: AvatarSlot
  name: string
  description?: string | null
  price: number
  image_path: string | null
  /** Which bucket that picture is in: 'catalog', or 'faces' for an old one. */
  image_bucket?: string | null
  /**
   * A drawn card: the body wearing it for clothes, the model for an
   * accessory. Null for a face, whose own picture is the card, and for
   * anything made before cards were drawn.
   */
  preview_path?: string | null
  /** The card the Creator Hub drew for this item's model, if it has one. */
  mesh_preview_path?: string | null
  mesh_path: string | null
  /** The real format, from the stored filename. The page must not sniff it. */
  mesh_format?: string | null
  texture_path: string | null
  /**
   * Which shape in the engine, for a body part. Null for everything else:
   * a body part is the one kind that is neither a picture nor a model.
   */
  shape?: string | null
  creator_id?: string
  creator_username?: string
  creator_display_name?: string
  creator_is_verified?: boolean
  /** Staff: the Kobblon k. Separate from verified; they mean different things. */
  creator_is_staff?: boolean
  /**
   * The Community that sells it, when one does.
   *
   * Beside the creator rather than instead of it: the person who pressed
   * the button is still who made it, which is what a takedown and an audit
   * entry read - and the byline is the Community, which is what a shopper
   * reads. Staw: "i want it to be said to be 'by [community]' rather by the
   * guy who uploaded it".
   */
  community_id?: string | null
  community_slug?: string | null
  community_name?: string | null
  created_at?: string
  owned?: boolean
  worn?: boolean
  mine?: boolean
  status?: ModerationStatus
  review_note?: string | null
  is_public?: boolean
  taken?: number
  /**
   * When a limited stops being sold, if it is one.
   *
   * The item never stops existing and nobody loses theirs - only buying
   * closes. Null for everything that is simply on sale.
   */
  sells_until?: string | null
  /** How many people have starred it. */
  stars?: number
  /** Whether the person looking has. */
  starred?: boolean
  /**
   * How its maker placed it: `{p, r, s}`, applied on top of the automatic
   * fit. Null means untouched, which is not the same as all zeroes - it says
   * nobody has had an opinion yet.
   */
  fit?: {
    p?: readonly [number, number, number]
    r?: readonly [number, number, number]
    s?: number
  } | null
}

/**
 * A quest on the tab, with where the person looking has got to.
 *
 * `goal` and `done` are in the same unit as each other and nothing else -
 * seconds for a quest about time in a World, a plain count for the rest -
 * so a page draws the bar from the two of them without having to know which
 * sort it is holding, and only has to ask when it writes the words.
 */
/**
 * What a quest asks of you. `claim` asks nothing: accept it and the Brix
 * are yours, which is how the Economy page hands money out in the open.
 */
export type QuestCounted = 'world_time' | 'friends_made' | 'worlds_played' | 'by_hand' | 'claim'

export type Quest = {
  id: string
  counted: QuestCounted
  title: string
  lead: string | null
  goal: number
  reward: number
  world_tag: string | null
  /** Null until an admin has approved the creator's own tag. */
  custom_tag: string | null
  background_url: string | null
  world_id: string | null
  world_content_id: number | null
  world_slug: string | null
  world_name: string | null
  world_emblem: string | null
  author_name: string | null
  ends_at: string | null
  done: number
  /** When they started it. Null means they have not, so nothing is counting. */
  started: string | null
  claimed_at: string | null
  /** Whether the promoter's name carries the tick. */
  author_verified: boolean
  /**
   * Whose name is shown, so the marks beside it can be asked for rather
   * than guessed from the one flag this row used to carry.
   */
  author_id: string | null
  /** When it went up. The blue dot on the Brix menu is this against what
      you have already looked at. */
  created_at: string
}

/**
 * The boards.
 *
 * Six of them are a board of accounts - a player or a Community - and two
 * are a board of Worlds, which is a different row and a different read.
 */
export type OwnerBoard = 'brix' | 'spent' | 'worth' | 'visits' | 'sales' | 'assets'
export type WorldBoard = 'likes' | 'visits'
export type BoardSide = 'players' | 'communities'

/** One place on an account board. `amount` is whichever board asked. */
export type BoardRow = {
  place: number
  kind: 'player' | 'community'
  subject_id: string
  content_id: number | null
  name: string
  /** A username, or a Community's slug. */
  handle: string
  image_url: string | null
  is_verified: boolean
  amount: number
}

/** One place on a board of Worlds. */
export type WorldBoardRow = {
  place: number
  world_id: string
  content_id: number | null
  slug: string
  name: string
  cover_url: string | null
  owner_name: string | null
  owner_username: string | null
  owner_verified: boolean
  amount: number
}

/** What one account has, and where that puts them, on every player board. */
export type PersonPlace = {
  board: OwnerBoard
  amount: number
  /** Null where they have nothing on that board, so there is no place. */
  place: number | null
  of_how_many: number
}

export type QuestRequest = {
  id: string
  title: string
  goal: number
  reward: number
  world_tag: string | null
  custom_tag: string | null
  custom_tag_approved: boolean
  status: 'pending' | 'live' | 'refused' | 'ended'
  refusal: string | null
  created_at: string
}

/**
 * A Community as the staff console sees it.
 *
 * The owner is folded in rather than looked up per row, because the panel
 * acts on the owner as often as on the Community - a flag is about what
 * they did with it - and a list that asks once per card asks fifty times.
 */
export type StaffCommunity = {
  id: string
  content_id: number | null
  slug: string
  name: string
  icon_url: string | null
  member_count: number
  funds: number
  is_public: boolean
  is_verified: boolean
  is_removed: boolean
  /** Null unless somebody closed it. The two months run from here. */
  closed_at: string | null
  erase_after: string | null
  closed_reason: string | null
  created_at: string
  owner_id: string | null
  owner_username: string | null
  owner_name: string | null
  owner_avatar: string | null
  owner_suspended: boolean
  open_reports: number
}

/* ------------------------------------------------------------- the forum */

/**
 * A board. The list is a table rather than a constant in here, because a
 * category in the code means the Workspace ships a copy of the list and
 * the day somebody adds one is two deploys instead of one insert.
 *
 * `kind` is which marks staff may put on a topic in it: nothing is solved
 * in a showcase, and nothing is declined in a help thread.
 */
export type ForumBoard = {
  slug: string
  name: string
  blurb: string
  kind: 'plain' | 'bugs' | 'suggestions' | 'both'
  staff_only: boolean
  topic_count: number
  post_count: number
  last_post_at: string | null
  last_title: string | null
  last_topic_id: number | null
  last_author: string | null
  last_author_avatar: string | null
}

export type ForumStatus = 'open' | 'solved' | 'approved' | 'declined' | 'looked-at'

/** Whoever wrote it, with the two marks their name carries. */
export type ForumAuthor = {
  author_id: string
  author_username: string
  author_name: string
  author_avatar: string | null
  author_is_verified: boolean
  author_is_admin: boolean
  author_is_moderator: boolean
}

export type ForumTopic = ForumAuthor & {
  id: number
  category: string
  category_name: string
  category_kind?: ForumBoard['kind']
  title: string
  body: string
  images: string[]
  status: ForumStatus
  status_at?: string | null
  status_by_name?: string | null
  is_pinned: boolean
  is_locked: boolean
  is_removed: boolean
  view_count: number
  reply_count: number
  like_count: number
  answer_id: number | null
  last_post_at: string
  created_at: string
  edited_at?: string | null
  liked: boolean
}

export type ForumReply = ForumAuthor & {
  id: number
  topic_id: number
  body: string
  images: string[]
  reply_to: number | null
  reply_to_name: string | null
  is_removed: boolean
  like_count: number
  created_at: string
  edited_at: string | null
  is_answer: boolean
  liked: boolean
}

/** What the tabs over a board, and the shelves on the front page, ask for. */
export type ForumSort = 'active' | 'new' | 'helpful' | 'viewed' | 'interesting'

/* ------------------------------------------------------- forum profiles */

/** One of the words somebody may put beside their name on the forum. */
export type ForumTagOption = {
  code: string
  label: string
  /** Given rather than chosen. `staff` is the only one. */
  automatic: boolean
}

/**
 * Somebody's forum profile.
 *
 * `tags` holds the codes and `tag_labels` the words, in the same order, so
 * a page can draw the words without a second copy of the list and a styling
 * rule can key off the code. Staff comes first where it is there at all.
 */
export type ForumPerson = {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  marks: string[]
  tags: string[]
  tag_labels: string[]
  /** Their forum bio, or their Kobblon one where they have not written one. */
  bio: string | null
  /** Whether that bio is the forum's own rather than the Kobblon profile's. */
  bio_is_own: boolean
  /** Null when they have not linked one, or have not shown it to you. */
  discord: string | null
  joined_at: string
  topic_count: number
  post_count: number
  is_me: boolean
}

/** A thing somebody wrote on the forum: a topic, or a reply inside one. */
export type ForumWritten = {
  kind: 'topic' | 'reply'
  id: number
  topic_id: number
  category: string
  category_name: string
  /** The topic's title, for a reply as well as for the topic itself. */
  title: string
  body: string
  like_count: number
  created_at: string
  edited_at: string | null
}

/** What else to read after a topic. */
export type ForumRelated = {
  id: number
  category: string
  category_name: string
  title: string
  reply_count: number
  view_count: number
  like_count: number
  last_post_at: string
  /** How many words its title shares with the one being read. */
  shared: number
}
