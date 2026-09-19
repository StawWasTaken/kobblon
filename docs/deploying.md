# Deploying the parts that are not the site

The site itself deploys on its own: a push to main rebuilds it and GitHub
Pages serves it. Three things sit outside that, and all of them are done by
hand.

## The domain

`CNAME` in the repository root says `kobblon.com`, which is what tells GitHub
Pages to answer for it. The other half is at the registrar, Spaceship, where
the domain was bought, and it is four A records, four AAAA records and one
CNAME. The exact values are below, and GitHub prints the same ones under
**Settings → Pages** on the repository.

| Type  | Host  | Value |
| ----- | ----- | ----- |
| A     | `@`   | `185.199.108.153` |
| A     | `@`   | `185.199.109.153` |
| A     | `@`   | `185.199.110.153` |
| A     | `@`   | `185.199.111.153` |
| AAAA  | `@`   | `2606:50c0:8000::153` |
| AAAA  | `@`   | `2606:50c0:8001::153` |
| AAAA  | `@`   | `2606:50c0:8002::153` |
| AAAA  | `@`   | `2606:50c0:8003::153` |
| CNAME | `www` | `stawwastaken.github.io.` |

Four A records rather than one because Pages answers from four addresses, and
the AAAA records are the same thing over IPv6. The `www` record points at the
GitHub host rather than at an address, so it follows if those ever move.

Nothing else belongs on the apex: an old A record, a parking page or a
forwarding rule left behind will answer instead of Pages and the site will
look down.

After the records are in, on the repository: **Settings → Pages**, custom
domain `kobblon.com`, save, wait for the check to pass, then tick **Enforce
HTTPS**. The certificate takes a few minutes and cannot be issued until the
records resolve.

If `kobbleston.com` is still owned, point it at the new one with a
redirect at the registrar rather than a second custom domain: Pages answers
for one domain at a time.

### When Pages says a domain is improperly configured

`InvalidDNSError` means GitHub asked DNS for the record and did not get the
answer it wanted. It is almost never the repository: `CNAME` here says
`kobblon.com` and that half is done.

- **The complaint names `www`.** With the apex as the custom domain, GitHub
  checks `www` as well and warns while that record is missing. Add
  `CNAME www stawwastaken.github.io` and the warning clears.
- **The host field.** Registrars differ: some want `www`, some want the whole
  `www.kobblon.com`. Typing the whole thing into a field that appends the
  domain gives `www.kobblon.com.kobblon.com`, which resolves to nothing.
- **Something is already on that name.** A parking record, a forwarding rule
  or an old A record on `www` answers first. Delete it, then add the CNAME.
- **The nameservers.** Records only count if they are at whoever the domain's
  nameservers point to. If they are not Spaceship's, the records belong
  wherever they are.
- **Time.** Give it a few minutes, then press Save again on the custom domain
  to make GitHub look afresh.

Checking it yourself, from a terminal anywhere:

```
nslookup kobblon.com          # expect the four 185.199.x.153 addresses
nslookup www.kobblon.com      # expect stawwastaken.github.io
```

## Migrations

Everything in `supabase/migrations`, in order, applied in the SQL editor on
the Supabase dashboard or with the CLI. Every one of them is written to be
safe to run twice.

## Edge functions

There are three: `login` (username and password, looked up behind the service
role key), `og` (link previews for addresses that depend on what they point
at) and `discord` (tying a Discord account to a Kobblon one, which
`docs/discord.md` covers). None is required for the site to work: logging in
falls back to `login_email_for` in the database, previews fall back to the
files the build writes, and Settings says plainly when Discord is not set up.

### With the CLI

```
npm i -g supabase          # once
supabase login             # opens a browser
supabase link --project-ref sdnjdgeqrhzkyfyohcsz
supabase functions deploy login
supabase functions deploy og
supabase functions deploy discord
```

`supabase functions deploy` reads `supabase/functions/<name>/index.ts` from
this repository, so run it from the repository root. The service role key is
already there as an environment variable inside functions: it never needs to
be passed in, and it must never be put anywhere the browser can read.

### Without the CLI

On the dashboard: **Edge Functions** → **Deploy a new function** → name it
`login`, paste the contents of `supabase/functions/login/index.ts`, deploy.
Then the same for `og`.

### Checking it worked

The login page tells you which path it took by what it says when the details
are wrong:

- "Wrong username or password." means the lookup ran and refused. That is the
  real answer.
- "Too many attempts." comes from the database fallback, which allows ten
  tries per name in a quarter of an hour.

If logging in works but you want it going through the function, deploy it and
try again: the function is tried first every time, and the database is only
asked when it does not answer.

## The edge functions

`supabase/functions` holds the server side: signing an application in,
linking Discord, the login helper, the link cards. They deploy from
`.github/workflows/functions.yml` whenever one of them changes on main, or on
demand from the Actions tab.

That workflow needs two repository secrets, under Settings, Secrets and
variables, Actions:

| Secret | What it is |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | A personal access token from supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | The project reference, the part before `.supabase.co` |

The workflow fails loudly when either is missing rather than passing with
nothing deployed, because a green tick that deployed nothing is worse than a
red one.

**The functions also need their own secrets**, set on the project rather than
in the repository, under Edge Functions, Secrets:

| Secret | Used by | What it is |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | `app-signin` | Set by Supabase itself; nothing to do |
| `DISCORD_CLIENT_ID` | `discord` | From the Discord developer portal |
| `DISCORD_CLIENT_SECRET` | `discord` | The same, and never anywhere else |
| `DISCORD_STATE_SECRET` | `discord` | Any long random string of your own |

To deploy one by hand:

```
supabase functions deploy app-signin --project-ref <ref>
```

`verify_jwt` comes from `supabase/config.toml`, so it does not need a flag.
`app-signin` is `false` there on purpose: the application calling it has not
signed in yet, and the code it sends is the credential.
