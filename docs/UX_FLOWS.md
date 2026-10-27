# Flujos de interfaz

Interfaz en español, acciones inequívocas, fechas locales con zona visible al editar instantes. Separar estados con texto además de color. Componentes accesibles con teclado, labels, foco, errores junto al campo y feedback de guardado; no requerir hover. Diseñar para escritorio y móvil.

## Navegación mínima

Control Tower · Portfolio · Inventario · Review Desk · Publication Queue. La planeación semanal y reserva pueden ser vistas del Inventario; no requieren herramientas separadas. Evitar paneles vacíos de analítica o IA.

## 1. Login y primer uso

Login real con Supabase Auth y usuario provisionado. Sin registro público. Un usuario autenticado no autorizado recibe acceso denegado sin datos. Primer uso: crear/confirmar las tres marcas y cinco cuentas, activar canales y configurar objetivos. No mostrar targets ficticios como reales. Estados vacíos explican la próxima acción.

## 2. Control Tower

Primero atención: revisiones pendientes, cuentas bajo buffer, gaps y programaciones vencidas sin confirmar. Después tabla por cuenta con SAFE/PROJECTED, salud, fecha límite y próxima semana. Mostrar “Sin objetivo” donde falte configuración y “Sin cuota” si fue declarado expresamente; no tratar ambas situaciones como iguales. Mostrar aviso de cadencia diaria Stories no evaluada donde corresponda. Mostrar “al menos”/“desconocido después de” cuando el cálculo no sea exacto.

Por semana mostrar objetivo, cumplido, seguro pendiente, proyectado total y gaps. No mezclar confianza con cantidad. El detalle permite ver qué piezas componen cada número. Reserva separada con acción Asignar; achievable no cambia el estado COVERED hasta asignación real.

Cada cuenta abre inventario filtrado; cada gap abre la semana y ofrece crear/planificar o elegir reserva. No crear piezas por pulsar sobre un gap.

## 3. Crear y planificar

Formulario inicial: título, cuenta, bucket y timing (flexible por defecto). Campos productivos se completan después. ownership local por defecto; un enlace contextual no cambia ownership. Registrar un espejo externo es un flujo separado con identidad fuente y observación explícita.

Elegir semana valida timing. Mostrar: “Asignada a semana del …; aún sin programar”. La reserva solo muestra piezas de la misma cuenta/bucket. Si una pieza está assigned, no aparece disponible en otra semana. Error de concurrencia pide recargar sin perder texto del formulario cuando sea posible.

## 4. Producción y Review Desk

Completar objetivo, audiencia, experiencia, Words y spec; declarar claims/dependencias. Enviar a revisión. Cola priorizada por fecha objetivo más próxima; a igualdad, salud de cuenta (CRITICAL, LOW, resto), luego fecha de entrada. Sin scoring opaco ni estimaciones inventadas de tiempo humano.

Detalle: concepto/objetivo → preview compatible o texto estructurado → Words → claims/evidencia → dependencias → spec completa desplegable. Las dependencias pertenecen a esa pieza/cliente.

Tres decisiones principales: Aprobar / Pedir cambios / Hold. Mostrar impedimentos concretos de aprobación. Pedir cambios exige una instrucción breve. Hold no entra a publicación ni cobertura pendiente. Historial visible, inmutable. Liberar hold es acción contextual.

Impacto muestra la comparación antes/después obtenida del cálculo real; una pieza sin semana no cambia runway y debe decirlo. El impacto de espejo externo no presenta botón de aprobación: “Abrir en fuente” y “Registrar observación”.

## 5. Publication Queue

Dos grupos: piezas aprobadas sin destino creado, y publicaciones unscheduled/scheduled. Una aprobación hace visible la pieza pero no crea Publications automáticamente. Botón “Crear registro de publicación”, canal y formato.

“Registrar programación manual” pide fecha/hora y confirmación de que se programó fuera de Content OS. “Registrar publicación realizada” pide instante real y URL/nota. Mensaje de guardado: “Programación registrada” o “Publicación registrada”; nunca “Enviado a Instagram”. Scheduled vencidas generan tarea visible de confirmación, no avance automático.

Si IG ya está publicado y FB pendiente: la semana conserva una unidad cumplida y Facebook permanece pendiente. La cola no desaparece al completar el primer canal. Cancelar destino explica que no cancela la aprobación ni elimina por sí solo la asignación semanal.

## 6. Verificación del flujo vertical

Login → configurar Solotu.IA → crear pieza local → asignar semana → producción → revisión → aprobación → crear registro IG → registrar programación → registrar publicación real → ver cobertura sin duplicaciones. Añadir FB y verificar que solo crece la cola de destinos, no la cantidad editorial.

UI debe permitir recargar y recuperar estado persistido, filtrar por cuenta/estado/semana, abrir fuentes, volver al lugar anterior y comprender errores. No sustituir persistencia por estado temporal del navegador.
