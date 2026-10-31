# Content OS — V0.1 Manual Control Tower

Versión documental 0.1 · 27 de octubre de 2026 · Idioma de producto: español.

Content OS es el cockpit editorial personal que coordina cinco cuentas, muestra cobertura y permite decidir qué producir, revisar y programar. No reemplaza ST Hub, Sistema Editorial IJLV ni Solotu_Cerebro.

**Estado (2026-10-27):** aplicación implementada y probada en dominio y en PostgreSQL local; **pendiente de conectar a un proyecto Supabase real**, de recorrido de interfaz con sesión real y de piloto. Detalle en [HANDOFF](docs/HANDOFF.md).

## Stack

Next.js 16.4.3 (App Router, `proxy.ts`) · React 19.3.1 · TypeScript 5.9.3 · Tailwind CSS 4.3.3 · `@supabase/supabase-js` 2.118.0 + `@supabase/ssr` 0.12.7 · PostgreSQL con migraciones SQL versionadas (sin ORM) · Netlify como destino. Node ≥ 22.18 (ejecuta las pruebas TypeScript con type stripping nativo).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm install` | Instala dependencias fijadas en `package-lock.json` |
| `npm run dev` | Servidor de desarrollo (requiere `.env.local`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Pruebas de dominio (`node:test`): cobertura, runway, reserva, semanas |
| `npm run test:db` | Pruebas de integración contra un PostgreSQL local: crea una base limpia por archivo, aplica un shim mínimo de `auth` (solo pruebas), todas las migraciones y los casos de `tests/db/`. Necesita `psql` y `PGHOST`/`PGPORT`/`PGUSER` |
| `npm run build` | Build de producción |
| `npm run verify:supabase` | Verificación de RLS/allowlist contra **tu** proyecto Supabase (ver abajo) |

Ejemplo de `test:db` con un servidor local: `PGHOST=/ruta/socket PGPORT=54329 PGUSER=postgres npm run test:db`. Filtrar un archivo: `npm run test:db -- 02`.

## Configuración de Supabase (pasos concretos)

Usa un proyecto **nuevo y exclusivo** de Content OS; no reutilices el de ST Hub.

1. **Crear proyecto** en supabase.com (región cercana, p. ej. us-east). Guarda la contraseña de la base en tu gestor, no en el repo.
2. **Auth → Sign In / Providers**: deja habilitado *Email*; desactiva **Allow new users to sign up**.
3. **Auth → Users → Add user → Create new user**: tu correo y una contraseña fuerte, marcando *Auto Confirm User*.
4. **SQL Editor**: ejecuta, en orden, el contenido de cada archivo de `supabase/migrations/` (`…0001_schema.sql` → `20261031000009_content_origins.sql`). Alternativa: Supabase CLI con `supabase link` y `supabase db push`.
5. **SQL Editor**: autoriza tu usuario (única fila activa permitida):
   ```sql
   insert into public.authorized_users (user_id)
   select id from auth.users where email = 'TU_CORREO';
   ```
6. **Project Settings → API**: copia *Project URL* y la *publishable key* (o la *anon key* legacy) a `.env.local` siguiendo `.env.example`. **No** uses la service_role/secret key.
7. Verifica contra el proyecto real:
   ```bash
   VERIFY_EMAIL='tu-correo' VERIFY_PASSWORD='tu-contraseña' npm run verify:supabase
   ```
8. `npm run dev`, entra en `http://localhost:3000` y recorre el flujo de [UX_FLOWS §6](docs/UX_FLOWS.md).
9. Solo en un proyecto de **desarrollo**: `supabase/seed.sql` carga fixtures ficticios rotulados `[DEMO]`. Nunca en producción.

Netlify (cuando lo autorices): conecta el repositorio, define las dos variables `NEXT_PUBLIC_…` en *Site configuration → Environment variables* y despliega; `netlify.toml` ya fija build y Node 22. No se ha desplegado nada.

## Estructura

```text
src/domain/          funciones puras: tiempo editorial, cobertura, runway, reserva, impacto
src/application/     sesión/allowlist, registro de comandos, carga de contexto
src/infrastructure/  clientes Supabase y mapeo de filas a hechos de dominio
src/app/             rutas (Control Tower, Portfolio, Inventario, Review Desk, Publication Queue) y server actions
supabase/migrations/ esquema, seguridad/RLS y comandos transaccionales
supabase/seed.sql    datos ficticios de desarrollo
tests/domain/        pruebas de dominio · tests/db/ pruebas PostgreSQL
```

## Mapa de documentación

| Archivo | Función |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas operativas y autonomía del ejecutor |
| [SYSTEM_CANON.md](docs/SYSTEM_CANON.md) | Propósito, fronteras, invariantes y alcance |
| [PRODUCT_MODEL.md](docs/PRODUCT_MODEL.md) | Entidades, estados y reglas de cobertura |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Estructura y seguridad del sistema |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Contrato relacional y de integridad |
| [UX_FLOWS.md](docs/UX_FLOWS.md) | Pantallas y flujo vertical |
| [INTEGRATIONS.md](docs/INTEGRATIONS.md) | Ownership y referencias manuales |
| [Brief V0.1](docs/briefs/V0_1_MANUAL_CONTROL_TOWER.md) | Pasos, entregables y aceptación |
| [ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) | Casos con resultados esperados |
| [ADR-001](docs/DECISIONS/001_V0_1_IMPLEMENTATION_RULES.md) · [ADR-002](docs/DECISIONS/002_V0_1_BUILD_DECISIONS.md) | Precisiones de modelo y decisiones de construcción |
| [PILOT.md](docs/PILOT.md) | Guion de una semana de uso real |
| [ROADMAP.md](docs/ROADMAP.md) | Release vigente y posibles pasos posteriores |
| [HANDOFF.md](docs/HANDOFF.md) | Estado real y continuidad |
| [Fuentes](docs/reference/SOURCES.md) | Procedencia, límites y referencias pendientes |

## Restricciones vigentes

Único stack autorizado: Next.js/TypeScript + Supabase/PostgreSQL + Tailwind + Netlify. Single-user con autenticación real, operaciones manuales y cálculos al consultar o modificar. Sin agentes, cron, Meta API, Metricool, OneDrive, n8n, automatización externa, ORM, backend separado, colas, IA, analítica ni colaboración.

## Referencias pendientes

PROJECT_INSTRUCTIONS.md, SYSTEMS_ARCHITECT.md, OPERATING_PROTOCOL.md, SYSTEM_CONTINUITY.md y Solotu_Contexto_v2.md siguen sin recibirse; no se afirma haberlos leído. Véase [Fuentes](docs/reference/SOURCES.md).
