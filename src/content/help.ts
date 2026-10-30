import { currency } from '@/lib/currency'
import { MINIMUM_AGE } from '@/lib/age'
import type { StorySection } from '@/components/layout/StoryPage'

/*
 * How Kobblon actually works, article by article.
 *
 * The policies say what the rules are. These say what to do, which is a
 * different question and the one almost everybody arriving at Support is
 * asking: not "what does the Terms of Service say about names" but "how do
 * I change mine and why did it take Brix".
 *
 * Two rules for anybody editing these, and they are the same two the
 * policies live under:
 *
 *   * **Never describe a button that is not there.** Half of these articles
 *     exist because the honest answer is "there is no page for that yet,
 *     open a ticket" - and writing the sentence somebody wishes were true
 *     is how a help page starts lying. Where something is not built, the
 *     article says so, in the present tense, and says what to do instead.
 *   * **Never restate a number.** Prices, limits and ceilings live in code
 *     and drift; the article points at the screen that shows the figure, or
 *     imports the constant, and never types it out a second time.
 *
 * Kobby answers out of these as well as out of the policies:
 * `scripts/bake-policies.mjs` writes them next to the `moderate` function,
 * so an answer about signing in comes from this file rather than from
 * whatever the model remembers about a different platform.
 */

export type HelpArticle = {
  slug: string
  title: string
  eyebrow: string
  /** One line in the grid, said the way somebody looking for it would say it. */
  blurb: string
  intro: string
  updated: string
  sections: StorySection[]
  /** Which of the seven ticket topics this sits under, for the quick links. */
  topic: 'account' | 'money' | 'safety' | 'bug' | 'creator' | 'privacy' | 'other'
}

/* --------------------------------------------------------------- signing in */

const signingIn: StorySection[] = [
  {
    id: 'password',
    heading: 'A forgotten password',
    body: [
      'There is no self-service password reset on Kobblon yet. That is the plain state of it: the page does not exist, and saying otherwise would send you looking for a link that is not there.',
      'What gets you back in is a ticket. Open one under My account, give the address on the account if there is one, and say the username you are trying to reach. Support answers to the address you write from, which is why the form asks for it twice.',
      'This is the single best reason to put an email address on the account before you need it. Settings, Account, Email. Without one there is nothing that proves the account is yours except what you can remember about it.',
    ],
  },
  {
    id: 'username',
    heading: 'A forgotten username',
    body: [
      'Every name you have ever used stays attached to the account, so an old one is still a way of finding it. Tell support any name you remember and roughly when you used it.',
      'A name you used to go by cannot be taken by anybody else, so if you are being told a name is in use when you are sure it is yours, that is usually exactly what has happened: it is still yours and you are signed in as somebody else.',
    ],
  },
  {
    id: 'locked',
    heading: 'Signed in, but nothing works',
    body: [
      'If the account signs in and then most of the site refuses, the account is probably under a decision rather than broken. The Standing page says which one, what it switched off, and when it lifts.',
      'Appeals go through Standing rather than through a ticket, because an appeal has to arrive attached to the decision it is about.',
    ],
    points: [
      { label: 'Where you stand', note: 'kobblon.com/standing - every decision against the account, with the appeal on it.' },
      { label: 'Write to a person', note: 'A ticket, for anything Standing does not explain.' },
    ],
  },
]

/* ------------------------------------------------------------------ names */

const names: StorySection[] = [
  {
    id: 'change',
    heading: 'Changing your username',
    body: [
      'Settings, Account, Change your username. It costs Brix and may be done once a day. The price is shown on the dialog that charges it rather than written out here, because a figure repeated in two places is a figure that will disagree with itself.',
      'Three to sixteen characters, letters, numbers and underscores. Kobby reads the name before it is taken, and a name it refuses is refused with a reason.',
      'The old name stays on the profile, under the names you have used. Nobody else can claim it.',
    ],
  },
  {
    id: 'back',
    heading: 'Taking an old name back',
    body: [
      'The same dialog lists every name the account has held, and picking one fills the field. It still costs the same and still waits the same day, which is deliberate: free would make a username worth nothing, because anybody could claim four and swap between them for ever.',
    ],
  },
  {
    id: 'display',
    heading: 'Display name',
    body: [
      'The display name is the one drawn large on a profile and in chat; the username is the one in the address and the one people search. Changing the display name is free and immediate, and it goes past the same filter.',
      'Two people may share a display name. No two accounts may share a username.',
      'The day you have to wait is on the username only. A display name can be changed as often as you like.',
    ],
  },
]

