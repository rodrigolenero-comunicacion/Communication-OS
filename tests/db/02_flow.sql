-- Flujo vertical y casos R05–R22, C06, C20, S06, S11 contra PostgreSQL.
\set owner '00000000-0000-0000-0000-00000000000a'

-- Semanas relativas al reloj real del servidor.
select app.week_start(app.local_date(now())) as w0,
       app.week_start(app.local_date(now())) + 7 as w1,
       app.week_start(app.local_date(now())) + 14 as w2,
       greatest(now() - interval '1 minute',
                (app.week_start(app.local_date(now()))::timestamp at time zone 'America/Mexico_City')) as pub_at,
       ((app.week_start(app.local_date(now())) + 9)::timestamp + time '10:00') at time zone 'America/Mexico_City' as w1_wed
\gset

create function test.v(p_piece uuid) returns integer language sql as $$ select version from public.content_pieces where id = p_piece $$;
create function test.pv(p_pub uuid) returns integer language sql as $$ select version from public.publications where id = p_pub $$;
create function test.status(p_piece uuid) returns text language sql as $$ select production_status from public.content_pieces where id = p_piece $$;
create function test.events() returns bigint language sql as $$ select count(*) from public.operation_events $$;

/** Lleva una pieza nueva hasta approved por el camino de comandos. */
create function test.make_approved(p_account uuid, p_title text, p_week date) returns uuid language plpgsql as $$
declare
  v_piece uuid;
begin
  v_piece := (public.create_piece(gen_random_uuid(), p_account, p_title, 'feed', 'flexible', null, null, null)->>'piece_id')::uuid;
  perform public.plan_piece(gen_random_uuid(), v_piece, test.v(v_piece));
  if p_week is not null then perform public.assign_week(gen_random_uuid(), v_piece, test.v(v_piece), p_week); end if;
  perform public.start_production(gen_random_uuid(), v_piece, test.v(v_piece));
  perform public.update_piece(gen_random_uuid(), v_piece, test.v(v_piece),
    '{"objective":"Objetivo de prueba","audience":"Audiencia de prueba","production_spec_text":"Spec de prueba"}');
  perform public.upsert_review_packet(gen_random_uuid(), v_piece, test.v(v_piece),
    '{"experience":"Experiencia","words":{"hook":"Gancho"},"claims_checked":true,"dependencies_checked":true}');
  perform public.submit_review(gen_random_uuid(), v_piece, test.v(v_piece));
  perform public.approve_piece(gen_random_uuid(), v_piece, test.v(v_piece), null);
  return v_piece;
end $$;
grant execute on all functions in schema test to authenticated;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

-- Portfolio ----------------------------------------------------------------
select (public.create_brand(gen_random_uuid(), 'Marca Flujo', 'marca-flujo')->>'brand_id') as brand \gset
select (public.create_brand(gen_random_uuid(), 'Otra Marca', 'otra-marca')->>'brand_id') as brand2 \gset
select (public.create_account(gen_random_uuid(), :'brand', 'Cuenta Flujo', 'cuenta-flujo', null)->>'account_id') as account \gset
select (public.create_account(gen_random_uuid(), :'brand2', 'Cuenta Ajena', 'cuenta-ajena', null)->>'account_id') as account2 \gset
select public.set_account_channel(gen_random_uuid(), :'account', 'instagram', true);
select public.set_account_channel(gen_random_uuid(), :'account', 'facebook', true);
select test.ok((select coverage_mode from public.accounts where id = :'account') = 'unconfigured', 'Cuenta nueva empieza unconfigured');

