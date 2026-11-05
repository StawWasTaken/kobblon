-- Realtime: chat, notifications and the public activity feed stream live.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.activity_events;
alter publication supabase_realtime add table public.profiles;
