# Aceptación V0.1 — Casos reproducibles

Estado: especificaciones para ejecutar durante implementación, **no pruebas ya ejecutadas**. Separar pruebas de dominio, integración PostgreSQL/RLS y recorrido de interfaz. Cada caso debe registrar PASS/FAIL/BLOCKED y evidencia.

## Fixture base de dominio

Reloj fijo: 2026-10-27 12:00 America/Mexico_City (= 2026-10-27T18:00:00Z). Semana actual W0 = 2026-10-26; W1 = 2026-11-02; W2 = 2026-11-09. Cuenta de prueba A, feed target 4/semana, buffer 7, vigencia desde 2026-10-26 sin fin. Cuenta B independiente. Todos los datos de este fixture son ficticios y no se insertan en producción.

Para W1 de A: P1 approved; P2 approved con IG y FB scheduled el 3 nov en horario futuro; P3 in_review; P4 in_production; P5 planned; P6 idea. Todas assigned a W1. P7 approved/flexible sin asignación; P8 approved/flexible de B. Aprobaciones/revisiones válidas, sin holds ni vencimientos salvo donde se indique.

## Conteo, reserva y runway

| ID | Acción/condición | Resultado esperado |
|---|---|---|
| C01 | Calcular fixture W1 | required=4, safe=2, projected=4, safe_gap=2, projected_gap=0, AT_RISK |
| C02 | Contar P2 con IG+FB | Una unidad total, no dos ni tres por sumar pieza + destinos |
| C03 | Quitar P4 de producción (planned) | safe=2, projected=3, GAP |
| C04 | Consultar reserva A | P7 elegible; P8 excluida. SAFE sigue 2; achievable=3 |
| C05 | Asignar P7 a W1 | safe=3, projected=5, reserva A=0; no crear scheduled |
| C06 | Intentar asignar P7 también W2 | Rechazo/reescritura explícita, nunca dos asignaciones simultáneas |
| C07 | W0 tiene 6 seguras y W1 tiene 2 | W1 conserva gap 2; excedente W0 no compensa |
| C08 | Mover una approved a in_production por reapertura | Deja SAFE y entra PROJECTED; aprobación vigente invalidada |
| C09 | P3 pasa a changes_requested | Sale de PROJECTED; feedback obligatorio |
| C10 | Hold sobre pieza pendiente | Sale de ambas capas/reserva; liberar vuelve a evaluar estado original |
| C11 | W0 uncovered | Safe runway 0, CRITICAL aunque W1 esté cubierta |
| C12 | W0/W1 cubiertas, W2 gap | until=2026-11-09T06:00:00Z; days=12 con reloj base; límite exclusivo |
| C13 | SAFE falla W1, PROJECTED falla W2 | Safe days=5, projected days=12; no una sola cifra |
| C14 | 12 ventanas cubiertas | Resultado at_least hasta 18 ene 2027 00:00 local; sin infinito |
| C15 | Target termina en W2 y W0/W1 cubiertas | unknown_after=9 nov; no declarar W2 cubierta |
| C16 | Cuenta sin target ni exclusión deliberada | Sin objetivo configurado, sin salud verde |
| C17 | Cuenta marcada sin cuota | Sin cuota, fuera de ranking de gaps; distinta de configuración faltante |
| C18 | Dos buckets; feed suficiente y stories insuficiente | Sin compensación entre buckets; cuenta muestra peor estado |
| C19 | now domingo 1 nov 23:59 y lunes 2 nov 00:00 local | Cambia de W0 a W1 exactamente; navegador en otra zona da lo mismo |
| C20 | Fixed 30 oct asignado a 2 nov | Rechazo; window 3–9 nov solo admite fecha concreta dentro del rango |
| C21 | W1 total cumple pero P1 fixed venció sin publicarse | P1 excluida al evaluar tras esa fecha; no falsa disponibilidad |
| C22 | Meta diaria Stories ST Hub | No convertir a 21 semanales; indicador explícito no evaluado |

## Publicación, revisión y fuentes

