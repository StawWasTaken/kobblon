import { currency } from '@/lib/currency'
import type { StorySection } from '@/components/layout/StoryPage'

/*
 * Every rule Kobblon has, in one place, each with its own address and its own
 * date. Support and moderation point at a rule rather than at a page, which
 * only works if a rule has somewhere to be pointed at.
 *
 * None of this has been through a lawyer yet. The hub says so, and it will
 * stop saying so on the day it stops being true, not before.
 */

export type Policy = {
  slug: string
  title: string
  eyebrow: string
  /** One line for the hub, said the way somebody looking for it would say it. */
  blurb: string
  intro: string
  /** The day the wording last changed, which is what people check. */
  updated: string
  sections: StorySection[]
  footnote?: string
}

const terms: StorySection[] = [
  {
    id: 'who',
    heading: 'Who can use Kobblon',
    body: [
      'You need to be 15 or over. We ask for your birthday when you sign up and we act on the answer.',
      'One account per person. Do not share it, sell it, or hand it to someone under 15.',
      'A guest account is a real account that we treat as temporary. Guests can look around and enter Worlds. Guests that have not been seen for a day are cleared out, so if you want to keep anything, turn yours into a proper account first.',
    ],
  },
  {
    id: 'yours',
    heading: 'What you make stays yours',
    body: [
      'Your Worlds and your uploads belong to you. By putting them on Kobblon you let us store them, show them to other people, and let others use what you publish to Create.',
      'Take something down whenever you want. Copies other people already built with may stay in their Worlds.',
      'Content on the Creator Marketplace is used by its number rather than copied, so whoever made a thing stays attached to it wherever it turns up.',
    ],
  },
  {
    id: 'brix',
    heading: `${currency.plural} and buying things`,
    body: [
      `${currency.plural} are a number on your account for use inside Kobblon. They are not money, they cannot be cashed out, and they have no value off the platform.`,
      'Getting something from the Creator Marketplace puts it in your inventory and lets you use its number in your Worlds. It does not give you the file to keep, and it is not a resale right.',
      `An account removed for breaking the rules loses whatever is on it. We do not refund ${currency.plural} spent before that.`,
    ],
  },
  {
    id: 'ours',
    heading: 'What we can do',
    body: [
      'We can remove anything that breaks the Community Guidelines, and suspend accounts that keep doing it.',
      'Uploads are screened automatically when they arrive, and a person looks at anything the check is unsure about. We can hold something back while that happens.',
      'We can change how Kobblon works. If something big changes, we will say so rather than hoping nobody notices.',
    ],
  },
  {
    id: 'limits',
    heading: 'What we cannot promise',
    body: [
      'Kobblon is free and small. Things will break sometimes and data can be lost. Keep your own copy of anything you would be upset to lose.',
      'Nothing here is a promise that a feature will keep existing, that your World will be visited, or that a number on the site will only go up.',
    ],
  },
  {
    id: 'leaving',
    heading: 'Leaving',
    body: [
      'You can stop using Kobblon whenever you like. Ask us and your account goes with everything on it.',
      'Some things survive on purpose: a World somebody else built with your published upload keeps working, and moderation records of a removed account are kept so the same behaviour is not simply restarted.',
    ],
  },
]

