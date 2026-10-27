-- DATOS FICTICIOS DE DESARROLLO. Nunca aplicar en producción.
-- Requiere un usuario ya provisionado en authorized_users (activo).
-- Todo lo creado lleva el prefijo «[DEMO]». Fechas relativas a la semana actual
-- en America/Mexico_City. Escritura directa como owner: solo para preparar datos.
do $$
declare
  v_uid uuid;
  w0 date := app.week_start(app.local_date(now()));
  w1 date := w0 + 7;
  b uuid := gen_random_uuid();
  a_cov uuid := gen_random_uuid();   -- COVERED
  a_risk uuid := gen_random_uuid();  -- AT_RISK
  a_gap uuid := gen_random_uuid();   -- GAP
  a_none uuid := gen_random_uuid();  -- sin objetivo
  ig uuid;
  fb uuid;
  p uuid;
  ref uuid;
  i int;
begin
  select user_id into v_uid from public.authorized_users where active limit 1;
  if v_uid is null then
    raise notice 'Seed omitido: no hay usuario autorizado activo.';
    return;
  end if;
  if exists (select 1 from public.brands where slug = 'demo') then
    raise notice 'Seed omitido: ya existe la marca demo.';
    return;
  end if;
  select id into ig from public.channels where key = 'instagram';
  select id into fb from public.channels where key = 'facebook';

  insert into public.brands (id, name, slug) values (b, '[DEMO] Marca ficticia', 'demo');
  insert into public.accounts (id, brand_id, name, slug, coverage_mode) values
    (a_cov, b, '[DEMO] Cuenta cubierta', 'demo-cubierta', 'weekly'),
    (a_risk, b, '[DEMO] Cuenta en riesgo', 'demo-riesgo', 'weekly'),
    (a_gap, b, '[DEMO] Cuenta con gap', 'demo-gap', 'weekly'),
    (a_none, b, '[DEMO] Cuenta sin objetivo', 'demo-sin-objetivo', 'unconfigured');
  insert into public.account_channels (account_id, channel_id)
    select a, c from unnest(array[a_cov, a_risk, a_gap, a_none]) a, unnest(array[ig, fb]) c;
  insert into public.editorial_targets (account_id, bucket, required_count, buffer_target_days, active_from) values
    (a_cov, 'feed', 2, 7, w0), (a_risk, 'feed', 2, 7, w0), (a_gap, 'feed', 3, 7, w0);

  -- Cuenta cubierta: W0 con una publicada en IG+FB y otra aprobada; W1 con dos aprobadas.
  for i in 1..4 loop
    insert into public.content_pieces (id, account_id, title, bucket, production_status, content_revision, approved_revision, approved_at, objective, audience)
    values (gen_random_uuid(), a_cov, format('[DEMO] Aprobada %s', i), 'feed', 'approved', 1, 1, now(), 'Demo', 'Demo')
    returning id into p;
    insert into public.planning_assignments (content_piece_id, week_start) values (p, case when i <= 2 then w0 else w1 end);
    if i = 1 then
      insert into public.publications (content_piece_id, channel_id, format, status, published_at, external_url)
      values (p, ig, 'post', 'published', greatest(now() - interval '1 minute', (w0::timestamp at time zone 'America/Mexico_City')), 'https://example.com/demo-ig'),
             (p, fb, 'post', 'unscheduled', null, null);
      update public.content_pieces set title = '[DEMO] Publicada en IG, FB pendiente' where id = p;
    end if;
  end loop;

  -- Reserva no asignada (cuenta cubierta).
  insert into public.content_pieces (account_id, title, bucket, production_status, content_revision, approved_revision, approved_at)
  values (a_cov, '[DEMO] Reserva flexible aprobada', 'feed', 'approved', 1, 1, now());

  -- Cuenta en riesgo: W0 una aprobada + una en revisión con claim bloqueante.
  insert into public.content_pieces (id, account_id, title, bucket, production_status, content_revision, approved_revision, approved_at)
  values (gen_random_uuid(), a_risk, '[DEMO] Aprobada en riesgo', 'feed', 'approved', 1, 1, now()) returning id into p;
  insert into public.planning_assignments (content_piece_id, week_start) values (p, w0);
  insert into public.content_pieces (id, account_id, title, bucket, production_status, objective, audience, production_spec_text)
  values (gen_random_uuid(), a_risk, '[DEMO] En revisión con claim pendiente', 'feed', 'in_review', 'Demo', 'Demo', 'Spec demo') returning id into p;
  insert into public.planning_assignments (content_piece_id, week_start) values (p, w0);
  insert into public.review_packets (content_piece_id, experience, words, claims_checked, dependencies_checked)
  values (p, 'Experiencia demo', '{"hook":"Gancho demo"}', true, true);
  insert into public.claims (content_piece_id, statement, claim_kind) values (p, '[DEMO] Dato sin verificar', 'fact');

  -- Cuenta con gap: una aprobada con programación vencida (sale de SAFE) y una idea.
  insert into public.content_pieces (id, account_id, title, bucket, production_status, content_revision, approved_revision, approved_at)
  values (gen_random_uuid(), a_gap, '[DEMO] Programación vencida sin confirmar', 'feed', 'approved', 1, 1, now()) returning id into p;
  insert into public.planning_assignments (content_piece_id, week_start) values (p, w0);
  insert into public.publications (content_piece_id, channel_id, format, status, scheduled_at)
  values (p, ig, 'reel', 'scheduled', now() - interval '2 hours');
  insert into public.content_pieces (account_id, title, bucket, production_status)
  values (a_gap, '[DEMO] Idea sin planificar', 'feed', 'idea');

  -- Espejo externo con observación de aprobación parcial (no cuenta en SAFE).
  insert into public.content_pieces (id, account_id, title, bucket, ownership, production_status)
  values (gen_random_uuid(), a_gap, '[DEMO] Espejo externo', 'feed', 'external', null) returning id into p;
  insert into public.planning_assignments (content_piece_id, week_start) values (p, w1);
  insert into public.source_references (id, content_piece_id, account_id, relation_kind, scope_kind, source_system, source_entity_type, source_entity_id, title, locator)
  values (gen_random_uuid(), p, a_gap, 'external_mirror', 'account', 'manual', 'demo_piece', 'DEMO-1', '[DEMO] Espejo externo', 'Fixture ficticio')
  returning id into ref;
  insert into public.source_observations (source_reference_id, source_state_raw, observed_status, review_complete_confirmed, observed_at, recorded_by, evidence_note, request_id)
  values (ref, '[DEMO] audiovisual aprobado; caption pendiente', 'approved', false, now() - interval '1 hour', v_uid, 'Fixture ficticio', gen_random_uuid());

  raise notice 'Seed demo cargado (marca slug demo).';
end $$;
