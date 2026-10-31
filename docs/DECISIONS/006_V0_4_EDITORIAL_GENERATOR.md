# ADR-006 — V0.4 Generador Editorial (piloto IJLV)

Fecha: 2026-10-31. Estado: implementado en código; migraciones `20261031000012_editorial_generator.sql` (esquema y comandos) y `20261031000013_ijlv_generator_seed.sql` (carga IJLV) **preparadas, no aplicadas**. Sin credencial del proveedor configurada todavía.

## Contexto

El propietario autorizó la IA generativa (instrucción V0.4), que antes estaba excluida por el canon y `CLAUDE.md`. El generador debe convertir el Client Brain en capacidad creativa: el contexto sale del Brain y de la base, no de prompts escritos a mano. Solo IJLV tiene generación en esta fase.

## Reutilización (auditoría previa)

| Necesidad | Decisión | Motivo |
|---|---|---|
| Content Package | Se **amplía** `review_packets` con `package jsonb`. Los textos clave también van a `review_packets.words` (gancho, texto en pantalla, cierre, caption, CTA) | ADR-003 ya lo señalaba como base del paquete. No se creó `generated_content` / `content_package` / `ai_output` |
| Claims generados | `claims` + `evidence_class` + `generated` (y `on_screen_credit` de V0.3) | Mismo sistema de verificación humana; regenerar reemplaza solo los generados pendientes |
| Dirección Académica | `approval_dependencies` (etiqueta «Revisión de Dirección Académica») | Bloquea la aprobación de esa pieza, no de otras |
| Historial de regeneración | `operation_events` (`before_data` guarda el paquete anterior) | Sin versionado propio |
| Pilares/territorios | `brand_axes` + `description` (función, límite, mensaje central) | El modelo necesita la función de cada pilar |
| Reglas por formato/modo | `brain_entries.applies_to` | Selección de contexto: no se envían reglas de motion a un reel con personas reales |
| Banco de ideas | **Nuevo** `idea_library` | No había estructura equivalente. Las ideas no son `ContentPiece` hasta que se eligen |
| Uso previo de una idea | `content_pieces.library_idea_id` (derivado; sin `last_used_at`) | Evita un contador duplicado que podría desincronizarse |
| Auditoría técnica | **Nuevo** `generation_runs` (etapa, proveedor, modelo, huella SHA-256 del input, estado, código de error, tokens) | Trazabilidad real de costo y fallos, sin guardar prompts, contexto ni secretos. Append-only |
| Capacidad por cliente | `brands.capabilities text[]` con catálogo `{editorial_generation}` | Mismo patrón que `brands.content_origins`; sin plataforma de capabilities |

## Decisiones

