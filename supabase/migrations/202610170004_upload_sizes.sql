-- Storage probes use contentLength; completed uploads carry actual size.
-- Match either against the locked quota reservation, never user_metadata.
create function public.cloud_upload_allowed(p_name text,p_metadata jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select public.cloud_has_access() and exists(
  select 1 from public.cloud_files f where f.user_id=auth.uid()
   and p_name=f.user_id::text||'/blobs/'||f.hash
   and case when coalesce(p_metadata->>'size',p_metadata->>'contentLength','') ~ '^[0-9]{1,12}$'
    then coalesce(p_metadata->>'size',p_metadata->>'contentLength')::bigint=f.size else false end
 )
$$;
revoke all on function public.cloud_upload_allowed(text,jsonb) from public,anon;
grant execute on function public.cloud_upload_allowed(text,jsonb) to authenticated;
drop policy "Upload reserved paid cloud files" on storage.objects;
create policy "Upload reserved complete cloud files" on storage.objects for insert to authenticated
 with check(bucket_id='library' and public.cloud_upload_allowed(name,metadata));
