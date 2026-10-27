# ADR-002 — Decisiones tomadas durante la construcción de V0.1

Fecha: 2026-10-27. Estado: implementadas, revisables por el propietario. Complementan ADR-001; no cambian unidad de conteo, ownership ni alcance.

## Arquitectura y seguridad

| Decisión | Motivo / consecuencia |
|---|---|
| Los roles de la API (`anon`, `authenticated`) solo tienen `SELECT` bajo RLS; **toda escritura** pasa por funciones SQL `SECURITY DEFINER` en `public` que validan sesión, allowlist, inputs, versión e idempotencia | Cumple «RLS por sí sola no valida transiciones» y «revocar escritura directa» de forma uniforme. Una llamada directa a la API de datos no puede saltarse comandos (probado S04–S06) |
| Helpers internos en el esquema `app`, sin `EXECUTE` para la API salvo `is_authorized`, `is_http_url` y `has_text` | Evita exponer funciones privilegiadas |
| Historial (`review_decisions`, `source_observations`, `operation_events`) protegido además por trigger que rechaza UPDATE/DELETE/TRUNCATE incluso al owner | Append-only real, no solo por permisos |
| Idempotencia: `request_id` + `pg_advisory_xact_lock`; cada comando escribe su `request_id` en una tabla de historial. El formulario recibe el `request_id` al renderizarse | Un doble clic o reintento devuelve el resultado previo (probado con sesiones concurrentes) |
| Concurrencia optimista con `expected_version`; conflicto = error `CO409` «recarga» | Nunca «última escritura gana» |
| Columnas `version` añadidas a `brands` y `accounts` | Cambio aditivo al DATA_MODEL para concurrencia también en portfolio |
| Códigos de error propios `CO401/403/404/409/422` | La UI muestra mensajes comprensibles sin filtrar detalles internos |
| Restricciones de texto obligatorio con `app.has_text()` | Un `CHECK` con `length(btrim(NULL)) > 0` se evalúa NULL y PostgreSQL lo acepta; las pruebas lo detectaron |
| Sin `server-only` ni otras librerías auxiliares; pruebas con `node:test` y `psql` | Stack cerrado |
| TypeScript 5.9.3 en lugar de 7.0.x | TS 7 (compilador nativo) es muy reciente para asumir compatibilidad con Next 16.4; reversible |
| `proxy.ts` (antes `middleware`) para refrescar la sesión, según la documentación de Next 16 instalada | — |

## Reglas de producto precisadas

| Tema | Decisión |
|---|---|
| Timing | Cambiar timing de una pieza local es **cambio material** (incrementa revisión, requiere estado editable). Interpreta S11. En espejos, el timing es dato de coordinación y sí se edita localmente |
| Edición en revisión | No se edita contenido en `in_review`: el revisor pide cambios. No existe transición «retirar de revisión» en el modelo |
| Claims | Aprobar exige **todos** los claims `supported` (incluidas estimaciones y supuestos, que deben rotularse como tales) |
| Enviar a revisión | Exige objetivo, audiencia, experiencia, al menos un texto de Words, spec (texto o enlace) y las dos confirmaciones explícitas de claims y dependencias |
| Verificar claims / resolver dependencias | No incrementa la revisión (es evidencia de revisión, no contenido); se permite hasta `in_review`, no en `approved`. La decisión guarda el snapshot completo |
| Hold | Solo sin destinos programados/publicados. Reabrir una aprobada exige liberar antes el hold |
| Objetivos | Misma fecha de inicio ⇒ se actualiza la política (recalcula la semana vigente). Fecha posterior ⇒ cierra la anterior y crea otra. Una política que aún no ha regido semanas pasadas puede retirarse por completo |
| Programar | Requiere asignación semanal, fecha **futura** dentro de esa semana y del timing, aprobación vigente y canal activo |
| Publicar | Requiere asignación. Si la fecha real cae fuera de la semana asignada, exige marcar la corrección explícita, que mueve la asignación completa; se bloquea si otro destino está programado o publicado |
| Cancelar | Limpia `scheduled_at` en la fila y conserva el valor previo en `operation_events` |
| Corrección de publicaciones | Comando `correct_publication` con motivo, dentro de la semana asignada. No existe «despublicar» |
| Cuenta y bucket de una pieza | Inmutables en V0.1; se crea otra pieza |
| Espejos | Sus publicaciones usan los mismos comandos con `record_kind = source_observation`. El comando de espejo exige un sistema fuente distinto de `manual` |
| Review Desk | «Fecha objetivo» = semana asignada, si no fecha fija, fin de ventana o vencimiento productivo |
| Frames | La base valida `frames` (≤30, esquema fijo) pero la UI de V0.1 no los edita; el preview se registra como tipo + enlace |
| Lectura | Se cargan hasta 5 000 piezas por vista; suficiente para uso personal. Revisar si el volumen crece |

## Pendiente de cotejo

Estas decisiones no se cotejaron con PROJECT_INSTRUCTIONS.md, SYSTEMS_ARCHITECT.md, OPERATING_PROTOCOL.md ni SYSTEM_CONTINUITY.md (no recibidos).
