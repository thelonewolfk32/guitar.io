-- Leases protect retryable uploads; saved entries and archived references never expire.
create table public.blob_leases(user_id uuid not null,hash text not null,expires_at timestamptz not null,primary key(user_id,hash));
create table public.storage_orphans(bucket text not null,path text not null,first_seen timestamptz not null default now(),deleting boolean not null default false,primary key(bucket,path));
create table public.ops_usage(day date not null,metric text not null,units bigint not null default 0,primary key(day,metric));
create table public.ops_alerts(period date not null,metric text not null,threshold integer not null,value numeric not null,limit_value numeric not null,created_at timestamptz not null default now(),primary key(period,metric,threshold));
create table public.account_deletions(user_id uuid primary key,requested_at timestamptz not null default now(),google_revoked boolean not null default false,apple_revoked boolean not null default false,nonce uuid not null default gen_random_uuid(),status text not null default 'providers' check(status in ('providers','requested','files','complete')));
create table public.backup_lease(id boolean primary key default true check(id),owner uuid not null,expires_at timestamptz not null);
do $$ declare t text;begin foreach t in array array['blob_leases','storage_orphans','ops_usage','ops_alerts','account_deletions','backup_lease'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;

create or replace function public.cloud_reserve_file(p_user uuid,p_kind text,p_id text,p_hash text,p_size bigint) returns void language plpgsql security definer set search_path='' as $$
declare total bigint;existing public.cloud_files;lim jsonb;
begin
 if not public.account_enabled(p_user) or exists(select 1 from public.account_deletions where user_id=p_user) then raise exception 'Account unavailable';end if;
 if p_kind not in ('source','asset') or p_size not between 1 and 31457280 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid cloud file';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.storage_orphans where bucket='library' and path=p_user::text||'/blobs/'||p_hash and deleting) then raise exception 'Cloud file cleanup is finishing. Retry shortly.';end if;
 delete from public.storage_orphans where bucket='library' and path=p_user::text||'/blobs/'||p_hash;
 insert into public.blob_leases values(p_user,p_hash,now()+interval '1 hour') on conflict(user_id,hash) do update set expires_at=excluded.expires_at;
 lim:=public.account_limits(p_user);select * into existing from public.cloud_files where user_id=p_user and kind=p_kind and id=p_id;
 if existing.hash=p_hash and existing.size=p_size then return;end if;
 select coalesce(sum(size),0) into total from public.cloud_files where user_id=p_user and not(kind=p_kind and id=p_id);
 if total+p_size>(lim->>'bytes')::bigint then raise exception 'Cloud storage limit reached. Existing files remain stored.';end if;
 insert into public.cloud_files(user_id,kind,id,hash,size) values(p_user,p_kind,p_id,p_hash,p_size) on conflict(user_id,kind,id) do update set hash=excluded.hash,size=excluded.size,ready=false,created_at=now();
end $$;
create or replace function public.cloud_upload_allowed(p_name text,p_metadata jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select public.cloud_has_access() and not exists(select 1 from public.account_deletions where user_id=auth.uid()) and exists(
 select 1 from public.cloud_files f join public.blob_leases l on l.user_id=f.user_id and l.hash=f.hash
 where f.user_id=auth.uid() and not f.ready and l.expires_at>now() and p_name=f.user_id::text||'/blobs/'||f.hash
 and not exists(select 1 from public.storage_orphans o where o.bucket='library' and o.path=p_name and o.deleting)
 and case when coalesce(p_metadata->>'size',p_metadata->>'contentLength','') ~ '^[0-9]{1,12}$' then coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size else false end)
$$;
-- An expired lease alone does not remove a reservation, library slot or metadata.
-- Only reservations whose entity has actually been deleted are abandoned.
create function public.storage_scan() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.blob_leases where expires_at<now();
 delete from public.cloud_files f where not f.ready and not exists(select 1 from public.blob_leases l where l.user_id=f.user_id and l.hash=f.hash)
 and exists(select 1 from public.cloud_rows r where r.user_id=f.user_id and r.key=f.kind||'/'||f.id and r.row->>'operation'='delete');
 insert into public.storage_orphans(bucket,path)
 select o.bucket_id,o.name from storage.objects o where o.bucket_id in ('library','feedback-attachments')
 and not exists(select 1 from public.storage_orphans c where c.bucket=o.bucket_id and c.path=o.name)
 and not exists(select 1 from public.cloud_files f where o.bucket_id='library' and o.name=f.user_id::text||'/blobs/'||f.hash)
 and not exists(select 1 from public.blob_leases l where o.bucket_id='library' and o.name=l.user_id::text||'/blobs/'||l.hash and l.expires_at>now())
 and not exists(select 1 from public.feedback f,jsonb_array_elements(f.attachments) a where o.bucket_id='feedback-attachments' and a->>'path'=o.name)
 on conflict do nothing;
 delete from public.storage_orphans c where not c.deleting and (
 exists(select 1 from public.cloud_files f where c.bucket='library' and c.path=f.user_id::text||'/blobs/'||f.hash)
 or exists(select 1 from public.feedback f,jsonb_array_elements(f.attachments) a where c.bucket='feedback-attachments' and a->>'path'=c.path));
end $$;
create function public.storage_claim(p_bucket text,p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare account_id uuid;
begin
 if exists(select 1 from public.backup_lease where expires_at>now()) then return false;end if;
 if p_bucket not in ('library','feedback-attachments') or split_part(p_path,'/',1) !~ '^[a-f0-9-]{36}$' then return false;end if;
 account_id:=split_part(p_path,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
 if exists(select 1 from public.cloud_files f where p_bucket='library' and p_path=f.user_id::text||'/blobs/'||f.hash)
 or exists(select 1 from public.blob_leases l where p_bucket='library' and p_path=l.user_id::text||'/blobs/'||l.hash and l.expires_at>now())
 or exists(select 1 from public.feedback f,jsonb_array_elements(f.attachments) a where p_bucket='feedback-attachments' and a->>'path'=p_path) then return false;end if;
 update public.storage_orphans set deleting=true where bucket=p_bucket and path=p_path and first_seen<now()-interval '7 days';return found;
end $$;
create function public.ops_count(p_metric text,p_units bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_metric not in ('invocations','download_descriptor_bytes') or p_units<0 then raise exception 'Invalid operational metric';end if;
 insert into public.ops_usage values(current_date,p_metric,p_units) on conflict(day,metric) do update set units=ops_usage.units+excluded.units;
end $$;
create function public.ops_snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('storageBytes',(select coalesce(sum(case when metadata->>'size' ~ '^[0-9]{1,15}$' then (metadata->>'size')::bigint else 0 end),0) from storage.objects where bucket_id in ('library','feedback-attachments')),
 'usage',(select coalesce(jsonb_object_agg(metric,total),'{}') from (select metric,sum(units) total from public.ops_usage where day>=date_trunc('month',now())::date group by metric) u),
 'alerts',(select coalesce(jsonb_agg(a order by a.created_at desc),'[]') from public.ops_alerts a where period=date_trunc('month',now())::date),
 'orphans',(select count(*) from public.storage_orphans),'pendingDeletions',(select count(*) from public.account_deletions where status<>'complete'))
$$;
-- Serialize deletion against imports, deny all ordinary account routes immediately.
create function public.prepare_account_deletion(p_user uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare challenge uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from auth.users where id=p_user) or exists(select 1 from public.owner_roles where user_id=p_user) then raise exception 'Transfer the owner role before deleting this account';end if;
 insert into public.account_deletions(user_id,nonce) values(p_user,challenge) on conflict(user_id) do update set nonce=excluded.nonce,status='providers',google_revoked=false,apple_revoked=false;
 return challenge;
end $$;
create function public.begin_account_deletion(p_user uuid,p_nonce uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.owner_roles where user_id=p_user) then raise exception 'Transfer the owner role before deleting this account';end if;
 if p_nonce is null or not exists(select 1 from public.account_deletions where user_id=p_user and nonce=p_nonce and status='providers') then raise exception 'Confirm deletion again';end if;
 update public.account_deletions set status='requested' where user_id=p_user;
 insert into public.account_status values(p_user,true) on conflict(user_id) do update set suspended=true;
end $$;
create function public.cancel_account_deletion(p_user uuid,p_nonce uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 delete from public.account_deletions where user_id=p_user and nonce=p_nonce and status='providers';return found;
end $$;
revoke all on function public.cancel_account_deletion(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_account_deletion(uuid,uuid) to service_role;
create function public.guard_library_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 if not public.account_enabled(new.user_id) then raise exception 'Account unavailable';end if;return new;
end $$;
revoke all on function public.guard_library_write() from public,anon,authenticated;
create trigger guard_library_entries before insert or update on public.library_entries for each row execute function public.guard_library_write();
create trigger guard_cloud_rows before insert or update on public.cloud_rows for each row execute function public.guard_library_write();
create trigger guard_cloud_files before insert or update on public.cloud_files for each row execute function public.guard_library_write();
create or replace function public.account_enabled(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_user) and not exists(select 1 from public.account_status where user_id=p_user and suspended) and not exists(select 1 from public.account_deletions where user_id=p_user)
$$;
create function public.purge_account_relations(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.account_deletions where user_id=p_user) then raise exception 'Deletion must be requested first';end if;
 delete from public.progress_permissions where student_id=p_user or teacher_id=p_user or assignment_id in(select id from public.learning_assignments where student_id=p_user or teacher_id=p_user);
 delete from public.learning_assignments where student_id=p_user or teacher_id=p_user;
 delete from public.blob_leases where user_id=p_user;
end $$;
revoke all on function public.purge_account_relations(uuid) from public,anon,authenticated;
grant execute on function public.purge_account_relations(uuid) to service_role;
create or replace function public.service_budget(p_user uuid,p_route text) returns void language plpgsql security definer set search_path='' as $$
declare cap integer;used integer;
begin
 cap:=case when p_route='gp-search' then 30 when p_route='share-resolve' then 60 when p_route='feedback' then 10 when p_route='feedback-attachment' then 20 when p_route='usage' then 120 else 1200 end;
 insert into public.request_budgets values(p_user,left(p_route,80),date_trunc('hour',now()),1) on conflict(user_id,route,hour) do update set calls=request_budgets.calls+1 returning calls into used;
 if used>cap then raise exception 'Request limit reached. Try again later.';end if;
 perform public.ops_count('invocations',1);
 delete from public.request_budgets where hour<now()-interval '2 days';
end $$;
do $$ declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('storage_scan','storage_claim','ops_count','ops_snapshot','prepare_account_deletion','begin_account_deletion') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end $$;
