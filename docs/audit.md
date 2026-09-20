# What would make the next Kobblon awkward

An honest look through the repository against `docs/direction.md`. Each entry
says what is there now, why it matters later, and what I would do about it.
Nothing here is a reason to stop and rebuild: most of it is a seam to put in
before it is needed, not a rewrite.

## 1. The currency is named in fifty places (done on the web side)

**Was:** the word "Kubes" was written into pages, labels, toasts and policy
text; the mark was a component called `Kube`; the balance column is
`profiles.pixels`, from the name before that.

**Now:** `src/lib/currency.ts` holds the name, the plural, the short code, how
an amount reads in a sentence, and what each kind of movement reads as.
`src/components/brand/Currency.tsx` holds the mark and a price;
`src/components/money/` holds a balance and a list of movements. Nothing else
on the site draws its own. Renaming what people see, or replacing the mark
with a shape of our own, is a change to those files and nothing else.

The settings section is keyed rather than named for the same reason, so the
menu reads whatever the currency is called rather than a word baked into a
type.

**Still to do:** the database keeps the oldest name of all. `profiles.pixels`,
`move_pixels`, `grant_community_kubes`, `burn_kubes` and friends are a
migration of their own, with functions and policies hanging off them. Worth
doing once the name is settled, in one pass, rather than half now.

## 2. A Space can only ever be a website

`spaces` has no notion of what kind of thing it is. Everything downstream
assumes files and blocks: `space_files`, `page.json`, the compiler, the
sandboxed frame, Discover, the builder.

**Why it matters:** a 3D Space, a game and a 2D site have to live in the same
table to share visits, likes, favourites, comments, ads, moderation, chat and
addresses. If they do not, half the platform gets forked.

**What to do:** one column, `kind`, defaulting to the website we have, before
anything else in that area is built. Every existing query keeps working, the
builder filters on it, and a second kind becomes an addition rather than a
parallel world. Not a migration to write today, but the first one when 3D
research starts.

## 3. The avatar is a picture, not an avatar

A profile has `avatar_url`, and now `style` as a snapshot of what somebody is
wearing. Style items are placements on a square picture: x, y, width, rotation,
layer.

**Why it matters:** Phase 5 wants an avatar with a body, a face, colours and
parts, whose profile picture is rendered from it rather than uploaded beside
it. The placement model is 2D by nature and cannot describe a hat on a head in
three dimensions.

**What to do, in order:** an `avatars` model (body, colours, parts) that the
profile points at; the picture becomes something we draw from it and cache;
`style_items` grows a way to say how a thing is rendered, so a 2D placement and
a future 3D asset are two kinds of the same Catalog item rather than two
Catalogs. What exists keeps working throughout: a 2D placement stays a valid
way to render an item.

## 4. Two legal pages, no policy system (done)

**Was:** `src/pages/Policies.tsx` carried Terms and Guidelines as arrays of
headings and paragraphs. No hub, no per topic document, no dates, and no way
to point at one rule.

**Now:** `src/content/policies.ts` holds nine documents, each with a slug, a
last changed date and its own address under `/policies/:slug`: the terms, the
guidelines, privacy, moderation and appeals, Catalog and uploads, selling,
the currency, Spaces and experiences, and copyright. `/policies` is the hub.
`/terms`, `/guidelines` and `/privacy` keep their old addresses because those
are the ones people have linked to.

**Still true:** the wording has not been reviewed by anybody qualified. The
hub says so plainly, and that note comes off on the day it stops being true
rather than before.

## 5. The component language is half there (done)

**Was:** tabs, filter chips, page headers, section headers, stat tiles and the
sticky toolbar were hand rolled per page, each slightly different, which is
exactly how a site stops looking like one product.

**Now:** `Choices`, `Tabs` (a tray and a line), `PageHeader`, `SectionHeader`,
`StatTile`, `Toolbar` and `Confirm` live in `ui`, and the pages use them.

**Left:** the builder's Inspector still draws its own, deliberately: it is due
a rewrite and is not worth migrating twice.

## 6. One way in to the backend, mostly

`src/lib/api.ts` is the single place that talks to Supabase for data, which is
what makes three clients possible later. Nine files reach for the client
directly, and all of them have a reason: realtime channels, auth, presence.

**What to do:** nothing structural now. Keep the rule that data access goes
through `api.ts`, and when a second client appears, that file plus
`src/types/db.ts` become the shared package. It is 1,900 lines and wants
splitting by area at that point, not before.

## 7. Types mix the database and the screen

`src/types/db.ts` holds both row shapes and shapes invented for a page. Two
clients would want the row shapes on their own.

**What to do:** split when the second client exists, not now. Noted so it is a
decision rather than an accident.

## 8. Notifications carry everything, including things that must not be lost (done)

**Was:** one `notifications` table, one bell, one feed, carrying both ordinary
activity and anything Kobblon itself needed to say.

**Now:** `mail` is its own table with its own address at `/inbox`, its own
unread count beside the bell rather than inside it, and its own realtime
channel. Nothing in a browser can write to it: `send_mail` is revoked from
`authenticated` and is called only by the moderation and support functions,
which are the things allowed to speak for Kobblon. The notifications table is
unchanged and still carries activity.

## 9. There is no account standing, and nothing to appeal to (done)

**Was:** reports created real rows and nothing recorded what happened as a
result. Moderation could only remove things.