const guidelines: StorySection[] = [
  {
    id: 'person',
    heading: 'Be a person, not a problem',
    body: [
      'Disagreeing is fine. Arguing is fine. Being weird is encouraged. Following someone around to make them miserable is not.',
      'No harassment, no pile-ons, no threats, and nothing aimed at someone because of who they are.',
    ],
  },
  {
    id: 'limits',
    heading: 'Hard limits',
    body: [
      'No sexual content involving minors, ever, in any form. This gets reported, not just removed.',
      'No real violence, no doxxing, no selling illegal things, no malware, and no pretending to be someone you are not.',
      'Nothing here is a grey area, and nothing here gets a warning first.',
    ],
  },
  {
    id: 'spaces',
    heading: 'Worlds and what goes in them',
    body: [
      'A World is yours to build, and it is still on Kobblon. Everything in this page applies inside one.',
      'A World cannot be used to collect passwords, pretend to be a login page, or push people somewhere that does. Every World runs shut off from the rest of the site, and trying to get around that is a reason to lose the account rather than a clever trick.',
    ],
  },
  {
    id: 'uploads',
    heading: 'Uploads to Create',
    body: [
      'Upload what you made or what you have the right to share. Do not upload other people’s work and put your name on it.',
      'Everything is reviewed before anyone else sees it. Trying to sneak something past review is its own reason to lose the account.',
      'Pricing what you sell is up to you, inside the ceiling for that kind of content. Do not use listings as a way to advertise something else.',
    ],
  },
  {
    id: 'communities',
    heading: 'Communities',
    body: [
      'A Community can set its own tone, its own ranks and its own rules on top of these. It cannot set rules that undo these.',
      'Running a Community means being answerable for what goes up on its wall and in its announcements. Ignoring that is how a Community loses its owner.',
    ],
  },
  {
    id: 'reporting',
    heading: 'Reporting',
    body: [
      'Use the flag on any profile, World or message. Reports are private and the person you report is not told who sent it.',
      'Reporting things that are fine, over and over, to bother someone, is also against the rules.',
    ],
  },
]


const privacy: StorySection[] = [
  {
    id: 'what',
    heading: 'What Kobblon keeps',
    body: [
      'An account: your username, your display name, your password in a hashed form we cannot read back, your email if you gave one, and your birthday, which decides whether you are old enough to be here.',
      'What you make and do: Worlds, uploads, Catalog items, communities, posts, messages, friendships, blocks, reports, and what you own and are wearing.',
      `Your ${currency.plural} and everything that has moved on your account, which is what the transactions page shows you.`,
      'Being here: whether you are online, what you are doing in broad terms, and when you were last seen. This is what the dot beside your picture is drawn from.',
      'Technical records kept by the services Kobblon runs on, including addresses your browser connects from, which exist so we can keep the place working and deal with abuse.',
    ],
  },
  {
    id: 'discord',
    heading: 'If you connect Discord',
    body: [
      'Connecting Discord stores your Discord id, the name Discord shows for you, and when you connected it. Nothing else: we ask Discord only who you are, never about your servers, your friends or your messages.',
      'Your Discord name then appears on your profile, and your Discord id leads to your profile, which is the point of connecting it.',
      'Unlinking removes all three straight away, and you can do it yourself in Settings.',
    ],
  },
  {
    id: 'why',
    heading: 'What it is used for',
    body: [
      'Running the place: signing you in, showing your things to the people you meant to show them to, keeping friends and chat working, and paying creators what they are owed.',
      'Keeping it safe: moderation, reports, working out who is behind abuse, and stopping somebody who has been removed from simply coming back.',
      'Nothing else. Kobblon does not sell what it knows about you, and does not hand it to advertisers. Ads on Kobblon are bought against places on the site, not against people.',
    ],
  },
  {
    id: 'who-sees',
    heading: 'Who can see what',
    body: [
      'Public: your profile, your username, your picture and avatar, your published Worlds, what you have made, your communities, your badges, and whether you are around.',
      'Private: your email, your birthday, your messages, your reports, and anything you have not published. Moderators can see reports and what was reported.',
      'Other people on Kobblon see what you have published and nothing else. A World or a game you go into never receives your account: it gets whatever narrow thing it has been given permission to ask for, and no more.',
    ],
  },
  {
    id: 'yours',
    heading: 'What you can do about it',
    body: [
      'Change your name, your picture, your bio and your settings whenever you like, from your profile and from Settings.',
      'Delete what you have made. Taking something down removes it from the site.',
      'Ask for your account to be deleted, and we will delete it and what is on it. Some records have to outlive that: moderation records about serious harm, and anything a law says must be kept.',
      'Write to us and ask what is held about you.',
    ],
  },
  {
    id: 'where',
    heading: 'Where it lives',
    body: [
      'Kobblon runs on Supabase, which stores the database and the files people upload, and on GitHub Pages, which serves the website itself.',
      'Passwords are never stored in a form anybody at Kobblon can read. Nobody at Kobblon will ever ask you for yours.',
      'Uploads are private by default: a file is fetched with a short lived link rather than sitting at an address anybody can guess.',
    ],
  },
  {
    id: 'age',
    heading: 'Age',
    body: [
      'Kobblon is for people aged 15 and over, and we ask for a birthday at signup for that reason.',
      'If we find an account belongs to somebody under that age, we remove it.',
    ],
  },
  {
    id: 'standing',
    heading: 'Where this page stands',
    body: [
      'This is written plainly, and it says what actually happens rather than covering every possibility in language nobody reads.',
      'It has not yet been through a lawyer. It will be before Kobblon is open widely, and this page will say so when it has.',
      'If something here is wrong or out of date, tell us and it gets fixed.',
    ],
  },
]

