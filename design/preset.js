/**
 * Kobblon's design system, as a Tailwind preset.
 *
 * The website extends this, and so do the Launcher and Creator. Everything
 * that carries meaning is in here: brand blue, Space green, the one red, the
 * surfaces, the type, the shadows and the motion. A client that wants a
 * colour Kobblon does not have is a client that has stopped looking like
 * Kobblon, so it adds it here or it does without.
 *
 * The surfaces come from CSS variables defined in `design/tokens.css`, which
 * has to be imported too. Preset without tokens renders unstyled surfaces.
 */
export default {
  theme: {
    extend: {
      colors: {
        /*
         * The surfaces and the foreground come from variables so the whole
         * interface can be light or dark. Brand blue and Space green do not
         * move: they mean something.
         */
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          raised: 'rgb(var(--ink-raised) / <alpha-value>)',
          card: 'rgb(var(--ink-card) / <alpha-value>)',
          hover: 'rgb(var(--ink-hover) / <alpha-value>)',
          line: 'rgb(var(--ink-line) / <alpha-value>)',
          /*
           * The side face of a brick.
           *
           * Darker than the card it belongs to, and used as a solid
           * displaced edge rather than as a blur - see `shadow.lip` below
           * for why that distinction is the whole design.
           */
          edge: 'rgb(var(--ink-edge) / <alpha-value>)',
        },
        white: 'rgb(var(--fg) / <alpha-value>)',
        /*
         * `white` is the theme's foreground: it is white in the dark and
         * near-black in daylight, which is what a page wants. Anything
         * standing on a picture or on a solid brand colour wants the other
         * thing - those surfaces do not flip, so `text-on-art` does not
         * either.
         */
        'on-art': 'rgb(var(--on-art) / <alpha-value>)',
        /* The dark that goes on a fixed white chip standing on art. */
        'art-ink': 'rgb(var(--art-ink) / <alpha-value>)',
        link: 'rgb(var(--link) / <alpha-value>)',
        /*
         * The bar and the rail. In the dark they are deep Kobbleston blue
         * with white on top; in daylight they are a pale blue with dark text,
         * the way the rest of the interface flips.
         */
        chrome: 'rgb(var(--chrome) / <alpha-value>)',
        /*
         * The toast in the corner, which is inverted on purpose: white on
         * the dark interface and black in daylight, so that something the
         * platform says is never mistaken for part of the page.
         */
        toast: {
          DEFAULT: 'rgb(var(--toast) / <alpha-value>)',
          fg: 'rgb(var(--toast-fg) / <alpha-value>)',
        },
        /* What a picture or a player sits on before it has loaded. */
        media: 'rgb(var(--media) / <alpha-value>)',
        /* The search field that sits on the chrome. */
        field: 'rgb(var(--field) / <alpha-value>)',
        onbrand: 'rgb(var(--on-chrome) / <alpha-value>)',
        /* The entry you are on in the rail. Brand blue in the blue
           appearance and the season's own deep colour in the others. */
        pick: {
          DEFAULT: 'rgb(var(--pick) / <alpha-value>)',
          on: 'rgb(var(--on-pick) / <alpha-value>)',
        },
        brand: {
          DEFAULT: '#1B34E8',
          bright: '#3A50FF',
          deep: '#162382',
          ink: '#0d1349',
        },
        /*
         * Yes, and the thing you are buying.
         *
         * Two separate corrections landed on this scale. The first moved it
         * down a step so white on the resting fill passes AA - the buy
         * buttons used to be drawn on a green that scored 2.86 against
         * white, the only failing pair in the whole palette. The second is
         * below: the green it moved to was desaturated and read as washed.
         *
         * `bright` is the hover and nothing rests on it, because green has
         * no headroom above the AA ceiling: a hover that lightens, and Staw
         * wants green to behave like blue, necessarily lands under it. That
         * is a half second under a pointer during which nothing is decided;
         * a resting fill is where a label has to be readable, and that one
         * is.
         */
        /*
         * Green is yes.
         *
         * These are the values Staw drew and they are not to be retuned. A
         * round went and replaced them with a fully saturated green because
         * "the green buttons look semi transparent" was read as a problem
         * with the colour; it was not. Staw: "youve literally changed the
         * colours of the green - i want the old colour back, the
         * transparent issue is that when you dont hover them they look
         * transparent and dont anymore when you hover them." The fault was
         * which of these two the button rests on, and that is fixed in
         * `Button.tsx`, not here.
         */
        space: {
          DEFAULT: '#148556',
          /** What a green button rests on, and green words on a dark card. */
          bright: '#1CAE71',
          /** Brighter still: the hover, so green lifts the way blue does. */
          lift: '#35C98C',
          /** The lip under a green button. */
          deep: '#0f6b45',
        },
        /*
         * The gem, and it is the whole of the reward language.
         *
         * One accent with one job: XP, levels, streaks, quests, anything
         * earned. Nothing that is merely important may wear it, which is
         * what stops a gamified interface turning into confetti - if it
         * glows, somebody earned it. Warm, because the rest of the base is
         * warm stone and a cool accent on warm stone reads as a different
         * product's colour.
         *
         * It is deliberately not `warn`: an amber that means "careful" and
         * an amber that means "you levelled up" cannot be the same amber,
         * so `warn` below is the deeper ochre and this one is the lit one.
         */
        gem: {
          DEFAULT: '#FFB224',
          bright: '#FFC85A',
          deep: '#B06E00',
          ink: '#4A2E00',
          soft: 'rgb(255 178 36 / 0.16)',
        },
        /*
         * The maker accent: violet, and it belongs to the workshop.
         *
         * Scripting, building, meshes and builds - the things somebody
         * makes rather than earns or is warned about. It exists because
         * the forum and the asset kinds both need a set of hues that can
         * be told apart at a glance, and before this the two of them were
         * reaching into Tailwind's own palette for fuchsia, cyan, violet
         * and emerald: four colours Kobblon does not have, in two places,
         * meaning nothing in either.
         *
         * One colour, one job, same as the rest.
         */
        craft: {
          DEFAULT: '#7A4BD8',
          bright: '#9B74F0',
          deep: '#4E2C94',
          soft: 'rgb(122 75 216 / 0.14)',
        },
        /* Careful, and nothing else. Never a button on its own. */
        warn: {
          DEFAULT: '#C2740A',
          bright: '#E08C17',
          deep: '#7A4705',
          soft: 'rgb(194 116 10 / 0.14)',
        },
        muted: 'rgb(var(--muted) / <alpha-value>)',
        /*
         * The one red on Kobbleston: danger, and nothing else.
         *
         * `bright` and `deep` so a red button can be built exactly like a
         * blue or a green one - same solid fill, same hover, same hard edge
         * underneath that the press takes away. It used to be the only
         * tinted outline button on the site, which made the one button that
         * should look most deliberate look the least like the others.
         */
        danger: {
          DEFAULT: '#ff0033',
          bright: '#ff3355',
          deep: '#a3001f',
          ink: '#5c0012',
          soft: 'rgb(255 0 51 / 0.14)',
        },
      },
      fontFamily: {
        /*
         * 'Twemoji' sits after the text face and before the system in both
         * stacks. A text face has no emoji in it, so an emoji character
         * falls through to Twemoji and a letter never reaches it - which is
         * how the whole site gets one set of emoji without anything being
         * wired to it. It has to be in every stack: one that leaves it out
         * is a corner of Kobblon drawing the operating system's emoji
         * beside Twemoji elsewhere on the same screen.
         */
        display: ['bd-gravel-vf', 'Twemoji', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Twemoji', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
      /*
       * Three, because two is not enough and Tailwind only ships 0, 1, 2,
       * 4 and 8. `border-2` is the house stroke; `border-[3px]` is the lip
       * under a button, which predates all of this and stays.
       *
       * The house stroke is the width, not a colour. The first pass only
       * thickened `border-ink-line` and left every `border-white/10` at a
       * hairline, which is most of the landing page and most of the At
       * Kobblon side - so the system was real on the app and absent on the
       * two pages a stranger sees first. Staw: "our new design system must
       * apply to everywhere, including landing page & at kobblon pages."
       * Every all-round stroke is 2px now whatever it is drawn in, and
       * anything card-shaped (a radius, a stroke and a fill) carries the
       * 4px bottom edge. Corners are `xl` and `2xl`; there is no `3xl` and
       * no arbitrary radius left in the codebase.
       */
      borderWidth: { 3: '3px' },
      boxShadow: {
        /*
         * **There is one shadow left, and it is not for cards.**
         *
         * Staw: "instead of thin strokes, we want thick strokes, and a more
         * gamification about stuff here on the website ... for kobblon we
         * want something quite original and unique (to detach ourselves a
         * bit from the roblox image)".
         *
         * Kobblon is a building platform - the currency is Brix, the people
         * are blocky, the display face is blocky - so the gamified language
         * here is solidity rather than the softness and bounce that every
         * gamified app reaches for, and that is where a Duolingo comparison
         * would be fair. Every surface is a block: a 2px stroke all round
         * and a 4px stroke along the bottom, which is the front face of a
         * thing seen slightly from above.
         *
         * The first attempt at that was a hard offset shadow with no blur -
         * literally a brick's side face - and it was built, drawn and thrown
         * away, which is worth writing down so nobody builds it again. **On
         * a page this close to black there is nothing darker to put under a
         * card.** Beside a plain 2px stroke it was indistinguishable; the
         * screenshot of the two is why this is a border and not a shadow.
         * `--ink-edge` survives as a token the applications can reach for,
         * but nothing on the website draws with it any more. It was the
         * lip under the `subtle` button, and that was the one shape on the
         * site whose two strokes were different colours - a pale grey
         * outline with a near-black bottom edge. Staw: "i dont like the
         * black shadow it feels weird with the stroke around it". A lip is
         * the stroke turned thicker, or the fill turned down; it is never
         * black.
         *
         * So a blur is now reserved for the one thing that genuinely floats
         * over the page - a menu, a dialog, the toast - which is not a block
         * on a surface and should not pretend to be.
         */
        pop: '0 24px 60px -20px rgba(0,0,0,0.85)',
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        /* A panel coming in from the right edge: drawers and slide-overs. */
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        /*
         * One row of a list arriving. Used with an inline animation-delay
         * so a queue staggers in rather than appearing all at once - which
         * is the difference between a list that loaded and a list that is
         * being dealt to you.
         */
        'row-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        /*
         * One step of a form replacing another. Two of them, because a step
         * going back must not look like a step going forward - that is the
         * whole of why a wizard feels like a place rather than a stack of
         * screens.
         */
        'step-next': {
          '0%': { opacity: '0', transform: 'translateX(28px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'step-back': {
          '0%': { opacity: '0', transform: 'translateX(-28px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 currentColor', opacity: '0.7' },
          '100%': { boxShadow: '0 0 0 7px transparent', opacity: '0' },
        },
        'ticker': { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-50%)' } },
        'bob': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'draw': { '0%': { strokeDashoffset: '1200' }, '100%': { strokeDashoffset: '0' } },
        // Two runs of the same row, so half a loop lands where it started.
        'drift': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(calc(-50% - 0.625rem))' } },
      },
      animation: {
        'pop-in': 'pop-in 180ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-up': 'slide-up 420ms cubic-bezier(0.2,0.8,0.2,1) both',
        'slide-in': 'slide-in 220ms cubic-bezier(0.2,0.8,0.2,1) both',
        'row-in': 'row-in 260ms cubic-bezier(0.2,0.8,0.2,1) both',
        'step-next': 'step-next 240ms cubic-bezier(0.2,0.8,0.2,1) both',
        'step-back': 'step-back 240ms cubic-bezier(0.2,0.8,0.2,1) both',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        bob: 'bob 4s ease-in-out infinite',
        drift: 'drift 48s linear infinite',
        ticker: 'ticker 60s linear infinite',
      },
    },
  }
}
