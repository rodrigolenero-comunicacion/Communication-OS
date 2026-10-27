-- Content OS V0.1 — helpers de comandos y comandos de portfolio/objetivos.
-- Códigos de error propios (SQLSTATE):
--   CO401 sin sesión o fuera de allowlist · CO403 operación prohibida
--   CO404 no encontrado · CO409 conflicto de versión · CO422 validación

-- Helpers -----------------------------------------------------------------

create function app.fail(p_message text, p_code text default 'CO422') returns void
language plpgsql set search_path = '' as $$
begin
  raise exception '%', p_message using errcode = p_code;
end $$;

create function app.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.authorized_users where user_id = v_uid and active
  ) then
    perform app.fail('Acceso no autorizado', 'CO401');
  end if;
  return v_uid;
end $$;

/**
 * Idempotencia: serializa por request_id y devuelve el resultado previo si el
 * comando ya se aplicó. Cada comando escribe su request_id en exactamente una
 * de las tablas de historial.
 */
create function app.replay(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
begin
  if p_request_id is null then
    perform app.fail('request_id es obligatorio');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));

  select coalesce(e.after_data, '{}'::jsonb) || jsonb_build_object('ok', true, 'replayed', true)
    into v_result
  from public.operation_events e where e.request_id = p_request_id;
  if found then return v_result; end if;

  select jsonb_build_object('ok', true, 'replayed', true, 'decision_id', d.id, 'piece_id', d.content_piece_id)
    into v_result
  from public.review_decisions d where d.request_id = p_request_id;
  if found then return v_result; end if;

  select jsonb_build_object('ok', true, 'replayed', true, 'observation_id', o.id)
    into v_result
  from public.source_observations o where o.request_id = p_request_id;
  if found then return v_result; end if;

  return null;
end $$;

create function app.check_version(p_current integer, p_expected integer) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_expected is null or p_current <> p_expected then
    perform app.fail('El registro cambió desde que lo abriste. Recarga para ver la versión actual.', 'CO409');
  end if;
end $$;

