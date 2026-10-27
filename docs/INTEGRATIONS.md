# Fronteras y referencias — Sin integraciones en V0.1

| Sistema | Conserva | Content OS puede registrar manualmente | No permitido |
|---|---|---|---|
| ST Hub | Storytellers, asignaciones, coberturas y producción Tec | Referencia, enlace, snapshot observado, cola transversal | Editar su producción, permisos o aprobar por él |
| Sistema Editorial IJLV | Estrategia y proceso editorial propio | Contexto citado y referencia a piezas | Sustituir estrategia o reglas institucionales |
| Solotu_Cerebro | Contexto empresarial, oferta y decisiones vigentes | Fuentes de claims y contexto de piezas locales | Inventar oferta o sobrescribir el contexto |
| Plataformas sociales | Hecho real de programación/publicación | Confirmación humana, fecha, URL o nota | Publicar, verificar vía API o asumir éxito |

## Dos relaciones diferentes

`context_reference`: fuente que fundamenta una pieza local; no cambia su autoridad. Una pieza local Solotu puede aprobarse en Content OS aunque cite Solotu_Cerebro.

`external_mirror`: representación manual de un objeto cuyo propietario es otro sistema. Tiene identidad fuente, enlace, fecha de observación, estado observado y evidencia/nota. Se muestra “Observado manualmente el…”, no “sincronizado”. No rellenar `last_synced_at`.

Los espejos no admiten decisiones editoriales locales. Review Desk muestra “Abrir en sistema fuente” y “Registrar observación”. Registrar observación confirma lo visto, no aprueba. Para observar approved exigir evidencia, fecha y alcance de revisión; guardar `source_state_raw` y `review_complete_confirmed`. Solo la aprobación de la pieza completa entra a SAFE. Un entregable aprobado parcialmente (p. ej. P03 IJLV) no equivale a pieza completa aprobada. Para observar approved exigir evidencia y fecha; no basta cambiar un selector sin atribución. La función de cobertura consume ese estado observado y expone su procedencia. No se define caducidad automática arbitraria; el usuario puede marcar la observación como desconocida y entonces deja de contar.

Las referencias rotas muestran aviso y conservan la captura previa; no se borra contenido. Una captura no garantiza frescura: mostrar fecha siempre. Los eventos de publicación de espejos se registran como observaciones manuales con evidencia, tampoco como acciones contra el origen. Se aplican las mismas reglas temporales y de conteo.

Consultar `reference/SOURCE_RECONCILIATION.md` para diferencias concretas: cadencia diaria Stories de ST Hub fuera del cálculo semanal, distinción Rectora cuenta/dependencia, aprobación parcial P03 y fronteras de contexto. No trasladar Metricool de IJLV ni scheduler/OneDrive de ST Hub a Content OS.

No crear tokens, clientes API, sincronizadores, conectores, jobs, webhooks ni write-back. Una integración futura requiere contrato de identidad, autoridad por campo, confirmación, frescura, idempotencia y manejo de fallos; no es trabajo autorizado para V0.1.
