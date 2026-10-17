-- V1.6: free cloud, account-wide reservations and auditable owner grants.
create table public.owner_roles(user_id uuid primary key references auth.users on delete cascade);
create table public.account_status(user_id uuid primary key references auth.users on delete cascade,suspended boolean not null default false);
create table public.owner_grants(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,kind text not null check(kind in ('premium','enterprise','beta','limits')),extra_songs integer not null default 0 check(extra_songs between 0 and 100000),extra_bytes bigint not null default 0 check(extra_bytes between 0 and 1099511627776),expires_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now());
create table public.owner_audit(id bigint generated always as identity primary key,actor uuid not null,target uuid,action text not null,details jsonb not null,created_at timestamptz not null default now());
create table public.library_entries(user_id uuid not null references auth.users on delete cascade,id text not null check(length(id) between 1 and 200),kind text not null check(kind in ('pending','score')),active boolean not null default true,deleted boolean not null default false,details jsonb not null default '{}',primary key(user_id,id));
create table public.feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,category text not null check(category in ('bug','idea')),message text not null check(length(message) between 1 and 5000),contact_allowed boolean not null default false,diagnostics jsonb,attachments jsonb not null default '[]',status text not null default 'new' check(status in ('new','reviewing','planned','closed')),created_at timestamptz not null default now());
create table public.usage_consent(user_id uuid primary key references auth.users on delete cascade,enabled boolean not null default false);
create table public.usage_daily(day date not null,event text not null,count bigint not null default 0,primary key(day,event));
create table public.usage_receipts(batch_id uuid primary key,created_at timestamptz not null default now());
create table public.practice_events(user_id uuid not null references auth.users on delete cascade,id uuid not null,version integer not null check(version=1),song_id text not null,kind text not null check(kind in ('session','progress')),data jsonb not null,created_at timestamptz not null default now(),primary key(user_id,id));
-- Education foundations are private until teacher consent/invitation flows launch.
create table public.organisations(id uuid primary key default gen_random_uuid(),name text not null,seat_limit integer not null default 0 check(seat_limit>=0));
create table public.organisation_members(organisation_id uuid references public.organisations on delete cascade,user_id uuid references auth.users on delete cascade,role text not null check(role in ('owner','teacher','student')),primary key(organisation_id,user_id));
create table public.learning_assignments(id uuid primary key default gen_random_uuid(),organisation_id uuid references public.organisations,teacher_id uuid references auth.users,student_id uuid references auth.users,song_id text not null,goal jsonb not null,created_at timestamptz not null default now());
create table public.progress_permissions(organisation_id uuid references public.organisations,student_id uuid references auth.users,teacher_id uuid references auth.users,assignment_id uuid references public.learning_assignments,consented_at timestamptz,revoked_at timestamptz,primary key(student_id,teacher_id,assignment_id));
do $$ declare t text;begin foreach t in array array['owner_roles','account_status','owner_grants','owner_audit','library_entries','feedback','usage_consent','usage_daily','usage_receipts','practice_events','organisations','organisation_members','learning_assignments','progress_permissions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
grant usage,select on all sequences in schema public to service_role;

create function public.account_enabled(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from auth.users where id=p_user) and not exists(select 1 from public.account_status where user_id=p_user and suspended) $$;
create function public.account_limits(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare premium boolean;additional_songs bigint;additional_bytes bigint;
begin
 premium:=exists(select 1 from public.billing_grants where user_id=p_user and active and expires_at>now()) or exists(select 1 from public.owner_grants where user_id=p_user and revoked_at is null and (expires_at is null or expires_at>now()) and kind in ('premium','enterprise'));
 select coalesce(sum(extra_songs),0),coalesce(sum(extra_bytes),0) into additional_songs,additional_bytes from public.owner_grants where user_id=p_user and revoked_at is null and (expires_at is null or expires_at>now());
 return jsonb_build_object('paid',premium,'songs',case when premium then null else 5+additional_songs end,'bytes',case when premium then 1073741824 else 157286400 end+additional_bytes,'fileBytes',31457280);
end $$;
create or replace function public.cloud_has_access() returns boolean language sql stable security definer set search_path='' as $$ select public.account_enabled(auth.uid()) $$;
create function public.reserve_entries(p_user uuid,p_entries jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare entry jsonb;lim jsonb;adding bigint;current_count bigint;
begin
 if not public.account_enabled(p_user) then raise exception 'Account unavailable';end if;
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>100 then raise exception 'Invalid song reservations';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));lim:=public.account_limits(p_user);
 select count(distinct value->>'id') into adding from jsonb_array_elements(p_entries) where not exists(select 1 from public.library_entries where user_id=p_user and id=value->>'id' and not deleted);
 select count(*) into current_count from public.library_entries where user_id=p_user and not deleted;
 if adding>0 and lim->>'songs' is not null and current_count+adding>(lim->>'songs')::bigint then raise exception 'Song limit reached. Delete an entry, upgrade, or request a limit increase.';end if;
 for entry in select value from jsonb_array_elements(p_entries) loop
  if length(entry->>'id') not between 1 and 200 or entry->>'kind' not in ('pending','score') or length(entry::text)>10000 then raise exception 'Invalid library entry';end if;
  insert into public.library_entries(user_id,id,kind,details) values(p_user,entry->>'id',entry->>'kind',coalesce(entry->'details','{}')) on conflict(user_id,id) do update set kind=case when library_entries.kind='score' then 'score' else excluded.kind end,deleted=false,details=case when library_entries.kind='score' then library_entries.details else excluded.details end;
 end loop;
 return jsonb_build_object('reserved',jsonb_array_length(p_entries));
end $$;
create function public.set_active_entries(p_user uuid,p_ids jsonb) returns void language plpgsql security definer set search_path='' as $$
declare lim jsonb;total bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));lim:=public.account_limits(p_user);
 if jsonb_typeof(p_ids)<>'array' then raise exception 'Invalid active songs';end if;
 select count(distinct value) into total from jsonb_array_elements_text(p_ids);
 if lim->>'songs' is not null and total>(lim->>'songs')::bigint then raise exception 'Select at most your song allowance';end if;
 if exists(select 1 from jsonb_array_elements_text(p_ids) where not exists(select 1 from public.library_entries where user_id=p_user and id=value and not deleted)) then raise exception 'Unknown song';end if;
 update public.library_entries set active=(p_ids ? id) where user_id=p_user and not deleted;
