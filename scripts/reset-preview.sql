-- VISTA PREVIA DEL RESET — SOLO LECTURA. No modifica nada.
-- Ejecutar antes de scripts/reset-operational-data.sql.
-- Gate: si aparece alguna pieza o publicación que NO sea de la demostración,
-- no ejecutes el reset.

-- 1. Piezas que se borrarían (todas), con cuenta, estado y publicaciones.
select p.title as pieza, a.name as cuenta, p.ownership, p.production_status, p.created_at,
       (select count(*) from public.publications pub where pub.content_piece_id = p.id) as publicaciones
from public.content_pieces p
join public.accounts a on a.id = p.account_id
order by p.created_at;

-- 2. Resumen de lo que se borra y de lo que se conserva.
select
  (select count(*) from public.content_pieces) as piezas_a_borrar,
  (select count(*) from public.publications) as publicaciones_a_borrar,
  (select count(*) from public.review_decisions) as decisiones_a_borrar,
  (select count(*) from public.operation_events where content_piece_id is not null or publication_id is not null) as eventos_de_piezas_a_borrar,
  (select count(*) from public.operation_events where content_piece_id is null and publication_id is null) as eventos_de_configuracion_conservados,
  (select count(*) from public.source_references where content_piece_id is null) as fuentes_de_contexto_conservadas,
  (select count(*) from public.editorial_targets) as objetivos_conservados,
  (select count(*) from public.piece_templates) as plantillas_conservadas;
