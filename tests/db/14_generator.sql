-- V0.4 Generador editorial: capacidad por cliente, pieza desde concepto, paquete con claims y
-- dependencias, regeneración con historial, biblioteca, aislamiento, nada aprobado y RLS.
\set owner '00000000-0000-0000-0000-00000000000a'
select app.week_start(app.local_date(now())) + 7 as w1 \gset
create function test.v(p uuid) returns integer language sql as $$ select version from public.content_pieces where id = p $$;
grant execute on all functions in schema test to authenticated;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

select (public.create_brand(gen_random_uuid(), 'IJLV prueba', 'ijlv-prueba')->>'brand_id') as bi \gset
select (public.create_brand(gen_random_uuid(), 'Tec prueba', 'tec-prueba')->>'brand_id') as bt \gset
select (public.create_account(gen_random_uuid(), :'bi', 'IJLV', 'ijlv-cuenta', null)->>'account_id') as ai \gset
select (public.create_account(gen_random_uuid(), :'bt', 'Campus', 'campus', null)->>'account_id') as at \gset
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'bi', 'pillar', 'P3', 'Crecer juntos', 30, false, null, true)->>'axis_id') as p3 \gset
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'bi', 'territory', null, 'Pensamiento', 20, false, null, true)->>'axis_id') as pe \gset
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'bt', 'pillar', null, 'Pilar Tec', 10, true, null, true)->>'axis_id') as ptec \gset
select (public.upsert_brand_source(gen_random_uuid(), null, null, :'bi', 'UNICEF', 'UNICEF', 'web', 'manual', 'https://example.test/u',
  null, null, null, null, 'active', null, null)->>'source_reference_id') as si \gset
select (public.upsert_brand_source(gen_random_uuid(), null, null, :'bt', 'Fuente Tec', null, 'decision', 'manual', null,
  null, null, null, null, 'active', null, null)->>'source_reference_id') as st \gset

-- Capacidad: sin habilitar, el servidor rechaza aunque la UI lo intente.
select test.throws(format($$select public.create_generated_piece(gen_random_uuid(), %L, %L, 'own_idea', 'x', null, 'carousel', 'fully_graphic', null, null, null, '{}')$$, :'ai', :'w1'),
  'CO403', 'Sin capacidad editorial_generation no se genera');
reset role;
update public.brands set capabilities = array['editorial_generation'] where id = :'bi';
select test.throws(format($$update public.brands set capabilities = array['otra'] where id = %L$$, :'bi'), '23514', 'Capacidades acotadas a un catálogo');
insert into public.idea_library (brand_id, code, title, pillar_id, territory_id, source_reference_id) values (:'bi', '36', 'Una pregunta antes de explicar', :'p3', :'pe', :'si');
select id as lib from public.idea_library where code = '36' \gset
select test.throws(format($$insert into public.idea_library (brand_id, code, title, pillar_id) values (%L, '01', 'x', %L)$$, :'bi', :'ptec'), 'CO403', 'Biblioteca no usa pilares de otro cliente');
select test.throws(format($$insert into public.idea_library (brand_id, code, title, source_reference_id) values (%L, '02', 'x', %L)$$, :'bi', :'st'), 'CO403', 'Biblioteca no usa fuentes de otro cliente');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);
select test.throws(format($$select public.create_generated_piece(gen_random_uuid(), %L, %L, 'generate', 'x', null, 'carousel', 'fully_graphic', null, null, null, '{}')$$, :'at', :'w1'),
  'CO403', 'Tec no tiene generación habilitada');

-- Stage A aceptada → una pieza planeada con su concepto.
select (public.create_generated_piece(gen_random_uuid(), :'ai', :'w1', 'generate', 'Una pregunta antes de explicar', 'Abrir espacio antes de explicar',
  'carousel', 'fully_graphic', :'p3', :'pe', null,
  '{"idea":"Abrir espacio","central_message":"Antes de explicar, observar juntos","objective":"Dar una herramienta","audience":"Familias"}')->>'piece_id') as gp \gset
select test.ok((select production_status = 'planned' and origin = 'generate' and objective = 'Dar una herramienta' and pillar_id = :'p3'
  from public.content_pieces where id = :'gp'), 'Concepto aceptado crea pieza en borrador (planned), nunca aprobada');
