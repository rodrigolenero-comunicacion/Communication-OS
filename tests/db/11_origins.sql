-- V0.2.1: orígenes de contenido, estado del material, copy pendiente y referencias manuales.
\set owner '00000000-0000-0000-0000-00000000000a'
select app.week_start(app.local_date(now())) + 7 as w1, app.week_start(app.local_date(now())) + 14 as w2 \gset
create function test.v(p uuid) returns integer language sql as $$ select version from public.content_pieces where id = p $$;
grant execute on all functions in schema test to authenticated;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

select (public.create_brand(gen_random_uuid(), 'Tec prueba', 'tec-prueba')->>'brand_id') as tec \gset
select (public.create_brand(gen_random_uuid(), 'Otro', 'otro')->>'brand_id') as otro \gset
select (public.create_account(gen_random_uuid(), :'tec', 'Campus', 'campus', null)->>'account_id') as acc \gset
select (public.create_account(gen_random_uuid(), :'otro', 'Otra cuenta', 'otra', null)->>'account_id') as acc2 \gset
select test.ok((select content_origins = array['organic'] from public.brands where id = :'tec'), 'Cliente nuevo: solo orgánico por defecto');
select public.set_brand_content_origins(gen_random_uuid(), :'tec', (select version from public.brands where id = :'tec'), array['event_coverage', 'existing_material']);
select test.ok((select content_origins = array['event_coverage', 'existing_material', 'organic'] from public.brands where id = :'tec'), 'Orígenes configurables; orgánico siempre incluido');

-- Orgánico: llamada de V0.2 sin parámetros nuevos sigue válida
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 1), 'Vida en campus', 'Idea', 'own_idea', 'reel', 'real_people', null, null, 'feed')->>'piece_id') as org \gset
select test.ok((select content_origin = 'organic' and material_status = 'not_required' and origin = 'own_idea' and not needs_copy from public.content_pieces where id = :'org'), 'Orgánico compatible con la firma de V0.2');

-- Evento pendiente y disponible
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 2), 'Carrusel · Industry Hack @ Tec', null, null, 'carousel', null, null, null, 'feed',
  'event_coverage', 'pending', true, 'Industry Hack @ Tec', 'st_hub', null, null)->>'piece_id') as evp \gset
select test.ok((select content_origin = 'event_coverage' and material_status = 'pending' and needs_copy and event_name = 'Industry Hack @ Tec'
  and source_system = 'st_hub' and source_entity_id is null and source_url is null and production_mode_key is null and origin is null and production_status = 'planned'
  from public.content_pieces where id = :'evp'), 'Evento con material pendiente, sin modo de producción ni inicio creativo; referencia manual parcial');
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 2), 'Reel Líderes', null, null, 'reel', null, null, null, 'feed',
  'event_coverage', 'available', false, 'Líderes del Mañana', null, null, null)->>'piece_id') as eva \gset
select test.ok((select material_status = 'available' and source_system is null from public.content_pieces where id = :'eva'), 'Evento con material disponible y sin referencia (opcional)');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, null, 'reel', null, null, null, 'feed', 'event_coverage', 'pending', false, ' ', null, null, null)$$, :'acc', :'w1'), 'CO422', 'Evento exige nombre');
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 3), 'Ev por defecto', null, null, 'reel', null, null, null, 'feed', 'event_coverage', null, false, 'Día MUN', null, null, null)->>'piece_id') as evd \gset
select test.ok((select material_status from public.content_pieces where id = :'evd') = 'pending', 'Evento sin estado de material → pendiente');

-- Material existente
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 4), 'Reel Día MUN', null, null, 'reel', null, null, null, 'feed',
  'existing_material', null, true, null, 'onedrive', null, 'https://onedrive.example.test/x')->>'piece_id') as mat \gset
select test.ok((select content_origin = 'existing_material' and material_status = 'available' and needs_copy and source_url = 'https://onedrive.example.test/x'
  from public.content_pieces where id = :'mat'), 'Material existente → disponible por defecto, con enlace opcional');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, null, 'reel', null, null, null, 'feed', 'existing_material', null, false, null, 'dropbox', null, null)$$, :'acc', :'w1'), '23514', 'Sistema fuente fuera de catálogo rechazado');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, null, 'reel', null, null, null, 'feed', 'existing_material', null, false, null, 'other', null, 'javascript:alert(1)')$$, :'acc', :'w1'), '23514', 'Enlace con esquema ejecutable rechazado');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, null, 'reel', null, null, null, 'feed', 'event_coverage', 'pending', false, 'Ev', null, null, null)$$, :'acc2', :'w1'), 'CO403', 'Cliente sin el origen habilitado no lo acepta');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, null, 'reel', null, null, null, 'feed', 'otro', null, false, null, null, null, null)$$, :'acc', :'w1'), 'CO422', 'Origen inválido rechazado');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, 'own_idea', 'reel', null, null, null, 'feed')$$, :'acc', :'w1'), 'CO422', 'Orgánico sigue exigiendo modo de producción');

-- Edición operativa: no invalida revisión y preserva campos
select content_revision as rev from public.content_pieces where id = :'evp' \gset
select public.update_piece(gen_random_uuid(), :'evp', test.v(:'evp'), '{"material_status":"available","needs_copy":false,"source_url":"https://hub.example.test/e/1","source_entity_id":"EV-1"}');
select test.ok((select material_status = 'available' and not needs_copy and source_url = 'https://hub.example.test/e/1' and source_entity_id = 'EV-1'
  and event_name = 'Industry Hack @ Tec' and content_origin = 'event_coverage' and content_revision = :rev from public.content_pieces where id = :'evp'),
  'Material y referencias se editan como cambio operativo y se preservan los demás campos');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"event_name":""}')$$, :'evp', test.v(:'evp')), '23514', 'Evento no puede quedar sin nombre');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"content_origin":"organic"}')$$, :'evp', test.v(:'evp')), 'CO422', 'El origen no se cambia por edición');

-- Mover preserva origen y material
select public.move_piece_day(gen_random_uuid(), :'mat', test.v(:'mat'), (:'w2'::date + 1), false);
select test.ok((select content_origin = 'existing_material' and material_status = 'available' and needs_copy and source_system = 'onedrive'
  from public.content_pieces where id = :'mat') and (select planned_date from public.planning_assignments where content_piece_id = :'mat') = :'w2'::date + 1,
  'Mover de día preserva origen, material, copy y referencia');

-- Escritura directa bloqueada
select test.throws(format($$update public.content_pieces set material_status = 'available' where id = %L$$, :'evp'), '42501', 'Material no se cambia por la API de datos');
select test.throws(format($$update public.brands set content_origins = array['organic'] where id = %L$$, :'tec'), '42501', 'Orígenes de cliente no se cambian por la API de datos');
