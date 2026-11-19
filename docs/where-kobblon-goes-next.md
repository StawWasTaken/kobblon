# Where Kobblon goes next

Written for Staw, November 2026, against the direction he set: 15-18 and
18-23, Xbox and Steam rather than Roblox, witty and community-centred, and
polished enough that nothing on the screen looks like a placeholder.

Everything here is measured against one question: **does it make Kobblon
feel like a platform people are on, rather than a site people visit?**

---

## The five that would move the needle most

### 1. A party, not an invite

We have "invite a friend into a World" and "join them". What Xbox has and we
do not is a **party that exists before a World does**: three people in a
group, talking, who then all drop into something together and stay together
when it ends.

Why it matters more than it sounds: it turns a session from "I played a
World" into "we hung out". That is the difference between a platform
teenagers open once a week and one they open at seven every evening.

Needs: a party object, voice or text attached to it, the Launcher carrying
it between Worlds, and an invite that lands as a notification rather than a
link. The website's job is small - the party in the chat dock, and a Join
button that already knows the room.

### 2. Playtime, and a number that is yours

Steam's hook is the hours. Xbox's is the score. We have per-World badges and
nothing that adds up.

Two things, cheap:

- **Hours per World on a profile**, and a lifetime total. We already write
  `world_players` rows, so the data is there to start counting.
- **A platform score** that sums what badges somebody has earned, shown on
  their profile and beside their name on a leaderboard.

It costs almost nothing to build and it is the single most effective thing
on this list for making a profile worth returning to.

### 3. A World page that is a store page

Right now a World page is a card with a picture and a Play button. A Steam
page is a shop window: a row of screenshots, what it is in one line, tags,
how many are playing right now, what changed in the last update, what people
say about it.

We have most of the parts already - `space_updates` holds patch notes,
likes and visit counts exist, the roster knows who is in there. They are not
assembled.

Add: **reviews**. A 15-23 audience writes a paragraph; an 8-13 one presses a
thumb. A written review with a playtime beside it is the most Steam thing we
could do, and it gives creators something to answer.

### 4. Clips and screenshots

The Launcher can already draw the World; it should be able to keep the last
thirty seconds of it. A clip that lands on your profile, in the feed, and in
a chat is how a platform markets itself for free.

This is a Launcher feature with a website shelf. It is the biggest single
lever on "people hear about Kobblon" that does not cost money.

### 5. Follow a World, not just a person

Steam has wishlists. We have likes, which do nothing afterwards.

**Following a World** should mean: you are told when it updates, when its
creator posts about it, and when a friend starts playing it. That is three
notification kinds and one table, and it turns a one-off visit into a
relationship.

---

## Redesign

**The avatar page.** Still owed from the last round of asks. It is the page
people spend the most idle time on and the one that looks least like the
rest of the site.

**The catalog.** It is a grid. A store for this audience is browsable by
look, not just by kind: outfits people are wearing, what is new this week,
what the creators you follow made. The pieces exist; the shelf does not.

**The forum.** It works and it looks like a forum from 2009. The audience we
want reads Discord and Reddit. Threads want avatars, reactions in line, and
a reply box that does not take you to another page.

**Notifications.** They are a list. They want grouping ("three people liked
your World"), a filter, and to be pressable into the thing they are about.

**Creator Hub.** It tells a creator what they made. It should tell them how
it is doing: plays this week against last, where people stop, what they
earned. A creator who can see a number comes back to move it.

---

## Remove, or stop pretending

**Anything that implies something the runtime does not do.** This has been
the rule all along and it is worth a sweep of its own.

**The explanatory voice.** The site talks to people like a manual - this is
the copy sweep that follows this document, and it is a design change as much
as a writing one. Platforms this audience respects say less.

**Dead ends.** Use requests have no screen. A Community cannot own a World.
The wiki is linked and does not exist. Each one is a door that opens onto
nothing, and three of those teach somebody that the site is unfinished.

---

## Smaller things that punch above their weight

- **Status, done.** Thoughts shipped this week. The next step is the same
  line in the Launcher, over a player's head in a World.
- **Recently played**, on the home page, in the order Steam does it: the
  thing you did last, one press away.
- **"Now playing" on a profile** - not a dot, the World's name and a Join.
  Half-built already.
- **A keyboard shortcut for search.** Costs an afternoon, and every platform
  this audience uses has one.
- **Rich link previews for Worlds** when somebody drops a link in Discord.
  We have the preview function; it wants a picture and a player count.
- **Seasonal drops** rather than seasonal themes: a hat you can only get
  this month, from a quest. We have quests, the catalog and limited items.
- **A "what is new" page** that is actually kept - a changelog people can
  read is the cheapest trust-building thing a young platform owns.

---

## What I would not do

**Not a feed of strangers.** A short scrollable wall of clips from people
you do not follow is TikTok, and it turns a platform into a timesink with a
different audience. Friends and the people they play with, only.

**Not more currency.** One currency, earned and bought, is clear. A second
one is the thing that makes a platform read as free-to-play.

**Not chasing Roblox's catalogue size.** Fifty Worlds that are worth an
evening beat five thousand that are not, and the second is not a race we can
win anyway.
