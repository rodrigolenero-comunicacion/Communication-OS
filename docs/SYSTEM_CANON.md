# System Canon

Estado: contrato de V0.1 (2026-10-27), con cambio de dirección a Calendar-First el 2026-10-31.

## Estado actual vs objetivo (2026-10-31)

| | Contenido |
|---|---|
| Versión activa | **V0.2 Calendar-First Editorial Studio**: activa en producción y en uso por el propietario (reset operativo ejecutado y 0008 aplicada, confirmados por el propietario el 2026-10-31) |
| Siguiente | **V0.2.1 Orígenes de contenido (Tec)**: implementada en código; migración 0009 preparada, pendiente de aplicación manual; **no verificada aún con sesión real** |
| Decisión | Evolucionar el sistema actual, sin reconstrucción ([AUDIT_V0_2.md](AUDIT_V0_2.md), ADR-003, ADR-004) |
| Pendiente | Aplicar 0009 y recorrido de aceptación V0.2.1; documento IJLV v1.4 (vigente, no recibido); validar ejes Tec provisionales contra fuente institucional |
| Hipótesis | Las plantillas por categoría convivirán con formato × modo de producción hasta validar en uso |

Los invariantes de abajo siguen vigentes. Las exclusiones de V0.1 (IA, investigación, integraciones) se mantienen en V0.2; la IA está aprobada como fase posterior con regla «IA ≠ aprobación».

## Propósito

Responder desde un solo lugar: qué cuentas están en riesgo, qué contenido falta, qué revisar, qué ya está aprobado, qué programar y hasta cuándo existe cobertura. Priorizar excepciones y decisiones; minimizar mantenimiento manual.

Un usuario autorizado, Rodrigo. Portfolio inicial: Tec de Monterrey (Campus Puebla, PrepaTec Puebla, Directora / Rectora, nombre editable); Instituto Juan Luis Vives (IJLV); Solotu.IA (Solotu.IA). Los objetivos deben configurarse con confirmación humana. Las fuentes recibidas documentan Campus feed 5/semana, PrepaTec feed 4/semana, Rectora sin cuota e IJLV mínimo 3/semana; son referencias atribuidas, no una carga operativa ya confirmada. Solotu no tiene frecuencia verificada. Stories Tec tiene una cadencia diaria que V0.1 no evalúa como tal.

## Fuentes de verdad

| Dominio | Autoridad |
|---|---|
| Storytellers, coberturas y producción operativa Tec | ST Hub |
| Estrategia y sistema editorial IJLV | Sistema Editorial IJLV |
| Contexto empresarial y oferta vigente Solotu | Solotu_Cerebro |
| Portfolio personal, planeación transversal, cálculo de gaps/runway y colas personales | Content OS |
| Producción/revisión de piezas creadas y gestionadas localmente | Content OS |
| Estado de objetos externos | Sistema propietario; Content OS conserva observaciones atribuidas |
| Publicación real | Plataforma externa; V0.1 registra confirmación humana |

Una referencia contextual de IJLV o Solotu no convierte por sí sola una pieza local en objeto externo. Ownership se declara por objeto; no se infiere solo de la marca. Cada fuente aplica únicamente a su sistema/cliente. Los manuales no son doctrina global; el protocolo transversal de Systems Architect queda pendiente de cotejo con los archivos aún no recibidos.

## Invariantes

- INV-01: una pieza editorial no es una publicación.
- INV-02: una pieza admite cero o múltiples publicaciones.
- INV-03: approved no significa scheduled.
- INV-04: scheduled no significa published.
- INV-05: el paso del tiempo nunca confirma publicación.
- INV-06: los sistemas externos conservan ownership de sus dominios.
- INV-07: una referencia externa inaccesible no destruye inventario local.
- INV-08: SAFE exige confirmación editorial; PROJECTED no es certeza.
- INV-09: ambas capas se distinguen visual y semánticamente.
- INV-10: una propuesta no crea silenciosamente contenido aprobado.
- INV-11: no existe publicación automática ni aprobación implícita.
- INV-12: la UI prioriza excepciones y decisiones.
- INV-13: un excedente semanal no compensa otra semana.
- INV-14: idea y planned no cuentan en PROJECTED.
- INV-15: una reserva no es una asignación ni una programación.
- INV-16: Need, Idea y ContentPiece son conceptos distintos.
- INV-17: ninguna propuesta de IA genera piezas automáticamente; IA no está en V0.1.
- INV-18: Review Packet y Production Spec son representaciones distintas del mismo trabajo.
- INV-19: aprobar requiere una decisión explícita y registrada.
- INV-20: no modificar estado autoritativo externo sin confirmación del origen; V0.1 no tiene write-back.
- INV-21: no mostrar runway proyectado como si fuera seguro.

## Release autorizado

V0.1 Manual Control Tower incluye login, portfolio, objetivos semanales, ventanas, piezas, planeación, producción, Review Packet básico, decisiones, publicaciones manuales, reserva explícita, cobertura, runway y colas. Los gaps se muestran como necesidades calculadas; no requieren un workflow persistente de demandas en esta versión.

Stack cerrado: Next.js/TypeScript + Supabase/PostgreSQL + Tailwind + Netlify. Sin tecnologías adicionales. Sin agentes, cron, Meta API, Metricool, OneDrive, n8n ni automatización externa. Sin integraciones ST Hub/IJLV/Solotu, IA, métricas reales, notificaciones o multiusuario.

## Criterio de éxito

El flujo manual completo funciona con datos persistidos y acceso privado. Tras una semana de uso real, el usuario puede responder de forma fiable las seis preguntas del propósito. La entrega técnica prepara ese piloto; no puede afirmar anticipadamente que el piloto ya ocurrió.

Las precisiones necesarias para construir —unidad de conteo, ventanas, publicados, hold y ownership manual— están identificadas como decisiones de implementación en `DECISIONS/001_V0_1_IMPLEMENTATION_RULES.md`, no atribuidas a documentos no leídos.
