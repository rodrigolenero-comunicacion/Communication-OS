// Contrato UI ↔ SQL: cada comando del registro envía exactamente los parámetros
// que declara su función en PostgreSQL (nombres de PostgREST). Usa la base migrada.
import { execFileSync } from "node:child_process";
import { COMMANDS } from "../../src/application/commands.ts";

const db = process.argv[2];
const rows = execFileSync("psql", ["-X", "-At", "-F", "|", "-d", db, "-c",
  "select p.proname, array_to_string(p.proargnames, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'"],
  { encoding: "utf8" }).trim().split("\n");
const signatures = new Map(rows.map((r) => { const [name, args] = r.split("|"); return [name, new Set(args.split(","))]; }));

const UUID = "11111111-1111-4111-8111-111111111111";
const base = {
  piece_id: UUID, publication_id: UUID, account_id: UUID, brand_id: UUID, target_id: UUID, claim_id: UUID,
  dependency_id: UUID, source_reference_id: UUID, expected_version: "1", name: "n", slug: "s", title: "t",
  required_count: "1", buffer_target_days: "7", active_from: "2030-01-07", active_until: "2030-01-14",
  week_start: "2030-01-07", bucket: "feed", timing_mode: "flexible", channel_key: "instagram", format: "post",
  claim_kind: "fact", statement: "x", label: "x", mode: "not_required", reason: "r", comment: "c", note: "n",
  scheduled_date: "2030-01-08", scheduled_time: "10:00", published_date: "2030-01-08", published_time: "10:00",
  observed_date: "2030-01-08", observed_time: "10:00", observed_status: "unknown", source_state_raw: "x",
  scope_kind: "account", source_system: "st_hub", source_entity_type: "t", source_entity_id: "1", priority: "normal",
  category: "educativo", template_id: UUID, initial_stage: "idea", suggested_format: "post", active: "true",
  planned_date: "2030-01-08", idea: "i", origin: "own_idea", format_key: "reel", production_mode_key: "real_people",
  pillar_id: UUID, territory_id: UUID, date: "2030-01-09", make_flexible: "true", color: "blue", short_label: "X",
  axis_id: UUID, kind: "pillar", code: "P1", sort: "1", provisional: "true", source_note: "n",
  content_origin: "event_coverage", material_status: "pending", event_name: "Evento", needs_copy: "true",
  source_system: "st_hub", source_url: "https://hub.example.test/e/1", origin_event_coverage: "on",
};
const overrides = {
  verify_claim: { status: "supported" },
  set_dependency_status: { status: "satisfied" },
  upsert_brand_source: { source_id: UUID, source_type: "decision", status: "provisional", accessed_at: "2030-01-08" },
  upsert_brain_entry: { entry_id: UUID, category: "claim", status: "active", claim_status: "confirmed", key: "k" },
};

let failures = 0;
for (const [name, spec] of Object.entries(COMMANDS)) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...(overrides[name] ?? {}) })) fd.set(k, v);
  const sent = new Set(["p_request_id", ...Object.keys(spec.params(fd))]);
  const expected = signatures.get(spec.rpc);
  const same = expected && sent.size === expected.size && [...sent].every((k) => expected.has(k));
  console.log(`${same ? "PASS" : "FAIL"}: ${name} → ${spec.rpc}${same ? "" : ` envía [${[...sent]}] espera [${expected ? [...expected] : "función inexistente"}]`}`);
  if (!same) failures++;
}
// Forma de V0.2 (sin origen): la que usa la UI mientras 0009 no esté aplicada debe ser un
// subconjunto de la firma, y los parámetros que omite deben tener valor por defecto en SQL.
const defaults = Number(execFileSync("psql", ["-X", "-At", "-d", db, "-c",
  "select pronargdefaults from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname = 'create_calendar_piece'"],
  { encoding: "utf8" }).trim());
const legacy = new FormData();
for (const [k, v] of Object.entries(base)) if (!["content_origin"].includes(k)) legacy.set(k, v);
const legacyKeys = new Set(["p_request_id", ...Object.keys(COMMANDS.create_calendar_piece.params(legacy))]);
const full = signatures.get("create_calendar_piece");
const omitted = [...full].filter((k) => !legacyKeys.has(k));
const legacyOk = [...legacyKeys].every((k) => full.has(k)) && omitted.length === defaults;
console.log(`${legacyOk ? "PASS" : "FAIL"}: create_calendar_piece sin origen (V0.2) sigue siendo válida (${omitted.length} omitidos, ${defaults} con default)`);
if (!legacyOk) failures++;
process.exit(failures ? 1 : 0);