select test.ok((select package->'concept'->>'central_message' = 'Antes de explicar, observar juntos' and why_it_exists = 'Antes de explicar, observar juntos'
  from public.review_packets where content_piece_id = :'gp'), 'Concepto guardado en el Review Packet');
select test.ok((select planned_date = :'w1' from public.planning_assignments where content_piece_id = :'gp'), 'La pieza aparece en su día del calendario');
select test.throws(format($$select public.create_generated_piece(gen_random_uuid(), %L, %L, 'generate', 'x', null, 'carousel', 'fully_graphic', %L, null, null, '{}')$$, :'ai', :'w1', :'ptec'),
  'CO403', 'Concepto no puede usar pilar de otro cliente');
select test.throws(format($$select public.create_generated_piece(gen_random_uuid(), %L, %L, 'library', 'x', null, 'carousel', 'fully_graphic', null, null, null, '{}')$$, :'ai', :'w1'),
  'CO422', 'Biblioteca exige su idea de origen');
select (public.create_generated_piece(gen_random_uuid(), :'ai', :'w1', 'library', 'Una pregunta antes de explicar', null, 'motion', 'fully_graphic', :'p3', :'pe', :'lib', '{}')->>'piece_id') as lp \gset
select test.ok((select library_idea_id = :'lib' from public.content_pieces where id = :'lp'), 'Pieza desde biblioteca enlaza su idea (uso previo derivable)');
select test.ok((select count(*) = 1 from public.idea_library), 'La biblioteca no crece al crear piezas');

-- Stage B: paquete + claims + dependencias, atómico.
select public.save_generated_package(gen_random_uuid(), :'gp', test.v(:'gp'),
  '{"concept":{"idea":"Abrir espacio"},"central_message":"Antes de explicar, observar juntos","carousel_slides":[{"title":"¿Qué crees que pasa?"}]}',
  '{"hook":"¿Qué crees que pasa?","caption":"Una idea para casa","cta":"Guarda esta pregunta"}',
  format('[{"statement":"Preguntar antes de explicar favorece la observación","evidence_class":"educational_general","source_reference_id":"%s","on_screen_credit":"Fuente: UNICEF"},
          {"statement":"Hacer preguntas desarrolla el pensamiento crítico","evidence_class":"educational_general"}]', :'si')::jsonb,
  '["Revisión de Dirección Académica"]');
select test.ok((select count(*) = 2 and bool_and(generated) and bool_and(verification_status = 'pending') from public.claims where content_piece_id = :'gp'), 'Claims generados quedan pendientes de verificación humana');
select test.ok((select source_reference_id is null from public.claims where content_piece_id = :'gp' and statement like 'Hacer preguntas%'), 'Claim sin fuente queda señalado (sin fuente inventada)');
select test.ok((select on_screen_credit = 'Fuente: UNICEF' and evidence_class = 'educational_general' from public.claims where content_piece_id = :'gp' and source_reference_id = :'si'), 'Claim con fuente y crédito en pantalla');
select test.ok((select count(*) = 1 and bool_and(status = 'pending' and required) from public.approval_dependencies where content_piece_id = :'gp'), 'Dependencia de Dirección Académica creada');
select test.ok((select words->>'hook' = '¿Qué crees que pasa?' and package ? 'carousel_slides' from public.review_packets where content_piece_id = :'gp'), 'Paquete estructurado guardado en review_packets');
select test.ok((select production_status <> 'approved' from public.content_pieces where id = :'gp'), 'Nada queda aprobado');
select test.ok(array_length(public.approval_blockers(:'gp'), 1) > 0, 'La pieza no puede aprobarse sin resolver dependencia y claims');

