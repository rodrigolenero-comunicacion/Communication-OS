-- El script de reset borra lo operativo, conserva el portfolio y deja las protecciones activas.
\ir ../../supabase/seed.sql
select test.ok((select count(*) from public.content_pieces) > 0 and (select count(*) from public.operation_events) >= 0, 'Hay datos antes del reset');
\ir ../../scripts/reset-operational-data.sql
select test.ok((select count(*) from public.content_pieces) = 0 and (select count(*) from public.publications) = 0
  and (select count(*) from public.review_decisions) = 0 and (select count(*) from public.source_observations) = 0
  and (select count(*) from public.editorial_targets) = 0, 'Reset borra piezas, publicaciones, historial y objetivos');
select test.ok((select count(*) from public.brands) = 1 and (select count(*) from public.accounts) = 4
  and (select count(*) from public.account_channels) = 8 and (select count(*) from public.authorized_users) = 1, 'Reset conserva portfolio, canales y usuario');
select test.ok((select bool_and(coverage_mode = 'unconfigured') from public.accounts), 'Cuentas vuelven a sin configurar');
select test.throws($$truncate public.operation_events$$, 'CO403', 'Protección append-only reactivada tras el reset');
select test.ok((select count(*) from pg_trigger where tgname like '%append_only' and tgenabled = 'O') = 3, 'Los tres triggers append-only quedan habilitados');