/* ------------------------------------------------------------------ money */

const money: StorySection[] = [
  {
    id: 'where',
    heading: `Where ${currency.plural} come from`,
    body: [
      `${currency.plural} arrive from a few places and every one of them is written into the ledger on your ${currency.plural} page: the welcome grant, the daily, quests, codes, selling something in the Catalog, and earnings from an advertisement somebody ran.`,
      'Nothing on Kobblon is bought with real money today. There is no purchase screen, no card form and no price in pounds or dollars anywhere on the platform, and anybody offering to sell you Brix is not Kobblon.',
    ],
  },
  {
    id: 'missing',
    heading: 'A balance that looks wrong',
    body: [
      `Open the ${currency.plural} page and read the movements. Every change to the balance writes one line, with what it was for and when, so a balance that looks wrong is almost always a movement you did not expect rather than a number that went missing.`,
      'If a movement is there that you did not make, that is a ticket under Money, and it is worth saying out loud in the ticket: the line, the amount and the day.',
    ],
  },
  {
    id: 'refunds',
    heading: 'Refunds',
    body: [
      'Buying something in the Catalog is final. A refund is a decision support makes, not a button, and it is made where something went wrong on our side: a charge that moved twice, an item that was taken down after you bought it, a purchase made by a decision that was later reversed.',
      'Changing your mind is not one of those. Said plainly here so it is not a surprise in a reply.',
    ],
  },
]

/* --------------------------------------------------------------- avatars */

const avatars: StorySection[] = [
  {
    id: 'wearing',
    heading: 'Dressing your avatar',
    body: [
      'Avatar, from the rail. Everything the account owns is in there, grouped by where it goes, and taking something off puts it straight back in the drawer.',
      'An outfit is a saved set. Saving one does not copy the items, so an outfit you saved stays wearable as long as you still own what is in it.',
    ],
  },
  {
    id: 'portrait',
    heading: 'Your picture is not your avatar',
    body: [
      'The small round picture beside your name is drawn from the avatar itself, from the head up, and it is redrawn when the avatar changes.',
      'If the picture is missing something the avatar is wearing, it is because the drawing was saved while one of the pieces was still loading. The site no longer keeps a picture drawn that way - it falls back to drawing the face fresh in the browser until a complete one can be saved - so changing anything on the avatar and changing it back is enough to force a clean one.',
    ],
  },
]

/* --------------------------------------------------------------- creating */

const creating: StorySection[] = [
  {
    id: 'uploading',
    heading: 'Uploading something',
    body: [
      'Uploads go through Create. Each kind of file has its own ceiling and its own list of accepted extensions, and both are shown on the upload dialog for that kind rather than listed here.',
      'An upload that is refused for its size tells you the size of your file and the size allowed, so the two can be compared. If it says the limit is smaller than the one the dialog advertises, that is a misconfiguration on our side and worth a ticket - it is not something you can fix by making the file smaller.',
    ],
  },
  {
    id: 'review',
    heading: 'Why something is held',
    body: [
      'Kobby reads what is uploaded. Most things pass without anybody noticing; something that is held is held until a person looks, and the reason is shown on the item.',
      'A refusal names the rule it was refused under, and that rule is on the Policies page at its own address, so a refusal can always be read against the words it was made under.',
    ],
  },
  {
    id: 'selling',
    heading: 'Selling',
    body: [
      'Putting something up for sale charges a listing fee, and a sale takes a platform share. Both figures are shown on the form that charges them.',
      'Taking something off sale refunds the listing fee. Selling something you did not make is the fastest way to lose the ability to sell anything.',
    ],
  },
]

/* ---------------------------------------------------------------- safety */

