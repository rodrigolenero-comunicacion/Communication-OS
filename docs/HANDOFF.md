# Handoff — Content OS

Fecha: 2026-10-27. Estado: **parcialmente implementado — listo para conectar Supabase; no listo para piloto.**

## Estado vigente (actualizado 2026-10-31, confirmado por el propietario)

| Elemento | Estado |
|---|---|
| Reset operativo (`scripts/reset-operational-data.sql`) | **Ejecutado** en el Supabase de Content OS |
| Migración `20261031000008_calendar_first.sql` | **Aplicada** |
| V0.2 Calendar-First | **Activa** y en uso |
| Migración `20261031000009_content_origins.sql` | **Aplicada** por el propietario |
| V0.2.1 Orígenes de contenido | **Activa**; alta de Cobertura/evento verificada por el propietario tras la corrección `6d406d4`. Resto del recorrido de aceptación pendiente de confirmar |

**Corrección V0.2.1 (smoke real, 2026-10-31):** «Elige una opción: production_mode_key» al guardar Cobertura/evento. Causa raíz: el registro de comandos de la app (`src/application/commands.ts`) exigía el modo para todos los orígenes; la función SQL de la 0009 ya lo condicionaba al origen. Corregido solo en la app; **sin migración nueva** (0009 sin cambios). Pruebas: `tests/domain/commands.test.ts` (reproduce el fallo) y `tests/db/12_command_roundtrip.mjs` (formulario → SQL real).

Las secciones siguientes son el registro histórico de cada sesión; donde digan «0008 no aplicada» o «reset pendiente», prevalece esta tabla.

## Sesión 1 · 2026-10-27

- **Objetivo autorizado:** implementar V0.1 Manual Control Tower según START_HERE y el brief.
- **Repositorio / rama:** `rodrigolenero-comunicacion/Communication-OS`, rama `claude/new-session-ejt98m`. Sin PR.
- **Despliegue / piloto:** no realizados. No se creó infraestructura remota.

### Implementado

| Incremento | Contenido |
|---|---|
| A · Base y dominio | Proyecto Next.js en la raíz conservando todos los documentos. `src/domain`: semanas lunes–domingo en America/Mexico_City, contrato único de cobertura (fulfilled / safe_pending / projected, exclusiones explicadas), runway SAFE/PROJECTED con `gap` / `at_least` / `unknown_after`, buffer (CRITICAL/LOW/INDETERMINADO/HEALTHY/SIN_CONFIGURAR/SIN_CUOTA), reserva, `achievable`, necesidades calculadas e impacto de aprobación simulado. Reloj inyectado |
| B · Persistencia y acceso | 5 migraciones: esquema de DATA_MODEL, allowlist single-user, RLS de solo lectura, historial append-only, 37 comandos transaccionales con versión e idempotencia. `.env.example`, seed demo separado, login/logout, denegación sin datos, `proxy.ts` de sesión |
| C · Portfolio e inventario | Marcas, cuentas, canales, objetivos (vigencia por lunes, sin solapes), modo sin cuota, piezas, timing, asignación/reasignación, reserva, espejos y referencias contextuales con ámbito |
| D · Revisión → publicación | Review Packet, claims con verificación humana, dependencias, bloqueos, aprobar/pedir cambios/hold/liberar/reabrir con snapshot, impacto; registros de publicación manual: crear, programar, publicar, cancelar, reabrir, corregir, corrección de semana |
| E · Control Tower | Atención (revisiones, programaciones vencidas, cuentas bajo buffer, gaps), tabla por cuenta y bucket, detalle de 12 semanas con la procedencia de cada número, Review Desk priorizado, Publication Queue en dos grupos. Avisos de unidad semanal y Stories diaria no evaluada. Recalcula al volver a la pestaña |
| F · Entrega | `netlify.toml` (sin desplegar), README con comandos y pasos de Supabase, `scripts/verify-supabase.mjs`, guion de piloto (`docs/PILOT.md`), ADR-002 |

Archivos clave: `src/domain/{time,pieces,coverage,planning}.ts`, `supabase/migrations/*.sql`, `src/application/commands.ts`, `src/app/actions.ts`, `src/app/(app)/**`, `tests/**`.

### Verificaciones ejecutadas (resultados reales)

| Comando | Resultado |
|---|---|
| `npm test` (también con `TZ=Asia/Tokyo`) | 34/34 PASS |
| `npm run test:db` sobre PostgreSQL 16.15 local | 7 archivos, 193 aserciones PASS |
| `npm run typecheck` | OK |
| `npm run build` | OK, 10 rutas |
| Humo con Chromium (`next start`, sin Supabase alcanzable) | Ruta protegida redirige a `/login`; login renderiza a 390 px y 1280 px sin scroll horizontal |
| Búsqueda de secretos en repo y bundle | Ninguno |

