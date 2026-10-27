# Arquitectura — V0.1

## Forma del sistema

Monolito Next.js/TypeScript con UI, operaciones de servidor y dominio; Supabase provee autenticación y PostgreSQL. Tailwind estiliza la UI. Netlify es el destino de despliegue. No hay backend separado ni servicios adicionales.

Flujo: navegador → Next.js (sesión, validación y caso de uso) → PostgreSQL/Supabase (RLS, constraints y transacción) → resultado → recálculo de cobertura. Las funciones de dominio son puras y no dependen de componentes ni llamadas de red.

Estructura orientativa, a crear por Claude Code:

```text
src/
  app/                 rutas, layouts, acciones de servidor
  components/          UI compartida
  domain/              estados, timing, cobertura, runway, reserva
  application/         casos de uso y autorización
  infrastructure/      acceso Supabase y mapeo de datos
supabase/
  migrations/          SQL versionado
  seed.sql             datos de desarrollo, nunca producción por defecto
tests/                 dominio e integración
```

Separar responsabilidades mediante módulos; no crear framework, contenedor de inyección ni microservicios. El dominio recibe datos y now como argumentos. Mantener consultas acotadas al horizonte/cuentas visibles y evitar una consulta por tarjeta.

## Seguridad single-user

Supabase Auth identifica al usuario. Provisión manual inicial; sin registro público, invitaciones ni administración de usuarios en la app. `authorized_users` contiene el único UUID autorizado y activo. Single-user no significa aplicación pública ni ausencia de RLS.

Cada lectura y mutación exige sesión válida y allowlist activa. RLS se aplica a todas las tablas, incluidas catálogos operativos e historial. Usuario anónimo y usuario autenticado fuera de allowlist no ven filas ni escriben. Un usuario no puede insertarse o activarse a sí mismo en authorized_users. Las funciones que consultan allowlist deben evitar recursión RLS y usar privilegios mínimos; fijar search_path, grants y verificar auth.uid() en funciones con privilegios elevados.

La aplicación usa la sesión del usuario; nunca service role para saltarse RLS. Claves privadas no van al navegador, Git ni logs. La clave pública cliente no sustituye autorización. Guardar configuración real en entorno local/Netlify; mantener `.env.example` con placeholders de las variables que use la implementación. No inventar nombres de claves de una versión de SDK todavía no elegida.

## Escrituras y concurrencia

Los comandos de transición, revisión, publicación y reasignación usan transacciones PostgreSQL invocadas desde servidor. Bloquean la fila afectada o comparan versión esperada; conflicto devuelve mensaje de recarga, no “última escritura gana”. Un request_id único por comando impide duplicados por doble clic/reintento.

Separar permisos de edición de campos ordinarios y campos protegidos. El rol autenticado no puede actualizar directamente estado, revision, aprobación, hold, historial o campos de publicación que eluden comandos. Aplicar revocaciones por columna/tabla y funciones SQL controladas o triggers equivalentes. RLS por sí sola no valida transiciones. Probar también llamadas directas a la API de datos.

Aprobar: validar autoridad, estado, revision, hold, packet, claims y dependencias → insertar snapshot/decisión → actualizar approved/revision aprobada → commit. Error en cualquier paso revierte todo. Programar/publicar comprueba la aprobación vigente en esa misma transacción. Los espejos usan un comando separado de observación, nunca approve.

Datos derivados (coverage, runway, health, necesidades, impacto) no se guardan como verdad paralela. Se calculan al leer y tras acciones manuales. No usar cron, polling de plataformas ni trabajos en segundo plano. La UI debe refrescar cuando el usuario vuelve o solicita actualizar para no conservar fechas vencidas de una sesión anterior.

## Referencias y archivos

Persistir URLs https/http válidas y texto. No descargar URLs desde el servidor, ejecutar contenido, renderizar HTML arbitrario ni manejar credenciales de servicios fuente. Preferir enlaces “Abrir fuente”; mostrar previews solo de medios compatibles y seguros, con fallback al enlace/texto. No subir assets ni configurar almacenamiento en V0.1.

## Entornos y entrega

Content OS debe usar base y configuración propias; no usar proyectos, tablas, usuarios o credenciales de ST Hub. Esta separación no autoriza crear infraestructura remota sin instrucción del propietario.

Desarrollo: datos ficticios claramente rotulados. Producción: base vacía de ejemplos, usuario provisionado manualmente y configuración explícita de objetivos. Las migraciones se versionan y prueban contra base de desarrollo; no aplicar cambios destructivos sobre datos existentes.

Claude Code verificará las versiones compatibles de Next.js, TypeScript, Tailwind, SDK oficial Supabase y runtime de Netlify al implementar; esta especificación no fija APIs ni versiones no verificadas. Versionar lockfile. Crear configuración de build/hosting mínima según las versiones efectivamente usadas. Preparar despliegue no equivale a ejecutarlo.

Verificación mínima: dominio con reloj fijo; constraints y transacciones contra PostgreSQL; RLS con identidades distintas; flujo manual persistido; build y tipos; navegación responsive. Usar herramientas del stack y pruebas nativas antes de añadir dependencias. Si una comprobación necesita servicio no configurado, registrarla pendiente y no reemplazarla por un mock declarado como prueba de integración.
