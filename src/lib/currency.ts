/*
 * What Kobblon runs on: Brix.
 *
 * It was Pixels, then Kubes, and it says Brix today. That name is still
 * provisional: the currency has to work across the Catalog, Spaces, games,
 * the player and whatever pays creators, and it gets its final name once
 * that is settled. Nothing outside this file knows what it is called, so
 * that day is a few lines rather than a search through fifty of them.
 *
 * Brix does not pluralise. One Brix, fifty Brix, the way a currency behaves
 * rather than the way a brick does.
 *
 * The stored column is still `profiles.pixels`, from the first name it had.
 * That is a database rename with functions and policies hanging off it, so it
 * is a job of its own rather than something to fold into a rename of the
 * word people see. `docs/audit.md` keeps that on the list.
 */
import { formatCount } from './format'

export const currency = {
  /** One of them. */
  name: 'Brix',
  /** More than one, which is the same word. */
  plural: 'Brix',
  /** Short form for anywhere a word will not fit. Never shown alone. */
  code: 'BRX',
  /** How an amount reads in a sentence: "1 Brix", "2,400 Brix". */
  amount(n: number) {
    return `${formatCount(n)} ${this.plural}`
  },
  /** "in Brix", for a field label. */
  get inWord() {
    return `in ${this.plural}`
  },
} as const

/*
 * Every way the currency moves, and what that reads as.
 *
 * The database writes a word on each movement; a page should never show that
 * word. Two reasons: one is that "ad_budget" is not English, and the other is
 * that the Catalog, games and whatever the Player charges for will add more
 * of them, and the place to say what they read as is here rather than in
 * whichever page happens to list them.
 */
export type Movement =
  | 'signup_grant' | 'daily' | 'purchase' | 'sale' | 'refund' | 'admin'
  | 'username_change' | 'donation' | 'ad_budget' | 'ad_refund' | 'ad_earning'
  | 'listing_fee' | 'listing_refund' | 'platform_fee' | 'burn'
  /* The ledger has written these six for months and none of them had words
     here, so a quest reward read as "quest" and a tag as "quest tag" - the
     database's own column name, shown to the person who earned it. */
  | 'code' | 'item_edit' | 'gift_sent' | 'gift_received' | 'quest' | 'quest_tag'

export const movements: Record<Movement, string> = {
  signup_grant: 'Welcome',
  daily: 'Daily',
  purchase: 'Bought something',
  sale: 'Sold something',
  refund: 'Refund',
  admin: 'From Kobblon',
  username_change: 'Changed your name',
  donation: 'Donation',
  ad_budget: 'Paid for a campaign',
  ad_refund: 'Campaign refund',
  ad_earning: 'Earned from ads',
  listing_fee: 'Put something up for sale',
  listing_refund: 'Taken off sale',
  platform_fee: "Kobblon's share",
  burn: 'Burned',
  code: 'Redeemed a code',
  item_edit: 'Changed something you made',
  gift_sent: 'Gift sent',
  gift_received: 'Gift received',
  quest: 'Quest reward',
  quest_tag: 'Paid for a quest tag',
}

/** What a movement reads as, falling back to the word itself. */
export const movementWords = (kind: string) =>
  movements[kind as Movement] ?? kind.replace(/_/g, ' ')
