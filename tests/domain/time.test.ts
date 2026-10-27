import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, currentWeekStart, isLocalDate, isMonday, localDateOf, localMidnight, weekStartOf } from "../../src/domain/time.ts";

test("fecha local en America/Mexico_City independiente de la zona del proceso", () => {
  assert.equal(localDateOf(new Date("2026-10-27T05:59:00Z")), "2026-10-26");
  assert.equal(localDateOf(new Date("2026-10-27T06:00:00Z")), "2026-10-27");
});

test("semanas lunes–domingo", () => {
  assert.equal(weekStartOf("2026-11-01"), "2026-10-26");
  assert.equal(weekStartOf("2026-11-02"), "2026-11-02");
  assert.equal(currentWeekStart(new Date("2026-10-27T18:00:00Z")), "2026-10-26");
  assert.ok(isMonday("2026-10-26"));
  assert.ok(!isMonday("2026-10-27"));
});

test("medianoche local en UTC", () => {
  assert.equal(localMidnight("2026-11-09").toISOString(), "2026-11-09T06:00:00.000Z");
  assert.equal(localMidnight("2027-01-18").toISOString(), "2027-01-18T06:00:00.000Z");
});

test("validación y aritmética de fechas", () => {
  assert.ok(isLocalDate("2026-02-28"));
  assert.ok(!isLocalDate("2026-02-30"));
  assert.ok(!isLocalDate("27/10/2026"));
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
});

test("hora local a instante", async () => {
  const { localDateTime } = await import("../../src/domain/time.ts");
  assert.equal(localDateTime("2026-11-04", "10:30").toISOString(), "2026-11-04T16:30:00.000Z");
});
