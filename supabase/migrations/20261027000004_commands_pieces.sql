-- Content OS V0.1 — comandos de piezas, revisión y planeación semanal.

-- Helpers de pieza ----------------------------------------------------------

create function app.lock_piece(p_piece_id uuid) returns public.content_pieces
language plpgsql security definer set search_path = '' as $$
declare
  v_piece public.content_pieces;
begin
  select * into v_piece from public.content_pieces where id = p_piece_id for update;
  if not found then perform app.fail('Pieza no encontrada', 'CO404'); end if;
  return v_piece;
end $$;

create function app.latest_observation(p_piece_id uuid) returns public.source_observations
language sql stable security definer set search_path = '' as $$
  select o.* from public.source_observations o
  join public.source_references r on r.id = o.source_reference_id
  where r.content_piece_id = p_piece_id and r.relation_kind = 'external_mirror'
  order by o.observed_at desc, o.recorded_at desc, o.id desc
  limit 1
$$;

/** Aprobación vigente (local) u observación aprobada de la pieza completa (espejo). */
create function app.has_current_approval(p_piece public.content_pieces) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_obs public.source_observations;
begin
  if p_piece.archived_at is not null then return false; end if;
  if p_piece.ownership = 'local' then
    return p_piece.production_status = 'approved'
       and p_piece.approved_revision = p_piece.content_revision
       and not p_piece.on_hold;
  end if;
  v_obs := app.latest_observation(p_piece.id);
  return v_obs.id is not null and v_obs.observed_status = 'approved'
     and v_obs.review_complete_confirmed and not v_obs.observed_on_hold;
end $$;

create function app.date_fits_timing(p_piece public.content_pieces, p_date date) returns boolean
language sql immutable set search_path = '' as $$
  select case p_piece.timing_mode
    when 'fixed' then p_date = p_piece.fixed_date
    when 'window' then p_date between p_piece.valid_from and p_piece.valid_until
    else true
  end
$$;

create function app.week_fits_timing(p_piece public.content_pieces, p_week date) returns boolean
language sql immutable set search_path = '' as $$
  select case p_piece.timing_mode
    when 'fixed' then app.week_start(p_piece.fixed_date) = p_week
    when 'window' then p_piece.valid_from <= p_week + 6 and p_week <= p_piece.valid_until
    else true
  end
$$;

create function app.has_publication(p_piece_id uuid, p_statuses text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.publications where content_piece_id = p_piece_id and status = any (p_statuses))
$$;

/** Edición material: pieza local, no archivada, estado editable y sin publicación confirmada. */
create function app.require_material_editable(p_piece public.content_pieces) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_piece.ownership <> 'local' then
    perform app.fail('El contenido de un espejo externo se edita en su sistema fuente', 'CO403');
  end if;
  if p_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;
  if app.has_publication(p_piece.id, array['published']) then
    perform app.fail('La pieza ya se publicó: crea una pieza nueva para una variante editorial', 'CO403');
  end if;
  if p_piece.production_status = 'approved' then
    perform app.fail('La pieza está aprobada: reábrela para editar su contenido', 'CO403');
  end if;
  if p_piece.production_status = 'in_review' then
    perform app.fail('La pieza está en revisión: pide cambios para poder editarla', 'CO403');
  end if;
end $$;

