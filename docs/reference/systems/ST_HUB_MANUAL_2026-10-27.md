# ST Hub / Communication Hub

## Manual de sistema, arquitectura y continuidad operativa

**Edición:** 27 de octubre de 2026.  
**Baseline documentado:** `dbbd5bf` — cierre de ST Police.  
**Producto:** plataforma interna de Comunicación Digital del Campus Puebla.  
**Nombre instalado:** ST Hub. **Nombre técnico:** Communication Hub.

> Este manual describe el sistema existente, sus decisiones de producto y su operación. No es el prompt «Living Systems Architect». Se reconstruyó a partir de la conversación «Diseño de sistema IA», sus reportes y los archivos del repositorio leídos directamente en el commit `dbbd5bf`. Los estados de Production son evidencia histórica del cierre, no una auditoría en vivo realizada el 27 de octubre. No se ejecutaron migraciones, pruebas contra bases ni despliegues para redactarlo.

### Índice

1. [Propósito y límites](#1-propósito-y-límites)
2. [Estado canónico](#2-estado-canónico)
3. [Fuentes de verdad](#3-fuentes-de-verdad)
4. [Arquitectura](#4-arquitectura)
5. [Roles y capabilities](#5-roles-y-capabilities)
6. [Módulos y flujos](#6-módulos-y-flujos)
7. [Deadlines y tiempo](#7-deadlines-y-tiempo)
8. [Notificaciones, Web Push y PWA](#8-notificaciones-web-push-y-pwa)
9. [Scheduler y cron jobs](#9-scheduler-y-cron-jobs)
10. [Dashboard y lenguaje visual](#10-dashboard-y-lenguaje-visual)
11. [ST Police](#11-st-police)
12. [Entornos y seguridad](#12-entornos-y-seguridad)
13. [Migraciones 0001–0016](#13-migraciones-00010016)
14. [Operación y despliegue](#14-operación-y-despliegue)
15. [Testing y evidencia](#15-testing-y-evidencia)
16. [Backups, rollback e incidentes](#16-backups-rollback-e-incidentes)
17. [Credenciales](#17-credenciales)
18. [Backlog y qué no hacer](#18-backlog-y-qué-no-hacer)
19. [Handoff y continuidad](#19-handoff-y-continuidad)
20. [Referencias y límites de verificación](#20-referencias-y-límites-de-verificación)

## 1. Propósito y límites

ST Hub centraliza la operación de coberturas y producción editorial: quién hace qué, con qué brief, para cuándo, qué se entregó, qué requiere revisión y qué está listo para publicarse. Reduce la carga operativa y mental de Coordinación y ofrece a cada Storyteller una vista personal de sus compromisos.

El Hub organiza, calcula, detecta conflictos y presenta pendientes. El criterio editorial, las excepciones operativas y la decisión de publicar siguen siendo humanos. Un vencimiento es una condición calculada; no impone sanciones ni puntuaciones de productividad.

| Sistema | Responsabilidad |
|---|---|
| ST Hub | Operación, asignaciones, metadatos, enlaces, estados, planeación y avisos |
| Monday | Solicitud institucional externa; sin integración operativa vigente |
| OneDrive | Archivos y material; el Hub guarda enlaces, no multimedia |
| Meta Business Suite | Publicación operada manualmente; el Hub registra su estado |
| Proveedores Web Push | Transporte secundario de avisos al dispositivo |

Registrar «Programado» o «Publicado» no ejecuta una publicación en redes. El Hub no depende de Monday para funcionar ni interpreta solicitudes mediante capturas, OCR o IA.

## 2. Estado canónico

### Checkpoint que debe preservarse

```text
Git canónico informado en el cierre:
  main = origin/main = dbbd5bf
  último cambio funcional de ST Police = cd2a00b
  dbbd5bf = cierre documental sobre ese código

Production DB = 0001–0016
Development/Test DB = 0001–0016
0017 = no existe en este baseline

V2 = CLOSED / DEPLOYED
Visual UX Polish B1 = CLOSED / DEPLOYED
ST Police overdue reminder = CLOSED / DEPLOYED
V3 = PAUSED; requiere autorización explícita para iniciarse
Visual UX Polish B2 = separado; no autorizado

Production cron = 2 trabajos, cada 5 minutos
Development/Test cron = 0 trabajos
```

V2.1–V2.9 están cerradas. La antigua V2.10 de migración y smoke quedó **RETIRED / SUPERSEDED**, porque cada incremento tuvo su propio rollout. No existe una V2.11 pendiente. El pulido B1 y ST Police no constituyen V3 ni reabren V2.

| Entrega | Alcance | Cierre documentado |
|---|---|---|
| V2.1 | Capabilities | Incluida en V2 desplegada |
| V2.2 | Deadlines | Incluida en V2 desplegada |
| V2.3 | Contenidos y origen editorial | Production, 6 oct 2026 |
| V2.4 | CONECTA | Production, 8 oct 2026 |
| V2.5 | Editorial CONECTA | Production, 8 oct 2026 |
| V2.6 | Notificaciones internas | Production, 9 oct 2026 |
| V2.7 | Web Push | Production, 12 oct 2026 |
| V2.8 | Scheduler | Production, 12 oct 2026 |
| V2.9 | Dashboard unificado | Production, 12 oct 2026 |
| Visual UX Polish B1 | Presentación visual del Dashboard | Production, 13 oct 2026 |
| ST Police | Recordatorio visual personal | Production, 13 oct 2026 |

**Precaución de continuidad:** el checkout local consultado tenía `HEAD = f2e425e`, anterior al baseline. Por eso se leyeron los archivos mediante `git show dbbd5bf:<ruta>`, sin cambiar de rama. Un checkout antiguo o una rama exploratoria no sustituye el estado canónico. La igualdad actual de las ramas remotas y el deploy activo deberán revalidarse antes de una nueva intervención.

## 3. Fuentes de verdad

### Producto y documentación

1. `docs/PRD_Communication_Hub_V1.docx`: contrato original del producto.
2. Decisiones posteriores aprobadas y cierres de `docs/V2_HANDOFF_CHECKPOINT.md`: evolución V2 y cambios que superan propuestas anteriores.
3. `docs/Prompt_Maestro_Desarrollo.docx` y `CLAUDE.md`: protocolo y reglas de trabajo.
4. `docs/PROJECT_CHECKPOINT.md`: estado operativo y continuidad.
5. `docs/DEPLOYMENT_V1.md`: despliegue, variables, Push y scheduler, aunque conserve el nombre V1.
6. Código, migraciones, pruebas y evidencia del commit correspondiente: implementación verificable.

Las secciones históricas pueden decir «solo Dev», «siguiente migración» o «rollout pendiente». Se interpretan en su momento: los cierres posteriores prevalecen. Por ejemplo, la prohibición V1 de Push quedó superada por V2.7; la expectativa temprana de reintentos en V2.8 no se implementó y permanece en backlog.

### Datos y operación

| Dominio | Fuente de verdad | Representación o canal derivado |
|---|---|---|
| Trabajo, asignaciones y entregas | Tablas de dominio en PostgreSQL | Listados, tarjetas y Dashboard |
| Permisos efectivos | Perfil activo, rol, capabilities, RLS y guardas | Navegación y controles visibles |
| Fechas de entrega | `deadlines.effective_at` y reglas de dominio | Etiquetas de próximo/vencido |
| Historial de avisos | `notifications` | Campana y Web Push |
| Programación editorial | Piezas editoriales y fecha/hora registradas | Planeación y resumen del Dashboard |
| Publicación real | Acción externa humana | Registro manual del Hub |
| Migraciones aplicadas | `public.schema_migrations` del proyecto concreto | Archivos locales de migración |
| Despliegue efectivo | Deploy publicado en Netlify, vinculado a Git | Checkpoint documental |

El Dashboard no lee `notifications` para reconstruir trabajo pendiente. Un Push recibido no demuestra que el asunto siga pendiente ni concede acceso al destino.

## 4. Arquitectura

### Stack documentado

- Next.js 16, App Router; React 19; TypeScript; Tailwind CSS.
- Supabase Auth y PostgreSQL; RLS, constraints, triggers y funciones para autorización e invariantes.
- Netlify con runtime OpenNext administrado y despliegue automático desde `main`.
- Node 24 fijado en `.nvmrc` en el baseline.
- `pg_net` para despacho HTTP de Push después del commit; `pg_cron` para avisos temporales.
- PWA con manifest y service worker; biblioteca `web-push` en servidor.

Estas versiones describen el proyecto documentado; no son recomendaciones de actualización.

```text
Persona / navegador / PWA ST Hub
        │ sesión Supabase Auth
        ▼
Next.js: páginas, componentes y acciones de servidor
        │ validación + autorización de aplicación
        ▼
Lectores y escritores con cliente del usuario
        │
        ▼
Supabase PostgreSQL
  RLS + grants + constraints + guardas + transacciones
  │
  ├── Datos operativos ──► Dashboard de solo lectura
  ├── Triggers de sucesos ──► notifications
  └── pg_cron ──► funciones scheduler ──► notifications
                                              │ INSERT
                                              ▼
                               pg_net, tras confirmar transacción
                                              │
                                              ▼
                           Netlify /api/push/dispatch
                            RPC claim → web-push → RPC report
                                              │
                                              ▼
                            Dispositivo → entrada autenticada
                            → marcar propia leída → destino + RLS
```

La lógica pura de negocio se separa de UI y acceso a datos. Los módulos disponen de lectores/escritores, validación y acciones; la base conserva la última palabra ante concurrencia o una prelectura obsoleta. No se debe sustituir esa protección por un botón oculto.

Directorios de referencia: `src/app/`, `src/components/`, `src/lib/`, `src/types/database.ts`, `supabase/migrations/`, `supabase/rollbacks/`, `tests/unit/`, `tests/integration/` y `docs/`.

## 5. Roles y capabilities

Existen tres roles: `coordinator`, `storyteller` y `leader`. El actor CONECTA es una combinación de rol y capacidades, no un cuarto rol.

| Actor | Responsabilidad y acceso |
|---|---|
| Coordinación | Control operativo y editorial; todas las capabilities implícitas cuando el perfil está activo |
| Storyteller | Consulta permitida, autoasignación donde aplica, preproducción y entrega; no administra el pipeline editorial ni retira a otras personas |
| Liderazgo | Lectura de la operación V1; no obtiene capabilities V2 implícitas |
| Actor CONECTA | `leader` con `manage_conecta`; puede sumar `manage_content` y `manage_editorial_connecta` según su responsabilidad |
| Perfil inactivo | Sin capacidades efectivas; no conserva acceso por tener concesiones históricas |

### Reglas de capabilities

Las concesiones explícitas viven en `profile_capabilities`. Se revocan, no se borran: la fila revocada es inmutable y una nueva concesión crea otra fila. `manage_users` es exclusiva de Coordinación y no se concede mediante filas. `leader` y `storyteller` no reciben `read_all` ni otras capabilities implícitas.

Las capacidades no sustituyen automáticamente las políticas V1. `manage_coverages`, `manage_editorial_social` y `manage_planning` existen, pero no conceden escritura donde el dominio sigue protegido por rol. No se debe inferir una autorización solo a partir del nombre de una capability.

- Contenidos: Coordinación o creador con `manage_content`; no equivale a gestionar Editorial Social.
- CONECTA: las capacidades correspondientes solo tienen efecto con `leader` o `coordinator`; una concesión accidental a un Storyteller no lo convierte en gestor.
- Editorial CONECTA: `manage_editorial_connecta` permite gestionar la pieza editorial, no leer automáticamente la nota ni datos del solicitante.
- La UI de administración de capabilities está en backlog. La concesión actual es un procedimiento operativo controlado.

## 6. Módulos y flujos

### 6.1 Eventos y Coberturas

`Nuevo evento` permite alta manual rápida y ofrece `Configurar cobertura`. El evento conserva fecha, horario, lugar, categoría y contexto; la cobertura añade brief, entregables, cupo, restricciones y equipo.

```text
Evento manual → configurar cobertura → asignar/autoasignarse
→ consultar brief y preproducción → realizar cobertura
→ entregar enlace de OneDrive, propuesta de copy y observaciones
→ decisión explícita de Coordinación → Editorial Social
```

- Los conflictos académicos siguen vigentes mediante `app.has_schedule_conflict` y bloquean la autoasignación cuando corresponde.
- Coordinación puede usar la excepción explícita «Asignar de todas formas».
- El último cupo se protege atómicamente: dos intentos simultáneos producen como máximo un éxito.
- No hay dos asignaciones activas de una misma persona a la misma cobertura.
- El Storyteller no puede darse de baja por sí mismo; solicita el cambio.
- La preproducción y las entregas conservan enlaces, no archivos multimedia.
- No se crea automáticamente una pieza editorial al entregar material.

### 6.2 Contenidos

Dominio de producción que no requiere un evento ni una cobertura artificial. Tablas principales: `contents`, `content_assignments`, `content_submissions` y `content_links`.

```text
pending → in_production → ready_for_review → approved → completed
                              │
                              └→ changes_requested → ready_for_review
```

Coordinación gestiona cualquier Content; el creador necesita `manage_content` para gestionar el propio. Todo perfil activo puede leer los Contenidos. El cupo es transaccional; la autoasignación puede abrirse o cerrarse y no hay baja voluntaria.

Existe una entrega por Storyteller y Content, con OneDrive y/o copy, durante `in_production` o `changes_requested`. Se congela desde `approved`. El deadline `content_due` es manual. `completed` es terminal, con las excepciones descriptivas documentadas.

Solo Coordinación envía a Editorial Social desde `approved` o `completed`, eligiendo una entrega válida. Material y copy se copian como instantánea. La deduplicación de la acción por origen/cuenta/formato no es una garantía UNIQUE en la base; no debe documentarse como tal.

### 6.3 CONECTA

Producción de notas con solicitante, dueño, equipo, enlaces, checklist y rondas de revisión. Tablas: `conecta_notes`, `conecta_assignments`, `conecta_review_rounds` y `conecta_links`.

```text
pending → in_production → in_review → approved → delivered
                              │
                              └→ changes_requested → in_review

Estado no terminal → cancelled, con motivo obligatorio
```

- `owner_id` y `created_by` son distintos; el ownership es inmutable incluso para Coordinación.
- No existe autoasignación. Iniciar producción exige una asignación activa.
- El Storyteller asignado envía la ronda; Coordinación o el dueño decide, nunca su autor.
- Solo hay una ronda abierta; no hay máximo de rondas. Una decisión cierra e inmoviliza la ronda.
- Las rondas controlan `in_review`, `changes_requested` y `approved`; no son cambios libres del formulario.
- `changes_requested` exige comentarios; el checklist es informativo.
- Desde `approved` se congelan brief, solicitante, equipo y enlaces. El deadline admite cambios hasta aprobado; `delivered` y `cancelled` lo congelan.
- `delivered` significa entregado al solicitante, no publicado en el sitio.
- CONECTA no tiene requisito de Rectora.
- El Storyteller retirado pierde acceso a la nota; un `leader` sin `manage_conecta` tampoco la lee.

### 6.4 Editorial Social

Piezas en `editorial_items`, con origen Coverage o Content, exactamente uno. Solo Coordinación escribe en el pipeline vigente.

```text
pending_review → approved → scheduled → published
       │
       └→ changes_requested → pending_review
```

`published` es terminal. Las correcciones no son un paso obligatorio; cuando se solicitan, requieren comentarios visibles. Se conservan separados `proposed_copy` y `final_copy`.

Si se requiere aprobación de Rectora, la base impide aprobar sin confirmación. Para cobertura, el requisito efectivo combina evento y cobertura. La aprobación ocurre fuera del Hub; Coordinación registra la confirmación. «Rectora» como cuenta de destino y «Requiere Rectora» como condición son señales distintas.

### 6.5 Editorial CONECTA

Dominio separado en `conecta_editorial_items`. Una nota `approved` o `delivered` puede enviarse por decisión humana; el servidor crea una instantánea de título, documento y ronda aprobada.

```text
pending → scheduled → published
   │          │
   └──────────┴→ withdrawn
```

Solo hay una pieza no retirada por nota, protegida por índice único parcial. Retirar permite un nuevo envío; publicar impide otra pieza activa. No hay borrado. `published` y `withdrawn` son terminales.

Si se cancela la nota, una pieza pendiente o programada solo puede retirarse. Una publicada permanece como historia. Una publicada sin URL admite una única escritura para agregarla, sin modificar otros campos.

La capacidad editorial por sí sola no concede acceso a nota, solicitante, rondas o comentarios. Quien puede leer la nota ve únicamente un resumen editorial seguro, no el copy ni el motivo de retiro. Los permisos operativos y editoriales se evalúan por separado; alguien que reúne ambos puede ejercer ambos accesos legítimos.

### 6.6 Planeación

Calendario editorial semanal de Campus Puebla, PrepaTec Puebla y Rectora. «Aprobados sin programar» funciona como reserva de piezas listas.

- Campus Puebla: meta de 5 piezas de feed por semana.
- PrepaTec Puebla: meta de 4 piezas de feed por semana.
- Stories: meta diaria de 3 según la regla vigente; no se compensan déficits con otro día.
- Rectora: sin cuota.
- Una pieza `story` representa un lote; `story_count > 0` expresa su cantidad. Feed cuenta filas; Stories suma esa cantidad.
- Programar requiere día y hora. Mover de día conserva la hora; no se inventa una al arrastrar.
- `published` permanece visible como ejecución y no se reprograma desde Planeación.
- El arrastre de escritorio conserva una alternativa accesible mediante acciones explícitas.

Las funciones de conteo son compartidas con Dashboard; no se crea un segundo cálculo de metas. Editorial CONECTA conserva su dominio y no se convierte en una pieza Social para entrar en sus cuotas.

### 6.7 Equipo y Horarios

Equipo presenta personas y la información permitida por la sesión. Web Push añade únicamente «Push activo» o «Push no configurado»; no expone endpoints ni detalles del dispositivo.

Horarios conserva periodos y bloques académicos, usados en los conflictos de autoasignación. Su eliminación propuesta quedó superada por la decisión del 12 de octubre de 2026. El rediseño de Equipo no es una deuda que impida cerrar V2.

## 7. Deadlines y tiempo

La zona operativa es **`America/Mexico_City`**, una constante de producto. Los valores de `datetime-local` se interpretan en ella; no se usa el huso del navegador ni un desplazamiento fijo como sustituto.

| Dominio | Kind | Cálculo | Efecto |
|---|---|---|---|
| Cobertura | `ready_for_publish` | Fin del evento + 1 hora, salvo override | Define entrega vencida |
| Cobertura | `backup_complete` | Fin del evento + 24 horas, salvo override | Informativo; no prueba respaldo real |
| Contenido | `content_due` | Manual; `effective_at = override_at` | Señala plazo de entrega |
| Nota CONECTA | `conecta_delivery` | Manual; `effective_at = override_at` | Señala entrega al solicitante |

Sin hora final del evento no se inventa duración ni deadline automático. Las categorías A/AA/AAA no determinan estos plazos. Un cambio de evento recalcula el automático sin pisar el override; si su base cambió, se señala como desfasado. Los deadlines manuales de Contenidos y CONECTA nunca son «desfasados» por esa regla.

`coverages.deadline` es legacy: no se lee ni escribe en los flujos vigentes. El backfill preservó valores V1 sin crear deuda retroactiva para eventos terminados que no tenían deadline.

Un vencimiento requiere fecha efectiva, estado elegible y entrega pendiente según el dominio. «Falta liga» por sí solo no significa «vencido». El scheduler y el Dashboard deben conservar esa semántica común.

## 8. Notificaciones, Web Push y PWA

### Bandeja interna

`notifications` es una bandeja por persona y la fuente canónica de avisos. Guarda destinatario, tipo, destino, asunto acotado, deduplicación y timestamps; no incluye briefs, datos del solicitante ni comentarios sensibles.

- V2.6 aporta 11 sucesos síncronos; V2.8 agrega 10 tipos temporales: 21 kinds en este baseline.
- Los sucesos cubren asignaciones, disponibilidad, cambios solicitados, publicación Social y revisión/decisión CONECTA.
- Se excluyen el actor, perfiles inactivos y duplicados; un no-cambio no genera aviso.
- `app.emit_notification` es el creador único; los flujos usan su envoltura best-effort.
- Solo se leen avisos propios con perfil activo. No hay INSERT, UPDATE o DELETE directos del cliente.
- `mark_notifications_read` es la mutación permitida: una selección propia o todas las propias pendientes. No existe «volver a no leída».
- `/notificaciones` muestra los 50 más recientes, sin paginación ni filtros.
- La campana está en el encabezado: no ocupa uno de los lugares de navegación móvil.
- Se actualiza por navegación y acciones; no es tiempo real.

Abrir desde la bandeja marca como leído mediante POST y deriva el destino en servidor. El prefetch no marca nada. Si falla el marcado, se intenta abrir el destino de todas formas. Abrir el objeto por otra vía no marca su aviso.

El destino no tiene FK por ser polimórfico: puede quedar un aviso histórico de un objeto eliminado. La ruta y RLS vuelven a controlar el acceso.

### Web Push

```text
INSERT notifications
→ trigger best-effort
→ pg_net: POST con id y X-Push-Secret, después del commit
→ /api/push/dispatch
→ push_dispatch_claim
→ envío web-push a dispositivos del destinatario
→ push_dispatch_report
```

El despacho usa RPC protegidas por secreto y clave pública de Supabase. **No introduce `service_role` en Netlify.** `push_dispatches.notification_id` impide reclamar y reenviar una misma notificación normalmente. Los despachos reclamados sin terminar no se recuperan automáticamente en este baseline.

`push_subscriptions` permite varios dispositivos por persona; endpoint único HTTPS. Guardarlo desde otra sesión transfiere ese navegador al usuario actual. La UI de Equipo recibe solo un booleano.

- El permiso se pide únicamente al pulsar «Activar avisos» en `/notificaciones`.
- La interfaz distingue no compatible, no configurado, bloqueado, desactivado, activo e instalación necesaria en iPhone/iPad.
- Al salir se intenta desuscribir y borrar el endpoint de ese navegador, con límite de 1,5 s; el fallo no bloquea el logout ni borra otros dispositivos.
- 404/410/403 del servicio de entrega retiran la suscripción según el contrato implementado; otros fallos se registran sin reintento. El envío tiene timeout de 8 s.
- La notificación interna se conserva aunque el Push falle.

### PWA ST Hub

Manifest nativo con `display: standalone`, iconos de aplicación y nombre instalado **ST Hub**. `/sw.js` atiende `push` y `notificationclick`; no incorpora caché offline ni credenciales y no escribe directamente en Supabase. La PWA no implica una app nativa ni funcionamiento offline.

El clic abre `/notificaciones/abrir/[id]`. La aplicación utiliza la sesión real, marca solo el aviso propio y deriva un destino interno seguro. Un id ajeno o inválido lleva a la bandeja; sin sesión se conserva el control de autenticación. No se transportan tokens de autenticación en el Push.

La entrega real vía servicio Apple, el clic, marcado y baja se verificaron en el rollout V2.7 con un dispositivo propio. Las limitaciones del navegador embebido durante el RC no deben confundirse con pendientes actuales de ese cierre.

## 9. Scheduler y cron jobs

El scheduler crea notificaciones normales; **no cambia estados**, no publica y no gestiona directamente VAPID ni suscripciones.

| Job | Frecuencia Production | Función |
|---|---|---|
| `v28-coverage-day` | `*/5 * * * *` | `app.scheduler_coverage_day(p_now)` |
| `v28-deadline-reminders` | `*/5 * * * *` | `app.scheduler_deadlines(p_now)` |

`pg_cron` está instalado en Dev, pero Dev tiene **0 trabajos**. `0016` instala funciones y extensión; no programa los jobs. Su activación es un paso separado del rollout de Production.

### Disparos y destinatarios

- Cobertura del día: marca a medianoche local; Storytellers activos con asignación activa, cobertura abierta y evento aceptado. Nunca Coordinación.
- Coberturas: 6 h, 1 h y vencido de `ready_for_publish`; asignados activos sin entrega propia y cobertura abierta.
- Contenidos: mismos momentos para `content_due`; asignados activos sin entrega propia, en `in_production` o `changes_requested`.
- CONECTA: mismos momentos para `conecta_delivery`. En producción/cambios, asignados activos; en revisión/aprobado, dueño activo que todavía puede gestionar o, en su defecto, Coordinación activa.
- No avisa por `backup_complete`, estados terminales ni deadlines inexistentes. Las dos Editoriales no tienen deadlines propios modelados.

### Ventana y deduplicación

Una marca solo dispara en **`(p_now − 30 min, p_now]`**. El límite izquierdo es exclusivo. No recupera marcas fuera de la gracia y no emite deuda histórica al activarse. Una caída de más de 30 minutos puede perder avisos; el estado calculado del trabajo sigue visible en el Hub.

La clave incorpora destinatario y, para deadlines, fecha efectiva. Cambiar la fecha abre otro ciclo sin borrar historia. La cobertura del día usa cobertura y fecha local. Repetir una ejecución no debe duplicar el aviso.

Cada emisión tiene aislamiento transaccional; un fallo sistémico debe reflejarse como job fallido. El reloj `p_now` permite probar límites sin esperas reales. No hay reintentos Push ni limpieza programada de `cron.job_run_details` implementados en V2.8.

## 10. Dashboard y lenguaje visual

V2.9 integra Coberturas, Contenidos, CONECTA y ambas Editoriales **por situación**, con lecturas sujetas a RLS. Es de solo lectura: enlaza al módulo donde se resuelve cada asunto; no asigna, aprueba, programa ni edita.

Precedencia en Atención:

```text
Vencido > espera revisión > cambios solicitados > por vencer > resto
```

Se deduplica una pieza por Atención, con las excepciones de señales de Rectora. «Próximo» usa 48 h. Hoy, Esta semana y Próximo evitan repetir innecesariamente elementos; el resumen semanal «Lo que viene» limita a cinco y enlaza al módulo.

| Perfil | Vista |
|---|---|
| Coordinación | Operativa |
| Storyteller | Personal, aunque tenga una capability accidental |
| `leader` con `manage_conecta` | CONECTA |
| Otro `leader` | Operativa de solo lectura |

B1 mejora la lectura sin cambiar consultas, datos ni reglas: pulso de métricas, medidores, línea de tiempo, barras de metas, Stories por día, carga semanal y pipeline CONECTA. Liderazgo tiene una síntesis propia; no se le muestran dominios que no pueda leer.

Reglas visuales: color con significado, icono y texto; cifras y equivalentes accesibles; deadline relativo acompañado de fecha absoluta; cálculo en servidor, sin reloj progresivo del navegador. Los tokens `--viz-*` son del Dashboard y no recolorean globalmente los módulos. La carga semanal cuenta una vez lo fechado y accionable, excluyendo `backup_complete` y lo sin fecha.

**B1 CLOSED / DEPLOYED**, sin migración ni nuevas consultas. B2 —extender el lenguaje visual a otros módulos— permanece separado y no autorizado.

## 11. ST Police

Recordatorio lúdico derivado del trabajo realmente vencido del Storyteller. No es una fila de `notifications`, un Push, una tarea de cron ni una sanción.

- Solo Storyteller activo; nunca Coordinación o Liderazgo.
- Coberturas: asignación activa, cobertura abierta, sin entrega propia, `ready_for_publish.effective_at < now` y dentro de la ventana histórica del Dashboard.
- Contenidos: asignación activa, `in_production` o `changes_requested`, sin entrega propia y `content_due` vencido.
- CONECTA y `backup_complete` quedan fuera.
- Usa las mismas funciones de dominio que el Dashboard; no equipara «falta liga» a vencimiento.
- Integración en `src/app/(app)/layout.tsx`: dos lecturas pequeñas en paralelo, solo para el Storyteller; sin N+1. Si la lectura falla, no muestra aviso.
- Una vez por sesión del navegador y conjunto vencido, con huella de ids en `sessionStorage`; se marca visto únicamente con pestaña en primer plano.
- Entrada desde abajo ~550 ms, permanencia ~4 s y salida ~500 ms; con movimiento reducido usa fundido.
- Toque/clic o Escape cierra; no atrapa foco; `role="status"`, anuncio único, imagen decorativa `alt=""` y cierre accesible.
- Asset `public/st-police-overdue.webp`: 1080×1350, transparente, ~161 KB, conservado sin modificar y descargado solo al mostrarlo.

El propietario confirmó caso positivo, animación, legibilidad y sesión en Production. Coordinación no ve el aviso ni descarga el asset. No se añadieron migraciones, preferencias, escrituras ni fixtures en Production. **ST Police = CLOSED / DEPLOYED**.

## 12. Entornos y seguridad

| Entorno | Proyecto Supabase | Uso | Cron al cierre |
|---|---|---|---|
| Development/Test vigente | `communication-hub-dev`, `us-east-2` | Desarrollo, fixtures e integración | 0 |
| Production | `communication-hub-prod`, `us-east-2`, organización separada | Operación real | 2 activos |
| Dev anterior | `communication-hub`, `us-east-1` | Archivo pausado | No reactivar |

Los planes Free y regiones son los documentados, no una consulta actual de facturación. Evaluar Pro y continuidad durante inactividad pertenece al backlog.

`.env.local`, seed y pruebas de integración apuntan exclusivamente a Dev vigente. No existe staging en el modelo documentado. **Push a `main` publica automáticamente en Netlify.** Un deploy preview no constituye por sí solo un entorno seguro: su base y secretos también tendrían que estar aislados.

### Fronteras de seguridad

- Supabase Auth identifica; RLS, grants y guardas autorizan. La UI refleja esa autorización.
- Conocer un UUID o recibir una notificación no concede lectura ni escritura.
- Constraints y transacciones protegen cupos, padres exclusivos, estados y concurrencia.
- Las RPC privilegiadas validan identidad o secreto según contrato; las funciones internas no se habilitan a clientes por comodidad.
- El cliente no fija auditoría ni timestamps reservados al servidor.
- No hay `service_role` en el runtime de Netlify ni en el navegador.
- La separación CONECTA/Editorial CONECTA limita exposición de datos del solicitante.
- El texto de usuario se renderiza como texto, no HTML ejecutable.
- Se documentaron cinco cabeceras de seguridad; CSP no estaba implantada. Su evaluación comienza en Report-Only y sobre el despliegue real.

### Alta de cuentas

Onboarding administrativo mediante `Create user`, no `Invite`: contraseña temporal única, rol y `active` correctos, entrega directa y cambio en `/cambiar-contrasena`. No hay SMTP, magic links ni recovery por correo en el contrato documentado. Forzar técnicamente el primer cambio de contraseña sigue en backlog.

## 13. Migraciones 0001–0016

Archivos versionados en `supabase/migrations/`, con reversos correspondientes en `supabase/rollbacks/`.

| Versión y archivo SQL | Responsabilidad |
|---|---|
| `0001_fase0_schema` | Esquema base V1, dominios operativos y autorización |
| `0002_fase2_monday_sync` | Antecedente de sincronización Monday, posteriormente retirado |
| `0003_fase2b_desacoplar_monday` | Desacoplamiento de Monday |
| `0004_fase2b_neutralizar_sync_state` | Neutralización del estado de sincronización |
| `0005_fase6_planeacion` | Planeación editorial |
| `0006_v2_capabilities` | Concesiones por perfil y helpers de capacidades |
| `0007_v2_deadlines` | Motor de deadlines de cobertura y overrides |
| `0008_v2_contents` | Contenidos, equipo, entregas y enlaces |
| `0009_v2_content_deadlines` | Deadline manual `content_due` |
| `0010_v2_editorial_content_origin` | Origen Coverage o Content en Editorial Social |
| `0011_v2_conecta_notes` | Notas, asignaciones, rondas, enlaces y guardas CONECTA |
| `0012_v2_conecta_deadlines` | Deadline manual `conecta_delivery` |
| `0013_v2_conecta_editorial` | Dominio editorial CONECTA separado |
| `0014_v2_notifications` | Bandeja, emisión, triggers y marcado de lectura |
| `0015_v2_web_push` | Suscripciones, despachos, RPC y `pg_net` |
| `0016_v2_scheduler` | Tipos y funciones temporales; instala `pg_cron`, sin programar jobs |

Las cuatro primeras cifras forman parte del nombre completo con extensión `.sql`. No se borran migraciones históricas de Monday: su neutralización conserva la historia. Tampoco se reutiliza una versión con otro contenido.

Baseline estructural reportado tras `0016`: **27 tablas, 78 políticas, 64 funciones `app`, 48 triggers, 79 índices y 19 enums; RLS 27/27**. Son cifras de control del checkpoint, no recuentos actuales de registros operativos.

Reglas de cambio:

1. Crear una migración nueva y revisar preservación de datos, grants y guardas.
2. Ensayar aplicación, reverso y reaplicación en Dev.
3. Regenerar `src/types/database.ts` tras migrar.
4. Comprobar inventario y backup antes de Production.
5. Verificar `public.schema_migrations` en la base correcta: `db:status` solo lista versiones locales y puede crear la tabla de control si falta; no sirve como auditoría puramente de lectura.
6. No inventar `0017`: será la siguiente numeración únicamente si un cambio futuro requiere esquema.

## 14. Operación y despliegue

El proceso es proporcional al riesgo: contrato/arquitectura cuando hay decisiones relevantes, implementación consolidada, RC, rollout y cierre. No fragmentar cambios simples en microaprobaciones. Un cambio visual no justifica una migración.

### Desarrollo y RC

1. Leer checkpoint vigente y reglas aplicables; identificar rama, commit y árbol de trabajo.
2. Confirmar proyecto Dev y alcance autorizado; preservar cambios ajenos.
3. Implementar y ejecutar pruebas focalizadas; ensayar migración si aplica.
4. Validar lint, tipos, build y suites pertinentes; hacer smoke representativo.
5. Registrar PASS/FAIL/BLOCKED con evidencia, riesgo y rollback.

### Production

1. Confirmar `main`, `origin/main`, candidato, diff y ausencia de cambios ajenos; no asumir que el checkout encontrado es el canónico.
2. Confirmar identidad de Supabase y Netlify, esquema real y compatibilidad entre app y base.
3. Para migración, obtener inventario y respaldo verificado; preparar recuperación.
4. Aplicar únicamente las migraciones previstas y verificar sus efectos. Configuración de Vault y cron se maneja explícitamente.
5. Integrar por fast-forward cuando corresponda y push normal; no reescribir historia estable.
6. Esperar el deploy publicado y verificar su SHA. No confundir «push aceptado» con «Production lista».
7. Smoke del área afectada con sesiones legítimas, casos positivos/negativos, móvil y escritorio cuando cambia UI.
8. Comprobar errores, datos y fixtures; cerrar docs con SHA final, estado DB y evidencia.

Las referencias actuales para el despliegue son [aplicación](https://communication-hub-tec-puebla.netlify.app) y el [repositorio privado](https://github.com/rodrigolenero-comunicacion/communication-hub). Los enlaces proceden del checkpoint; no se comprobó disponibilidad en esta redacción.

En el día a día, revisar fallos relevantes de Netlify, estado e historia de cron, errores del dispatcher y asuntos pendientes en la bandeja. Los logs deben permitir saber si un proceso corrió y qué falló, sin publicar secretos ni datos personales.

## 15. Testing y evidencia

| Área | Comprobaciones esenciales |
|---|---|
| Dominio | Transiciones, plazos, estados terminales, snapshots y reglas de producto |
| Acceso | Roles, capabilities, ownership, inactivos, retirados e intento directo por UUID |
| Concurrencia | Último cupo, doble envío, doble decisión, publicación frente a cancelación |
| Migraciones | Preservación, reverso, residuos esperados y reaplicación |
| Notificaciones | Destinatario, actor omitido, dedupe, destino y leído propio |
| Push | Secreto, claim único, fallos, baja del dispositivo y clic autenticado |
| Scheduler | Reloj fijo, gracia exacta, medianoche local, cambio de fecha y ausencia de deuda histórica |
| UI | Vacíos/errores, responsive, teclado, foco, movimiento reducido y enlaces |
| Datos | Fixtures acotadas por corrida y comparación de baseline antes/después |

Comandos documentados: `npm test`, `npm run validate`, `npm run build`, `npm run typecheck`, `npm run db:types`; los comandos de migración se ejecutan solo tras identificar el entorno.

La integración usa Supabase Dev real y corre en serie para evitar límites de autenticación. Los tipos de rutas de Next pueden exigir un build inicial o actualizado antes del typecheck. Una interrupción de red no prueba un defecto de producto, pero tampoco autoriza declarar PASS: se preserva el fallo, se limpia la corrida y se verifica lo afectado.

### Evidencia histórica, no pruebas ejecutadas para este documento

| Entrega | Validación registrada |
|---|---|
| V2.7 | 1239 unitarias + 919 integración; lint, tipos y build verdes |
| V2.8 | 1285 + 945; reloj fijo y preservación Dev |
| V2.9 | 1316 + 954; Dashboard y matriz de vistas |
| Visual B1 | 1341 + 954; smoke Dev multirrol y Production representativo |
| ST Police | 1361/1361 unitarias y 20/20 integración relacionada; lint, tipos y build |

No sumar estos totales: corresponden a checkpoints sucesivos. ST Police documenta integración relacionada, no una nueva ejecución completa de toda integración. El caso visual positivo final de ST Police fue confirmado por el propietario en Production.

## 16. Backups, rollback e incidentes

### Respaldo previo

Antes de una migración relevante en Production: inventario, dump, comprobación de existencia/tamaño, SHA-256, listado legible con `pg_restore -l`, manifiesto sin secretos y permisos restrictivos. Registrar proyecto, fecha, commit, versiones aplicadas y herramienta utilizada.

Ejemplo de nomenclatura, no archivos creados en esta tarea:

```text
communication-hub-prod-pre-<release>-<fecha-hora>.dump
communication-hub-prod-pre-<release>-<fecha-hora>.dump.sha256
communication-hub-prod-pre-<release>-<fecha-hora>.list
communication-hub-prod-pre-<release>-<fecha-hora>.manifest
```

Una lista de objetos y un checksum no equivalen a un ensayo de restauración. Comprobar cobertura de Auth y otros componentes según el método de respaldo; no asumir que un dump por sí solo recupera toda la configuración del proveedor. No existe evidencia suficiente aquí para afirmar una política periódica automatizada ni objetivos RPO/RTO aprobados: deben definirse antes de prometerlos.

### Contención y rollback por capa

| Problema | Primera medida a evaluar |
|---|---|
| Scheduler defectuoso | Desprogramar solo los jobs afectados; preservar historial |
| Fallo de entrega Push | Aislar despacho; conservar bandeja y operación principal |
| Regresión de app | Volver a un deploy compatible con el esquema actual |
| Migración defectuosa | Evaluar reverso ensayado y pérdida de datos antes de aplicarlo |
| Corrupción de datos | Contener escrituras, preservar evidencia y preparar restauración validada |

No revertir toda la base por un problema visual. Un rollback de aplicación no revierte datos ni configuración. Un reverso SQL puede eliminar información añadida desde el rollout y exige evaluar ese impacto.

Residuos conocidos:

- `0011_down` deja el valor enum `conecta_delivery` inerte; requiere revertir `0012` primero si depende de él.
- `0015_down` deja `pg_net` instalado.
- `0016_down` retira solo jobs `v28-*`, restaura el emisor previo y elimina funciones añadidas; conserva diez valores enum inertes, la extensión `pg_cron` y avisos ya emitidos.

Ante un incidente: determinar impacto → contener → preservar evidencia → identificar fuente de verdad → corregir con alcance mínimo → validar → documentar y prevenir recurrencia. No usar un incidente pequeño como autorización implícita para rediseñar el producto.

## 17. Credenciales

Este documento no contiene valores secretos. Las ubicaciones siguientes son referencias operativas documentadas, no confirmación de que hoy existan o sigan vigentes:

- `.env.local`: Dev; fuera de Git. Editar solo líneas necesarias, después de volver a leer la versión actual; nunca sobrescribirlo desde una copia antigua.
- `~/.config/communication-hub/prod-rollout.env`: credencial de rollout conservada, permisos `600`.
- `~/.config/communication-hub/dev-push.env`: configuración Push Dev, permisos `600`.
- Netlify: variables del runtime y build según su contrato.
- Supabase Vault: `push_dispatch_url` y `push_dispatch_secret` por proyecto.

| Variable | Clasificación / uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Identidad pública del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública; no sustituye RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Pública, suscripción del navegador |
| `VAPID_PRIVATE_KEY` | Secreta, solo servidor |
| `VAPID_SUBJECT` | Contacto/identidad del emisor según configuración |
| `PUSH_DISPATCH_SECRET` | Secreto servidor, alineado con Vault |
| `SUPABASE_ACCESS_TOKEN` | Administración según alcance; nunca runtime público |

Dev y Production usan pares VAPID y secretos distintos. No imprimir secretos, guardarlos en Git, capturas, manifests de backup o conversaciones. Reutilizar una credencial válida y correctamente acotada; renovar si expiró o perdió alcance, rotar si fue expuesta. No solicitar tokens nuevos por rutina. Un token de lectura no habilita migraciones aunque una llamada solicite escritura.

## 18. Backlog y qué no hacer

### Producto pendiente, sin reabrir V2

- UI para conceder/revocar capabilities.
- Onboarding guiado: cuenta, contraseña, Push y dispositivo.
- Transferencia de ownership de Contenidos y CONECTA.
- Notificaciones en tiempo real.
- Rondas de entrega para piezas Editorial de Content en `changes_requested`.
- Catálogo propio de entregables de Contenidos.
- Microcopy neutro en género de «Estás asignado».
- B2 de lenguaje visual compartido, separado y sin autorización vigente.

### Hardening registrado

- Reintentos Web Push y recuperación de despachos reclamados sin terminar.
- Timeouts de red de las pruebas de integración.
- Validación de fechas imposibles en el editor de deadlines de cobertura.
- Lectura duplicada de `generateMetadata` en detalle CONECTA.
- Avisos `MODULE_TYPELESS_PACKAGE_JSON`.
- DOM oculto transmitido antes de `notFound()` en ciertas rutas.
- Corte de stream con envío previo a hidratación, observado y no reproducido en uso normal.
- Retirada explícita de `coverages.deadline` legacy.
- Limpieza opcional de `cron.job_run_details`.
- CSP Report-Only, evaluación de Supabase Pro, targets táctiles de 32×32, primer cambio de contraseña obligatorio y observabilidad.
- Decisión sobre el Dev histórico pausado.

Priorizar por impacto, probabilidad y coste. Una propuesta no equivale a autorización ni a defecto bloqueante del cierre.

### Restricciones de continuidad

- No arrancar V3 ni renombrar pendientes como V2.10/V2.11.
- No reabrir fases cerradas sin nueva evidencia o decisión.
- No eliminar conflictos académicos: se decidió conservarlos.
- No añadir sanciones, scoring, IA, chat, WhatsApp, SMS, correo, app nativa, Sprinklr o importación Monday dentro del alcance vigente.
- No automatizar aprobación de Rectora ni publicación externa.
- No almacenar multimedia ni construir integración OneDrive sin una decisión nueva.
- No convertir el Dashboard en editor ni persistir sus contadores derivados.
- No confundir Push con fuente de verdad, ST Police con notificación ni vencimiento con transición.
- No habilitar cron en Dev ni enviar avisos reales desde fixtures.
- No usar Production como entorno de prueba, entrar a cuentas ajenas o crear capacidades permanentes para un smoke.
- No reescribir migraciones aplicadas, hacer force-push por rutina o reemplazar secretos en bloque.
- No afirmar que un despliegue, respaldo o prueba pasó sin evidencia.

## 19. Handoff y continuidad

### Lectura inicial de una nueva sesión

1. Leer este manual y `docs/PROJECT_CHECKPOINT.md`.
2. En `docs/V2_HANDOFF_CHECKPOINT.md`, comenzar por §S (cierre V2), §T (Visual B1) y §U (ST Police); acudir a §A y §L–§R para detalle e historia.
3. Leer `CLAUDE.md` y el procedimiento de despliegue; resolver cualquier contradicción con decisiones posteriores antes de cambiar producto.
4. Identificar repositorio, rama, HEAD y cambios locales. No «arreglar» un checkout antiguo con reset destructivo.
5. Para intervenir infraestructura, verificar primero identidad del entorno y estado real; no tomar recuentos históricos como inventario actual.
6. Mantener V3 pausada y elegir solo trabajo autorizado.

### Registro mínimo al terminar una intervención

```text
Fecha y responsable:
Objetivo autorizado:
Repositorio / rama / SHA de aplicación:
SHA de cierre documental:
main / origin/main y evidencia de sincronización:
Netlify deploy publicado:
Dev DB / Production DB:
Jobs activos por entorno:
Configuración cambiada (sin valores secretos):
Pruebas PASS / FAIL / BLOCKED:
Smoke real y limitaciones:
Backup verificado y procedimiento de recuperación:
Fixtures retiradas / comparación antes-después:
Decisiones nuevas y documentos que actualizan:
Pendientes clasificados:
Siguiente acción autorizada:
```

Una entrega está cerrada cuando el comportamiento está validado, el deploy corresponde al candidato, Production fue comprobada en el alcance pertinente, los datos se preservaron y la documentación permite continuar. Si no hubo sesión legítima para un rol, se registra qué quedó cubierto en Dev y qué requiere confirmación humana; no se inventa una prueba de Production.

## 20. Referencias y límites de verificación

Fuentes consultadas:

- Conversación **Diseño de sistema IA**, id `6a7c05af-16cc-83e8-9a42-51f80bcf27fc`: cierre de ST Police y confirmación del estado canónico.
- Conversación **Completa los checks de V2.7 B**: antecedentes de Push y verificación Dev; sus bloqueos históricos quedaron superados por el cierre posterior de V2.7.
- `docs/V2_HANDOFF_CHECKPOINT.md` en `dbbd5bf`: permisos, dominios, rollouts, scheduler, cierre V2, Dashboard y ST Police.
- `CLAUDE.md` en `dbbd5bf`: reglas permanentes y sucesivas decisiones de producto.
- `docs/DEPLOYMENT_V1.md` en `dbbd5bf`: operación del despliegue.
- Inventario Git de migraciones y reversos en `dbbd5bf`.

Referencias navegables al baseline en el repositorio privado:

- [Checkpoint V2, secciones S/T/U y antecedentes](https://github.com/rodrigolenero-comunicacion/communication-hub/blob/dbbd5bf/docs/V2_HANDOFF_CHECKPOINT.md)
- [Reglas permanentes](https://github.com/rodrigolenero-comunicacion/communication-hub/blob/dbbd5bf/CLAUDE.md)
- [Checkpoint del proyecto](https://github.com/rodrigolenero-comunicacion/communication-hub/blob/dbbd5bf/docs/PROJECT_CHECKPOINT.md)
- [Despliegue](https://github.com/rodrigolenero-comunicacion/communication-hub/blob/dbbd5bf/docs/DEPLOYMENT_V1.md)
- [Migraciones](https://github.com/rodrigolenero-comunicacion/communication-hub/tree/dbbd5bf/supabase/migrations)
- [Reversos](https://github.com/rodrigolenero-comunicacion/communication-hub/tree/dbbd5bf/supabase/rollbacks)

Los archivos DOCX se identificaron como fuentes normativas del repositorio, pero no se releyeron para esta síntesis. No se inspeccionaron secretos ni se consultaron bases, estado de Netlify o servicios externos en vivo. Las cifras de usuarios, notificaciones y suscripciones de reportes anteriores no se presentan como inventario actual.

Este manual conserva el baseline pedido y hace explícitas sus limitaciones. La próxima intervención debe actualizar el checkpoint con evidencia nueva, sin borrar las decisiones ni confundir historia, propuesta y estado desplegado.