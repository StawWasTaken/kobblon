# What is still to build

Kept here rather than in my head, so nothing quietly falls off. Order is
roughly what I would do next, not a promise about dates.

**Read `docs/direction.md` first.** Kobblon is growing from a 2D Space
platform into avatars, a Catalog, 3D worlds and games, with a player and a
desktop creator beside the website. Nothing below is cancelled by that: the
website and its builder are the first generation and stay. `docs/audit.md`
lists what in the architecture would make the rest awkward, and what to do
about each of them.

## Big pieces

### The Spaces creator
`docs/editor.md` holds the plan. The first two steps of it are built: Spaces
have files, and there is an editor for them.

- **Files, and serving them (built).** `space_files` holds a draft and a live
  copy per Space. Publishing moves one to the other and keeps what was live,
  so a bad publish can be undone. A page is drawn in a sandboxed frame with
  no same origin and a strict content policy, so a Space cannot reach the
  page holding it, its storage, or the network. Content is referenced by its
  number and turned into a short lived link at the last moment.
- **The file editor (built).** Files down one side, what you are writing in
  the middle, the page itself on the right, with Save, Publish and Undo
  publish.
- **The asset picker (built).** A number typed in, or an upload that goes to
  Create and fills its own number in.
- **Blocks (built).** A canvas with drag, resize, snapping, layers and an
  inspector, kept as `page.json` and compiled into the files. Writing the
  files by hand has been taken out: a Space is built out of blocks, holds no
  scripts, and the database refuses to store one.
- **The bridge (partly built).** Donate buttons and ad presses cross it, both
  handled outside the frame. Badges awarding themselves is not built.
- **Richer blocks (mostly built).** A wall of links, a quote, a marquee and
  the Create player, in three shapes, plus a sound that simply runs and
  loops. A guestbook is not built: it needs a table behind it.
- **Fonts you own (built).** The four the site comes with, plus any font in
  your inventory, for the page or one block. More of them come from the
  Marketplace.

#### Redo the whole builder
The next big piece of work, and a rewrite rather than another round of
additions. What is there now grew one feature at a time and shows it: the
canvas, the inspector and the compiler each know too much about the others,
there is one way to arrange things and it is absolute positions on a grid,
and a page is a single screen with no notion of sections, templates or
anything repeating. The next version wants:

- **A layout that is not only absolute positions**: sections down the page,
  with things arranged inside them, so a Space holds up on a phone by
  construction rather than by a media query at the end.
- **More than one page per Space**, with links between them.
- **Templates and parts worth starting from**, including ones other people
  made, since that is what the Marketplace is for.
- **A model that can be versioned**: `page.json` is already the source, but
  it has no migrations, so every new property is a default in the reader.
- **Undo and redo**, selecting more than one block, grouping, proper
  alignment guides.
- **A preview that is the real thing** rather than a canvas approximation of
  it, so what is built and what is served cannot drift apart.

### Ads and gifts
Built. Ads live in campaigns: the campaign carries the name, the budget and
the fortnight, and holds as many ads as somebody wants, each with its own
decal, shape and destination, changed, rested or thrown away without touching
what was paid. Views and presses are counted per ad, so it is possible to see
which one is doing the work, while spending comes off the campaign. A
campaign is bought up front, costs a Kube a view, runs until its budget or
its fortnight is out, and hands back what it did not spend when it is
stopped. A finished campaign can be put back up rather than built again. An
ad names the thing it advertises, and can only be bought by somebody allowed
to advertise that thing; Kobblon's own account is the only one that may
point one off the site. Ads are shown in the blocks Spaces choose to keep and
in Kobblon's own slots, which are in the pages rather than beside them:
Home, Discover, Communities, People, a Space page, a community page and a
profile each carry one or two, and Library, Friends, Settings and Create
carry none. Banners and tall ones are sold in roughly equal number; the
square was dropped, because nowhere on the site had a good place for it. Two
slots on one page never show the same ad while there is another to show.
Nobody takes a share of those views, because nobody owns the page. The Space showing it keeps 15%, counted in hundredths and paid in
whole Brix. A donate block gives Brix straight to whoever made the Space,
confirmed outside the page so the amount cannot be misrepresented.

### Spaces, the rest of it
Badges worth earning, visiting people inside a Space, what a Space can do
beyond showing pictures: guestbooks, pages, links between Spaces. Presence
inside a Space is built; the Space itself is not.

### The logged-out page **(done)**
Redone. It now says what Kobblon is in three pillars, carries the real
platform numbers, the Spaces being visited, what people have put on the
marketplace and the Communities worth joining, and walks somebody through
getting started. Everything on it is read from the database or it is not
shown at all.

### Login and signup **(done)**
Username and password everywhere, through the login function where it is
deployed and through `login_email_for` in the database where it is not.
Switching accounts keeps the sessions it already has, so it never asks twice.
A guest who decides to stay keeps the account they have been using. A failure
says what actually went wrong rather than blaming the password for it.

## Making the whole thing feel finished

The standing complaint, and a fair one: some pages are thin. The rule for
this work is that a page is done when it would survive somebody using it
every day, not when it renders.

Pages that are still light and need to be made heavy:

- **Library.** Three grids. It should be somewhere you keep things.
- **Discover.** Rows and a filter. It should surface things worth finding.
- **Home.** Better than it was, still mostly rails.
- **Notifications.** A panel with a list in it.
- **Communities.** The wall, ranks and affiliates are real; forums, polls,
  events, the store and payouts from the reference are not built.
