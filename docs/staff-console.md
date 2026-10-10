# The Kobblon staff console, in full

Everything at `/staff`: what it looks like, every panel, every control, who
may press it, and what the database does about it. Written against the code
as it stands, not as it is meant to be — where something is missing or
half-built it says so.

One rule runs through the whole thing and is worth stating before anything
else: **nothing in this console is a security boundary.** Every panel decides
what to *draw*. Every function behind every button checks again on the
server, and that second check is the only one that counts. The console hides
doors that will not open, so staff are not taught that their own tools lie to
them — it is not the lock.

---

## 1. Getting in

### The gate

`/staff` asks the database `my_staff_rank()`, which returns one of four
strings: `superadmin`, `admin`, `moderator`, `none`. Anything but `none` gets
in; `none` is redirected to the home page.

This used to gate on `profiles.is_admin`, which meant **every moderator was
sent away from the one panel that is their job.** That is fixed.

If the rank call *fails* — as it did while `staff_rank` was missing from the
live database — the console does not treat the failure as a rank. It falls
back to the flags already on the profile (`is_admin` → admin,
`is_moderator` → moderator) and prints an amber line in the header saying it
is guessing and that superadmin-only actions will refuse. A failed call is
not an answer, and the first version of this got that wrong in both
directions.

### The three ranks

Stored as three booleans on `profiles` — `is_moderator`, `is_admin`,
`is_superadmin` — but read as one word, because precedence belongs in one
place:

| Rank | Implies | Panels |
|---|---|---|
| **Moderator** | — | 4 |
| **Admin** | moderator | 9 |
| **Superadmin** | admin, moderator | 10, and the two powers that stop at the top |

`is_moderator()` answers yes for all three. `is_admin()` answers yes for
admin and superadmin. Promotion happens **in the database only** — there is
no button anywhere that makes a superadmin, because a panel that can promote
only has to be stolen once.

The two powers that stop at the top:

- **Closing an account** (`admin_delete_account` → `require_superadmin`).
- **Clearing a behaviour record** (`clear_behaviour` → `require_superadmin`).

---

## 2. What it looks like

A **wide** page — the only one on the site that is. The rest of Kobblon lives
in a narrow reading column; a table of accounts beside a map of the world
does not fit in it.

### The header

A rounded-2xl blue tile with a shield icon, then:

- **`Staff console`** in the display face, with the rank immediately beside it
  as a pill: moderator in green, admin in Kobblon blue, superadmin in amber.
  The colour is the hierarchy, read at a glance.
- Under it, one grey line: *"N of 10 panels are yours at this rank."* For
  anybody below superadmin it adds *"Closing an account, and clearing a
  behaviour record, are a superadmin's."* — so nobody hunts for a button that
  was never drawn for them.
- The amber fallback warning, if the rank had to be guessed.

### The layout

`grid lg:grid-cols-[17rem_minmax(0,1fr)]` — a 17rem rail on the left, the
panel filling the rest. On a phone it stacks: rail above, panel below.

### The rail

Ten cards, filtered to the rank. Each is a `rounded-2xl` bordered button
holding:

- An icon, blue when the panel is open, white/40 when it is not.
- The panel's **name** in bold.
- A small outlined **`ADMIN`** or **`SUPER`** pill if it wants more than
  moderator.
- A line of grey text saying what the panel is for.

The open one is `border-brand-bright bg-brand/15`; the rest are
`bg-ink-card` and lighten on hover. `aria-current="page"` marks the open one
for a screen reader.

This replaced a row of ten one-word tabs that wrapped onto three lines and
said nothing about what any of them did.

### The panel header

Above the panel, a thin line with the panel's icon, its name in the display
face, and its blurb in grey — so the content below always has a title, even
after scrolling in from the rail.

---

## 3. The ten panels

Listed in rail order, which is queue-first.

---

### 3.1 Reports — *moderator*

**What people have reported, and what was done.**

A tab strip: **Open · Dealt with · Dismissed · Everything**. Each report is a
card carrying the reason as a warm badge, who it is about with their
`@handle`, how long ago, the reporter's handle as a link to their profile,
free-text details if the reporter wrote any, and an **Open it** link straight
to the thing — a profile, a Catalog item. A queue of complaints with no way
to the thing complained about is a queue nobody works.

