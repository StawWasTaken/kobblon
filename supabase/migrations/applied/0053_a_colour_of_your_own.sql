-- A colour that belongs to the person rather than to the site.
--
-- Profiles are being rebuilt around the idea that a page here should look
-- like whoever made it, not like a form with their name at the top. This is
-- the first piece of that: one colour, chosen by them, used for their page.
--
-- It is only a colour. It cannot be a picture, a stylesheet or anything that
-- runs, and it is checked as six hexadecimal digits on the way in, so the
-- worst anybody can do to their own page is choose something ugly.
--
-- Safe to run again.

alter table public.profiles add column if not exists accent_color text;

alter table public.profiles drop constraint if exists profiles_accent_color_check;
alter table public.profiles add constraint profiles_accent_color_check
  check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');