select test.throws(format($$select public.set_target_policy(gen_random_uuid(), %L, 'feed', 1, 7, %L)$$, :'account', (:'w0'::date + 1)), 'CO422', 'Objetivo exige lunes');
select test.throws(format($$select public.set_target_policy(gen_random_uuid(), %L, 'feed', 1, 7, %L)$$, :'account', (:'w0'::date - 7)), 'CO422', 'Objetivo no reescribe semanas pasadas');
select test.throws(format($$select public.set_target_policy(gen_random_uuid(), %L, 'feed', 0, 7, %L)$$, :'account', :'w0'), '23514', 'required_count > 0');
select public.set_target_policy(gen_random_uuid(), :'account', 'feed', 1, 7, :'w0');
select test.ok((select coverage_mode from public.accounts where id = :'account') = 'weekly', 'Primer objetivo activa modo weekly');
select public.set_target_policy(gen_random_uuid(), :'account', 'feed', 2, 7, :'w0');
select test.ok((select count(*) from public.editorial_targets where account_id = :'account') = 1
  and (select required_count from public.editorial_targets where account_id = :'account') = 2, 'Misma fecha de vigencia actualiza la política');
select public.set_target_policy(gen_random_uuid(), :'account', 'feed', 1, 7, :'w1');
select test.ok((select active_until from public.editorial_targets where account_id = :'account' and active_from = :'w0') = :'w1'::date,
  'Nueva vigencia cierra la anterior sin solaparse');
select version as av from public.accounts where id = :'account' \gset
select test.throws(format($$select public.set_coverage_mode(gen_random_uuid(), %L, %s, 'not_required', 'x')$$, :'account', :av), 'CO422', 'not_required exige cerrar políticas vigentes');

-- Pieza local hasta aprobación ----------------------------------------------
select (public.create_piece(gen_random_uuid(), :'account', 'Pieza uno', 'feed', 'flexible', null, null, null)->>'piece_id') as p1 \gset
select test.ok(test.status(:'p1') = 'idea', 'Pieza nueva en idea');
select test.throws(format('select public.start_production(gen_random_uuid(), %L, %s)', :'p1', test.v(:'p1')), 'CO403', 'idea no salta a producción');
select public.plan_piece(gen_random_uuid(), :'p1', test.v(:'p1'));
select test.throws(format('select public.assign_week(gen_random_uuid(), %L, %s, %L)', :'p1', test.v(:'p1'), (:'w0'::date - 7)), 'CO422', 'No se asignan semanas pasadas');
select public.assign_week(gen_random_uuid(), :'p1', test.v(:'p1'), :'w1');
select test.ok((select week_start from public.planning_assignments where content_piece_id = :'p1') = :'w1'::date
  and not exists (select 1 from public.publications where content_piece_id = :'p1'), 'Asignar no crea publicación ni programación');
select public.start_production(gen_random_uuid(), :'p1', test.v(:'p1'));
select test.throws(format('select public.submit_review(gen_random_uuid(), %L, %s)', :'p1', test.v(:'p1')), 'CO422', 'Enviar a revisión exige packet completo');
select public.update_piece(gen_random_uuid(), :'p1', test.v(:'p1'), '{"objective":"Explicar","audience":"Padres","production_spec_url":"https://example.test/spec"}');
select test.ok((select content_revision from public.content_pieces where id = :'p1') = 2, 'Edición material incrementa revisión');
select public.update_piece(gen_random_uuid(), :'p1', test.v(:'p1'), '{"priority":"high"}');
select test.ok((select content_revision from public.content_pieces where id = :'p1') = 2, 'Edición operativa no incrementa revisión');
select test.throws(format($$select public.upsert_review_packet(gen_random_uuid(), %L, %s, '{"words":{"hook":"x","script":"<b>"}}')$$, :'p1', test.v(:'p1')), 'CO422', 'Words rechaza campos desconocidos');
select public.upsert_review_packet(gen_random_uuid(), :'p1', test.v(:'p1'),
  '{"what_is_it":"Reel","experience":"Recorrido","words":{"hook":"Gancho","caption":"Caption"},"preview_kind":"text","claims_checked":true,"dependencies_checked":true}');
