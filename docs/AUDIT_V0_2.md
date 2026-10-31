# Auditoría para V0.2 — Calendar-First Editorial Studio

Fecha: 2026-10-31. Base auditada: rama `claude/new-session-ejt98m`, HEAD `d9bb979`, working tree limpio y sincronizado con `origin`.
Fuente del encargo: «Content OS — Prompt maestro de evolución del sistema» (instrucción del propietario, 2026-10-31).
Alcance: lectura y análisis. **Ningún cambio de código, esquema ni datos** en esta auditoría.

## A. Estado encontrado

### Repositorio y stack (verificado)

| Elemento | Estado real |
|---|---|
| Stack | Next.js 16.4.3 (App Router, `proxy.ts`), React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3, `@supabase/supabase-js` 2.118.0 + `@supabase/ssr` 0.12.7. Sin ORM, sin librerías de UI ni de fechas |
| Tamaño | ~6 100 líneas en `src/` + `supabase/` |
| Hosting | Netlify (`communication-os.netlify.app`, proyecto privado) desde esta rama. Desplegado y usado por el propietario (evidencia: capturas y recorrido del 27 oct) |
| Base | Supabase propio (`content-os`), migraciones 0001–0007 **aplicadas en producción** por el propietario (evidencia: comprobaciones SQL: canales 2, autorizados 1, tablas sin RLS 0, plantillas 22) |
| Datos en producción | Portfolio sugerido (3 marcas, 5 cuentas), canales de Solotu.IA, objetivo de prueba 5/sem, una pieza de demostración con 2 publicaciones y su historial. **Reset pendiente** (script listo y probado: `scripts/reset-operational-data.sql`) |
| Autenticación | Supabase Auth email/contraseña, registro público desactivado, allowlist single-user `authorized_users`, sesión vía `proxy.ts` |

### Arquitectura

- `src/domain/`: funciones puras (tiempo America/Mexico_City, cobertura, runway, reserva, impacto). Reloj inyectado.
- `src/application/`: sesión/allowlist, registro de comandos (form → RPC validado), carga de contexto.
- `src/infrastructure/`: clientes Supabase y mapeo filas → hechos de dominio.
- `src/app/`: rutas y server actions; un único `runCommand` con `request_id` generado al renderizar (idempotencia en doble clic).
- Base: la API solo **lee** bajo RLS; toda escritura pasa por ~40 funciones `SECURITY DEFINER` con versión optimista, idempotencia e historial append-only.

### Modelo de datos actual (tablas)

`authorized_users`, `brands`, `accounts`, `channels`, `account_channels`, `editorial_targets`, `content_pieces`, `planning_assignments` (**semana**, no día), `review_packets` (what/why/experience, `words` {hook, on_screen, final_line, caption, cta}, frames, preview), `claims`, `approval_dependencies`, `review_decisions` (append-only), `publications`, `source_references` (contexto o espejo), `source_observations` (append-only), `operation_events` (append-only), `piece_templates`.

Estados: pieza `idea → planned → in_production → in_review → changes_requested / approved` + `on_hold` como condición; publicación `unscheduled → scheduled → published / cancelled`. Separación pieza/publicación ya implementada y probada.

### UI actual

Control Tower (home), detalle de cuenta (12 semanas), Portfolio, Inventario (con creación rápida por plantilla), ficha de pieza, Review Desk, Publication Queue, Plantillas, Login. **No existe ningún componente de calendario.**

### Pruebas (ejecutadas hoy)

| Suite | Resultado |
|---|---|
| `npm test` (dominio, `node:test`) | 34/34 PASS |
| `npm run test:db` (PostgreSQL 16 local + shim de auth) | 9 archivos, 216 aserciones PASS |
| `npm run typecheck` | OK |

### Documentación

Canon, modelo, arquitectura, data model, UX, integraciones, brief V0.1, aceptación, ADR-001/002, piloto, handoff, fuentes. Todo describe V0.1 (Control Tower como home). Referencias: manual ST Hub (27 oct) e **IJLV Sistema Editorial v1.2**.

## B. Reuse Map