| ID | Acción/condición | Resultado esperado |
|---|---|---|
| R01 | P1 aprobada sin Publication | Una unidad SAFE si assigned; aparece para crear destino |
| R02 | Registrar una published de W0 | fulfilled aumenta; misma pieza deja safe_pending; safe total no se duplica ni cae |
| R03 | Publicar segundo canal misma semana | fulfilled permanece 1 para esa pieza; cola del segundo canal se resuelve |
| R04 | Fecha scheduled pasa sin confirmación | Estado sigue scheduled; alerta; si no hay published, fuera de SAFE/PROJECTED |
| R05 | Registrar published con fecha futura | Rechazo del servidor; ningún evento/fila parcial |
| R06 | Crear/programar publicación sin aprobación vigente | Rechazo incluso vía API directa |
| R07 | Cambiar semana con destinos scheduled | Exige operación coherente explícita; no mover fechas en silencio |
| R08 | Cancelar único destino de approved assigned | Destino cancelled; pieza sigue segura y necesita nuevo destino; no vuelve a reserva hasta desasignar |
| R09 | Approve con claim pendiente/sin fuente | Rechazo; sigue in_review; cero decisiones approved nuevas |
| R10 | Claim supported + evidencia + dependencias resueltas | Approve guarda snapshot/actor/revisión y estado en una transacción |
| R11 | Simular error al insertar decisión | No queda pieza approved sin decisión |
| R12 | Editar copy approved | Rechazo edición directa; exige reopen si no hay scheduled/published |
| R13 | Intentar editar pieza ya publicada | Preserva historia; nueva pieza para variante editorial |
| R14 | Espejo ST Hub pending_review + clic aprobar/API | Rechazo; abrir fuente o registrar observación; nunca decisión local |
| R15 | Registrar observación approved completa con evidencia | Cuenta SAFE si assigned; muestra estado fuente y fecha; no simula sync |
| R16 | ST Hub contents.completed / CONECTA delivered | No mapear a published ni aprobación editorial final automáticamente |
| R17 | IJLV P03: audiovisual aprobado, caption/portada pendientes | review_complete_confirmed=false; fuera de SAFE/reserva; conservar estado bruto |
| R18 | Fuente/contexto IJLV intentado en claim de Solotu | Rechazo del vínculo privado cruzado o aclaración de ámbito; no traslado implícito |
| R19 | Reserva IJLV solo como ficha/idea | No contar como reserva aprobada |
| R20 | Aprobar pieza sin asignación | Impacto runway igual antes/después; no inventar mejora |
| R21 | Dos envíos mismo request_id | Un efecto/decisión; resultado idempotente |
| R22 | Dos comandos con misma expected_version | Uno gana; otro recibe conflicto, no sobreescritura |

## Persistencia y seguridad

- S01: anónimo no lee ninguna tabla operativa ni invoca comandos.
- S02: autenticado no allowlisted no lee/escribe; tampoco puede activarse en authorized_users.
- S03: usuario autorizado activo completa el flujo; al desactivarlo, sesiones existentes pierden acceso a datos.
- S04: llamadas directas a datos no cambian production_status, approval, publication status ni historial evitando comandos.
- S05: UPDATE/DELETE de review_decisions, observations y operation_events se rechazan desde rol de app.
- S06: referencias a cuenta/canal de otra pieza y asignación duplicada son rechazadas en base de datos.
- S07: dos escrituras concurrentes de objetivos solapados no dejan políticas solapadas.
- S08: contenido con HTML/script se muestra como texto; URL con esquema ejecutable se rechaza.
- S09: no secretos en bundle/commits; entorno de Content OS no reutiliza base de ST Hub.
- S10: cuenta/canal inactivos no permiten programación nueva; historial sigue disponible.
- S11: cambios de timing/claim/dependencia no eluden revisión por editar tablas auxiliares.

## Recorrido humano y piloto

Crear marca/cuenta/target → pieza → asignar → producir → packet → revisar → aprobar → crear IG → registrar programación → registrar publicación → añadir FB → confirmar que la cobertura sigue en una unidad. Recargar en cada tramo para verificar persistencia. Repetir el patrón con cinco cuentas usando datos de prueba, sin inventar targets reales.

Verificar teclado, móvil, errores de red/sesión, formularios vacíos, fuente inaccesible, explicación de SAFE/PROJECTED, aviso de alcance semanal y ausencia de publicación automática. Build y tipos completan la validación, no sustituyen estos casos.

Piloto de una semana real pendiente: contrastar cada día inventario, gaps, cola y fechas con fuentes; anotar cada discrepancia. No declarar éxito del piloto sin participación del usuario.
