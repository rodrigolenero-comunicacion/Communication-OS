# Product Model — V0.1

Contrato funcional. Las precisiones respecto al diseño conversacional están en ADR-001.

## Portfolio y demanda

Portfolio es la vista de las marcas y cuentas del único usuario; no requiere una tabla de organizaciones. Brand agrupa Accounts. Account representa una cuenta editorial (p. ej. Campus Puebla), no el identificador de Instagram. AccountChannel declara los canales activos, inicialmente instagram y facebook, mediante catálogo extensible.

EditorialTarget define `account`, `bucket` (feed/stories), `required_count > 0`, `buffer_target_days >= 0`, `active_from` y `active_until` exclusivo. Las fechas de efectividad son lunes y las políticas de una cuenta/bucket no se solapan. Crear o modificar una política toma efecto como pronto el lunes de la semana actual; no reescribir semanas pasadas. El cambio debe advertir que recalcula la semana vigente cuando corresponda. Pausar significa cerrar vigencia; no crear un target cero.

Cada cuenta declara `coverage_mode`: unconfigured, weekly o not_required. El alta empieza unconfigured; al configurar su primer target pasa a weekly. Si el usuario confirma ausencia deliberada de cuota (p. ej. Rectora), not_required muestra **Sin cuota**, sin gap/runway ni ranking de salud. No convertir la falta de datos en ausencia de cuota. Cambiar a not_required requiere cerrar políticas vigentes explícitamente. Solo se evalúan buckets con política configurada o pendiente de vigencia; no exigir configurar Stories si solo se controla feed. Para weekly, sin política aplicable en un bucket evaluado: mostrar **Sin objetivo configurado**, nunca verde, gap cero ni runway infinito. Cuenta inactiva: conservar historial y excluir de atención operativa. Rechazar nuevas asignaciones/publicaciones mientras esté inactiva.

PlanningWindow es una semana local lunes 00:00 inclusive → lunes siguiente 00:00 exclusivo, zona `America/Mexico_City`. La clave es la fecha local del lunes, no un número de semana aislado. Se puede calcular al consultar; la asignación guarda esa fecha. No se materializan ventanas por cron.

## Pieza, asignación y publicación

ContentPiece contiene título, cuenta, bucket, tipo de contenido, objetivo, audiencia, rol editorial libre, campaña/tema, responsable libre, vencimiento, prioridad y material de revisión. No imponer taxonomía estratégica universal.

Tiene exactamente una cuenta en V0.1 y puede tener cero o múltiples Publications. La pieza no adquiere un estado scheduled o published. Su asignación semanal vive en PlanningAssignment, incluso antes de crear una Publication.

Una pieza aporta como máximo una unidad a una ventana y no puede estar asignada a varias. Dos publicaciones de la misma pieza en IG y FB son una sola unidad editorial. Esta versión mide cadencia editorial, no cumplimiento por canal. La UI debe explicitarlo junto a los objetivos. La cuota diaria de Stories y story_count de ST Hub no es equivalente a este cálculo: no convertirla a semanal ni afirmar cumplimiento de su regla. Véase SOURCE_RECONCILIATION.

`timing_mode`:
- `fixed`: `fixed_date` obligatorio; asignación y publicaciones deben estar en esa fecha local.
- `window`: `valid_from` y `valid_until` inclusivos obligatorios; la asignación debe intersectar el intervalo y las fechas concretas caer dentro de él.
- `flexible`: sin restricciones de fecha; puede entrar a reserva.

Asignar no crea fecha/hora, publicación ni aprobación. Programar requiere asignación y fecha válida dentro de la misma semana. Cambiar semana cuando existen publicaciones scheduled exige reprogramarlas de forma explícita y atómica o cancelar esas programaciones antes de reasignar. No modificar una asignación con publicación confirmada. Si una publicación real ocurrió fuera de semana, registrar mediante corrección explícita que mueve la asignación completa y explica el efecto sobre cobertura; no falsear la fecha ni mover otros destinos silenciosamente. En V0.1, la corrección se bloquea si hay otro destino published en una semana distinta; ese caso requiere resolver el modelo con el propietario.

Publication registra destino concreto, formato, fecha programada, fecha real y URL/identificador externo opcional. Estados: `unscheduled`, `scheduled`, `published`, `cancelled`. Método único: manual. El usuario registra que programó o publicó en la herramienta externa; Content OS no envía nada. Nunca llamar “publicación exitosa” a guardar un registro local.

## Producción y revisión