| Área | Estado | Acción | Razón |
|---|---|---|---|
| Stack, build, Netlify, `proxy.ts` | Funciona en producción | KEEP | Coincide con la arquitectura preferente |
| Auth single-user + allowlist + RLS | Probado y en producción | KEEP | V0.2 sigue single-user |
| Patrón de comandos SQL (versión, idempotencia, historial) | Probado | KEEP | Base segura para mover piezas de fecha y crear desde el calendario |
| `brands` → Cliente | Existe | ADAPT | Añadir color/etiqueta corta configurable; en UI se llama «Cliente». Sin renombrar la tabla |
| `accounts` | Existe | KEEP | Renombrar cuentas (p. ej. «Campus Puebla / Profesional», «IJLV Puebla») es dato, no código |
| `channels` / `account_channels` | Existe | KEEP | — |
| `content_pieces` | Existe | ADAPT | Añadir idea, origen, formato, modo de producción, pilar y territorio. Sin tabla nueva |
| `planning_assignments` (semana) | Existe | ADAPT | Añadir `planned_date` (día) coherente con `week_start`; habilita el calendario sin romper cobertura |
| Timing fixed/window/flexible | Existe, reglas duras | ADAPT | El calendario debe advertir antes de mover fuera de la ventana (ver decisión D1) |
| Máquina de estados de pieza + publicación | Correcta | KEEP | Ya cumple approved ≠ scheduled ≠ published. La tarjeta muestra un **estado derivado** (p. ej. «Publicado» si hay publicación confirmada); no se crea una máquina paralela. `measured` queda para la fase de analítica |
| `review_packets` | Existe | ADAPT | Base del Content Package: `words` ya cubre hook, texto en pantalla, cierre, caption y CTA; añadir secciones por formato (guion/VO, brief, storyboard, guía de captura, gráficos, audio, alternativa) en un `jsonb` validado |
| Claims / dependencias / decisiones | Probado | KEEP | Encajan con la revisión pedagógica IJLV (bloquear solo la pieza afectada) |
| `publications` | Probado | KEEP | — |
| `source_references` / `source_observations` | Probado | KEEP → ADAPT en fase posterior | Fuente con institución, `accessed_at`, crédito en pantalla y claim soportado: V0.3 |
| `editorial_targets` + dominio de cobertura/runway | Probado | KEEP (secundario) | Pasa de home a inteligencia contextual («próxima semana faltan 2») |
| `piece_templates` | Recién creado | ADAPT | Se reconvierte en *defaults* por formato × modo de producción (y por cliente); las categorías Conectar/Educativo… conviven como «intención» opcional hasta validar en uso |
| `src/domain/time.ts` | Probado | KEEP + ampliar | Añadir rejilla mensual lunes–domingo |
| Tokens de diseño (`globals.css`) | Existe | KEEP + ampliar | Añadir colores por cliente con modo oscuro |
| `CommandForm`, `ui.tsx`, `format.ts` | Existe | KEEP | Reutilizables en Day Studio y flujo de creación |
| Control Tower (home) | Existe | REFACTOR | Se mueve a `/operacion`; su contenido alimenta avisos contextuales del calendario |
| Inventario | Existe | ADAPT | Se convierte en Content Bank: Ideas · Borradores · Listas sin fecha |
| Review Desk, Publication Queue, ficha de pieza | Existen | KEEP | Rutas secundarias; la ficha gana «mover de fecha» |
| Portfolio | Existe | ADAPT | Pasa a «Clientes»: colores, cuentas, pilares/territorios |
| Detalle de cuenta (12 semanas) | Existe | KEEP (secundario) | Útil desde Operación |
| Seed demo, script de reset | Existen | KEEP | — |
| Docs V0.1 | Vigentes para V0.1 | ADAPT | Canon y roadmap deben distinguir estado actual y objetivo |
| Calendario, Day Studio, flujo «¿Cómo quieres empezar?» | No existen | NUEVO | Núcleo de V0.2 |
| Client Brain, Idea/Pattern/Reference Library, Research, IA | No existen | NUEVO (fases posteriores) | Fuera de V0.2 según §56 |
| Nada | — | REMOVE / REPLACE | No hay evidencia de partes que deban retirarse |

## C. Gap Analysis (actual vs Calendar-First Editorial Studio)

| Capacidad objetivo | Hoy | Gap |
|---|---|---|
| Home = calendario mensual | Home = Control Tower | Vista nueva + navegación entre meses |
| Pieza en un **día** | Pieza en una **semana** | `planned_date` + comando para mover |
| Tarjetas por cliente con color + nombre + estado | No hay tarjetas de calendario | Componente de tarjeta compacta + color configurable |
| Day Studio por cliente → cuenta → agregar | Formularios sueltos | Vista de día con clientes desplegables |
| «¿Cómo quieres empezar?» (5 opciones) | Creación directa | Paso inicial; en V0.2 solo «Ya tengo una idea» funcional, el resto como placeholder manual explícito |
| Formato y modo de producción separados | Formato libre (`content_type`) y formato de publicación | Catálogos configurables + columnas en la pieza |
| Content Package por formato | Packet único | Secciones por formato/modo, mostrando solo lo relevante |
| Drag and drop entre días | No existe | DnD nativo + alternativa por teclado («Mover a…»), validación en servidor |
| Content Bank (ideas, borradores, listas sin fecha) | Inventario con filtros | Reorganizar vistas |
| Pilar y territorio por cliente | Categorías genéricas | Configuración por cliente, opcional |
| Runway/gaps como contexto | Home | Mover a panel secundario y aviso en el mes |
| Client Brain, librerías, investigación, IA | No existen | Fases V0.3+ |
| IJLV v1.4 como fuente vigente | Repo tiene **v1.2** | Falta el documento v1.4 (no recibido) |

