# Brief ejecutable — V0.1 Manual Control Tower

## Encargo

Construir en esta raíz la primera versión utilizable de Content OS. No entregar únicamente un prototipo visual. Implementar un flujo manual persistido y privado desde login hasta registro de publicación, con cobertura y runway confiables.

Autoridad: CLAUDE.md → SYSTEM_CANON → PRODUCT_MODEL/ADR-001 → ARCHITECTURE/DATA_MODEL. Los documentos originales de Systems Architect quedan pendientes de cotejo según SOURCES; su ausencia no bloquea construir este contrato. No inventar requisitos de esos archivos.

## Incluye

- Autenticación y allowlist single-user con RLS.
- CRUD mínimo de marcas, cuentas, canales activos y objetivos semanales.
- Piezas locales y referencias/espejos manuales; ownership visible.
- Planeación semanal, timing fixed/window/flexible y reserva explícita.
- Producción, packet básico, claims/dependencias y decisiones inmutables.
- Registros manuales de publicaciones y sus transiciones.
- Control Tower, Review Queue, Publication Queue, cobertura, runway y buffer.
- Necesidades calculadas a partir de gaps; sin crear contenido automáticamente.
- Migraciones, fixtures de desarrollo, pruebas, README operativo y continuidad.

## No incluye

Agentes, cron, Meta API, Metricool, OneDrive, n8n, automatización externa, integraciones con los sistemas fuente, write-back, IA, generación de previews, subida/procesamiento de assets, analítica, notificaciones, colaboración, roles, planificación por canal, mezcla estratégica automática ni aprobación parcial. No añadir tecnologías fuera de Next.js/TypeScript + Supabase/PostgreSQL + Tailwind + Netlify.

## Secuencia de ejecución

### A. Base y contrato verificable

Inspeccionar directorio; crear proyecto en la raíz sin borrar el paquete; fijar dependencias compatibles del stack autorizado y scripts reales. Implementar tipos y funciones puras de estados, semanas, cobertura, reserva y runway con reloj inyectable. Construir fixtures según ACCEPTANCE_TESTS.

Salida: dominio comprobado sin necesitar credenciales; decisiones de implementación menores anotadas. No detenerse aquí si se puede continuar.

### B. Persistencia y acceso

Crear migraciones para DATA_MODEL, políticas RLS y comandos transaccionales. Preparar seed de desarrollo separado. Crear `.env.example` y pasos concretos para configurar un proyecto Supabase y provisionar al único usuario. Implementar sesión, denegación de acceso y cierre de sesión.

Salida: migraciones reproducibles, lectura/escritura autorizada y pruebas de bypass. Si falta un servicio real, dejar integración pendiente con causa y continuar UI/dominio; no afirmar validación de RLS mediante mocks.

### C. Portfolio e inventario

Crear/editar cuentas y objetivos, piezas, estados editables, timing y asignación. Mostrar inventario y reserva por cuenta. Crear referencias contextuales y espejo manual sin confundir propiedad. Sincronización no existe.

Salida: configuración y piezas sobreviven recarga; asignaciones inválidas rechazadas por servidor/base de datos.

### D. Revisión a publicación

Review Packet básico con fallback textual, claims/dependencias, bloqueo de aprobación, snapshot y decisiones append-only. Impacto de aprobación con la misma función de cobertura. Crear registros de publicaciones, programar y confirmar manualmente, con cancelación/reapertura controlada e historial. Resolver conflictos de versión y dobles clics.

Salida: flujo completo en una cuenta sin APIs externas; espejo externo no puede aprobarse localmente.

### E. Control Tower y cinco cuentas

Conectar cálculos reales a vistas y colas; explicar procedencia de totales. Integrar salud, objetivos ausentes, límites de horizonte, cumplidos y programaciones vencidas. Probar fechas de cambio de semana. Revisar teclado, móvil y estados de carga/error/vacío.

Salida: las seis preguntas del canon pueden contestarse con datos almacenados, sin abrir tablas de base de datos.

### F. Entrega y piloto

Ejecutar pruebas, tipos y build; documentar resultados reales y pendientes. Preparar configuración para Netlify, sin desplegar ni crear servicios remotos sin instrucción adicional. Actualizar README con comandos exactos y configuración; HANDOFF con estado de migraciones y siguiente acción.

Preparar un guion de una semana de uso real: cargar inventario real, contrastar a diario las seis respuestas con las fuentes, registrar discrepancias. La aceptación del piloto queda pendiente del uso humano; no marcarla completada al compilar.

## Datos de arranque

Seeds de catálogo: canales instagram/facebook. Portfolio sugerido: Tec de Monterrey con Campus Puebla, PrepaTec Puebla y Directora / Rectora (renombrable); Instituto Juan Luis Vives con IJLV; Solotu.IA con Solotu.IA. El usuario confirma canales y frecuencias. Las referencias documentales disponibles (Campus feed 5, PrepaTec feed 4, Rectora sin cuota e IJLV mínimo 3) se pueden ofrecer con fuente, pero no activar silenciosamente. Stories Tec diaria no se convierte a cuota semanal. Los ejemplos de prueba no son compromisos operativos. No importar datos ni contexto entre clientes.

Fixtures ficticios en desarrollo exclusivamente: estados COVERED, AT_RISK, GAP, cuenta sin target, reserva no asignada, pieza IG+FB, publicación ya cumplida, espejo externo, claim bloqueante y programación vencida.

## Definition of Done técnico

- Flujo completo con persistencia y sesión real; controles de acceso probados.
- Cada escenario de ACCEPTANCE_TESTS tiene evidencia de resultado o bloqueo declarado. Casos críticos de conteo, aprobación y RLS pasan antes de declarar listo para piloto.
- No existe doble conteo ni sobrepromesa de runway; fechas y límites visibles.
- Historial intacto; reintentos no duplican decisiones/eventos.
- No hay conectores, jobs, agentes ni dependencias fuera del stack.
- Build y tipos pasan en la implementación real; README reproduce instalación, migraciones, pruebas y arranque.
- HANDOFF distingue implementado, probado, pendiente y no implementado.

No solicitar permisos por componentes o correcciones reversibles. Escalar solo decisiones materiales según CLAUDE.md. Si hay un bloqueo, entregar todo el trabajo independiente y un siguiente paso concreto, sin presentar el release incompleto como terminado.
