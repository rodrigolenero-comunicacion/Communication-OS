-- Content OS V0.3 — carga inicial del Client Brain (solo clientes existentes por slug).
-- Contenido tomado EXCLUSIVAMENTE de la instrucción del propietario «V0.3 Client Brain +
-- Sources» (2026-10-31). Los documentos IJLV v1.4 y Solotu_Cerebro no están en el
-- repositorio: sus fuentes lo indican en `notes`. No se infiere información faltante.

create function app.seed_entry(
  p_brand uuid, p_source uuid, p_category text, p_key text, p_title text, p_content text,
  p_sort integer, p_provisional boolean default false
) returns void
language sql set search_path = '' as $$
  insert into public.brain_entries (brand_id, category, key, title, content, sort, provisional, source_reference_id)
  values (p_brand, p_category, p_key, p_title, p_content, p_sort, p_provisional, p_source)
$$;

do $$
declare
  v_brand uuid;
  v_src uuid;
  v_old uuid;
  v_hub uuid;
  v_dec uuid;
  v_d3 uuid;
  i integer;
  r record;
  v_title text;
begin
  ---------------------------------------------------------------- IJLV
  select id into v_brand from public.brands where slug = 'ijlv';
  if v_brand is not null then
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type,
      document_name, document_version, published_at, status, notes, locator)
    values ('context_reference', 'brand', v_brand, 'ijlv_editorial', 'Sistema Editorial Creativo IJLV v1.4', 'Instituto Juan Luis Vives',
      'institutional_document', 'Sistema Editorial Creativo IJLV', '1.4', '2026-10-27', 'active',
      'Fuente editorial vigente (D2). Documento no incorporado al repositorio: las entradas se cargaron según la instrucción del propietario de V0.3 (2026-10-31), sin cotejo contra el documento.',
      'Documento v1.4 (pendiente de subir al repositorio)')
    returning id into v_src;
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type,
      document_name, document_version, published_at, status, notes, locator)
    values ('context_reference', 'brand', v_brand, 'ijlv_editorial', 'Sistema Editorial Creativo IJLV v1.2', 'Instituto Juan Luis Vives',
      'institutional_document', 'Sistema Editorial Creativo IJLV', '1.2', '2026-10-16', 'superseded',
      'Reemplazada por la v1.4 (D2). Se conserva como evidencia histórica.', 'docs/reference/systems/IJLV_SISTEMA_EDITORIAL_v1.2.md')
    returning id into v_old;

    perform app.seed_entry(v_brand, v_src, 'identity', 'campaign', 'Campaña madre', 'Aprender a ser', 10);
    perform app.seed_entry(v_brand, v_src, 'identity', 'motto', 'Lema', 'Educando con amor', 20);
    perform app.seed_entry(v_brand, v_src, 'strategy', 'principle', 'Principio editorial', 'Hacer visible lo que se aprende', 10);
    perform app.seed_entry(v_brand, v_src, 'strategy', 'formula', 'Fórmula editorial central',
      'Escena real → qué tuvieron oportunidad de practicar → reflexión breve. La actividad real funciona como evidencia; la filosofía educativa funciona como cierre.', 20);
    perform app.seed_entry(v_brand, v_src, 'editorial_rule', 'one_pillar_one_territory', 'Un pilar y un territorio principal por pieza',
      'Cada pieza utiliza un pilar principal y un territorio principal. No confundir pilares con territorios.', 10);
    perform app.seed_entry(v_brand, v_src, 'editorial_rule', 'adult_gaze', 'Mirada adulta',
      'Las piezas se diseñan para mirada adulta. No deben sentirse como contenido infantil.', 20);

    perform app.seed_entry(v_brand, v_src, 'audience', 'primary', 'Audiencia primaria', 'Madres, padres y cuidadores actuales.', 10);
    perform app.seed_entry(v_brand, v_src, 'audience', 'secondary', 'Audiencia secundaria', 'Familias que consideran opciones educativas.', 20);

    i := 10;
    foreach v_title in array array['Maternal', 'Preescolar', 'Primaria', 'Todas'] loop
      perform app.seed_entry(v_brand, v_src, 'segment', lower(v_title), v_title,
        'Etapa como segmentación editorial (no es una cuenta). Las recomendaciones educativas se ajustan a la etapa.', i);
      i := i + 10;
    end loop;

    i := 10;
    for r in select * from (values
      ('Actividad real', 'Una actividad real permite comunicar lo ocurrido y la intención; no permite afirmar dominio universal de una habilidad.'),
      ('Explicación docente', 'Una explicación docente validada contextualiza.'),
      ('Testimonio', 'Un testimonio individual no representa a todas las familias.'),
      ('Documento institucional', 'Un documento institucional expresa filosofía; no es prueba práctica.'),
      ('Fuente educativa externa', 'Una fuente educativa externa contextualiza; no demuestra resultados del IJLV.'),
      ('Información externa en piezas', 'Cuando una pieza use información externa debe conservar título, institución, URL, fecha de consulta, claim que respalda y crédito en pantalla.')
    ) as t(title, content) loop
      perform app.seed_entry(v_brand, v_src, 'evidence_rule', null, r.title, r.content, i);
      i := i + 10;
    end loop;

    perform app.seed_entry(v_brand, v_src, 'review_rule', 'creative_invitation', 'Invitación creativa', 'Requiere revisión editorial.', 10);
    perform app.seed_entry(v_brand, v_src, 'review_rule', 'general_guidance', 'Orientación educativa general', 'Requiere fuente + revisión de Dirección Académica.', 20);
    perform app.seed_entry(v_brand, v_src, 'review_rule', 'sensitive_topic', 'Tema sensible o especializado', 'Requiere Dirección Académica + posible profesional pertinente.', 30);

    i := 10;
    for r in select * from (values
      ('Personas reales: naturalidad', 'En piezas con personas reales priorizar la naturalidad.'),
      ('No guionizar a los niños', 'No guionizar respuestas de niños.'),
      ('Plan B', 'Plan B con texto en pantalla.'),
      ('Guía de captura', 'Las piezas reales llevan guía de captura.'),
      ('Animación', 'Animación vía HTML/SVG/canvas.'),
      ('Referencias de lenguaje', 'P03 y P20 son referencias de lenguaje, no plantillas para copiar.'),
      ('Diseño sonoro', 'Diseño sonoro propio por pieza.'),
      ('Lectura', 'Lectura mínima aproximada de dos compases por frase.'),
      ('Figuras con significado', 'Las figuras gráficas deben tener significado.'),
      ('Trazos y texto', 'Los trazos nunca van encima del texto.')
    ) as t(title, content) loop
      perform app.seed_entry(v_brand, v_src, 'production_rule', null, r.title, r.content, i);
      i := i + 10;
    end loop;

    -- Pilares y territorios en brand_axes (sin duplicar), confirmados por v1.4.
    insert into public.brand_axes (brand_id, kind, code, name, sort, provisional, source_note, source_reference_id)
    select v_brand, a.kind, a.code, a.name, a.sort, false, 'Sistema Editorial Creativo IJLV v1.4 (según instrucción del propietario, V0.3)', v_src
    from (values
      ('pillar', 'P1', 'Aquí aprendemos', 10), ('pillar', 'P2', 'Pequeños grandes pasos', 20),
      ('pillar', 'P3', 'Crecer juntos', 30), ('pillar', 'P4', 'La vida en el Vives', 40),
      ('territory', null, 'Humanidad', 10), ('territory', null, 'Pensamiento', 20),
      ('territory', null, 'Proceso', 30), ('territory', null, 'Mundo', 40)
    ) as a(kind, code, name, sort)
    on conflict do nothing;
  end if;

  ---------------------------------------------------------------- Tec
  select id into v_brand from public.brands where slug = 'tec';
  if v_brand is not null then
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type, status, notes, locator)
    values ('context_reference', 'brand', v_brand, 'st_hub', 'Communication Hub (ST Hub)', 'Tecnológico de Monterrey', 'internal_system', 'active',
      'Fuente de verdad operativa: eventos, coberturas, storytellers, asignaciones, entregas y revisión operativa. Content OS no copia su contenido.',
      'docs/reference/systems/ST_HUB_MANUAL_2026-10-27.md')
    returning id into v_hub;
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, source_type, status, notes)
    values ('context_reference', 'brand', v_brand, 'manual', 'Decisiones editoriales del propietario (Tec)', 'decision', 'active',
      'Reglas editoriales conocidas indicadas por el propietario en la instrucción V0.3 (2026-10-31).')
    returning id into v_dec;
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, source_type, status, notes)
    values ('context_reference', 'brand', v_brand, 'manual', 'Ejes Tec indicados por el propietario (D3)', 'decision', 'provisional',
      'Pendiente de validar contra fuente institucional vigente del Tec.')
    returning id into v_d3;
    update public.brand_axes set source_reference_id = v_d3 where brand_id = v_brand and provisional;

    perform app.seed_entry(v_brand, v_hub, 'constraint', 'communication_hub_boundary', 'Frontera con Communication Hub',
      'Communication Hub sigue siendo la fuente de verdad operativa para eventos, coberturas, storytellers, asignaciones, entregas y revisión operativa. Content OS representa piezas editoriales y no copia ese contenido.', 10);

    i := 10;
    for r in select * from (values
      ('voice', 'Tono institucional'), ('voice', 'Contemporáneo'), ('voice', 'Aspiracional'), ('voice', 'Cercano'),
      ('voice', 'Voz de comunidad / institución'),
      ('editorial_rule', 'Evitar la primera persona singular institucional'),
      ('editorial_rule', 'Evitar clichés genéricos'),
      ('editorial_rule', 'No describir literalmente lo que ya muestra la pieza'),
      ('editorial_rule', 'El copy debe aportar contexto, significado o reflexión'),
      ('editorial_rule', 'Evitar CTA de captación o admisiones no autorizados'),
      ('editorial_rule', 'Evitar «hoy» / «ayer» cuando resten flexibilidad'),
      ('editorial_rule', 'Cierres ligados al tema'),
      ('editorial_rule', 'Foco en comunidad antes que protagonismo individual, cuando corresponda')
    ) as t(category, title) loop
      perform app.seed_entry(v_brand, v_dec, r.category, null, r.title, null, i);
      i := i + 10;
    end loop;
  end if;

  ---------------------------------------------------------------- Solotu.IA
  select id into v_brand from public.brands where slug = 'solotu';
  if v_brand is not null then
    insert into public.source_references (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type, status, notes)
    values ('context_reference', 'brand', v_brand, 'solotu_cerebro', 'Solotu_Cerebro', 'Solotu.IA', 'internal_system', 'active',
      'Fuente empresarial vigente; Content OS no mantiene un segundo Cerebro. Solotu_Contexto_v2.md no recibido: los extractos se cargaron según la instrucción del propietario de V0.3 (2026-10-31), sin cotejo contra el documento.')
    returning id into v_src;

    perform app.seed_entry(v_brand, v_src, 'identity', 'positioning', 'Posicionamiento', 'Inteligencia empresarial + IA para PyMEs.', 10);
    perform app.seed_entry(v_brand, v_src, 'strategy', 'anchor_product', 'Producto ancla', 'Diagnóstico de IA.', 10);
    perform app.seed_entry(v_brand, v_src, 'strategy', 'service_flow', 'Flujo de servicio',
      'Diagnóstico → propuesta → implementación → capacitación → seguimiento.', 20);
    perform app.seed_entry(v_brand, v_src, 'audience', 'primary', 'Audiencia principal', 'Dueños, directores y tomadores de decisión de PyMEs.', 10);
    perform app.seed_entry(v_brand, v_src, 'constraint', 'single_source', 'Solotu_Cerebro es la fuente empresarial',
      'Content OS consume o representa contexto editorial derivado del Cerebro; no lo duplica ni lo contradice.', 10);
    perform app.seed_entry(v_brand, v_src, 'evidence_rule', 'claims_need_source', 'Claims con fuente',
      'No publicar precios, porcentajes, resultados, capacidades, sectores ni promesas sin fuente. Distinguir hecho, estimación, supuesto y propuesta.', 10);
  end if;
end $$;

drop function app.seed_entry(uuid, uuid, text, text, text, text, integer, boolean);