## D. Propuesta V0.2

### Alcance

Abrir el calendario, entrar a un día, elegir cliente y cuenta, crear una pieza con un flujo corto (inicio → idea → formato → modo → mínimos → guardar), verla en su día, abrirla, editarla y moverla de fecha sin perder datos. IA e investigación **no** entran (§56): el paso de idea es manual y las opciones 2–5 se muestran como «próximamente» o redirigen a captura manual, sin simular generación.

### Flujo

`/` (mes) → clic en día → `/dia/2026-10-31` (Day Studio: clientes desplegables con sus cuentas y piezas del día) → «+ Agregar contenido» en una cuenta → `/dia/2026-10-31/nuevo?cuenta=…` (pasos) → guardar → vuelve al día con la tarjeta visible → mes.

### Cambios de datos (migración aditiva `0008`, sin tocar migraciones aplicadas)

- `brands`: `color` (token), `short_label`.
- `planning_assignments`: `planned_date date null` + CHECK `planned_date` dentro de `[week_start, week_start+7)`. Filas existentes quedan con día nulo («semana sin día»).
- Catálogos `content_formats` y `production_modes` (key, label, orden, activo) con semillas: Reel, Carrusel, Carrusel editorial, Video gráfico / Motion, Post estático; Personas reales, Personas reales + gráficos, Totalmente gráfico / animado, Fotografías / material existente.
- `content_pieces`: `idea text`, `origin` (own_idea | develop | generate | research | library), `format_key`, `production_mode_key`, `pillar_id`, `territory_id`.
- `brand_axes` (cliente, tipo pilar | territorio, código, nombre, orden, activo) para pilares/territorios configurables por cliente.
- Comandos: `create_calendar_piece` (crea con día, cuenta, idea, formato, modo, pilar/territorio opcionales, etapa inicial) y `move_piece_day` (cambia `planned_date` y semana de forma atómica, con las mismas reglas de publicaciones que `assign_week`).
- `review_packets.package jsonb` validado por esquema para secciones por formato.

### Componentes y rutas

- `src/domain/calendar.ts`: rejilla mensual lunes–domingo, días fuera de mes, estado derivado para tarjeta. Puro y probado.
- `MonthCalendar`, `CalendarCard`, `DayStudio`, `ClientSection`, `CreateContentFlow` (pasos), `MoveDateControl`.
- Rutas: `/` calendario · `/dia/[fecha]` · `/dia/[fecha]/nuevo` · `/banco` · `/operacion` (Control Tower actual) · resto bajo «Más» (Review, Publicaciones, Clientes, Plantillas).
- Colores por cliente como tokens CSS con modo oscuro; el color siempre acompañado de etiqueta textual.

### Pruebas

- Dominio: rejilla mensual (meses de 28–31 días, inicio en lunes, cambio de año), estado derivado de tarjeta.
- PostgreSQL: crear desde calendario, mover de día (dentro/fuera de semana, con publicación programada o publicada), coherencia `planned_date`/`week_start`, catálogos, aislamiento de pilares entre clientes, RLS de tablas nuevas.
- Contrato UI↔SQL ampliado.
- Humo en Chromium: mes, día, creación, tarjeta visible a 390 px y 1280 px.

### Riesgos

- Dos nociones de fecha (semana del plan y día) → mitigado con CHECK y un solo comando para moverlas.
- Migración 0008 debe aplicarse en Supabase **antes** de usar las vistas nuevas; la app tolerará su ausencia como hoy con plantillas.
- DnD sin librería: accesibilidad por teclado vía control alternativo obligatorio.
- Plantillas y categorías recién creadas pueden solaparse con formato/modo/pilar; se validará en uso antes de retirar nada.

## E. Recomendación

**Evolucionar el sistema actual.** Evidencia: el modelo ya separa pieza y publicación, tiene clientes y cuentas, estados correctos, seguridad probada y está en producción con 250 comprobaciones en verde. El calendario requiere un campo de día y vistas nuevas, no rehacer el dominio. Ningún criterio del gate de reconstrucción (§53) se cumple.

## Decisiones pendientes del propietario

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Mover una pieza fuera de su ventana o fecha fija: hoy es regla dura | Advertir y ofrecer «mover y convertir en flexible» en un solo paso; mantener bloqueo solo con publicación confirmada |
| D2 | IJLV v1.4 | Subir el documento al repo; mientras tanto se usan los pilares y territorios que enunciaste (coinciden con v1.2) como configuración atribuida |
| D3 | Pilares Tec | Cargar Vivencia Tec, Cultura Tec, Nuestra Huella y Modelo Tec como configuración **provisional**, rotulada así |
| D4 | Reset de la demostración | Ejecutarlo antes de aplicar 0008 para empezar V0.2 limpio |
