# A letter to the people backing Kobblon

**November 2026**

---

## Where we are

Kobblon is a platform where people build Worlds, wear what they made, and
go into each other's. Three clients - the website, the Launcher and the
Workspace - sit on one account, one avatar, one economy and one set of
rules. A person who signs up on the web is the same person in a World five
minutes later, with the same face, the same handle and the same standing.

That sentence is the whole product, and it is the part that is now built.
Publishing a World, opening a server for it, letting somebody in, counting
who is there, deciding what they are allowed to do while they are inside -
all of it runs, and all of it is decided on the server rather than asked
politely of the client.

## The direction we are taking

The honest thing to say about a platform like this is that there is one
obvious shape to copy, and we have decided not to copy it.

Roblox is built for eight to thirteen. Everything about it says so: the
colours, the roundness, the way every page is a grid of bright tiles asking
to be tapped. It works, and it works for them.

**We are building for fifteen to twenty-three.** A teenager who has just
been handed their own computer, and the person they become at university
with a Discord server and a Steam library. That audience does not want a
toybox. They want somewhere that looks like it was made by people with
taste, that respects them, and that their friends are on.

So the reference we hold ourselves to is **Xbox and Steam, not a children's
app**. Dark, quiet, confident. Big pictures of the thing you came for.
Controls that sit where a console puts them. Type you can read across a
room. Witty where it is welcome, never cute for the sake of it, and never
loud.

This is a polish of what we have rather than a rebuild of it. The design
system, the colours, the mascot and the voice stay; what changes is the
weight. Over the last weeks we have been taking out the things that read
young - grids that deal themselves out a tile at a time, panels floating on
frosted glass over the thing they describe, cards with three competing
badges on them - and replacing them with fewer, heavier, calmer pieces.
Nothing we removed was load-bearing. The platform looks more expensive and
does exactly the same job.

## What shipped recently

**A World is drawn one way.** There were three. Now there is a square
emblem used nearly everywhere and a wide thumbnail used in two places, and
one component draws both, so a World on a profile, a shelf, a leaderboard
and in the Launcher is recognisably the same World. Small change; it is
the difference between a catalogue and a platform.

**Discover was rebuilt.** The navigation rail that took a column off the
page is gone, replaced by one bar that stays with you as you scroll. The
Worlds get the whole width. The front of it is nine shelves instead of
four, and you can now filter by **what you are playing on** and **where you
would be playing** - both of which are real: a creator says which devices
their World runs on, and the location list is built from servers that are
actually live, so it offers a place only when there is something there.

**Servers know where they are.** Europe West is our first region and is now
the primary for everything. North America East, Oceania and others follow
as the player base asks for them, and the platform is already built to
offer them the day they exist rather than needing a release to learn about
them.

**Guests got a proper front door.** You can play without an account, and
keep everything you did if you decide to stay - one call, no second signup,
nothing thrown away. The Launcher offers the same door with the same form,
because the form is built once on the website and the applications mount it.

**The avatar system grew up.** Body parts, outfits, limited items, and a
Catalog where the preview of a garment is drawn on a mannequin in your own
browser rather than showing the template file - which keeps a creator's
work from being lifted straight off the page while they are selling it.
A new account now starts in a body that matches the one thing we ask on the
way in, and every piece of that is changeable later.

**Numbers that mean something.** We found that the count a World shows -
the number that decides what the whole platform recommends - could be
written by anybody who asked. It is now counted at the one door people
actually walk through: the arrival itself, once per person per visit, by a
call that already knows who they are. Nothing on the platform ranks on a
number a stranger can type.

**Every creation says who made it.** By handle, with their verification and
staff marks beside it, from one component - so a creator's credit follows
them when they change their display name, which it previously did not.

## How we build

Three things are true of this codebase and all three are commercial, not
cosmetic.

**Rules live on the server.** Permissions, prices, moderation decisions,
who may enter a World, what a creator may change - none of it is decided in
code a player can read or edit. The client asks; the database answers. We
test that the way it should be tested: every rule is checked under at least
two identities, the owner and a stranger, because a check run as nobody
proves nothing about a rule whose subject is identity.

**Safety was not bolted on.** Content screening, warnings, suspensions, an
appeals route and a published set of policies have been part of the
platform since early rather than added under pressure. Our automated
moderation can warn and suspend; it cannot delete a person's account. A
human does that, on purpose.

**Mistakes get written down.** The repository carries a short list of the
traps this project has actually fallen into, each with the bug that taught
it. New work is checked against that list. It is the least glamorous thing
we do and it is why the same bug does not arrive twice.

## What is next

- **Polish, everywhere, in the direction above.** The avatar page and
  Discover are done; the profile, the Catalog and the Creator Hub are next.
- **More regions**, as the player base asks for them.
- **The Workspace**, our desktop creator, moving from private to the hands
  of the people who are already publishing.
- **Communities owning Worlds**, so a team can publish as itself rather
  than through whoever happened to press the button.
- **Discovery that learns**, replacing the hand-built shelves with
  recommendations drawn from what people actually come back to.

## What we are not doing

We are not launching a marketing push at an audience we have not finished
building for. We are not adding a feature because a competitor has it. We
are not shipping a control that implies something the platform does not
actually do - if a filter has nothing to offer, it says so rather than
offering eight choices that all find nothing.

And we are not trying to be a smaller Roblox. A smaller version of
somebody else's product is a worse version of it. The bet is that there is
a large audience who have outgrown the toybox and have nowhere obvious to
go, and that being the place that treats them like adults is worth more
than being one more grid of bright tiles.

Thank you for backing it. The next letter will have numbers in it.

**Staw**
Kobblon
