-- V0.2 Calendar-First: crear en un día, mover (D1), ejes por cliente, catálogos.
\set owner '00000000-0000-0000-0000-00000000000a'
select app.week_start(app.local_date(now())) as w0, app.week_start(app.local_date(now())) + 7 as w1,
       app.week_start(app.local_date(now())) + 14 as w2,
       app.week_start(app.local_date(now())) - 7 as wpast,
       greatest(now() - interval '1 minute', (app.week_start(app.local_date(now()))::timestamp at time zone 'America/Mexico_City')) as pub_at,
       ((app.week_start(app.local_date(now())) + 9)::timestamp + time '10:00') at time zone 'America/Mexico_City' as w1_wed
\gset
create function test.v(p uuid) returns integer language sql as $$ select version from public.content_pieces where id = p $$;
create function test.day(p uuid) returns date language sql as $$ select planned_date from public.planning_assignments where content_piece_id = p $$;
grant execute on all functions in schema test to authenticated;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

select test.ok((select count(*) from public.content_formats where active) = 5 and (select count(*) from public.production_modes where active) = 4, 'Catálogos de formato y modo cargados y legibles');
select (public.create_brand(gen_random_uuid(), 'Cliente A', 'cliente-a')->>'brand_id') as ba \gset
select (public.create_brand(gen_random_uuid(), 'Cliente B', 'cliente-b')->>'brand_id') as bb \gset
select (public.create_account(gen_random_uuid(), :'ba', 'Cuenta A', 'cuenta-a', null)->>'account_id') as acc \gset
select public.set_brand_appearance(gen_random_uuid(), :'ba', (select version from public.brands where id = :'ba'), 'blue', 'CA');
select test.ok((select color = 'blue' and short_label = 'CA' from public.brands where id = :'ba'), 'Apariencia de cliente configurable');
select test.throws(format($$select public.set_brand_appearance(gen_random_uuid(), %L, %s, 'neon', 'X')$$, :'ba', (select version from public.brands where id = :'ba')), '23514', 'Color fuera de paleta rechazado');

select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'ba', 'pillar', 'P1', 'Pilar A', 10, true, 'Provisional', true)->>'axis_id') as pa \gset
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'ba', 'territory', null, 'Territorio A', 10, false, null, true)->>'axis_id') as ta \gset
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'bb', 'pillar', null, 'Pilar B', 10, false, null, true)->>'axis_id') as pb \gset

-- Crear desde el calendario
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 2), 'Pieza', 'Mi idea', 'own_idea', 'carousel', 'fully_graphic', :'pa', :'ta', 'feed')->>'piece_id') as p \gset
select test.ok((select production_status = 'planned' and idea = 'Mi idea' and format_key = 'carousel' and production_mode_key = 'fully_graphic'
  and pillar_id = :'pa' and territory_id = :'ta' and origin = 'own_idea' from public.content_pieces where id = :'p'), 'Pieza creada con idea, formato, modo y ejes');
select test.ok(test.day(:'p') = :'w1'::date + 2 and (select week_start from public.planning_assignments where content_piece_id = :'p') = :'w1'::date, 'Día planeado y semana coherentes');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, 'own_idea', 'carousel', 'fully_graphic', %L, null, 'feed')$$, :'acc', :'w1', :'pb'), 'CO403', 'Pilar de otro cliente rechazado (aislamiento)');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, 'own_idea', 'carousel', 'fully_graphic', %L, null, 'feed')$$, :'acc', :'w1', :'ta'), 'CO403', 'Territorio no se usa como pilar');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, 'own_idea', 'podcast', 'fully_graphic', null, null, 'feed')$$, :'acc', :'w1'), 'CO422', 'Formato inexistente rechazado');
select test.throws(format($$select public.create_calendar_piece(gen_random_uuid(), %L, %L, 'x', null, 'own_idea', 'reel', 'fully_graphic', null, null, 'feed')$$, :'acc', :'wpast'), 'CO422', 'No se planea en semanas pasadas');

-- Mover: flexible libre, entre semanas
select public.move_piece_day(gen_random_uuid(), :'p', test.v(:'p'), (:'w2'::date + 4), false);
select test.ok(test.day(:'p') = :'w2'::date + 4 and (select week_start from public.planning_assignments where content_piece_id = :'p') = :'w2'::date, 'Flexible se mueve libremente y la semana acompaña');
select test.ok(exists (select 1 from public.operation_events where content_piece_id = :'p' and event_type = 'day_moved'), 'Movimiento registrado en historial');

-- Mover fixed fuera de su fecha: advertencia (CO412) y conversión explícita
select (public.quick_create_piece(gen_random_uuid(), :'acc', 'Fija', 'feed', 'fixed', (:'w1'::date + 1), null, null, null, null, 'idea')->>'piece_id') as pf \gset
select public.move_piece_day(gen_random_uuid(), :'pf', test.v(:'pf'), (:'w1'::date + 1), false);
select test.ok(test.day(:'pf') = :'w1'::date + 1, 'Fixed se coloca en su propia fecha');
select test.throws(format('select public.move_piece_day(gen_random_uuid(), %L, %s, %L, false)', :'pf', test.v(:'pf'), (:'w1'::date + 3)), 'CO412', 'Fixed fuera de su fecha exige confirmación');
select test.ok(test.day(:'pf') = :'w1'::date + 1, 'Sin confirmación no se mueve');
select public.move_piece_day(gen_random_uuid(), :'pf', test.v(:'pf'), (:'w1'::date + 3), true);
select test.ok(test.day(:'pf') = :'w1'::date + 3 and (select timing_mode = 'flexible' and fixed_date is null from public.content_pieces where id = :'pf'), '«Mover y convertir en flexible» aplica ambos cambios');
select test.ok(exists (select 1 from public.operation_events where content_piece_id = :'pf' and event_type = 'timing_relaxed' and before_data->>'timing_mode' = 'fixed'), 'Conversión registrada con el timing previo');