const catalog: StorySection[] = [
  {
    id: 'what-it-is',
    heading: 'What the Catalog is',
    body: [
      'The Catalog is everything people have made for other people to use: decals, sounds, video, fonts, models, and the Style items you wear on your face.',
      'A Catalog item is used by its number rather than copied. Whoever made a thing stays attached to it wherever it turns up, and taking it down takes it out of circulation rather than rewriting history.',
    ],
  },
  {
    id: 'uploading',
    heading: 'What you may put in it',
    body: [
      'Your own work, or work you hold the right to share. If you are not sure whether you hold that right, you do not.',
      'Everything is screened when it arrives and a person looks at anything the check is unsure about. Nothing is visible to anybody else until that has happened.',
      'Getting something past review by disguising it is treated as worse than uploading it plainly, not better.',
    ],
  },
  {
    id: 'selling',
    heading: 'Selling',
    body: [
      `What you charge is up to you, inside the ceiling for that kind of item. ${currency.plural} are a number on an account and not money, so a sale here is not a sale anywhere else.`,
      'Kobblon takes a share of each sale, and the share is shown before you list, on the listing itself. It is never taken quietly.',
      'A listing fee is charged when you put something up. It is not returned if the item does not sell, and this is said on the form before you agree to it.',
    ],
  },
  {
    id: 'taking-down',
    heading: 'Taking something down',
    body: [
      'You can unlist your own item whenever you like. People who already own it keep it, because they paid for it.',
      'We take an item down when it breaks the rules, when it is not yours to sell, or when it turns out to be a way of getting somebody to somewhere off the site.',
      'An item taken down for breaking the rules is a decision against the account that uploaded it, and it appears on the standing page with a way to appeal.',
    ],
  },
]

const creators: StorySection[] = [
  {
    id: 'who',
    heading: 'Who can sell',
    body: [
      'Selling Style items needs a verified account. Everybody can buy, everybody can upload to Create, and selling wearables is the part that waits on verification.',
      'Verification is about knowing who is behind an account that takes money from other people. It is not a quality badge and it is not for sale.',
    ],
  },
  {
    id: 'paid',
    heading: 'Getting paid',
    body: [
      `A sale credits your balance in ${currency.plural} as it happens, and the movement shows on your transactions page with what it was for.`,
      'A refund reverses the movement. Refunds happen when something was sold that should not have been, and are not a way to change your mind days later.',
      `${currency.plural} cannot be cashed out. Anybody offering to buy them from you for real money is breaking the rules and usually about to take yours.`,
    ],
  },
  {
    id: 'behaviour',
    heading: 'How a seller behaves',
    body: [
      'Describe what you are selling. A preview that is not what arrives is a reason to lose the listing.',
      'Do not use a listing to advertise something else, to move people off the site, or to sell the same thing under six names to fill the shop.',
      'Do not buy your own items through other accounts to move them up a list.',
    ],
  },
]

