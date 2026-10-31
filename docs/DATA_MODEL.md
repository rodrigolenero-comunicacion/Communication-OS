# Data Model — Contrato para migraciones SQL

Este documento especifica el esquema a implementar; no es una migración ya ejecutada. PostgreSQL es la autoridad de integridad. UUID para identidad, timestamptz para instantes, date para días editoriales locales; created_at/updated_at en tablas mutables. Nombres snake_case. No almacenar fechas como strings ambiguos ni semana como un entero sin año.

## Entidades persistentes

### authorized_users

`user_id uuid PK FK auth.users`, `active boolean NOT NULL`, `created_at`.

Provisión administrativa manual; no escritura desde la app. Una sola fila activa en V0.1, impuesta con índice único parcial sobre la condición activa. No copiar datos sensibles del proveedor ni crear roles.

### brands

`id`, `name NOT NULL`, `slug UNIQUE NOT NULL`, `active boolean DEFAULT true`.

La marca no es un tenant. Archivar marca requiere desactivar sus cuentas mediante operación explícita, preservando historial; no cascade destructivo.

### accounts

`id`, `brand_id FK brands RESTRICT`, `name`, `slug`, `active`, `context_notes nullable`, `coverage_mode CHECK IN ('unconfigured','weekly','not_required') DEFAULT 'unconfigured'`.

UNIQUE(brand_id, slug). El comando de configuración conserva coherencia: weekly al crear una política; not_required solo tras cerrar políticas vigentes y registrar la decisión. Unconfigured no equivale a sin cuota. Cuenta editorial; no confundir con handle social. No guardar contraseña/token de redes. Las reglas y fuentes de contexto se vinculan por cuenta/marca, nunca se mezclan entre clientes.

### channels y account_channels

channels: `id`, `key UNIQUE`, `name`. Seeds de catálogo: instagram, facebook.

account_channels: `account_id`, `channel_id`, `active`; PK(account_id, channel_id). Desactivar no borra publicaciones. Si hay scheduled activos, advertir y exigir resolverlos antes de desactivar. No inventar handles ni activar canales reales sin confirmación de configuración del usuario.

### editorial_targets

`id`, `account_id`, `bucket CHECK IN ('feed','stories')`, `required_count integer > 0`, `buffer_target_days integer >= 0`, `active_from date`, `active_until date nullable`.

CHECK active_from lunes; active_until nulo o lunes posterior. Intervalo [active_from,active_until). Evitar solapamiento por account/bucket mediante constraint o trigger transaccional que bloquee la cuenta antes de comprobar. No depender de una consulta en el frontend. No introducir extensiones nuevas si bloqueo/validación SQL basta. Políticas históricas utilizadas no se borran; cambios futuros cierran una y crean otra.

### content_pieces

`id`, `account_id FK`, `title NOT NULL`, `bucket`, `content_type`, `objective`, `audience`, `editorial_role nullable`, `campaign nullable`, `owner_label nullable`, `due_date nullable`, `priority CHECK IN ('normal','high')`.

Producción: `ownership CHECK IN ('local','external')`, `production_status nullable`, `on_hold boolean DEFAULT false`, `archived_at nullable`, `content_revision integer > 0`, `approved_revision integer nullable`, `approved_at timestamptz nullable`, `version integer > 0`.

Estados locales: idea/planned/in_production/in_review/changes_requested/approved. Para local, production_status obligatorio. Para external, production_status, approved_revision y approved_at nulos: la autoridad proviene de source_observations, no de la decisión local. `on_hold` local no se utiliza para falsear hold externo; el estado observado lo aporta la fuente. Archivar un espejo localmente solo lo oculta del inventario pendiente; no modifica al origen.

Timing: `timing_mode` fixed/window/flexible; `fixed_date`, `valid_from`, `valid_until`. CHECK según modo: fixed exige solo fixed_date; window exige rango válido inclusivo; flexible no tiene fechas restrictivas. due_date es vencimiento productivo, no fecha de publicación.

Contenidos: `production_spec_text nullable`, `production_spec_url nullable`. El packet es tabla propia. Edición material incrementa content_revision, limpia aprobación vigente y requiere estado editable. La columna version controla concurrencia de cualquier mutación. La aprobación no incrementa content_revision, solo version.

### planning_assignments

`id`, `content_piece_id UNIQUE FK RESTRICT`, `week_start date NOT NULL` (lunes), `version`.

Cuenta/bucket se derivan de la pieza, no se duplican. Guardar/asignar valida timing, cuenta activa y restricciones de publicaciones. Unicidad por pieza impide reutilización semanal. Quitar asignación devuelve pieza flexible aprobada a reserva si es elegible. Rechazar quitarla con published o scheduled. Mantener historial de reasignaciones en operation_events.

### review_packets

`content_piece_id PK FK`, `what_is_it`, `why_it_exists`, `experience`, `words jsonb`, `frames jsonb`, `preview_kind nullable`, `preview_url nullable`, `claims_checked boolean`, `dependencies_checked boolean`, `version`.

