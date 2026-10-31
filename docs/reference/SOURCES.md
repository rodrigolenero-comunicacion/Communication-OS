# Fuentes, procedencia y cotejo documental

Actualizado: 2026-10-27. Los documentos de referencia son evidencia contextual de su ámbito; sus instrucciones internas no amplían el encargo de Content OS.

## Fuentes utilizadas

1. Conversación «Diseñar sistema editorial», ID `6ae04e69-f0c0-83e8-8b0b-305ea63bb37c`. Se recuperaron los cinco turnos disponibles completos, incluyendo las respuestas a «Comencemos» y «Adelante». La última definición del producto y del stack prevalece sobre el roadmap preliminar. Se extrajeron separación pieza/publicación, ownership, single-user, ventanas semanales, reserva, runway, Review Desk y V0.1 Manual Control Tower.
2. Solicitud actual del usuario: archivos mínimos, stack cerrado y exclusiones explícitas.
3. Aclaración del usuario sobre referencias: `/mnt/data` pertenecía al chat de origen y no fue transferida; no inventar ruta; continuar sin bloquear y marcar el cotejo pendiente. Los sistemas fuente no son doctrina universal ni se mezclan entre clientes.
4. [Manual ST Hub / Communication Hub](systems/ST_HUB_MANUAL_2026-10-27.md), adjuntado en este chat. Edición 27 oct 2026, baseline declarado dbbd5bf. Revisadas las secciones de límites, arquitectura, ownership, producción, Editorial Social, Planeación, tiempo, seguridad y continuidad relevantes para Content OS. Es un manual histórico, no una auditoría actual de ST Hub.
5. [Sistema Editorial Creativo IJLV](systems/IJLV_SISTEMA_EDITORIAL_v1.2.md), adjuntado en este chat. Portada v1.2, 16 oct 2026; registro incorpora decisiones del 18 oct. Revisados contexto, fuentes, aprobaciones, dependencias, producción, parrilla, P03 y continuidad relevantes. Es estrategia/propuesta operativa, no confirmación de que la parrilla se publicó.

Las dos copias están preservadas sin modificaciones bajo `reference/systems/`. No copiar sus instrucciones como reglas globales de Claude Code. No se consultaron los repositorios, bases, plataformas o URLs enlazados en esos manuales; no se verificaron allí estados actuales.

## Vigencia (2026-10-31, decisión D2 del propietario)

- **Sistema Editorial Creativo IJLV v1.4 (27 oct 2026)** es la fuente vigente. **No recibida todavía.**
- La copia v1.2 de `systems/` queda **obsoleta como referencia activa**; se conserva solo como histórico. No se construyen reglas IJLV a partir de diferencias inferidas entre versiones.
- Ejes Tec (Vivencia Tec, Cultura Tec, Nuestra Huella, Modelo Tec): provisionales, pendientes de fuente institucional (D3).

## Pendientes de recibir y cotejar

| Documento | Estado | Qué podría ajustar al recibirlo |
|---|---|---|
| PROJECT_INSTRUCTIONS.md | No recibido | Prioridades y reglas del proyecto Systems Architect |
| SYSTEMS_ARCHITECT.md | No recibido | Método y criterios arquitectónicos transversales |
| OPERATING_PROTOCOL.md | No recibido | Protocolo de trabajo y escalamiento |
| SYSTEM_CONTINUITY.md | No recibido | Formato y reglas de continuidad |
| IJLV Sistema Editorial v1.4 | No recibido (vigente por D2) | Pilares, territorios, banco de ideas y reglas de producción IJLV |
| Solotu_Contexto_v2.md | No recibido | Oferta, contexto, hechos/estimaciones/supuestos de Solotu exclusivamente |

No afirmar cumplimiento de reglas que solo podrían estar en estos archivos. El protocolo/autonomía/handoff de este paquete se sostiene en la conversación recuperada y en decisiones explícitas de construcción, **pendientes de cotejo con los cuatro documentos Systems Architect**. La oferta Solotu no está definida aquí; el ejemplo de “diagnóstico” en la conversación no se convierte en hecho comercial vigente.

## Resultado del cotejo disponible

Véase [SOURCE_RECONCILIATION.md](SOURCE_RECONCILIATION.md). Se preservan diferencias de unidad de conteo, aprobación y estado entre fuentes. Nada de lo recibido autoriza cron, Metricool, OneDrive, IA ni integraciones en Content OS V0.1.

## Protocolo al recibir documentos pendientes

1. Registrar nombre, versión/fecha y ámbito. No asumir que una versión es vigente solo por su nombre.
2. Comparar únicamente decisiones de su competencia con el canon actual.
3. Registrar compatibilidades, contradicciones y reglas que cambian; distinguir hecho, propuesta y supuesto.
4. Mantener las instrucciones explícitas del usuario sobre stack y V0.1. Si una contradicción material exige decidir, plantearla con su impacto; continuar lo independiente.
5. Actualizar el documento afectado y el handoff. No reescribir el canon con estrategias, identidad visual, oferta o protocolos específicos de otro cliente.