const safety: StorySection[] = [
  {
    id: 'reporting',
    heading: 'Reporting somebody',
    body: [
      'There is a report on profiles, on items, on Worlds and on posts, and it goes to the same queue a ticket does. Use it rather than a ticket where it exists, because a report arrives attached to the thing it is about.',
      'A report about something urgent - somebody in danger, somebody being approached by an adult, a threat - should also be a ticket, marked urgent, so it is read first.',
    ],
  },
  {
    id: 'blocking',
    heading: 'Blocking',
    body: [
      'Blocking stops messages and hides you from each other. It is not a report and nobody is told about it.',
    ],
  },
  {
    id: 'children',
    heading: 'Age',
    body: [
      `Kobblon is not for anybody under ${MINIMUM_AGE}. An account found to be below that is closed rather than warned, and that is in the Terms rather than being a judgement call.`,
      'Kobblon never asks for your password, and no member of staff will ever ask for it, in a ticket, in chat, on Discord or anywhere else. Anybody who does is not us.',
    ],
  },
]

/* --------------------------------------------------------------- tickets */

const tickets: StorySection[] = [
  {
    id: 'writing',
    heading: 'Writing a good one',
    body: [
      'The form asks four things in order: who you are, what you were using, what it is about, and what happened. The last one is the one that decides how fast this goes.',
      'Say what you did, what you expected and what happened instead, and give a link or a name where there is one. "It does not work" is a ticket somebody has to answer with a question, and that is a day.',
    ],
  },
  {
    id: 'account',
    heading: 'Writing without an account',
    body: [
      'A ticket can be opened with no account at all, which is the only honest arrangement for a support page: somebody locked out cannot sign in to say so.',
      'A ticket opened that way is answered to the email address given on it. It does not appear in any list, because there is no account to list it against.',
    ],
  },
  {
    id: 'replies',
    heading: 'Replies',
    body: [
      'A reply lands on the ticket and in your Kobblon inbox, so there is nothing to remember to come back and check. A ticket nobody has replied to in a while is not lost; the status on it says where it is.',
    ],
    points: [
      { label: 'Waiting on us', note: 'It has arrived and nobody has picked it up yet.' },
      { label: 'Being looked at', note: 'Somebody has it.' },
      { label: 'Passed up', note: 'It needed somebody with more rights than the person reading it.' },
      { label: 'Replied', note: 'There is an answer on it waiting for you.' },
    ],
  },
]

/* -------------------------------------------------------------- business */

const business: StorySection[] = [
  {
    id: 'who',
    heading: 'Who this door is for',
    body: [
      'Companies rather than people: a partnership, press, a rights complaint about something on the platform, or an investor.',
      'Kobblon is not publicly traded and nothing is on sale here. An investment is a conversation with Staw directly and nothing is promised in return for one unless he has promised it.',
    ],
  },
  {
    id: 'rights',
    heading: 'A rights complaint',
    body: [
      'If something on Kobblon is yours and should not be here, the Copyright policy sets out what a complaint has to contain for it to be acted on. A complaint missing those parts cannot be acted on, which is why the policy lists them rather than leaving it to be guessed.',
    ],
  },
]

/* --------------------------------------------------------------- closing */

const closing: StorySection[] = [
  {
    id: 'delete',
    heading: 'Deleting your account',
    body: [
      'There is no delete button on the site yet. A deletion is a ticket under Privacy, and it is done by a person.',
      'What comes with it: the account, its balance, its inventory and everything it has written. Worlds and items other people own copies of are handled under the Privacy policy, which says what survives and why.',
      'It cannot be undone and there is no window to change your mind, so support asks once, from the address on the account, before doing it.',
    ],
  },
  {
    id: 'data',
    heading: 'A copy of what is held about you',
    body: [
      'Also a ticket under Privacy. The Privacy policy says what is held, and support sends it to the address on the account.',
    ],
  },
]

