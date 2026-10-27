-- Content OS V0.1 — registros manuales de publicación, espejos y fuentes.
-- Content OS no envía nada a ninguna plataforma: registra lo que el usuario confirma.

/** Bloquea la pieza de una publicación (orden pieza → publicación, igual que los comandos de pieza). */
create function app.lock_publication_piece(p_publication_id uuid) returns public.content_pieces
language plpgsql security definer set search_path = '' as $$
declare
  v_piece_id uuid;
begin
  select content_piece_id into v_piece_id from public.publications where id = p_publication_id;
  if not found then perform app.fail('Registro de publicación no encontrado', 'CO404'); end if;
  return app.lock_piece(v_piece_id);
end $$;

create function app.require_publishable(p_piece public.content_pieces, p_channel_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.has_current_approval(p_piece) then
    perform app.fail(case when p_piece.ownership = 'local'
      then 'La pieza no tiene una aprobación vigente (o está en hold/archivada)'
      else 'El espejo no tiene una observación aprobada de revisión completa' end, 'CO403');
  end if;
  if not exists (select 1 from public.accounts where id = p_piece.account_id and active) then
    perform app.fail('La cuenta está inactiva', 'CO403');
  end if;
  if not exists (
    select 1 from public.account_channels
     where account_id = p_piece.account_id and channel_id = p_channel_id and active
  ) then
    perform app.fail('El canal no está activo para esta cuenta', 'CO403');
  end if;
end $$;

create function app.require_unique_external_post(p_publication public.publications, p_piece public.content_pieces, p_external_post_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_external_post_id is null then return; end if;
  -- Serializa por cuenta para que dos registros concurrentes no compartan identificador.
  perform 1 from public.accounts where id = p_piece.account_id for update;
  if exists (
    select 1 from public.publications pub
    join public.content_pieces p on p.id = pub.content_piece_id
    where p.account_id = p_piece.account_id and pub.channel_id = p_publication.channel_id
      and pub.external_post_id = p_external_post_id and pub.id <> p_publication.id
  ) then
    perform app.fail('Ese identificador externo ya está registrado en esta cuenta y canal');
  end if;
end $$;

create function public.create_publication(p_request_id uuid, p_piece_id uuid, p_channel_key text, p_format text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_channel_id uuid;
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  select id into v_channel_id from public.channels where key = p_channel_key;
  if not found then perform app.fail('Canal desconocido'); end if;
  perform app.require_publishable(v_piece, v_channel_id);
  if exists (select 1 from public.publications
              where content_piece_id = p_piece_id and channel_id = v_channel_id and format = p_format) then
    perform app.fail('Ya existe un registro para ese canal y formato; si está cancelado, reábrelo');
  end if;
  insert into public.publications (content_piece_id, channel_id, format, record_kind)
  values (p_piece_id, v_channel_id, p_format,
          case when v_piece.ownership = 'local' then 'local_record' else 'source_observation' end)
  returning id into v_id;
  perform app.bump_version(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'publication_created', p_piece_id, v_id, null, null,
    jsonb_build_object('publication_id', v_id, 'piece_id', p_piece_id));
end $$;

create function public.record_schedule(
  p_request_id uuid, p_publication_id uuid, p_expected_version integer,
  p_scheduled_at timestamptz, p_confirmed boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_pub public.publications;
  v_piece public.content_pieces;
  v_week date;
  v_day date;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_publication_piece(p_publication_id);
  select * into v_pub from public.publications where id = p_publication_id for update;
  perform app.check_version(v_pub.version, p_expected_version);
  if not coalesce(p_confirmed, false) then
    perform app.fail('Confirma que ya programaste la publicación en la herramienta externa');
  end if;
  if v_pub.status not in ('unscheduled', 'scheduled') then
    perform app.fail('Solo se programa un registro sin programar o se reprograma uno programado', 'CO403');
  end if;
  perform app.require_publishable(v_piece, v_pub.channel_id);
  select week_start into v_week from public.planning_assignments where content_piece_id = v_piece.id;
  if v_week is null then perform app.fail('Asigna la pieza a una semana antes de registrar su programación'); end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    perform app.fail('La fecha de programación debe ser futura');
  end if;
  v_day := app.local_date(p_scheduled_at);
  if app.week_start(v_day) <> v_week then
    perform app.fail(format('La fecha debe caer en la semana asignada (%s); cambia la asignación de forma explícita si corresponde', v_week));
  end if;
  if not app.date_fits_timing(v_piece, v_day) then
    perform app.fail('La fecha no cumple el timing de la pieza');
  end if;
  update public.publications set status = 'scheduled', scheduled_at = p_scheduled_at, version = version + 1
   where id = p_publication_id;
  perform app.bump_version(v_piece.id);
  return app.log_event(p_request_id, v_uid,
    case when v_pub.status = 'scheduled' then 'publication_rescheduled' else 'publication_scheduled' end,
    v_piece.id, p_publication_id, null,
    jsonb_build_object('status', v_pub.status, 'scheduled_at', v_pub.scheduled_at),
    jsonb_build_object('publication_id', p_publication_id, 'scheduled_at', p_scheduled_at));
end $$;

create function public.record_published(
  p_request_id uuid, p_publication_id uuid, p_expected_version integer,
  p_published_at timestamptz, p_external_url text, p_external_post_id text, p_evidence_note text,
  p_confirmed boolean, p_move_assignment boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_pub public.publications;
  v_piece public.content_pieces;
  v_assignment public.planning_assignments;
  v_day date;
  v_moved boolean := false;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_publication_piece(p_publication_id);
  select * into v_pub from public.publications where id = p_publication_id for update;
  perform app.check_version(v_pub.version, p_expected_version);
  if not coalesce(p_confirmed, false) then
    perform app.fail('Confirma que la publicación ya ocurrió en la plataforma');
  end if;
  if v_pub.status not in ('unscheduled', 'scheduled') then
    perform app.fail('Este registro no admite confirmar publicación; usa la corrección explícita', 'CO403');
  end if;
  perform app.require_publishable(v_piece, v_pub.channel_id);
  if p_published_at is null or p_published_at > now() then
    perform app.fail('El instante de publicación no puede ser futuro');
  end if;
  if nullif(btrim(p_external_url), '') is null and nullif(btrim(p_evidence_note), '') is null then
    perform app.fail('Registra una URL o una nota de evidencia');
  end if;
  v_day := app.local_date(p_published_at);
  if not app.date_fits_timing(v_piece, v_day) then
    perform app.fail('La fecha real no cumple el timing de la pieza; ese caso requiere resolver el modelo con el propietario');
  end if;
  select * into v_assignment from public.planning_assignments where content_piece_id = v_piece.id for update;
  if v_assignment.id is null then
    perform app.fail('Asigna la pieza a una semana antes de registrar la publicación');
  end if;
  if app.week_start(v_day) <> v_assignment.week_start then
    if not coalesce(p_move_assignment, false) then
      perform app.fail(format('La publicación ocurrió fuera de la semana asignada (%s). Confirma la corrección para mover la asignación completa a la semana real', v_assignment.week_start));
    end if;
    if exists (select 1 from public.publications
                where content_piece_id = v_piece.id and id <> p_publication_id and status in ('published', 'scheduled')) then
      perform app.fail('Otros destinos de la pieza están programados o publicados en su semana; resuélvelos antes de corregir', 'CO403');
    end if;
    update public.planning_assignments set week_start = app.week_start(v_day), version = version + 1
     where id = v_assignment.id;
    v_moved := true;
  end if;
  perform app.require_unique_external_post(v_pub, v_piece, nullif(btrim(p_external_post_id), ''));

  update public.publications set
    status = 'published', published_at = p_published_at,
    external_url = nullif(btrim(p_external_url), ''),
    external_post_id = nullif(btrim(p_external_post_id), ''),
    evidence_note = nullif(btrim(p_evidence_note), ''),
    version = version + 1
  where id = p_publication_id;
  perform app.bump_version(v_piece.id);

  if v_moved then
    perform app.log_event(gen_random_uuid(), v_uid, 'assignment_corrected', v_piece.id, p_publication_id,
      'Publicación real fuera de la semana asignada: la unidad editorial cuenta en la semana real',
      jsonb_build_object('week_start', v_assignment.week_start),
      jsonb_build_object('week_start', app.week_start(v_day)));
  end if;
  return app.log_event(p_request_id, v_uid, 'publication_published', v_piece.id, p_publication_id, null,
    jsonb_build_object('status', v_pub.status, 'scheduled_at', v_pub.scheduled_at),
    jsonb_build_object('publication_id', p_publication_id, 'published_at', p_published_at,
      'approved_revision', v_piece.approved_revision, 'record_kind', v_pub.record_kind,
      'assignment_moved', v_moved));
end $$;

create function public.cancel_publication(p_request_id uuid, p_publication_id uuid, p_expected_version integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_pub public.publications;
  v_piece public.content_pieces;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_publication_piece(p_publication_id);
  select * into v_pub from public.publications where id = p_publication_id for update;
  perform app.check_version(v_pub.version, p_expected_version);
  if v_pub.status not in ('unscheduled', 'scheduled') then
    perform app.fail('Solo se cancela un registro sin programar o programado', 'CO403');
  end if;
  update public.publications set status = 'cancelled', scheduled_at = null, version = version + 1
   where id = p_publication_id;
  perform app.bump_version(v_piece.id);
  return app.log_event(p_request_id, v_uid, 'publication_cancelled', v_piece.id, p_publication_id,
    app.require_text(p_reason, 'El motivo'),
    jsonb_build_object('status', v_pub.status, 'scheduled_at', v_pub.scheduled_at),
    jsonb_build_object('publication_id', p_publication_id));
end $$;

create function public.reopen_publication(p_request_id uuid, p_publication_id uuid, p_expected_version integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_pub public.publications;
  v_piece public.content_pieces;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_publication_piece(p_publication_id);
  select * into v_pub from public.publications where id = p_publication_id for update;
  perform app.check_version(v_pub.version, p_expected_version);
  if v_pub.status <> 'cancelled' then perform app.fail('Solo se reabre un registro cancelado', 'CO403'); end if;
  perform app.require_publishable(v_piece, v_pub.channel_id);
  update public.publications set status = 'unscheduled', scheduled_at = null, version = version + 1
   where id = p_publication_id;
  perform app.bump_version(v_piece.id);
  return app.log_event(p_request_id, v_uid, 'publication_reopened', v_piece.id, p_publication_id,
    app.require_text(p_reason, 'El motivo'), jsonb_build_object('status', v_pub.status),
    jsonb_build_object('publication_id', p_publication_id));
end $$;

/** Corrección explícita de los hechos de una publicación confirmada, dentro de su semana. */
create function public.correct_publication(
  p_request_id uuid, p_publication_id uuid, p_expected_version integer,
  p_published_at timestamptz, p_external_url text, p_external_post_id text, p_evidence_note text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_pub public.publications;
  v_piece public.content_pieces;
  v_week date;
  v_day date;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_publication_piece(p_publication_id);
  select * into v_pub from public.publications where id = p_publication_id for update;
  perform app.check_version(v_pub.version, p_expected_version);
  if v_pub.status <> 'published' then perform app.fail('Solo se corrigen publicaciones confirmadas', 'CO403'); end if;
  perform app.require_text(p_reason, 'El motivo de la corrección');
  if p_published_at is null or p_published_at > now() then perform app.fail('El instante de publicación no puede ser futuro'); end if;
  if nullif(btrim(p_external_url), '') is null and nullif(btrim(p_evidence_note), '') is null then
    perform app.fail('Registra una URL o una nota de evidencia');
  end if;
  v_day := app.local_date(p_published_at);
  select week_start into v_week from public.planning_assignments where content_piece_id = v_piece.id;
  if app.week_start(v_day) <> v_week or not app.date_fits_timing(v_piece, v_day) then
    perform app.fail('La corrección debe mantenerse en la semana asignada y el timing de la pieza');
  end if;
  perform app.require_unique_external_post(v_pub, v_piece, nullif(btrim(p_external_post_id), ''));
  update public.publications set
    published_at = p_published_at, external_url = nullif(btrim(p_external_url), ''),
    external_post_id = nullif(btrim(p_external_post_id), ''), evidence_note = nullif(btrim(p_evidence_note), ''),
    version = version + 1
  where id = p_publication_id;
  perform app.bump_version(v_piece.id);
  return app.log_event(p_request_id, v_uid, 'publication_corrected', v_piece.id, p_publication_id, p_reason,
    jsonb_build_object('published_at', v_pub.published_at, 'external_url', v_pub.external_url,
      'external_post_id', v_pub.external_post_id, 'evidence_note', v_pub.evidence_note),
    jsonb_build_object('publication_id', p_publication_id, 'published_at', p_published_at));
end $$;

-- Referencias contextuales y espejos ------------------------------------

create function public.create_context_reference(
  p_request_id uuid, p_scope_kind text, p_account_id uuid, p_brand_id uuid,
  p_source_system text, p_title text, p_source_url text, p_locator text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  if nullif(btrim(p_source_url), '') is null and nullif(btrim(p_locator), '') is null then
    perform app.fail('Indica un enlace o un localizador de la fuente');
  end if;
  insert into public.source_references
    (relation_kind, scope_kind, account_id, brand_id, source_system, title, source_url, locator)
  values
    ('context_reference', p_scope_kind,
     case when p_scope_kind = 'account' then p_account_id end,
     case when p_scope_kind = 'brand' then p_brand_id end,
     p_source_system, app.require_text(p_title, 'El título'),
     nullif(btrim(p_source_url), ''), nullif(btrim(p_locator), ''))
  returning id into v_id;
  return app.log_event(p_request_id, v_uid, 'context_reference_created', null, null, null, null,
    jsonb_build_object('source_reference_id', v_id));
end $$;

create function public.create_external_mirror(
  p_request_id uuid, p_account_id uuid, p_title text, p_bucket text,
  p_source_system text, p_source_entity_type text, p_source_entity_id text,
  p_source_url text, p_locator text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece_id uuid;
  v_ref_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  if p_source_system = 'manual' then perform app.fail('Un espejo requiere el sistema fuente propietario'); end if;
  perform 1 from public.accounts where id = p_account_id and active for share;
  if not found then perform app.fail('La cuenta no existe o está inactiva'); end if;
  insert into public.content_pieces (account_id, title, bucket, ownership, production_status)
  values (p_account_id, app.require_text(p_title, 'El título'), p_bucket, 'external', null)
  returning id into v_piece_id;
  insert into public.source_references
    (content_piece_id, account_id, relation_kind, scope_kind, source_system, source_entity_type,
     source_entity_id, source_url, title, locator)
  values
    (v_piece_id, p_account_id, 'external_mirror', 'account', p_source_system,
     app.require_text(p_source_entity_type, 'El tipo de objeto fuente'),
     app.require_text(p_source_entity_id, 'El identificador fuente'),
     nullif(btrim(p_source_url), ''), btrim(p_title), nullif(btrim(p_locator), ''))
  returning id into v_ref_id;
  return app.log_event(p_request_id, v_uid, 'external_mirror_created', v_piece_id, null, null, null,
    jsonb_build_object('piece_id', v_piece_id, 'source_reference_id', v_ref_id));
end $$;

create function public.record_source_observation(
  p_request_id uuid, p_piece_id uuid, p_source_state_raw text, p_observed_status text,
  p_review_complete_confirmed boolean, p_observed_on_hold boolean, p_observed_at timestamptz, p_evidence_note text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_ref_id uuid;
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  if v_piece.ownership <> 'external' then
    perform app.fail('Las observaciones solo aplican a espejos externos', 'CO403');
  end if;
  select id into v_ref_id from public.source_references
   where content_piece_id = p_piece_id and relation_kind = 'external_mirror';
  if p_observed_at is null or p_observed_at > now() then
    perform app.fail('La fecha de observación no puede ser futura');
  end if;
  if coalesce(p_review_complete_confirmed, false) and p_observed_status is distinct from 'approved' then
    perform app.fail('La revisión completa solo se confirma sobre un estado aprobado');
  end if;
  insert into public.source_observations
    (source_reference_id, source_state_raw, observed_status, review_complete_confirmed, observed_on_hold,
     observed_at, recorded_by, evidence_note, request_id)
  values
    (v_ref_id, app.require_text(p_source_state_raw, 'El estado tal como aparece en la fuente'),
     nullif(p_observed_status, ''), coalesce(p_review_complete_confirmed, false),
     coalesce(p_observed_on_hold, false), p_observed_at, v_uid, nullif(btrim(p_evidence_note), ''), p_request_id)
  returning id into v_id;
  perform app.bump_version(p_piece_id);
  return jsonb_build_object('ok', true, 'replayed', false, 'observation_id', v_id, 'piece_id', p_piece_id);
end $$;

-- Grants: solo usuarios autenticados invocan comandos; cada uno revalida allowlist.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, n.nspname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'app')
       and p.proowner = current_user::regrole
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.nspname = 'public' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
  -- Necesarias para RLS y CHECK constraints evaluadas como el rol de la API.
  grant execute on function app.is_authorized() to anon, authenticated;
  grant execute on function app.is_http_url(text) to anon, authenticated;
  grant execute on function app.has_text(text) to anon, authenticated;
end $$;
