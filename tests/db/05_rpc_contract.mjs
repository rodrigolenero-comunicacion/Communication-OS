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
};
const overrides = {
  verify_claim: { status: "supported" },
  set_dependency_status: { status: "satisfied" },
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
process.exit(failures ? 1 : 0);
