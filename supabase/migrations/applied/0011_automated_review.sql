-- Automated content review.
--
-- This is a deterministic filter, not a model: a term list plus a set of
-- pattern rules, run inside the database so a decision lands the moment
-- something is submitted rather than sitting in a queue. It screens
-- usernames, Space names and descriptions, uploads and chat.
--
-- Terms live in a table so the rules can change without touching code.

create type public.screen_decision as enum ('ok', 'review', 'block');

create table public.moderation_terms (
  id bigserial primary key,
  pattern text not null unique,
  decision public.screen_decision not null default 'block',
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.moderation_terms enable row level security;
create policy moderation_terms_read on public.moderation_terms for select
  using (public.is_moderator());

-- A starting list. `pattern` is a regular expression matched case
-- insensitively against text with its letter substitutions already undone.
insert into public.moderation_terms (pattern, decision, reason) values
  ('(^|[^a-z])(fuck|shit|bitch|cunt|whore|slut)([^a-z]|$)', 'block', 'Strong language'),
  ('(^|[^a-z])(nigg|f[a4]gg|tr[a4]nny|ret[a4]rd)', 'block', 'Slur'),
  ('(^|[^a-z])(kys|kill\s*your\s*self|hang\s*your\s*self)', 'block', 'Telling someone to hurt themselves'),
  ('(^|[^a-z])(rape|molest|pedo|paedo|cp|loli|shota)', 'block', 'Sexual content involving minors or assault'),
  ('(^|[^a-z])(porn|xxx|nsfw|onlyfans|nude[sz]?|hentai)', 'block', 'Sexual content'),
  ('(^|[^a-z])(discord\.gg|t\.me|bit\.ly|tinyurl)', 'review', 'Off site link'),
  ('(^|[^a-z])(free\s*(robux|pixels|money)|giveaway\s*scam|click\s*here\s*now)', 'block', 'Scam'),
  ('(^|[^a-z])(admin|moderator|staff|official|kobbleston)([^a-z]|$)', 'review', 'Sounds official'),
  ('(https?://|www\.)', 'review', 'Contains a link')
on conflict (pattern) do nothing;

/**
 * Flattens the tricks people use to slip a word past a filter: letter for
 * number substitutions, repeated letters, and padding characters.
 */
create or replace function public.normalize_for_screening(input text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             translate(lower(coalesce(input, '')),
                       '0134578@$!|', 'oleastbasi'),
             '(.)\1{2,}', '\1\1', 'g'),
           '[^a-z0-9\s:/.]+', ' ', 'g');
$$;

