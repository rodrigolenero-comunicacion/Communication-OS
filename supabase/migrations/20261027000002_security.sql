-- Content OS V0.1 — acceso single-user, RLS y protección de escritura.
-- Regla: los roles de la API (anon, authenticated) solo LEEN tablas operativas
-- bajo RLS. Toda escritura pasa por comandos SECURITY DEFINER (migración 3)
-- que validan sesión, allowlist, inputs, ownership y versión.

-- Allowlist ---------------------------------------------------------------

create function app.is_authorized() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.authorized_users
    where user_id = auth.uid() and active
  )
$$;

revoke all on function app.is_authorized() from public;
grant usage on schema app to anon, authenticated;
grant execute on function app.is_authorized() to anon, authenticated;

-- Las funciones auxiliares de app.* no son API pública.
revoke execute on function app.local_date(timestamptz) from public;
revoke execute on function app.week_start(date) from public;
revoke execute on function app.is_monday(date) from public;
revoke execute on function app.touch_updated_at() from public;
revoke execute on function app.editorial_targets_no_overlap() from public;
-- is_http_url se usa en CHECK constraints evaluadas como el rol que escribe.
grant execute on function app.is_http_url(text) to anon, authenticated;
grant execute on function app.has_text(text) to anon, authenticated;

-- Historial append-only ------------------------------------------------------

create function app.reject_history_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'El historial es inmutable (% sobre %)', tg_op, tg_table_name
    using errcode = 'CO403';
end $$;
revoke execute on function app.reject_history_mutation() from public;

create trigger review_decisions_append_only before update or delete on public.review_decisions
  for each row execute function app.reject_history_mutation();
create trigger source_observations_append_only before update or delete on public.source_observations
  for each row execute function app.reject_history_mutation();
create trigger operation_events_append_only before update or delete on public.operation_events
  for each row execute function app.reject_history_mutation();
create trigger review_decisions_no_truncate before truncate on public.review_decisions
  for each statement execute function app.reject_history_mutation();
create trigger source_observations_no_truncate before truncate on public.source_observations
  for each statement execute function app.reject_history_mutation();
create trigger operation_events_no_truncate before truncate on public.operation_events
  for each statement execute function app.reject_history_mutation();

-- Privilegios y RLS -------------------------------------------------------

do $$
declare
  t text;
  operational text[] := array[
    'brands', 'accounts', 'channels', 'account_channels', 'editorial_targets',
    'content_pieces', 'planning_assignments', 'review_packets', 'source_references',
    'claims', 'approval_dependencies', 'review_decisions', 'publications',
    'source_observations', 'operation_events'
  ];
begin
  -- authorized_users: sin acceso directo desde la API; se consulta vía whoami().
  execute 'revoke all on table public.authorized_users from public, anon, authenticated';
  execute 'alter table public.authorized_users enable row level security';

  foreach t in array operational loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.is_authorized())',
      t || '_select_authorized', t
    );
  end loop;
end $$;

-- Las funciones nuevas en public no son ejecutables por defecto.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;