create function app.bump_revision(p_piece_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.content_pieces
     set content_revision = content_revision + 1, version = version + 1
   where id = p_piece_id
$$;

create function app.bump_version(p_piece_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.content_pieces set version = version + 1 where id = p_piece_id
$$;

/** Instantánea del paquete evaluado: textos, spec, claims y dependencias. */
create function app.piece_snapshot(p_piece_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'piece', (select jsonb_build_object(
        'title', p.title, 'bucket', p.bucket, 'content_type', p.content_type,
        'objective', p.objective, 'audience', p.audience, 'editorial_role', p.editorial_role,
        'campaign', p.campaign, 'timing_mode', p.timing_mode, 'fixed_date', p.fixed_date,
        'valid_from', p.valid_from, 'valid_until', p.valid_until,
        'production_spec_text', p.production_spec_text, 'production_spec_url', p.production_spec_url,
        'content_revision', p.content_revision)
      from public.content_pieces p where p.id = p_piece_id),
    'packet', (select to_jsonb(rp) - 'version' - 'created_at' - 'updated_at'
      from public.review_packets rp where rp.content_piece_id = p_piece_id),
    'claims', coalesce((select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by c.created_at, c.id)
      from public.claims c where c.content_piece_id = p_piece_id), '[]'::jsonb),
    'dependencies', coalesce((select jsonb_agg(to_jsonb(d) - 'created_at' - 'updated_at' order by d.created_at, d.id)
      from public.approval_dependencies d where d.content_piece_id = p_piece_id), '[]'::jsonb)
  )
$$;

/** Requisitos del Review Packet básico para enviar a revisión. */
create function app.packet_gaps(p_piece_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_piece public.content_pieces;
  v_packet public.review_packets;
  v_gaps text[] := '{}';
begin
  select * into v_piece from public.content_pieces where id = p_piece_id;
  select * into v_packet from public.review_packets where content_piece_id = p_piece_id;
  if coalesce(btrim(v_piece.objective), '') = '' then v_gaps := array_append(v_gaps, 'Falta el objetivo'); end if;
  if coalesce(btrim(v_piece.audience), '') = '' then v_gaps := array_append(v_gaps, 'Falta la audiencia'); end if;
  if coalesce(btrim(v_piece.production_spec_text), '') = '' and v_piece.production_spec_url is null then
    v_gaps := array_append(v_gaps, 'Falta la Production Spec (texto o enlace)');
  end if;
  if v_packet.content_piece_id is null then
    return array_append(v_gaps, 'Falta el Review Packet');
  end if;
  if coalesce(btrim(v_packet.experience), '') = '' then v_gaps := array_append(v_gaps, 'Falta describir la experiencia'); end if;
  if not exists (
    select 1 from jsonb_each_text(v_packet.words) w where length(btrim(w.value)) > 0
  ) then
    v_gaps := array_append(v_gaps, 'Falta al menos un texto crítico (Words)');
  end if;
  if not v_packet.claims_checked then v_gaps := array_append(v_gaps, 'Confirma la revisión de claims (o que no aplican)'); end if;
  if not v_packet.dependencies_checked then v_gaps := array_append(v_gaps, 'Confirma la revisión de dependencias (o que no aplican)'); end if;
  return v_gaps;
end $$;

/** Impedimentos de aprobación: packet incompleto, claims no soportados, dependencias pendientes. */
create function public.approval_blockers(p_piece_id uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v_gaps text[];
begin
  perform app.require_user();
  v_gaps := app.packet_gaps(p_piece_id);
  v_gaps := v_gaps || coalesce((
    select array_agg('Claim sin soporte verificado: ' || left(c.statement, 80) order by c.created_at)
      from public.claims c
     where c.content_piece_id = p_piece_id and c.verification_status <> 'supported'), '{}');
  v_gaps := v_gaps || coalesce((
    select array_agg('Dependencia pendiente: ' || d.label order by d.created_at)
      from public.approval_dependencies d
     where d.content_piece_id = p_piece_id and d.required and d.status = 'pending'), '{}');
  return v_gaps;
end $$;

-- Crear y editar ----------------------------------------------------------

create function public.create_piece(
  p_request_id uuid, p_account_id uuid, p_title text, p_bucket text,
  p_timing_mode text, p_fixed_date date, p_valid_from date, p_valid_until date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  perform 1 from public.accounts where id = p_account_id and active for share;
  if not found then perform app.fail('La cuenta no existe o está inactiva'); end if;
  insert into public.content_pieces
    (account_id, title, bucket, ownership, production_status, timing_mode, fixed_date, valid_from, valid_until)
  values
    (p_account_id, app.require_text(p_title, 'Título'), p_bucket, 'local', 'idea',
     coalesce(p_timing_mode, 'flexible'), p_fixed_date, p_valid_from, p_valid_until)
  returning id into v_id;
  return app.log_event(p_request_id, v_uid, 'piece_created', v_id, null, null, null,
    jsonb_build_object('piece_id', v_id));
end $$;

/**
 * Edición de campos de la pieza. Materiales (incrementan revisión): título, tipo,
 * objetivo, audiencia, rol, campaña, spec y timing. Operativos: responsable,
 * vencimiento productivo y prioridad. Cuenta y bucket no se cambian en V0.1.
 */
create function public.update_piece(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_changes jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_new public.content_pieces;
  v_material text[] := array['title', 'content_type', 'objective', 'audience', 'editorial_role', 'campaign',
                             'production_spec_text', 'production_spec_url'];
  v_timing text[] := array['timing_mode', 'fixed_date', 'valid_from', 'valid_until'];
  v_operational text[] := array['owner_label', 'due_date', 'priority'];
  v_keys text[];
  v_is_material boolean;
  v_timing_changed boolean;
  v_week date;
begin
  if v_replay is not null then return v_replay; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then perform app.fail('Cambios inválidos'); end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;

  select array_agg(k) into v_keys from jsonb_object_keys(p_changes) k;
  if v_keys is null then perform app.fail('No hay cambios'); end if;
  if exists (select 1 from unnest(v_keys) k where not (k = any (v_material || v_timing || v_operational))) then
    perform app.fail('Campo no editable');
  end if;
  v_timing_changed := v_keys && v_timing;
  v_is_material := v_keys && v_material or (v_timing_changed and v_piece.ownership = 'local');
  if v_piece.ownership = 'external' and v_keys && v_material then
    perform app.fail('El contenido de un espejo externo se edita en su sistema fuente', 'CO403');
  end if;
  if v_is_material then perform app.require_material_editable(v_piece); end if;

  v_new := v_piece;
  if p_changes ? 'title' then v_new.title := app.require_text(p_changes->>'title', 'Título'); end if;
  if p_changes ? 'content_type' then v_new.content_type := nullif(btrim(p_changes->>'content_type'), ''); end if;
  if p_changes ? 'objective' then v_new.objective := nullif(btrim(p_changes->>'objective'), ''); end if;
  if p_changes ? 'audience' then v_new.audience := nullif(btrim(p_changes->>'audience'), ''); end if;
  if p_changes ? 'editorial_role' then v_new.editorial_role := nullif(btrim(p_changes->>'editorial_role'), ''); end if;
  if p_changes ? 'campaign' then v_new.campaign := nullif(btrim(p_changes->>'campaign'), ''); end if;
  if p_changes ? 'production_spec_text' then v_new.production_spec_text := nullif(btrim(p_changes->>'production_spec_text'), ''); end if;
  if p_changes ? 'production_spec_url' then v_new.production_spec_url := nullif(btrim(p_changes->>'production_spec_url'), ''); end if;
  if p_changes ? 'owner_label' then v_new.owner_label := nullif(btrim(p_changes->>'owner_label'), ''); end if;
  if p_changes ? 'due_date' then v_new.due_date := nullif(p_changes->>'due_date', '')::date; end if;
  if p_changes ? 'priority' then v_new.priority := p_changes->>'priority'; end if;
  if v_timing_changed then
    v_new.timing_mode := coalesce(p_changes->>'timing_mode', v_piece.timing_mode);
    v_new.fixed_date := case when p_changes ? 'fixed_date' then nullif(p_changes->>'fixed_date', '')::date else v_piece.fixed_date end;
    v_new.valid_from := case when p_changes ? 'valid_from' then nullif(p_changes->>'valid_from', '')::date else v_piece.valid_from end;
    v_new.valid_until := case when p_changes ? 'valid_until' then nullif(p_changes->>'valid_until', '')::date else v_piece.valid_until end;
    if app.has_publication(p_piece_id, array['scheduled', 'published']) then
      perform app.fail('Hay destinos programados o publicados: resuélvelos antes de cambiar el timing');
    end if;
    select week_start into v_week from public.planning_assignments where content_piece_id = p_piece_id;
    if v_week is not null and not app.week_fits_timing(v_new, v_week) then
      perform app.fail('El nuevo timing no es compatible con la semana asignada; quita o cambia la asignación primero');
    end if;
  end if;

  update public.content_pieces set
    title = v_new.title, content_type = v_new.content_type, objective = v_new.objective,
    audience = v_new.audience, editorial_role = v_new.editorial_role, campaign = v_new.campaign,
    production_spec_text = v_new.production_spec_text, production_spec_url = v_new.production_spec_url,
    owner_label = v_new.owner_label, due_date = v_new.due_date, priority = v_new.priority,
    timing_mode = v_new.timing_mode, fixed_date = v_new.fixed_date,
    valid_from = v_new.valid_from, valid_until = v_new.valid_until,
    content_revision = content_revision + case when v_is_material then 1 else 0 end,
    version = version + 1
  where id = p_piece_id;

  return app.log_event(p_request_id, v_uid, case when v_is_material then 'piece_material_edit' else 'piece_operational_edit' end,
    p_piece_id, null, null, jsonb_build_object('fields', v_keys),
    jsonb_build_object('piece_id', p_piece_id));
end $$;

-- Transiciones de producción ---------------------------------------------

create function app.transition(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer,
  p_from text[], p_to text, p_event text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_gaps text[];
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.ownership <> 'local' then
    perform app.fail('Los espejos externos no tienen transiciones locales: registra una observación', 'CO403');
  end if;
  if v_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;
  if v_piece.on_hold then perform app.fail('La pieza está en hold: libérala primero', 'CO403'); end if;
  if not (v_piece.production_status = any (p_from)) then
    perform app.fail(format('Transición no permitida desde %s', v_piece.production_status), 'CO403');
  end if;
  if p_to = 'in_review' then
    v_gaps := app.packet_gaps(p_piece_id);
    if cardinality(v_gaps) > 0 then
      perform app.fail('Review Packet incompleto: ' || array_to_string(v_gaps, '; '));
    end if;
  end if;
  if p_to = 'in_production' and v_piece.production_status = 'approved' then
    perform app.require_text(p_reason, 'El motivo');
    if app.has_publication(p_piece_id, array['scheduled', 'published']) then
      perform app.fail('Hay destinos programados o publicados: cancélalos antes de reabrir', 'CO403');
    end if;
  end if;

  update public.content_pieces set
    production_status = p_to,
    approved_revision = case when p_to = 'approved' then approved_revision else null end,
    approved_at = case when p_to = 'approved' then approved_at else null end,
    version = version + 1
  where id = p_piece_id;

  return app.log_event(p_request_id, v_uid, p_event, p_piece_id, null, p_reason,
    jsonb_build_object('production_status', v_piece.production_status, 'approved_revision', v_piece.approved_revision),
    jsonb_build_object('piece_id', p_piece_id, 'production_status', p_to));
end $$;

create function public.plan_piece(p_request_id uuid, p_piece_id uuid, p_expected_version integer) returns jsonb
language sql security definer set search_path = '' as $$
  select app.transition(p_request_id, p_piece_id, p_expected_version, array['idea'], 'planned', 'piece_planned', null)
$$;

create function public.start_production(p_request_id uuid, p_piece_id uuid, p_expected_version integer) returns jsonb
language sql security definer set search_path = '' as $$
  select app.transition(p_request_id, p_piece_id, p_expected_version,
    array['planned', 'changes_requested'], 'in_production', 'production_started', null)
$$;

create function public.submit_review(p_request_id uuid, p_piece_id uuid, p_expected_version integer) returns jsonb
language sql security definer set search_path = '' as $$
  select app.transition(p_request_id, p_piece_id, p_expected_version,
    array['in_production', 'changes_requested'], 'in_review', 'review_submitted', null)
$$;

create function public.reopen_approved(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$
  select app.transition(p_request_id, p_piece_id, p_expected_version,
    array['approved'], 'in_production', 'approval_reopened', p_reason)
$$;

create function public.archive_piece(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.archived_at is not null then perform app.fail('La pieza ya está archivada'); end if;
  if app.has_publication(p_piece_id, array['scheduled']) then
    perform app.fail('Cancela explícitamente los destinos programados antes de archivar', 'CO403');
  end if;
  update public.content_pieces set archived_at = now(), version = version + 1 where id = p_piece_id;
  return app.log_event(p_request_id, v_uid, 'piece_archived', p_piece_id, null, app.require_text(p_reason, 'El motivo'),
    null, jsonb_build_object('piece_id', p_piece_id));
end $$;

-- Review Packet, claims y dependencias ----------------------------------

create function app.validate_words(p_words jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  r record;
begin
  if p_words is null or jsonb_typeof(p_words) <> 'object' then perform app.fail('Words debe ser un objeto'); end if;
  for r in select * from jsonb_each(p_words) loop
    if r.key not in ('hook', 'on_screen', 'final_line', 'caption', 'cta') then
      perform app.fail('Campo de Words desconocido: ' || r.key);
    end if;
    if jsonb_typeof(r.value) <> 'string' or length(r.value #>> '{}') > 2200 then
      perform app.fail('Cada texto de Words debe ser texto de máximo 2200 caracteres');
    end if;
  end loop;
end $$;

create function app.validate_frames(p_frames jsonb) returns void
language plpgsql immutable set search_path = '' as $$
declare
  f jsonb;
begin
  if p_frames is null or jsonb_typeof(p_frames) <> 'array' or jsonb_array_length(p_frames) > 30 then
    perform app.fail('Frames debe ser una lista de máximo 30 elementos');
  end if;
  for f in select * from jsonb_array_elements(p_frames) loop
    if jsonb_typeof(f) <> 'object'
       or exists (select 1 from jsonb_object_keys(f) k
                   where k not in ('order', 'image_url', 'visible_text', 'action', 'duration_seconds'))
       or jsonb_typeof(f->'order') is distinct from 'number'
       or (f ? 'image_url' and f->>'image_url' is not null and not app.is_http_url(f->>'image_url'))
       or length(coalesce(f->>'visible_text', '')) > 500
       or length(coalesce(f->>'action', '')) > 500
       or (f ? 'duration_seconds' and jsonb_typeof(f->'duration_seconds') not in ('number', 'null')) then
      perform app.fail('Frame inválido');
    end if;
  end loop;
end $$;

create function public.upsert_review_packet(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_packet jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_words jsonb := coalesce(p_packet->'words', '{}'::jsonb);
  v_frames jsonb := coalesce(p_packet->'frames', '[]'::jsonb);
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_material_editable(v_piece);
  if p_packet is null or jsonb_typeof(p_packet) <> 'object' then perform app.fail('Packet inválido'); end if;
  perform app.validate_words(v_words);
  perform app.validate_frames(v_frames);

  insert into public.review_packets as rp
    (content_piece_id, what_is_it, why_it_exists, experience, words, frames, preview_kind, preview_url,
     claims_checked, dependencies_checked)
  values
    (p_piece_id, nullif(btrim(p_packet->>'what_is_it'), ''), nullif(btrim(p_packet->>'why_it_exists'), ''),
     nullif(btrim(p_packet->>'experience'), ''), v_words, v_frames,
     nullif(p_packet->>'preview_kind', ''), nullif(btrim(p_packet->>'preview_url'), ''),
     coalesce((p_packet->>'claims_checked')::boolean, false),
     coalesce((p_packet->>'dependencies_checked')::boolean, false))
  on conflict (content_piece_id) do update set
    what_is_it = excluded.what_is_it, why_it_exists = excluded.why_it_exists,
    experience = excluded.experience, words = excluded.words, frames = excluded.frames,
    preview_kind = excluded.preview_kind, preview_url = excluded.preview_url,
    claims_checked = excluded.claims_checked, dependencies_checked = excluded.dependencies_checked,
    version = rp.version + 1;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'packet_saved', p_piece_id, null, null, null,
    jsonb_build_object('piece_id', p_piece_id));
end $$;

/** La fuente de un claim debe pertenecer al ámbito de la pieza o ser pública general. */
create function app.require_source_in_scope(p_reference_id uuid, p_piece public.content_pieces) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ref public.source_references;
  v_brand uuid;
begin
  if p_reference_id is null then return; end if;
  select * into v_ref from public.source_references where id = p_reference_id;
  if not found then perform app.fail('Fuente no encontrada', 'CO404'); end if;
  select brand_id into v_brand from public.accounts where id = p_piece.account_id;
  if v_ref.relation_kind <> 'context_reference' or not (
       (v_ref.scope_kind = 'account' and v_ref.account_id = p_piece.account_id)
    or (v_ref.scope_kind = 'brand' and v_ref.brand_id = v_brand)
    or v_ref.scope_kind = 'public_general'
  ) then
    perform app.fail('La fuente pertenece a otro cliente o ámbito; no se traslada contexto entre cuentas', 'CO403');
  end if;
end $$;

create function public.upsert_claim(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_claim_id uuid,
  p_statement text, p_kind text, p_source_reference_id uuid, p_source_locator text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_id uuid := p_claim_id;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_material_editable(v_piece);
  perform app.require_source_in_scope(p_source_reference_id, v_piece);
  if v_id is null then
    insert into public.claims (content_piece_id, statement, claim_kind, source_reference_id, source_locator)
    values (p_piece_id, app.require_text(p_statement, 'El enunciado'), p_kind, p_source_reference_id,
            nullif(btrim(p_source_locator), ''))
    returning id into v_id;
  else
    -- Cambiar el enunciado o su fuente reinicia la verificación.
    update public.claims set
      statement = app.require_text(p_statement, 'El enunciado'), claim_kind = p_kind,
      source_reference_id = p_source_reference_id, source_locator = nullif(btrim(p_source_locator), ''),
      verification_status = 'pending', verification_note = null, verified_by = null, verified_at = null
    where id = v_id and content_piece_id = p_piece_id;
    if not found then perform app.fail('Claim no encontrado en esta pieza', 'CO404'); end if;
  end if;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'claim_saved', p_piece_id, null, null, null,
    jsonb_build_object('piece_id', p_piece_id, 'claim_id', v_id));
end $$;

create function public.delete_claim(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_claim public.claims;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_material_editable(v_piece);
  delete from public.claims where id = p_claim_id and content_piece_id = p_piece_id returning * into v_claim;
  if v_claim.id is null then perform app.fail('Claim no encontrado en esta pieza', 'CO404'); end if;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'claim_removed', p_piece_id, null, null, to_jsonb(v_claim),
    jsonb_build_object('piece_id', p_piece_id));
end $$;

/** Verificación humana de un claim. No es edición material; no se permite sobre piezas aprobadas. */
create function public.verify_claim(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_claim_id uuid,
  p_status text, p_note text, p_source_reference_id uuid, p_source_locator text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_claim public.claims;
  v_ref uuid;
  v_locator text;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.ownership <> 'local' or v_piece.archived_at is not null
     or v_piece.production_status = 'approved' then
    perform app.fail('Solo se verifican claims de piezas locales no aprobadas', 'CO403');
  end if;
  select * into v_claim from public.claims where id = p_claim_id and content_piece_id = p_piece_id for update;
  if not found then perform app.fail('Claim no encontrado en esta pieza', 'CO404'); end if;
  v_ref := coalesce(p_source_reference_id, v_claim.source_reference_id);
  v_locator := coalesce(nullif(btrim(p_source_locator), ''), v_claim.source_locator);
  perform app.require_source_in_scope(v_ref, v_piece);
  if p_status = 'supported' and v_ref is null and coalesce(btrim(v_locator), '') = '' then
    perform app.fail('Un claim soportado requiere fuente identificable o localizador de evidencia');
  end if;
  if p_status = 'supported' then perform app.require_text(p_note, 'La nota de verificación'); end if;
  update public.claims set
    verification_status = p_status,
    verification_note = nullif(btrim(p_note), ''),
    source_reference_id = v_ref,
    source_locator = v_locator,
    verified_by = case when p_status = 'pending' then null else v_uid end,
    verified_at = case when p_status = 'pending' then null else now() end
  where id = p_claim_id;
  perform app.bump_version(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'claim_verified', p_piece_id, null, p_note,
    jsonb_build_object('verification_status', v_claim.verification_status),
    jsonb_build_object('piece_id', p_piece_id, 'claim_id', p_claim_id, 'verification_status', p_status));
end $$;

create function public.upsert_dependency(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_dependency_id uuid,
  p_label text, p_required boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_id uuid := p_dependency_id;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_material_editable(v_piece);
  if v_id is null then
    insert into public.approval_dependencies (content_piece_id, label, required)
    values (p_piece_id, app.require_text(p_label, 'La dependencia'), coalesce(p_required, true))
    returning id into v_id;
  else
    update public.approval_dependencies
       set label = app.require_text(p_label, 'La dependencia'), required = coalesce(p_required, true),
           status = 'pending', evidence_note = null
     where id = v_id and content_piece_id = p_piece_id;
    if not found then perform app.fail('Dependencia no encontrada en esta pieza', 'CO404'); end if;
  end if;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'dependency_saved', p_piece_id, null, null, null,
    jsonb_build_object('piece_id', p_piece_id, 'dependency_id', v_id));
end $$;

create function public.delete_dependency(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_dependency_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_dep public.approval_dependencies;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_material_editable(v_piece);
  delete from public.approval_dependencies where id = p_dependency_id and content_piece_id = p_piece_id
  returning * into v_dep;
  if v_dep.id is null then perform app.fail('Dependencia no encontrada en esta pieza', 'CO404'); end if;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'dependency_removed', p_piece_id, null, null, to_jsonb(v_dep),
    jsonb_build_object('piece_id', p_piece_id));
end $$;

create function public.set_dependency_status(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_dependency_id uuid,
  p_status text, p_note text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_dep public.approval_dependencies;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.ownership <> 'local' or v_piece.archived_at is not null
     or v_piece.production_status = 'approved' then
    perform app.fail('Solo se resuelven dependencias de piezas locales no aprobadas', 'CO403');
  end if;
  select * into v_dep from public.approval_dependencies
   where id = p_dependency_id and content_piece_id = p_piece_id for update;
  if not found then perform app.fail('Dependencia no encontrada en esta pieza', 'CO404'); end if;
  if p_status <> 'pending' then perform app.require_text(p_note, 'La confirmación o motivo'); end if;
  update public.approval_dependencies
     set status = p_status, evidence_note = nullif(btrim(p_note), '')
   where id = p_dependency_id;
  perform app.bump_version(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'dependency_status_set', p_piece_id, null, p_note,
    jsonb_build_object('status', v_dep.status),
    jsonb_build_object('piece_id', p_piece_id, 'dependency_id', p_dependency_id, 'status', p_status));
end $$;

-- Decisiones de revisión (append-only, atómicas) --------------------------

create function app.record_decision(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_action text, p_comment text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_blockers text[];
  v_decision_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.ownership <> 'local' then
    perform app.fail('Un espejo externo no admite decisiones locales: abre la fuente o registra una observación', 'CO403');
  end if;
  if v_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;

  if p_action = 'approved' then
    if v_piece.production_status <> 'in_review' then perform app.fail('Solo se aprueba una pieza en revisión', 'CO403'); end if;
    if v_piece.on_hold then perform app.fail('La pieza está en hold', 'CO403'); end if;
    v_blockers := public.approval_blockers(p_piece_id);
    if cardinality(v_blockers) > 0 then
      perform app.fail('No se puede aprobar: ' || array_to_string(v_blockers, '; '));
    end if;
  elsif p_action = 'changes_requested' then
    if v_piece.production_status <> 'in_review' then perform app.fail('Solo se piden cambios sobre una pieza en revisión', 'CO403'); end if;
    if v_piece.on_hold then perform app.fail('La pieza está en hold', 'CO403'); end if;
    perform app.require_text(p_comment, 'La instrucción de cambios');
  elsif p_action = 'hold' then
    if v_piece.production_status not in ('in_review', 'approved') or v_piece.on_hold then
      perform app.fail('Hold solo aplica a piezas en revisión o aprobadas sin hold', 'CO403');
    end if;
    perform app.require_text(p_comment, 'El motivo del hold');
    if app.has_publication(p_piece_id, array['scheduled', 'published']) then
      perform app.fail('Hay destinos programados o publicados: resuélvelos antes de poner en hold', 'CO403');
    end if;
  elsif p_action = 'released' then
    if not v_piece.on_hold then perform app.fail('La pieza no está en hold', 'CO403'); end if;
  else
    perform app.fail('Acción de revisión desconocida');
  end if;

  insert into public.review_decisions
    (content_piece_id, content_revision, action, actor_id, comment, packet_snapshot, request_id)
  values
    (p_piece_id, v_piece.content_revision, p_action, v_uid, nullif(btrim(p_comment), ''),
     app.piece_snapshot(p_piece_id), p_request_id)
  returning id into v_decision_id;

  update public.content_pieces set
    production_status = case p_action
      when 'approved' then 'approved'
      when 'changes_requested' then 'changes_requested'
      else production_status end,
    approved_revision = case when p_action = 'approved' then content_revision else approved_revision end,
    approved_at = case when p_action = 'approved' then now() else approved_at end,
    on_hold = case p_action when 'hold' then true when 'released' then false else on_hold end,
    version = version + 1
  where id = p_piece_id;

  return jsonb_build_object('ok', true, 'replayed', false, 'decision_id', v_decision_id, 'piece_id', p_piece_id);
end $$;

create function public.approve_piece(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_comment text) returns jsonb
language sql security definer set search_path = '' as $$
  select app.record_decision(p_request_id, p_piece_id, p_expected_version, 'approved', p_comment)
$$;

create function public.request_changes(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_comment text) returns jsonb
language sql security definer set search_path = '' as $$
  select app.record_decision(p_request_id, p_piece_id, p_expected_version, 'changes_requested', p_comment)
$$;

create function public.hold_piece(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$
  select app.record_decision(p_request_id, p_piece_id, p_expected_version, 'hold', p_reason)
$$;

create function public.release_hold(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_comment text) returns jsonb
language sql security definer set search_path = '' as $$
  select app.record_decision(p_request_id, p_piece_id, p_expected_version, 'released', p_comment)
$$;

-- Planeación semanal -----------------------------------------------------

create function public.assign_week(p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_week_start date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_current public.planning_assignments;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;
  if not exists (select 1 from public.accounts where id = v_piece.account_id and active) then
    perform app.fail('La cuenta está inactiva', 'CO403');
  end if;
  if p_week_start is null or not app.is_monday(p_week_start) then perform app.fail('La semana se identifica por su lunes'); end if;
  if p_week_start < app.current_week() then perform app.fail('No se asignan semanas pasadas'); end if;
  if not app.week_fits_timing(v_piece, p_week_start) then
    perform app.fail('El timing de la pieza no es compatible con esa semana');
  end if;

  select * into v_current from public.planning_assignments where content_piece_id = p_piece_id for update;
  if v_current.id is not null then
    if v_current.week_start = p_week_start then
      perform app.fail('La pieza ya está asignada a esa semana');
    end if;
    if app.has_publication(p_piece_id, array['published']) then
      perform app.fail('La pieza ya tiene una publicación confirmada: su asignación no se mueve', 'CO403');
    end if;
    if app.has_publication(p_piece_id, array['scheduled']) then
      perform app.fail('Hay destinos programados en la semana actual de la pieza: reprográmalos o cancélalos antes de reasignar', 'CO403');
    end if;
    update public.planning_assignments set week_start = p_week_start, version = version + 1 where id = v_current.id;
  else
    insert into public.planning_assignments (content_piece_id, week_start) values (p_piece_id, p_week_start);
  end if;
  perform app.bump_version(p_piece_id);
  return app.log_event(p_request_id, v_uid, case when v_current.id is null then 'week_assigned' else 'week_reassigned' end,
    p_piece_id, null, null,
    case when v_current.id is not null then jsonb_build_object('week_start', v_current.week_start) end,
    jsonb_build_object('piece_id', p_piece_id, 'week_start', p_week_start));
end $$;

create function public.unassign_week(p_request_id uuid, p_piece_id uuid, p_expected_version integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_current public.planning_assignments;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if app.has_publication(p_piece_id, array['scheduled', 'published']) then
    perform app.fail('Hay destinos programados o publicados: la asignación no se puede quitar', 'CO403');
  end if;
  delete from public.planning_assignments where content_piece_id = p_piece_id returning * into v_current;
  if v_current.id is null then perform app.fail('La pieza no tiene semana asignada'); end if;
  perform app.bump_version(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'week_unassigned', p_piece_id, null, null,
    jsonb_build_object('week_start', v_current.week_start), jsonb_build_object('piece_id', p_piece_id));
end $$;