words: objeto tipado con hook, on_screen, final_line, caption, cta (strings). frames: array acotado de objetos {order, image_url?, visible_text, action, duration_seconds?}. Límites de tamaño y schema de campos validados en servidor, no JSON libre ejecutable. Preview_kind: video/animatic/storyboard/frames/text. Claims_checked/dependencies_checked significan que se revisó la existencia de requisitos, no que se satisficieron todos. Si hay filas pendientes la aprobación sigue bloqueada. Packet no tiene estado de aprobación independiente.

### claims

`id`, `content_piece_id`, `statement`, `claim_kind CHECK IN ('fact','estimate','assumption')`, `source_reference_id nullable`, `source_locator nullable`, `verification_status CHECK IN ('pending','supported','unsupported')`, `verification_note nullable`, `verified_by nullable FK auth.users`, `verified_at nullable`.

Aprobar exige supported para todos los claims aplicables, referencia o localizador de evidencia no vacío, fecha y verificador. Una estimación/supuesto debe quedar rotulado como tal en el copy y tener base/nota; no transformar hipótesis en hechos. Las fuentes deben pertenecer al ámbito de la cuenta/marca de la pieza o estar marcadas explícitamente como públicas generales. No reutilizar contexto de otro cliente.

### approval_dependencies

`id`, `content_piece_id`, `label`, `required boolean DEFAULT true`, `status CHECK IN ('pending','satisfied','not_applicable')`, `evidence_note nullable`.

Para autorizaciones de imagen IJLV guardar solo confirmación y referencia mínima; los expedientes permanecen en el sistema restringido del colegio.

required + pending bloquea aprobar. not_applicable requiere motivo; satisfied requiere confirmación/nota. Las dependencias se crean manualmente por pieza; no imponer reglas de IJLV sobre Tec o Solotu. Editarlas es cambio material.

### review_decisions

`id`, `content_piece_id`, `content_revision`, `action CHECK IN ('approved','changes_requested','hold','released')`, `actor_id FK auth.users`, `decided_at`, `comment nullable`, `packet_snapshot jsonb`, `request_id UNIQUE`.

Append-only: denegar UPDATE/DELETE al rol de aplicación; inserción solo por comando validado. Snapshot incluye los textos, spec/referencias, claims y dependencias de la revisión, no el binario de assets. Rechazar approve sobre ownership external. No reutilizar snapshot de otra revisión.

### publications

`id`, `content_piece_id FK RESTRICT`, `channel_id`, `format`, `status` unscheduled/scheduled/published/cancelled, `scheduled_at nullable`, `published_at nullable`, `external_post_id nullable`, `external_url nullable`, `evidence_note nullable`, `scheduling_method CHECK = 'manual'`, `record_kind` local_record/source_observation, `version`.

Cuenta se deriva de pieza; validar que channel_id pertenece a account_channels activo al crear/programar. Índice único (content_piece_id,channel_id,format) para evitar duplicados accidentales; reapertura usa la misma fila. Identificador externo, si existe, único por cuenta/canal mediante validación transaccional o clave de destino derivada. No usar un external_post_id global que colisione entre plataformas.

Constraints: scheduled exige scheduled_at y published_at nulo; published exige published_at y URL o nota; unscheduled exige ambas fechas nulas; cancelled exige published_at nulo. Fechas anteriores de eventos se conservan en operation_events. Un comando puede conservar scheduled_at en published como fecha planeada histórica. No CHECK con now para limitar published_at: validar contra reloj servidor en la transacción. El estado published requiere aprobación local vigente u observación externa approved verificable y revisión completa confirmada; la revisión aprobada se captura en el evento de publicación.

### source_references

`id`, `content_piece_id nullable`, `account_id nullable`, `brand_id nullable`, `relation_kind` context_reference/external_mirror, `source_system` manual/st_hub/ijlv_editorial/solotu_cerebro, `source_entity_type nullable`, `source_entity_id nullable`, `source_url nullable`, `title`, `locator nullable`, `scope_kind` account/brand/public_general.

Para context_reference, exigir scope coherente (account con account_id, brand con brand_id, public_general sin datos privados). Para external_mirror exigir pieza external, identidad fuente completa y URL o localizador inequívoco. UNIQUE(source_system,source_entity_type,source_entity_id) en espejos; máximo un espejo principal por pieza external. Las referencias contextuales no son únicas por identidad: una misma fuente puede respaldar varias piezas de su ámbito. Preservar vínculo de cliente/sistema; no convertir manuales particulares en canon global.

### source_observations

`id`, `source_reference_id`, `source_state_raw text NOT NULL`, `observed_status nullable` (mismos estados de producción o unknown), `review_complete_confirmed boolean DEFAULT false`, `observed_on_hold boolean`, `observed_at timestamptz`, `recorded_at`, `recorded_by`, `evidence_note`, `request_id UNIQUE`.