export const helpArticles: HelpArticle[] = [
  {
    slug: 'signing-in',
    title: 'I cannot get in',
    eyebrow: 'Account',
    blurb: 'A forgotten password, a forgotten name, or an account that signs in and then refuses everything.',
    intro:
      'The three ways into a locked account, and the one of them that is a ticket rather than a page - '
      + 'said plainly, because there is no reset link on Kobblon yet and looking for one wastes an evening.',
    updated: '2026-10-30',
    topic: 'account',
    sections: signingIn,
  },
  {
    slug: 'names',
    title: 'Usernames and display names',
    eyebrow: 'Account',
    blurb: 'Changing your name, what it costs, and taking an old one back.',
    intro:
      'Two names, one of which is the address of your profile and one of which is not. What each is for, '
      + 'what changing one costs, and why an old name of yours can never be taken by anybody else.',
    updated: '2026-10-30',
    topic: 'account',
    sections: names,
  },
  {
    slug: 'brix',
    title: `${currency.plural}, spending and refunds`,
    eyebrow: 'Money',
    blurb: `Where ${currency.plural} come from, how to read the ledger, and when something is refunded.`,
    intro:
      `Every movement of ${currency.plural} writes a line you can read, which makes almost every "my balance is wrong" `
      + 'answerable without writing to anybody. Here is how to read it, and what support can and cannot undo.',
    updated: '2026-10-30',
    topic: 'money',
    sections: money,
  },
  {
    slug: 'avatar',
    title: 'Your avatar and your picture',
    eyebrow: 'Avatar',
    blurb: 'Wearing things, saving outfits, and why a profile picture might not match.',
    intro:
      'The avatar is the model; the small round picture is a drawing of its head. They are meant to be the '
      + 'same thing, and this says what to do on the days they are not.',
    updated: '2026-10-30',
    topic: 'bug',
    sections: avatars,
  },
  {
    slug: 'creating',
    title: 'Uploading, review and selling',
    eyebrow: 'Creator',
    blurb: 'File limits, why something is held, and what it costs to put something up for sale.',
    intro:
      'What happens to a file between choosing it and seeing it in the Catalog, and the two fees in '
      + 'between - both of which are shown on the form that charges them rather than quoted here.',
    updated: '2026-10-30',
    topic: 'creator',
    sections: creating,
  },
  {
    slug: 'safety',
    title: 'Reporting, blocking and safety',
    eyebrow: 'Safety',
    blurb: 'How to report, what blocking does, and the one thing Kobblon will never ask you for.',
    intro:
      'Reports go to the same people tickets do, but a report arrives attached to the thing it is about, '
      + 'which is why it is the better route wherever one exists.',
    updated: '2026-10-30',
    topic: 'safety',
    sections: safety,
  },
  {
    slug: 'tickets',
    title: 'How a ticket works',
    eyebrow: 'Support',
    blurb: 'What the form asks, what each status means, and writing in without an account.',
    intro:
      'A ticket is a row and a reply is a row, so nothing written here disappears into an address nobody '
      + 'reads. This is what happens to it after Send.',
    updated: '2026-10-30',
    topic: 'other',
    sections: tickets,
  },
  {
    slug: 'business',
    title: 'Business, press and rights',
    eyebrow: 'Business',
    blurb: 'Partnerships, press, investors, and complaints about content that is yours.',
    intro:
      'The exterior door. Companies rather than people, and a different form, because none of the four '
      + 'questions the support form asks make sense for a partnership.',
    updated: '2026-10-30',
    topic: 'other',
    sections: business,
  },
  {
    slug: 'closing',
    title: 'Deleting your account',
    eyebrow: 'Privacy',
    blurb: 'Closing the account for good, and getting a copy of what is held about you.',
    intro:
      'Both of these are a person rather than a button, and both are permanent in one direction. What '
      + 'goes, what stays, and why support asks once before doing it.',
    updated: '2026-10-30',
    topic: 'privacy',
    sections: closing,
  },
]

export const helpBySlug = (slug: string) => helpArticles.find((one) => one.slug === slug) ?? null

/**
 * What the chips under the welcome line say.
 *
 * Three, and they are the three things people actually arrive about rather
 * than the three that read nicest. Each one is a question put the way
 * somebody types it, because the box underneath takes a question and a chip
 * that reads like a heading teaches the wrong thing about the box.
 */
export const openers = [
  'I forgot my password',
  'How do I change my username?',
  'Why is my profile picture wrong?',
]