**Límite importante:** las pruebas de base de datos usan PostgreSQL local con un *shim* mínimo del esquema `auth` (`tests/db/_auth_shim.sql`: roles anon/authenticated y `auth.uid()` leyendo `request.jwt.claims` como Supabase). Validan migraciones, constraints, transacciones, RLS y concurrencia de verdad, pero **no** son Supabase Auth/PostgREST reales. Intenté levantar PostgREST/Auth locales y la descarga de binarios externos fue denegada por la política del entorno; no lo rodeé.

### Casos de ACCEPTANCE_TESTS

| Casos | Estado | Evidencia |
|---|---|---|
| C01–C05, C07–C19, C21 | PASS | `tests/domain/coverage.test.ts` |
| C06, C20 | PASS | dominio + `tests/db/02_flow.sql` |
| C22 | PASS dominio; aviso en UI implementado, no recorrido con sesión real | — |
| R01, R20 | PASS | dominio |
| R02, R03, R04, R08, R17 | PASS | dominio + PostgreSQL (estados y reglas) |
| R05–R07, R09–R16, R18, R19 | PASS | `tests/db/02_flow.sql` |
| R21, R22 | PASS | `02_flow.sql` + `04_concurrency.mjs` (sesiones concurrentes reales) |
| S01–S08, S10, S11 | PASS en PostgreSQL local con shim | `01_access.sql`, `03_constraints.sql`, `04_concurrency.mjs` |
| S09 | PASS parcial | sin secretos; aislamiento de ST Hub depende de crear un proyecto propio |
| S01–S05 contra Supabase real | **BLOCKED** | falta proyecto; ejecutar `npm run verify:supabase` |
| Recorrido humano (UX_FLOWS §6), teclado, móvil en pantallas con datos, errores de red/sesión | **BLOCKED** | requiere Supabase configurado |
| Piloto de una semana | **PENDIENTE** | `docs/PILOT.md` |

### Decisiones

Ver [ADR-002](DECISIONS/002_V0_1_BUILD_DECISIONS.md). Las de mayor impacto para revisar: timing como cambio material (S11), aprobación exige todos los claims soportados, programar exige fecha futura, publicar exige semana asignada, TS 5.9 en vez de 7.

### Migraciones

`20261027000001_schema` · `…0002_security` · `…0003_commands_portfolio` · `…0004_commands_pieces` · `…0005_commands_publications_sources`. Aplicadas y probadas solo en bases locales efímeras. **No aplicadas en ningún Supabase.**

### Bugs encontrados por las pruebas y corregidos

- `text[] || 'literal'` interpretado como arreglo en la validación del packet.
- Función `stable` con `SELECT … FOR UPDATE`.
- `CHECK` con `length(btrim(NULL)) > 0` aceptaba evidencias vacías (published sin URL/nota, claims sin fuente, observaciones aprobadas sin evidencia).

### Riesgos

- Integración Supabase (cookies `@supabase/ssr`, PostgREST, nombres de RPC) no ejecutada contra servicio real; la prueba de contrato `05_rpc_contract.mjs` cubre nombres de parámetros.
- Supabase concede privilegios por defecto en `public`; las migraciones los revocan, pero futuras migraciones deben repetir `revoke`/`grant` explícitos.
- Frames del packet sin UI (solo base de datos).
- Lectura de hasta 5 000 piezas por vista.

## Avance de configuración · 2026-10-27 (ejecutado por el propietario)

