# Building a Koblabs app the way Kobblon is built

Staw is handing you this because a Koblabs app is to look like Kobblon and
be written like Kobblon, and nothing else about it touches Kobblon: no
shared database, no shared account, no import from that repository. This
document is the whole of what carries over. It is self-contained - you do
not need the website's source and you will not be given it.

What you are building, Staw tells you himself. This is only *how*.

---

## Part one: the design

### The idea behind it, in one paragraph

Kobblon is a building platform, so its interface is built out of blocks. A
surface is a block: a 2px stroke all the way round, a 4px stroke along the
bottom edge, a rounded corner. That bottom edge is the front face of a
thing seen slightly from above, and it is the single strongest signal in
the system - get it right and a screen looks like Kobblon before a colour
has even loaded. Blur shadows are reserved for the few things that
genuinely float: a dialog, a menu, a toast. Nothing else casts one.

Two further rules carry all the colour meaning: **blue is the platform,
green is yes.** Green is never decoration. A green button is a button that
buys, confirms or goes in. Red means danger and nothing else.

### Setup

Tailwind 3.4, with the preset below in its own file and the tokens
imported as CSS. Vite + React 19 + TypeScript is what the website uses and
what these values were written against; nothing here needs React, but the
class names assume Tailwind.

```js
// design/preset.js
export default {
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          raised:  'rgb(var(--ink-raised) / <alpha-value>)',
          card:    'rgb(var(--ink-card) / <alpha-value>)',
          hover:   'rgb(var(--ink-hover) / <alpha-value>)',
          line:    'rgb(var(--ink-line) / <alpha-value>)',
          edge:    'rgb(var(--ink-edge) / <alpha-value>)',
        },
        white:      'rgb(var(--fg) / <alpha-value>)',
        'on-art':   'rgb(var(--on-art) / <alpha-value>)',
        muted:      'rgb(var(--muted) / <alpha-value>)',
        link:       'rgb(var(--link) / <alpha-value>)',
        chrome:     'rgb(var(--chrome) / <alpha-value>)',
        onbrand:    'rgb(var(--on-chrome) / <alpha-value>)',
        media:      'rgb(var(--media) / <alpha-value>)',
        field:      'rgb(var(--field) / <alpha-value>)',
        toast:   { DEFAULT: 'rgb(var(--toast) / <alpha-value>)',
                   fg:      'rgb(var(--toast-fg) / <alpha-value>)' },
        pick:    { DEFAULT: 'rgb(var(--pick) / <alpha-value>)',
                   on:      'rgb(var(--on-pick) / <alpha-value>)' },

        brand:  { DEFAULT: '#1B34E8', bright: '#3A50FF', deep: '#162382', ink: '#0d1349' },
        space:  { DEFAULT: '#1CAE71', bright: '#1CAE71', lift: '#35C98C', deep: '#0f6b45' },
        gem:    { DEFAULT: '#FFB224', bright: '#FFC85A', deep: '#B06E00', ink: '#4A2E00',
                  soft: 'rgb(255 178 36 / 0.16)' },
        craft:  { DEFAULT: '#7A4BD8', bright: '#9B74F0', deep: '#4E2C94',
                  soft: 'rgb(122 75 216 / 0.14)' },
        warn:   { DEFAULT: '#C2740A', bright: '#E08C17', deep: '#7A4705',
                  soft: 'rgb(194 116 10 / 0.14)' },
        danger: { DEFAULT: '#ff0033', bright: '#ff3355', deep: '#a3001f', ink: '#5c0012',
                  soft: 'rgb(255 0 51 / 0.14)' },
      },
      fontFamily: {
        display: ['bd-gravel-vf', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        nib: '8px', mark: '9px', tiny: '10px', mini: '11px', note: '13px', lede: '15px',
      },
      borderRadius: { xl2: '1.25rem' },
      borderWidth: { 3: '3px' },
      boxShadow: {
        pop:  '0 24px 60px -20px rgba(0,0,0,0.85)',
        lift: '0 8px 24px -8px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'pop-in':    { '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
                       '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'slide-up':  { '0%': { opacity: '0', transform: 'translateY(14px)' },
                       '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in':  { '0%': { opacity: '0', transform: 'translateX(24px)' },
                       '100%': { opacity: '1', transform: 'translateX(0)' } },
        'row-in':    { '0%': { opacity: '0', transform: 'translateY(10px)' },
                       '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'pop-in':   'pop-in 180ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-up': 'slide-up 420ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-in': 'slide-in 220ms cubic-bezier(0.2,0.8,0.2,1) both',
        'row-in':   'row-in 260ms cubic-bezier(0.2,0.8,0.2,1) both',
      },
    },
  },
}
```