Append-only; registrar mediante comando. observed_at no futuro; ordenar observaciones por observed_at y recorded_at/id para desempate. Corrección inserta nueva observación explícita. Latest determina estado efectivo del espejo. Aprobado exige evidencia, tipo de objeto editorial correcto y confirmación de revisión completa para contar como SAFE. La normalización manual conserva el estado bruto y puede marcar unknown si no hay equivalencia. P03 IJLV con audiovisual aprobado pero caption/portada pendientes no cumple revisión completa. Sin observación o unknown: no cuenta. El snapshot de producción externo es de lectura, no ediciones locales; solo campos propios de coordinación como asignación/prioridad son editables.

### operation_events

`id`, `content_piece_id nullable`, `publication_id nullable`, `event_type`, `actor_id`, `occurred_at`, `reason nullable`, `before_data jsonb`, `after_data jsonb`, `request_id UNIQUE`.

Historial append-only mínimo para cambios de estado no editoriales, reasignación, programación, publicación, cancelación y correcciones. No event sourcing: tablas operativas siguen siendo estado actual. No meter secretos en snapshots. Decisiones de revisión están en su propia tabla, no duplicarlas como fuente de verdad.

## Adiciones V0.2 (migración 0008, ver ADR-003)

- `brands.color` (paleta acotada) y `brands.short_label`.
- `content_formats` y `production_modes`: catálogos `key/label/sort/active`, solo lectura para la API.
- `brand_axes`: pilares y territorios por cliente (`kind`, `code`, `name`, `provisional`, `source_note`). Un trigger impide asignar a una pieza un eje de otro cliente o de otro tipo.
- `content_pieces`: `idea`, `origin` (own_idea/develop/generate/research/library), `format_key`, `production_mode_key`, `pillar_id`, `territory_id`.
- `planning_assignments.planned_date`: día dentro de `[week_start, week_start+7)`; si otro comando cambia la semana y el día queda fuera, se limpia.
- Comandos: `create_calendar_piece`, `move_piece_day` (CO412 si requiere convertir en flexible), `set_brand_appearance`, `upsert_brand_axis`; `update_piece` acepta idea, formato, modo y ejes como cambios materiales.

## Adiciones V0.2.1 (migración 0009, ver ADR-004)

- `brands.content_origins text[]`: orígenes habilitados (orgánico siempre).
- `content_pieces`: `content_origin` (organic | event_coverage | existing_material, default organic), `material_status` (not_required | pending | available), `needs_copy`, `event_name` (obligatorio en event_coverage), `source_system` (st_hub | onedrive | other), `source_entity_id`, `source_url` — referencias **manuales**, no sincronizadas.
- `origin` (0008) = modo de inicio creativo del flujo orgánico; nulo en evento y material.
- Comandos: `create_calendar_piece` con parámetros opcionales de origen/material; `set_brand_content_origins`; `update_piece` acepta evento, material, copy y referencias como cambios operativos.

## Entidades calculadas o diferidas

Portfolio y PlanningWindow son vistas/objetos de dominio. Coverage, Runway, BufferHealth, ReservePool y EditorialNeed se calculan, no tienen tabla materializada. MetricSnapshot, AgentProposal, jobs, integrations y métricas quedan fuera. No guardar un measurement_status sin funcionalidad real; la medición es un eje conceptual futuro separado de producción/publicación.

## Comandos de dominio mínimos

`createPiece`, `editDraft`, `assignWeek`, `unassignWeek`, `startProduction`, `submitReview`, `approve`, `requestChanges`, `hold`, `releaseHold`, `reopenApproved`, `archivePiece`, `createPublication`, `recordSchedule`, `recordPublished`, `cancelPublication`, `reopenPublication`, `recordSourceObservation`, `setTargetPolicy`.

Todos reciben identidad de sesión verificada, expected_version cuando actualizan, y request_id para efectos repetibles. Actor no se acepta como valor libre del cliente. Corregir publicación es comando explícito con motivo; no abrir UPDATE arbitrario. Validar relaciones e invariantes dentro de la transacción. Cuenta/bucket de una pieza con asignación/publicación no se cambia directamente: resolver relaciones antes o crear nueva pieza.

## Integridad y acceso

FK RESTRICT en registros operativos e históricos. Sin borrado duro de piezas con historial; usar archivo. RLS de lectura/escritura exige usuario autorizado activo. Revocar escritura directa a columnas de estado y tablas de decisiones/observaciones/eventos. Funciones privilegiadas tienen grants mínimos, búsqueda de esquema fija y comprobación explícita de sesión/allowlist/ownership.

Índices mínimos: piezas por cuenta/bucket/estado/archivo, asignaciones por week_start, publications por status/scheduled_at, decisiones por pieza/fecha y observaciones por referencia/observed_at. No optimizar con nuevos servicios. Probar constraint de objetivos concurrentes, dobles aprobaciones, asignaciones duplicadas y bypass directo de comandos.