- Proyecto Supabase exclusivo `content-os` creado en organización propia (no la del Communication Hub). Data API activa, exposición automática de tablas desactivada, RLS automática activada, sin integración GitHub.
- Registro público desactivado y usuario propietario creado (indicación dada; no verificada desde aquí).
- Migraciones 0001–0005 aplicadas por SQL Editor. Usuario insertado en `authorized_users`.
- Comprobación SQL reportada por el propietario: canales = 2, autorizados = 1, tablas sin RLS = 0. PASS.
- `npm run verify:supabase` (parte anónima) ejecutado desde el entorno de Claude contra la API real: S01 PASS. Tablas operativas, catálogo y allowlist responden `42501 permission denied` al rol anónimo; `create_brand` y `whoami` también.
- App (`next build` + `next start`) contra el proyecto real: arranca y conecta; `/`, `/portfolio` y `/piezas/…` sin sesión redirigen a `/login` sin mostrar datos.
- Netlify: proyecto privado `communication-os` desplegado por el propietario desde la rama `claude/new-session-ejt98m` con las dos variables `NEXT_PUBLIC_…`. El primer deploy dio error 500 en vistas protegidas (probable compilación sin variables); corregido en `68d8bf1` (sin configuración ⇒ redirige a `/login`) y redeploy correcto.
- Login real con el usuario propietario: PASS (captura del propietario: Control Tower en «Primer uso»). Confirma sesión + allowlist + lectura bajo RLS en producción.
- Recorrido humano en producción (propietario, 2026-10-27, cuenta Solotu.IA, objetivo feed 5/semana): portfolio sugerido → canales IG/FB → objetivo → pieza local → planificar → asignar semana 26 oct → producción → datos + Review Packet → enviar a revisión → aprobar (impacto mostrado) → registros IG y FB carrusel → ambos publicados → Control Tower: «cumplido 1 · faltan 4», Gap, Crítico; otras cuentas «Sin objetivo configurado». **PASS** del flujo vertical y de R03 (dos destinos = una unidad) con datos reales.
- Hallazgos de interfaz del recorrido, corregidos en local: texto de runway con gap en la semana actual («cubierto hasta» una fecha pasada); selector de reasignación con semana preseleccionada; canal por defecto Facebook; formato por defecto «Post» aunque la pieza sea carrusel. Fallo de «Crear pieza» explicado por un despliegue a mitad de sesión (acción de servidor de la versión anterior), no reproducible tras recargar.
- Pieza real: «5 Tips para crear tus instrucciones perfectas para tu proyecto» (Solotu.IA). Confirmar con el propietario si sus registros de publicación corresponden a publicaciones reales.
- Pendiente: parte autenticada de `verify:supabase` (requiere la contraseña del propietario, que no se comparte) y recorrido de interfaz con sesión real.

## Sesión 1 (cont.) · plantillas y reset

- **Implementado:** plantillas en cascada (categoría → tipo), página Plantillas, creación rápida con semana y etapa inicial, guías de Words como ayuda en el packet, script de reset operativo. Migraciones nuevas `…0006_piece_templates` y `…0007_starter_templates`.
- **Probado (PostgreSQL local):** `08_templates.sql` (14 aserciones), `07_reset.sql` (6), contrato UI↔SQL ampliado (40). Suite total 216 PASS; dominio 34 PASS; tipos y build OK.
- Migraciones 0006 y 0007 aplicadas por el propietario en Supabase; comprobación: 22 plantillas. PASS.
- **Pendiente del propietario:** recorrer creación con plantilla; ejecutar el reset cuando el sistema esté listo.
- **Pendiente de diseño:** asistencia con IA (aprobada como siguiente paso; ver ADR-002).

## Sesión 2 · 2026-10-31 · auditoría V0.2

- **Encargo:** prompt maestro de evolución a Calendar-First Editorial Studio.
- **Entregado:** [AUDIT_V0_2.md](AUDIT_V0_2.md) (estado, reuse map, gaps, propuesta V0.2, recomendación: evolucionar). Roadmap y canon actualizados con estado actual vs objetivo.
- **Implementado (seguro, sin decisiones pendientes):** `src/domain/calendar.ts` (rejilla mensual lunes–domingo, navegación de meses, estado visible de tarjeta derivado de la máquina existente).
- **Verificado:** dominio 39/39 PASS (también con `TZ=Asia/Tokyo`); base 216 PASS; tipos OK. Sin cambios de esquema ni datos.
- **Bloqueado por decisión del propietario:** D1–D4 (ver auditoría). Migración 0008 y vistas no iniciadas.

## Sesión 2 (cont.) · 2026-10-31 · V0.2 Calendar-First implementada en código

**Implementado**
- Gate D4: el reset borraba historial de configuración, fuentes de contexto y objetivos → corregido para borrar solo lo ligado a piezas; nueva `scripts/reset-preview.sql` (solo lectura).
- Migración `20261031000008_calendar_first.sql` (aditiva): día planeado, catálogos de formato y modo, ejes por cliente con aislamiento, apariencia de cliente, `create_calendar_piece`, `move_piece_day` (D1), `update_piece` ampliado. Configuración provisional D3 (colores por slug, 4 ejes Tec provisionales); IJLV sin ejes (D2).
- UI: `/` calendario mensual (navegación de meses, tarjetas por cliente con color + etiqueta + formato · eje + estado con símbolo, arrastrar y soltar, vista de puntos en móvil, línea de gaps de la próxima semana); `/dia/[fecha]` Day Studio (clientes desplegables → cuentas → «+ Agregar contenido», mover por fecha); `/dia/[fecha]/nuevo` flujo de 5 pasos (solo «Ya tengo una idea» funcional); `/banco` Content Bank (Ideas, Borradores, Listas sin fecha, «Agendar»); `/operacion` (Control Tower movido); Clientes con apariencia y ejes; ficha con fecha de calendario y campos de idea/formato/modo/ejes; navegación Calendario · Banco · Operación · Más.