**Now:** `violations` records one row per decision, in wording the account is
allowed to read, with what it switched off and when it ends. `my_standing`
works the level out on the server from the decisions still standing, so
voiding one puts an account back where it was with nothing to keep in step,
and `is_blocked_from` is what actually stops somebody posting rather than a
hidden button. `/standing` shows all of it. `appeals` gives each decision one
appeal, and upholding it voids the decision and lifts what it stopped in the
same function. `support_tickets` and `support_messages` are the way to write
to a person, at `/support`, and a staff reply also lands in the inbox.

Recording a decision and writing the letter happen in one function, so an
account is never restricted without being told why.

**Still to do:** the moderator's side of all this is SQL rather than a screen.
The functions enforce who may call them, so a moderation console is a view
over what exists rather than new rules.

## 10. Addresses used to keep the name a thing had when it was made (done)

**Was:** a link carries a number and a name, and the name was frozen at
creation. A Community renamed in March still had February's name in every
link, and the slug in `/c/:slug` and `/u/:username/:slug` never moved.

**Now:** the stored slug follows the name, in a trigger rather than in a form,
so it holds however the row is written. Whatever the slug used to be is kept
in `slug_history`, and `address_now` answers where an old one goes, which
covers a username somebody used to have as well. Pages rewrite the address to
the current one once they know it, replacing the history entry rather than
adding to it, so the back button still behaves.

**Left:** an item in Create or the Catalog has a number and no name in its
address, which is consistent but says less. Worth revisiting when the Catalog
grows.

## 11. Create is built around uploads and Spaces

The hub's rail is Spaces, Uploads, Marketplace, Inventory, Analytics, Ads. The
direction wants Spaces, Avatar, Catalog and, later, experiences.

**What to do:** the rail is data, so this is a small change when the avatar
work lands. Worth doing at the same time rather than twice.

## 12. The rail and the bar have grown past their rule

`nav.ts` says the rail down the left is yours and the bar across the top is
the platform, and that nothing appears in both. That rule has held so far,
but the rail is now eight items and the safety pages (standing, support, the
inbox) arrived after it was written. The inbox sits in the rail and also
beside the bell, which is on purpose for now, because a phone has no rail and
no top bar either.

**What to do, later:** go through the rail, the top bar, the phone row and the
account menu in one pass and decide where each thing lives, rather than adding
to whichever one is nearest. Not urgent, and not worth doing piecemeal: the
point of doing it at all is that it comes out coherent.

## 13. A Space can only ever be a website (superseded by the engine)

Item 2 said `spaces` has no notion of what kind of thing it is. That is still
true, and it is now the next thing in the way: the engine in `src/engine` runs
experiences that the `spaces` table cannot describe.

**What to do, when Creator lands:** one column, `kind`, defaulting to the
website we have, plus somewhere for an experience manifest to live. Not
before: an experience today is a file, and it should stay a file until Creator
is writing them.

## 14. The 2D Space runtime has gone, and its pages have not caught up (done, with a follow-on)

**Done:** the web builder, the block format, the compiler, the sandboxed
frame and the viewer are deleted, along with every route and button that led
to them. Nothing on the site makes or runs a 2D Space any more. Ads kept the
one thing they used from the old page format, `AD_SIZES`, which now lives in
`src/lib/ads.ts`.

**Left standing on purpose:** the `spaces` table and the Spaces people made.
They are readable, they keep their addresses, and their overview pages still
answer. Deleting other people's work is not a refactor.

**Done:** the 2D Spaces are out. The overview page, the builder, the cards
and the rails are gone, Worlds stand where they stood, and the old
addresses land on Discover. The tables are still there, because deleting
what people made is not a refactor, and retiring them is its own migration.

**Still to do:**

0. **Two things dropped rather than faked**, both worth rebuilding on
   Worlds: a visit log per person, which is what "recently visited" needs,
   and posting an update to a World, which used to write to `space_updates`.

1. **Redesign the overview.** `/s/1002/kobblon-hq` is a page built around a
   button that no longer exists. It wants rebuilding as what it is now: the
   page for a thing you go and play, with the cover doing the work, the
   creator, what it is, how many have been, and a Play that hands it to the
   Launcher. The experience page at `/experiences/:id/:slug` is the shape to
   converge on, and the two should end up as one page rather than two that
   look similar.
2. **Settle the name.** Spaces are becoming either Worlds or Experiences.
   Whichever it is, it is one word everywhere: the pages, the database, the
   addresses, the policies, the Catalog, the apps. `src/lib/currency.ts` is
   the pattern to follow, so the word lives in one file and the site reads it
   from there.
3. **Retire the tables** once the overview has moved: `space_files`,
   `space_file_versions` and whatever else only the builder wrote to. One
   migration, after the pages stop reading them, not before.

## 15. Three clients that have to agree

The website, the Launcher and Creator are being built in two sessions and
have to end up as one product. What that needs, in the order it will be
needed:

- **Play, end to end.** Built on this side: `experience_to_play`, the Play
  button, the protocol link, `/download`. Needs the Launcher released to be
  real.
- **Creator publishing an experience.** Creator writes a manifest, the
  website gets a row in `experiences`, and the thing appears where people can
  find it. Nothing of this exists yet; Creator has not been started.
- **One upload path.** Uploading from inside Creator is the same upload as
  uploading in Create: same screening, same content id, same inventory. If
  that ever forks, the Catalog forks with it.
- **One avatar.** K6 is worn on the website, played in the Launcher and
  placed in Creator, from one record on the account.
- **One word for everything.** Whatever a thing is called, all three call it
  that.
