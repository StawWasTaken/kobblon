/*
 * Asking Kobby a question about the rules.
 *
 * Staw: "make that in the policy page theres a bar to ask about the
 * policies or certain things about kobblon, and its kobby who answers
 * based on whats written in our policies and the blocked words, etc of
 * the staff console".
 *
 * The answering happens in the `moderate` function; this file is the two
 * things the database has to own for it.
 *
 * **One: a record.** Every question asked and whether it was answered.
 * Not for curiosity - a page that hands a language model to the open
 * internet has to be readable afterwards, both to see what people
 * actually come to the rules confused about and to see it being abused
 * the day it is.
 *
 * **Two: a ceiling.** The Policies page is public, so this door is open
 * to anybody holding the publishable key, which is everybody. The limit
 * is counted here rather than in the function because a function runs in
 * however many isolates the platform feels like starting, and a counter
 * that lives in one of them is a counter per isolate.
 *
 * The fingerprint is whatever the function can tell one asker from
 * another by - a signed-in account, or a hash of the address it came
 * from. The raw address is never written: it is somebody's location, it
 * is of no use here, and a thing not stored cannot leak.
 *
 * **Nothing is granted to `anon` or `authenticated` on purpose.** The
 * table is written only by the function under the service role. That is
 * not a forgotten grant - the fourth trap in CLAUDE.md is a table nobody
 * can reach, and the difference is that this one is meant to be
 * unreachable: it holds other people's questions, and a browser has no
 * business reading it. Staff read it through `kobby_question_log`, which
 * checks `is_admin` the way the rest of the console does.
 */

begin;

create table if not exists public.kobby_questions (
  id bigserial primary key,
  /* Null when nobody was signed in, which is most of them. */
  asked_by uuid references auth.users(id) on delete set null,
  /* The account, or a hash of the address. Never an address. */
  fingerprint text not null,
  question text not null,
  /* False when the ceiling turned it away, so the log shows the pressure
     and not just what got through. */
  answered boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists kobby_questions_by_asker
  on public.kobby_questions (fingerprint, created_at desc);
create index if not exists kobby_questions_lately
  on public.kobby_questions (created_at desc);

alter table public.kobby_questions enable row level security;

revoke all on public.kobby_questions from anon, authenticated;
revoke all on sequence public.kobby_questions_id_seq from anon, authenticated;

/*
 * Ask and be counted, in one statement.
 *
 * Counting and then inserting is two statements and a race: two questions
 * arriving together both read nine, both write, and the tenth and
 * eleventh both get through. This counts what is already there and writes
 * the row in the same breath, and returns whether this one is allowed.
 *
 * The refused question is still written. A limit you cannot see being hit
 * is a limit that gets blamed on the model.
 */
create or replace function public.kobby_ask_allowed(
  in_fingerprint text, in_question text,
  in_user uuid default null, in_ceiling int default 12
)
returns boolean language plpgsql security definer
set search_path = public, extensions as $$
declare
  lately int;
  may boolean;
begin
  if coalesce(trim(in_fingerprint), '') = '' then
    raise exception 'An asker has to be named.';
  end if;

  select count(*) into lately
    from public.kobby_questions
   where fingerprint = in_fingerprint
     and created_at > now() - interval '1 hour';

  may := lately < greatest(in_ceiling, 1);

  insert into public.kobby_questions (asked_by, fingerprint, question, answered)
  values (
    in_user,
    in_fingerprint,
    left(coalesce(in_question, ''), 500),
    may
  );

  return may;
end $$;

revoke all on function public.kobby_ask_allowed(text, text, uuid, int) from public, anon, authenticated;

/*
 * What staff see. The console reads this rather than the table, so the
 * admin test is in one place and the table stays unreachable.
 */
create or replace function public.kobby_question_log(how_many int default 100)
returns table (
  id bigint, asked_by uuid, question text, answered boolean, created_at timestamptz
) language plpgsql security definer
set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    raise exception 'Only Kobblon reads this.';
  end if;

  return query
    select q.id, q.asked_by, q.question, q.answered, q.created_at
      from public.kobby_questions q
     order by q.created_at desc
     limit greatest(least(coalesce(how_many, 100), 500), 1);
end $$;

grant execute on function public.kobby_question_log(int) to authenticated;

commit;
