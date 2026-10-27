select test.ok((select count(*) from public.channels) = 2, 'catálogo de canales instagram/facebook');
select test.ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), 'RLS activa en todas las tablas de public');