| Tema | Decisión |
|---|---|
| Proveedor | **Anthropic**, con el SDK oficial `@anthropic-ai/sdk` 1.3.0 (fijado). La guía de Anthropic indica el SDK en proyectos TypeScript; se descartó el HTTP directo que se había mencionado al propietario |
| Modelo | `claude-sonnet-5-5` (elección del propietario: equilibrado). Configurable con `GENERATION_MODEL` |
| Puerto | `StructuredGenerator` en `src/domain/generation/provider.ts`; el dominio no conoce al proveedor. Adaptador: `src/infrastructure/llm/anthropic.ts`. Un solo proveedor |
| Llamada | Una llamada por etapa, `output_config.format` (JSON Schema), esfuerzo `low` en Stage A y `medium` en Stage B, `maxRetries: 1`, timeout `GENERATION_TIMEOUT_MS` (55 s por omisión). Fallback de servidor `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) para rechazos por categoría |
| Esquemas | `conceptSchema`/`proposalsSchema` (Stage A) y `packageSchema` (Stage B) en `src/domain/generation/schema.ts`. El mismo esquema se envía al proveedor y valida la respuesta; además se revisan reglas semánticas (número de propuestas, ≤ 2 líneas de docente, caption). Para respetar el límite de la API (≤ 16 campos con unión de tipos por petición), los textos opcionales usan cadena vacía y se normalizan a null; una prueba vigila el límite |
| Referencias | El modelo nunca ve ids: pilares por código, territorios por nombre, fuentes como `S1…Sn`; el servidor los traduce y rechaza lo que no exista |
| Context Builder | `buildContext` (puro): solo el cliente, Brain vigente, categorías según la etapa, reglas de producción filtradas por formato/modo, fuentes activas/provisionales (sin superseded), contenido reciente ±60 días (máx. 12), uso de pilares/territorios/formatos, banco de ideas solo al generar desde cero. Excluye notas de cuenta |
| Stage A / B | Separadas. Aceptar un concepto crea **una** pieza `planned` en su día con el concepto en el Review Packet (`create_generated_piece`). El paquete se genera después desde la ficha (`save_generated_package`). Regenerar no crea piezas |
| Anti-repetición | Similitud léxica (Jaccard con raíces de 5 letras) contra contenido reciente e ideas del banco ya usadas, más sobreuso de pilar/territorio y formato repetido. Advierte, no bloquea |
| Evidence Engine | El modelo clasifica cada afirmación (`observation`, `institutional`, `educational_general`, `specialized`, `creative_metaphor`). El servidor consulta las reglas de revisión del Brain (`general_guidance`, `sensitive_topic`, `creative_invitation`): si la regla menciona fuente → «Fuente necesaria» cuando no hay `S#` válida; si menciona Dirección Académica → dependencia. Las invitaciones creativas no se guardan como claims |
| Aprobación | Nada se aprueba: todo queda en borrador (`planned`); claims `pending`; dependencias `pending` |
| Seguridad | Clave solo en el servidor; sin clave la app muestra «Generación no configurada.» y el resto funciona. Correos y teléfonos del texto libre se omiten antes de salir; aviso en la UI de no escribir nombres de alumnos. Sin imágenes ni datos de menores. Errores del proveedor se reducen a un código |
| Investigación | «Investiga un tema» aparece como «Próximamente: sin investigación web todavía». No se simula |
| Tec y Solotu | Sin capacidad: conservan su flujo manual. El servidor rechaza generación para ellos (CO403) |

## Carga IJLV (0013) y procedencia

El propietario subió el «Sistema Editorial Creativo IJLV» el 2026-10-31 y **confirmó que es el sistema vigente (v1.4)**, aunque el encabezado del archivo dice «Versión 1.2 · 16 de octubre de 2026» y su texto coincide con `docs/reference/systems/IJLV_SISTEMA_EDITORIAL_v1.2.md`. Se registró así en la nota de la fuente v1.4.

- Biblioteca: las 62 ideas de §10 con sus IDs 01–62, extraídas por script de la tabla (sin transcripción manual). Pilar por sección; territorio por la columna; formato y nivel tal cual («Reel / B»). `format_key` solo cuando el mapeo es inequívoco (sin valor para «Motion o carrusel», «Reel o carrusel», «Carrusel o cápsula», «Gráfico + voz»). Modo sugerido solo en dos casos deterministas: animación/motion → totalmente gráfico; reel con registro real (R) → personas reales. **Etapa: vacía** (el banco no la indica por idea).
- Brain: descripción de pilares y territorios (§3.2–3.3), 7 entradas de voz (§7.1), 4 reglas editoriales (§2.4, §2.6, §6.1, §9), 2 de evidencia (§2.5, §9.1), 10 de producción con ámbito (§0.1, §7.2, §7.3, §8.6, §8.7, §11.4). Ámbito asignado a las 10 reglas de producción de V0.3.
- «Movimiento subordinado a la claridad» no está en el documento: se atribuye a la fuente nueva «Decisiones editoriales del propietario (IJLV)» (instrucción V0.4).
- Fuentes UNICEF (§9.1) registradas como citadas por el documento; **sin fecha de consulta** porque Content OS no las consultó.

## Riesgos

- **Tiempo de respuesta en Netlify:** no se pudo verificar el límite vigente de las funciones (la documentación de Netlify no es accesible desde el entorno). Un paquete de producción puede tardar decenas de segundos. Si Netlify corta antes, la generación fallará sin guardar nada; se mitiga con llamadas separadas por etapa y `GENERATION_TIMEOUT_MS`.
- **Sin llamada real verificada:** sin clave no se probó una respuesta del proveedor. El esquema respeta los límites publicados; un rechazo del esquema llegaría como error y no guarda nada.
- Similitud léxica: detecta repetición de palabras, no de metáforas expresadas con otras palabras.
