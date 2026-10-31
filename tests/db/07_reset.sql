-- El reset borra solo lo operativo ligado a piezas y conserva configuración e historial de configuración.
\set owner '00000000-0000-0000-0000-00000000000a'
\ir ../../supabase/seed.sql
-- Configuración real que debe sobrevivir: evento de configuración y fuente de contexto sin pieza.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);
select public.create_brand(gen_random_uuid(), 'Real', 'real');
select public.create_context_reference(gen_random_uuid(), 'public_general', null, null, 'manual', 'Fuente general', 'https://example.test', null);
reset role;
select count(*) as config_events from public.operation_events where content_piece_id is null and publication_id is null \gset
select count(*) as targets from public.editorial_targets \gset
-- V0.4: un registro de generación ligado a pieza, uno sin pieza y una idea de biblioteca.
insert into public.generation_runs (brand_id, content_piece_id, stage, provider, status, actor_id)
select a.brand_id, p.id, 'package', 'anthropic', 'succeeded', :'owner' from public.content_pieces p join public.accounts a on a.id = p.account_id limit 1;
insert into public.generation_runs (brand_id, stage, provider, status, actor_id) select id, 'ideas', 'anthropic', 'failed', :'owner' from public.brands limit 1;
insert into public.idea_library (brand_id, code, title) select id, '01', 'Idea' from public.brands limit 1;
select test.ok((select count(*) from public.content_pieces) > 0, 'Hay piezas demo antes del reset');
\ir ../../scripts/reset-preview.sql
select test.ok((select count(*) from public.content_pieces) > 0, 'La vista previa no borra nada');
\ir ../../scripts/reset-operational-data.sql
select test.ok((select count(*) from public.content_pieces) = 0 and (select count(*) from public.publications) = 0
  and (select count(*) from public.review_decisions) = 0 and (select count(*) from public.planning_assignments) = 0
  and (select count(*) from public.source_references where content_piece_id is not null) = 0, 'Reset borra piezas y todo lo que cuelga de ellas');
select test.ok((select count(*) from public.operation_events where content_piece_id is not null or publication_id is not null) = 0, 'Reset borra eventos de piezas');
select test.ok((select count(*) from public.generation_runs) = 1 and (select count(*) from public.idea_library) = 1, 'Reset borra registros de generación de piezas y conserva biblioteca');
select test.ok((select count(*) from public.operation_events) = :config_events, 'Reset conserva historial de configuración');
select test.ok((select count(*) from public.source_references where content_piece_id is null) = 1, 'Reset conserva fuentes de contexto sin pieza');
select test.ok((select count(*) from public.editorial_targets) = :targets and :targets > 0, 'Reset conserva objetivos semanales');
select test.ok((select count(*) from public.brands) = 2 and (select count(*) from public.accounts) = 4
  and (select count(*) from public.account_channels) = 8 and (select count(*) from public.authorized_users) = 1
  and (select count(*) from public.piece_templates) = 22 and (select count(*) from public.channels) = 2, 'Reset conserva portfolio, canales, catálogo, plantillas y usuario');
select test.ok((select count(*) from pg_policies where schemaname = 'public') >= 16, 'Policies intactas');
select test.throws($$truncate public.operation_events$$, 'CO403', 'Protección append-only reactivada tras el reset');
select test.ok((select count(*) from pg_trigger where tgname like '%append_only' and tgenabled = 'O') = 4, 'Los cuatro triggers append-only (incluido generation_runs) quedan habilitados');
