-- Plantillas y creación rápida.
\set owner '00000000-0000-0000-0000-00000000000a'
select app.week_start(app.local_date(now())) as w0, app.week_start(app.local_date(now())) - 7 as wpast \gset
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

select test.ok((select count(*) from public.piece_templates where is_draft and account_id is null) = 22, '22 plantillas iniciales en borrador');
select (public.create_brand(gen_random_uuid(), 'B', 'b')->>'brand_id') as brand \gset
select (public.create_account(gen_random_uuid(), :'brand', 'A', 'a', null)->>'account_id') as acc \gset
select (public.create_account(gen_random_uuid(), :'brand', 'Otra', 'otra', null)->>'account_id') as acc2 \gset
select id as tpl from public.piece_templates where name = 'Carrusel de tips' \gset

-- Creación rápida con plantilla, semana y en producción
select (public.quick_create_piece(gen_random_uuid(), :'acc', 'Tips', 'feed', 'flexible', null, null, null, :'tpl', :'w0', 'in_production')->>'piece_id') as p \gset
select test.ok((select production_status = 'in_production' and category = 'educativo' and template_id = :'tpl'
  and objective is not null and audience is not null and production_spec_text is not null and content_type = 'Carrusel'
  from public.content_pieces where id = :'p'), 'Plantilla prellena categoría, objetivo, audiencia, spec y tipo; etapa en producción');
select test.ok((select experience is not null from public.review_packets where content_piece_id = :'p'), 'Plantilla prellena la experiencia del packet');
select test.ok((select week_start from public.planning_assignments where content_piece_id = :'p') = :'w0'::date, 'Semana asignada en la creación');
select test.ok((select array_agg(event_type order by occurred_at, event_type) from public.operation_events where content_piece_id = :'p')
  @> array['piece_created','piece_planned','production_started','week_assigned'], 'Historial registra creación, transiciones y asignación');
select test.throws(format('select public.submit_review(gen_random_uuid(), %L, %s)', :'p', (select version from public.content_pieces where id = :'p')), 'CO422', 'Sin texto creativo ni casillas no se envía a revisión');

-- Sin plantilla sigue funcionando como antes
select (public.quick_create_piece(gen_random_uuid(), :'acc', 'Idea suelta', 'feed', 'flexible', null, null, null, null, null, null)->>'piece_id') as p2 \gset
select test.ok((select production_status = 'idea' and template_id is null from public.content_pieces where id = :'p2'), 'Sin plantilla: idea sin datos prellenados');

-- Validaciones
select test.throws(format($$select public.quick_create_piece(gen_random_uuid(), %L, 'x', 'feed', 'flexible', null, null, null, null, %L, 'idea')$$, :'acc', :'wpast'), 'CO422', 'No asigna semanas pasadas');
select test.throws(format($$select public.quick_create_piece(gen_random_uuid(), %L, 'x', 'feed', 'flexible', null, null, null, null, null, 'approved')$$, :'acc'), 'CO422', 'No permite crear aprobada');
select (public.upsert_template(gen_random_uuid(), null, null, :'acc2', 'promocional', 'Solo de otra cuenta', null, 'post', 'o', 'a', 'e', 's', '{"hook":"¿?"}')->>'template_id') as tpl2 \gset
select test.throws(format($$select public.quick_create_piece(gen_random_uuid(), %L, 'x', 'feed', 'flexible', null, null, null, %L, null, 'idea')$$, :'acc', :'tpl2'), 'CO403', 'Plantilla de otra cuenta rechazada');
select test.throws(format($$select public.upsert_template(gen_random_uuid(), null, null, null, 'educativo', 'Mala', null, null, null, null, null, null, '{"script":"x"}')$$), 'CO422', 'Guía de Words valida campos');
select public.set_template_active(gen_random_uuid(), :'tpl', (select version from public.piece_templates where id = :'tpl'), false);
select test.throws(format($$select public.quick_create_piece(gen_random_uuid(), %L, 'x', 'feed', 'flexible', null, null, null, %L, null, 'idea')$$, :'acc', :'tpl'), 'CO422', 'Plantilla desactivada no se usa');
select public.upsert_template(gen_random_uuid(), :'tpl', (select version from public.piece_templates where id = :'tpl'), null, 'educativo', 'Carrusel de tips', 'Carrusel', 'carousel', 'Nuevo objetivo', 'a', 'e', 's', '{}');
select test.ok((select not is_draft and objective = 'Nuevo objetivo' from public.piece_templates where id = :'tpl'), 'Editar plantilla la marca como revisada');
select test.throws($$update public.piece_templates set name = 'x'$$, '42501', 'Plantillas no se editan por la API de datos');