Estados canónicos: `idea`, `planned`, `in_production`, `in_review`, `changes_requested`, `approved`. `on_hold` es una condición separada.

| Acción | Origen | Resultado | Condiciones |
|---|---|---|---|
| Planificar | idea | planned | Datos mínimos; asignación opcional |
| Empezar producción | planned, changes_requested | in_production | Pieza local, no hold |
| Enviar/re-enviar a revisión | in_production, changes_requested | in_review | Review Packet básico completo |
| Aprobar | in_review | approved | No hold, claims/dependencias resueltos; decisión atómica |
| Pedir cambios | in_review | changes_requested | Comentario breve obligatorio, decisión registrada |
| Hold | in_review, approved | mismo estado + on_hold | Motivo; no publicaciones activas scheduled/published |
| Liberar hold | mismo estado con on_hold | mismo estado sin hold | Acción explícita registrada; si era approved conserva aprobación de la misma revisión |
| Reabrir para edición | approved | in_production | Invalida aprobación vigente; sin destinos scheduled y sin published |

No ofrecer edición material directa de una pieza approved. Título editorial, copy, assets, claims, dependencias, spec y packet son materiales: editar requiere reabrir. Tras publicación, crear una nueva pieza para revisión editorial; mantener original inmutable. Cambios de metadatos operativos como prioridad o semana no cambian la revisión, pero deben cumplir restricciones temporales. Archivar excluye inventario pendiente y reserva; no elimina hechos publicados. Rechazar archivo mientras existan destinos scheduled; cancelar primero explícitamente.

ReviewPacket es una representación estructurada y humana, no una segunda pieza. Incluye qué es, por qué existe, experiencia, Words (hook, on-screen, cierre, caption, CTA), verificaciones, preview y enlace/texto de Production Spec. Preview prioriza video/animatic → storyboard → frames → texto; sin preview visual se permite texto estructurado completo, claramente indicado. No generar previews automáticamente.

Enviar a revisión exige título, objetivo, audiencia, descripción de experiencia, al menos un texto crítico y Production Spec en texto o enlace. Claims y dependencias pueden estar vacíos solo tras confirmar explícitamente que no aplican. Cada claim verificable requiere fuente identificable y verificación humana. Una URL por sí sola no verifica un claim. Dependencias aplicables deben estar satisfechas. Si existen pendientes, se puede revisar pero no aprobar. No hay aprobación parcial.

ReviewDecision es append-only e incluye revisión exacta del contenido, actor, acción, fecha, comentario y snapshot del packet evaluado. Una aprobación válida corresponde a la revisión vigente. El impacto se calcula simulando esa decisión con las mismas funciones de cobertura; se muestra como estimación de la operación local, sin escritura previa.

## Publicaciones manuales

- Crear unscheduled exige pieza approved, no hold, aprobación vigente y cuenta/canal activos. Se puede crear antes de asignar semana.
- unscheduled → scheduled exige semana asignada, `scheduled_at` válido y confirmación del usuario de que ya programó fuera de Content OS.
- scheduled o unscheduled → published exige `published_at <= now`, dentro de la asignación/timing, y confirmación humana. Permitir URL o nota de evidencia; al menos una requerida.
- unscheduled o scheduled → cancelled exige motivo. Cancelled no aporta cobertura ni borra la pieza aprobada; una asignación aún aprobada permanece segura, aunque no tenga destino activo.
- cancelled → unscheduled solo mediante reapertura explícita y si la aprobación sigue vigente; borrar la fecha de programación activa, conservándola en el historial.
- published no retrocede por el CRUD normal. Corregir hechos requiere acción separada con motivo e historial; no implementar borrado destructivo.
- Cambiar la fecha scheduled requiere la misma validación que programar y registro de evento.

El paso del tiempo no cambia estado. Un scheduled vencido sigue registrado, con alerta **Confirmar publicación**. Para evitar falsa seguridad, una unidad no cumplida con algún destino scheduled vencido queda fuera de SAFE y PROJECTED hasta confirmar, reprogramar o cancelar ese destino. Es una precisión conservadora de V0.1. Si otro destino ya está published, la unidad ya cumplida permanece contada.

## Contrato único de cobertura

Entradas: `now`, cuenta/bucket, target aplicable, asignaciones, piezas, publicaciones y observaciones externas. Calcular sobre una lectura coherente y recalcular tras cada mutación.

