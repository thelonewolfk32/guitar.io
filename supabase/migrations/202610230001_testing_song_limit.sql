-- Temporary testing allowance; storage/file quotas, ownership, billing and RLS
-- remain unchanged. Apply after existing migrations; never edit deployed history.
create or replace function public.account_limits(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare premium boolean;additional_songs bigint;additional_bytes bigint;
begin
 premium:=exists(select 1 from public.billing_grants where user_id=p_user and active and expires_at>now()) or exists(select 1 from public.owner_grants where user_id=p_user and revoked_at is null and (expires_at is null or expires_at>now()) and kind in ('premium','enterprise'));
 select coalesce(sum(extra_songs),0),coalesce(sum(extra_bytes),0) into additional_songs,additional_bytes from public.owner_grants where user_id=p_user and revoked_at is null and (expires_at is null or expires_at>now());
 return jsonb_build_object('songPolicy','testing-1000-v1','paid',premium,'songs',case when premium then null else 1000+additional_songs end,'bytes',case when premium then 1073741824 else 157286400 end+additional_bytes,'fileBytes',31457280);
end $$;

-- Reactivate retained libraries that fit the enlarged testing allowance. Larger
-- libraries keep their explicit active selection and all originals remain stored.
update public.library_entries e set active=true
where not e.deleted and (
 (public.account_limits(e.user_id)->>'songs') is null
 or (select count(*) from public.library_entries x where x.user_id=e.user_id and not x.deleted)
    <= (public.account_limits(e.user_id)->>'songs')::bigint
);
