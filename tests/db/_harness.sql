-- SOLO PRUEBAS LOCALES: aserciones e identidades ficticias.
create schema test;
grant usage on schema test to anon, authenticated;

create function test.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;

create function test.throws(p_sql text, p_code text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_code is null or sqlstate = p_code then
      raise notice 'PASS: % [%: %]', p_label, sqlstate, sqlerrm;
      return;
    end if;
    raise exception 'FAIL: % — esperado %, obtenido %: %', p_label, p_code, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % — no lanzó error', p_label;
end $$;
grant execute on all functions in schema test to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'intruder@example.test');
insert into public.authorized_users (user_id, active) values ('00000000-0000-0000-0000-00000000000a', true);
