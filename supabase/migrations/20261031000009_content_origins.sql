-- Content OS V0.2.1 — Orígenes de contenido (Tec): orgánico, cobertura/evento y
-- material ya existente. Aditiva y compatible con V0.2; no modifica 0008.
--
-- Nota de modelo: `content_pieces.origin` (0008) es el modo de INICIO CREATIVO del
-- flujo orgánico (own_idea, develop, generate, research, library). `content_origin`
-- es una dimensión distinta: de dónde llega la pieza al calendario.

-- Orígenes habilitados por cliente (configuración, no lógica por nombre de marca).
alter table public.brands
  add column content_origins text[] not null default array['organic']
    check (cardinality(content_origins) >= 1
           and content_origins <@ array['organic', 'event_coverage', 'existing_material']
           and 'organic' = any (content_origins));

alter table public.content_pieces
  add column content_origin text not null default 'organic'
    check (content_origin in ('organic', 'event_coverage', 'existing_material')),
  add column material_status text not null default 'not_required'
    check (material_status in ('not_required', 'pending', 'available')),
  add column needs_copy boolean not null default false,
  add column event_name text check (length(btrim(event_name)) between 1 and 200),
  -- Referencia MANUAL al sistema donde vive el material/evento. No implica sincronización.
  add column source_system text check (source_system in ('st_hub', 'onedrive', 'other')),
  add column source_entity_id text check (length(btrim(source_entity_id)) between 1 and 200),
  add column source_url text check (source_url is null or app.is_http_url(source_url)),
  add constraint content_pieces_event_needs_name check (content_origin <> 'event_coverage' or event_name is not null);

create index content_pieces_content_origin on public.content_pieces (content_origin, material_status);

-- Comandos -------------------------------------------------------------------

create function public.set_brand_content_origins(
  p_request_id uuid, p_brand_id uuid, p_expected_version integer, p_origins text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_brand public.brands;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_brand from public.brands where id = p_brand_id for update;
  if not found then perform app.fail('Cliente no encontrado', 'CO404'); end if;
  perform app.check_version(v_brand.version, p_expected_version);
  update public.brands
     set content_origins = (select array_agg(distinct o order by o) from unnest(array_append(coalesce(p_origins, '{}'), 'organic')) o),
         version = version + 1
   where id = p_brand_id;
  return app.log_event(p_request_id, v_uid, 'brand_content_origins_set', null, null, null,
    jsonb_build_object('content_origins', v_brand.content_origins), jsonb_build_object('brand_id', p_brand_id));
end $$;

-- create_calendar_piece: mismos parámetros de V0.2 + origen y material, todos opcionales
-- (las llamadas de V0.2 siguen siendo válidas).
drop function public.create_calendar_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, text);

