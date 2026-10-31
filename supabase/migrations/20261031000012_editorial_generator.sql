-- Content OS V0.4 — Generador Editorial (piloto IJLV). Aditiva; no modifica migraciones anteriores.
--
-- Reutilización (ADR-006):
-- * Content Package = public.review_packets (+ columna `package` jsonb). No hay tabla de salidas de IA.
-- * Claims generados = public.claims (+ `evidence_class`, `generated`).
-- * Revisión de Dirección Académica = public.approval_dependencies.
-- * Historial de regeneraciones = public.operation_events (before_data conserva el paquete anterior).
-- * Nuevo: public.idea_library (banco de ideas por cliente) y public.generation_runs (auditoría
--   técnica de llamadas: sin prompts, sin contexto, sin secretos).

-- Capacidad por cliente ------------------------------------------------------

alter table public.brands
  add column capabilities text[] not null default '{}'
    check (capabilities <@ array['editorial_generation']::text[]);

create function app.brand_can_generate(p_brand_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select 'editorial_generation' = any (capabilities) from public.brands where id = p_brand_id and active), false)
$$;

create function app.require_generation(p_brand_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.brand_can_generate(p_brand_id) then
    perform app.fail('La generación editorial no está habilitada para este cliente', 'CO403');
  end if;
end $$;

-- Contexto más preciso del Brain --------------------------------------------

-- Formatos o modos de producción a los que aplica una entrada; vacío = aplica siempre.
alter table public.brain_entries
  add column applies_to text[] not null default '{}';

-- Función, límite o mensaje central del pilar/territorio.
alter table public.brand_axes
  add column description text check (length(description) <= 2000);

-- Biblioteca de ideas --------------------------------------------------------

create table public.idea_library (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  code text not null check (code ~ '^[0-9]{2,3}$'),
  title text not null check (length(btrim(title)) between 1 and 300),
  summary text check (length(summary) <= 2000),
  pillar_id uuid references public.brand_axes (id) on delete restrict,
  territory_id uuid references public.brand_axes (id) on delete restrict,
  suggested_format text check (length(suggested_format) <= 120),     -- texto de la fuente («Reel / B»)
  format_key text references public.content_formats (key) on delete restrict, -- solo si el mapeo es inequívoco
  suggested_production_mode text references public.production_modes (key) on delete restrict,
  production_level text check (production_level ~ '^[ABC](–[ABC])?$'),
  stage text check (stage in ('maternal', 'preescolar', 'primaria', 'todas')),
  requirement_kind text check (requirement_kind in ('R', 'V', 'I', 'R/V', 'I/V')),
  requirements text check (length(requirements) <= 2000),
  cta text check (length(cta) <= 300),
  source_reference_id uuid references public.source_references (id) on delete restrict,
  source_locator text check (length(source_locator) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, code)
);
create trigger idea_library_touch before update on public.idea_library for each row execute function app.touch_updated_at();

create function app.idea_library_scope_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.pillar_id is not null and not exists (
    select 1 from public.brand_axes where id = new.pillar_id and brand_id = new.brand_id and kind = 'pillar') then
    raise exception 'El pilar pertenece a otro cliente' using errcode = 'CO403';
  end if;
  if new.territory_id is not null and not exists (
    select 1 from public.brand_axes where id = new.territory_id and brand_id = new.brand_id and kind = 'territory') then
    raise exception 'El territorio pertenece a otro cliente' using errcode = 'CO403';
  end if;
  if new.source_reference_id is not null and not app.source_in_brand(new.source_reference_id, new.brand_id) then
    raise exception 'La fuente pertenece a otro cliente' using errcode = 'CO403';
  end if;
  return new;
end $$;
create trigger idea_library_scope_check before insert or update on public.idea_library
  for each row execute function app.idea_library_scope_check();

-- Pieza creada desde la biblioteca: el uso previo se deriva de aquí (sin contador duplicado).
alter table public.content_pieces
  add column library_idea_id uuid references public.idea_library (id) on delete restrict;
create index content_pieces_library_idea on public.content_pieces (library_idea_id) where library_idea_id is not null;

create function app.content_pieces_library_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.library_idea_id is not null and not exists (
    select 1 from public.idea_library l join public.accounts a on a.brand_id = l.brand_id
    where l.id = new.library_idea_id and a.id = new.account_id) then
    raise exception 'La idea de biblioteca pertenece a otro cliente' using errcode = 'CO403';
  end if;
  return new;
end $$;
create trigger content_pieces_library_check before insert or update of library_idea_id, account_id on public.content_pieces
  for each row execute function app.content_pieces_library_check();

-- Content Package --------------------------------------------------------------

alter table public.review_packets
  add column package jsonb check (package is null or (jsonb_typeof(package) = 'object' and octet_length(package::text) <= 200000));

alter table public.claims
  add column evidence_class text check (evidence_class in
    ('observation', 'institutional', 'educational_general', 'specialized', 'creative_metaphor')),
  add column generated boolean not null default false;

-- Auditoría técnica de generación -----------------------------------------------

create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  content_piece_id uuid references public.content_pieces (id) on delete restrict,
  stage text not null check (stage in ('classify', 'develop', 'ideas', 'concept', 'package')),
  provider text not null check (length(provider) <= 40),
  model text check (length(model) <= 80),
  input_hash text check (input_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('succeeded', 'failed', 'invalid_output', 'not_configured', 'refused')),
  error_code text check (length(error_code) <= 80),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index generation_runs_brand on public.generation_runs (brand_id, created_at desc);
create trigger generation_runs_append_only before update or delete on public.generation_runs
  for each row execute function app.reject_history_mutation();

-- Acceso: solo lectura bajo RLS; escrituras por comandos.
revoke all on table public.idea_library, public.generation_runs from public, anon, authenticated;
grant select on table public.idea_library, public.generation_runs to authenticated;
alter table public.idea_library enable row level security;
alter table public.generation_runs enable row level security;
create policy idea_library_select_authorized on public.idea_library for select to authenticated using (app.is_authorized());
create policy generation_runs_select_authorized on public.generation_runs for select to authenticated using (app.is_authorized());

-- Comandos -------------------------------------------------------------------------

/** Registra una llamada al proveedor (éxito o fallo). Nunca guarda prompts ni contexto. */
create function public.record_generation_run(
  p_brand_id uuid, p_piece_id uuid, p_stage text, p_provider text, p_model text, p_input_hash text,
  p_status text, p_error_code text, p_input_tokens integer, p_output_tokens integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_id uuid;
begin
  perform app.require_generation(p_brand_id);
  if p_piece_id is not null and not exists (
    select 1 from public.content_pieces p join public.accounts a on a.id = p.account_id
    where p.id = p_piece_id and a.brand_id = p_brand_id) then
    perform app.fail('La pieza pertenece a otro cliente', 'CO403');
  end if;
  insert into public.generation_runs (brand_id, content_piece_id, stage, provider, model, input_hash, status, error_code,
    input_tokens, output_tokens, actor_id)
  values (p_brand_id, p_piece_id, p_stage, p_provider, nullif(p_model, ''), nullif(p_input_hash, ''), p_status,
    nullif(p_error_code, ''), p_input_tokens, p_output_tokens, v_uid)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'run_id', v_id);
end $$;

create function app.concept_text(p_concept jsonb, p_key text, p_max integer) returns text
language sql immutable set search_path = '' as $$
  select left(nullif(btrim(p_concept->>p_key), ''), p_max)
$$;

/**
 * Stage A aceptada: crea la pieza (borrador planeado en su día) con el concepto en su Review Packet.
 * Nunca aprueba. Una sola pieza por aceptación (idempotente por request_id).
 */
create function public.create_generated_piece(
  p_request_id uuid, p_account_id uuid, p_planned_date date, p_origin text, p_title text, p_idea text,
  p_format_key text, p_production_mode_key text, p_pillar_id uuid, p_territory_id uuid,
  p_library_idea_id uuid, p_concept jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_brand uuid;
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  select a.brand_id into v_brand from public.accounts a where a.id = p_account_id and a.active for share;
  if not found then perform app.fail('La cuenta no existe o está inactiva'); end if;
  perform app.require_generation(v_brand);
  if p_origin not in ('own_idea', 'develop', 'generate', 'library') then perform app.fail('Modo de inicio no válido'); end if;
  if (p_origin = 'library') <> (p_library_idea_id is not null) then
    perform app.fail('Una pieza de biblioteca necesita su idea de origen');
  end if;
  if p_concept is null or jsonb_typeof(p_concept) <> 'object' or octet_length(p_concept::text) > 20000 then
    perform app.fail('Concepto inválido');
  end if;
  perform app.require_assignable_day(p_planned_date);
  if not exists (select 1 from public.content_formats where key = p_format_key and active) then
    perform app.fail('Elige un formato disponible');
  end if;
  if not exists (select 1 from public.production_modes where key = p_production_mode_key and active) then
    perform app.fail('Elige un modo de producción disponible');
  end if;

  insert into public.content_pieces
    (account_id, title, bucket, ownership, production_status, idea, origin, format_key, production_mode_key,
     pillar_id, territory_id, content_origin, material_status, objective, audience, library_idea_id)
  values
    (p_account_id, app.require_text(p_title, 'Título'), 'feed', 'local', 'planned', nullif(btrim(p_idea), ''), p_origin,
     p_format_key, p_production_mode_key, p_pillar_id, p_territory_id, 'organic', 'not_required',
     app.concept_text(p_concept, 'objective', 2000), app.concept_text(p_concept, 'audience', 1000), p_library_idea_id)
  returning id into v_id;
  insert into public.planning_assignments (content_piece_id, week_start, planned_date)
  values (v_id, app.week_start(p_planned_date), p_planned_date);
  insert into public.review_packets (content_piece_id, what_is_it, why_it_exists, preview_kind, package)
  values (v_id, app.concept_text(p_concept, 'idea', 2000), app.concept_text(p_concept, 'central_message', 2000), 'text',
          jsonb_build_object('concept', p_concept));
  return app.log_event(p_request_id, v_uid, 'piece_generated', v_id, null, 'Creada con el generador editorial', null,
    jsonb_build_object('piece_id', v_id, 'planned_date', p_planned_date, 'origin', p_origin, 'library_idea_id', p_library_idea_id));
end $$;

/** Regenerar concepto de una pieza existente. El paquete anterior queda en el historial del evento. */
create function public.save_generated_concept(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_title text, p_idea text,
  p_pillar_id uuid, p_territory_id uuid, p_concept jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_before jsonb;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_generation((select brand_id from public.accounts where id = v_piece.account_id));
  perform app.require_material_editable(v_piece);
  if p_concept is null or jsonb_typeof(p_concept) <> 'object' or octet_length(p_concept::text) > 20000 then
    perform app.fail('Concepto inválido');
  end if;
  select package into v_before from public.review_packets where content_piece_id = p_piece_id;
  update public.content_pieces set
    title = app.require_text(p_title, 'Título'), idea = nullif(btrim(p_idea), ''),
    pillar_id = p_pillar_id, territory_id = p_territory_id,
    objective = app.concept_text(p_concept, 'objective', 2000), audience = app.concept_text(p_concept, 'audience', 1000)
  where id = p_piece_id;
  insert into public.review_packets as rp (content_piece_id, what_is_it, why_it_exists, preview_kind, package)
  values (p_piece_id, app.concept_text(p_concept, 'idea', 2000), app.concept_text(p_concept, 'central_message', 2000), 'text',
          jsonb_build_object('concept', p_concept))
  on conflict (content_piece_id) do update set
    what_is_it = excluded.what_is_it, why_it_exists = excluded.why_it_exists, package = excluded.package, version = rp.version + 1;
  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'concept_regenerated', p_piece_id, null, null,
    jsonb_build_object('package', v_before), jsonb_build_object('piece_id', p_piece_id));
end $$;

/**
 * Stage B: guarda el paquete validado, sus claims (reemplaza solo los generados pendientes) y
 * dependencias (añade las que falten; nunca borra). Todo en una transacción. Nunca aprueba.
 */
create function public.save_generated_package(
  p_request_id uuid, p_piece_id uuid, p_expected_version integer, p_package jsonb, p_words jsonb,
  p_claims jsonb, p_dependencies jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_piece public.content_pieces;
  v_before jsonb;
  c jsonb;
  d text;
  v_source uuid;
begin
  if v_replay is not null then return v_replay; end if;
  v_piece := app.lock_piece(p_piece_id);
  perform app.check_version(v_piece.version, p_expected_version);
  perform app.require_generation((select brand_id from public.accounts where id = v_piece.account_id));
  perform app.require_material_editable(v_piece);
  if p_package is null or jsonb_typeof(p_package) <> 'object' or octet_length(p_package::text) > 200000 then
    perform app.fail('Paquete inválido');
  end if;
  perform app.validate_words(coalesce(p_words, '{}'::jsonb));
  if jsonb_typeof(coalesce(p_claims, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_claims, '[]'::jsonb)) > 30 then
    perform app.fail('Claims inválidos');
  end if;
  if jsonb_typeof(coalesce(p_dependencies, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_dependencies, '[]'::jsonb)) > 10 then
    perform app.fail('Dependencias inválidas');
  end if;

  select package into v_before from public.review_packets where content_piece_id = p_piece_id;
  insert into public.review_packets as rp (content_piece_id, what_is_it, why_it_exists, words, preview_kind, package)
  values (p_piece_id, app.concept_text(p_package->'concept', 'idea', 2000),
          app.concept_text(p_package, 'central_message', 2000), coalesce(p_words, '{}'::jsonb), 'text', p_package)
  on conflict (content_piece_id) do update set
    what_is_it = coalesce(excluded.what_is_it, rp.what_is_it), why_it_exists = coalesce(excluded.why_it_exists, rp.why_it_exists),
    words = excluded.words, preview_kind = coalesce(rp.preview_kind, 'text'), package = excluded.package,
    claims_checked = false, dependencies_checked = false, version = rp.version + 1;

  delete from public.claims where content_piece_id = p_piece_id and generated and verification_status = 'pending';
  for c in select * from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) loop
    v_source := nullif(c->>'source_reference_id', '')::uuid;
    perform app.require_source_in_scope(v_source, v_piece);
    insert into public.claims (content_piece_id, statement, claim_kind, source_reference_id, source_locator,
      evidence_class, on_screen_credit, generated)
    values (p_piece_id, app.require_text(c->>'statement', 'El claim'), 'fact', v_source,
      left(nullif(btrim(c->>'source_locator'), ''), 1000), c->>'evidence_class',
      left(nullif(btrim(c->>'on_screen_credit'), ''), 300), true);
  end loop;

  for d in select jsonb_array_elements_text(coalesce(p_dependencies, '[]'::jsonb)) loop
    if not exists (select 1 from public.approval_dependencies where content_piece_id = p_piece_id and label = btrim(d)) then
      insert into public.approval_dependencies (content_piece_id, label, required)
      values (p_piece_id, app.require_text(d, 'La dependencia'), true);
    end if;
  end loop;

  perform app.bump_revision(p_piece_id);
  return app.log_event(p_request_id, v_uid, 'package_generated', p_piece_id, null, null,
    jsonb_build_object('package', v_before), jsonb_build_object('piece_id', p_piece_id));
end $$;

revoke all on function app.brand_can_generate(uuid), app.require_generation(uuid), app.idea_library_scope_check(),
  app.content_pieces_library_check(), app.concept_text(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.record_generation_run(uuid, uuid, text, text, text, text, text, text, integer, integer) from public, anon;
revoke all on function public.create_generated_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_generated_concept(uuid, uuid, integer, text, text, uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_generated_package(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.record_generation_run(uuid, uuid, text, text, text, text, text, text, integer, integer) to authenticated;
grant execute on function public.create_generated_piece(uuid, uuid, date, text, text, text, text, text, uuid, uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_generated_concept(uuid, uuid, integer, text, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.save_generated_package(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb) to authenticated;
