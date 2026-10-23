import {
  faHouse, faCompass, faUserGroup, faBookmark, faShirt, faGear, faShapes, faUser, faUsers,
  faPeopleGroup, faEnvelope,
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
  { to: '/home', label: 'Home', icon: faHouse, end: true },
  { to: '/profile', label: 'Profile', icon: faUser },
  { to: '/friends', label: 'Friends', icon: faUserGroup, badge: 'friends' },
  { to: '/people', label: 'People', icon: faUsers },
  { to: '/avatar', label: 'My Avatar', icon: faShirt, ours: 'avatar' },
  { to: '/library', label: 'Library', icon: faBookmark },
  { to: '/inbox', label: 'Inbox', icon: faEnvelope, badge: 'mail' },
  { to: '/settings', label: 'Settings', icon: faGear },
]

/**
 * The row along the bottom of a phone: the five things somebody opens the
 * site to do, with themselves in the middle.
 *
 * Staw, pointing at Polytoria's: that bar works because the centre slot is
 * your own character rather than a sixth icon, so the bar has a middle
 * instead of five things in a line. Ours does the same with the avatar.
 *
 * It is five and it is not the whole site. Everything else - Communities,
 * Friends, Inbox, Settings - is in the drawer, which on a phone now carries
 * both menus, because the sections bar is hidden there.
 */
export const mobileNav: NavItem[] = [
  { to: '/home', label: 'Home', icon: faHouse, end: true },
  { to: '/discover', label: 'Discover', icon: faCompass },
  { to: '/avatar', label: 'You', icon: faShirt, ours: 'avatar', face: true },
  { to: '/catalog', label: 'Catalog', icon: faShirt },
  /* Friends and not Create, because this is the only slot on the bar that
     can carry a number, and an unanswered friend request is the one thing
     on a phone that goes unseen otherwise. Create is a section and sits in
     the drawer with the rest of them. */
  { to: '/friends', label: 'Friends', icon: faUserGroup, badge: 'friends' },
]