create function public.create_calendar_piece(
  p_request_id uuid, p_account_id uuid, p_planned_date date, p_title text, p_idea text, p_origin text,
  p_format_key text, p_production_mode_key text, p_pillar_id uuid, p_territory_id uuid, p_bucket text,
  p_content_origin text default 'organic', p_material_status text default null, p_needs_copy boolean default false,
  p_event_name text default null, p_source_system text default null, p_source_entity_id text default null,
  p_source_url text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_content_origin text := coalesce(nullif(p_content_origin, ''), 'organic');
  v_material text;
  v_allowed text[];
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  select b.content_origins into v_allowed
    from public.accounts a join public.brands b on b.id = a.brand_id
   where a.id = p_account_id and a.active for share of a;
  if not found then perform app.fail('La cuenta no existe o está inactiva'); end if;
  if v_content_origin not in ('organic', 'event_coverage', 'existing_material') then
    perform app.fail('Origen de contenido no válido');
  end if;
  if not (v_content_origin = any (v_allowed)) then
    perform app.fail('Este origen no está habilitado para el cliente; actívalo en Clientes', 'CO403');
  end if;
  perform app.require_assignable_day(p_planned_date);
  if not exists (select 1 from public.content_formats where key = p_format_key and active) then
    perform app.fail('Elige un formato disponible');
  end if;
  -- El modo de producción solo es obligatorio en el flujo creativo (orgánico).
  if v_content_origin = 'organic' or p_production_mode_key is not null then
    if not exists (select 1 from public.production_modes where key = p_production_mode_key and active) then
      perform app.fail('Elige un modo de producción disponible');
    end if;
  end if;
  v_material := coalesce(nullif(p_material_status, ''), case v_content_origin
    when 'organic' then 'not_required' when 'existing_material' then 'available' else 'pending' end);
  if v_content_origin = 'event_coverage' then perform app.require_text(p_event_name, 'El nombre del evento'); end if;

  insert into public.content_pieces
    (account_id, title, bucket, ownership, production_status, idea, origin, format_key, production_mode_key,
     pillar_id, territory_id, content_origin, material_status, needs_copy, event_name,
     source_system, source_entity_id, source_url)
  values
    (p_account_id, app.require_text(p_title, 'Título'), coalesce(nullif(p_bucket, ''), 'feed'), 'local', 'planned',
     nullif(btrim(p_idea), ''),
     case when v_content_origin = 'organic' then coalesce(nullif(p_origin, ''), 'own_idea') end,
     p_format_key, nullif(p_production_mode_key, ''), p_pillar_id, p_territory_id, v_content_origin, v_material,
     coalesce(p_needs_copy, false), nullif(btrim(p_event_name), ''),
     nullif(p_source_system, ''), nullif(btrim(p_source_entity_id), ''), nullif(btrim(p_source_url), ''))
  returning id into v_id;
  insert into public.planning_assignments (content_piece_id, week_start, planned_date)
  values (v_id, app.week_start(p_planned_date), p_planned_date);
  return app.log_event(p_request_id, v_uid, 'piece_created', v_id, null, 'Creada desde el calendario', null,
    jsonb_build_object('piece_id', v_id, 'planned_date', p_planned_date, 'content_origin', v_content_origin));
end $$;

-- update_piece: nombre de evento, estado del material, copy pendiente y referencias
-- manuales como campos OPERATIVOS (no invalidan la revisión ni exigen reabrir).
create or replace function public.update_piece(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_changes jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_new public.content_pieces;
  v_material text[] := array['title', 'content_type', 'objective', 'audience', 'editorial_role', 'campaign',
                             'production_spec_text', 'production_spec_url',
                             'idea', 'format_key', 'production_mode_key', 'pillar_id', 'territory_id'];
  v_timing text[] := array['timing_mode', 'fixed_date', 'valid_from', 'valid_until'];
  v_operational text[] := array['owner_label', 'due_date', 'priority',
                                'event_name', 'material_status', 'needs_copy', 'source_system', 'source_entity_id', 'source_url'];
  v_keys text[];
  v_is_material boolean;
  v_timing_changed boolean;
  v_week date;
  v_day date;
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
  if p_changes ? 'idea' then v_new.idea := nullif(btrim(p_changes->>'idea'), ''); end if;
  if p_changes ? 'format_key' then v_new.format_key := nullif(p_changes->>'format_key', ''); end if;
  if p_changes ? 'production_mode_key' then v_new.production_mode_key := nullif(p_changes->>'production_mode_key', ''); end if;
  if p_changes ? 'pillar_id' then v_new.pillar_id := nullif(p_changes->>'pillar_id', '')::uuid; end if;
  if p_changes ? 'territory_id' then v_new.territory_id := nullif(p_changes->>'territory_id', '')::uuid; end if;
  if p_changes ? 'owner_label' then v_new.owner_label := nullif(btrim(p_changes->>'owner_label'), ''); end if;
  if p_changes ? 'due_date' then v_new.due_date := nullif(p_changes->>'due_date', '')::date; end if;
  if p_changes ? 'priority' then v_new.priority := p_changes->>'priority'; end if;
  if p_changes ? 'event_name' then v_new.event_name := nullif(btrim(p_changes->>'event_name'), ''); end if;
  if p_changes ? 'material_status' then v_new.material_status := p_changes->>'material_status'; end if;
  if p_changes ? 'needs_copy' then v_new.needs_copy := (p_changes->>'needs_copy')::boolean; end if;
  if p_changes ? 'source_system' then v_new.source_system := nullif(p_changes->>'source_system', ''); end if;
  if p_changes ? 'source_entity_id' then v_new.source_entity_id := nullif(btrim(p_changes->>'source_entity_id'), ''); end if;
  if p_changes ? 'source_url' then v_new.source_url := nullif(btrim(p_changes->>'source_url'), ''); end if;
  if v_timing_changed then
    v_new.timing_mode := coalesce(p_changes->>'timing_mode', v_piece.timing_mode);
    v_new.fixed_date := case when p_changes ? 'fixed_date' then nullif(p_changes->>'fixed_date', '')::date else v_piece.fixed_date end;
    v_new.valid_from := case when p_changes ? 'valid_from' then nullif(p_changes->>'valid_from', '')::date else v_piece.valid_from end;
    v_new.valid_until := case when p_changes ? 'valid_until' then nullif(p_changes->>'valid_until', '')::date else v_piece.valid_until end;
    if app.has_publication(p_piece_id, array['scheduled', 'published']) then
      perform app.fail('Hay destinos programados o publicados: resuélvelos antes de cambiar el timing');
    end if;
    select week_start, planned_date into v_week, v_day from public.planning_assignments where content_piece_id = p_piece_id;
    if v_week is not null and not app.week_fits_timing(v_new, v_week) then
      perform app.fail('El nuevo timing no es compatible con la semana asignada; quita o cambia la asignación primero');
    end if;
    if v_day is not null and not app.date_fits_timing(v_new, v_day) then
      perform app.fail('El nuevo timing no incluye el día planeado en el calendario; mueve la pieza primero');
    end if;
  end if;

  update public.content_pieces set
    title = v_new.title, content_type = v_new.content_type, objective = v_new.objective,
    audience = v_new.audience, editorial_role = v_new.editorial_role, campaign = v_new.campaign,
    production_spec_text = v_new.production_spec_text, production_spec_url = v_new.production_spec_url,
    idea = v_new.idea, format_key = v_new.format_key, production_mode_key = v_new.production_mode_key,
    pillar_id = v_new.pillar_id, territory_id = v_new.territory_id,
    owner_label = v_new.owner_label, due_date = v_new.due_date, priority = v_new.priority,
    event_name = v_new.event_name, material_status = v_new.material_status, needs_copy = v_new.needs_copy,
    source_system = v_new.source_system, source_entity_id = v_new.source_entity_id, source_url = v_new.source_url,
    timing_mode = v_new.timing_mode, fixed_date = v_new.fixed_date,
    valid_from = v_new.valid_from, valid_until = v_new.valid_until,
    content_revision = content_revision + case when v_is_material then 1 else 0 end,
    version = version + 1
  where id = p_piece_id;

  return app.log_event(p_request_id, v_uid, case when v_is_material then 'piece_material_edit' else 'piece_operational_edit' end,
    p_piece_id, null, null, jsonb_build_object('fields', v_keys),
    jsonb_build_object('piece_id', p_piece_id));
end $$;

revoke all on function public.set_brand_content_origins(uuid, uuid, integer, text[]) from public, anon;
revoke all on function public.create_calendar_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, text, text, text, boolean, text, text, text, text) from public, anon;
revoke all on function public.update_piece(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.set_brand_content_origins(uuid, uuid, integer, text[]) to authenticated;
grant execute on function public.create_calendar_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, text, text, text, boolean, text, text, text, text) to authenticated;
grant execute on function public.update_piece(uuid, uuid, integer, jsonb) to authenticated;

-- Configuración inicial: Tec admite los tres orígenes. Otros clientes, solo orgánico.
update public.brands set content_origins = array['organic', 'event_coverage', 'existing_material'] where slug = 'tec';