select (public.upsert_claim(gen_random_uuid(), :'p1', test.v(:'p1'), null, '85 alumnos inscritos', 'fact', null, null)->>'claim_id') as claim \gset
select (public.upsert_dependency(gen_random_uuid(), :'p1', test.v(:'p1'), null, 'Confirmación de autorización de imagen', true)->>'dependency_id') as dep \gset
select public.submit_review(gen_random_uuid(), :'p1', test.v(:'p1'));
select test.ok(test.status(:'p1') = 'in_review', 'Packet completo pasa a in_review');

-- R09 aprobar con claim pendiente
select test.events() as ev_before \gset
select test.throws(format('select public.approve_piece(gen_random_uuid(), %L, %s, null)', :'p1', test.v(:'p1')), 'CO422', 'R09 aprobar con claim pendiente se rechaza');
select test.ok(test.status(:'p1') = 'in_review' and (select count(*) from public.review_decisions where content_piece_id = :'p1') = 0, 'R09 sigue in_review y sin decisiones');
select test.throws(format($$select public.verify_claim(gen_random_uuid(), %L, %s, %L, 'supported', 'ok', null, null)$$, :'p1', test.v(:'p1'), :'claim'), 'CO422', 'Claim soportado exige fuente o localizador');
select public.verify_claim(gen_random_uuid(), :'p1', test.v(:'p1'), :'claim', 'supported', 'Cotejado con lista oficial', null, 'Lista de inscripción, hoja 2');
select test.throws(format('select public.approve_piece(gen_random_uuid(), %L, %s, null)', :'p1', test.v(:'p1')), 'CO422', 'Dependencia requerida pendiente bloquea aprobación');
select public.set_dependency_status(gen_random_uuid(), :'p1', test.v(:'p1'), :'dep', 'satisfied', 'Confirmado en el sistema del colegio, ref. 12');

-- R11 fallo al insertar la decisión revierte todo
reset role;
create function test.boom() returns trigger language plpgsql as $$ begin raise exception 'fallo simulado'; end $$;
create trigger boom before insert on public.review_decisions for each row execute function test.boom();
set role authenticated;
select test.throws(format('select public.approve_piece(gen_random_uuid(), %L, %s, null)', :'p1', test.v(:'p1')), 'P0001', 'R11 error simulado en la decisión');
select test.ok(test.status(:'p1') = 'in_review' and (select approved_revision from public.content_pieces where id = :'p1') is null, 'R11 no queda pieza approved sin decisión');
reset role;
drop trigger boom on public.review_decisions;
set role authenticated;

-- R10 / R21 aprobación atómica e idempotente
select gen_random_uuid() as approve_req \gset
select test.v(:'p1') as p1v \gset
select public.approve_piece(:'approve_req', :'p1', :p1v, 'Listo');
select test.ok(test.status(:'p1') = 'approved'
  and (select approved_revision = content_revision from public.content_pieces where id = :'p1'), 'R10 aprobada con la revisión vigente');
select test.ok((select count(*) = 1 from public.review_decisions where content_piece_id = :'p1' and action = 'approved'
  and content_revision = (select content_revision from public.content_pieces where id = :'p1')), 'R10 una decisión con la revisión exacta');
select test.ok((select packet_snapshot->'claims'->0->>'verification_status' = 'supported'
  and packet_snapshot->'packet'->'words'->>'hook' = 'Gancho'
  and actor_id = :'owner'
  from public.review_decisions where content_piece_id = :'p1' and action = 'approved'), 'R10 snapshot con claims, words y actor');
select test.ok((public.approve_piece(:'approve_req', :'p1', :p1v, 'Listo')->>'replayed')::boolean, 'R21 mismo request_id devuelve resultado previo');
select test.ok((select count(*) from public.review_decisions where content_piece_id = :'p1') = 1, 'R21 una sola decisión');

