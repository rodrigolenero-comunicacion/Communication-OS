# ADR-004 — V0.2.1 Orígenes de contenido (Tec)

Fecha: 2026-10-31. Estado: implementada en código; migración `20261031000009_content_origins.sql` **aplicada** por el propietario. Cerrada y verificada con sesión real por el propietario (2026-10-31).

## Contexto

Parte del contenido Tec nace en Communication Hub (eventos, coberturas, material producido). Content OS debe representarlo en el calendario sin obligar al flujo creativo ni duplicar Communication Hub.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| `origin` vs `content_origin` | Se añade `content_origin` (organic, event_coverage, existing_material). `origin` (0008) se conserva y se documenta como **modo de inicio creativo** del flujo orgánico | Auditoría: `origin` responde «¿cómo empieza la idea?» (5 valores, solo orgánico); `content_origin` responde «¿de dónde llega la pieza al calendario?». Fusionarlos mezclaría dos preguntas. En eventos y material, `origin` queda nulo |
| Material | `material_status` (not_required, pending, available) independiente de `production_status` | Dos dimensiones; la UI deriva «⚠ Material pendiente» sin tocar la máquina de estados |
| Copy | `needs_copy boolean` | No existía un equivalente; las dependencias de aprobación tienen otra semántica (bloqueo de aprobación) |
| Evento | `event_name` explícito; `title` sigue siendo el título editorial (sugerido «Formato · Evento», editable) | Evitar ambigüedad entre evento y título |
| Referencias | `source_system` (st_hub, onedrive, other), `source_entity_id`, `source_url` en la pieza, opcionales | **Referencia manual**: no implica sincronización, importación ni verificación. No se reutilizó `source_references` porque modela espejos con observaciones y claims |
| Comando | `create_calendar_piece` evoluciona con 7 parámetros nuevos **opcionales** (default). Sin comandos por origen | Un solo agregado; la forma de V0.2 sigue siendo válida (probado) |
| Coherencia | Orgánico → not_required por defecto; material existente → available por defecto; evento → pending si no se indica y exige nombre. Modo de producción obligatorio solo en orgánico | Sin bloquear casos legítimos (p. ej. orgánico con material pendiente) |
| Orígenes por cliente | `brands.content_origins` (orgánico siempre incluido); la migración habilita los tres para `slug = 'tec'`; editable en Clientes. El servidor rechaza orígenes no habilitados | Configuración simple en lugar de `if brand === "Tec"` y sin framework de capabilities |
| Edición | Nombre del evento, material, copy y referencias son campos **operativos** (no invalidan revisión). `content_origin` no se cambia por edición | El material puede llegar después de aprobar; el origen define el agregado |
| Sin duplicar Communication Hub | No hay tablas locales de eventos, coberturas, storytellers, asignaciones ni entregas | Frontera de sistema (§2, §24) |
| Modo de producción | Obligatorio solo en orgánico (incluida la forma V0.2 sin origen); NULL en evento y material existente, sin valores ficticios. La regla vive en `create_calendar_piece` (0009) y en el registro de comandos de la app | Corrección del smoke real (ver HANDOFF): la app lo exigía para todos los orígenes |
| Formatos | Se reutiliza el catálogo existente; no se añadió «Otro» | No había soporte limpio y no es necesario para los casos descritos |
