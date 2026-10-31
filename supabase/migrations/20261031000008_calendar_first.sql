-- Content OS V0.2 — Calendar-First: día planeado, formato y modo de producción
-- configurables, ejes editoriales por cliente y apariencia del cliente.
-- Aditiva: no modifica datos existentes salvo apariencia/ejes provisionales
-- de marcas identificadas por slug (D3, 2026-10-31).

-- Apariencia del cliente ---------------------------------------------------

alter table public.brands
  add column color text not null default 'gray'
    check (color in ('blue', 'yellow', 'purple', 'green', 'red', 'teal', 'orange', 'pink', 'gray')),
  add column short_label text check (length(btrim(short_label)) between 1 and 12);

-- Catálogos configurables -----------------------------------------------

create table public.content_formats (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  sort integer not null default 0,
  active boolean not null default true
);

create table public.production_modes (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  sort integer not null default 0,
  active boolean not null default true
);

insert into public.content_formats (key, label, sort) values
  ('reel', 'Reel', 10),
  ('carousel', 'Carrusel', 20),
  ('editorial_carousel', 'Carrusel editorial', 30),
  ('motion', 'Video gráfico / Motion', 40),
  ('static_post', 'Post estático', 50);

insert into public.production_modes (key, label, sort) values
  ('real_people', 'Personas reales', 10),
  ('real_plus_graphics', 'Personas reales + gráficos', 20),
  ('fully_graphic', 'Totalmente gráfico / animado', 30),
  ('existing_material', 'Fotografías / material existente', 40);

-- Ejes editoriales por cliente (pilares y territorios) ----------------------

create table public.brand_axes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  kind text not null check (kind in ('pillar', 'territory')),
  code text check (length(btrim(code)) between 1 and 12),
  name text not null check (length(btrim(name)) between 1 and 120),
  sort integer not null default 0,
  provisional boolean not null default false,
  source_note text check (length(source_note) <= 500),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_axes_unique_name on public.brand_axes (brand_id, kind, lower(name));
create trigger brand_axes_touch before update on public.brand_axes for each row execute function app.touch_updated_at();

-- Pieza: idea, origen, formato, modo y ejes ---------------------------------

alter table public.content_pieces
  add column idea text check (length(idea) <= 4000),
  add column origin text check (origin in ('own_idea', 'develop', 'generate', 'research', 'library')),
  add column format_key text references public.content_formats (key) on delete restrict,
  add column production_mode_key text references public.production_modes (key) on delete restrict,
  add column pillar_id uuid references public.brand_axes (id) on delete restrict,
  add column territory_id uuid references public.brand_axes (id) on delete restrict;

-- Un eje solo puede usarse en piezas de su propio cliente y con su tipo (aislamiento entre clientes).
create function app.content_pieces_axes_check() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_brand uuid;
begin
  if new.pillar_id is null and new.territory_id is null then return new; end if;
  select brand_id into v_brand from public.accounts where id = new.account_id;
  if new.pillar_id is not null and not exists (
    select 1 from public.brand_axes where id = new.pillar_id and brand_id = v_brand and kind = 'pillar'
  ) then
    raise exception 'El pilar no pertenece al cliente de esta pieza' using errcode = 'CO403';
  end if;
  if new.territory_id is not null and not exists (
    select 1 from public.brand_axes where id = new.territory_id and brand_id = v_brand and kind = 'territory'
  ) then
    raise exception 'El territorio no pertenece al cliente de esta pieza' using errcode = 'CO403';
  end if;
  return new;
end $$;
create trigger content_pieces_axes_check before insert or update of pillar_id, territory_id, account_id
  on public.content_pieces for each row execute function app.content_pieces_axes_check();

-- Día planeado dentro de la semana asignada ------------------------------

alter table public.planning_assignments
  add column planned_date date,
  add constraint planning_assignments_planned_date_in_week
    check (planned_date is null or (planned_date >= week_start and planned_date < week_start + 7));
create index planning_assignments_planned_date on public.planning_assignments (planned_date);

-- Si otro comando cambia la semana (assign_week, corrección de publicación) y el día
-- queda fuera, se limpia el día: la semana manda y la integridad se conserva.
create function app.planning_assignments_keep_day_in_week() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.planned_date is not null and (new.planned_date < new.week_start or new.planned_date >= new.week_start + 7) then
    new.planned_date := null;
  end if;
  return new;
end $$;
create trigger planning_assignments_keep_day_in_week before update of week_start on public.planning_assignments
  for each row execute function app.planning_assignments_keep_day_in_week();

-- Acceso -------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['content_formats', 'production_modes', 'brand_axes'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_authorized())',
      t || '_select_authorized', t);
  end loop;
end $$;

-- Comandos -------------------------------------------------------------------

