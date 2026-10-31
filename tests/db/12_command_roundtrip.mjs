// Ida y vuelta UI → SQL: parámetros construidos por el registro de comandos de la app
// (igual que los formularios) y ejecutados contra las funciones reales con sesión autorizada.
import { execFileSync } from "node:child_process";
import { COMMANDS } from "../../src/application/commands.ts";

const db = process.argv[2];
const OWNER = "00000000-0000-0000-0000-00000000000a";
const auth = `set role authenticated; select set_config('request.jwt.claims', '{"sub":"${OWNER}"}', false);`;
const run = (sql) => execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-d", db, "-c", `${auth} ${sql}`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim().split("\n").at(-1);
const ok = (cond, label) => { console.log(`${cond ? "PASS" : "FAIL"}: ${label}`); if (!cond) process.exitCode = 1; };
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "boolean" ? String(v) : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`);

function call(command, fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const params = { p_request_id: crypto.randomUUID(), ...COMMANDS[command].params(fd) };
  const args = Object.entries(params).map(([k, v]) => `${k} => ${lit(v)}`).join(", ");
  return JSON.parse(run(`select public.${COMMANDS[command].rpc}(${args})`));
}
const field = (id, col) => run(`select coalesce(${col}::text, 'NULL') from public.content_pieces where id = '${id}'`);

const brand = JSON.parse(run(`select public.create_brand(gen_random_uuid(), 'Tec RT', 'tec-rt')`)).brand_id;
const account = JSON.parse(run(`select public.create_account(gen_random_uuid(), '${brand}', 'Campus', 'campus-rt', null)`)).account_id;
const version = run(`select version from public.brands where id = '${brand}'`);
run(`select public.set_brand_content_origins(gen_random_uuid(), '${brand}', ${version}, array['event_coverage','existing_material'])`);
const day = run(`select (date_trunc('week', (now() at time zone 'America/Mexico_City'))::date + 9)::text`);
const base = { account_id: account, planned_date: day, format_key: "carousel", bucket: "feed" };

// Evento exactamente como el formulario corto (sin modo de producción).
const ev = call("create_calendar_piece", { ...base, content_origin: "event_coverage", material_status: "pending", event_name: "Halloween", title: "Carrusel · Halloween", source_system: "st_hub" });
ok(ev.ok && field(ev.piece_id, "production_mode_key") === "NULL", "Cobertura/evento sin modo de producción se guarda con NULL");

const mat = call("create_calendar_piece", { ...base, content_origin: "existing_material", material_status: "available", title: "Reel Día MUN", source_url: "https://hub.example.test/m/1" });
ok(mat.ok && field(mat.piece_id, "production_mode_key") === "NULL", "Material existente sin modo de producción se guarda con NULL");

const org = call("create_calendar_piece", { ...base, content_origin: "organic", origin: "own_idea", title: "Orgánica", production_mode_key: "real_people" });
ok(org.ok && field(org.piece_id, "production_mode_key") === "real_people", "Orgánica con modo de producción se guarda");

const legacy = call("create_calendar_piece", { ...base, origin: "own_idea", title: "Orgánica V0.2", production_mode_key: "fully_graphic" });
ok(legacy.ok && field(legacy.piece_id, "content_origin") === "organic", "Forma V0.2 (sin origen) sigue creando orgánicas");

let organicWithoutMode = "no lanzó";
try { call("create_calendar_piece", { ...base, content_origin: "organic", title: "Sin modo" }); } catch (e) { organicWithoutMode = e.message; }
ok(/production_mode_key/.test(organicWithoutMode), "Orgánica sin modo de producción se rechaza en la app");
let sqlOrganic = "no lanzó";
try { run(`select public.create_calendar_piece(gen_random_uuid(), '${account}', '${day}', 'x', null, 'own_idea', 'reel', null, null, null, 'feed', 'organic')`); } catch (e) { sqlOrganic = String(e.stderr); }
ok(/modo de producción/.test(sqlOrganic), "Orgánica sin modo de producción se rechaza también en SQL");

// Edición y movimiento preservan NULL.
const v = () => run(`select version from public.content_pieces where id = '${ev.piece_id}'`);
call("update_piece", { piece_id: ev.piece_id, expected_version: v(), material_status: "available", needs_copy_present: "1", needs_copy: "on" });
ok(field(ev.piece_id, "production_mode_key") === "NULL" && field(ev.piece_id, "material_status") === "available", "Edición operativa preserva modo NULL");
const nextDay = run(`select ('${day}'::date + 1)::text`);
call("move_piece_day", { piece_id: ev.piece_id, expected_version: v(), date: nextDay });
ok(field(ev.piece_id, "production_mode_key") === "NULL" && run(`select planned_date::text from public.planning_assignments where content_piece_id = '${ev.piece_id}'`) === nextDay, "Mover de día preserva modo NULL");

// Orgánica existente: edición material y movimiento siguen funcionando.
const ov = () => run(`select version from public.content_pieces where id = '${org.piece_id}'`);
call("update_piece", { piece_id: org.piece_id, expected_version: ov(), title: "Orgánica editada", production_mode_key: "real_plus_graphics" });
call("move_piece_day", { piece_id: org.piece_id, expected_version: ov(), date: nextDay });
ok(field(org.piece_id, "title") === "Orgánica editada" && field(org.piece_id, "production_mode_key") === "real_plus_graphics", "Orgánica existente: edición y movimiento sin cambios");

// V0.3 Client Brain: fuentes y entradas tal como las envían los formularios.
const brain = (sql) => run(`select coalesce((${sql})::text, 'NULL')`);
const src = call("upsert_brand_source", { brand_id: brand, title: "Manual RT", institution: "Tec", source_type: "institutional_document",
  document_version: "v1", accessed_at: day, status: "active", notes: "" });
ok(src.ok && brain(`select status || '/' || source_type || '/' || accessed_at from public.source_references where id = '${src.source_reference_id}'`) === `active/institutional_document/${day}`,
  "Fuente del cliente se guarda con tipo, estado y fecha de consulta");
const entry = call("upsert_brain_entry", { brand_id: brand, category: "editorial_rule", title: "Regla RT", content: "Texto", status: "active",
  source_reference_id: src.source_reference_id, source_locator: "p. 3" });
ok(entry.ok && brain(`select source_reference_id from public.brain_entries where id = '${entry.entry_id}'`) === src.source_reference_id, "Entrada queda trazada a su fuente");
const ev2 = () => run(`select version from public.brain_entries where id = '${entry.entry_id}'`);
call("upsert_brain_entry", { entry_id: entry.entry_id, expected_version: ev2(), brand_id: brand, category: "editorial_rule", title: "Regla RT", status: "active", provisional: "on" });
ok(brain(`select provisional from public.brain_entries where id = '${entry.entry_id}'`) === "true", "Marcar provisional desde el formulario");
const claim = call("upsert_brain_entry", { brand_id: brand, category: "claim", title: "Dato", status: "active", claim_status: "provisional" });
ok(brain(`select provisional from public.brain_entries where id = '${claim.entry_id}'`) === "true", "Claim provisional queda marcado provisional");
const other = JSON.parse(run(`select public.create_brand(gen_random_uuid(), 'Otro RT', 'otro-rt')`)).brand_id;
let leak = "no lanzó";
try { call("upsert_brain_entry", { brand_id: other, category: "voice", title: "Fuga", status: "active", source_reference_id: src.source_reference_id }); } catch (e) { leak = String(e.stderr); }
ok(/otro cliente/.test(leak), "Una entrada de otro cliente no puede usar esta fuente");
