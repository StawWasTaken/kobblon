import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * Kobblon's own icons.
 *
 * Staw drew these and uploaded them, and they arrived in two folders at the
 * repository root called `F-icons` and `workspace icons` - a space in a
 * served path, a name nothing explains, and nothing under `public/`, so none
 * of them were reachable from the site at all. They live at
 * `public/icons/ui` and `public/icons/workspace` now, and this is the one
 * place that knows their names.
 *
 * Why a registry rather than writing the path at each call: a typo in a path
 * is a picture that silently does not load, and there are fifty-eight of
 * them. A name that does not exist here is a build error instead.
 *
 * They are pictures and not glyphs, which has one consequence worth saying
 * out loud: they carry their own colours. `tone` exists for the places that
 * need one to match the text it sits beside - it paints the icon as a mask,
 * so the shape is kept and the colour is the one asked for. Left out, the
 * icon is drawn as Staw drew it.
 */

/** Everything in `public/icons/ui`. */
export const UI_ICONS = [
  'add-user', 'admin', 'announcement', 'avatar', 'brix', 'chatbubble',
  'check-user', 'checkmark', 'circle-user', 'click', 'clock-user',
  'cross-user', 'discount',
  'favourite-stroke', 'favourite', 'gear', 'heart-user', 'laurel-quest-stroke',
  'laurel-quest', 'microphone', 'mute-microphone', 'notification', 'people',
  'reaction-angry', 'reaction-happy-grin', 'reaction-heart-eyes',
  'reaction-laugh', 'reaction-sad', 'reaction-shocked', 'reaction-skull',
  'klub', 'klub-badge',
  'reaction-smile', 'reaction-sunglasses', 'reaction-winky-grin',
  'remove-user', 'report', 'search-user', 'send', 'thumbs-down-stroke',
  'thumbs-down', 'thumbs-up-stroke', 'thumbs-up', 'user', 'users', 'voice-user',
] as const

/**
 * Everything in `public/icons/workspace`.
 *
 * Drawn for the Workspace, and the website uses the ones that mean something
 * here too - a Decal in Create is the same thing as a Decal in the
 * Workspace, and two drawings of it would be two ideas of what it is.
 */
export const WORKSPACE_ICONS = [
  'cylinder', 'decal', 'group', 'light', 'meshpart', 'part', 'script',
  'sky', 'sound', 'soundservice', 'sphere', 'texture', 'truss', 'wedge',
  'world',
] as const

export type UiIcon = (typeof UI_ICONS)[number]
export type WorkspaceIcon = (typeof WORKSPACE_ICONS)[number]
export type KobIcon = UiIcon | `workspace/${WorkspaceIcon}`

/** Where one lives, which is the only place this is written down. */
export function iconUrl(name: KobIcon) {
  return asset(`/icons/${name.startsWith('workspace/') ? name : `ui/${name}`}.png`)
}

/**
 * The bits of a face that are not the face's colour.
 *
 * Staw: red in the eyes of the heart-eyes one, a pink tongue on the winky
 * one. Both are a problem at first glance, because these icons are one
 * silhouette and a mask takes one colour - the hearts are holes in the
 * face and the tongue is an island inside the mouth, neither is a shape
 * that can be addressed.
 *
 * So they were cut out of the originals into masks of their own, by what
 * they actually are in the picture: the hearts are the two enclosed holes
 * at eye height, the tongue is the one white island that is not joined to
 * the rest. Found rather than traced, which is why they line up exactly -
 * nothing was drawn twice.
 *
 * They are painted on top, and only when the face is being painted its own
 * colour. An unpressed face takes the colour of the sentence around it and
 * a red eye in a grey face is one detail shouting in a quiet row.
 */
const DETAILS: Partial<Record<UiIcon, { part: string; colour: string }[]>> = {
  'reaction-heart-eyes': [{ part: 'reaction-heart-eyes-eyes', colour: '#DF1F2D' }],
  'reaction-winky-grin': [{ part: 'reaction-winky-grin-tongue', colour: '#FF6F9C' }],
}

export function Icon({
  name, label, title, tone, style, className,
}: {
  name: KobIcon
  /**
   * Read out when the icon is the whole of the meaning. Left out, it is
   * hidden from a screen reader - which is right beside a word that already
   * says it, and wrong on its own.
   */
  label?: string
  /** The hover tooltip the browser draws, where a call site wants one. */
  title?: string
  /**
   * What colour to paint it.
   *
   * **`currentColor` by default, and that is the important part.** These
   * are white line art, so drawn as they are they vanish on a light
   * background - Staw, in capitals: "FOR THE BRIX YOU KEPT ITS WHITENESS
   * AND AGAINST WHITE BACKGROUND WE DONT SEE IT". Taking the colour of the
   * text they sit in is the only default that cannot do that, in either
   * theme, on any card.
   *
   * `tone={null}` draws the file as it is, colours and all. That is for
   * the ones that are pictures rather than glyphs: the Workspace's
   * coloured parts, and the reaction faces when they are meant to be
   * yellow rather than the colour of the sentence around them.
   */
  tone?: string | null
  style?: React.CSSProperties
  className?: string
}) {
  const url = iconUrl(name)
  /*
   * Undefined means "nobody said", which is the case that was wrong.
   * `null` is somebody saying "as drawn", which is a different answer and
   * has to stay available.
   */
  const paint = tone === undefined
    /*
     * The Workspace's are pictures - a green cylinder, a red part - and
     * painting one flat would throw away the thing that tells them apart
     * at a glance. They are as drawn unless a caller asks otherwise.
     */
    ? (name.startsWith('workspace/') ? null : 'currentColor')
    : tone

  /*
   * Painted as a mask rather than tinted with a filter. A filter has to be
   * worked out per colour and comes out approximately right; a mask keeps
   * the shape exactly and takes any colour the design system has.
   */
  if (paint) {
    const details = paint === 'currentColor' ? undefined : DETAILS[name as UiIcon]

    const face = (
      <span
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        title={title}
        className={cn('inline-block h-[1em] w-[1em] align-[-0.125em]', className)}
        style={{
          ...style,
          backgroundColor: paint === 'currentColor' ? 'currentColor' : paint,
          maskImage: `url(${url})`,
          WebkitMaskImage: `url(${url})`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />
    )

    if (!details) return face

    return (
      <span
        className={cn('relative inline-block h-[1em] w-[1em] align-[-0.125em]', className)}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        title={title}
        style={style}
      >
        {/*
          * The face itself, stretched to the wrapper rather than sized by
          * the class the caller passed - that class is on the wrapper now,
          * and sizing both would be the icon drawn at its own size inside
          * a box of the asked-for one.
          */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundColor: paint,
            maskImage: `url(${url})`,
            WebkitMaskImage: `url(${url})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
          }}
        />
        {details.map((one) => (
          <span
            key={one.part}
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundColor: one.colour,
              maskImage: `url(${asset(`/icons/ui/${one.part}.png`)})`,
              WebkitMaskImage: `url(${asset(`/icons/ui/${one.part}.png`)})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        ))}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      title={title}
      style={style}
      draggable={false}
      className={cn('inline-block h-[1em] w-[1em] select-none align-[-0.125em] object-contain', className)}
    />
  )
}
