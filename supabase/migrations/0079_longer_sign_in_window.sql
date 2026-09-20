-- A sign in code lasts long enough to be used.
--
-- Two minutes was written for the time between pressing a button and an
-- application reading a link. What actually happens is a cold start, measured
-- at 55 seconds on a developer's machine before the renderer, the splash and
-- resuming an account, and before Windows asks "open this app?" and waits for
-- somebody to read it and click.
--
-- Ten minutes costs nothing. The code is single use and it is `claimed_at`
-- that protects it: the first claim takes it in one statement and every claim
-- after that gets nothing. The window only decides how long somebody has
-- before they must press the button again, and being told to sign in twice
-- because an installer was slow is a worse outcome than a longer window.

alter table public.app_sign_in_codes
  alter column expires_at set default now() + interval '10 minutes';
