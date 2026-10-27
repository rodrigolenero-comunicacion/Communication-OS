# Content OS — Paquete inicial para Claude Code

Versión documental 0.1 · 27 de octubre de 2026 · Idioma de producto: español.

Content OS es el cockpit editorial personal que coordina cinco cuentas, muestra cobertura y permite decidir qué producir, revisar y programar. No reemplaza ST Hub, Sistema Editorial IJLV ni Solotu_Cerebro.

Este directorio es la raíz preparada para el repositorio. Contiene especificaciones y un encargo ejecutable; **la aplicación aún no está implementada**. No hay infraestructura creada, credenciales, despliegue ni pruebas de aplicación ejecutadas.

## Empezar

1. Abre esta carpeta `CONTENT-OS` en Claude Code.
2. Usa el encargo de [START_HERE.md](START_HERE.md).
3. Claude debe leer [CLAUDE.md](CLAUDE.md) y ejecutar [V0.1 — Manual Control Tower](docs/briefs/V0_1_MANUAL_CONTROL_TOWER.md) por entregas verificables.
4. Configura Supabase únicamente al llegar al paso de autenticación y persistencia; las instrucciones de configuración y variables reales deben producirse junto con la implementación. No hacen falta credenciales para construir lógica de dominio y fixtures.

## Mapa del paquete

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
| [Decisiones de construcción](docs/DECISIONS/001_V0_1_IMPLEMENTATION_RULES.md) | Resoluciones de ambigüedades, explícitas y revisables |
| [ROADMAP.md](docs/ROADMAP.md) | Release vigente y posibles pasos posteriores |
| [HANDOFF.md](docs/HANDOFF.md) | Estado real y continuidad |
| [Fuentes](docs/reference/SOURCES.md) | Procedencia, límites y referencias pendientes |

## Restricciones vigentes

Único stack autorizado: Next.js/TypeScript + Supabase/PostgreSQL + Tailwind + Netlify. V0.1 es single-user con autenticación real, operaciones manuales y cálculos al consultar o modificar. Sin agentes, cron, Meta API, Metricool, OneDrive, n8n ni automatización externa. Tampoco añadir ORM, backend separado, servicios de colas, IA generativa, analítica real o colaboración.

## Referencias pendientes

Se recuperaron íntegramente las respuestas de diseño de la conversación «Diseñar sistema editorial», incluida la definición final de V0.1. El usuario confirmó que `/mnt/data` no fue transferido y autorizó continuar. Los cuatro documentos de Systems Architect y Solotu_Contexto_v2.md siguen pendientes de cotejo; no se afirma haberlos leído. Sí se recibieron y cotejaron el manual ST Hub y Sistema Editorial Creativo IJLV, preservados como fuentes de sus respectivos ámbitos. Se puede iniciar construcción; registrar discrepancias al recibir los demás archivos. Véase [Fuentes](docs/reference/SOURCES.md).
