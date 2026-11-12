begin;

/*
 * One search path, finished off.
 *
 * `check:migrations` has been reporting this since 0336 landed:
 * `claim_guest_account` is `security definer` and pinned to `public` alone,
 * while every other function in that file is pinned to `public, extensions`.
 *
 * It has not broken anything, and the reason it has not is worth writing
 * down rather than leaving as luck. Nothing in its own body reaches for
 * pgcrypto; what it calls - `check_username`, the guard on `profiles` - sets
 * its own search path and so looks things up under that, not under this
 * one. So the function works, and the check is still right to flag it: the
 * day a line in here wants `gen_random_uuid` or a `digest`, it will not find
 * it, and the failure will read as "claiming a guest account is broken"
 * rather than as a search path.
 *
 * `alter function` rather than `create or replace`, deliberately. Re-stating
 * forty lines of body to change the line above them is how two versions of a
 * function end up in the history with one word different between them.
 */
alter function public.claim_guest_account(text, text, date, text, text)
  set search_path = public, extensions;

commit;