- **Search.** Now searches names, descriptions and creators; it does not
  rank anything.

### Profiles, redone from nothing **(done)**
Rebuilt rather than tidied. The tabs are gone, the counter wall is gone, the
stock banner everybody shared is gone, and the ads are gone from these pages
entirely.

What it is now:

- **Their colour.** One colour, chosen in Settings, kept on the profile row
  and used across their page: the ring round their face, the rule under every
  heading, the selected control. It is only a colour, checked as six
  hexadecimal digits, so the worst anybody can do to their own page is choose
  something ugly.
- **Their own face as the backdrop**, blurred out behind the panel, rather
  than a banner picture the whole site shares.
- **The work first.** What they have built is the first thing under the
  panel, as a full grid rather than the fourth tab, then what they have put in
  the Marketplace, then their badges.
- **Numbers that earned their place**, in a sentence: how many Spaces, how
  many visits to them, how long they have been here. Friends, followers and
  following are faces at the foot of the page with a count on the control, not
  four figures stacked over everything else.
- **One page, sections down it**, rather than four filing cabinets.

Since then, a second pass: the counts are links to that person's own friends
page rather than lists unfolded in place, the bio is written from the profile
itself through an About card that also carries previous names and the
numbers, the page is About and Creations rather than one long scroll, and the
colour is picked on the page it colours instead of in Settings.

Still to come, when there is somewhere to keep it: more of a Space's own
arrangement on a profile, so the page is laid out by its owner rather than
only coloured by them.

### Presence **(done)**
Presence is a channel now, not a column somebody fetched once. Everybody with
Kobblon open joins one channel and says what they are doing; everybody
subscribed hears it as it changes, so a dot moves while you are looking at it
and every dot for the same person says the same thing on every page. The row
and its heartbeat are still written, as the answer for anybody who is not
there to speak for themselves, and for sorting people by who was about.

There was a `touch_presence` function from the beginning that nothing ever
called, so "online" meant whatever the last sign in happened to set and stayed
that way. The page says so every minute now, while the tab is being looked at,
and says goodbye on the way out. Four states, each its own colour: in a Space
is green, building something is orange, around is blue, gone is grey. Anybody
quiet for three minutes counts as gone whatever their flag says.

### The pages people actually live on **(done)**
- **Home**: one strip at the top with who you are, what you have and the three
  things you are most likely to want, then friends, then the shelves.
- **Discover**: a directory rather than a carousel. Wide cards showing the
  page itself, the name, who made it, how many have been and what it is.
- **Library**: three shelves, one at a time, with the counts as the way in,
  and building or posting an update straight from a card.
- **Friends**: the same page for anybody, so a profile can link to it, in the
  order friends, followers, following. It is called "My friends" on your own
  and "somebody's friends" on theirs, and requests are only on your own.
- **Settings**: your face, your name and your Brix at the top, and the
  section list kept in view while you scroll.

### Profile and avatar customisation
Not built. A marketplace for what people wear and how their profile looks,
which is where the Kobby with sunglasses belongs on the front page. Needs
somewhere to keep what somebody owns, somewhere to put it on, and a way for
creators to sell into it.

## Create

Create is meant to be one of the most important parts of Kobblon, so it
gets its own list:

- Selling for Pixels **(built)**, with a ceiling per kind of content.
- A page per creator **(built)**.
- Bulk upload, and editing several uploads at once.
- Collections: a creator grouping their own work.
- Follow a creator and hear about what they publish.
- A proper moderation queue for the admin account, rather than the automatic
  filter alone.
- Numbers that go further back than thirty days.

## Smaller things worth doing

- Ads. Deferred by decision, with a 15% creator share documented.
- Avatar and profile customisation, which is its own marketplace.
- Notifications that group sensibly.
- Keyboard shortcuts.

## Navigation, once there is enough to navigate

The rail and the topbar grew a page at a time and it shows. What they should
end up as, when the pages behind them exist:

**In the sidebar**, in this order: Home, Profile, Inbox, Friends, Avatar,
Inventory, Communities, Library.

- **Avatar** is a K6 you dress once and wear in every World, the way it works
  everywhere else people expect it to. It is not the Creator's avatar and it
  is not a picture: it is the record the engine reads when somebody joins.
- **Inventory** is what a person owns, which is not what a creator uploaded.
  Accessories, badges, passes, clothing. The Create inventory stays where it
  is and stays separate.

**In the topbar**: Discover, Catalog, Create. Catalog replaces Style, because
what the page holds is a catalogue and "Style" says nothing about it.

Not a rename exercise: most of these want the page to exist first. The order
above is the thing to hold on to.

## Kobblon in the places people already are

A World somebody is playing should be visible outside Kobblon.

- **Discord Rich Presence, through the Launcher.** "Playing Kobblon", the
  Kobblon logo as the large image, and the World underneath it: its emblem,
  its name, who built it, and its numbers, players, visits and likes. That
  is the whole advert, and it costs a friends list.
- **Twitch.** The same thing where Twitch shows what a streamer is running,
  so a stream of a World says Kobblon rather than a blank.

Both are the Launcher's to send and the website's to supply: a World already
has an emblem, a creator, a description and its counts, and the presence
payload is those fields and nothing new. Worth doing once a World can be
published, played and looked at, and not before: presence for an empty
platform advertises an empty platform.