```css
/* design/tokens.css - imported before anything else */
@layer base {
  :root, :root[data-theme='dark'] {
    color-scheme: dark;
    --ink: 16 16 18;
    --ink-raised: 22 22 26;
    --ink-card: 26 26 32;
    --ink-hover: 33 33 40;
    --ink-line: 58 60 74;
    --ink-edge: 10 10 13;
    --fg: 255 255 255;
    --on-art: 255 255 255;
    --muted: 139 139 153;
    --link: 159 173 255;
    --chrome: 22 35 130;
    --on-chrome: 255 255 255;
    --media: 13 19 73;
    --field: 11 17 63;
    --toast: 255 255 255;
    --toast-fg: 14 14 17;
    --pick: 27 52 232;
    --on-pick: 255 255 255;
  }

  :root[data-theme='light'] {
    color-scheme: light;
    --ink: 242 243 247;
    --ink-raised: 255 255 255;
    --ink-card: 255 255 255;
    --ink-hover: 234 236 243;
    --ink-line: 170 176 194;
    --ink-edge: 183 190 208;
    --fg: 20 19 18;
    --on-art: 255 255 255;
    --muted: 92 95 110;
    --link: 27 52 232;
    --chrome: 214 230 255;
    --on-chrome: 16 22 64;
    --media: 226 232 244;
    --field: 255 255 255;
    --toast: 18 18 22;
    --toast-fg: 255 255 255;
    --pick: 27 52 232;
    --on-pick: 255 255 255;
  }
}
```

### Why the surfaces are variables and the accents are not

Surfaces flip between dark and daylight; brand blue and Space green mean
something and must not. That split is the whole reason for the two files.

**`white` is the theme's foreground**, which is near-black in daylight.
Anything standing on a picture or on a solid brand colour wants `on-art`
instead, which does not flip - a photograph does not get lighter when
somebody turns the lights on. Getting this wrong is the single most common
mistake in this system: a title goes unreadable on its own banner the
moment the theme changes.

### The shapes

**A card.** `rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card`.
That is the house shape and almost every panel is it. Nested surfaces go
`bg-ink-raised`; the page behind them is `bg-ink`.

**A button.** A solid fill, a 2px border in that colour's own `deep`, and
a 5px bottom border that the press takes away:

```
bg-brand text-on-art hover:bg-brand-bright active:bg-brand
border-2 border-brand-deep border-b-[5px] active:border-b-2 active:mt-[3px]
```

Swap `brand` for `space` (yes, buy, confirm - rests on `bright`, hovers to
`lift`) or `danger`. The quiet second button in a pair is the same shape
with a grey fill, never a 1px outline: a pair where one is a block and the
other is text in a box does not read as a choice between two things. A
truly invisible button exists but is for toolbars, not for pairs.

**A lip is never black.** It is the button's own colour turned down, or the
stroke drawn thicker. A pale outline with a near-black edge under it reads
as a button with something underneath it rather than as a button.

**Corners** are `xl` and `2xl`, and nothing else. No arbitrary radii.

**Strokes** are 2px all round, whatever colour they are drawn in. If a
thing has a radius, a stroke and a fill, it carries the 4px bottom edge.

### The type

Two faces. `font-display` is the blocky pixel face and it is for titles,
numbers that matter and anything short and loud. `font-sans` is Inter and
it is for everything somebody reads. A heading is nearly always
`font-display font-extrabold leading-none`. Numbers that change get
`tabular-nums` so the layout does not jitter.

The small end of the scale is named rather than written as arbitrary
pixels: `text-nib` 8, `text-mark` 9, `text-tiny` 10, `text-mini` 11,
`text-note` 13, `text-lede` 15. Tailwind's own `text-xs` is 12 and still
exists between them.

`bd-gravel-vf` is Kobblon's licensed face and does **not** come with you.
Pick one blocky display face for Koblabs and put it in the same slot; the
system works on the contrast between a blocky display face and a plain
text face, not on that specific font.

### The accents, and what each is for

- **brand** - the platform, links, the thing being pointed at.
- **space** - yes. Confirm, buy, go in, on, online, done.
- **gem** - anything earned: XP, streaks, rewards. If it glows, somebody
  earned it. Nothing merely important may wear it.
- **craft** - the workshop: scripting, building, making.
- **warn** - careful. Never a button on its own.
- **danger** - destructive, and nothing else.
- **muted** - secondary text, every time. Not `white/50`.

