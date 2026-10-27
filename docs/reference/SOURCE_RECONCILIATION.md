# Cotejo de fuentes de sistemas

Fecha: 2026-10-27. Cotejo documental; no se consultó operación en vivo.

## ST Hub

Fuente: [manual adjunto](systems/ST_HUB_MANUAL_2026-10-27.md), §§1, 3–7, 12, 19–20.

- ST Hub conserva Storytellers, asignaciones, coberturas, Contenidos, CONECTA y sus pipelines editoriales. Content OS no replica usuarios, capabilities, notificaciones, scheduler ni ST Police.
- El stack documentado respalda la familia tecnológica elegida; sus versiones, proyectos Supabase, rutas de credenciales y despliegue no se reutilizan automáticamente en Content OS. **Base, usuarios y secretos de Content OS deben estar aislados de ST Hub.**
- `contents.approved` es producción aprobada, no necesariamente pieza aprobada de Editorial Social. `completed` no equivale a published; `delivered` de CONECTA tampoco. Un espejo que aspire a inventario seguro debe representar el objeto editorial adecuado y su revisión completa, no deducirla de un estado operativo previo.
- El documento distingue cuenta “Rectora” y dependencia “Requiere Rectora”. Mantener esa distinción; no imponer la dependencia a todo Tec ni a otras marcas.
- Planeación documenta Campus feed 5/semana y PrepaTec feed 4/semana; Rectora sin cuota. Son valores de referencia de ese baseline: se pueden ofrecer al configurar con atribución, nunca cargarlos como datos operativos confirmados sin acción del usuario. Solotu sigue sin frecuencia verificada.
- Stories es **3 diarias y suma story_count**, sin compensación entre días. V0.1 solo mide unidades editoriales semanales: no convertir 3/día en 21/semana ni contar lotes como historias. Los targets de Stories Tec quedan fuera del indicador de cumplimiento equivalente a ST Hub. Mostrar “Cadencia diaria de Stories no evaluada en V0.1”. Una meta semanal manual distinta debe rotularse como meta local, nunca como espejo de ST Hub.
- Las publicaciones registradas manualmente en ST Hub no prueban una llamada a la plataforma; mantener esa atribución si se registran en Content OS.

## Sistema Editorial Creativo IJLV

Fuente: [documento adjunto](systems/IJLV_SISTEMA_EDITORIAL_v1.2.md), §§0, 9, 11, 13–18.

- Su estrategia, identidad, pilares, territorios, reglas de movimiento/sonido y capacidad de 6 h/semana pertenecen exclusivamente a IJLV. No son UI, taxonomía obligatoria ni metodología global de Content OS.
- Meta documentada: mínimo 3 publicaciones semanales; Instagram/Facebook como canales de trabajo. Puede ofrecerse al configurar IJLV, con fuente y confirmación humana; no inferir publicaciones realizadas de la parrilla.
- Validación pedagógica aplica según pieza. Orientación educativa requiere fuente + Dirección Académica; invitación creativa tiene otro alcance. Registrar dependencia aplicable y confirmación, sin crear un segundo usuario ni automatizar decisión institucional.
- Autorizaciones de imagen permanecen en el sistema restringido del colegio. Content OS solo guarda nota mínima de confirmación/referencia, no expedientes, nombres de menores ni documentos de permisos.
- El banco de ideas, las fichas “en reserva” y una parrilla confirmada no implican piezas completas aprobadas ni programadas. Para entrar a ReservePool debe demostrarse la condición aprobada de la pieza completa.
- P03: audiovisual v10 aprobado; el documento deja caption final y portada pendientes. No convertir esa aprobación de un entregable en approved de la pieza completa. Mostrar estado bruto y dependencia, mantener `review_complete_confirmed=false` y excluir de SAFE/reserva hasta confirmar el paquete completo. V0.1 no implementa aprobación parcial; conserva el matiz como evidencia externa.
- Metricool aparece como conexión pendiente y la producción por IA como método de IJLV. Ninguna de esas menciones autoriza implementar esas capacidades dentro de Content OS V0.1.

## Solotu_Cerebro

Solotu_Contexto_v2.md pendiente. La frontera está confirmada por el usuario y la conversación; no se conocen las reglas específicas de su oferta vigente. Claims o mensajes comerciales requieren fuente concreta al cargarse. No importar tono, promesas o dependencias de Tec/IJLV.

## Consecuencia de producto

El cockpit es transversal, no un indicador idéntico al dashboard de cada fuente. Mostrar alcance del indicador: “piezas editoriales semanales”. Conservar estado bruto, tipo de objeto, fecha de observación, fuente y certeza de revisión completa para todo espejo. Si no hay equivalencia clara, usar unknown y explicar la diferencia; nunca forzar una equivalencia para pintar cobertura verde.
