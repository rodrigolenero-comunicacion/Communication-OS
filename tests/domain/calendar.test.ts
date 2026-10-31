import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, cardStatus, isMonthKey, monthGrid } from "../../src/domain/calendar.ts";
import { pub } from "./fixture.ts";

test("rejilla de octubre 2026: empieza lunes 28 sep, termina domingo 1 nov", () => {
  const weeks = monthGrid("2026-10");
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0].date, "2026-09-28");
  assert.equal(weeks[0][0].inMonth, false);
  assert.equal(weeks[0][3].date, "2026-10-01");
  assert.equal(weeks[0][3].inMonth, true);
  assert.equal(weeks.at(-1)!.at(-1)!.date, "2026-11-01");
  assert.ok(weeks.every((w) => w.length === 7));
});

test("febrero que empieza en lunes ocupa 4 semanas exactas", () => {
  const weeks = monthGrid("2027-02"); // 1 feb 2027 es lunes
  assert.equal(weeks.length, 4);
  assert.ok(weeks.flat().every((d) => d.inMonth));
});

test("mes de 6 semanas", () => {
  assert.equal(monthGrid("2026-08").length, 6); // 1 ago 2026 es sábado
});

test("navegación entre meses cruza años", () => {
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.ok(isMonthKey("2026-10"));
  assert.ok(!isMonthKey("2026-13"));
  assert.ok(!isMonthKey("2026-1"));
});

test("estado de tarjeta derivado sin máquina paralela", () => {
  const base = { ownership: "local" as const, productionStatus: "approved" as const, onHold: false, publications: [] };
  assert.equal(cardStatus(base).key, "approved");
  assert.equal(cardStatus({ ...base, publications: [pub("a", { status: "scheduled", scheduledAt: new Date() })] }).key, "scheduled");
  assert.equal(
    cardStatus({ ...base, publications: [pub("a", { status: "scheduled" }), pub("b", { status: "published", publishedAt: new Date() })] }).key,
    "published",
  );
  assert.equal(cardStatus({ ...base, productionStatus: "in_review", onHold: true }).key, "held");
  assert.equal(cardStatus({ ...base, ownership: "external", productionStatus: null }).key, "external");
  assert.equal(cardStatus({ ...base, productionStatus: "in_review" }).symbol, "◐");
});

test("día de calendario: planeado, si no publicado, si no programado", async () => {
  const { calendarDateOf, canMoveByDrag } = await import("../../src/domain/calendar.ts");
  assert.equal(calendarDateOf({ plannedDate: "2026-11-04", publications: [] }), "2026-11-04");
  assert.equal(calendarDateOf({ plannedDate: null, publications: [] }), null);
  const sched = pub("s", { status: "scheduled", scheduledAt: new Date("2026-11-05T17:00:00Z") });
  const done = pub("p", { status: "published", publishedAt: new Date("2026-11-03T05:30:00Z") }); // 2 nov 23:30 CDMX
  assert.equal(calendarDateOf({ plannedDate: null, publications: [sched] }), "2026-11-05");
  assert.equal(calendarDateOf({ plannedDate: null, publications: [sched, done] }), "2026-11-02");
  assert.equal(canMoveByDrag({ archived: false, publications: [] }), true);
  assert.equal(canMoveByDrag({ archived: false, publications: [pub("u")] }), true);
  assert.equal(canMoveByDrag({ archived: false, publications: [sched] }), false);
  assert.equal(canMoveByDrag({ archived: false, publications: [done] }), false);
  assert.equal(canMoveByDrag({ archived: true, publications: [] }), false);
});

test("V0.2.1: etiqueta de origen y señal de material/copy derivadas", async () => {
  const { attentionBadge, originTag, enabledOrigins } = await import("../../src/domain/calendar.ts");
  assert.equal(originTag("event_coverage"), "Evento");
  assert.equal(originTag("existing_material"), "Material");
  assert.equal(originTag("organic"), null);
  const base = { publications: [] };
  assert.equal(attentionBadge({ ...base, contentOrigin: "event_coverage", materialStatus: "pending" })?.label, "Material pendiente");
  assert.equal(attentionBadge({ ...base, contentOrigin: "event_coverage", materialStatus: "available" })?.label, "Material disponible");
  assert.equal(attentionBadge({ ...base, contentOrigin: "existing_material", materialStatus: "available", needsCopy: true })?.label, "Copy pendiente");
  assert.equal(attentionBadge({ ...base, contentOrigin: "organic", materialStatus: "not_required" }), null);
  assert.equal(attentionBadge({ ...base, contentOrigin: "organic", materialStatus: "pending" })?.tone, "warn");
  assert.equal(attentionBadge({ contentOrigin: "event_coverage", materialStatus: "pending", publications: [pub("x", { status: "scheduled" })] }), null);
  assert.equal(attentionBadge({ ...base }), null); // datos previos a 0009
  // Selector por cliente: Tec configurado con tres; otros y datos previos, solo orgánico.
  assert.deepEqual(enabledOrigins(["event_coverage", "existing_material", "organic"]), ["organic", "event_coverage", "existing_material"]);
  assert.deepEqual(enabledOrigins(["organic"]), ["organic"]);
  assert.deepEqual(enabledOrigins(undefined), ["organic"]);
  assert.deepEqual(enabledOrigins(["existing_material", "inventado"]), ["organic", "existing_material"]);
});
