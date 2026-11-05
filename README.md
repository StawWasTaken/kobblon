# Kobblon

> Pixels go brrr

Kobblon is a social platform for making little corners of the internet.
People build **Spaces**, publish them, and visit each other's.

Built by Staw.

## Running it

```bash
npm install
cp .env.example .env   # already filled in with the publishable key
npm run dev
```

`npm run build` typechecks and builds to `dist/`.

## Deploying

GitHub Pages publishes this repository's root from `main`, so the built site
is committed there: `index.html`, `404.html`, `assets/` and `brand/`. The
`Build site` workflow rebuilds and commits them on every push, so you do not
have to remember. To do it by hand:

```bash
npm run deploy
```

Because the built `index.html` lives at the root, the document Vite builds
*from* is `app.html`. That is the only reason it is named that way. `404.html`
is the same document again: Pages has no rewrites, so it is what hands a deep
link like `/discover` to the router.

Pages serves the repo from `/kobblon/`, so `vite.config.ts` sets that as
the base path, the router picks it up through `import.meta.env.BASE_URL`, and
files in `public/` are referenced through the `asset()` helper rather than a
leading slash. Deploying to a domain root instead is one change: build with
`VITE_BASE=/`.

## The database

Supabase backs everything. Apply every migration in `supabase/migrations`
in order from the Supabase SQL editor before running the app - the ones up
to `0299` are filed under `applied/`, and they are the same one sequence,
see [`supabase/migrations/README.md`](supabase/migrations/README.md).

Only the publishable key ever reaches the browser. Every counter the platform
shows (visits, updates, accounts) is computed server-side by a `security
definer` function, and row level security means a query from the client can
only ever return what that person is allowed to see.

## Layout

```
public/brand/      logos, banners, Kobby illustrations
src/components/
  brand/           wordmark, pixel field, Kobby, signature
  layout/          app shell, sidebar, topbar, nav
  social/          activity feed, stats, notifications, reporting
  spaces/          the Space card
  ui/              buttons, cards, inputs, dialogs, presence, toasts
src/hooks/         auth + presence, async requests, reduced motion
src/lib/           supabase client, the whole data layer, helpers
src/pages/         one file per route
scripts/           copies the build to the repository root
supabase/          schema, policies, functions, realtime
```

## Design notes

- `#1B34E8` is the brand and the interaction colour. `#162382` is the sidebar.
  `#101012` is everything behind it.
- `#1CAE71` means one thing only: a Space. Entering one, being inside one.
  Presence on the platform itself is blue; offline is grey.
- Headings are BD Gravel-VF, loaded from Typekit and set at `ROND 100`.
- Icons are filled Font Awesome, no exceptions.
- Kobby appears in empty states, notifications, errors and 404s, moments,
  not decoration.
- Everything animated respects `prefers-reduced-motion`.

## Kobblon Create

The creator marketplace at `/create`. People upload images, audio, video,
fonts and models; everything enters a review queue and stays private to its
uploader until it is approved. Uploads by the Kobblon account carry a
verified mark. See [`supabase/README.md`](supabase/README.md) for how review
is wired and what still needs deploying.

## Kobblon Create

The creator marketplace at `/create`. People upload images, audio, video,
fonts and models; everything enters a review queue and stays private to its
uploader until it is approved. Uploads by the Kobblon account carry a
verified mark. See [`supabase/README.md`](supabase/README.md) for how review
is wired and what still needs deploying.

## What is in here

- **Spaces** with badges their owner designs, favourites, likes and visits.
- **Communities** people create and join.
- **Kobblon Create**, the reviewed marketplace of uploads.
- **Pixels**, the platform currency, with a ledger behind every balance.
- **Guest mode**, a throwaway account for looking around.
- **Chat** as a dock in the corner, a chat inside every Space that its owner
  can shape or switch off, and friends, follows and notifications.
- **Automated review** of usernames, Space text, uploads and messages, which
  decides as things are submitted rather than queueing them.
- **Account switching** between accounts used on this device, without logging
  in again.
- **Group chats** of up to five friends, in a dock that remembers whether you
  left it open.

## The editor

Not built. The plan for it is in [`docs/editor.md`](docs/editor.md), including
how a Space gets served from its own origin in a sandboxed frame so somebody
else's markup cannot reach a signed in session.

## Not built yet

The Kobblon editor (building the inside of a Space) is deliberately out of
scope for now, and the UI says so where it would otherwise be a dead end
rather than pretending it exists.

Content review is a rule based filter, not a model. It catches the obvious
cases and the common ways around them; it is not a substitute for people
reporting things.

Account switching keeps each account's session in this origin's storage so
switching is instant. That is a deliberate trade: anything able to read that
storage reaches every listed account, not just the current one. Logging out
drops that account's tokens, and guests are never stored.

Ads are not built. When they are, the share owed to the person whose Space
shows one is 15 percent, and `pixel_transactions` already has the shape to
record it.

Badges are awarded by the Space owner rather than by the Space itself, because
there is no editor yet for a Space to award them from.

Content review is a rule based filter, not a model. It catches the obvious
cases and the common ways around them; it is not a substitute for people
reporting things.

Account switching keeps each account's session in this origin's storage so
switching is instant. That is a deliberate trade: anything able to read that
storage reaches every listed account, not just the current one. Logging out
drops that account's tokens, and guests are never stored.

Ads are not built. When they are, the share owed to the person whose Space
shows one is 15 percent, and `pixel_transactions` already has the shape to
record it.

Badges are awarded by the Space owner rather than by the Space itself, because
there is no editor yet for a Space to award them from.