Open reports get two buttons: **Take it** (opens the triage sheet) and
**Dismiss**.

#### The triage sheet

A large popup, and the most important surface in the console. Mountable
outside the website — it takes a ticket and a rank as props and asks nothing
about who is signed in, so the Workspace can put it in a panel.

Top to bottom:

1. **What was reported** — the reason badge, the subject's name in black
   weight, an **Already gone** badge if the thing has since been deleted, how
   long ago, who it is about, who reported it, an **Open it** link, and the
   reporter's own words in a bordered block.

2. **Who they are** — four stat tiles, so the tenth offence is not handled
   like the first:

   | Tile | Goes amber when |
   |---|---|
   | Warnings | — |
   | Heavier | above zero |
   | Times quietened | — |
   | Other reports open | above zero |

   Below them, a red **Suspended until …** badge (or *"with no end date"*)
   and an amber **Chat is suspended** badge, when either is true.

3. **What to do** — six choices, each with an icon, a name and a sentence
   saying exactly what happens:

   | Action | What it does | Lowest rank |
   |---|---|---|
   | **Nothing in it** | Recorded, so the same report does not come back for ever | moderator |
   | **Take it down** | The thing comes down, the maker is told why, the account is untouched | moderator |
   | **Warn them** | Said to them and put on their standing. Nothing taken away | moderator |
   | **Suspend chat** | They cannot talk for a while — **the length is the ladder, and Kobblon picks it, not you** | moderator |
   | **Suspend the account** | They cannot sign in. A length is chosen | moderator |
   | **Delete the account** | Gone, no way back. **Superadmin by hand — Kobby is refused this** | superadmin |

   **Take it down** is hidden for a profile and for a message: a profile has
   nothing to take down, and a reported message deliberately stays.

4. **Why**, a required box. Under three characters and it refuses, with
   *"Say why. A sanction with no reason cannot be appealed."* The text is the
   whole of what the person is told, so it is not optional.

5. **Which rule**, a dropdown over the eleven the ledger knows: harassment,
   spam, sexual, violence, impersonation, illegal, hate, cheating, copyright,
   age, other. It pre-selects the reporter's reason when it matches one.

6. **How long**, only for an account suspension: one day, three days, a week,
   a month, or *until somebody lifts it*.

A report that is already settled shows what was decided, by whom, when, and
the note, instead of the buttons.

The chat suspension length is deliberately not a field. It is the ladder —
five minutes, then six, ten, twenty, forty-five, two hours, six hours, a day
— counted over thirty days, **and since the behaviour bar it also shifts by
band**: a clean account starts a rung lower, a poor one a rung higher, a
critical one two. A moderator cannot type a number in, which is the point: it
is the same for everybody in the same position.

---

### 3.2 People — *moderator*

**Behaviour, the record, and what each rank may change.**

A search box — a name, a handle, or the number on a profile. Pressing **Look**
with it empty gives the newest accounts.

Each result is a card with the avatar, the display name with its verified and
staff marks, the `@handle`, the profile number, and the Brix balance.

**What a moderator sees:** a grey note saying standing, Brix and removing an
account are an admin's, and pointing them at the record below and at taking
action from the report itself. No buttons they cannot use.

**What an admin and above see,** as a row of small buttons:

- **Verify / Unverify** — the blue tick.
- **Make mod / Remove mod** — the power.
- **Give the k / Take the k** — the staff badge, which carries *no power at
  all*. Disabled with the words **Wears the k** when the account is already a
  moderator or admin, so the difference is on the button rather than in
  somebody's memory.
- **Notify** — a popup sending one notification from Kobblon, 500 characters,
  with a live counter.
- **Suspend / Unsuspend** — not drawn at all for an admin's account.
- **Delete** — **superadmin only**, and never drawn for an admin's account.

Below that, a **Brix** row: an amount (negative to take), a **Why** shown only
in the staff record, and a **Give** / **Take** button whose word changes with
the sign. It reports the balance *afterwards*, because taking more than
somebody has takes what they have, and a console that implied otherwise would
be lying about money.

**Open the record** expands the full sheet, in three parts:

1. **What everybody sees** — avatar, name, handle, profile number, the badge
   row (Kobblon, Moderator, Verified, Staff badge, Guest, Suspended), Brix,
   and the day they joined.

