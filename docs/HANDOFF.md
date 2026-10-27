# Handoff — Content OS

Fecha: 2026-10-27. Estado: **parcialmente implementado — listo para conectar Supabase; no listo para piloto.**

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
- Pendiente: parte autenticada de `verify:supabase` (requiere la contraseña del propietario, que no se comparte) y recorrido de interfaz con sesión real.

## Siguiente unidad

1. Rodrigo: crear el proyecto Supabase siguiendo README §«Configuración de Supabase» (pasos 1–7) y compartir solo el resultado de `npm run verify:supabase` (nunca claves).
2. Ejecutor: recorrer UX_FLOWS §6 con sesión real (crear cuenta → pieza → asignar → producir → packet → aprobar → IG → programar → publicar → FB), revisar teclado/móvil/errores y registrar PASS/FAIL aquí.
3. Configurar objetivos reales con confirmación del propietario y arrancar `docs/PILOT.md`.
4. Al recibir los documentos Systems Architect / Solotu_Contexto_v2, cotejar según `reference/SOURCES.md`.
