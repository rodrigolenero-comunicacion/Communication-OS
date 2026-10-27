-- Content OS V0.1 — plantillas de pieza y creación rápida.
-- Las plantillas son configuración editable del propietario: prellenan lo
-- repetitivo (objetivo, audiencia, experiencia, spec, formato) y dan preguntas
-- guía para el texto creativo. No crean contenido aprobado ni deciden nada.

create table public.piece_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts (id) on delete restrict, -- null = general
  category text not null check (category in ('conectar', 'educativo', 'cobertura', 'institucional', 'promocional')),
  name text not null check (length(btrim(name)) between 1 and 120),
  content_type text check (length(content_type) <= 80),
  suggested_format text check (suggested_format in ('post', 'carousel', 'reel', 'video', 'story', 'other')),
  objective text check (length(objective) <= 2000),
  audience text check (length(audience) <= 1000),
  experience text check (length(experience) <= 4000),
  spec_text text check (length(spec_text) <= 20000),
  words_guide jsonb not null default '{}'::jsonb check (jsonb_typeof(words_guide) = 'object'),
  is_draft boolean not null default true,
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index piece_templates_unique_name
  on public.piece_templates (coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid), category, lower(name));
create trigger piece_templates_touch before update on public.piece_templates
  for each row execute function app.touch_updated_at();

alter table public.content_pieces
  add column category text check (category in ('conectar', 'educativo', 'cobertura', 'institucional', 'promocional')),
  add column template_id uuid references public.piece_templates (id) on delete restrict;

revoke all on table public.piece_templates from public, anon, authenticated;
grant select on table public.piece_templates to authenticated;
alter table public.piece_templates enable row level security;
create policy piece_templates_select_authorized on public.piece_templates
  for select to authenticated using (app.is_authorized());

-- Comandos -------------------------------------------------------------------

create function app.validate_words_guide(p_guide jsonb) returns void
language plpgsql immutable set search_path = '' as $$
begin
  perform app.validate_words(p_guide);
end $$;

