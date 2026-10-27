-- S01–S06, S08, S10: acceso anónimo, usuario fuera de allowlist, escrituras directas.
\set owner '00000000-0000-0000-0000-00000000000a'
\set intruder '00000000-0000-0000-0000-00000000000b'

-- Datos base creados por el usuario autorizado.
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);
select (public.create_brand(gen_random_uuid(), 'Marca prueba', 'marca-prueba')->>'brand_id') as brand \gset
select (public.create_account(gen_random_uuid(), :'brand', 'Cuenta prueba', 'cuenta-prueba', null)->>'account_id') as account \gset
select (public.create_piece(gen_random_uuid(), :'account', 'Pieza prueba', 'feed', 'flexible', null, null, null)->>'piece_id') as piece \gset
select test.ok((select count(*) from public.content_pieces) = 1, 'S03 autorizado lee sus datos');
select test.ok((public.whoami()->>'authorized')::boolean, 'whoami reconoce al usuario autorizado');

-- S01 anónimo -------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select test.throws('select * from public.content_pieces', '42501', 'S01 anónimo no lee tablas operativas');
select test.throws('select * from public.brands', '42501', 'S01 anónimo no lee marcas');
select test.throws($$select public.create_brand(gen_random_uuid(), 'x', 'x')$$, '42501', 'S01 anónimo no invoca comandos');
select test.throws('select * from public.authorized_users', '42501', 'S01 anónimo no lee allowlist');

-- S02 autenticado fuera de allowlist -------------------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'intruder')::text, false);
select test.ok((select count(*) from public.content_pieces) = 0, 'S02 no autorizado no ve piezas');
select test.ok((select count(*) from public.brands) = 0, 'S02 no autorizado no ve marcas');
select test.ok((select count(*) from public.channels) = 0, 'S02 no autorizado no ve catálogo');
select test.throws($$select public.create_brand(gen_random_uuid(), 'x', 'x')$$, 'CO401', 'S02 no autorizado no ejecuta comandos');
select test.throws(format('select public.plan_piece(gen_random_uuid(), %L, 1)', :'piece'), 'CO401', 'S02 no autorizado no transiciona piezas');
select test.throws(format($$insert into public.authorized_users (user_id, active) values (%L, true)$$, :'intruder'), '42501', 'S02 no puede insertarse en allowlist');
select test.throws(format($$update public.authorized_users set active = true where user_id = %L$$, :'intruder'), '42501', 'S02 no puede activarse');
select test.ok(not (public.whoami()->>'authorized')::boolean, 'whoami informa no autorizado');

-- S04/S05/S06 escrituras directas del usuario autorizado -------------------
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);
select test.throws(format($$update public.content_pieces set production_status = 'approved' where id = %L$$, :'piece'), '42501', 'S04 no cambia production_status por la API de datos');
select test.throws(format($$update public.content_pieces set approved_revision = 1, approved_at = now() where id = %L$$, :'piece'), '42501', 'S04 no fija aprobación directamente');
select test.throws(format($$update public.content_pieces set title = 'x' where id = %L$$, :'piece'), '42501', 'S04 no edita campos sin comando');
select test.throws(format($$insert into public.review_decisions (content_piece_id, content_revision, action, actor_id, packet_snapshot, request_id) values (%L, 1, 'approved', %L, '{}', gen_random_uuid())$$, :'piece', :'owner'), '42501', 'S04 no inserta decisiones directamente');
select test.throws(format($$insert into public.planning_assignments (content_piece_id, week_start) values (%L, '2030-01-07')$$, :'piece'), '42501', 'S06 no inserta asignaciones directamente');
select test.throws($$delete from public.operation_events$$, '42501', 'S05 no borra eventos');
select test.throws($$update public.operation_events set reason = 'x'$$, '42501', 'S05 no edita eventos');
select test.throws($$select app.fail('x')$$, '42501', 'Helpers internos de app.* no son invocables');

-- S05 inmutabilidad también para el propietario de las tablas -------------
reset role;
select test.throws($$update public.operation_events set reason = 'x'$$, 'CO403', 'S05 historial inmutable incluso para el owner');
select test.throws($$delete from public.operation_events$$, 'CO403', 'S05 eventos no se borran incluso para el owner');

-- S08 URLs con esquema ejecutable -----------------------------------------
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);
select version as v from public.content_pieces where id = :'piece' \gset
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"production_spec_url":"javascript:alert(1)"}')$$, :'piece', :v), '23514', 'S08 rechaza URL javascript:');
select test.throws(format($$select public.update_piece(gen_random_uuid(), %L, %s, '{"production_spec_url":"data:text/html,<script>"}')$$, :'piece', :v), '23514', 'S08 rechaza URL data:');
select public.update_piece(gen_random_uuid(), :'piece', :v, '{"objective":"<script>alert(1)</script>"}');
select test.ok((select objective from public.content_pieces where id = :'piece') = '<script>alert(1)</script>', 'S08 HTML se guarda como texto literal (la UI lo escapa)');

-- S10 cuenta inactiva -----------------------------------------------------
select version as av from public.accounts where id = :'account' \gset
select public.update_account(gen_random_uuid(), :'account', :av, 'Cuenta prueba', null, false);
select test.throws(format($$select public.create_piece(gen_random_uuid(), %L, 'Nueva', 'feed', 'flexible', null, null, null)$$, :'account'), 'CO422', 'S10 cuenta inactiva no admite piezas nuevas');
select version as v from public.content_pieces where id = :'piece' \gset
select test.throws(format($$select public.assign_week(gen_random_uuid(), %L, %s, '2030-01-07')$$, :'piece', :v), 'CO403', 'S10 cuenta inactiva no admite asignaciones');
select test.ok((select count(*) from public.operation_events) > 0, 'S10 historial sigue disponible');

-- S03 desactivar allowlist corta el acceso de sesiones existentes ----------
reset role;
update public.authorized_users set active = false where user_id = :'owner';
set role authenticated;
select test.ok((select count(*) from public.content_pieces) = 0, 'S03 usuario desactivado pierde lectura');
select test.throws($$select public.create_brand(gen_random_uuid(), 'x', 'x')$$, 'CO401', 'S03 usuario desactivado pierde escritura');
