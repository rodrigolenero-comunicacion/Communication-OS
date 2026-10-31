// Validación del registro de comandos (capa de aplicación) para create_calendar_piece.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, InputError } from "../../src/application/commands.ts";

const UUID = "11111111-1111-4111-8111-111111111111";
const build = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ account_id: UUID, planned_date: "2030-01-08", title: "t", format_key: "carousel", bucket: "feed", ...fields })) fd.set(k, v);
  return COMMANDS.create_calendar_piece.params(fd);
};

test("organic sin modo de producción falla", () => {
  assert.throws(() => build({ content_origin: "organic" }), InputError);
});

test("organic con modo de producción pasa", () => {
  assert.equal(build({ content_origin: "organic", production_mode_key: "real_people" }).p_production_mode_key, "real_people");
});

test("V0.2 sin origen (orgánico implícito) sigue exigiendo modo", () => {
  assert.throws(() => build({}), InputError);
  assert.equal(build({ production_mode_key: "fully_graphic" }).p_production_mode_key, "fully_graphic");
});

test("event_coverage sin modo de producción pasa con NULL", () => {
  const p = build({ content_origin: "event_coverage", material_status: "pending", event_name: "Halloween" });
  assert.equal(p.p_production_mode_key, null);
});

test("existing_material sin modo de producción pasa con NULL", () => {
  const p = build({ content_origin: "existing_material", material_status: "available" });
  assert.equal(p.p_production_mode_key, null);
});

test("event_coverage con modo inválido sigue rechazándose", () => {
  assert.throws(() => build({ content_origin: "event_coverage", event_name: "x", production_mode_key: "NO VALE" }), InputError);
});
