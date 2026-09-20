/*
 * The pages the build can describe on its own.
 *
 * Kobblon is one document with a router inside it, and the robots that
 * make a link preview do not run the router: they read the HTML they are
 * given. So every address that is the same for everybody gets its own file
 * here, with its own title, description and picture written in. Addresses
 * that depend on who or what they point at (a Space, a Community, a person)
 * cannot be known at build time and fall through to 404.html, which carries
 * the site's own card.
 */

export const SITE = 'https://kobblon.com'
export const TAGLINE = 'make something nobody else has'
/** The currency's name, kept in step with src/lib/currency.ts by hand. */
const CURRENCY = 'Brix'

export const pages = [
  {
    path: '',
    title: 'Kobblon',
    description: `${TAGLINE}. Build your own Space, fill it with whatever you want, and let people in.`,
  },
  {
    path: 'discover',
    title: 'Discover Spaces on Kobblon',
    description: 'Spaces people are building and visiting right now. Walk into one and see what they did with it.',
  },
  {
    path: 'create',
    title: 'Kobblon Create',
    description: 'Upload images, sounds, video and fonts, sell what you make, and build Spaces out of what other people made.',
  },
  {
    path: 'create/marketplace',
    title: 'Creator Marketplace - Kobblon Create',
    description: 'Images, sounds, video and fonts made by people on Kobblon, used by their number so the credit sticks.',
  },
  {
    path: 'communities',
    title: 'Communities on Kobblon',
    description: 'Fan clubs, build teams and hobby corners, each with its own wall, its own ranks, its own events and its own Spaces.',
  },
  {
    path: 'people',
    title: 'People on Kobblon',
    description: 'Everybody on Kobblon. Search a name, a username, or the words somebody wrote about themselves.',
  },
  {
    path: 'login',
    title: 'Log in to Kobblon',
    description: 'Log in with your username and carry on building.',
  },
  {
    path: 'signup',
    title: 'Make a Kobblon account',
    description: `${TAGLINE}. Free, and it takes about a minute.`,
  },
  {
    path: 'terms',
    title: 'Terms of Service - Kobblon',
    description: 'The short version of the deal between you and Kobblon, written so it can actually be read.',
  },
  {
    path: 'privacy',
    title: 'Privacy - Kobblon',
    description: 'What Kobblon keeps about you, why, who can see it, and what you can do about it.',
  },
  {
    path: 'guidelines',
    title: 'Community Guidelines - Kobblon',
    description: 'What is fine on Kobblon, and what will get your things taken down.',
  },
  {
    path: 'policies',
    title: 'Policies - Kobblon',
    description: 'Every rule Kobblon has, split by subject, each with the day its wording last changed.',
  },
  {
    path: 'policies/moderation',
    title: 'Moderation and appeals - Kobblon',
    description: 'How a decision gets made, what can happen to an account, and how to have one looked at again.',
  },
  {
    path: 'policies/catalog',
    title: 'Catalog and uploads - Kobblon',
    description: 'What the Catalog is, what may go into it, how selling works, and how something comes back out.',
  },
  {
    path: 'policies/creators',
    title: 'Selling on Kobblon',
    description: 'Who can sell, how you get paid, and how a seller behaves.',
  },
  {
    path: 'policies/money',
    title: `${CURRENCY} and spending - Kobblon`,
    description: `What ${CURRENCY} are, how you get them, what you can do with them, and what happens when an account ends.`,
  },
  {
    path: 'policies/spaces',
    title: 'Spaces and experiences - Kobblon',
    description: 'What somebody else’s Space is allowed to do while you are inside it, and what it can never get to.',
  },
  {
    path: 'policies/copyright',
    title: 'Copyright - Kobblon',
    description: 'What to do when somebody else has put your work here, and what to do when yours went wrongly.',
  },
  {
    /*
     * Where an application sends somebody to sign in. These are real pages
     * rather than addresses the 404 handler happens to render: an application
     * opening a link that answers 404 is an application that looks broken,
     * and the query string it carries is the whole point of the visit.
     */
    path: 'creator/sign-in',
    title: 'Open Kobblon World Creator',
    description: 'Sign in on Kobblon to open World Creator. Kobblon applications never ask for your password.',
  },
  {
    path: 'launcher/sign-in',
    title: 'Open the Kobblon Launcher',
    description: 'Sign in on Kobblon to open the Launcher. Kobblon applications never ask for your password.',
  },
  {
    path: 'support',
    title: 'Support - Kobblon',
    description: 'Write to a person at Kobblon. Everything you send and everything we say back stays in one place.',
  },
]

/** Top level names the publish step has to copy and clear out. */
export const pageRoots = [...new Set(
  pages.map((page) => page.path.split('/')[0]).filter(Boolean),
)]

const escape = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Rewrites the shared card in a built document with one page's own. */
/**
 * Create wears its own mark, so a page under it carries that icon in the file
 * itself rather than only once the app has started. A tab should not have to
 * wait for JavaScript to know where it is.
 */
const iconFor = (path) => (
  String(path ?? '').startsWith('create') ? '/brand/favicon-create.png' : '/brand/favicon.png'
)

export function describe(html, page) {
  const url = `${SITE}/${page.path}${page.path ? '/' : ''}`
  const title = escape(page.title)
  const description = escape(page.description)

  return html
    .replace(
      /<link rel="icon" type="image\/png" href="[^"]*" \/>/,
      `<link rel="icon" type="image/png" href="${iconFor(page.path)}" />`,
    )
    .replace(
      /<meta property="og:type" content="[^"]*" \/>/,
      `<meta property="og:type" content="${escape(page.type ?? 'website')}" />`,
    )
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${url}" />`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${title}" />`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(
      /<meta name="twitter:title" content="[^"]*" \/>/,
      `<meta name="twitter:title" content="${title}" />`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*" \/>/,
      `<meta name="twitter:description" content="${description}" />`,
    )
    .replace(
      /<meta property="og:image:alt" content="[^"]*" \/>/,
      `<meta property="og:image:alt" content="${escape(page.imageAlt ?? page.title)}" />`,
    )
}
