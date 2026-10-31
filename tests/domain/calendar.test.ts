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
