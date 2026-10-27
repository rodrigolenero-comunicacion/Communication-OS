-- Content OS V0.1 — esquema relacional (docs/DATA_MODEL.md).
-- Requiere el esquema auth de Supabase (auth.users, auth.uid()).

create schema if not exists app;

-- Utilidades de tiempo editorial -------------------------------------------

create function app.local_date(p_instant timestamptz) returns date
language sql immutable parallel safe set search_path = '' as $$
  select (p_instant at time zone 'America/Mexico_City')::date
$$;

create function app.week_start(p_date date) returns date
language sql immutable parallel safe set search_path = '' as $$
  select p_date - (extract(isodow from p_date)::int - 1)
$$;

create function app.is_monday(p_date date) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select extract(isodow from p_date) = 1
$$;

create function app.is_http_url(p_url text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select p_url ~* '^https?://[^\s<>"]+$' and length(p_url) <= 2048
$$;

/** Texto no vacío; nunca NULL (un CHECK con NULL se daría por bueno). */
create function app.has_text(p_value text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(length(btrim(p_value)), 0) > 0
$$;

create function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Acceso -------------------------------------------------------------------

create table public.authorized_users (
  user_id uuid primary key references auth.users (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- V0.1 es single-user: como máximo una fila activa.
create unique index authorized_users_single_active on public.authorized_users ((true)) where active;

-- Portfolio ----------------------------------------------------------------

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  active boolean not null default true,
  context_notes text check (length(context_notes) <= 4000),
  coverage_mode text not null default 'unconfigured'
    check (coverage_mode in ('unconfigured', 'weekly', 'not_required')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]+$'),
  name text not null
);

insert into public.channels (key, name) values ('instagram', 'Instagram'), ('facebook', 'Facebook');

create table public.account_channels (
  account_id uuid not null references public.accounts (id) on delete restrict,
  channel_id uuid not null references public.channels (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, channel_id)
);

create table public.editorial_targets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  bucket text not null check (bucket in ('feed', 'stories')),
  required_count integer not null check (required_count > 0 and required_count <= 200),
  buffer_target_days integer not null check (buffer_target_days >= 0 and buffer_target_days <= 365),
  active_from date not null check (extract(isodow from active_from) = 1),
  active_until date check (active_until is null or (extract(isodow from active_until) = 1 and active_until > active_from)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index editorial_targets_account_bucket on public.editorial_targets (account_id, bucket, active_from);

-- Sin extensiones: el trigger bloquea la cuenta y comprueba solapamiento.
create function app.editorial_targets_no_overlap() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.accounts where id = new.account_id for update;
  if exists (
    select 1 from public.editorial_targets t
    where t.account_id = new.account_id
      and t.bucket = new.bucket
      and t.id <> new.id
      and daterange(t.active_from, t.active_until, '[)') && daterange(new.active_from, new.active_until, '[)')
  ) then
    raise exception 'La política se solapa con otra vigente para la misma cuenta y bucket'
      using errcode = 'CO422';
  end if;
  return new;
end $$;

create trigger editorial_targets_no_overlap
  before insert or update on public.editorial_targets
  for each row execute function app.editorial_targets_no_overlap();

-- Fuentes ------------------------------------------------------------------

create table public.content_pieces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  bucket text not null check (bucket in ('feed', 'stories')),
  content_type text check (length(content_type) <= 80),
  objective text check (length(objective) <= 2000),
  audience text check (length(audience) <= 1000),
  editorial_role text check (length(editorial_role) <= 200),
  campaign text check (length(campaign) <= 200),
  owner_label text check (length(owner_label) <= 120),
  due_date date,
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  ownership text not null default 'local' check (ownership in ('local', 'external')),
  production_status text check (production_status in ('idea', 'planned', 'in_production', 'in_review', 'changes_requested', 'approved')),
  on_hold boolean not null default false,
  archived_at timestamptz,
  content_revision integer not null default 1 check (content_revision > 0),
  approved_revision integer,
  approved_at timestamptz,
  timing_mode text not null default 'flexible' check (timing_mode in ('fixed', 'window', 'flexible')),
  fixed_date date,
  valid_from date,
  valid_until date,
  production_spec_text text check (length(production_spec_text) <= 20000),
  production_spec_url text check (production_spec_url is null or app.is_http_url(production_spec_url)),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_pieces_ownership_status check (
    (ownership = 'local' and production_status is not null)
    or (ownership = 'external' and production_status is null and approved_revision is null
        and approved_at is null and not on_hold)
  ),
  constraint content_pieces_approval_coherent check (
    ownership = 'external'
    or ((production_status = 'approved') = (approved_revision is not null and approved_at is not null))
  ),
  constraint content_pieces_approved_revision check (approved_revision is null or approved_revision <= content_revision),
  constraint content_pieces_hold_states check (not on_hold or production_status in ('in_review', 'approved')),
  constraint content_pieces_timing check (
    (timing_mode = 'fixed' and fixed_date is not null and valid_from is null and valid_until is null)
    or (timing_mode = 'window' and fixed_date is null and valid_from is not null and valid_until is not null and valid_from <= valid_until)
    or (timing_mode = 'flexible' and fixed_date is null and valid_from is null and valid_until is null)
  )
);
create index content_pieces_account_bucket_status on public.content_pieces (account_id, bucket, production_status, archived_at);

create table public.planning_assignments (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null unique references public.content_pieces (id) on delete restrict,
  week_start date not null check (extract(isodow from week_start) = 1),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planning_assignments_week on public.planning_assignments (week_start);

create table public.review_packets (
  content_piece_id uuid primary key references public.content_pieces (id) on delete restrict,
  what_is_it text check (length(what_is_it) <= 2000),
  why_it_exists text check (length(why_it_exists) <= 2000),
  experience text check (length(experience) <= 4000),
  words jsonb not null default '{}'::jsonb check (jsonb_typeof(words) = 'object'),
  frames jsonb not null default '[]'::jsonb check (jsonb_typeof(frames) = 'array' and jsonb_array_length(frames) <= 30),
  preview_kind text check (preview_kind in ('video', 'animatic', 'storyboard', 'frames', 'text')),
  preview_url text check (preview_url is null or app.is_http_url(preview_url)),
  claims_checked boolean not null default false,
  dependencies_checked boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_references (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid references public.content_pieces (id) on delete restrict,
  account_id uuid references public.accounts (id) on delete restrict,
  brand_id uuid references public.brands (id) on delete restrict,
  relation_kind text not null check (relation_kind in ('context_reference', 'external_mirror')),
  source_system text not null check (source_system in ('manual', 'st_hub', 'ijlv_editorial', 'solotu_cerebro')),
  source_entity_type text check (length(source_entity_type) <= 80),
  source_entity_id text check (length(source_entity_id) <= 200),
  source_url text check (source_url is null or app.is_http_url(source_url)),
  title text not null check (length(btrim(title)) between 1 and 200),
  locator text check (length(locator) <= 1000),
  scope_kind text not null check (scope_kind in ('account', 'brand', 'public_general')),
  created_at timestamptz not null default now(),
  constraint source_references_scope check (
    (scope_kind = 'account' and account_id is not null and brand_id is null)
    or (scope_kind = 'brand' and brand_id is not null and account_id is null)
    or (scope_kind = 'public_general' and account_id is null and brand_id is null)
  ),
  constraint source_references_mirror check (
    relation_kind = 'context_reference'
    or (content_piece_id is not null and scope_kind = 'account' and source_entity_type is not null
        and source_entity_id is not null and (source_url is not null or app.has_text(locator)))
  )
);
create unique index source_references_mirror_identity
  on public.source_references (source_system, source_entity_type, source_entity_id)
  where relation_kind = 'external_mirror';
create unique index source_references_one_mirror_per_piece
  on public.source_references (content_piece_id)
  where relation_kind = 'external_mirror';

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces (id) on delete restrict,
  statement text not null check (length(btrim(statement)) between 1 and 2000),
  claim_kind text not null check (claim_kind in ('fact', 'estimate', 'assumption')),
  source_reference_id uuid references public.source_references (id) on delete restrict,
  source_locator text check (length(source_locator) <= 1000),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'supported', 'unsupported')),
  verification_note text check (length(verification_note) <= 2000),
  verified_by uuid references auth.users (id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_supported_evidence check (
    verification_status <> 'supported'
    or (verified_by is not null and verified_at is not null
        and (source_reference_id is not null or app.has_text(source_locator)))
  )
);
create index claims_piece on public.claims (content_piece_id);

create table public.approval_dependencies (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces (id) on delete restrict,
  label text not null check (length(btrim(label)) between 1 and 300),
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'satisfied', 'not_applicable')),
  evidence_note text check (length(evidence_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_dependencies_evidence check (status = 'pending' or app.has_text(evidence_note))
);
create index approval_dependencies_piece on public.approval_dependencies (content_piece_id);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces (id) on delete restrict,
  content_revision integer not null check (content_revision > 0),
  action text not null check (action in ('approved', 'changes_requested', 'hold', 'released')),
  actor_id uuid not null references auth.users (id) on delete restrict,
  decided_at timestamptz not null default now(),
  comment text check (length(comment) <= 4000),
  packet_snapshot jsonb not null,
  request_id uuid not null unique,
  constraint review_decisions_comment_required check (
    action not in ('changes_requested', 'hold') or app.has_text(comment)
  )
);
create index review_decisions_piece on public.review_decisions (content_piece_id, decided_at);

create table public.publications (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid not null references public.content_pieces (id) on delete restrict,
  channel_id uuid not null references public.channels (id) on delete restrict,
  format text not null check (format in ('post', 'carousel', 'reel', 'video', 'story', 'other')),
  status text not null default 'unscheduled' check (status in ('unscheduled', 'scheduled', 'published', 'cancelled')),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text check (length(external_post_id) <= 200),
  external_url text check (external_url is null or app.is_http_url(external_url)),
  evidence_note text check (length(evidence_note) <= 2000),
  scheduling_method text not null default 'manual' check (scheduling_method = 'manual'),
  record_kind text not null default 'local_record' check (record_kind in ('local_record', 'source_observation')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_piece_id, channel_id, format),
  constraint publications_state check (
    (status = 'unscheduled' and scheduled_at is null and published_at is null)
    or (status = 'scheduled' and scheduled_at is not null and published_at is null)
    or (status = 'published' and published_at is not null
        and (external_url is not null or app.has_text(evidence_note)))
    or (status = 'cancelled' and published_at is null)
  )
);
create index publications_status_scheduled on public.publications (status, scheduled_at);
create index publications_piece on public.publications (content_piece_id);

create table public.source_observations (
  id uuid primary key default gen_random_uuid(),
  source_reference_id uuid not null references public.source_references (id) on delete restrict,
  source_state_raw text not null check (length(btrim(source_state_raw)) between 1 and 500),
  observed_status text check (observed_status in ('idea', 'planned', 'in_production', 'in_review', 'changes_requested', 'approved', 'unknown')),
  review_complete_confirmed boolean not null default false,
  observed_on_hold boolean not null default false,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users (id) on delete restrict,
  evidence_note text check (length(evidence_note) <= 2000),
  request_id uuid not null unique,
  constraint source_observations_not_future check (observed_at <= recorded_at),
  constraint source_observations_complete_only_approved check (not review_complete_confirmed or observed_status = 'approved'),
  constraint source_observations_approved_evidence check (observed_status is distinct from 'approved' or app.has_text(evidence_note))
);
create index source_observations_reference on public.source_observations (source_reference_id, observed_at desc, recorded_at desc);

create table public.operation_events (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid references public.content_pieces (id) on delete restrict,
  publication_id uuid references public.publications (id) on delete restrict,
  event_type text not null check (length(event_type) <= 60),
  actor_id uuid not null references auth.users (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  reason text check (length(reason) <= 2000),
  before_data jsonb,
  after_data jsonb,
  request_id uuid not null unique
);
create index operation_events_piece on public.operation_events (content_piece_id, occurred_at);
create index operation_events_publication on public.operation_events (publication_id, occurred_at);

-- updated_at ---------------------------------------------------------------

create trigger brands_touch before update on public.brands for each row execute function app.touch_updated_at();
create trigger accounts_touch before update on public.accounts for each row execute function app.touch_updated_at();
create trigger account_channels_touch before update on public.account_channels for each row execute function app.touch_updated_at();
create trigger editorial_targets_touch before update on public.editorial_targets for each row execute function app.touch_updated_at();
create trigger content_pieces_touch before update on public.content_pieces for each row execute function app.touch_updated_at();
create trigger planning_assignments_touch before update on public.planning_assignments for each row execute function app.touch_updated_at();
create trigger review_packets_touch before update on public.review_packets for each row execute function app.touch_updated_at();
create trigger claims_touch before update on public.claims for each row execute function app.touch_updated_at();
create trigger approval_dependencies_touch before update on public.approval_dependencies for each row execute function app.touch_updated_at();
create trigger publications_touch before update on public.publications for each row execute function app.touch_updated_at();