-- R12 / S11 no se edita una pieza aprobada
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"title":"Nuevo"}')$$, :'p1', test.v(:'p1')), 'CO403', 'R12 título de approved no se edita');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"timing_mode":"fixed","fixed_date":"2030-01-01"}')$$, :'p1', test.v(:'p1')), 'CO403', 'S11 timing de approved no se edita');
select test.throws(format($$select public.upsert_claim(gen_random_uuid(), %L, %s, null, 'Nuevo', 'fact', null, null)$$, :'p1', test.v(:'p1')), 'CO403', 'S11 claims de approved no se editan');
select test.throws(format($$select public.set_dependency_status(gen_random_uuid(), %L, %s, %L, 'pending', null)$$, :'p1', test.v(:'p1'), :'dep'), 'CO403', 'S11 dependencias de approved no se reabren');
select test.throws(format($$select public.upsert_review_packet(gen_random_uuid(), %L, %s, '{"experience":"x"}')$$, :'p1', test.v(:'p1')), 'CO403', 'S11 packet de approved no se edita');

-- Publicaciones ------------------------------------------------------------
select (public.create_publication(gen_random_uuid(), :'p1', 'instagram', 'reel')->>'publication_id') as ig1 \gset
select test.throws(format($$select public.create_publication(gen_random_uuid(), %L, 'instagram', 'reel')$$, :'p1'), 'CO422', 'Registro duplicado canal/formato rechazado');
select test.throws(format('select public.record_schedule(gen_random_uuid(), %L, %s, %L, false)', :'ig1', test.pv(:'ig1'), :'w1_wed'), 'CO422', 'Programar exige confirmación externa');
select test.throws(format('select public.record_schedule(gen_random_uuid(), %L, %s, %L, true)', :'ig1', test.pv(:'ig1'), now() - interval '1 hour'), 'CO422', 'Programar exige fecha futura');
select test.throws(format('select public.record_schedule(gen_random_uuid(), %L, %s, %L, true)', :'ig1', test.pv(:'ig1'), (:'w1_wed'::timestamptz + interval '7 days')), 'CO422', 'Programar fuera de la semana asignada se rechaza');
select public.record_schedule(gen_random_uuid(), :'ig1', test.pv(:'ig1'), :'w1_wed', true);
select test.ok((select status from public.publications where id = :'ig1') = 'scheduled', 'Programación registrada');

-- R07 cambiar de semana con destinos scheduled
select test.throws(format('select public.assign_week(gen_random_uuid(), %L, %s, %L)', :'p1', test.v(:'p1'), :'w2'), 'CO403', 'R07 reasignar con scheduled exige resolver primero');
select test.throws(format('select public.unassign_week(gen_random_uuid(), %L, %s)', :'p1', test.v(:'p1')), 'CO403', 'Quitar asignación con scheduled se rechaza');
select test.throws(format($$select public.hold_piece(gen_random_uuid(), %L, %s, 'motivo')$$, :'p1', test.v(:'p1')), 'CO403', 'Hold con destino scheduled se rechaza');
select test.throws(format($$select public.archive_piece(gen_random_uuid(), %L, %s, 'motivo')$$, :'p1', test.v(:'p1')), 'CO403', 'Archivar con scheduled se rechaza');

-- R05 publicación futura: sin fila ni evento parcial
select test.events() as ev_before \gset
select test.throws(format($$select public.record_published(gen_random_uuid(), %L, %s, %L, 'https://instagram.example.test/p/1', null, null, true, false)$$, :'ig1', test.pv(:'ig1'), now() + interval '1 hour'), 'CO422', 'R05 published con fecha futura se rechaza');
select test.ok(test.events() = :ev_before and (select status from public.publications where id = :'ig1') = 'scheduled', 'R05 sin cambios ni eventos parciales');

-- R08 cancelar el único destino
select test.throws(format($$select public.cancel_publication(gen_random_uuid(), %L, %s, '')$$, :'ig1', test.pv(:'ig1')), 'CO422', 'Cancelar exige motivo');
select public.cancel_publication(gen_random_uuid(), :'ig1', test.pv(:'ig1'), 'Se movió la campaña');
select test.ok((select status = 'cancelled' and scheduled_at is null from public.publications where id = :'ig1')
  and test.status(:'p1') = 'approved'
  and exists (select 1 from public.planning_assignments where content_piece_id = :'p1'), 'R08 destino cancelado; pieza sigue aprobada y asignada');
