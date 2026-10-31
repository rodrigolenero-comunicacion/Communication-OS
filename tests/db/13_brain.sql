-- V0.3 Client Brain + Sources: comandos, aislamiento, estado, provisionales, versión, idempotencia y RLS.
\set owner '00000000-0000-0000-0000-00000000000a'
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

select (public.create_brand(gen_random_uuid(), 'Cliente A', 'cliente-a')->>'brand_id') as ba \gset
select (public.create_brand(gen_random_uuid(), 'Cliente B', 'cliente-b')->>'brand_id') as bb \gset
select (public.create_account(gen_random_uuid(), :'ba', 'Cuenta A', 'cuenta-a', null)->>'account_id') as acc_a \gset
select (public.create_account(gen_random_uuid(), :'bb', 'Cuenta B', 'cuenta-b', null)->>'account_id') as acc_b \gset

-- Fuentes (reutilizan source_references)
select (public.upsert_brand_source(gen_random_uuid(), null, null, :'ba', 'Manual A v2', 'Institución A', 'institutional_document', 'manual', null,
  'Manual A', '2', '2026-10-30', '2026-10-01', 'active', 'Vigente', 'pág. 3')->>'source_reference_id') as sa \gset
select (public.upsert_brand_source(gen_random_uuid(), null, null, :'ba', 'Manual A v1', 'Institución A', 'institutional_document', 'manual', null,
  'Manual A', '1', null, '2025-01-01', 'superseded', null, null)->>'source_reference_id') as sa_old \gset
select (public.upsert_brand_source(gen_random_uuid(), null, null, :'bb', 'Fuente B', null, 'decision', 'manual', null, null, null, null, null, 'provisional', null, null)->>'source_reference_id') as sb \gset
select test.ok((select relation_kind = 'context_reference' and scope_kind = 'brand' and source_url is null and document_version = '2' and status = 'active'
  from public.source_references where id = :'sa'), 'Fuente de cliente sin URL obligatoria, con versión y estado');
select test.ok((select array_agg(status order by title) from public.source_references where brand_id = :'ba') = array['superseded','active']::text[] or
  (select count(*) from public.source_references where brand_id = :'ba' and status = 'superseded') = 1, 'Versión anterior conservada como superseded');
select test.throws(format($$select public.upsert_brand_source(gen_random_uuid(), null, null, %L, 'x', null, 'blog', 'manual', null, null, null, null, null, 'active', null, null)$$, :'ba'), '23514', 'Tipo de fuente fuera de catálogo rechazado');
select test.throws(format($$select public.upsert_brand_source(gen_random_uuid(), null, null, %L, 'x', null, 'web', 'manual', 'javascript:x', null, null, null, null, 'active', null, null)$$, :'ba'), '23514', 'URL insegura rechazada');

-- Entradas
select (public.upsert_brain_entry(gen_random_uuid(), null, null, :'ba', null, 'strategy', 'principle', 'Principio', 'Texto', 'active', false, null, :'sa', 'pág. 3', null, null, 10)->>'entry_id') as e1 \gset
select test.ok((select category = 'strategy' and source_reference_id = :'sa' and not provisional from public.brain_entries where id = :'e1'), 'Entrada rastreable a su fuente');
select (public.upsert_brain_entry(gen_random_uuid(), null, null, :'ba', :'acc_a', 'audience', null, 'Audiencia de la cuenta', null, 'active', true, null, null, null, null, null, 0)->>'entry_id') as e2 \gset
select test.ok((select provisional and account_id = :'acc_a' from public.brain_entries where id = :'e2'), 'Entrada provisional y específica de una cuenta del cliente');

-- Aislamiento entre clientes
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), null, null, %L, null, 'voice', null, 'x', null, 'active', false, null, %L, null, null, null, 0)$$, :'ba', :'sb'), 'CO403', 'Entrada no puede usar fuente de otro cliente');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), null, null, %L, %L, 'voice', null, 'x', null, 'active', false, null, null, null, null, null, 0)$$, :'ba', :'acc_b'), 'CO403', 'Entrada no puede apuntar a cuenta de otro cliente');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), %L, %s, %L, null, 'strategy', 'principle', 'x', null, 'active', false, null, null, null, null, null, 0)$$, :'e1',
  (select version from public.brain_entries where id = :'e1'), :'bb'), 'CO403', 'Entrada no se traslada a otro cliente');
