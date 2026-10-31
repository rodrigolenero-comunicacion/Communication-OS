-- RESET OPERATIVO — DESTRUCTIVO E IRREVERSIBLE.
-- Uso único y deliberado, ejecutado a mano por el propietario en el SQL Editor,
-- DESPUÉS de revisar scripts/reset-preview.sql.
--
-- Borra solo lo operativo ligado a piezas: piezas, asignaciones, packets, claims,
-- dependencias, decisiones, publicaciones, espejos y sus observaciones, fuentes
-- ligadas a piezas y los eventos de historial de esas piezas/publicaciones.
--
-- Conserva: usuario autorizado y auth, marcas, cuentas, canales, catálogos,
-- plantillas, objetivos semanales y modo de cobertura, fuentes de contexto no
-- ligadas a piezas, historial de configuración (marcas, cuentas, canales,
-- objetivos, plantillas), estructura, migraciones, RLS y policies.
--
-- Todo ocurre en una transacción: si algo falla, no se borra nada.

begin;

-- El historial es append-only por trigger; se desactiva solo dentro de esta transacción.
alter table public.operation_events disable trigger operation_events_append_only;
alter table public.review_decisions disable trigger review_decisions_append_only;
alter table public.source_observations disable trigger source_observations_append_only;

delete from public.operation_events where content_piece_id is not null or publication_id is not null;
delete from public.review_decisions;
delete from public.source_observations
 where source_reference_id in (select id from public.source_references where content_piece_id is not null);
delete from public.publications;
delete from public.planning_assignments;
delete from public.claims;
delete from public.approval_dependencies;
delete from public.review_packets;
delete from public.source_references where content_piece_id is not null;
delete from public.content_pieces;

alter table public.operation_events enable trigger operation_events_append_only;
alter table public.review_decisions enable trigger review_decisions_append_only;
alter table public.source_observations enable trigger source_observations_append_only;

commit;

-- Comprobación: lo operativo en 0, la configuración intacta y las protecciones activas (3).
select
  (select count(*) from public.content_pieces) as piezas,
  (select count(*) from public.publications) as publicaciones,
  (select count(*) from public.review_decisions) as decisiones,
  (select count(*) from public.brands) as marcas,
  (select count(*) from public.accounts) as cuentas,
  (select count(*) from public.editorial_targets) as objetivos_conservados,
  (select count(*) from public.piece_templates) as plantillas,
  (select count(*) from public.authorized_users where active) as usuario_autorizado,
  (select count(*) from pg_trigger where tgname like '%append_only' and tgenabled = 'O') as protecciones_activas;