select test.ok(exists (select 1 from public.operation_events where publication_id = :'ig1' and event_type = 'publication_cancelled' and before_data->>'scheduled_at' is not null), 'Fecha de programación previa conservada en historial');
select public.reopen_publication(gen_random_uuid(), :'ig1', test.pv(:'ig1'), 'Se retoma');
select test.ok((select status from public.publications where id = :'ig1') = 'unscheduled', 'Reabrir cancelado vuelve a unscheduled');

-- Hold y liberación sobre approved
select public.hold_piece(gen_random_uuid(), :'p1', test.v(:'p1'), 'Esperar visto bueno de Dirección');
select test.throws(format($$select public.create_publication(gen_random_uuid(), %L, 'facebook', 'reel')$$, :'p1'), 'CO403', 'Pieza en hold no crea destinos');
select test.throws(format('select public.record_schedule(gen_random_uuid(), %L, %s, %L, true)', :'ig1', test.pv(:'ig1'), :'w1_wed'), 'CO403', 'Pieza en hold no se programa');
select public.release_hold(gen_random_uuid(), :'p1', test.v(:'p1'), null);
select test.ok(test.status(:'p1') = 'approved' and (select approved_revision = content_revision and not on_hold from public.content_pieces where id = :'p1'), 'Liberar hold conserva la aprobación de la misma revisión');
select test.ok((select array_agg(action order by decided_at, id) from public.review_decisions where content_piece_id = :'p1') = array['approved','hold','released'], 'Historial de decisiones append-only');

-- C08 reabrir approved invalida la aprobación
select test.throws(format($$select public.reopen_approved(gen_random_uuid(), %L, %s, '')$$, :'p1', test.v(:'p1')), 'CO422', 'Reabrir exige motivo');
select public.reopen_approved(gen_random_uuid(), :'p1', test.v(:'p1'), 'Cambiar caption');
select test.ok(test.status(:'p1') = 'in_production' and (select approved_revision is null from public.content_pieces where id = :'p1'), 'C08 reabrir invalida la aprobación vigente');
-- R06 sin aprobación vigente no se programa ni se crea destino
select test.throws(format('select public.record_schedule(gen_random_uuid(), %L, %s, %L, true)', :'ig1', test.pv(:'ig1'), :'w1_wed'), 'CO403', 'R06 programar sin aprobación vigente se rechaza');
select test.throws(format($$select public.create_publication(gen_random_uuid(), %L, 'facebook', 'reel')$$, :'p1'), 'CO403', 'R06 crear destino sin aprobación vigente se rechaza');

-- C09 pedir cambios exige instrucción
select public.submit_review(gen_random_uuid(), :'p1', test.v(:'p1'));
select test.throws(format($$select public.request_changes(gen_random_uuid(), %L, %s, ' ')$$, :'p1', test.v(:'p1')), 'CO422', 'C09 pedir cambios exige comentario');
select public.request_changes(gen_random_uuid(), :'p1', test.v(:'p1'), 'Acortar el gancho');
select test.ok(test.status(:'p1') = 'changes_requested', 'C09 queda en changes_requested');

