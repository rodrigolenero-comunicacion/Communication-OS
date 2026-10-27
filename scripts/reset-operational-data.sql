-- RESET OPERATIVO — DESTRUCTIVO E IRREVERSIBLE.
-- Uso único y deliberado, ejecutado a mano por el propietario en el SQL Editor.
-- Borra: piezas, asignaciones, packets, claims, dependencias, decisiones,
-- publicaciones, espejos, observaciones, fuentes, historial y objetivos semanales.
-- Conserva: marcas, cuentas, canales activos, catálogo de canales y usuario autorizado.
-- Las cuentas vuelven a «Sin configurar» porque se borran sus objetivos.
-- Todo ocurre en una transacción: si algo falla, no se borra nada.

begin;

-- El historial es append-only por trigger; se desactiva solo dentro de esta transacción.
alter table public.operation_events disable trigger operation_events_append_only;
alter table public.review_decisions disable trigger review_decisions_append_only;
alter table public.source_observations disable trigger source_observations_append_only;

delete from public.operation_events;
delete from public.review_decisions;
delete from public.source_observations;
delete from public.publications;
delete from public.planning_assignments;
delete from public.claims;
delete from public.approval_dependencies;
delete from public.review_packets;
delete from public.source_references;
delete from public.content_pieces;
delete from public.editorial_targets;
update public.accounts set coverage_mode = 'unconfigured', version = version + 1
 where coverage_mode <> 'unconfigured';

alter table public.operation_events enable trigger operation_events_append_only;
alter table public.review_decisions enable trigger review_decisions_append_only;
alter table public.source_observations enable trigger source_observations_append_only;

commit;

-- Comprobación: piezas, publicaciones, historial y objetivos en 0; protecciones activas.
select
  (select count(*) from public.content_pieces) as piezas,
  (select count(*) from public.publications) as publicaciones,
  (select count(*) from public.operation_events) + (select count(*) from public.review_decisions) as historial,
  (select count(*) from public.editorial_targets) as objetivos,
  (select count(*) from public.brands) as marcas,
  (select count(*) from public.accounts) as cuentas,
  (select count(*) from pg_trigger where tgname like '%append_only' and tgenabled = 'O') as protecciones_activas;