-- Regeneración: no duplica pieza, reemplaza solo claims generados pendientes, conserva historial.
select public.save_generated_package(gen_random_uuid(), :'gp', test.v(:'gp'), '{"concept":{},"central_message":"v2"}', '{}', '[]', '["Revisión de Dirección Académica"]');
select test.ok((select count(*) = 0 from public.claims where content_piece_id = :'gp'), 'Regenerar reemplaza los claims generados pendientes');
select test.ok((select count(*) = 1 from public.approval_dependencies where content_piece_id = :'gp'), 'La dependencia no se duplica');
select test.ok((select count(*) = 2 from public.content_pieces where account_id = :'ai'), 'Regenerar no crea piezas nuevas');
select test.ok((select before_data->'package'->>'central_message' = 'Antes de explicar, observar juntos' from public.operation_events
  where content_piece_id = :'gp' and event_type = 'package_generated' order by occurred_at desc, id desc limit 1), 'El paquete anterior queda en el historial');
select test.throws(format($$select public.save_generated_package(gen_random_uuid(), %L, %s, '{}', '{}', '[{"statement":"x","source_reference_id":"%s"}]', '[]')$$, :'gp', test.v(:'gp'), :'st'),
  'CO403', 'Claim no puede citar fuente de otro cliente');
select test.throws(format($$select public.save_generated_package(gen_random_uuid(), %L, 1, '{}', '{}', '[]', '[]')$$, :'gp'), 'CO409', 'Versión obsoleta rechazada');
select test.throws(format($$select public.save_generated_package(gen_random_uuid(), %L, %s, '[]', '{}', '[]', '[]')$$, :'gp', test.v(:'gp')), 'CO422', 'Paquete que no es objeto se rechaza');

-- Regenerar concepto.
select public.save_generated_concept(gen_random_uuid(), :'gp', test.v(:'gp'), 'Escuchar antes de responder', 'Nueva idea', :'p3', :'pe', '{"central_message":"Escuchar primero"}');
select test.ok((select title = 'Escuchar antes de responder' from public.content_pieces where id = :'gp')
  and (select package = '{"concept":{"central_message":"Escuchar primero"}}'::jsonb from public.review_packets where content_piece_id = :'gp'), 'Regenerar concepto actualiza la misma pieza');

-- Registro técnico de generación.
select public.record_generation_run(:'bi', :'gp', 'package', 'anthropic', 'modelo', repeat('a', 64), 'invalid_output', 'schema', 120, 30);
select test.ok((select count(*) = 1 from public.generation_runs where status = 'invalid_output'), 'Fallo de generación registrado sin contenido');
select (public.create_calendar_piece(gen_random_uuid(), :'at', :'w1', 'Pieza Tec', null, 'own_idea', 'reel', 'real_people', null, null, 'feed')->>'piece_id') as tp \gset
select test.throws(format($$select public.record_generation_run(%L, %L, 'package', 'anthropic', null, null, 'failed', null, null, null)$$, :'bi', :'tp'), 'CO403', 'Run no se asocia a pieza de otro cliente');
select test.throws(format($$select public.save_generated_package(gen_random_uuid(), %L, %s, '{}', '{}', '[]', '[]')$$, :'tp', test.v(:'tp')), 'CO403', 'Pieza Tec no recibe paquete generado');
select test.throws(format($$select public.record_generation_run(%L, null, 'ideas', 'anthropic', null, null, 'failed', null, null, null)$$, :'bt'), 'CO403', 'Run de cliente sin generación rechazado');

-- RLS
select test.throws(format($$update public.review_packets set package = '{}' where content_piece_id = %L$$, :'gp'), '42501', 'Paquete no se escribe directo por la API');
select test.throws($$insert into public.idea_library (brand_id, code, title) values (gen_random_uuid(), '99', 'x')$$, '42501', 'Biblioteca no se escribe por la API');
reset role;
select test.throws(format($$delete from public.generation_runs where brand_id = %L$$, :'bi'), 'CO403', 'Registro de generación append-only');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b')::text, false);
select test.ok((select count(*) from public.idea_library) = 0 and (select count(*) from public.generation_runs) = 0, 'Usuario no autorizado no ve biblioteca ni registros');
select test.throws(format($$select public.create_generated_piece(gen_random_uuid(), %L, %L, 'generate', 'x', null, 'carousel', 'fully_graphic', null, null, null, '{}')$$, :'ai', :'w1'), 'CO401', 'Usuario no autorizado no genera');
reset role;
set role anon;
select test.throws('select * from public.idea_library', '42501', 'Anónimo no lee la biblioteca');
reset role;
