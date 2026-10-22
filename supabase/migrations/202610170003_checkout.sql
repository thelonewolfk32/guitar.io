create table public.billing_checkouts(user_id uuid primary key references auth.users on delete cascade,id uuid not null,cadence text not null check(cadence in ('monthly','yearly')),price_id text not null,url text,expires_at timestamptz not null);
alter table public.billing_checkouts enable row level security;
revoke all on public.billing_checkouts from anon,authenticated;
grant all on public.billing_checkouts to service_role;
create function public.checkout_claim(p_user uuid,p_cadence text,p_price text) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.billing_checkouts;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into item from public.billing_checkouts where user_id=p_user;
 if item.expires_at>now() then
  if item.cadence<>p_cadence then raise exception 'Existing checkout uses another billing period. Finish it or wait 35 minutes before changing.';end if;
  return to_jsonb(item);
 end if;
 insert into public.billing_checkouts values(p_user,gen_random_uuid(),p_cadence,p_price,null,now()+interval '35 minutes') on conflict(user_id) do update set id=excluded.id,cadence=excluded.cadence,price_id=excluded.price_id,url=null,expires_at=excluded.expires_at returning * into item;
 return to_jsonb(item);
end $$;
revoke all on function public.checkout_claim(uuid,text,text) from public,anon,authenticated;
grant execute on function public.checkout_claim(uuid,text,text) to service_role;