2. **Comings and goings** — up to twelve sessions: when each started, when it
   ended or when they were last seen, the country, and the browser string.
   Above it, a bordered note saying where they *look* like they are, from the
   time zone their browser reports, and spelling out that this is a setting on
   their own machine, a hint and not proof, and that **Kobblon asks no service
   where anybody is**.

3. **Behaviour and what has been decided** — the join between the console and
   the standing page, added with the behaviour bar:
   - The band word and the score out of 100, coloured by band.
   - The bar itself, with the band edges at 20, 45, 70 and 90 marked on it.
   - A line saying what their next chat suspension would last, and that the
     band is what decided it.
   - A green **Cleared …** badge if a superadmin has cleared them.
   - Up to twenty history rows: the action, **who decided it** (Kobby, Mod,
     Admin, Superadmin), when, how long it held, any appeal and its state,
     what it still costs the bar as `−N`, and the reason in full underneath.
   - For a superadmin only, **Clear the record**, which opens a confirmation
     saying it puts them back to a hundred, that the decisions stay readable
     on their status page, and — the part people forget — that **it also
     forgives their place on the chat suspension ladder**, so their next one
     starts at five minutes again. An optional note goes to them by letter.
     The button is disabled when they are already at a hundred.

---

### 3.3 Screening — *moderator*

**What people have made, waiting on a decision.**

Two queues in one panel, because they are one job: **Catalog (n)** and
**Marketplace (n)**, with the count *on the tab* — a queue you have to open to
find out whether it is empty is a queue that fills up.

Each row: an 80×80 preview (or a grey image icon), the name, a kind badge, how
long it has waited, the maker's handle as a link, and up to three lines of
description.

Two buttons: **Approve** in green — green is yes — and **Reject** in red.
Rejecting does not fire immediately: it opens an inline **Why it is being
turned down** box and will not send empty. That note is the whole of what the
maker is told, and a rejection with nothing said is somebody's work
disappearing.

Above the lists, a line saying most uploads never reach here — the screener
decides them as they arrive — so what is waiting is what it *could not*
decide.

---

### 3.4 Words — *moderator*

**What the moderation system catches.**

The live filter list, editable without a migration. Each row: a coloured
decision badge, the pattern in monospace, its reason, its scope, **Edit** and
a red bin.

Three decisions:

- **Block** — refuse it outright (red).
- **Review** — let it through and flag it (amber).
- **Allow** — an exception to another pattern (green).

The editor is a popup with the pattern, the decision, a reason (*Slur, Scam,
Sexual content…*), and — the part that matters — a **Try it against** box with
a **Try it** button that runs the pattern on the server and answers **Caught**
or **Let through**. This list runs against everything anybody types, and a
pattern that catches too much is otherwise only discovered through the people
it wrongly refuses. A pattern that will not compile comes back with
Postgres's own words, which are far more use than "invalid".

Empty list, stated plainly: *"Nothing is being caught. Anything anybody types
goes straight through."*

---

### 3.5 Machine — *admin*

**What Kobby screens, and what it is allowed to do.**

A status row: an **On** / **Off** badge, how many things are waiting right
now, a **Turn it on / off** button, and **Run it now** (disabled while it is
off).

**When it works**, three mutually exclusive choices:

- *Whenever anything is waiting*
- *Only what has waited too long* — shows the minutes underneath
- *Only when the queue is long* — shows the threshold underneath

**What it may do to people**, three buttons:

- **May warn / May not warn**
- **May suspend / May not suspend**
- **Never deletes an account** — permanently disabled, and it is disabled
  because there is no such door, here or in the database.

**Which models it uses**: two dropdowns, *Reading* and *Looking at pictures*,
the second of which offers *"Nobody — a person looks at pictures"*. The list
is fetched from Groq live, because Groq retires model names on its own
schedule; whatever is currently set is always offered even when Groq no longer
lists it, so the first save does not silently change a setting nobody touched.
If Groq cannot be reached it says so and falls back to what is already set.
The key lives in Supabase as `GROQ_API_KEY` and never reaches a browser.

**What it has been deciding**: the last thirty verdicts, each with a badge
(rejected and suspended red, unsure amber, the rest green), what it was about,
its reason, and how long ago.