**Pruebas ejecutadas (PASS)**
- Dominio: 40/40 (`npm test`, también con `TZ=Asia/Tokyo`).
- PostgreSQL 16 local con shim de auth: 11 archivos, 256 aserciones (nuevos: `09_calendar.sql` 26, `10_provisional_config.mjs` 5; reset 11; contrato UI↔SQL 44).
- `npm run typecheck` OK; `npm run build` OK (rutas `/`, `/dia/[fecha]`, `/dia/[fecha]/nuevo`, `/banco`, `/operacion`).

**Migración**
- 0008 **preparada y probada localmente**, incluido su efecto sobre una base con clientes existentes como producción. **No aplicada** en Supabase.

**Verificado localmente / no verificado**
- Verificado: reglas de base (D1 completo, aislamiento de ejes, integridad día/semana), contrato de parámetros, tipos y build.
- **No verificado:** recorrido de interfaz con sesión real (calendario → día → crear → tarjeta → mover/arrastrar). Sin PostgREST/Auth locales ni credenciales del propietario. Pendiente de recorrido humano tras aplicar 0008.

**Despliegue**
- Código subido a la rama que Netlify despliega; Netlify desplegará automáticamente. Sin la 0008, la app carga y muestra el aviso «Falta aplicar la migración 0008». Estado del deploy no verificado desde aquí (red bloquea Netlify).

**Orden de aplicación para el propietario**
1. `scripts/reset-preview.sql` → confirmar que solo aparecen piezas de la demostración.
2. `scripts/reset-operational-data.sql`.
3. `supabase/migrations/20261031000008_calendar_first.sql`.
4. Recorrido V0.2 y retirar el objetivo de prueba de Solotu desde Clientes si no es real.

**Riesgos / pendientes**
- Arrastre con `window.confirm` para «convertir en flexible»: funcional y accesible, pero básico.
- IJLV v1.4 sin recibir: IJLV aún sin pilares/territorios.
- Plantillas por categoría (V0.1+) y formato × modo (V0.2) conviven; validar en uso antes de unificar.
- Tarjetas en móvil se muestran como puntos de color con acceso al día; validar en uso real.

## Sesión 2 (cont.) · 2026-10-31 · V0.2.1 Orígenes de contenido (Tec)

- **Implementado:** selector «¿Qué quieres agregar?» por configuración de cliente (Tec: orgánico, cobertura/evento, material existente); flujo orgánico de V0.2 intacto; flujos cortos de evento (evento, formato, material, fecha, título sugerido, copy, referencia opcional) y de material existente (título, formato, origen, enlace, fecha, copy); tarjetas con «Formato · Evento/Material» y señal ⚠ Material pendiente / ✓ Material disponible / ✎ Copy pendiente; Content Bank con «Esperando material», «Listas sin fecha» para evento/material disponible y filtro por origen; ficha con sección «Origen y material» editable; Clientes con «Tipos de contenido». Ver ADR-004.
- **Migración:** `20261031000009_content_origins.sql` **preparada**, pendiente de aplicación manual (0008 ya aplicada).
- **Pruebas (PASS):** dominio 41/41 (también `TZ=Asia/Tokyo`); PostgreSQL 278 aserciones en 12 archivos (nuevo `11_origins.sql` 19; contrato 46 incluida la compatibilidad de la firma V0.2; configuración provisional 6); typecheck y build OK.
- **No verificado:** recorrido de interfaz con sesión real (sin PostgREST/Auth locales ni credenciales).
- **Compatibilidad de despliegue:** sin 0009 la UI no muestra selector de origen ni la sección de material y llama `create_calendar_piece` con la firma de V0.2 (probado que sigue válida).

## Siguiente unidad (vigente)

1. Propietario: aplicar `20261031000009_content_origins.sql`.
2. Propietario: recorrido de aceptación V0.2.1 (orígenes en Tec, orgánico intacto, evento pendiente/disponible, material existente con enlace, señales en tarjetas, sección «Origen y material», edición, mover de día, Content Bank y filtros, IJLV/Solotu solo orgánico, móvil básico).
3. Ejecutor: corregir solo los hallazgos que reporte el propietario; sin implementación adicional mientras tanto.

## Siguiente unidad (histórico de sesión 1)

1. Rodrigo: crear el proyecto Supabase siguiendo README §«Configuración de Supabase» (pasos 1–7) y compartir solo el resultado de `npm run verify:supabase` (nunca claves).
2. Ejecutor: recorrer UX_FLOWS §6 con sesión real (crear cuenta → pieza → asignar → producir → packet → aprobar → IG → programar → publicar → FB), revisar teclado/móvil/errores y registrar PASS/FAIL aquí.
3. Configurar objetivos reales con confirmación del propietario y arrancar `docs/PILOT.md`.
4. Al recibir los documentos Systems Architect / Solotu_Contexto_v2, cotejar según `reference/SOURCES.md`.