create function public.upsert_template(
  p_request_id uuid, p_template_id uuid, p_expected_version integer, p_account_id uuid,
  p_category text, p_name text, p_content_type text, p_suggested_format text,
  p_objective text, p_audience text, p_experience text, p_spec_text text, p_words_guide jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_tpl public.piece_templates;
  v_id uuid := p_template_id;
begin
  if v_replay is not null then return v_replay; end if;
  perform app.validate_words_guide(coalesce(p_words_guide, '{}'::jsonb));
  if p_account_id is not null and not exists (select 1 from public.accounts where id = p_account_id) then
    perform app.fail('Cuenta no encontrada', 'CO404');
  end if;
  if v_id is null then
    insert into public.piece_templates
      (account_id, category, name, content_type, suggested_format, objective, audience, experience, spec_text, words_guide, is_draft)
    values
      (p_account_id, p_category, app.require_text(p_name, 'El nombre'), nullif(btrim(p_content_type), ''),
       nullif(p_suggested_format, ''), nullif(btrim(p_objective), ''), nullif(btrim(p_audience), ''),
       nullif(btrim(p_experience), ''), nullif(btrim(p_spec_text), ''), coalesce(p_words_guide, '{}'::jsonb), false)
    returning id into v_id;
  else
    select * into v_tpl from public.piece_templates where id = v_id for update;
    if not found then perform app.fail('Plantilla no encontrada', 'CO404'); end if;
    perform app.check_version(v_tpl.version, p_expected_version);
    update public.piece_templates set
      account_id = p_account_id, category = p_category, name = app.require_text(p_name, 'El nombre'),
      content_type = nullif(btrim(p_content_type), ''), suggested_format = nullif(p_suggested_format, ''),
      objective = nullif(btrim(p_objective), ''), audience = nullif(btrim(p_audience), ''),
      experience = nullif(btrim(p_experience), ''), spec_text = nullif(btrim(p_spec_text), ''),
      words_guide = coalesce(p_words_guide, '{}'::jsonb), is_draft = false, version = version + 1
    where id = v_id;
  end if;
  return app.log_event(p_request_id, v_uid, 'template_saved', null, null, null,
    case when v_tpl.id is not null then to_jsonb(v_tpl) end, jsonb_build_object('template_id', v_id));
end $$;

create function public.set_template_active(
  p_request_id uuid, p_template_id uuid, p_expected_version integer, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_tpl public.piece_templates;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_tpl from public.piece_templates where id = p_template_id for update;
  if not found then perform app.fail('Plantilla no encontrada', 'CO404'); end if;
  perform app.check_version(v_tpl.version, p_expected_version);
  update public.piece_templates set active = p_active, version = version + 1 where id = p_template_id;
  return app.log_event(p_request_id, v_uid, 'template_active_set', null, null, null,
    jsonb_build_object('active', v_tpl.active), jsonb_build_object('template_id', p_template_id, 'active', p_active));
end $$;

/**
 * Creación rápida: pieza local con plantilla opcional, semana opcional y etapa
 * inicial (idea, planned o in_production). Cada transición queda en el historial.
 * Las mismas validaciones que los comandos individuales.
 */
create function public.quick_create_piece(
  p_request_id uuid, p_account_id uuid, p_title text, p_bucket text,
  p_timing_mode text, p_fixed_date date, p_valid_from date, p_valid_until date,
  p_template_id uuid, p_week_start date, p_initial_stage text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_tpl public.piece_templates;
  v_piece public.content_pieces;
  v_stage text := coalesce(nullif(p_initial_stage, ''), 'idea');
begin
  if v_replay is not null then return v_replay; end if;
  if v_stage not in ('idea', 'planned', 'in_production') then perform app.fail('Etapa inicial no permitida'); end if;
  perform 1 from public.accounts where id = p_account_id and active for share;
  if not found then perform app.fail('La cuenta no existe o está inactiva'); end if;

  if p_template_id is not null then
    select * into v_tpl from public.piece_templates where id = p_template_id;
    if not found or not v_tpl.active then perform app.fail('La plantilla no existe o está desactivada'); end if;
    if v_tpl.account_id is not null and v_tpl.account_id <> p_account_id then
      perform app.fail('La plantilla pertenece a otra cuenta', 'CO403');
    end if;
  end if;

  insert into public.content_pieces
    (account_id, title, bucket, ownership, production_status, timing_mode, fixed_date, valid_from, valid_until,
     category, template_id, content_type, objective, audience, production_spec_text)
  values
    (p_account_id, app.require_text(p_title, 'Título'), p_bucket, 'local', v_stage,
     coalesce(p_timing_mode, 'flexible'), p_fixed_date, p_valid_from, p_valid_until,
     v_tpl.category, v_tpl.id, v_tpl.content_type, v_tpl.objective, v_tpl.audience, v_tpl.spec_text)
  returning * into v_piece;

  if v_tpl.id is not null and app.has_text(v_tpl.experience) then
    insert into public.review_packets (content_piece_id, experience) values (v_piece.id, v_tpl.experience);
  end if;

  if p_week_start is not null then
    if not app.is_monday(p_week_start) then perform app.fail('La semana se identifica por su lunes'); end if;
    if p_week_start < app.current_week() then perform app.fail('No se asignan semanas pasadas'); end if;
    if not app.week_fits_timing(v_piece, p_week_start) then
      perform app.fail('El timing de la pieza no es compatible con esa semana');
    end if;
    insert into public.planning_assignments (content_piece_id, week_start) values (v_piece.id, p_week_start);
  end if;

  -- Historial: creación y, si aplica, las transiciones y la asignación implícitas.
  if v_stage in ('planned', 'in_production') then
    perform app.log_event(gen_random_uuid(), v_uid, 'piece_planned', v_piece.id, null, 'Creación rápida', null,
      jsonb_build_object('production_status', 'planned'));
  end if;
  if v_stage = 'in_production' then
    perform app.log_event(gen_random_uuid(), v_uid, 'production_started', v_piece.id, null, 'Creación rápida', null,
      jsonb_build_object('production_status', 'in_production'));
  end if;
  if p_week_start is not null then
    perform app.log_event(gen_random_uuid(), v_uid, 'week_assigned', v_piece.id, null, 'Creación rápida', null,
      jsonb_build_object('week_start', p_week_start));
  end if;
  return app.log_event(p_request_id, v_uid, 'piece_created', v_piece.id, null, null, null,
    jsonb_build_object('piece_id', v_piece.id, 'template_id', v_tpl.id));
end $$;

revoke all on function app.validate_words_guide(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_template(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.set_template_active(uuid, uuid, integer, boolean) from public, anon;
revoke all on function public.quick_create_piece(uuid, uuid, text, text, text, date, date, date, uuid, date, text) from public, anon;
grant execute on function public.upsert_template(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.set_template_active(uuid, uuid, integer, boolean) to authenticated;
grant execute on function public.quick_create_piece(uuid, uuid, text, text, text, date, date, date, uuid, date, text) to authenticated;
