begin;

-- "Been looked at" is not a verdict
-- -----------------------------------------------------------------------
--
-- Staw: "the tags be either solved/been looked at, either declined/approved".
--
-- Two answers rather than four marks, which is what they always were: one
-- says what happened to the thing reported, the other says what was decided
-- about the thing suggested. Four loose buttons in a row said neither, and
-- it is why the staff bar read as a pile.
--
-- The pairing only works if "been looked at" is allowed on a bug board, and
-- it was not: 0276 filed it with `approved` and `declined` under
-- suggestions, so a bug report could be marked solved or nothing at all.
-- That was wrong on its own terms before the pairing - an acknowledgement is
-- not a verdict, it is the thing you say *before* a verdict, and it is worth
-- exactly as much on a bug as on an idea.
--
-- So `looked-at` is now allowed wherever any mark is, and the other three
-- keep the boards they had. What this cannot do is move a mark that was
-- already put on: nothing is rewritten, because nothing was wrong - a topic
-- marked `looked-at` on a suggestions board stays marked, and it means the
-- same thing it meant.
--
-- `plain`, the kind for a board with no marks at all, still refuses
-- everything. A category that does not decide anything does not acknowledge
-- anything either; the staff bar on an off-topic thread is Pin and Close and
-- that is correct.

set search_path = public, extensions;

create or replace function public.forum_set_status(in_topic bigint, in_status text)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare board_kind text;
begin
  if not public.is_moderator() then
    raise exception 'Only Kobblon staff can mark a topic.';
  end if;

  select c.kind into board_kind
    from public.forum_topics t
    join public.forum_categories c on c.slug = t.category
   where t.id = in_topic;
  if board_kind is null then raise exception 'There is no such topic.'; end if;

  if in_status = 'open' then
    null;
  elsif in_status = 'solved' then
    if board_kind not in ('bugs', 'both') then
      raise exception 'Nothing is solved in this category.';
    end if;
  elsif in_status in ('approved', 'declined') then
    if board_kind not in ('suggestions', 'both') then
      raise exception 'Suggestions are not decided in this category.';
    end if;
  elsif in_status = 'looked-at' then
    -- Anywhere something can be answered, it can first be acknowledged.
    if board_kind not in ('bugs', 'suggestions', 'both') then
      raise exception 'Nothing is marked in this category.';
    end if;
  else
    raise exception 'That is not one of the marks.';
  end if;

  update public.forum_topics
     set status = in_status,
         status_by = case when in_status = 'open' then null else auth.uid() end,
         status_at = case when in_status = 'open' then null else now() end
   where id = in_topic;
end $$;

grant execute on function public.forum_set_status to authenticated;

commit;