const money: StorySection[] = [
  {
    id: 'what',
    heading: `What ${currency.plural} are`,
    body: [
      `${currency.plural} are a number on your account for use inside Kobblon. They are not money, they cannot be cashed out, and they have no value off the platform.`,
      'A balance is not a deposit. It is a record of what you may spend here, and it lives and dies with the account.',
    ],
  },
  {
    id: 'getting',
    heading: 'Where they come from',
    body: [
      'Signing up, being around, selling what you make, running ads that earn, and codes we hand out.',
      'A code is a row on our side with a limit and a date, so a code that has run out has genuinely run out rather than being withheld from you.',
    ],
  },
  {
    id: 'spending',
    heading: 'Spending them',
    body: [
      'Buying Catalog and Style items, paying listing fees, running ads, and changing your username.',
      'Every movement in or out is on your transactions page, with what it was for, and it is the same record we would look at if you asked us about it.',
    ],
  },
  {
    id: 'gone',
    heading: 'When they go',
    body: [
      'An account closed for breaking the rules loses whatever is on it, and what was spent before that is not returned.',
      'If we get something wrong and take the wrong amount, we put it back. Ask, and point at the movement.',
    ],
  },
]

const experiences: StorySection[] = [
  {
    id: 'sandbox',
    heading: 'A World runs shut off',
    body: [
      'Everything somebody builds runs sealed away from the rest of Kobblon. A World cannot read your account, your messages, your friends or your balance.',
      'What a World can ask for, it asks for plainly, and you answer. Nothing is handed over because a World says it needs it.',
      'Trying to get around that seal is a reason to lose the account. It is not a puzzle we have left out for people to solve.',
    ],
  },
  {
    id: 'rules-inside',
    heading: 'The rules apply inside',
    body: [
      'What you may not post on a profile, you may not build into a World. The Guidelines do not stop at the door.',
      'A World that exists to collect passwords, imitate a login, or move people somewhere that does either is removed on sight.',
      'Chat inside a World is screened like chat anywhere else, and the person who owns the World can clear what still lands badly.',
    ],
  },
  {
    id: 'yours',
    heading: 'What you build stays yours',
    body: [
      'A World belongs to whoever made it. Publishing it lets us store it and show it to people.',
      'Unpublishing takes it off the site. What other people built with your published Catalog items keeps working, because they used the number rather than a copy.',
    ],
  },
]

const moderation: StorySection[] = [
  {
    id: 'how',
    heading: 'How a decision is made',
    body: [
      'Something is reported, or a check flags it. A person looks. If a rule was broken, a decision is recorded against the account and the account is told what it was and why.',
      'A decision is a row rather than a mood. It says which rule, what was done about it, and when it ends if it ends.',
    ],
  },
  {
    id: 'ladder',
    heading: 'What can happen',
    body: [
      'A warning, which is on record and does nothing else. Something of yours taken down. Part of the site switched off for a while. The account suspended. The account closed.',
      'Which one depends on what was done, whether it was on purpose, and whether it has happened before. The hard limits in the Guidelines skip the ladder.',
    ],
    points: [
      { label: 'Warning', note: 'On record. Nothing is switched off.' },
      { label: 'Something taken down', note: 'The thing goes. The account carries on.' },
      { label: 'Part of the site switched off', note: 'Posting, uploading or selling, for a set time.' },
      { label: 'Suspended', note: 'No access while it lasts.' },
      { label: 'Closed', note: 'The end of the account.' },
    ],
  },
  {
    id: 'seeing',
    heading: 'Seeing where you stand',
    body: [
      'Your standing page lists every decision against your account, what it stopped, and when it ends. It is the same list a moderator sees, without the notes they wrote to each other.',
      'Kobblon writes to you in your inbox when a decision is made. That is a separate place from notifications on purpose, because a decision cannot be allowed to scroll past behind six people liking a World.',
    ],
  },
  {
    id: 'appealing',
    heading: 'Arguing with it',
    body: [
      'Every decision can be appealed once, from the standing page, in your own words.',
      'An appeal goes to somebody who was not the person who made the decision. You are told the outcome either way.',
      'An upheld appeal voids the decision and lifts whatever it switched off, straight away.',
    ],
  },
]