select test.throws(format($$select public.upsert_brand_source(gen_random_uuid(), %L, %s, %L, 'x', null, 'web', 'manual', null, null, null, null, null, 'active', null, null)$$, :'sa',
  (select version from public.source_references where id = :'sa'), :'bb'), 'CO403', 'Fuente no se traslada a otro cliente');
select (public.upsert_brand_axis(gen_random_uuid(), null, null, :'ba', 'pillar', 'P1', 'Pilar A', 10, false, null, true)->>'axis_id') as ax \gset
reset role;
select test.throws(format($$update public.brand_axes set source_reference_id = %L where id = %L$$, :'sb', :'ax'), 'CO403', 'Eje (brand_axes) no puede usar fuente de otro cliente');
update public.brand_axes set source_reference_id = :'sa' where id = :'ax';
select test.ok((select source_reference_id = :'sa' from public.brand_axes where id = :'ax'), 'brand_axes reutilizado con trazabilidad a fuente');
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner')::text, false);

-- Claims del cliente: confirmed / provisional / unsupported
select (public.upsert_brain_entry(gen_random_uuid(), null, null, :'ba', null, 'claim', null, 'Dato', null, 'active', false, 'provisional', null, null, null, null, 0)->>'entry_id') as c1 \gset
select test.ok((select provisional and claim_status = 'provisional' from public.brain_entries where id = :'c1'), 'Claim provisional queda marcado como provisional');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), null, null, %L, null, 'claim', null, 'x', null, 'active', false, null, null, null, null, null, 0)$$, :'ba'), '23514', 'Claim exige estado de claim');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), null, null, %L, null, 'voice', null, 'x', null, 'active', false, 'confirmed', null, null, null, null, 0)$$, :'ba'), '23514', 'Solo los claims llevan estado de claim');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), null, null, %L, null, 'pillar', null, 'x', null, 'active', false, null, null, null, null, null, 0)$$, :'ba'), '23514', 'Pilares no se duplican en el Brain (viven en brand_axes)');

-- Edición, versión e idempotencia
select gen_random_uuid() as req \gset
select (select version from public.brain_entries where id = :'e1') as v1 \gset
select public.upsert_brain_entry(:'req', :'e1', :v1, :'ba', null, 'strategy', 'principle', 'Principio editado', 'Texto 2', 'active', false, null, :'sa', null, null, null, 10);
select test.ok((select title = 'Principio editado' and version = :v1 + 1 from public.brain_entries where id = :'e1'), 'Edición aplicada y versión incrementada');
select test.ok((public.upsert_brain_entry(:'req', :'e1', :v1, :'ba', null, 'strategy', 'principle', 'Otro', null, 'active', false, null, null, null, null, null, 10)->>'replayed')::boolean
  and (select title from public.brain_entries where id = :'e1') = 'Principio editado', 'Mismo request_id es idempotente');
select test.throws(format($$select public.upsert_brain_entry(gen_random_uuid(), %L, %s, %L, null, 'strategy', 'principle', 'x', null, 'active', false, null, null, null, null, null, 10)$$, :'e1', :v1, :'ba'), 'CO409', 'Versión desactualizada recibe conflicto');
select test.ok(exists (select 1 from public.operation_events where event_type = 'brain_entry_saved' and before_data->>'title' = 'Principio'), 'Historial conserva el valor previo');
select public.upsert_brain_entry(gen_random_uuid(), :'e1', (select version from public.brain_entries where id = :'e1'), :'ba', null, 'strategy', 'principle', 'Principio editado', 'Texto 2', 'superseded', false, null, :'sa', null, null, null, 10);
select test.ok((select status = 'superseded' from public.brain_entries where id = :'e1'), 'Entrada puede marcarse superseded sin borrarse');

-- RLS y escritura directa
select test.throws($$insert into public.brain_entries (brand_id, category, title) select id, 'voice', 'x' from public.brands limit 1$$, '42501', 'Brain no se escribe por la API de datos');
select test.throws(format($$update public.source_references set status = 'archived' where id = %L$$, :'sa'), '42501', 'Estado de fuente no se cambia por la API de datos');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000000b')::text, false);
select test.ok((select count(*) from public.brain_entries) = 0, 'Usuario fuera de allowlist no ve el Brain');
reset role;
set role anon;
select test.throws('select * from public.brain_entries', '42501', 'Anónimo no lee el Brain');
