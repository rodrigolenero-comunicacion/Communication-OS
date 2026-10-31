# ADR-005 — V0.3 Client Brain + Sources

Fecha: 2026-10-31. Estado: implementada en código; migraciones `20261031000010_client_brain.sql` (esquema y comandos) y `20261031000011_client_brain_seed.sql` (carga inicial) **preparadas, no aplicadas**. Se aplican en ese orden en el SQL Editor de Supabase.

## Contexto

Content OS necesita conocer a cada cliente (identidad, audiencias, estrategia, pilares, territorios, voz, reglas, restricciones, claims, aprendizajes) con trazabilidad a la fuente de cada dato y sin mezclar clientes. Sin generación, IA, investigación web, integraciones (ST Hub, Solotu_Cerebro), base vectorial, agentes ni jobs. Publication no cambia.

## Reutilización (auditoría previa)

| Necesidad | Decisión | Motivo |
|---|---|---|
| Source | Se **amplía** `source_references` (`relation_kind = 'context_reference'`): institución, tipo, documento, versión, fecha de consulta y de publicación, estado (active/superseded/provisional/archived), notas, versión del registro | Ya existían las referencias de contexto con ámbito (cuenta/marca/pública) y los claims de pieza las usan. Una tabla nueva duplicaría el concepto |
| Pilares y territorios | Siguen en `brand_axes` (0008); se añade `source_reference_id` | Ya usados por el flujo de creación; no se duplican como entradas del Brain (la categoría `pillar` no existe en `brain_entries`) |
| Claims de pieza | `claims` (+ `on_screen_credit`, crédito en pantalla) | El claim de pieza sigue siendo de la pieza; `brain_entries` con categoría `claim` registra claims de cliente reutilizables |
| Historial | `operation_events` vía `app.log_event` | Mismo mecanismo de todos los comandos |
| Conocimiento estructurado | **Nuevo**: `brain_entries` (categoría, clave, título, contenido, estado, provisional, estado de claim, fuente + localizador, vigencia, cuenta opcional) | No había estructura equivalente; `accounts.context_notes` es texto libre por cuenta |

## Decisiones

| Tema | Decisión |
|---|---|
| Aislamiento | En la base: trigger `brain_entries_scope_check` (cuenta y fuente deben ser del mismo cliente; CO403), `app.source_in_brand` también para `brand_axes`. Una fuente o entrada no se traslada entre clientes. En la UI todo se filtra por cliente (`brainView`, `sourcesByStatus`) |
| Escritura | Solo por comandos `upsert_brand_source` y `upsert_brain_entry` (SECURITY DEFINER, sesión autorizada, idempotencia, versión, historial). RLS de solo lectura para `authenticated`; anónimo sin acceso |
| Provisional | Bandera explícita por entrada y eje; fuente con estado `provisional`. En claims, `provisional` se deriva de `claim_status = 'provisional'` (constraint) |
| Superseded | Estado de entrada o fuente; se conserva como historial y no se muestra en la vista vigente |
| Segmentos IJLV | Maternal/Preescolar/Primaria/Todas son entradas `segment`, **no cuentas** |
| Ubicación en UI | Clientes → (cliente) → Brain / Fuentes (`/portfolio/[slug]/brain`, `/portfolio/[slug]/fuentes`). Reglas plegadas por tipo; filtros «Vigente», «Solo provisionales», «Todo» |
| Tolerancia | Si 0010 no está aplicada, la app sigue funcionando y las vistas lo indican |

## Carga inicial (0011) y procedencia

Solo se cargan clientes existentes por `slug` (`ijlv`, `tec`, `solotu`). No se crean piezas ni objetivos. **El objetivo de Solotu (5/semana) no se toca.**

| Cliente | Fuentes | Entradas | Procedencia real |
|---|---|---|---|
| IJLV | «Sistema Editorial Creativo IJLV v1.4» (activa, 27-10-2026); v1.2 (superseded, en el repo) | Identidad, estrategia, audiencias, 4 segmentos, reglas editoriales/evidencia/revisión/producción; pilares P1–P4 y territorios Humanidad/Pensamiento/Proceso/Mundo | **Texto de la instrucción V0.3 del propietario**. El documento v1.4 no está en el repositorio: la nota de la fuente lo declara y queda pendiente de cotejo |
| Tec | Communication Hub (sistema interno, activa); Decisiones editoriales del propietario (activa); Ejes Tec indicados por el propietario — D3 (**provisional**) | Frontera con Communication Hub; 5 rasgos de voz; 8 reglas editoriales; ejes existentes enlazados a la fuente D3 y siguen provisionales | Instrucción V0.3 y D3 (ADR-003) |
| Solotu.IA | Solotu_Cerebro (sistema interno, activa) | Posicionamiento, producto ancla, flujo de servicio, audiencia, restricción de fuente única, regla de evidencia | Instrucción V0.3. `Solotu_Contexto_v2.md` no recibido: declarado en la nota |

**Cambio respecto a ADR-003 D2:** D2 decía no cargar reglas ni ejes IJLV hasta incorporar la v1.4. La instrucción V0.3 del propietario entrega explícitamente ese contenido y pide cargarlo; se carga atribuido a la v1.4 con la advertencia de que no se ha cotejado contra el documento.

## Fuera de alcance

Generación, IA, investigación web, lectura/sincronización con ST Hub o Solotu_Cerebro, base vectorial, agentes, jobs, cambios en Publication, revisión pedagógica automatizada.
