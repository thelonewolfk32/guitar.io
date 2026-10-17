-- Operational rate limits are account data, separate from anonymous usage counts.
create table public.request_budgets(user_id uuid references auth.users on delete cascade,route text not null,hour timestamptz not null,calls integer not null,primary key(user_id,route,hour));
alter table public.request_budgets enable row level security;
revoke all on public.request_budgets from anon,authenticated;
grant all on public.request_budgets to service_role;
create function public.service_budget(p_user uuid,p_route text) returns void language plpgsql security definer set search_path='' as $$
declare cap integer;used integer;
begin
 cap:=case when p_route='gp-search' then 30 when p_route='share-resolve' then 60 when p_route='feedback' then 10 when p_route='feedback-attachment' then 20 when p_route='usage' then 120 else 1200 end;
 insert into public.request_budgets values(p_user,left(p_route,80),date_trunc('hour',now()),1) on conflict(user_id,route,hour) do update set calls=request_budgets.calls+1 returning calls into used;
 if used>cap then raise exception 'Request limit reached. Try again later.';end if;
 delete from public.request_budgets where hour<now()-interval '2 days';
end $$;
revoke all on function public.service_budget(uuid,text) from public,anon,authenticated;
grant execute on function public.service_budget(uuid,text) to service_role;
