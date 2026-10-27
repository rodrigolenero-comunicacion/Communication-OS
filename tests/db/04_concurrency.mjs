// S07, R21 y R22 con sesiones PostgreSQL concurrentes reales.
import { spawn } from "node:child_process";

const db = process.argv[2];
const OWNER = "00000000-0000-0000-0000-00000000000a";
const auth = `set role authenticated; select set_config('request.jwt.claims', '{"sub":"${OWNER}"}', false);`;

function psql(sql) {
  return new Promise((resolve) => {
    const child = spawn("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", sql]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}
const one = async (sql) => {
  const r = await psql(`${auth} ${sql}`);
  if (r.code !== 0) throw new Error(r.err);
  return r.out.split("\n").at(-1);
};
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${label}`);
  if (!cond) process.exitCode = 1;
};

const brand = await one(`select public.create_brand(gen_random_uuid(), 'C', 'c')->>'brand_id'`);
const account = await one(`select public.create_account(gen_random_uuid(), '${brand}', 'C', 'c', null)->>'account_id'`);
const w0 = await one(`select (date_trunc('week', (now() at time zone 'America/Mexico_City'))::date + 7)::text`);

// S07: dos políticas solapadas concurrentes (fechas distintas para que ambas pasen la validación previa).
const [a, b] = await Promise.all([
  psql(`${auth} begin; select public.set_target_policy(gen_random_uuid(), '${account}', 'feed', 3, 7, '${w0}'); select pg_sleep(0.5); commit;`),
  psql(`${auth} begin; select pg_sleep(0.1); select public.set_target_policy(gen_random_uuid(), '${account}', 'feed', 5, 7, ('${w0}'::date + 7)); commit;`),
]);
const overlaps = await one(`select count(*) from public.editorial_targets t1 join public.editorial_targets t2
  on t1.account_id = t2.account_id and t1.bucket = t2.bucket and t1.id < t2.id
  and daterange(t1.active_from, t1.active_until) && daterange(t2.active_from, t2.active_until)
  where t1.account_id = '${account}'`);
ok(overlaps === "0", `S07 escrituras concurrentes no dejan políticas solapadas (sesiones: ${a.code}/${b.code})`);

// R21 doble clic concurrente con el mismo request_id.
const piece = await one(`select public.create_piece(gen_random_uuid(), '${account}', 'Doble', 'feed', 'flexible', null, null, null)->>'piece_id'`);
const req = await one(`select gen_random_uuid()`);
const clicks = await Promise.all(
  [0, 1, 2].map(() => psql(`${auth} select public.plan_piece('${req}', '${piece}', 1)`)),
);
const events = await one(`select count(*) from public.operation_events where request_id = '${req}'`);
ok(clicks.every((c) => c.code === 0) && events === "1", "R21 tres envíos concurrentes con el mismo request_id producen un efecto");
ok((await one(`select version from public.content_pieces where id = '${piece}'`)) === "2", "R21 la versión solo avanza una vez");

// R22 dos aprobaciones concurrentes con la misma expected_version.
await one(`select public.start_production(gen_random_uuid(), '${piece}', 2)`);
await one(`select public.update_piece(gen_random_uuid(), '${piece}', 3, '{"objective":"o","audience":"a","production_spec_text":"s"}')`);
await one(`select public.upsert_review_packet(gen_random_uuid(), '${piece}', 4, '{"experience":"e","words":{"hook":"h"},"claims_checked":true,"dependencies_checked":true}')`);
await one(`select public.submit_review(gen_random_uuid(), '${piece}', 5)`);
const approvals = await Promise.all(
  [0, 1].map(() => psql(`${auth} select public.approve_piece(gen_random_uuid(), '${piece}', 6, null)`)),
);
const decisions = await one(`select count(*) from public.review_decisions where content_piece_id = '${piece}'`);
ok(
  approvals.filter((r) => r.code === 0).length === 1 && approvals.some((r) => /CO409|cambió/.test(r.err)) && decisions === "1",
  "R22 doble aprobación concurrente: una gana, la otra recibe conflicto",
);