/** The decision and the reason behind it, for one piece of text. */
create or replace function public.screen_text(input text)
returns table (decision public.screen_decision, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  flattened text := public.normalize_for_screening(input);
  raw text := lower(coalesce(input, ''));
  hit record;
begin
  if coalesce(trim(input), '') = '' then
    return query select 'ok'::public.screen_decision, null::text;
    return;
  end if;

  for hit in
    select t.decision, t.reason
      from public.moderation_terms t
     where flattened ~* t.pattern or raw ~* t.pattern
     order by (t.decision = 'block') desc
     limit 1
  loop
    return query select hit.decision, hit.reason;
    return;
  end loop;

  return query select 'ok'::public.screen_decision, null::text;
end;
$$;

grant execute on function public.screen_text, public.normalize_for_screening to authenticated;

-- ---------------------------------------------------------------- usernames

/** Live check for the signup form, so a name is refused before submitting. */
create or replace function public.check_username(candidate text)
returns table (ok boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  verdict record;
begin
  if candidate !~ '^[a-zA-Z0-9_]{3,20}$' then
    return query select false, 'Letters, numbers and underscores. 3 to 20 characters.';
    return;
  end if;

  if exists (select 1 from public.profiles where lower(username) = lower(candidate)) then
    return query select false, 'That name is taken.';
    return;
  end if;

  select * into verdict from public.screen_text(candidate);
  if verdict.decision <> 'ok' then
    return query select false, coalesce(verdict.reason, 'That name is not allowed.');
    return;
  end if;

  return query select true, null::text;
end;
$$;

grant execute on function public.check_username to anon, authenticated;

-- The real guard. A name that gets past the form still has to get past this.
create or replace function public.screen_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  select * into verdict from public.screen_text(new.username);
  if verdict.decision = 'block' then
    raise exception 'That username is not allowed: %', verdict.reason;
  end if;

  select * into verdict from public.screen_text(new.display_name);
  if verdict.decision = 'block' then
    raise exception 'That display name is not allowed: %', verdict.reason;
  end if;

  select * into verdict from public.screen_text(new.bio);
  if verdict.decision = 'block' then
    raise exception 'That bio is not allowed: %', verdict.reason;
  end if;

  return new;
end;
$$;

create trigger profiles_screen
  before insert or update of username, display_name, bio on public.profiles
  for each row execute function public.screen_profile();

-- -------------------------------------------------------------------- spaces

create or replace function public.screen_space()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  select * into verdict from public.screen_text(new.name);
  if verdict.decision = 'block' then
    raise exception 'That Space name is not allowed: %', verdict.reason;
  end if;

  select * into verdict from public.screen_text(new.description);
  if verdict.decision = 'block' then
    raise exception 'That description is not allowed: %', verdict.reason;
  end if;

  return new;
end;
$$;

create trigger spaces_screen
  before insert or update of name, description on public.spaces
  for each row execute function public.screen_space();

-- ------------------------------------------------------------------ uploads
--
-- Uploads are decided the moment they are submitted. Admin uploads skip the
-- check entirely. Everything else is screened on its name and description and
-- on whether the file itself matches the kind it claims to be; only the cases
-- the filter is unsure about are left for a human.

create or replace function public.expected_extensions(kind public.asset_kind)
returns text[] language sql immutable as $$
  select case kind
    when 'image' then array['png','jpg','jpeg','gif','webp']
    when 'audio' then array['mp3','ogg','wav']
    when 'video' then array['mp4','webm']
    when 'font'  then array['woff2','woff','ttf','otf']
    when 'model' then array['glb','gltf']
  end;
$$;

create or replace function public.review_new_asset()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
  worst public.screen_decision := 'ok';
  note text;
  extension text := lower(split_part(new.file_path, '.', array_length(string_to_array(new.file_path, '.'), 1)));
begin
  -- Kobbleston's own uploads are trusted and go straight up.
  if exists (select 1 from public.profiles p where p.id = new.creator_id and p.is_admin) then
    new.status := 'approved';
    new.reviewed_at := now();
    return new;
  end if;

  if not (extension = any(public.expected_extensions(new.kind))) then
    new.status := 'rejected';
    new.review_note := 'That file is not a ' || new.kind::text || '.';
    new.reviewed_at := now();
    return new;
  end if;

  for verdict in
    select * from public.screen_text(new.name)
    union all
    select * from public.screen_text(new.description)
  loop
    if verdict.decision = 'block' then
      worst := 'block';
      note := verdict.reason;
      exit;
    elsif verdict.decision = 'review' then
      worst := 'review';
      note := coalesce(note, verdict.reason);
    end if;
  end loop;

  if worst = 'block' then
    new.status := 'rejected';
    new.review_note := note;
    new.reviewed_at := now();
  elsif worst = 'review' then
    -- Held for a person to look at, which is what pending now means.
    new.status := 'pending';
    new.review_note := note;
  else
    new.status := 'approved';
    new.reviewed_at := now();
  end if;

  return new;
end;
$$;

create trigger assets_review
  before insert on public.assets
  for each row execute function public.review_new_asset();

-- Messages are screened as they are sent.
create or replace function public.screen_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  verdict record;
begin
  select * into verdict from public.screen_text(new.body);
  if verdict.decision = 'block' then
    raise exception 'That message was not sent: %', verdict.reason;
  end if;
  return new;
end;
$$;

create trigger messages_screen
  before insert on public.messages
  for each row execute function public.screen_message();
