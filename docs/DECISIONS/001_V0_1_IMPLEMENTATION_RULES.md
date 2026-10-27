# ADR-001 — Precisiones para construir V0.1

Fecha: 2026-10-27. Estado: defaults explícitos de este paquete, revisables por el propietario. No son citas literales de la conversación ni de archivos Systems Architect.

La conversación cierra el producto, pero deja detalles que un ejecutor tendría que resolver. Estas decisiones los hacen verificables sin añadir tecnología ni automatización.

| Tema | Decisión para V0.1 | Motivo/consecuencia |
|---|---|---|
| Pertenencia | Una pieza pertenece a una cuenta; una cuenta a una marca | El modelo conceptual contemplaba account(s); V0.1 evita compartir piezas entre cuentas. Adaptaciones a otra cuenta son piezas distintas |
| Unidad de demanda | Una pieza editorial por cuenta y bucket (feed o stories), independiente del número de canales | Una adaptación IG+FB no duplica cobertura. No se prometen cuotas por canal |
| Asignación | Máximo una ventana activa por pieza | Evita consumir una misma pieza en semanas distintas. Republicación editorial futura requiere otra pieza |
| Plan vs programación | Asignación semanal separada de Publication | Aprobar puede cubrir una semana antes de tener fecha/hora o Publication |
| Publicado | Se conserva como demanda cumplida de su semana | Publicar no hace desaparecer cobertura ni vuelve la pieza reserva |
| Cumplimiento multicanal | La primera publicación confirmada cumple la unidad editorial | Otros destinos siguen pendientes en Publication Queue; no hay garantía de cobertura por canal |
| Política semanal | Efectividad solo en lunes; fin exclusivo en lunes; sin prorrateo | No fingir precisión diaria con una cuota semanal |
| Semana actual | Se exige cuota completa, descontando unidades ya cumplidas | No reducir automáticamente demanda por haber transcurrido días |
| Runway | Primer inicio de semana no cubierta, con semana actual incluida y mínimo cero | No utilizar ejemplos de fechas aproximadas de la conversación como algoritmo |
| Horizonte | Actual + 11 semanas; ampliable mediante lectura, sin cron | Si todas cubiertas, devolver límite inferior, nunca infinito ni un gap ficticio |
| Scheduled vencido | Sin publicación confirmada, suspende SAFE/PROJECTED hasta resolución manual | Evita asumir ejecución externa por el reloj; no cambia estado |
| Sin cuota | Diferenciar not_required de unconfigured | Rectora no aparece en rojo solo por no tener cuota; ausencia de datos tampoco se pinta verde |
| Cotejo de fuentes | Guardar estado bruto y certeza de revisión completa; advertir Stories diaria no evaluada | No forzar equivalencias entre pipelines externos y cobertura semanal |
| Hold | Campo booleano separado del production_status, decisión registrada | Hold no equivale a aprobar o rechazar; excluye inventario no cumplido hasta liberar explícitamente |
| Cambios tras aprobar | Invalidan aprobación para nuevo uso; preservan evidencia histórica | No publicar una versión diferente bajo una aprobación anterior |
| Need | Proyección calculada por ventana en V0.1 | No añadir tabla, workflow ni duplicados de necesidades persistentes |
| Referencias | Espejos manuales con estado observado y fecha; contexto separado | No presentar una captura manual como sincronización o aprobación local |
| Assets | URL y texto estructurado; enlaces seguros, sin descarga desde servidor | Permite review básico sin pipeline audiovisual |

Cambiar estas reglas requiere documentar impacto en cobertura, datos y pruebas; no añadir excepciones locales en componentes. Si el usuario necesita objetivos por canal o piezas compartidas, es una evolución de modelo explícita, no una opción escondida.
