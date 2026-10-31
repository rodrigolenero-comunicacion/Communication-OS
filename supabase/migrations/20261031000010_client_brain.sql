-- Content OS V0.3 — Client Brain + Sources. Aditiva; no modifica migraciones anteriores.
--
-- Reutilización (ADR-005):
-- * Source = public.source_references con relation_kind 'context_reference' y ámbito de
--   cliente. Se amplía con metadatos documentales y estado. Los claims de las piezas ya la usan.
-- * Pilares y territorios siguen en public.brand_axes (se añade su fuente).
-- * Créditos de pieza = public.claims (+ on_screen_credit).
-- * Historial = public.operation_events.
-- * Nuevo: public.brain_entries (conocimiento estructurado por cliente).

-- Sources ------------------------------------------------------------------

alter table public.source_references
  add column institution text check (length(btrim(institution)) between 1 and 200),
  add column source_type text not null default 'reference'
    check (source_type in ('institutional_document', 'internal_system', 'web', 'research', 'decision', 'reference', 'other')),
  add column document_name text check (length(btrim(document_name)) between 1 and 200),
  add column document_version text check (length(btrim(document_version)) between 1 and 40),
  add column accessed_at date,
  add column published_at date,
  add column status text not null default 'active' check (status in ('active', 'superseded', 'provisional', 'archived')),
  add column notes text check (length(notes) <= 4000),
  add column version integer not null default 1 check (version > 0),
  add column updated_at timestamptz not null default now();

create trigger source_references_touch before update on public.source_references
  for each row execute function app.touch_updated_at();

alter table public.claims
  add column on_screen_credit text check (length(btrim(on_screen_credit)) between 1 and 300);

-- Una fuente es válida para un cliente si es de ese cliente, de una de sus cuentas o pública general.
create function app.source_in_brand(p_source_id uuid, p_brand_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.source_references r
    left join public.accounts a on a.id = r.account_id
    where r.id = p_source_id and r.relation_kind = 'context_reference'
      and ((r.scope_kind = 'brand' and r.brand_id = p_brand_id)
        or (r.scope_kind = 'account' and a.brand_id = p_brand_id)
        or r.scope_kind = 'public_general')
  )
$$;

-- Pilares y territorios: trazabilidad a su fuente --------------------------

alter table public.brand_axes
  add column source_reference_id uuid references public.source_references (id) on delete restrict;

create function app.brand_axes_source_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.source_reference_id is not null and not app.source_in_brand(new.source_reference_id, new.brand_id) then
    raise exception 'La fuente del eje pertenece a otro cliente' using errcode = 'CO403';
  end if;
  return new;
end $$;
create trigger brand_axes_source_check before insert or update of source_reference_id, brand_id on public.brand_axes
  for each row execute function app.brand_axes_source_check();

-- Brain entries --------------------------------------------------------------

create table public.brain_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  account_id uuid references public.accounts (id) on delete restrict, -- opcional: entrada específica de una cuenta
  category text not null check (category in (
    'identity', 'audience', 'segment', 'objective', 'strategy', 'voice',
    'editorial_rule', 'production_rule', 'evidence_rule', 'review_rule',
    'constraint', 'claim', 'learning')),
  key text check (key ~ '^[a-z0-9_]+$' and length(key) <= 60),
  title text not null check (length(btrim(title)) between 1 and 200),
  content text check (length(content) <= 8000),
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  provisional boolean not null default false,
  claim_status text check (claim_status in ('confirmed', 'provisional', 'unsupported')),
  source_reference_id uuid references public.source_references (id) on delete restrict,
  source_locator text check (length(source_locator) <= 1000),
  valid_from date,
  valid_until date,
  sort integer not null default 0,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_entries_claim_status check ((category = 'claim') = (claim_status is not null)),
  constraint brain_entries_claim_provisional check (category <> 'claim' or provisional = (claim_status = 'provisional')),
  constraint brain_entries_validity check (valid_until is null or valid_from is null or valid_until > valid_from)
);
create index brain_entries_brand_category on public.brain_entries (brand_id, category, status, sort);
create unique index brain_entries_unique_key on public.brain_entries (brand_id, category, key) where key is not null and status = 'active';
create trigger brain_entries_touch before update on public.brain_entries for each row execute function app.touch_updated_at();

-- Aislamiento entre clientes en la base: cuenta y fuente deben ser del mismo cliente.
create function app.brain_entries_scope_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and brand_id = new.brand_id
  ) then
    raise exception 'La cuenta pertenece a otro cliente' using errcode = 'CO403';
  end if;
  if new.source_reference_id is not null and not app.source_in_brand(new.source_reference_id, new.brand_id) then
    raise exception 'La fuente pertenece a otro cliente' using errcode = 'CO403';
  end if;
  return new;
end $$;
create trigger brain_entries_scope_check before insert or update on public.brain_entries
  for each row execute function app.brain_entries_scope_check();

revoke all on table public.brain_entries from public, anon, authenticated;
grant select on table public.brain_entries to authenticated;
alter table public.brain_entries enable row level security;
create policy brain_entries_select_authorized on public.brain_entries for select to authenticated using (app.is_authorized());

-- Comandos -------------------------------------------------------------------

