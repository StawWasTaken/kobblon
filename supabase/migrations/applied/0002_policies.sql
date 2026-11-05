-- Row level security. Everything user-facing is denied by default and opened
-- back up one policy at a time.

alter table public.profiles            enable row level security;
alter table public.spaces              enable row level security;
alter table public.space_visits        enable row level security;
alter table public.space_updates       enable row level security;
alter table public.space_likes         enable row level security;
alter table public.friendships         enable row level security;
alter table public.conversations       enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages            enable row level security;
alter table public.notifications       enable row level security;
alter table public.reports             enable row level security;
alter table public.moderation_actions  enable row level security;
alter table public.activity_events     enable row level security;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create or replace function public.in_conversation(conv uuid, who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.user_id = who
  );
$$;

-- profiles: public read of the public-facing columns, self-write only.
create policy profiles_read on public.profiles for select using (not is_suspended or public.is_moderator());
create policy profiles_insert_self on public.profiles for insert with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- spaces: published spaces are public; owners see and edit their drafts.
create policy spaces_read_published on public.spaces for select
  using ((is_published and not is_removed) or owner_id = auth.uid() or public.is_moderator());
create policy spaces_insert_own on public.spaces for insert with check (owner_id = auth.uid());
create policy spaces_update_own on public.spaces for update
  using (owner_id = auth.uid() and not is_removed) with check (owner_id = auth.uid());
create policy spaces_delete_own on public.spaces for delete using (owner_id = auth.uid());

create policy space_updates_read on public.space_updates for select
  using (exists (select 1 from public.spaces s where s.id = space_id
                 and ((s.is_published and not s.is_removed) or s.owner_id = auth.uid())));
create policy space_updates_insert_owner on public.space_updates for insert
  with check (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()));

-- visits are written through enter_space(), never directly.
create policy space_visits_read_owner on public.space_visits for select
  using (exists (select 1 from public.spaces s where s.id = space_id and s.owner_id = auth.uid()));

create policy space_likes_read on public.space_likes for select using (true);
create policy space_likes_write_self on public.space_likes for insert with check (user_id = auth.uid());
create policy space_likes_delete_self on public.space_likes for delete using (user_id = auth.uid());

-- friendships: only the two people involved ever see the row.
create policy friendships_read on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_request on public.friendships for insert
  with check (requester_id = auth.uid() and status = 'pending');
create policy friendships_respond on public.friendships for update
  using (addressee_id = auth.uid() or requester_id = auth.uid())
  with check (addressee_id = auth.uid() or requester_id = auth.uid());
create policy friendships_delete on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy conversations_read on public.conversations for select
  using (public.in_conversation(id, auth.uid()));
create policy conversation_members_read on public.conversation_members for select
  using (public.in_conversation(conversation_id, auth.uid()));
create policy conversation_members_update_self on public.conversation_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_read on public.messages for select
  using (public.in_conversation(conversation_id, auth.uid()) and not is_removed);
create policy messages_send on public.messages for insert
  with check (sender_id = auth.uid() and public.in_conversation(conversation_id, auth.uid()));

create policy notifications_read_self on public.notifications for select using (user_id = auth.uid());
create policy notifications_update_self on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reports_insert_self on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select
  using (reporter_id = auth.uid() or public.is_moderator());
create policy moderation_actions_read on public.moderation_actions for select using (public.is_moderator());

-- the public activity feed is deliberately readable by anyone, including
-- logged-out visitors on the landing page.
create policy activity_events_read on public.activity_events for select using (true);
