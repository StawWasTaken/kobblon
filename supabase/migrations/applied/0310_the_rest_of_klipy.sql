begin;

/*
 * The rest of Klipy's hosts.
 *
 * 0307 allowed `klipy.com` and `static.klipy.com`, which is where the
 * Launcher's GIFs were coming from. The website fetches its own through
 * the `gifs` function now, and Klipy answers from its `.co` domain as well
 * as its `.com` one - an address on a host that is not listed is masked by
 * `offsite_link`, so a GIF somebody picks here would arrive in the
 * conversation as a struck-out link.
 *
 * Nothing else changes: the match is still end-anchored on the host, so
 * `klipy.co.evil.example` is not any of these.
 */
insert into public.allowed_link_hosts (host, why)
values
  ('klipy.co', 'Klipy, which is where GIFs in chat come from'),
  ('media.klipy.co', 'Klipy media'),
  ('static.klipy.co', 'Klipy media'),
  ('media.klipy.com', 'Klipy media')
on conflict (host) do nothing;

commit;
