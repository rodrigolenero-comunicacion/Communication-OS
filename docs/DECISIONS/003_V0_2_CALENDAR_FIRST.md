# ADR-003 — V0.2 Calendar-First Editorial Studio

Fecha: 2026-10-31. Estado: aprobada por el propietario (decisiones D1–D4) e implementada en código; migración 0008 **aplicada** en producción por el propietario (confirmado el 2026-10-31, tras ejecutar el reset operativo). V0.2 activa.

## Decisiones del propietario

| # | Decisión |
|---|---|
| D1 | `flexible` se mueve libremente. `fixed`/`window` fuera de su restricción: advertencia y acción explícita «Mover y convertir en flexible». Con publicación `scheduled`: mover bloqueado (desprogramar o reprogramar primero; sin flujo automático de rescheduling en V0.2). Con publicación `published`: fecha histórica, cambio ordinario bloqueado. Pieza y Publication siguen separadas |
| D2 | IJLV Sistema Editorial **v1.4** es la fuente vigente; la v1.2 del repo queda obsoleta como referencia activa. No se cargan reglas ni ejes IJLV hasta incorporar la v1.4 |
| D3 | Ejes Tec (Vivencia Tec, Cultura Tec, Nuestra Huella, Modelo Tec) cargados como **datos provisionales** (`brand_axes.provisional = true` + nota de fuente), no en lógica de dominio |
| D4 | Reset de demostración aprobado con gate. El gate encontró que el script borraba historial de configuración, fuentes de contexto y objetivos; se corrigió para borrar solo lo ligado a piezas y se añadió una vista previa de solo lectura |

## Decisiones de diseño (construcción)

| Tema | Decisión | Motivo |
|---|---|---|
| Día en calendario | `planning_assignments.planned_date`, con CHECK dentro de `week_start` | Reutiliza la asignación semanal (cobertura y runway intactos) sin tabla nueva |
| Fecha visible de una pieza | Día planeado; si falta, primera publicación confirmada; si falta, programada | Una pieza publicada no desaparece del calendario |
| Cambio de semana por flujos anteriores | Trigger limpia `planned_date` si queda fuera | La semana manda; integridad garantizada en base |
| Mover | Comando `move_piece_day` (CO412 = requiere confirmar flexible) | Una sola vía de escritura para arrastre, Day Studio, Banco y ficha |
| Convertir en flexible al mover | No invalida la aprobación; queda evento `timing_relaxed` con el timing previo | Decisión explícita del propietario en D1; la restricción es de planeación, no de contenido. Excepción documentada a ADR-002 («timing es material») |
| Formato y modo | Catálogos `content_formats` / `production_modes` en base | Evolucionan sin tocar componentes |
| Pilar / territorio | `brand_axes` por cliente; trigger impide usar ejes de otro cliente o del tipo equivocado | Aislamiento entre clientes en la base, no en la UI |
| Estado en tarjetas | Derivado de la máquina existente (publicada > programada > hold > producción) con símbolo textual | Sin máquina paralela; no depende del color |
| Colores de cliente | `brands.color` de una paleta acotada + `short_label`; tokens claro/oscuro | Configurable; color siempre con etiqueta |
| Arrastre | HTML5 nativo, sin librería; alternativa «Mover a / Agendar» en día, Banco y ficha | Stack cerrado y accesibilidad por teclado |
| Inicio de creación | Solo «Ya tengo una idea» funcional; las otras 4 opciones visibles y deshabilitadas («Próximamente») | §56: sin IA ni research simulados |
| Control Tower | Movido a `/operacion`; en el calendario solo una línea de gaps de la próxima semana | Inteligencia secundaria |
| Inventario | Sigue en `/inventario` («Inventario completo»); `/banco` es la experiencia principal | Sin perder datos ni funciones |
| Tolerancia de despliegue | Si 0008 no está aplicada, la app carga sin catálogos/ejes y muestra el aviso | El código puede desplegarse antes que la migración sin romper producción |