A run where the machine never answered is reported as a failure in its own
words, not summarised away — *"looked at 12, decided 0"* is what a retired
model name looks like from here and also what twelve genuinely unclear things
look like, and the two must not read the same.

**Known gap:** the cron job that should run this on a schedule is not set up,
so Kobby only works when somebody presses **Run it now**.

---

### 3.6 Notice — *admin*

**A line across the top of the site, which anybody can close.**

If one is up: an **Up now** badge, its words, its link, and **Take it down**.

If not: **What it says** (300 characters), **Where it goes** (a path or an
`https` address — checked, and its own field rather than something written
into the words, so it *can* be checked), **The link's words**, and **For how
many days** (1–90). The bar renders text and an anchor, **never markup**.

This is Kobblon speaking in its own voice to everybody at once, which is a
different job from moderating — so it is an admin's, not a moderator's.

---

### 3.7 Announce — *admin*

**A word from Kobblon, to one person or everybody.**

A 500-character box with a live counter that turns red at the limit. Sending
to everybody opens a confirmation saying there is no way to take a
notification back, that it goes to every account that is not a guest and not
suspended, and that it arrives with **no staff name on it** — and it shows the
message back before it goes. The toast afterwards says how many it reached.

Guests are skipped on purpose: a guest account lives in one browser and is
usually gone before anybody reads it.

(One-person notices are also sent from the **Notify** button in People.)

---

### 3.8 Sale — *admin*

**Everything in the Catalog, cheaper, for a while.**

Running: a green **N% off** badge, the end date and time, the note, and **End
it now**.

Not running: **Percent off** (1–75), **For how many days** (1–90), **Why**
(shown on the Catalog, e.g. *Halloween*), and **Start it**.

What is deliberately *not* offered: which items, and whether to include
limiteds. A console that lets somebody tick "include limiteds" is a console
that lets somebody break the promise a limited makes. Limiteds keep their
price, and nothing ever comes down to nothing.

---

### 3.9 Map — *admin*

**Roughly where people are, by the clock on their machine.**

A world map, one dot per time zone, sized by how many accounts have been seen
there in the last month, with the top twelve zones listed underneath as
name-and-count.

The caption is part of the feature: the zone is what a browser reports — a
setting on somebody's own machine — a zone's coordinates are the *zone's*, not
the person's, and **Kobblon asks no service where anybody is**.

---

### 3.10 Record — *admin*

**What staff have done.**

Every staff action, newest first: the action as a badge, the `@handle` it was
done to, every non-empty detail as `key: value`, and how long ago.

Kept where the person who did it cannot edit it. **A deleted account keeps its
name here and nowhere else**, which is the whole reason the log stores the
handle as text as well as a reference.

---

## 4. How the three sides join up

The console, the standing page and the moderation system are one system seen
from three angles, and they are wired as one:

1. A moderator takes a report in the triage sheet.
2. `take_report` writes the decision with its reason and its author, sends the
   letter, and applies the sanction.
3. It appears on that person's `/standing` within seconds — as a row saying
   **who** decided it (Mod, Admin, Superadmin, or **Kobby** where no person
   did), when, how long, for what, why.
4. The behaviour bar moves, because the bar is read out of those rows rather
   than stored. Nothing has to be kept in step.
5. The lower bar makes their *next* chat suspension longer, automatically.
6. If they appeal, the appeal lands against that row; upholding it voids the
   decision, which lifts its weight off the bar with nothing to update.
7. A superadmin can clear the whole thing from the People panel, which is a
   row saying *nothing before this counts* — instant, auditable, and it leaves
   the history readable.

Kobby is the same pipeline with no person at step 1, which is exactly why the
standing page names it rather than saying "the system".

---

## 5. What is not built yet

Said as plainly as the rest:

- **Appeals have no panel.** `decide_appeal` exists and works; nothing in the
  console calls it, so an appeal filed today is answered by hand in SQL. This
  is the biggest hole in the console.
- **Support tickets have no panel either.** They are opened, stored, sorted
  (tickets marked *reviewed by a human* go to the front) and readable — and
  answered from the database rather than a queue beside reports.
- **The cron job for Kobby.** It only runs when somebody presses the button.
- **No model-quota fallback** in the Machine panel: if Groq's quota runs out,
  the run simply reports the failure.
- **No bulk actions** anywhere. Every decision is one account at a time, on
  purpose for now.