const copyright: StorySection[] = [
  {
    id: 'yours',
    heading: 'If something of yours is here',
    body: [
      'Tell us. Use the flag on the thing itself, or open a ticket under Creator, and say what it is, where it is, and what makes it yours.',
      'We take down what we are satisfied is somebody else’s work, and the account that uploaded it gets a decision against it with a way to appeal.',
    ],
  },
  {
    id: 'wrongly',
    heading: 'If yours was taken down wrongly',
    body: [
      'Appeal it from your standing page and say where the work came from. A link to where you published it first is the thing that settles it fastest.',
      'Sending a claim about work that is not yours, to get at somebody, is itself a reason to lose an account.',
    ],
  },
  {
    id: 'reuse',
    heading: 'Using other people’s work here',
    body: [
      'A Catalog item published by somebody else is yours to use in your Worlds by its number. That is the permission, and it is the whole permission.',
      'It is not permission to re-upload it as your own, to sell it, or to take the file elsewhere.',
    ],
  },
]

export const policies: Policy[] = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    eyebrow: 'The deal',
    blurb: 'The deal between you and Kobblon.',
    intro: 'The short version of the deal between you and Kobblon, written so it can actually be read.',
    updated: '2026-09-19',
    sections: terms,
    footnote: 'If something here and something a page on the site says disagree, this page is the one that counts.',
  },
  {
    slug: 'guidelines',
    title: 'Community Guidelines',
    eyebrow: 'House rules',
    blurb: 'What is fine here, and what will get your things taken down.',
    intro: 'What is fine here, and what will get your things taken down. Short, because the rules that matter are short.',
    updated: '2026-09-19',
    sections: guidelines,
    footnote: 'Breaking these does not always mean losing the account. Doing it on purpose, repeatedly, usually does.',
  },
  {
    slug: 'privacy',
    title: 'Privacy',
    eyebrow: 'Your data',
    blurb: 'What is kept about you, why, and who can see it.',
    intro: 'What Kobblon keeps about you, why, who can see it, and what you can do about it.',
    updated: '2026-09-19',
    sections: privacy,
    footnote: 'Questions about anything here go to the same place as everything else: report it, or write to us.',
  },
  {
    slug: 'moderation',
    title: 'Moderation and appeals',
    eyebrow: 'Decisions',
    blurb: 'How decisions are made, what can happen, and how to argue with it.',
    intro: 'How a decision gets made, what can happen to an account, and how to have one looked at again.',
    updated: '2026-09-19',
    sections: moderation,
    footnote: 'If a decision about you is not on your standing page, it is not a decision. Ask us about it.',
  },
  {
    slug: 'catalog',
    title: 'Catalog and uploads',
    eyebrow: 'What people make',
    blurb: 'What may go into the Catalog, and what happens to it there.',
    intro: 'What the Catalog is, what may go into it, how selling works, and how something comes back out.',
    updated: '2026-09-19',
    sections: catalog,
  },
  {
    slug: 'creators',
    title: 'Selling on Kobblon',
    eyebrow: 'Creators',
    blurb: 'Who can sell, how you get paid, and how a seller behaves.',
    intro: 'The rules for the people who sell things here, and what they can expect back.',
    updated: '2026-09-19',
    sections: creators,
  },
  {
    slug: 'money',
    title: `${currency.plural} and spending`,
    eyebrow: 'Money',
    blurb: `What ${currency.plural} are, where they come from, and where they go.`,
    intro: `What ${currency.plural} are, how you get them, what you can do with them, and what happens when an account ends.`,
    updated: '2026-09-19',
    sections: money,
  },
  {
    slug: 'spaces',
    title: 'Worlds and experiences',
    eyebrow: 'What runs here',
    blurb: 'What a World may do, and what it can never reach.',
    intro: 'What somebody else’s World is allowed to do while you are inside it, and what it can never get to.',
    updated: '2026-09-19',
    sections: experiences,
  },
  {
    slug: 'copyright',
    title: 'Copyright',
    eyebrow: 'Whose work it is',
    blurb: 'Reporting work of yours, and appealing a takedown.',
    intro: 'What to do when somebody else has put your work here, and what to do when yours went wrongly.',
    updated: '2026-09-19',
    sections: copyright,
  },
]

export const policyBySlug = (slug: string) => policies.find((one) => one.slug === slug) ?? null
