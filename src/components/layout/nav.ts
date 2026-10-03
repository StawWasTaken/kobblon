import {
  faHouse, faCompass, faUserGroup, faBookmark, faShirt, faGear, faShapes, faUser, faUsers,
  faPeopleGroup, faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

export type NavItem = {
  to: string
  label: string
  icon: IconDefinition
  end?: boolean
  /**
   * 'friends' shows the number of pending friend requests, 'mail' the number
   * of unread letters from Kobblon.
   */
  badge?: 'friends' | 'mail'
}

/** Sections in the bar across the top. */
export const topNav: { to: string; label: string }[] = [
  { to: '/discover', label: 'Discover' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  // The Catalog is a place to browse, which by this file's own rule puts it
  // up here. It sat in the rail as "Style" while the thing it changes - your
  // avatar - had nowhere of its own at all.
  // Straight to the shop half of the avatar page. `/catalog` redirects
  // there too, for links that already exist, but the nav does not need to
  // go through a redirect to reach a page it knows the address of.
  { to: '/avatar?tab=marketplace', label: 'Catalog' },
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
  { to: '/avatar', label: 'My Avatar', icon: faShirt },
  { to: '/library', label: 'Library', icon: faBookmark },
  { to: '/inbox', label: 'Inbox', icon: faEnvelope, badge: 'mail' },
  { to: '/settings', label: 'Settings', icon: faGear },
]

/** A phone has no top bar, so its bottom row has to cover both. */
export const mobileNav: NavItem[] = [
  { to: '/home', label: 'Home', icon: faHouse, end: true },
  { to: '/discover', label: 'Discover', icon: faCompass },
  { to: '/create', label: 'Create', icon: faShapes },
  { to: '/communities', label: 'Communities', icon: faPeopleGroup },
  { to: '/friends', label: 'Friends', icon: faUserGroup, badge: 'friends' },
]
