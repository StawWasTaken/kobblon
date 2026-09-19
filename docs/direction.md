# Where Kobblon is going

The product direction, kept here so the work has one place to point at. When
this and anything else disagree, this wins.

## What Kobblon is

A social creation platform: a place where people make things, share them,
find each other's, and eventually go inside them together. Not a website
builder that gets games bolted on later. One platform that starts with 2D
creation and grows into 3D experiences.

A Space is the universal thing somebody makes. Today that is a 2D site. In
time a Space can be a 3D world, a game, a social environment, an interactive
experience, or a mixture. The builder we have is the first creation format,
not a draft to be thrown away.

- Name: Kobblon. The name should feel like a place.
- Tagline: Pixels go brrr.
- Brand blue `#1B34E8`, background `#101012`, sidebar `#162382`, presence and
  Enter green `#1CAE71`, font BD Gravel-VF, mascot Kobby.
- Modern, polished, social, playful, a little strange, young, creative.
- Never generic SaaS, corporate software, startup-template UI, purple
  gradients, glass everywhere, or sterile enterprise design.

## Who it is for

Roughly 15 to 35. The minimum age is not settled and depends on privacy law,
parental consent, messaging rules, user content, payments and data
collection in each place we operate. It needs proper legal review before any
broad launch, and nothing in the product should state a final number as
though it were decided.

Safety and moderation are part of the platform from the beginning rather than
something added once it is big.

## Three doors, one platform

Kobblon Web, a future player, and a future desktop creator are clients of
one platform, not three products. They share accounts, profiles, avatars,
inventory, currency, friends, blocks, communities, chat, badges, events,
notifications, moderation and publishing.

The test of whether we have built it right: somebody customises an avatar on
the web, walks into a 3D Space, is seen by another person wearing that same
avatar, befriends them, opens their profile, buys something from the Catalog,
wears it, earns a badge, joins a community, messages a friend who is on the
website, and comes back to the web to find all of it already true.

Do not build the player or the creator application yet. Leave room for them.

## The words we use

- **Space.** Anything somebody makes and other people go into.
- **Create.** Making and managing on the web: accessible, quick, social. The
  future desktop application is for deep 3D work and is not called Studio by
  default.
- **Catalog.** Things people make for other people to wear or use.
- **Ston.** The unit of length inside a 3D Space, when there is one.
- **The currency.** A platform level abstraction. The name is not settled,
  which is why nothing outside `src/lib/currency.ts` knows what it is called.
  Brix is what it says today, and it is provisional.

## How the platform is shaped

One core, several clients. The core owns identity, profiles, avatars,
friends, blocks, chat, communities, Catalog, inventory, currency, badges,
events, Spaces, moderation, reports, account status, notifications, the
official inbox, support, permissions and publishing.

The entities to think in, which is not the same as tables to create: User,
Profile, Avatar, Inventory, CatalogItem, Currency, Space, Experience,
Friendship, Block, Community, Message, Badge, Event, Report, Violation,
Appeal, SupportTicket, OfficialMessage. Several of these already exist under
other names. Understand what is there before adding anything.

## Rules that decide arguments

**Nothing fake.** No invented visits, activity, statistics, notifications,
reports, appeals, tickets, purchases or inventory. If a thing is not built,
the page says so plainly. A good empty state beats a convincing lie.

**Real time is real.** Presence, chat, notifications and activity come from
the backend, never from a timer pretending.

**User content is untrusted, everywhere.** Server side authorisation, row
level security, validation, rate limits, moderation hooks. Nothing anybody
uploads runs as trusted platform code. No secrets in the frontend, and no
pretending frontend code can be hidden.

**Games get permission, not the account.** A Space or game may eventually ask
for narrow things: public profile, avatar, a friend request, a report, an
authorised badge, its own chat. Never private messages, credentials,
personal data, arbitrary account changes or a way round moderation. Enforced
on the server.

**Moderation is a ladder, not a trapdoor.** Broad freedom of expression,
narrow tolerance for real harm. Swearing, arguments and edgy humour are not
punishments. Threats, targeted abuse, hate, extremist recruitment, doxxing,
exploitation and attacks on the platform are. Detection, warning, removal,
timeout, restriction, suspension, permanent, in that order, with review and
appeal before anything irreversible. Context matters, and fiction is
fiction.

**Reports, blocks, friends, badges, communities and events are platform
level.** Made anywhere, true everywhere.

**Notifications and the official inbox are different things.** Ordinary
activity goes to notifications. Moderation decisions, security notices,
support replies, policy notices and platform announcements go to an inbox
that does not get lost in the noise.

**Copyright is a process, not a disclaimer.** Uploaders must have the rights,
and that alone is not enough: reporting, removal, repeat infringement,
appeals and moderation records are part of the platform. The wording needs a
lawyer, and nothing should claim it has had one until it has.

## Design

One product, not a pile of pages. Shared components for typography, spacing,
buttons, inputs, cards, tabs, navigation, dropdowns, modals, notifications,
badges, avatars, status, loading, empty, error and confirmation.

Colour and light carry meaning, never mood: brand blue for identity and what
is chosen, green for presence and Enter, grey for gone. Structure comes from
spacing and one card surface, not from glow. Icons are filled Font Awesome or
our own art, never emoji. Motion supports the moment and respects a request
for less of it. Kobby turns up where he has something to do.

Everything works on a phone, with keyboard access, visible focus, readable
contrast and sensible touch targets.

## The order of work

1. Keep today's Kobblon working and coherent.
2. Know what would make the rest awkward: `docs/audit.md`.
3. One product: the shared component language, page by page.
4. The currency as an abstraction, named once properly.
5. The policy and safety structure: policies, account status, violations,
   appeals, support, the official inbox.
6. The avatar model, canonical, with the profile picture drawn from it.
7. Create grows: Spaces, Avatar, Catalog, and later experiences.
8. Catalog and user content foundations.
9. Only then the smallest possible 3D runtime: a scene, a Kobby, a camera,
   movement, a floor. Then two of them who can see each other. Then the
   platform behind it.

Every step leaves the site working. Small piece, tested, committed, next.

## The four surfaces

Settled, and it replaces looser wording elsewhere in this document:

- **Kobblon website**, every page: social, discovery, profiles, Catalog,
  inventory, account.
- **Kobblon Create**, not a separate product but the creation pages of that
  same website: uploads, listings, Spaces, ads. It stays on the web.
- **Kobblon Launcher**, the application that plays experiences, and nothing
  else.
- **Kobblon Creator**, the application that builds them, with its panels for
  the scene, the explorer, properties, the Catalog and your assets. Name not
  final.

Uploading from inside Creator is the same upload as uploading in Create: same
screening, same content id, same inventory. Creator is another way in to
Create rather than a second one.