end $$;
create or replace function public.cloud_commit(p_user uuid,p_key text,p_expected bigint,p_row jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare current_revision bigint;next_revision bigint;parent_id text;lim jsonb;
begin
 if not public.account_enabled(p_user) then raise exception 'Account unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select revision into current_revision from public.cloud_rows where user_id=p_user and key=p_key;
 if coalesce(current_revision,0)<>p_expected then return false;end if;
 parent_id:=case when p_row->>'entity' in ('song','source') then p_row->>'entityId' when p_row->>'entity' in ('section','annotation','recording') then split_part(p_row->>'entityId',':',1) end;
 if p_row->>'operation'='upsert' and parent_id is not null then
  if not exists(select 1 from public.library_entries where user_id=p_user and id=parent_id and not deleted) then perform public.reserve_entries(p_user,jsonb_build_array(jsonb_build_object('id',parent_id,'kind','score')));end if;
  lim:=public.account_limits(p_user);
  if lim->>'songs' is not null and ((select count(*) from public.library_entries where user_id=p_user and not deleted and active)>(lim->>'songs')::bigint or not exists(select 1 from public.library_entries where user_id=p_user and id=parent_id and active and not deleted)) then raise exception 'Choose your active songs before syncing';end if;
 end if;
 if p_row->>'entity' in ('source','asset') and p_row->>'operation'='delete' then delete from public.cloud_files where user_id=p_user and kind=p_row->>'entity' and id=p_row->>'entityId';end if;
 if p_row->>'entity'='song' and p_row->>'operation'='delete' then delete from public.cloud_files where user_id=p_user and kind='source' and id=p_row->>'entityId';update public.library_entries set deleted=true,active=false where user_id=p_user and id=p_row->>'entityId';end if;
 if p_row->>'entity'='song' and p_row->>'operation'='upsert' then update public.library_entries set kind='score' where user_id=p_user and id=parent_id;end if;
 insert into public.cloud_heads values(p_user,1) on conflict(user_id) do update set revision=cloud_heads.revision+1 returning revision into next_revision;
 insert into public.cloud_rows values(p_user,p_key,next_revision,jsonb_set(p_row,'{revision}',to_jsonb(next_revision))) on conflict(user_id,key) do update set revision=excluded.revision,row=excluded.row;
 return true;
end $$;
create or replace function public.cloud_reserve_file(p_user uuid,p_kind text,p_id text,p_hash text,p_size bigint) returns void language plpgsql security definer set search_path='' as $$
declare total bigint;existing public.cloud_files;lim jsonb;
begin
 if not public.account_enabled(p_user) then raise exception 'Account unavailable';end if;
 if p_kind not in ('source','asset') or p_size not between 1 and 31457280 or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid cloud file';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));lim:=public.account_limits(p_user);
 select * into existing from public.cloud_files where user_id=p_user and kind=p_kind and id=p_id;
 if existing.hash=p_hash and existing.size=p_size then return;end if;
 select coalesce(sum(size),0) into total from public.cloud_files where user_id=p_user and not(kind=p_kind and id=p_id);
 if total+p_size>(lim->>'bytes')::bigint then raise exception 'Cloud storage limit reached. Existing files remain stored.';end if;
 insert into public.cloud_files(user_id,kind,id,hash,size) values(p_user,p_kind,p_id,p_hash,p_size) on conflict(user_id,kind,id) do update set hash=excluded.hash,size=excluded.size,ready=false,created_at=now();
end $$;
create function public.owner_change(p_actor uuid,p_target uuid,p_action text,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.owner_roles where user_id=p_actor) then raise exception 'Owner access required';end if;
 if p_actor=p_target and p_action='status' and (p_details->>'suspended')::boolean then raise exception 'An owner cannot suspend their own account';end if;
 if not exists(select 1 from auth.users where id=p_target) then raise exception 'Unknown account';end if;
 if p_action='grant' then
  insert into public.owner_grants(user_id,kind,extra_songs,extra_bytes,expires_at) values(p_target,p_details->>'kind',coalesce((p_details->>'extraSongs')::integer,0),coalesce((p_details->>'extraBytes')::bigint,0),(p_details->>'expiresAt')::timestamptz);
 elsif p_action='revoke' then update public.owner_grants set revoked_at=now() where user_id=p_target and id=(p_details->>'id')::uuid;
 elsif p_action='status' then insert into public.account_status values(p_target,(p_details->>'suspended')::boolean) on conflict(user_id) do update set suspended=excluded.suspended;
 else raise exception 'Unknown owner operation';end if;
 insert into public.owner_audit(actor,target,action,details) values(p_actor,p_target,p_action,p_details);
end $$;
create function public.record_usage(p_user uuid,p_batch uuid,p_counts jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item record;
begin
 if not exists(select 1 from public.usage_consent where user_id=p_user and enabled) then raise exception 'Usage consent required';end if;
 if jsonb_typeof(p_counts)<>'object' or length(p_counts::text)>2048 then raise exception 'Invalid usage counts';end if;
 for item in select * from jsonb_each_text(p_counts) loop
  if item.key not in ('score_open','manual_import','share_capture','auto_sections','sync_complete','learn_open','feedback_sent') or item.value !~ '^[0-9]{1,3}$' or item.value::int>100 then raise exception 'Invalid usage event';end if;
 end loop;
 insert into public.usage_receipts values(p_batch,now()) on conflict do nothing;if not found then return;end if;
 for item in select * from jsonb_each_text(p_counts) loop
  insert into public.usage_daily values(current_date,item.key,item.value::bigint) on conflict(day,event) do update set count=usage_daily.count+excluded.count;
 end loop;
 delete from public.usage_receipts where created_at<now()-interval '8 days';
end $$;
-- Backfill catalogue only; existing GP bytes and revisions are untouched.
create function public.owner_accounts(p_search text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(result),'[]') from (select u.id,to_jsonb(u)->>'email' as email,coalesce(s.suspended,false) as suspended,public.account_limits(u.id) as limits,(select coalesce(jsonb_agg(g),'[]') from public.owner_grants g where g.user_id=u.id) as grants from auth.users u left join public.account_status s on s.user_id=u.id where u.id::text ilike '%'||p_search||'%' or coalesce(to_jsonb(u)->>'email','') ilike '%'||p_search||'%' order by u.id limit 100) result
$$;
revoke all on function public.owner_accounts(text) from public,anon,authenticated;
grant execute on function public.owner_accounts(text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('feedback-attachments','feedback-attachments',false,1048576) on conflict do nothing;
create function public.save_practice(p_user uuid,p_event jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.library_entries where user_id=p_user and id=p_event->>'songId' and not deleted) then raise exception 'Unknown practice song';end if;
 insert into public.practice_events(user_id,id,version,song_id,kind,data) values(p_user,(p_event->>'id')::uuid,(p_event->>'version')::int,p_event->>'songId',p_event->>'kind',p_event->'data') on conflict do nothing;
end $$;
revoke all on function public.save_practice(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_practice(uuid,jsonb) to service_role;
insert into public.library_entries(user_id,id,kind) select user_id,row->>'entityId','score' from public.cloud_rows where row->>'entity'='song' and row->>'operation'='upsert' on conflict do nothing;
do $$ declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('account_enabled','account_limits','reserve_entries','set_active_entries','owner_change','record_usage') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end $$;
