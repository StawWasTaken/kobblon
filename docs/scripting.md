# What creators write in

A decision for Creator, written before anything is built so it is made
deliberately. Nothing here is implemented yet, and it should not be until the
engine's single player loop is boring.

## The recommendation: Luau

Luau, the language Roblox built on top of Lua 5.1. It is MIT licensed, the
compiler and VM are open source, and it is the only mainstream language
designed from the start for exactly our problem: running code written by
strangers, at scale, inside somebody else's game.

**Why it wins here**

- **It was built for untrusted code.** No filesystem, no network, no OS, no
  `require` of arbitrary paths unless the host hands it one. Every other
  option is a general purpose language we would have to take things away
  from, and taking things away is where sandboxes leak.
- **It can be stopped.** Luau supports an interrupt callback, so an
  experience with `while true do end` in it costs that experience a frame
  budget rather than costing the player their session. That single feature is
  worth more than any language nicety.
- **Memory can be capped per script.** A creator cannot allocate the player's
  machine to death.
- **Gradual typing.** Optional annotations, which means a beginner writes
  untyped Lua and somebody serious gets type errors before they ship.
- **The people we want already know it.** Somebody arriving from Roblox
  brings their muscle memory. That is a real acquisition advantage and it
  costs us nothing.

**What it costs**

- It has to be compiled to WebAssembly and bound to the engine, which is real
  work: the VM, the bindings, and a bridge between Lua values and the
  engine's objects.
- Nobody on this project has done that bridge before, so budget for it being
  slower than it looks.

## The alternative, if that proves too heavy: QuickJS

JavaScript on QuickJS compiled to WebAssembly, not JavaScript in a worker.

- The engine is TypeScript, so there is no value marshalling between two type
  systems and no second set of API definitions to keep in step.
- QuickJS has an interrupt handler and a memory limit, so the two properties
  that matter are still there.
- Creators who know web JavaScript are immediately productive.

It loses on the thing that matters most commercially: a Roblox creator would
have to learn a new language to move here.

## What we are not doing

- **Plain JavaScript in a Worker or an iframe.** A worker can be terminated,
  which is not the same as being interrupted: you lose the whole script's
  state rather than pausing a frame, and one runaway script means a visible
  stall. `eval` in the page is not a sandbox at all.
- **WebAssembly directly.** Too low level to be a creator's language. It may
  be what Luau or QuickJS compiles to, which is a different matter.
- **A language of our own.** Writing a language is a decade of somebody's
  life, and it would still be worse than Luau in year three.
- **Visual scripting as the only way in.** Worth having later, on top of the
  text language rather than instead of it.

## The rules, whichever it is

These are not negotiable and they decide the design more than the syntax
does:

1. **A script gets the engine's API and nothing else.** No host globals, no
   platform internals, no way to reach Kobblon Core except through named
   capabilities the experience has been granted.
2. **Every script is interruptible and budgeted.** Time and memory, per
   script, enforced by the runtime.
3. **The server decides anything that matters.** Currency, inventory, badges,
   moderation: a script may ask, the server answers. A creator's code running
   on a player's machine is a suggestion, not an authority.
4. **The same code runs in Creator's test button and in the Launcher.** One
   runtime, the same sandbox, the same limits, or "it worked in Creator"
   becomes a support queue.
5. **Scripts are content.** They are stored, versioned and moderated like any
   other user-created thing, and a published experience's scripts are read
   only to everyone but their creator.

## When

After the engine can load a World, spawn K6, move, collide and animate
reliably, and after Creator can place and save objects. Scripting is the
thing that makes experiences worth playing, and it is also the thing that is
easiest to build badly in a hurry.