create function app.log_event(
  p_request_id uuid, p_actor uuid, p_event_type text,
  p_piece_id uuid, p_publication_id uuid, p_reason text,
  p_before jsonb, p_after jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.operation_events
    (request_id, actor_id, event_type, content_piece_id, publication_id, reason, before_data, after_data)
  values
    (p_request_id, p_actor, p_event_type, p_piece_id, p_publication_id, nullif(btrim(p_reason), ''), p_before, p_after);
  return coalesce(p_after, '{}'::jsonb) || jsonb_build_object('ok', true, 'replayed', false);
end $$;

create function app.current_week() returns date
language sql stable set search_path = '' as $$
  select app.week_start(app.local_date(now()))
$$;

create function app.require_text(p_value text, p_label text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if p_value is null or length(btrim(p_value)) = 0 then
    perform app.fail(p_label || ' es obligatorio');
  end if;
  return btrim(p_value);
end $$;

-- Sesión -------------------------------------------------------------------

create function public.whoami() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('user_id', auth.uid(), 'authorized', app.is_authorized())
$$;

-- Marcas y cuentas --------------------------------------------------------

create function public.create_brand(p_request_id uuid, p_name text, p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  insert into public.brands (name, slug) values (app.require_text(p_name, 'Nombre'), p_slug)
  returning id into v_id;
  return app.log_event(p_request_id, v_uid, 'brand_created', null, null, null, null,
    jsonb_build_object('brand_id', v_id));
end $$;

create function public.update_brand(
  p_request_id uuid, p_brand_id uuid, p_expected_version integer, p_name text, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_brand public.brands;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_brand from public.brands where id = p_brand_id for update;
  if not found then perform app.fail('Marca no encontrada', 'CO404'); end if;
  perform app.check_version(v_brand.version, p_expected_version);
  if not p_active and v_brand.active and exists (
    select 1 from public.accounts where brand_id = p_brand_id and active
  ) then
    perform app.fail('Desactiva primero las cuentas de esta marca de forma explícita');
  end if;
  update public.brands
     set name = app.require_text(p_name, 'Nombre'), active = p_active, version = version + 1
   where id = p_brand_id;
  return app.log_event(p_request_id, v_uid, 'brand_updated', null, null, null,
    to_jsonb(v_brand), jsonb_build_object('brand_id', p_brand_id));
end $$;

create function public.create_account(
  p_request_id uuid, p_brand_id uuid, p_name text, p_slug text, p_context_notes text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  if not exists (select 1 from public.brands where id = p_brand_id and active) then
    perform app.fail('La marca no existe o está inactiva');
  end if;
  insert into public.accounts (brand_id, name, slug, context_notes)
  values (p_brand_id, app.require_text(p_name, 'Nombre'), p_slug, nullif(btrim(p_context_notes), ''))
  returning id into v_id;
  return app.log_event(p_request_id, v_uid, 'account_created', null, null, null, null,
    jsonb_build_object('account_id', v_id));
end $$;

create function public.update_account(
  p_request_id uuid, p_account_id uuid, p_expected_version integer,
  p_name text, p_context_notes text, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_account public.accounts;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then perform app.fail('Cuenta no encontrada', 'CO404'); end if;
  perform app.check_version(v_account.version, p_expected_version);
  if p_active and not v_account.active
     and not exists (select 1 from public.brands where id = v_account.brand_id and active) then
    perform app.fail('No se puede activar una cuenta de una marca inactiva');
  end if;
  if not p_active and v_account.active and exists (
    select 1 from public.publications pub
    join public.content_pieces p on p.id = pub.content_piece_id
    where p.account_id = p_account_id and pub.status = 'scheduled'
  ) then
    perform app.fail('La cuenta tiene programaciones activas: confírmalas, reprográmalas o cancélalas antes de desactivarla');
  end if;
  update public.accounts
     set name = app.require_text(p_name, 'Nombre'),
         context_notes = nullif(btrim(p_context_notes), ''),
         active = p_active,
         version = version + 1
   where id = p_account_id;
  return app.log_event(p_request_id, v_uid, 'account_updated', null, null, null,
    to_jsonb(v_account), jsonb_build_object('account_id', p_account_id));
end $$;

create function public.set_account_channel(
  p_request_id uuid, p_account_id uuid, p_channel_key text, p_active boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_channel_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  perform 1 from public.accounts where id = p_account_id for update;
  if not found then perform app.fail('Cuenta no encontrada', 'CO404'); end if;
  select id into v_channel_id from public.channels where key = p_channel_key;
  if not found then perform app.fail('Canal desconocido'); end if;
  if not p_active and exists (
    select 1 from public.publications pub
    join public.content_pieces p on p.id = pub.content_piece_id
    where p.account_id = p_account_id and pub.channel_id = v_channel_id and pub.status = 'scheduled'
  ) then
    perform app.fail('Hay programaciones activas en este canal: resuélvelas antes de desactivarlo');
  end if;
  insert into public.account_channels (account_id, channel_id, active)
  values (p_account_id, v_channel_id, p_active)
  on conflict (account_id, channel_id) do update set active = excluded.active;
  return app.log_event(p_request_id, v_uid, 'account_channel_set', null, null, null, null,
    jsonb_build_object('account_id', p_account_id, 'channel', p_channel_key, 'active', p_active));
end $$;

-- Objetivos semanales -----------------------------------------------------

create function public.set_target_policy(
  p_request_id uuid, p_account_id uuid, p_bucket text,
  p_required_count integer, p_buffer_target_days integer, p_active_from date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_account public.accounts;
  v_same public.editorial_targets;
  v_open public.editorial_targets;
  v_id uuid;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then perform app.fail('Cuenta no encontrada', 'CO404'); end if;
  if not v_account.active then perform app.fail('La cuenta está inactiva'); end if;
  if p_active_from is null or not app.is_monday(p_active_from) then
    perform app.fail('La vigencia debe iniciar en lunes');
  end if;
  if p_active_from < app.current_week() then
    perform app.fail('No se reescriben semanas pasadas: la vigencia empieza como pronto el lunes de esta semana');
  end if;

  select * into v_same from public.editorial_targets
   where account_id = p_account_id and bucket = p_bucket and active_from = p_active_from;
  if found then
    update public.editorial_targets
       set required_count = p_required_count, buffer_target_days = p_buffer_target_days
     where id = v_same.id;
    update public.accounts set coverage_mode = 'weekly', version = version + 1 where id = p_account_id;
    return app.log_event(p_request_id, v_uid, 'target_updated', null, null, null,
      to_jsonb(v_same), jsonb_build_object('target_id', v_same.id));
  end if;

  if exists (
    select 1 from public.editorial_targets
     where account_id = p_account_id and bucket = p_bucket and active_from > p_active_from
  ) then
    perform app.fail('Existe una política posterior a esa fecha; termínala o edítala antes');
  end if;

  select * into v_open from public.editorial_targets
   where account_id = p_account_id and bucket = p_bucket
     and active_from < p_active_from and (active_until is null or active_until > p_active_from);
  if found then
    update public.editorial_targets set active_until = p_active_from where id = v_open.id;
  end if;

  insert into public.editorial_targets (account_id, bucket, required_count, buffer_target_days, active_from, active_until)
  values (p_account_id, p_bucket, p_required_count, p_buffer_target_days, p_active_from,
          case when v_open.id is not null then v_open.active_until end)
  returning id into v_id;
  update public.accounts set coverage_mode = 'weekly', version = version + 1 where id = p_account_id;
  return app.log_event(p_request_id, v_uid, 'target_created', null, null, null,
    case when v_open.id is not null then to_jsonb(v_open) end, jsonb_build_object('target_id', v_id));
end $$;

create function public.end_target_policy(p_request_id uuid, p_target_id uuid, p_active_until date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_target public.editorial_targets;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_target from public.editorial_targets where id = p_target_id;
  if not found then perform app.fail('Política no encontrada', 'CO404'); end if;
  perform 1 from public.accounts where id = v_target.account_id for update;
  if p_active_until is null or not app.is_monday(p_active_until) then
    perform app.fail('El fin de vigencia debe ser un lunes (límite exclusivo)');
  end if;
  if p_active_until < app.current_week() then
    perform app.fail('No se reescriben semanas pasadas');
  end if;
  if p_active_until <= v_target.active_from then
    -- Solo una política que aún no rige en semanas pasadas puede retirarse por completo.
    if v_target.active_from < app.current_week() then
      perform app.fail('La política ya rigió semanas pasadas; ciérrala en una fecha posterior a su inicio');
    end if;
    delete from public.editorial_targets where id = p_target_id;
    return app.log_event(p_request_id, v_uid, 'target_withdrawn', null, null, null,
      to_jsonb(v_target), jsonb_build_object('target_id', p_target_id));
  end if;
  update public.editorial_targets set active_until = p_active_until where id = p_target_id;
  return app.log_event(p_request_id, v_uid, 'target_ended', null, null, null,
    to_jsonb(v_target), jsonb_build_object('target_id', p_target_id, 'active_until', p_active_until));
end $$;

create function public.set_coverage_mode(
  p_request_id uuid, p_account_id uuid, p_expected_version integer, p_mode text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_replay jsonb := app.replay(p_request_id);
  v_account public.accounts;
begin
  if v_replay is not null then return v_replay; end if;
  select * into v_account from public.accounts where id = p_account_id for update;
  if not found then perform app.fail('Cuenta no encontrada', 'CO404'); end if;
  perform app.check_version(v_account.version, p_expected_version);
  if p_mode not in ('not_required', 'unconfigured') then
    perform app.fail('El modo semanal se activa al configurar un objetivo');
  end if;
  if exists (
    select 1 from public.editorial_targets
     where account_id = p_account_id and (active_until is null or active_until > app.current_week())
  ) then
    perform app.fail('Cierra explícitamente las políticas vigentes o futuras antes de cambiar el modo');
  end if;
  if p_mode = 'not_required' then
    perform app.require_text(p_reason, 'El motivo');
  end if;
  update public.accounts set coverage_mode = p_mode, version = version + 1 where id = p_account_id;
  return app.log_event(p_request_id, v_uid, 'coverage_mode_set', null, null, p_reason,
    jsonb_build_object('coverage_mode', v_account.coverage_mode),
    jsonb_build_object('account_id', p_account_id, 'coverage_mode', p_mode));
end $$;
