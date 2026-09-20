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
  is_admin: boolean
  is_verified: boolean
  is_guest: boolean
  pixels: number
  birth_date: string | null
  gender: 'male' | 'female' | 'other' | null
  content_id: number | null
  /** The colour somebody chose for their own page. */
  accent_color: string | null
  /** What they are doing, while they are here: around, or building. */
  activity: 'around' | 'building' | null
  /** What they have on their picture, kept on the row so lists can draw it. */
  style?: WornStyle[] | null
  /** The Discord account tied to this one, once Discord has vouched for it. */
  discord_id?: string | null
  /** What they call themselves on Discord, which their profile shows. */
  discord_display?: string | null
  discord_visibility?: 'everyone' | 'friends' | 'nobody'
  discord_linked_at?: string | null
  created_at: string
}

/** One thing somebody is wearing on their picture, and where it sits. */
export type WornStyle = {
  id: string
  name?: string
  url: string
  x: number
  y: number
  width: number
  rotation?: number
  flipped?: boolean
  layer?: 0 | 1
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

export type AssetKind = 'image' | 'audio' | 'video' | 'font' | 'model'
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export type MarketAsset = {
  id: string
  kind: AssetKind
  name: string
  description: string | null
  file_path: string
  thumbnail_path: string | null
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
  status: ModerationStatus
  review_note: string | null
  content_id: number | null
  byte_size: number
  download_count: number
  is_public: boolean
  created_at: string
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
  kind: 'friend_request' | 'friend_accepted' | 'space_like' | 'space_visit' | 'message' | 'system'
  actor_id: string | null
  space_id: string | null
  body: string | null
  is_read: boolean
  created_at: string
  actor?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
  space?: Pick<Space, 'name' | 'slug'> | null
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

export type AccountStanding = {
  level: StandingLevel
  headline: string
  live_count: number
  warning_count: number
  blocks: string[]
  until: string | null
}

export type ViolationAction =
  | 'warning' | 'content_removed' | 'feature_block' | 'suspension' | 'termination'

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

export type Ticket = {
  id: number
  topic: TicketTopic
  subject: string
  status: 'open' | 'answered' | 'closed'
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