-- R02/R03/R13 publicación real en la semana actual ---------------------------
select test.make_approved(:'account', 'Pieza dos', :'w0') as p2 \gset
select (public.create_publication(gen_random_uuid(), :'p2', 'instagram', 'post')->>'publication_id') as ig2 \gset
select test.throws(format($$select public.record_published(gen_random_uuid(), %L, %s, %L, null, null, null, true, false)$$, :'ig2', test.pv(:'ig2'), :'pub_at'), 'CO422', 'Publicado exige URL o nota');
select test.throws(format($$select public.record_published(gen_random_uuid(), %L, %s, %L, 'https://x.test/1', null, null, false, false)$$, :'ig2', test.pv(:'ig2'), :'pub_at'), 'CO422', 'Publicado exige confirmación humana');
select public.record_published(gen_random_uuid(), :'ig2', test.pv(:'ig2'), :'pub_at', 'https://instagram.example.test/p/2', 'IG-2', null, true, false);
select (public.create_publication(gen_random_uuid(), :'p2', 'facebook', 'post')->>'publication_id') as fb2 \gset
select public.record_published(gen_random_uuid(), :'fb2', test.pv(:'fb2'), :'pub_at', null, null, 'Visto en la página', true, false);
select test.ok((select count(distinct pub.content_piece_id) from public.publications pub
  join public.planning_assignments a on a.content_piece_id = pub.content_piece_id
  where pub.status = 'published' and a.week_start = :'w0'::date) = 1, 'R03 dos destinos publicados = una unidad editorial');
select test.ok(exists (select 1 from public.operation_events where publication_id = :'ig2' and event_type = 'publication_published'
  and (after_data->>'approved_revision')::int = (select approved_revision from public.content_pieces where id = :'p2')), 'Evento de publicación captura la revisión aprobada');
select test.throws(format($$select public.reopen_approved(gen_random_uuid(), %L, %s, 'x')$$, :'p2', test.v(:'p2')), 'CO403', 'R13 pieza publicada no se reabre');
select test.throws(format('select public.assign_week(gen_random_uuid(), %L, %s, %L)', :'p2', test.v(:'p2'), :'w1'), 'CO403', 'Asignación con publicación confirmada no se mueve');
select test.throws(format($$select public.cancel_publication(gen_random_uuid(), %L, %s, 'x')$$, :'ig2', test.pv(:'ig2')), 'CO403', 'published no retrocede por CRUD normal');
select test.throws(format($$select public.correct_publication(gen_random_uuid(), %L, %s, %L, 'https://x.test/2b', null, null, '')$$, :'ig2', test.pv(:'ig2'), :'pub_at'), 'CO422', 'Corrección exige motivo');
select public.correct_publication(gen_random_uuid(), :'ig2', test.pv(:'ig2'), :'pub_at', 'https://instagram.example.test/p/2b', 'IG-2', null, 'URL corregida');
select test.ok((select external_url from public.publications where id = :'ig2') = 'https://instagram.example.test/p/2b'
  and exists (select 1 from public.operation_events where publication_id = :'ig2' and event_type = 'publication_corrected'
              and before_data->>'external_url' = 'https://instagram.example.test/p/2'), 'Corrección explícita conserva el valor previo');
select (public.create_publication(gen_random_uuid(), :'p2', 'instagram', 'story')->>'publication_id') as ig2s \gset
select test.throws(format($$select public.record_published(gen_random_uuid(), %L, %s, %L, 'https://x.test/3', 'IG-2', null, true, false)$$, :'ig2s', test.pv(:'ig2s'), :'pub_at'), 'CO422', 'Identificador externo único por cuenta y canal');
select version as bv from public.accounts where id = :'account' \gset

-- Publicación real fuera de la semana asignada (corrección explícita)
select test.make_approved(:'account', 'Pieza tres', :'w1') as p3 \gset
select (public.create_publication(gen_random_uuid(), :'p3', 'instagram', 'post')->>'publication_id') as ig3 \gset
select test.throws(format($$select public.record_published(gen_random_uuid(), %L, %s, %L, 'https://x.test/p3', null, null, true, false)$$, :'ig3', test.pv(:'ig3'), :'pub_at'), 'CO422', 'Publicación fuera de semana exige corrección explícita');
select public.record_published(gen_random_uuid(), :'ig3', test.pv(:'ig3'), :'pub_at', 'https://x.test/p3', null, null, true, true);
select test.ok((select week_start from public.planning_assignments where content_piece_id = :'p3') = :'w0'::date
  and exists (select 1 from public.operation_events where content_piece_id = :'p3' and event_type = 'assignment_corrected'),
  'Corrección mueve la asignación completa a la semana real y lo registra');