Para cada semana W:
1. `required = target.required_count`.
2. Tomar solo piezas de esa cuenta/bucket asignadas a W, con timing válido. No tomar reserva ni piezas de otra cuenta. Deduplicar por `content_piece_id`.
3. `fulfilled`: piezas con al menos una Publication published confirmada en W. Son demanda cumplida, no inventario futuro. Se conservan aunque se archive la pieza.
4. Para piezas aún no cumplidas: excluir archived, on_hold, observación externa sin estado verificable o sin equivalencia editorial suficiente y scheduled vencido. Excluir timing ya expirado si no hubo publicación.
5. `safe_pending`: piezas elegibles approved con aprobación vigente local, o estado approved observado del sistema fuente con fecha/evidencia y `review_complete_confirmed=true` para la pieza completa. Una aprobación de audiovisual con caption pendiente no satisface esa condición. Scheduled no es una segunda unidad ni sustituye aprobación. Para espejos, preservar source_state_raw y tipo de objeto; la normalización se registra manualmente con evidencia y puede ser unknown. No equiparar contents.completed o CONECTA.delivered de ST Hub con publicación ni aprobación editorial final.
6. `projected_pending`: `safe_pending` más piezas elegibles in_review o in_production. changes_requested, idea y planned no cuentan.
7. `safe = fulfilled + safe_pending`; `projected = fulfilled + projected_pending`.
8. `safe_gap = max(0, required-safe)`; `projected_gap = max(0, required-projected)`.
9. COVERED si safe >= required; AT_RISK si safe < required y projected >= required; GAP si projected < required.

Mostrar “cumplido / seguro pendiente / proyectado total” cuando haya publicaciones reales para no llamar inventario a algo ya consumido. Mantener los totales sin truncar; limitar solo las barras visuales. Si hay varios buckets, calcular cada uno por separado; el estado de cuenta es el peor, nunca compensar feed con stories.

Una pieza sin asignación no cubre ninguna semana. Una Publication sin semana no cubre hasta asignar. No sumar una pieza y sus publicaciones. No trasladar excedentes. La ventana vigente exige su target completo, incluyendo lo que ya se publicó.

## Reserva y necesidades

Reserva: pieza approved (si es espejo, revisión completa confirmada), flexible, sin asignación, no hold/archived, aprobación vigente, y sin publicaciones scheduled/published. Puede tener borradores unscheduled. Elegibilidad exige misma cuenta/bucket. `achievable = min(required, safe + eligible_reserve)` es solo una posibilidad para una ventana; no agregar esa capacidad entre semanas porque consumiría la misma reserva varias veces. Al asignar manualmente una reserva, sale del pool y entra en cobertura; no se convierte en scheduled.

EditorialNeed en V0.1 es una proyección por cuenta/bucket/semana con `safe_gap`, `projected_gap`, razón y acción “Planificar”. No se crea automáticamente ninguna ContentPiece. El concepto futuro open/addressed/resolved se conserva en roadmap, pero no tiene CRUD ni tabla en V0.1.

## Runway y buffer

Calcular por cuenta/bucket desde la semana actual, durante 12 ventanas. Para SAFE y PROJECTED, buscar la primera semana con total < required. Si es la actual, runway = 0; si es futura, `until` es su lunes local a las 00:00, límite exclusivo de cobertura, y `days` es floor de los días reales entre now y until (mínimo cero). Mostrar fecha/límite además del entero; puede haber runway 0 con menos de 24 h restantes. No utilizar piezas/frecuencia ni inferir días fijos de publicación.

Si las 12 ventanas están cubiertas y tienen políticas, devolver `at_least` y el final del horizonte, no un número exacto infinito. Si se acaba la vigencia de la política o falta objetivo antes, devolver `unknown_after` con esa fecha: la demanda posterior es desconocida, no satisfecha. Un gap anterior sigue siendo el límite conocido.

Buffer por bucket: CRITICAL si gap seguro actual o runway seguro de cero días; LOW si runway seguro < buffer_target_days; HEALTHY si >= objetivo y hay evidencia suficiente. Si el límite inferior del horizonte no alcanza para demostrar salud, mostrar INDETERMINADO y ampliar horizonte a petición. Sin objetivo es SIN_CONFIGURAR; not_required es SIN_CUOTA y se excluye del ranking. Para cuenta con varios buckets, usar el runway mínimo y la peor salud; mostrar los detalles y no ocultar buckets sin configurar.

Ejemplo reproducible: now = 2026-10-27 12:00 en Ciudad de México. Semana actual (26 oct) y próxima (2 nov) cubiertas; primer gap comienza 9 nov 00:00. Runway = 12 días completos; cobertura hasta 9 nov, límite exclusivo. No etiquetar 9 nov como día ya cubierto.