Six accents is the whole palette. A colour the system does not have gets
added to the preset with a reason, or it does without - reaching into
Tailwind's default palette for a fuchsia is how an interface stops looking
like one product.

### Motion

Short and decisive: 180-260ms on `cubic-bezier(0.2,0.8,0.2,1)`. A list
staggers in with `row-in` and an inline delay rather than appearing all at
once. Anything that moves respects `prefers-reduced-motion`; that is not
optional and it is two lines.

---

## Part two: how to write the code

These are Staw's standing rules. They are about the code reading as
something a person wrote and thought about, which is the whole point.

### Comments

**Never comment what the line already says.** `// set the title` above
something that sets the title is noise, and a file full of it reads as
generated. Delete the whole class of them.

**Comment why, and comment the thing that would catch somebody out.** The
good comment is the one that says "this is ordered by date and not by id
because two rows can share a second", or "this is checked after the await
and not before, because the thing it checks can change during it". Write
them in prose, in full sentences. When a decision was argued over and
settled, write the decision down with the reason - that is what stops the
next person undoing it.

**No section-divider banners made of hashes, no `TODO` left behind, no
`// eslint-disable` without a sentence saying why.** No "Step 1 / Step 2"
narration of a function's own body.

### Words

- **No em dashes.** Use a hyphen with spaces, or a semicolon.
- Plain words over grand ones. "What it costs", not "Pricing information".
- Never the word "seamless", "robust", "leverage", "delve", "elevate".
- Buttons say what they do: "Pay in Brix", "Claim the free year", "Never
  mind". Not "Submit", "Confirm", "OK".
- When something cannot be done, say so in one sentence, plainly, and say
  what would make it possible.

### Honesty in the interface

**No fake functionality.** A control that implies something the program
does not do is worse than no control at all. No settings toggle that is
not read, no filter that does not filter, no number that is a placeholder.
If a feature is half built, ship the half that works and say the other
half is not there - in the interface, not only in a comment.

If you catch yourself about to write a list of things the app will do one
day, next to the two things it does today, cut the list.

### Building things properly

Build the finished thing, not a skeleton with a note saying to fill it in.
A page is done when somebody could use it: the empty state, the loading
state, the error state, the keyboard, the phone width. A half-page that
"shows the idea" has to be thrown away and rebuilt.

One system, not many: one button component, one card shape, one dialog.
The second version of anything is how two parts of the same app start
disagreeing.

### Checking your own work

- **Look at it.** Build it, open it, screenshot it, and actually look at
  the screenshot. A change that is correct and invisible is a change that
  is not finished.
- **Prove the refusals, not just the happy path.** If something is meant
  to be refused, make it be refused in front of you. A guard nobody has
  watched say no has not been tested.
- **Report what happened, including when it failed.** If a check was
  wrong and you corrected it, say that out loud rather than quietly
  rewriting it.

### Four traps, learned the hard way on Kobblon

These are worth having in front of you, because all four present as
"renders correctly, nothing throws, and it is wrong".

1. **A value captured before the thing that decides it exists.** Anything
   read once and kept, where what decides it can change afterwards. The
   fix is to ask at the moment of use. The check is never "is the current
   value right" - it is "does a call made afterwards reach the new thing".

2. **A guard that watches the wrong event.** The guard exists, it is
   checked, it has a comment explaining why it is needed, and it watches
   something that does not change when it should. Name every event that
   ought to invalidate it and show the guard moving on each.

3. **A privileged action undone by a check on who asked.** A function with
   the rights to do something, and a rule over the same data whose test is
   identity. Both correct alone; nothing throws; the number simply does
   not change. Read the value back afterwards, under a real identity, and
   show it holds.

4. **A rule guarding a door nobody can open.** The permission is written
   and the access underneath it was never granted. It looks carefully
   protected and is simply unreachable. Whatever the equivalent is in
   your stack, check it as the real caller rather than as the owner.

### Secrets

Nothing private goes in code that ships: no API keys, no tokens, no
passwords, no signing secrets, not in a committed file and not in the
client. If the app needs a key, it reads it from the environment and the
file that holds it is ignored by git. Never paste one into a chat.

---

## Part three: the handoff habit

Kobblon runs two sessions and every batch of work ends with a written
round - what changed, why, what it means for anybody building against it,
and what is deliberately not done. Even alone, keep the habit for anything
that changes meaning rather than appearance: a changed signature, a new
field, a flipped direction. Future-you has no diff.

Name the things that are not done as plainly as the things that are.
