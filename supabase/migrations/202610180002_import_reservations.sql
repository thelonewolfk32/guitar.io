-- A large backup is one transaction: a late quota failure must not leave slots
-- reserved for only the first page of an otherwise uncommitted restore.
create function public.reserve_import(p_user uuid,p_entries jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare batch record;
begin
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>10000 then raise exception 'Invalid import reservations';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 for batch in select jsonb_agg(value order by ordinality) entries from jsonb_array_elements(p_entries) with ordinality group by (ordinality-1)/100 order by (ordinality-1)/100 loop
  perform public.reserve_entries(p_user,batch.entries);
 end loop;
 return jsonb_build_object('reserved',jsonb_array_length(p_entries));
end $$;
revoke all on function public.reserve_import(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_import(uuid,jsonb) to service_role;