create function public.upsert_brand_source(
  p_request_id uuid, p_source_id uuid, p_expected_version integer, p_brand_id uuid,
  p_title text, p_institution text, p_source_type text, p_source_system text, p_url text,
  p_document_name text, p_document_version text, p_accessed_at date, p_published_at date,
  p_status text, p_notes text, p_locator text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_src public.source_references;
  v_id uuid := p_source_id;
begin
  if v_replay is not null then return v_replay; end if;
  if v_id is null then
    if not exists (select 1 from public.brands where id = p_brand_id) then perform app.fail('Cliente no encontrado', 'CO404'); end if;
    insert into public.source_references
      (relation_kind, scope_kind, brand_id, source_system, title, institution, source_type, source_url,
       document_name, document_version, accessed_at, published_at, status, notes, locator)
    values
      ('context_reference', 'brand', p_brand_id, coalesce(nullif(p_source_system, ''), 'manual'),
       app.require_text(p_title, 'El título'), nullif(btrim(p_institution), ''), coalesce(nullif(p_source_type, ''), 'reference'),
       nullif(btrim(p_url), ''), nullif(btrim(p_document_name), ''), nullif(btrim(p_document_version), ''),
       p_accessed_at, p_published_at, coalesce(nullif(p_status, ''), 'active'), nullif(btrim(p_notes), ''), nullif(btrim(p_locator), ''))
    returning id into v_id;
  else
    select * into v_src from public.source_references where id = v_id for update;
    if not found or v_src.relation_kind <> 'context_reference' then perform app.fail('Fuente no encontrada', 'CO404'); end if;
    if v_src.brand_id is distinct from p_brand_id then
      perform app.fail('La fuente pertenece a otro ámbito; no se traslada entre clientes', 'CO403');
    end if;
    perform app.check_version(v_src.version, p_expected_version);
    update public.source_references set
      source_system = coalesce(nullif(p_source_system, ''), source_system), title = app.require_text(p_title, 'El título'),
      institution = nullif(btrim(p_institution), ''), source_type = coalesce(nullif(p_source_type, ''), source_type),
      source_url = nullif(btrim(p_url), ''), document_name = nullif(btrim(p_document_name), ''),
      document_version = nullif(btrim(p_document_version), ''), accessed_at = p_accessed_at, published_at = p_published_at,
      status = coalesce(nullif(p_status, ''), status), notes = nullif(btrim(p_notes), ''), locator = nullif(btrim(p_locator), ''),
      version = version + 1
    where id = v_id;
  end if;
  return app.log_event(p_request_id, v_uid, 'brand_source_saved', null, null, null,
    case when v_src.id is not null then to_jsonb(v_src) end, jsonb_build_object('source_reference_id', v_id));
end $$;

create function public.upsert_brain_entry(
  p_request_id uuid, p_entry_id uuid, p_expected_version integer, p_brand_id uuid, p_account_id uuid,
  p_category text, p_key text, p_title text, p_content text, p_status text, p_provisional boolean,
  p_claim_status text, p_source_reference_id uuid, p_source_locator text, p_valid_from date, p_valid_until date, p_sort integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_entry public.brain_entries;
  v_id uuid := p_entry_id;
  v_provisional boolean := case when p_category = 'claim' then coalesce(p_claim_status = 'provisional', false) else coalesce(p_provisional, false) end;
begin
  if v_replay is not null then return v_replay; end if;
  if v_id is null then
    if not exists (select 1 from public.brands where id = p_brand_id) then perform app.fail('Cliente no encontrado', 'CO404'); end if;
    insert into public.brain_entries
      (brand_id, account_id, category, key, title, content, status, provisional, claim_status,
       source_reference_id, source_locator, valid_from, valid_until, sort)
    values
      (p_brand_id, p_account_id, p_category, nullif(p_key, ''), app.require_text(p_title, 'El título'), nullif(btrim(p_content), ''),
       coalesce(nullif(p_status, ''), 'active'), v_provisional, nullif(p_claim_status, ''),
       p_source_reference_id, nullif(btrim(p_source_locator), ''), p_valid_from, p_valid_until, coalesce(p_sort, 0))
    returning id into v_id;
  else
    select * into v_entry from public.brain_entries where id = v_id for update;
    if not found then perform app.fail('Entrada no encontrada', 'CO404'); end if;
    -- Cliente y categoría no cambian: la entrada no se traslada entre clientes.
    if v_entry.brand_id <> p_brand_id or v_entry.category <> p_category then
      perform app.fail('El cliente y la categoría de una entrada no se cambian', 'CO403');
    end if;
    perform app.check_version(v_entry.version, p_expected_version);
    update public.brain_entries set
      account_id = p_account_id, key = nullif(p_key, ''), title = app.require_text(p_title, 'El título'),
      content = nullif(btrim(p_content), ''), status = coalesce(nullif(p_status, ''), status), provisional = v_provisional,
      claim_status = nullif(p_claim_status, ''), source_reference_id = p_source_reference_id,
      source_locator = nullif(btrim(p_source_locator), ''), valid_from = p_valid_from, valid_until = p_valid_until,
      sort = coalesce(p_sort, 0), version = version + 1
    where id = v_id;
  end if;
  return app.log_event(p_request_id, v_uid, 'brain_entry_saved', null, null, null,
    case when v_entry.id is not null then to_jsonb(v_entry) end, jsonb_build_object('entry_id', v_id));
end $$;

revoke all on function app.source_in_brand(uuid, uuid) from public, anon, authenticated;
revoke all on function app.brand_axes_source_check() from public, anon, authenticated;
revoke all on function app.brain_entries_scope_check() from public, anon, authenticated;
revoke all on function public.upsert_brand_source(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, date, date, text, text, text) from public, anon;
revoke all on function public.upsert_brain_entry(uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean, text, uuid, text, date, date, integer) from public, anon;
grant execute on function public.upsert_brand_source(uuid, uuid, integer, uuid, text, text, text, text, text, text, text, date, date, text, text, text) to authenticated;
grant execute on function public.upsert_brain_entry(uuid, uuid, integer, uuid, uuid, text, text, text, text, text, boolean, text, uuid, text, date, date, integer) to authenticated;
