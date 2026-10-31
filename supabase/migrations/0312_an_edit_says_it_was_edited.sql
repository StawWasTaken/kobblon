begin;

/*
 * A changed message says so again.
 *
 * `edited_at` has existed since 0018, and so did the trigger that set it:
 * `screen_message_edit` checked the new body against the old, refused the
 * edit if the words were blocked, and stamped the row when they were not.
 * 0170 moved the three talking tables from refusing to censoring, and in
 * doing so dropped `messages_screen_edit` along with the other old
 * blocking triggers - correctly, because it was one of two triggers
 * deciding the same question. What went with it, and was not noticed, is
 * the one line in it that was not about screening at all.
 *
 * So since 0170 an edit has changed the body and left `edited_at` null,
 * for every private message on the platform. Nothing failed: the update
 * returned successfully, the new words appeared, and the only symptom was
 * a note that never showed. Staw, looking at a chat: "we dont see the
 * '(edited)' thing anymore". It is the same shape as the third trap - a
 * write that works and a column that quietly does not move - and it
 * survived for the same reason, which is that the page looked right.
 *
 * This is the stamp on its own, with nothing else in it. The censoring
 * trigger keeps the screening and this keeps the record of the edit, and
 * neither can take the other away again.
 */
create or replace function public.an_edit_is_stamped()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;

/*
 * Named to run *after* `messages_are_censored`.
 *
 * Triggers of the same kind on the same table fire in name order, and
 * these two have to be this way round: censoring rewrites the body, and
 * the question this one asks is whether the message anybody will read has
 * actually changed. Stamping first would mark a message as edited when
 * the edit was censored straight back into what it already said.
 * `messages_are_censored` < `messages_are_stamped`, and that is not a
 * coincidence in the naming.
 *
 * `of body` rather than every update: deleting a message sets
 * `is_removed` and touches nothing else, and a deleted message is not an
 * edited one.
 */
drop trigger if exists messages_are_stamped on public.messages;
create trigger messages_are_stamped before update of body on public.messages
  for each row execute function public.an_edit_is_stamped();

commit;
