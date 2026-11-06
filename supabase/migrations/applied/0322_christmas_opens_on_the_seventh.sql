begin;

/*
 * Christmas opens on the 7th of November rather than the 15th.
 *
 * Staw: "for the christmas theme appearance ive uploaded this
 * kobblon-christmas-reveal.gif ... and i want it to be given to everyone
 * the 7th (the same way we did for the halloween theme appearance)".
 *
 * The same way means the same machinery, and that is the whole of this
 * migration: nothing is handed out by a script and nothing is written into
 * anybody's row. The card appears while the appearance is on offer, they
 * press Claim, `claim_appearance` checks the date itself and writes the
 * row - and the row is theirs for good. Moving the window is therefore one
 * number, and everything downstream follows it, because 0263 deliberately
 * put the window in one function that both the card and the claim read.
 *
 * `claim_appearance` and `appearance_offer` are not touched. They call
 * this, so they move with it.
 *
 * It stays `immutable`: it reads nothing but its argument, which is what
 * lets a check ask about a day that is not today.
 */
create or replace function public.appearance_on_offer(on_day date default current_date)
returns text language sql immutable set search_path = public as $$
  select case
    when extract(month from on_day) = 10 then 'halloween'
    when extract(month from on_day) = 12 then 'christmas'
    when extract(month from on_day) = 11 and extract(day from on_day) >= 7 then 'christmas'
    else null
  end
$$;

grant execute on function public.appearance_on_offer(date) to authenticated, anon;

commit;
