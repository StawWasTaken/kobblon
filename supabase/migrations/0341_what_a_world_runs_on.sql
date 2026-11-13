/*
 * What a World runs on.
 *
 * Staw asked for Discover to filter by device, the way the big platforms
 * do. A filter is only worth having if the answer comes from the person who
 * built the World, so this is a column they set, not a guess the website
 * makes: a World says which devices it plays on, and Discover keeps the
 * ones that say yes to the device being asked about.
 *
 * Four names and no more: computer, phone, tablet, console. They are the
 * four the Launcher is built for, they are what the filter offers, and a
 * fifth would need the Launcher before it needed a row.
 *
 * Everything already published says all four. That is the honest default
 * rather than an empty list: a World built before anybody could answer the
 * question has not refused any device, and starting it at nothing would
 * empty Discover the moment the filter shipped.
 */
begin;

alter table public.worlds
  add column if not exists devices text[] not null
    default array['computer', 'phone', 'tablet', 'console']::text[];

/*
 * A check rather than an enum on purpose: an enum value and its use have to
 * be in separate migrations in this project, and this is a closed list of
 * four strings that the website also holds. The check is what stops a typo
 * becoming a World nobody can find.
 */
alter table public.worlds drop constraint if exists worlds_devices_known;
alter table public.worlds add constraint worlds_devices_known check (
  /*
   * `coalesce` because `array_length` of an empty array is null, not 0, and
   * a check that evaluates to null passes. Written without it, this
   * constraint refused 'vr' and happily accepted a World that runs on
   * nothing - which the behavioural check caught and the eye did not.
   */
  coalesce(array_length(devices, 1), 0) between 1 and 4
  and devices <@ array['computer', 'phone', 'tablet', 'console']::text[]
);

create index if not exists worlds_devices_idx on public.worlds using gin (devices);

commit;