-- R22 concurrencia optimista -------------------------------------------
select test.make_approved(:'account', 'Pieza cuatro', null) as p4 \gset
select test.v(:'p4') as p4v \gset
select public.assign_week(gen_random_uuid(), :'p4', :p4v, :'w1');
select test.throws(format('select public.assign_week(gen_random_uuid(), %L, %s, %L)', :'p4', :p4v, :'w2'), 'CO409', 'R22 misma expected_version: el segundo recibe conflicto');
select test.ok((select week_start from public.planning_assignments where content_piece_id = :'p4') = :'w1'::date, 'R22 sin sobrescritura');
-- C06/S06 una sola asignación por pieza
select test.ok((select count(*) from public.planning_assignments where content_piece_id = :'p4') = 1, 'C06 una asignación por pieza');
select public.assign_week(gen_random_uuid(), :'p4', test.v(:'p4'), :'w2');
select test.ok((select count(*) from public.planning_assignments where content_piece_id = :'p4') = 1
  and (select week_start from public.planning_assignments where content_piece_id = :'p4') = :'w2'::date, 'C06 reasignar reemplaza, no duplica');
select public.unassign_week(gen_random_uuid(), :'p4', test.v(:'p4'));
select test.ok(not exists (select 1 from public.planning_assignments where content_piece_id = :'p4'), 'Quitar asignación devuelve la pieza a reserva');

-- C20 timing en base de datos -------------------------------------------
select (public.create_piece(gen_random_uuid(), :'account', 'Fija', 'feed', 'fixed', (:'w1'::date + 2), null, null)->>'piece_id') as pf \gset
select test.throws(format('select public.assign_week(gen_random_uuid(), %L, %s, %L)', :'pf', test.v(:'pf'), :'w2'), 'CO422', 'C20 pieza fija no se asigna a otra semana');
select public.assign_week(gen_random_uuid(), :'pf', test.v(:'pf'), :'w1');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"fixed_date":"%s"}')$$, :'pf', test.v(:'pf'), (:'w2'::date + 1)), 'CO422', 'Cambio de timing incompatible con la semana asignada se rechaza');
select test.throws(format($$select public.create_piece(gen_random_uuid(), %L, 'Mala', 'feed', 'window', null, %L, %L)$$, :'account', :'w2', :'w1'), '23514', 'Ventana invertida rechazada');
select test.throws(format($$select public.create_piece(gen_random_uuid(), %L, 'Mala', 'feed', 'fixed', null, null, null)$$, :'account'), '23514', 'Timing fijo sin fecha rechazado');

