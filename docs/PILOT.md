# Guion de piloto — una semana de uso real

Estado: **pendiente**. Requiere el proyecto Supabase configurado y uso humano; no se marca completado por compilar.

## Antes del día 1

1. Configurar Supabase según README y ejecutar `npm run verify:supabase` con tu usuario. Anotar el resultado.
2. Base de producción sin datos demo (no ejecutar `supabase/seed.sql`).
3. En Portfolio: confirmar marcas y cuentas, activar canales reales de cada cuenta y configurar objetivos **que tú decidas**. Las referencias documentales (Campus 5, PrepaTec 4, IJLV ≥3, Rectora sin cuota) solo se activan si las confirmas.
4. Cargar el inventario real vigente: piezas locales y espejos de ST Hub / IJLV con su observación fechada.

## Cada día (≈10 minutos)

Responder desde Control Tower y contrastar con las fuentes:

| Pregunta del canon | Dónde | Contraste |
|---|---|---|
| ¿Qué cuentas están en riesgo? | Atención + tabla | ¿Coincide con tu percepción y con ST Hub/IJLV? |
| ¿Qué contenido falta? | Gaps / Necesidades por cuenta | ¿Falta realmente eso? |
| ¿Qué revisar? | Review Desk | ¿Está todo lo que espera tu decisión? |
| ¿Qué ya está aprobado? | Inventario filtrado por Aprobada | ¿Coincide con lo aprobado de verdad? |
| ¿Qué programar? | Publication Queue | ¿Faltan destinos o sobran? |
| ¿Hasta cuándo hay cobertura? | Runway seguro y proyectado | ¿La fecha límite es creíble? |

Registrar cada discrepancia: fecha, cuenta, pregunta, qué mostró Content OS, qué era cierto, causa probable (dato no cargado, regla, bug).

## Al cierre de la semana

- ¿Las seis respuestas fueron fiables? ¿Cuánto tiempo de mantenimiento manual tomó?
- Discrepancias agrupadas por causa y decisiones de modelo que piden (p. ej. objetivos por canal, Stories diaria).
- Actualizar `docs/HANDOFF.md` con el resultado del piloto.
