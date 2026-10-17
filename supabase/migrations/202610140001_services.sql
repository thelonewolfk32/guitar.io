-- Private account data: clients never write their own paid entitlement.
create table public.billing_customers(user_id uuid primary key references auth.users on delete cascade,customer_id text unique not null);
create table public.billing_grants(user_id uuid not null references auth.users on delete cascade,provider text not null,subscription_id text not null,expires_at timestamptz,active boolean not null default false,event_at bigint not null,primary key(user_id,provider,subscription_id));
create table public.billing_events(provider text not null,event_id text not null,primary key(provider,event_id));
create table public.cloud_heads(user_id uuid primary key references auth.users on delete cascade,revision bigint not null default 0);
create table public.cloud_rows(user_id uuid not null references auth.users on delete cascade,key text not null,revision bigint not null,row jsonb not null,primary key(user_id,key));
create index cloud_rows_revision on public.cloud_rows(user_id,revision);
create table public.cloud_files(user_id uuid not null references auth.users on delete cascade,kind text not null check(kind in ('source','asset')),id text not null,hash text not null check(hash ~ '^[a-f0-9]{64}$'),size bigint not null check(size between 1 and 31457280),ready boolean not null default false,created_at timestamptz not null default now(),primary key(user_id,kind,id));
do $$ declare t text; begin foreach t in array array['billing_customers','billing_grants','billing_events','cloud_heads','cloud_rows','cloud_files'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;

create function public.cloud_has_access() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.billing_grants where user_id=auth.uid() and active and expires_at>now()) $$;
revoke all on function public.cloud_has_access() from public,anon;grant execute on function public.cloud_has_access() to authenticated;

create function public.apply_billing_grant(p_user uuid,p_provider text,p_subscription text,p_event text,p_event_at bigint,p_expires timestamptz,p_active boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
  insert into public.billing_events values(p_provider,p_event) on conflict do nothing;if not found then return false;end if;
  insert into public.billing_grants values(p_user,p_provider,p_subscription,p_expires,p_active,p_event_at)
  on conflict(user_id,provider,subscription_id) do update set expires_at=excluded.expires_at,active=excluded.active,event_at=excluded.event_at where billing_grants.event_at<=excluded.event_at;
  return true;
end $$;

-- Optimistic merge commits are serialized per account. No published cursor can
-- advance past a pending lower revision from another device's transaction.
create function public.cloud_commit(p_user uuid,p_key text,p_expected bigint,p_row jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare current_revision bigint;next_revision bigint;
begin
  if not exists(select 1 from public.billing_grants where user_id=p_user and active and expires_at>now()) then raise exception 'Paid cloud subscription required';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select revision into current_revision from public.cloud_rows where user_id=p_user and key=p_key;
  if coalesce(current_revision,0)<>p_expected then return false;end if;
  insert into public.cloud_heads values(p_user,1) on conflict(user_id) do update set revision=cloud_heads.revision+1 returning revision into next_revision;
  insert into public.cloud_rows values(p_user,p_key,next_revision,jsonb_set(p_row,'{revision}',to_jsonb(next_revision))) on conflict(user_id,key) do update set revision=excluded.revision,row=excluded.row;
  return true;
end $$;

create function public.cloud_reserve_file(p_user uuid,p_kind text,p_id text,p_hash text,p_size bigint) returns void language plpgsql security definer set search_path='' as $$
declare total bigint;existing public.cloud_files;
begin
  if not exists(select 1 from public.billing_grants where user_id=p_user and active and expires_at>now()) then raise exception 'Paid cloud subscription required';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  select * into existing from public.cloud_files where user_id=p_user and kind=p_kind and id=p_id;
  if existing.hash=p_hash and existing.size=p_size then return;end if;
  select coalesce(sum(size),0) into total from public.cloud_files where user_id=p_user and not(kind=p_kind and id=p_id);
  if total+p_size>1073741824 then raise exception 'Cloud storage limit reached';end if;
  insert into public.cloud_files(user_id,kind,id,hash,size) values(p_user,p_kind,p_id,p_hash,p_size) on conflict(user_id,kind,id) do update set hash=excluded.hash,size=excluded.size,ready=false,created_at=now();
end $$;

revoke all on function public.apply_billing_grant(uuid,text,text,text,bigint,timestamptz,boolean) from public,anon,authenticated;
revoke all on function public.cloud_commit(uuid,text,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.cloud_reserve_file(uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_billing_grant(uuid,text,text,text,bigint,timestamptz,boolean) to service_role;
grant execute on function public.cloud_commit(uuid,text,bigint,jsonb) to service_role;
grant execute on function public.cloud_reserve_file(uuid,text,text,text,bigint) to service_role;

insert into storage.buckets(id,name,public,file_size_limit) values('library','library',false,31457280),('app-updates','app-updates',false,536870912) on conflict(id) do nothing;
create policy "Read own paid cloud files" on storage.objects for select to authenticated using(bucket_id='library' and public.cloud_has_access() and exists(select 1 from public.cloud_files f where f.user_id=auth.uid() and f.ready and name=f.user_id::text||'/blobs/'||f.hash));
-- Storage policies need read-only access to reservation rows through this helper.
create function public.cloud_file_allowed(p_name text,p_ready boolean) returns boolean language sql stable security definer set search_path='' as $$ select public.cloud_has_access() and exists(select 1 from public.cloud_files f where f.user_id=auth.uid() and (not p_ready or f.ready) and p_name=f.user_id::text||'/blobs/'||f.hash) $$;
revoke all on function public.cloud_file_allowed(text,boolean) from public,anon;grant execute on function public.cloud_file_allowed(text,boolean) to authenticated;
drop policy "Read own paid cloud files" on storage.objects;
create policy "Read own paid cloud files" on storage.objects for select to authenticated using(bucket_id='library' and public.cloud_file_allowed(name,true));
create policy "Upload reserved paid cloud files" on storage.objects for insert to authenticated with check(bucket_id='library' and public.cloud_file_allowed(name,false));
-- No overwrite/delete permission for clients; hash-addressed objects are immutable.
-- app-updates has no client policy. A public manifest endpoint supplies signed
-- URLs; app updates stay available to free users, independently of billing.
