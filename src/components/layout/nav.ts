import {
  faHouse, faCompass, faUserGroup, faBookmark, faShirt, faShapes, faUser, faUsers,
  faPeopleGroup, faEnvelope, faComments, faCircleInfo,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { KobIcon } from '@/components/brand/Icon'

export type NavItem = {
  to: string
  label: string
  icon: IconDefinition
  /**
   * One of ours, by name, where the Font Awesome stand-in means something
   * else elsewhere. My Avatar's glyph is a shirt, and `shirt` cannot mean
   * `avatar` everywhere - the Catalog is full of actual shirts.
   */
  ours?: KobIcon
  end?: boolean
  /**
   * 'friends' shows the number of pending friend requests, 'mail' the number
   * of unread letters from Kobblon.
   */
  badge?: 'friends' | 'mail'
  /**
   * The slot shows the person's own picture instead of a drawing. One slot
   * on the phone bar has it, and it is what stops that bar reading as five
   * interchangeable icons.
   */
  face?: boolean
  /**
   * There is nothing behind it without an account.
   *
   * A visitor is shown the rail on every public page - Discover, the
   * Catalog, a World, somebody's profile, a 404 - and five of these rows
   * bounced them to the login screen. A menu where half the rows are a
   * door to the same door is the mess Staw was pointing at, said to
   * somebody who has not even signed up yet.
   */
  needsAccount?: boolean
  /** The other way round: drawn only for somebody with no account. */
  visitorOnly?: boolean
}

/**
 * Sections in the bar across the top - and, because that bar is hidden on a
 * phone, the second group in the drawer there. They carry icons for that
 * reason: a drawer with drawings on one half and bare words on the other
 * reads as two menus that got stapled together.
 */
export const topNav: NavItem[] = [
  { to: '/discover', label: 'Discover', icon: faCompass },
  { to: '/create', label: 'Create', icon: faShapes },
  { to: '/communities', label: 'Communities', icon: faPeopleGroup },
  // The Catalog is a place to browse, which by this file's own rule puts it
  // up here. It sat in the rail as "Style" while the thing it changes - your
  // avatar - had nowhere of its own at all.
  { to: '/catalog', label: 'Catalog', icon: faShirt },
]

/**
 * The rail down the left is yours: where you are, who you know, what you
 * keep. The bar across the top is the platform: places to browse. Nothing
 * appears in both, so the two never feel like the same menu twice.
 */
export const sideNav: NavItem[] = [
  { to: '/home', label: 'Home', icon: faHouse, end: true, needsAccount: true },
  { to: '/profile', label: 'Profile', icon: faUser, needsAccount: true },
  { to: '/avatar', label: 'My Avatar', icon: faShirt, ours: 'avatar', needsAccount: true },
  { to: '/friends', label: 'Friends', icon: faUserGroup, badge: 'friends', needsAccount: true },
  /* People and the Library are readable by anybody, so they stay in a
     visitor's rail rather than being hidden with the rest. */
  { to: '/people', label: 'People', icon: faUsers },
  { to: '/library', label: 'Library', icon: faBookmark, needsAccount: true },
  { to: '/inbox', label: 'Inbox', icon: faEnvelope, badge: 'mail', needsAccount: true },
  /*
   * Settings left the rail. It is in the account menu under the gear, and
   * it was in both - the same page reached two ways from one screen, which
   * is half of what made this side feel like a lot of stuff. Staw, with
   * Roblox's menu beside ours: "the logged in pages sidebar+topbar
   * navigating stuff are too confusing".
   *
   * My Avatar moved up beside Profile for the same reason the other way
   * round: those two are both you, and they read as one pair rather than
   * as two entries three rows apart.
   */
]

/**
 * The row along the bottom of a phone: the five things somebody opens the
 * site to do, with themselves in the middle.
 *
 * Staw, pointing at Polytoria's: that bar works because the centre slot is
 * your own character rather than a sixth icon, so the bar has a middle
 * instead of five things in a line. Ours does the same with the avatar.
 *
 * These are the four that are pages. The fifth slot on the bar is Chat, and
 * it is not here because it is not a route - it opens the dock. The bar
 * adds it itself.
 *
 * It is five and it is not the whole site. Everything else - Communities,
 * Friends, Inbox, Settings - is in the drawer, which on a phone now carries
 * both menus, because the sections bar is hidden there.
 */
export const mobileNav: NavItem[] = [
  { to: '/home', label: 'Home', icon: faHouse, end: true, needsAccount: true },
  { to: '/discover', label: 'Discover', icon: faCompass },
  { to: '/avatar', label: 'You', icon: faShirt, ours: 'avatar', face: true, needsAccount: true },
  { to: '/catalog', label: 'Catalog', icon: faShirt },
  /* A visitor's fourth slot, in place of Home and You. Signed in it would
     be a fifth thing on a bar that is deliberately five with the chat, so
     it is drawn only when the other two are not. */
  { to: '/communities', label: 'Communities', icon: faPeopleGroup, visitorOnly: true },
]

/**
 * The door across, and it is a door rather than a wing of the building.
 *
 * Staw: "i want that in the main navigating areas of logged in/at kobblon
 * theres navigating stuff around their own pages ... and to go from at
 * kobblon to logged in pages idk theres one singular or maybe two or three
 * portals to do that, make it coherent and clear rather than this mess".
 *
 * So this was four rows at the foot of the rail - Forum, What is Kobblon,
 * Download, Policies - and it is two. The whole At Kobblon side is listed
 * in that side's own bar and in the foot of every page; repeating four of
 * them in this rail is the mess, because then neither menu is about one
 * thing.
 *
 * The two that are left are the two people actually cross for: the forum,
 * which is a room they are in rather than a page about Kobblon, and What
 * is Kobblon, which is the way into everything else over there.
 */
export const outNav: NavItem[] = [
  { to: '/forum', label: 'Forum', icon: faComments },
  { to: '/about', label: 'What is Kobblon', icon: faCircleInfo },
]