create function public.set_brand_appearance(
  p_request_id uuid, p_brand_id uuid, p_expected_version integer, p_color text, p_short_label text
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
     set color = p_color, short_label = nullif(btrim(p_short_label), ''), version = version + 1
   where id = p_brand_id;
  return app.log_event(p_request_id, v_uid, 'brand_appearance_set', null, null, null,
    jsonb_build_object('color', v_brand.color, 'short_label', v_brand.short_label),
    jsonb_build_object('brand_id', p_brand_id));
end $$;

create function public.upsert_brand_axis(
  p_request_id uuid, p_axis_id uuid, p_expected_version integer, p_brand_id uuid,
  p_kind text, p_code text, p_name text, p_sort integer, p_provisional boolean, p_source_note text, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_axis public.brand_axes;
  v_id uuid := p_axis_id;
begin
  if v_replay is not null then return v_replay; end if;
  if v_id is null then
    if not exists (select 1 from public.brands where id = p_brand_id) then perform app.fail('Cliente no encontrado', 'CO404'); end if;
    insert into public.brand_axes (brand_id, kind, code, name, sort, provisional, source_note, active)
    values (p_brand_id, p_kind, nullif(btrim(p_code), ''), app.require_text(p_name, 'El nombre'), coalesce(p_sort, 0),
            coalesce(p_provisional, false), nullif(btrim(p_source_note), ''), coalesce(p_active, true))
    returning id into v_id;
  else
    select * into v_axis from public.brand_axes where id = v_id for update;
    if not found then perform app.fail('Eje no encontrado', 'CO404'); end if;
    perform app.check_version(v_axis.version, p_expected_version);
    -- El cliente y el tipo de un eje no cambian: protegería piezas ya clasificadas.
    update public.brand_axes set
      code = nullif(btrim(p_code), ''), name = app.require_text(p_name, 'El nombre'), sort = coalesce(p_sort, 0),
      provisional = coalesce(p_provisional, false), source_note = nullif(btrim(p_source_note), ''),
      active = coalesce(p_active, true), version = version + 1
    where id = v_id;
  end if;
  return app.log_event(p_request_id, v_uid, 'brand_axis_saved', null, null, null,
    case when v_axis.id is not null then to_jsonb(v_axis) end, jsonb_build_object('axis_id', v_id));
end $$;

create function app.require_assignable_day(p_date date) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_date is null then perform app.fail('Elige un día'); end if;
  if app.week_start(p_date) < app.current_week() then
    perform app.fail('No se planean piezas en semanas pasadas');
  end if;
end $$;

/** Crea una pieza local planeada en un día del calendario (flujo «Ya tengo una idea»). */
create function public.create_calendar_piece(
  p_request_id uuid, p_account_id uuid, p_planned_date date, p_title text, p_idea text, p_origin text,
  p_format_key text, p_production_mode_key text, p_pillar_id uuid, p_territory_id uuid, p_bucket text
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
  perform app.require_assignable_day(p_planned_date);
  if not exists (select 1 from public.content_formats where key = p_format_key and active) then
    perform app.fail('Elige un formato disponible');
  end if;
  if not exists (select 1 from public.production_modes where key = p_production_mode_key and active) then
    perform app.fail('Elige un modo de producción disponible');
  end if;
  insert into public.content_pieces
    (account_id, title, bucket, ownership, production_status, idea, origin, format_key, production_mode_key,
     pillar_id, territory_id)
  values
    (p_account_id, app.require_text(p_title, 'Título'), coalesce(nullif(p_bucket, ''), 'feed'), 'local', 'planned',
     nullif(btrim(p_idea), ''), coalesce(nullif(p_origin, ''), 'own_idea'), p_format_key, p_production_mode_key,
     p_pillar_id, p_territory_id)
  returning id into v_id;
  insert into public.planning_assignments (content_piece_id, week_start, planned_date)
  values (v_id, app.week_start(p_planned_date), p_planned_date);
  return app.log_event(p_request_id, v_uid, 'piece_created', v_id, null, 'Creada desde el calendario', null,
    jsonb_build_object('piece_id', v_id, 'planned_date', p_planned_date));
end $$;

/**
 * Mueve una pieza a otro día (D1, 2026-10-31):
 * - flexible: libre;
 * - fixed/window fuera de su restricción: solo con p_make_flexible explícito (CO412 si no);
 * - con publicación programada: bloqueado (desprogramar o reprogramar primero);
 * - con publicación confirmada: bloqueado (la fecha es histórica).
 */
create function public.move_piece_day(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_date date, p_make_flexible boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_current public.planning_assignments;
  v_relaxed boolean := false;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  if v_piece.archived_at is not null then perform app.fail('La pieza está archivada', 'CO403'); end if;
  if not exists (select 1 from public.accounts where id = v_piece.account_id and active) then
    perform app.fail('La cuenta está inactiva', 'CO403');
  end if;
  if app.has_publication(p_piece_id, array['published']) then
    perform app.fail('La pieza ya tiene una publicación confirmada: su fecha se conserva como histórico', 'CO403');
  end if;
  if app.has_publication(p_piece_id, array['scheduled']) then
    perform app.fail('La pieza tiene una publicación programada. Primero cancélala o regístrala con su nueva fecha; luego mueve la pieza', 'CO403');
  end if;
  perform app.require_assignable_day(p_date);
  if not app.date_fits_timing(v_piece, p_date) then
    if not coalesce(p_make_flexible, false) then
      perform app.fail('La fecha está fuera de la restricción de la pieza (fecha fija o ventana). Confirma «Mover y convertir en flexible»', 'CO412');
    end if;
    update public.content_pieces
       set timing_mode = 'flexible', fixed_date = null, valid_from = null, valid_until = null
     where id = p_piece_id;
    v_relaxed := true;
  end if;

  select * into v_current from public.planning_assignments where content_piece_id = p_piece_id for update;
  if v_current.id is null then
    insert into public.planning_assignments (content_piece_id, week_start, planned_date)
    values (p_piece_id, app.week_start(p_date), p_date);
  else
    update public.planning_assignments
       set week_start = app.week_start(p_date), planned_date = p_date, version = version + 1
     where id = v_current.id;
  end if;
  perform app.bump_version(p_piece_id);

  if v_relaxed then
    perform app.log_event(gen_random_uuid(), v_uid, 'timing_relaxed', p_piece_id, null,
      'Movida fuera de su restricción por decisión explícita',
      jsonb_build_object('timing_mode', v_piece.timing_mode, 'fixed_date', v_piece.fixed_date,
        'valid_from', v_piece.valid_from, 'valid_until', v_piece.valid_until),
      jsonb_build_object('timing_mode', 'flexible'));
  end if;
  return app.log_event(p_request_id, v_uid, 'day_moved', p_piece_id, null, null,
    case when v_current.id is not null then
      jsonb_build_object('week_start', v_current.week_start, 'planned_date', v_current.planned_date) end,
    jsonb_build_object('piece_id', p_piece_id, 'planned_date', p_date, 'timing_relaxed', v_relaxed));
end $$;

-- update_piece: añade idea, formato, modo y ejes como campos materiales y
-- valida el timing también contra el día planeado. Misma firma.
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
  v_operational text[] := array['owner_label', 'due_date', 'priority'];
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
    timing_mode = v_new.timing_mode, fixed_date = v_new.fixed_date,
    valid_from = v_new.valid_from, valid_until = v_new.valid_until,
    content_revision = content_revision + case when v_is_material then 1 else 0 end,
    version = version + 1
  where id = p_piece_id;

  return app.log_event(p_request_id, v_uid, case when v_is_material then 'piece_material_edit' else 'piece_operational_edit' end,
    p_piece_id, null, null, jsonb_build_object('fields', v_keys),
    jsonb_build_object('piece_id', p_piece_id));
end $$;

-- Grants de las funciones nuevas o redefinidas.
revoke all on function app.content_pieces_axes_check() from public, anon, authenticated;
revoke all on function app.planning_assignments_keep_day_in_week() from public, anon, authenticated;
revoke all on function app.require_assignable_day(date) from public, anon, authenticated;
revoke all on function public.set_brand_appearance(uuid, uuid, integer, text, text) from public, anon;
revoke all on function public.upsert_brand_axis(uuid, uuid, integer, uuid, text, text, text, integer, boolean, text, boolean) from public, anon;
revoke all on function public.create_calendar_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, text) from public, anon;
revoke all on function public.move_piece_day(uuid, uuid, integer, date, boolean) from public, anon;
revoke all on function public.update_piece(uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.set_brand_appearance(uuid, uuid, integer, text, text) to authenticated;
grant execute on function public.upsert_brand_axis(uuid, uuid, integer, uuid, text, text, text, integer, boolean, text, boolean) to authenticated;
grant execute on function public.create_calendar_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, text) to authenticated;
grant execute on function public.move_piece_day(uuid, uuid, integer, date, boolean) to authenticated;
grant execute on function public.update_piece(uuid, uuid, integer, jsonb) to authenticated;

-- Configuración inicial PROVISIONAL (D3, 2026-10-31) para clientes existentes por slug.
-- Colores: Tec azul, IJLV amarillo, Solotu.IA morado. Configurables después.
update public.brands set color = 'blue', short_label = coalesce(short_label, 'TEC') where slug = 'tec';
update public.brands set color = 'yellow', short_label = coalesce(short_label, 'IJLV') where slug = 'ijlv';
update public.brands set color = 'purple', short_label = coalesce(short_label, 'SOLOTU') where slug = 'solotu';

-- Ejes Tec como datos provisionales, pendientes de validar contra fuente institucional.
-- IJLV no se carga hasta incorporar el Sistema Editorial v1.4 (D2).
insert into public.brand_axes (brand_id, kind, name, sort, provisional, source_note)
select b.id, 'pillar', v.name, v.sort, true,
       'Provisional: indicado por el propietario el 2026-10-31; pendiente de validar contra fuente institucional del Tec'
from public.brands b
cross join (values ('Vivencia Tec', 10), ('Cultura Tec', 20), ('Nuestra Huella', 30), ('Modelo Tec', 40)) as v(name, sort)
where b.slug = 'tec'
on conflict do nothing;
