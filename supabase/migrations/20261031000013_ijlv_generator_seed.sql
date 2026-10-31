-- Content OS V0.4 — carga del piloto IJLV (solo si existe el cliente con slug 'ijlv').
--
-- Fuente: «Sistema Editorial Creativo IJLV». El propietario subió el documento el 2026-10-31 y
-- confirmó que es el sistema vigente (registrado como v1.4), aunque su encabezado dice
-- «Versión 1.2 · 16 de octubre de 2026». Su texto coincide con
-- docs/reference/systems/IJLV_SISTEMA_EDITORIAL_v1.2.md. Cada dato lleva su sección (§).
-- No se inventan ideas, IDs, etapas ni modos: lo que el documento no indica queda en NULL.

do $$
declare
  v_brand uuid;
  v_src uuid;
  v_dec uuid;
  r record;
  i integer;
begin
  select id into v_brand from public.brands where slug = 'ijlv';
  if v_brand is null then return; end if;

  update public.brands set capabilities = array['editorial_generation'] where id = v_brand;

  select id into v_src from public.source_references
   where brand_id = v_brand and relation_kind = 'context_reference' and document_version = '1.4'
   order by created_at limit 1;
  if v_src is null then
    raise exception 'Falta la fuente IJLV v1.4: aplica antes 20261031000011_client_brain_seed.sql';
  end if;
  update public.source_references set
    locator = 'docs/reference/systems/IJLV_SISTEMA_EDITORIAL_v1.2.md',
    notes = 'Fuente editorial vigente (D2). El propietario subió el documento el 2026-10-31 y confirmó que es el sistema vigente, aunque su encabezado dice «Versión 1.2 · 16 de octubre de 2026»; su texto coincide con el archivo del repositorio indicado en el localizador.',
    version = version + 1
  where id = v_src;

  insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, source_type, status, notes)
  values ('context_reference', 'brand', v_brand, 'manual', 'Decisiones editoriales del propietario (IJLV)', 'decision', 'active',
    'Reglas indicadas por el propietario en la instrucción V0.4 (2026-10-31) que no aparecen en el documento editorial.')
  returning id into v_dec;

  insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type, source_url, status, notes, locator)
  values
    ('context_reference', 'brand', v_brand, 'manual', 'How to communicate effectively with your young child', 'UNICEF', 'web',
     'https://www.unicef.org/bangladesh/en/parenting-bd/how-communicate-effectively-your-young-child', 'active',
     'Fuente de referencia acotada citada por el Sistema Editorial (§9.1): atender, usar lenguaje comprensible y reconocer acciones concretas; pertinente para Maternal y Preescolar. Content OS no la consultó: sin fecha de consulta.',
     'Sistema Editorial §9.1'),
    ('context_reference', 'brand', v_brand, 'manual', 'The Power of Play', 'UNICEF', 'web',
     'https://data.unicef.org/resources/the-power-of-play/', 'active',
     'Citada por el Sistema Editorial (§9.1): contexto general sobre juego y aprendizaje en primera infancia. No prueba efectos de una actividad específica del IJLV. Content OS no la consultó: sin fecha de consulta.',
     'Sistema Editorial §9.1');

  -- Pilares y territorios: función, límite y mensaje central (§3.2, §3.3).
  for r in select * from (values
    ('P1', 'Demostrar. El proceso y la intención detrás de una actividad real. Historias: intentos, decisiones, preguntas y mediación docente; Reel, carrusel de proceso, entrevista breve. Límite: no es galería sin explicación ni anuncio de resultados no comprobados. Clasificación: si demuestra un proceso escolar, P1.'),
    ('P2', 'Inspirar y volver memorable una idea: curiosidad, convivencia, expresión y posibilidad de intentar. Metáforas visuales, animaciones conceptuales. Límite: la metáfora no se presenta como explicación del cerebro ni como medición de un niño. Clasificación: si comunica una idea humana mediante una metáfora, P2.'),
    ('P3', 'Aportar valor a las familias: ideas concretas para conversar y acompañar; motivo para volver y compartir. Preguntas, ejemplos de diálogo, propuestas sencillas; carrusel o cápsula animada. Límite: no diagnostica, culpa ni sustituye orientación individual. Clasificación: si deja una herramienta para casa, P3.'),
    ('P4', 'Construir pertenencia: personas, colaboración, tradiciones y momentos compartidos. Preparativos, celebraciones verificadas, agradecimientos; fotos, carrusel, recap. Límite: no se vuelve agenda exhaustiva ni álbum de rostros sin propósito. Clasificación: si su valor principal es reconocer una experiencia compartida, P4.')
  ) as t(code, d) loop
    update public.brand_axes set description = r.d where brand_id = v_brand and kind = 'pillar' and code = r.code;
  end loop;
  for r in select * from (values
    ('Humanidad', 'Empatía, comunidad, vínculos, emociones, acompañamiento. Mensaje central: «La educación también ocurre en la forma en que nos relacionamos.»'),
    ('Pensamiento', 'Curiosidad, reflexión, observación, pensamiento crítico; la escuela orienta el pensamiento, no dicta qué pensar. Mensaje central: «Las grandes ideas comienzan con una pregunta.»'),
    ('Proceso', 'Crecimiento, esfuerzo, descubrimiento, aprendizaje continuo. Mensaje central: «Aprender no es llegar. Es recorrer el camino.»'),
    ('Mundo', 'Exploración, contexto, ciudadanía, conexión con la realidad. Mensaje central: «El aprendizaje cobra sentido cuando se conecta con el mundo.»')
  ) as t(n, d) loop
    update public.brand_axes set description = r.d where brand_id = v_brand and kind = 'territory' and name = r.n;
  end loop;

  -- A qué formatos/modos aplica cada regla de producción ya cargada (V0.3).
  update public.brain_entries set applies_to = array['real_people', 'real_plus_graphics']
   where brand_id = v_brand and category = 'production_rule'
     and title in ('Personas reales: naturalidad', 'No guionizar a los niños', 'Plan B', 'Guía de captura');
  update public.brain_entries set applies_to = array['fully_graphic', 'motion']
   where brand_id = v_brand and category = 'production_rule'
     and title in ('Animación', 'Referencias de lenguaje', 'Diseño sonoro', 'Lectura');
  update public.brain_entries set applies_to = array['fully_graphic', 'real_plus_graphics', 'motion']
   where brand_id = v_brand and category = 'production_rule' and title in ('Figuras con significado', 'Trazos y texto');

  -- Entradas nuevas del documento (con sección) y de la instrucción V0.4.
  i := 100;
  for r in select * from (values
    ('voice', '{}'::text[], 'Atributos de voz', 'Inteligente, humano, cercano, reflexivo, inspirador, sobrio, contemporáneo.', '§7.1'),
    ('voice', '{}', 'Qué evitar', 'Frases motivacionales vacías, clichés educativos, lenguaje excesivamente comercial, exageraciones publicitarias, mensajes aspiracionales artificiales.', '§7.1'),
    ('voice', '{}', 'Copy', 'Breve, memorable, reflexivo, fácil de entender. Humor sutil e inteligencia en el juego de palabras; pocas palabras, máximo impacto. Ejemplos de tono: «Las grandes ideas comienzan con una pregunta.» «Aprender también es descubrir.» «Las preguntas abren caminos.»', '§7.1'),
    ('voice', '{}', 'Verbos observables', 'Hablar a personas adultas con calidez, claridad y curiosidad. «Practicaron explicar su idea» es preferible a «potenciaron sus habilidades para el futuro». Reservar «aprendieron» o «mejoraron» para observaciones que el equipo pueda sustentar.', '§7.1, §2.5'),
    ('voice', '{}', 'No atribuir estados internos', 'No atribuir pensamientos o emociones a un niño a partir de su expresión. No escribir testimonios para que parezcan espontáneos. No etiquetar capacidades («nuestros pequeños genios»).', '§7.1'),
    ('voice', '{}', 'Bilingüismo', 'Dejar que el inglés aparezca en las piezas (una palabra, una frase, un rótulo) en lugar de anunciar el programa bilingüe.', '§7.1'),
    ('voice', '{}', 'Resolución de tono', 'La sobriedad vive en el copy y la composición (espacio en blanco, pocas palabras, tipografía protagonista). Lo lúdico vive en el movimiento y en los elementos gráficos por nivel.', '§7.1'),
    ('editorial_rule', '{}', 'Cinco preguntas y filtro final', 'Cada pieza responde al menos una: ¿qué significa aprender, crecer, pensar, convivir, descubrir el mundo? Filtro final: ¿parece una escuela que busca vender o una comunidad educativa que acompaña el desarrollo humano? Siempre la segunda.', '§2.4'),
    ('editorial_rule', '{}', 'Escalera de CTA', 'Un CTA por publicación: comprender («Mira qué cambió…»), usar («Guarda esta pregunta…»), participar (sin pedir datos personales de niños), pertenecer (si la difusión está autorizada), considerar (solo con canal confirmado). No convertir toda cápsula para familias en anuncio de admisiones.', '§2.6'),
    ('editorial_rule', '{}', 'Elegir formato después de la función', 'Acción, secuencia o voz → video real. Comparar etapas, leer o consultar después → carrusel. Una imagen contiene gesto y contexto → fotografía con texto. Idea abstracta que el movimiento vuelve comprensible → animación. Acción real que se entiende mejor con etiquetas → híbrido video + motion. El material manda.', '§6.1'),
    ('editorial_rule', '{}', 'Cápsulas para familias (P3)', 'Una idea pequeña y adaptable, no una lista de obligaciones nuevas. Estructura: situación reconocible → propuesta concreta → ejemplo de frase o acción → contexto de uso → CTA sencillo. Indicar la etapa: Maternal, Preescolar, Primaria o todas.', '§9'),
    ('evidence_rule', '{}', 'Invitaciones antes que afirmaciones', 'Las cápsulas se mantienen preferentemente en el terreno de invitaciones («prueben esta pregunta») y no de afirmaciones («esto desarrolla X»). Cuando una pieza haga una afirmación educativa, se entrega con su fuente citada.', '§9.1'),
    ('evidence_rule', '{}', 'Fórmula de evidencia', 'Qué hicieron → qué tuvieron oportunidad de practicar → por qué vale la pena observarlo.', '§2.5'),
    ('production_rule', '{}', 'Composición', 'Mucho espacio en blanco, un foco visual por escena, composición limpia. Firma institucional discreta al cierre.', '§7.2'),
    ('production_rule', '{}', 'Audiencia adulta', 'El colegio llega hasta sexto de primaria: nada debe sentirse de maternal ni «de caricatura infantil».', '§0.1'),
    ('production_rule', '{fully_graphic,real_plus_graphics,motion}', 'Interpretación, no lectura de la mente', 'Las preguntas, decisiones e ideas se vuelven visibles alrededor de las acciones. Se muestra una interpretación editorial del aprendizaje, nunca una lectura literal de la mente.', '§7.2'),
    ('production_rule', '{reel,motion}', 'Movimiento y lectura', 'Una acción principal por escena: aparecer, conectar, transformar o detenerse. No tapar rostros, trabajos ni la evidencia central con efectos. Texto breve por pantalla y tiempo suficiente para leerlo en un teléfono. Todo mensaje debe entenderse sin sonido.', '§7.3'),
    ('production_rule', '{carousel,editorial_carousel}', 'Carruseles sin numerar', 'Nunca numerar las láminas. Cada lámina lleva una ilustración grande (centro-abajo o tercio inferior) que puede quedar por encima de los trazos. Lámina por lámina: título, cuerpo, fondo, gráfico y layout.', '§7.2, §11.4'),
    ('production_rule', '{fully_graphic,motion}', 'Sincronía con la rejilla musical', 'En piezas con música, la imagen se ajusta a la rejilla musical, no al revés. Cada llegada importante (pregunta, revelado, logo) cae en un tiempo fuerte; el primer tiempo del compás es el ancla.', '§8.6'),
    ('production_rule', '{fully_graphic,motion}', 'Identidad sonora', 'Tesis: «un noticiero conducido por niños». La música corre sobre su propia rejilla; Mickey Mousing solo en textura. El jingle oficial resuelve (140 BPM, Do mayor); el logo aparece en el acorde final. Timbres descartados por sonar de caricatura: silbato de émbolo, boings, xilófono nota por letra, glockenspiel agudo, pizzicato seco, celesta aguda. Nivel de revisión −14 LUFS (hipótesis de trabajo).', '§8.7'),
    ('production_rule', '{fully_graphic,motion}', 'Storyboard de animación', 'Escena por escena: tiempo y compás, texto exacto, tipografía, posición, trazos, entrada, cámara, transición y sonido.', '§11.4'),
    ('production_rule', '{real_people,real_plus_graphics}', 'Voz en piezas reales', 'Orden de preferencia: (1) texto en pantalla; (2) voz en off grabada por Rodrigo; (3) docente diciendo como máximo dos líneas exactas, de hasta 14 palabras cada una, escritas por el equipo. Plan B: toda pieza real funciona solo con texto en pantalla. A estudiantes, sin pedir respuestas prefijadas.', '§11.4'),
    ('production_rule', '{real_people,real_plus_graphics}', 'Escaleta Vives', 'Guía general de captura para una visita de 15–20 minutos (momentos a buscar, dirección general de cámara y privacidad; sin tomas ni duraciones cerradas), preguntas detonadoras abiertas cuando aplique, líneas del docente y textos en pantalla exactos, estructura de edición por bloques, caption, texto alternativo, entregables y tiempo estimado.', '§11.4')
  ) as t(category, applies, title, content, locator) loop
    insert into public.brain_entries (brand_id, category, title, content, sort, source_reference_id, source_locator, applies_to)
    values (v_brand, r.category, r.title, r.content, i, v_src, 'Sistema Editorial ' || r.locator, r.applies);
    i := i + 10;
  end loop;

  insert into public.brain_entries (brand_id, category, title, content, sort, source_reference_id, applies_to)
  values (v_brand, 'production_rule', 'Movimiento subordinado a la claridad',
    'El movimiento nunca compite con la lectura: si un gesto dificulta entender el mensaje, se simplifica.', i, v_dec,
    array['fully_graphic', 'motion', 'real_plus_graphics']);

  -- Banco de ideas (§10): 62 ideas con sus IDs originales.
  insert into public.idea_library (brand_id, code, pillar_id, territory_id, title, summary, suggested_format, format_key,
    suggested_production_mode, production_level, requirement_kind, requirements, cta, source_reference_id, source_locator)
  select v_brand, t.code, p.id, te.id, t.title, t.summary, t.fmt, t.fk, t.mode, t.lvl, t.kind, t.req, t.cta, v_src,
         'Sistema Editorial §10, ' || t.pillar
  from (values
    ('01', 'P1', 'Proceso', 'Lo que hay detrás de una torre', 'Mostrar una decisión y un ajuste al construir', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'actividad pertinente, secuencia y voz docente', 'Mira qué cambiaron'),
    ('02', 'P1', 'Pensamiento', 'Antes de responder, probamos', 'Comparar una predicción con lo observado', 'Carrusel / A', 'carousel', null, 'A', 'R', 'exploración real y explicación validada', '¿Qué habrías observado?'),
    ('03', 'P1', 'Pensamiento', 'Una misma consigna, distintos caminos', 'Mostrar dos procesos sin jerarquizar', 'Carrusel / A', 'carousel', null, 'A', 'R', 'trabajos autorizados y contexto', 'Mira las diferencias'),
    ('04', 'P1', 'Humanidad', 'Del dibujo al relato', 'Alumno explica su obra, si desea participar', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'obra y voz autorizadas', 'Escucha cómo lo cuenta'),
    ('05', 'P1', 'Mundo', 'Una palabra en una conversación', 'Uso contextual de una palabra en inglés dentro de una actividad', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'clase y objetivo real; sistema bilingüe confirmado, detalles del programa pendientes', 'Observa cuándo la usa'),
    ('06', 'P1', 'Pensamiento', '¿Cómo llegaste a esa respuesta?', 'Mostrar una explicación, no solo el resultado', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'respuesta auténtica y revisión', 'Mira el proceso'),
    ('07', 'P1', 'Proceso', 'Lo que cambió entre dos versiones', 'Comparar un proyecto antes y después de un ajuste', 'Carrusel / A', 'carousel', null, 'A', 'R', 'versiones del mismo proceso', 'Encuentra el cambio'),
    ('08', 'P1', 'Humanidad', 'Una pregunta para quien acompaña', 'Docente explica qué busca observar', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'entrevista y ejemplo de apoyo', 'Conoce la intención'),
    ('09', 'P1', 'Pensamiento', 'Objetos que cuentan una clase', 'Tres objetos y su función en una experiencia', 'Carrusel / A', 'carousel', null, 'A', 'R', 'objetos y contexto confirmado', 'Desliza para descubrir'),
    ('10', 'P1', 'Pensamiento', '¿Qué pasa después del final?', 'Respuestas a una lectura compartida', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'actividad real; derechos del material', 'Imagina otra posibilidad'),
    ('11', 'P1', 'Proceso', 'Elegir también forma parte', 'Una elección permitida y su explicación', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'situación sin intervención para cámara', 'Observa qué eligieron'),
    ('12', 'P1', 'Pensamiento', 'El problema que cambió de forma', 'Cómo representaron un mismo problema', 'Carrusel / A', 'carousel', null, 'A', 'R', 'dibujos, objetos o esquemas reales', 'Sigue las representaciones'),
    ('13', 'P1', 'Humanidad', 'Escuchar otra idea', 'Cómo una propuesta entra a un trabajo común', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'secuencia contextualizada', 'Mira cómo la incorporaron'),
    ('14', 'P1', 'Pensamiento', 'Un material, dos pruebas', 'Comparar usos en una actividad validada', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'pruebas en condiciones apropiadas', 'Encuentra lo que cambió'),
    ('15', 'P1', 'Proceso', 'La pregunta que quedó abierta', 'Qué seguirán explorando, si está previsto', 'Foto + texto / A', 'static_post', null, 'A', 'R', 'pregunta registrada y continuidad confirmada', 'Acompaña la siguiente historia'),
    ('16', 'P2', 'Pensamiento', 'Así se ve una pregunta', 'Una interrogación abre caminos', 'Animación / C', 'motion', 'fully_graphic', 'C', 'I', 'tipografía y trazos', '¿Qué te da curiosidad?'),
    ('17', 'P2', 'Proceso', 'La línea que encontró otro camino', 'Un trazo toma una ruta distinta', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'plantilla de recorrido', 'Guarda esta idea'),
    ('18', 'P2', 'Pensamiento', 'Más de una forma', 'El mismo círculo inicia tres dibujos', 'Animación / C', 'motion', 'fully_graphic', 'C', 'I', 'dibujos originales', 'Imagina otra posibilidad'),
    ('19', 'P2', 'Humanidad', 'Un espacio para otra idea', 'Dos formas reorganizan una composición', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'metáfora de intercambio', 'Comparte la reflexión'),
    ('20', 'P2', 'Pensamiento', 'No todo empieza con una respuesta', 'Una tarjeta de respuesta se vuelve pregunta', 'Motion / B', 'motion', 'fully_graphic', 'B', 'I', 'texto breve', 'Haz una pregunta hoy'),
    ('21', 'P2', 'Proceso', 'El tamaño de un pequeño paso', 'Avances distintos sin podio ni carrera', 'Carrusel gráfico / A', 'carousel', null, 'A', 'I', 'no comparar ritmos infantiles', 'Reconoce un paso cotidiano'),
    ('22', 'P2', 'Humanidad', 'Pedir ayuda también abre caminos', 'Un recorrido conecta con otro', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'evitar glorificar autosuficiencia', 'Guarda la frase'),
    ('23', 'P2', 'Pensamiento', 'Una idea se puede explicar de varias maneras', 'Palabra, dibujo y gesto', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'recursos originales', 'Elige cómo la expresarías'),
    ('24', 'P2', 'Humanidad', 'La pausa también tiene lugar', 'Composición con espacio entre acciones', 'Motion / B', 'motion', 'fully_graphic', 'B', 'I', 'sin promesas de regulación emocional', 'Date un momento para mirar'),
    ('25', 'P2', 'Mundo', '¿Y si lo miramos desde otro lado?', 'Una forma revela otra silueta al girar', 'Animación / C', 'motion', 'fully_graphic', 'C', 'I', 'metáfora de perspectiva', 'Mira otra vez'),
    ('26', 'P2', 'Proceso', 'No salió como imaginabas', 'Un trazo inesperado se integra', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'no afirmar que todo error es beneficioso', 'Inventa otra forma'),
    ('27', 'P2', 'Humanidad', 'Palabras que abren una conversación', '“Cuéntame”, “muéstrame”, “te escucho”', 'Motion / B', 'motion', 'fully_graphic', 'B', 'I', 'invitación, no fórmula universal', 'Elige una para hoy'),
    ('28', 'P2', 'Humanidad', 'Cada aportación deja una forma', 'Piezas distintas construyen una imagen', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'metáfora de colaboración', 'Comparte la idea'),
    ('29', 'P2', 'Mundo', 'Lo que todavía queremos explorar', 'Puertas dibujadas conducen a preguntas', 'Carrusel / A', 'carousel', null, 'A', 'I', 'ilustraciones originales', 'Elige una pregunta'),
    ('30', 'P2', 'Proceso', 'Aprender a ser… también es un camino', 'Selección de metáforas del mes con una idea nueva', 'Motion / B', 'motion', 'fully_graphic', 'B', 'I', 'archivo propio', '¿Qué idea recuerdas?'),
    ('61', 'P2', 'Pensamiento', 'Disfrazarse también es imaginar', 'Una silueta neutra cambia de forma con trazos; invitación a imaginar ser otro', 'Animación / B', 'motion', 'fully_graphic', 'B', 'I', 'nueva en v1.1; sin atribuir beneficios de desarrollo; condicionada a postura sobre Halloween', '¿Qué imaginarías ser?'),
    ('31', 'P3', 'Humanidad', 'Otra pregunta después de “¿cómo te fue?”', 'Tres invitaciones concretas a conversar', 'Carrusel / A', 'carousel', null, 'A', 'V', 'fuente de comunicación, adaptar etapa', 'Guarda una para después'),
    ('32', 'P3', 'Humanidad', 'Describe lo que ves en su dibujo', 'Observaciones y preguntas sin interpretar emociones', 'Carrusel / A', 'carousel', null, 'A', 'V', 'ejemplos ficticios rotulados', 'Prueba una pregunta'),
    ('33', 'P3', 'Pensamiento', 'Un cuento, otro final', 'Inventar un desenlace juntos', 'Carrusel / A', 'carousel', null, 'A', 'I', 'cuento propio', 'Imaginen otro final'),
    ('34', 'P3', 'Humanidad', 'Un momento para escuchar', 'Escena cotidiana y respuesta de atención', 'Animación de plantilla / B', 'motion', 'fully_graphic', 'B', 'V', 'UNICEF comunicación', 'Elige un momento posible'),
    ('35', 'P3', 'Pensamiento', '¿Qué podemos hacer con esta caja?', 'Usos imaginarios sin compras', 'Carrusel / A', 'carousel', null, 'A', 'I', 'material seguro según etapa', 'Imaginen dos usos'),
    ('36', 'P3', 'Pensamiento', 'Una pregunta antes de explicar', '“¿Qué crees que sucede?”', 'Motion / B', 'motion', 'fully_graphic', 'B', 'V', 'sin retrasar ayuda necesaria', 'Prueben observar juntos'),
    ('37', 'P3', 'Mundo', 'Tres detalles para mirar en un paseo', 'Observación adaptable al entorno', 'Carrusel / A', 'carousel', null, 'A', 'I', 'accesibilidad y acompañamiento adulto', 'Elijan un detalle'),
    ('38', 'P3', 'Humanidad', 'Escuchar la historia de un objeto', 'Contar por qué eligió un objeto', 'Foto de objeto + texto / A', 'static_post', null, 'A', 'I', 'no pedir datos personales', 'Conversen en casa'),
    ('39', 'P3', 'Proceso', 'Una elección que sí está disponible', 'Dos opciones posibles, según etapa', 'Carrusel / A', 'carousel', null, 'A', 'V', 'sin prometer autonomía', 'Adapta una opción'),
    ('40', 'P3', 'Humanidad', 'Preparar algo juntos', 'Tarea compartida en lista visual', 'Carrusel / A', 'carousel', null, 'A', 'I/V', null, 'Elijan una tarea posible'),
    ('41', 'P3', 'Humanidad', 'Algo que noté hoy', 'Reconocer una acción específica', 'Motion o carrusel / A–B', null, null, 'A–B', 'V', 'UNICEF comunicación; evitar etiquetas', 'Nombra una acción'),
    ('42', 'P3', 'Pensamiento', 'Un juego que cabe en la conversación', 'Historia por turnos', 'Carrusel / A', 'carousel', null, 'A', 'I', 'distintas formas de comunicación', 'Prueben una ronda'),
    ('43', 'P3', 'Proceso', 'No hace falta terminar la conversación hoy', 'Invitación abierta sin exigir respuesta', 'Carrusel / A', 'carousel', null, 'A', 'V', null, 'Guarda la idea'),
    ('44', 'P3', 'Humanidad', '¿Qué te gustaría mostrarme?', 'Explicación elegida por el niño', 'Motion / B', 'motion', 'fully_graphic', 'B', 'I', 'participación voluntaria', 'Deja que elija'),
    ('45', 'P3', 'Humanidad', 'Una pregunta para el colegio', 'Formular dudas sobre una actividad', 'Carrusel / A', 'carousel', null, 'A', 'V', 'canal oficial confirmado', 'Envía tu pregunta por el canal indicado'),
    ('62', 'P3', 'Mundo', 'Una ofrenda para conversar', 'Elementos de la ofrenda como punto de partida para preguntas en familia', 'Carrusel o cápsula / A–B', null, null, 'A–B', 'V', 'nueva en v1.1; datos culturales con fuente; abordaje de la muerte revisado por Dirección Académica; segmentar por etapa', 'Elijan una pregunta para su ofrenda'),
    ('46', 'P4', 'Humanidad', 'Postales de una semana', 'Tres o cuatro escenas con un hilo común', 'Carrusel / A', 'carousel', null, 'A', 'R', 'selección autorizada', 'Comparte el recuerdo'),
    ('47', 'P4', 'Proceso', 'Antes de que empiece', 'Preparación de una experiencia confirmada', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'preparativos reales', 'Mira quién lo hizo posible'),
    ('48', 'P4', 'Humanidad', 'Las manos detrás de ese día', 'Reconocer tareas y personas de un evento', 'Carrusel / A', 'carousel', null, 'A', 'R', 'autorizaciones y créditos exactos', 'Agradece al equipo'),
    ('49', 'P4', 'Mundo', 'Un rincón con una historia', 'Uso real de un espacio', 'Foto + texto / A', 'static_post', null, 'A', 'R', 'información validada', 'Conoce su historia'),
    ('50', 'P4', 'Humanidad', 'Lo que construimos juntos', 'Aportaciones en una actividad colectiva', 'Carrusel / A', 'carousel', null, 'A', 'R', 'colaboración documentada', 'Reconoce una aportación'),
    ('51', 'P4', 'Humanidad', 'Un recuerdo contado por su protagonista', 'Testimonio breve voluntario', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'voz auténtica y autorización', 'Escucha el recuerdo'),
    ('52', 'P4', 'Humanidad', 'Detalles de un día especial', 'Un evento desde objetos y gestos', 'Carrusel / A', 'carousel', null, 'A', 'R', 'fecha y contexto confirmados', 'Mira los detalles'),
    ('53', 'P4', 'Mundo', 'Una tradición, explicada', 'Qué significa una costumbre real del colegio', 'Reel o carrusel / A–B', null, null, 'A–B', 'R', 'tradición y datos verificados', 'Conoce su significado'),
    ('54', 'P4', 'Humanidad', 'La comunidad también prepara', 'Colaboración familiar sin medir compromiso', 'Carrusel / A', 'carousel', null, 'A', 'R', 'participación real', 'Reconoce al equipo'),
    ('55', 'P4', 'Humanidad', 'Voces de quienes acompañan', 'Personal comparte una tarea de su día', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'nombre, cargo y cita confirmados', 'Conoce su trabajo'),
    ('56', 'P4', 'Pensamiento', 'Un trabajo que merece mirarse de cerca', 'Exposición editorial de una creación', 'Carrusel / A', 'carousel', null, 'A', 'R', 'obra, contexto y autoría cuidada', 'Mira el proceso'),
    ('57', 'P4', 'Humanidad', 'Un momento compartido, distintas miradas', 'Tres registros de un mismo evento', 'Carrusel / A', 'carousel', null, 'A', 'R', 'derechos de materiales', 'Revive ese momento'),
    ('58', 'P4', 'Humanidad', 'La pregunta que nos dejaron las familias', 'Responder una duda común', 'Gráfico + voz / B', null, null, 'B', 'R/V', 'pregunta real y respuesta validada', 'Consulta el canal oficial'),
    ('59', 'P4', 'Humanidad', 'Después del aplauso', 'Recogida, cuidado y colaboración al finalizar', 'Reel / B', 'reel', 'real_people', 'B', 'R', 'acciones espontáneas', 'Reconoce ese trabajo'),
    ('60', 'P4', 'Proceso', 'Tres momentos que queremos recordar', 'Cierre mensual por significado', 'Carrusel / A', 'carousel', null, 'A', 'R', 'archivo del mes', '¿Qué tema quisieras conocer después?')
  ) as t(code, pillar, territory, title, summary, fmt, fk, mode, lvl, kind, req, cta)
  left join public.brand_axes p on p.brand_id = v_brand and p.kind = 'pillar' and p.code = t.pillar
  left join public.brand_axes te on te.brand_id = v_brand and te.kind = 'territory' and te.name = t.territory;
end $$;
