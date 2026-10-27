-- Integridad en la base aunque se salten los comandos (escrituras como owner).
\set owner '00000000-0000-0000-0000-00000000000a'
insert into public.brands (id, name, slug) values ('10000000-0000-0000-0000-000000000001', 'B', 'b');
insert into public.accounts (id, brand_id, name, slug) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', 'a');
insert into public.content_pieces (id, account_id, title, bucket, production_status) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'P', 'feed', 'idea');
select id as ig from public.channels where key = 'instagram' \gset

select test.throws($$insert into public.publications (content_piece_id, channel_id, format, status, published_at) values ('30000000-0000-0000-0000-000000000001', '$$ || :'ig' || $$', 'post', 'published', now())$$, '23514', 'published sin URL ni nota rechazado por CHECK');
select test.throws($$insert into public.publications (content_piece_id, channel_id, format, status) values ('30000000-0000-0000-0000-000000000001', '$$ || :'ig' || $$', 'post', 'scheduled')$$, '23514', 'scheduled sin fecha rechazado');
select test.throws($$insert into public.publications (content_piece_id, channel_id, format, status, scheduled_at) values ('30000000-0000-0000-0000-000000000001', '$$ || :'ig' || $$', 'post', 'unscheduled', now())$$, '23514', 'unscheduled con fecha rechazado');
select test.throws($$insert into public.publications (content_piece_id, channel_id, format, scheduling_method) values ('30000000-0000-0000-0000-000000000001', '$$ || :'ig' || $$', 'post', 'api')$$, '23514', 'Solo método manual');
select test.throws($$insert into public.claims (content_piece_id, statement, claim_kind, verification_status, verified_by, verified_at) values ('30000000-0000-0000-0000-000000000001', 'x', 'fact', 'supported', '$$ || :'owner' || $$', now())$$, '23514', 'Claim supported sin fuente ni localizador rechazado');
select test.throws($$insert into public.approval_dependencies (content_piece_id, label, status) values ('30000000-0000-0000-0000-000000000001', 'x', 'satisfied')$$, '23514', 'Dependencia satisfecha sin nota rechazada');
select test.throws($$insert into public.review_decisions (content_piece_id, content_revision, action, actor_id, packet_snapshot, request_id) values ('30000000-0000-0000-0000-000000000001', 1, 'changes_requested', '$$ || :'owner' || $$', '{}', gen_random_uuid())$$, '23514', 'Pedir cambios sin comentario rechazado');
select test.throws($$update public.content_pieces set production_status = 'approved' where id = '30000000-0000-0000-0000-000000000001'$$, '23514', 'approved sin revisión aprobada rechazado');
select test.throws($$update public.content_pieces set on_hold = true where id = '30000000-0000-0000-0000-000000000001'$$, '23514', 'Hold solo en in_review/approved');
select test.throws($$insert into public.content_pieces (account_id, title, bucket, ownership, production_status) values ('20000000-0000-0000-0000-000000000001', 'E', 'feed', 'external', 'approved')$$, '23514', 'Espejo externo sin estado de producción local');
select test.throws($$insert into public.planning_assignments (content_piece_id, week_start) values ('30000000-0000-0000-0000-000000000001', '2030-01-08')$$, '23514', 'Asignación exige lunes');
insert into public.planning_assignments (content_piece_id, week_start) values ('30000000-0000-0000-0000-000000000001', '2030-01-07');
select test.throws($$insert into public.planning_assignments (content_piece_id, week_start) values ('30000000-0000-0000-0000-000000000001', '2030-01-14')$$, '23505', 'S06 asignación duplicada rechazada');
insert into public.editorial_targets (account_id, bucket, required_count, buffer_target_days, active_from) values ('20000000-0000-0000-0000-000000000001', 'feed', 3, 7, '2030-01-07');
select test.throws($$insert into public.editorial_targets (account_id, bucket, required_count, buffer_target_days, active_from, active_until) values ('20000000-0000-0000-0000-000000000001', 'feed', 3, 7, '2029-12-31', '2030-01-14')$$, 'CO422', 'Políticas solapadas rechazadas por trigger');
insert into public.editorial_targets (account_id, bucket, required_count, buffer_target_days, active_from) values ('20000000-0000-0000-0000-000000000001', 'stories', 3, 7, '2030-01-07');
select test.ok(true, 'Buckets distintos no se solapan');
select test.throws($$insert into public.authorized_users (user_id, active) values ('00000000-0000-0000-0000-00000000000b', true)$$, '23505', 'Single-user: una sola fila activa en allowlist');
insert into public.source_references (id, content_piece_id, account_id, relation_kind, scope_kind, source_system, source_entity_type, source_entity_id, title, source_url)
select '40000000-0000-0000-0000-000000000001', id, account_id, 'external_mirror', 'account', 'st_hub', 't', '1', 'M', 'https://x.test'
from public.content_pieces where id = '30000000-0000-0000-0000-000000000001';
select test.throws($$insert into public.source_observations (source_reference_id, source_state_raw, observed_status, observed_at, recorded_by, request_id) values ('40000000-0000-0000-0000-000000000001', 'x', 'approved', now(), '$$ || :'owner' || $$', gen_random_uuid())$$, '23514', 'Observación approved sin evidencia rechazada por CHECK');
select test.throws($$insert into public.source_observations (source_reference_id, source_state_raw, observed_status, observed_at, recorded_by, request_id, recorded_at) values ('40000000-0000-0000-0000-000000000001', 'x', 'unknown', now() + interval '1 day', '$$ || :'owner' || $$', gen_random_uuid(), now())$$, '23514', 'Observación futura rechazada por CHECK');
select test.throws($$insert into public.source_references (relation_kind, scope_kind, source_system, title) values ('external_mirror', 'public_general', 'st_hub', 'x')$$, '23514', 'Espejo exige identidad fuente completa');
select test.throws($$insert into public.source_references (relation_kind, scope_kind, source_system, title) values ('context_reference', 'account', 'manual', 'x')$$, '23514', 'Referencia de cuenta exige account_id');
