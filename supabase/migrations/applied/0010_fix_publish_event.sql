-- A publish was announced from a BEFORE INSERT trigger, so activity_events
-- pointed at a Space row that did not exist yet and the foreign key refused
-- it. Stamping stays before the write; announcing moves to after it.

create or replace function public.on_space_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function public.on_space_published()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and (tg_op = 'INSERT' or not old.is_published) then
    insert into public.activity_events (kind, actor_id, space_id)
    values ('space_published', new.owner_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists spaces_after_publish on public.spaces;

create trigger spaces_after_publish
  after insert or update on public.spaces
  for each row execute function public.on_space_published();