-- Espejos externos y fuentes ------------------------------------------------
select (public.create_external_mirror(gen_random_uuid(), :'account', 'Cobertura ST Hub', 'feed', 'st_hub', 'editorial_piece', 'EP-42', 'https://sthub.example.test/ep/42', null)->>'piece_id') as m1 \gset
select test.throws(format($$select public.create_external_mirror(gen_random_uuid(), %L, 'Duplicado', 'feed', 'st_hub', 'editorial_piece', 'EP-42', 'https://sthub.example.test/ep/42', null)$$, :'account'), '23505', 'Identidad de espejo única');
select test.throws(format('select public.approve_piece(gen_random_uuid(), %L, %s, null)', :'m1', test.v(:'m1')), 'CO403', 'R14 espejo no se aprueba localmente');
select test.throws(format('select public.submit_review(gen_random_uuid(), %L, %s)', :'m1', test.v(:'m1')), 'CO403', 'R14 espejo no tiene transiciones locales');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"title":"x"}')$$, :'m1', test.v(:'m1')), 'CO403', 'Contenido de espejo no se edita localmente');
select public.update_piece(gen_random_uuid(), :'m1', test.v(:'m1'), '{"priority":"high"}');
select test.ok((select priority from public.content_pieces where id = :'m1') = 'high', 'Campos de coordinación del espejo sí se editan');
select test.throws(format($$select public.record_source_observation(gen_random_uuid(), %L, 'pending_review', 'in_review', false, false, %L, null)$$, :'m1', now() + interval '1 day'), 'CO422', 'Observación no puede ser futura');
select public.record_source_observation(gen_random_uuid(), :'m1', 'contents.completed', 'unknown', false, false, now() - interval '1 hour', 'Visto en ST Hub');
select test.ok((select source_state_raw from public.source_observations o join public.source_references r on r.id = o.source_reference_id where r.content_piece_id = :'m1') = 'contents.completed', 'R16 estado bruto conservado sin mapear');
select public.assign_week(gen_random_uuid(), :'m1', test.v(:'m1'), :'w1');
select test.throws(format($$select public.create_publication(gen_random_uuid(), %L, 'instagram', 'post')$$, :'m1'), 'CO403', 'R16 completed/unknown no habilita publicación');
select test.throws(format($$select public.record_source_observation(gen_random_uuid(), %L, 'approved', 'approved', false, false, %L, ' ')$$, :'m1', now() - interval '30 minutes'), '23514', 'Observación approved exige evidencia');
select test.throws(format($$select public.record_source_observation(gen_random_uuid(), %L, 'in_review', 'in_review', true, false, %L, 'x')$$, :'m1', now() - interval '30 minutes'), 'CO422', 'Revisión completa solo sobre approved');
select public.record_source_observation(gen_random_uuid(), :'m1', 'Audiovisual v10 aprobado; caption y portada pendientes', 'approved', false, false, now() - interval '20 minutes', 'Captura del registro de aprobaciones');
select test.throws(format($$select public.create_publication(gen_random_uuid(), %L, 'instagram', 'post')$$, :'m1'), 'CO403', 'R17 aprobación parcial no habilita publicación ni SAFE');
select public.record_source_observation(gen_random_uuid(), :'m1', 'approved (paquete completo)', 'approved', true, false, now() - interval '10 minutes', 'Caption y portada confirmadas en la fuente');
select (public.create_publication(gen_random_uuid(), :'m1', 'instagram', 'post')->>'publication_id') as mpub \gset
select test.ok((select record_kind from public.publications where id = :'mpub') = 'source_observation', 'R15 publicación de espejo queda como observación');
select test.throws(format('update public.source_observations set evidence_note = %L', 'x'), '42501', 'Observaciones no se editan desde la API');

-- R18 contexto de otro cliente no respalda claims
select (public.create_context_reference(gen_random_uuid(), 'account', :'account2', null, 'ijlv_editorial', 'Sistema editorial ajeno', 'https://ajeno.example.test', null)->>'source_reference_id') as foreign_ref \gset
select (public.create_context_reference(gen_random_uuid(), 'brand', null, :'brand', 'solotu_cerebro', 'Contexto propio', null, 'Sección oferta')->>'source_reference_id') as own_ref \gset
select (public.create_piece(gen_random_uuid(), :'account', 'Con claims', 'feed', 'flexible', null, null, null)->>'piece_id') as pc \gset
select test.throws(format($$select public.upsert_claim(gen_random_uuid(), %L, %s, null, 'Dato', 'fact', %L, null)$$, :'pc', test.v(:'pc'), :'foreign_ref'), 'CO403', 'R18 fuente de otro cliente rechazada');
select public.upsert_claim(gen_random_uuid(), :'pc', test.v(:'pc'), null, 'Dato', 'fact', :'own_ref', null);
select test.ok((select count(*) from public.claims where content_piece_id = :'pc') = 1, 'R18 fuente de la misma marca aceptada');

-- R19 reserva no incluye ideas
select test.ok(test.status(:'pc') = 'idea', 'R19 ficha/idea no es pieza aprobada');

-- Archivo conserva historia
select public.archive_piece(gen_random_uuid(), :'pc', test.v(:'pc'), 'Descartada');
select test.ok((select archived_at is not null from public.content_pieces where id = :'pc')
  and (select count(*) from public.claims where content_piece_id = :'pc') = 1, 'Archivar no borra datos');