-- Ventana: dentro sí, fuera exige confirmación
select (public.quick_create_piece(gen_random_uuid(), :'acc', 'Ventana', 'feed', 'window', null, :'w1', (:'w1'::date + 2), null, null, 'idea')->>'piece_id') as pw \gset
select public.move_piece_day(gen_random_uuid(), :'pw', test.v(:'pw'), (:'w1'::date + 2), false);
select test.ok(test.day(:'pw') = :'w1'::date + 2, 'Ventana admite días dentro de su rango');
select test.throws(format('select public.move_piece_day(gen_random_uuid(), %L, %s, %L, false)', :'pw', test.v(:'pw'), :'w2'), 'CO412', 'Ventana fuera de rango exige confirmación');

-- Con publicación programada o publicada: bloqueado
reset role;
create function test.approve(p uuid) returns void language plpgsql as $$
begin
  perform public.start_production(gen_random_uuid(), p, test.v(p));
  perform public.update_piece(gen_random_uuid(), p, test.v(p), '{"objective":"o","audience":"a","production_spec_text":"s"}');
  perform public.upsert_review_packet(gen_random_uuid(), p, test.v(p), '{"experience":"e","words":{"hook":"h"},"claims_checked":true,"dependencies_checked":true}');
  perform public.submit_review(gen_random_uuid(), p, test.v(p));
  perform public.approve_piece(gen_random_uuid(), p, test.v(p), null);
end $$;
grant execute on function test.approve(uuid) to authenticated;
set role authenticated;
select public.set_account_channel(gen_random_uuid(), :'acc', 'instagram', true);
select (public.create_calendar_piece(gen_random_uuid(), :'acc', (:'w1'::date + 2), 'Programada', null, 'own_idea', 'reel', 'real_people', null, null, 'feed')->>'piece_id') as ps \gset
select test.approve(:'ps');
select (public.create_publication(gen_random_uuid(), :'ps', 'instagram', 'reel')->>'publication_id') as pubs \gset
select public.record_schedule(gen_random_uuid(), :'pubs', (select version from public.publications where id = :'pubs'), :'w1_wed', true);
select test.throws(format('select public.move_piece_day(gen_random_uuid(), %L, %s, %L, false)', :'ps', test.v(:'ps'), (:'w1'::date + 4)), 'CO403', 'Con publicación programada no se mueve');
select test.ok(test.day(:'ps') = :'w1'::date + 2, 'La fecha planeada no diverge de la programación');

select (public.quick_create_piece(gen_random_uuid(), :'acc', 'Publicada', 'feed', 'flexible', null, null, null, null, :'w0', 'idea')->>'piece_id') as pp \gset
select public.plan_piece(gen_random_uuid(), :'pp', test.v(:'pp'));
select test.approve(:'pp');
select (public.create_publication(gen_random_uuid(), :'pp', 'instagram', 'post')->>'publication_id') as pubp \gset
select public.record_published(gen_random_uuid(), :'pubp', (select version from public.publications where id = :'pubp'), :'pub_at', 'https://x.test/p', null, null, true, false);
select test.throws(format('select public.move_piece_day(gen_random_uuid(), %L, %s, %L, false)', :'pp', test.v(:'pp'), (:'w1'::date + 1)), 'CO403', 'Con publicación confirmada la fecha es histórica');

-- Integridad día/semana
reset role;
select test.throws(format($$update public.planning_assignments set planned_date = %L where content_piece_id = %L$$, (:'w2'::date + 3), :'pw'), '23514', 'El día planeado debe caer en su semana');
update public.planning_assignments set week_start = :'w2' where content_piece_id = :'pw';
select test.ok((select planned_date is null from public.planning_assignments where content_piece_id = :'pw'), 'Cambiar la semana por otra vía limpia un día que quedaría fuera');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

-- Edición de idea/formato/ejes como cambio material
select public.update_piece(gen_random_uuid(), :'p', test.v(:'p'), json_build_object('idea', 'Idea nueva', 'format_key', 'reel', 'pillar_id', '')::jsonb);
select test.ok((select idea = 'Idea nueva' and format_key = 'reel' and pillar_id is null and content_revision = 2 from public.content_pieces where id = :'p'), 'Idea, formato y ejes editables como cambio material');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, %L::jsonb)$$, :'p', test.v(:'p'), json_build_object('pillar_id', :'pb')::text), 'CO403', 'Edición no admite ejes de otro cliente');
select test.throws($$insert into public.brand_axes (brand_id, kind, name) select id, 'pillar', 'x' from public.brands limit 1$$, '42501', 'Ejes no se escriben por la API de datos');
