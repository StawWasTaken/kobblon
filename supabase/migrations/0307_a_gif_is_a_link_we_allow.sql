begin;

/*
 * Klipy, which is where our GIFs come from.
 *
 * The applications' session built the GIF card for the in-World chat: the
 * key lives in the Launcher's main process, the page only ever talks to
 * `app://kobblon/gif/...`, and a GIF is sent as its address because the
 * transport carries chat as text and a transport that learns a new kind of
 * message every time the interface grows one breaks every time.
 *
 * Then `screen_say` blocked it, because it is a link, and the line arrived
 * as four dots.
 *
 * Staw: "can we make that we accept any klippy link into the friends chats
 * and the launcher". So the host joins the list 0238 built for exactly
 * this - adding a site is one insert - rather than `screen_say` growing a
 * special case for one address shape.
 *
 * Why the host and not "a message that is only a Klipy address", which is
 * what the other session offered to live with: the narrower rule says a
 * GIF with a word beside it is blocked, and somebody typing "look at this"
 * before pasting one is not an attack. The host is the thing that makes it
 * safe either way - it is a place we proxy, not a place a player can point
 * anywhere - and `offsite_link` anchors the end of the name, so
 * `klipy.com.evil.example` is still refused.
 */

insert into public.allowed_link_hosts (host, why) values
  ('klipy.com', 'Where the GIF cards get their pictures'),
  ('static.klipy.com', 'Klipy''s own file host, said out loud as well')
on conflict (host) do nothing;

commit;
