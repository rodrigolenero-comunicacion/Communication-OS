// Casos C01–C22 y R01–R04, R08, R17, R20 de docs/ACCEPTANCE_TESTS.md (capa de dominio).
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeekCoverage } from "../../src/domain/coverage.ts";
import {
  achievable,
  computeAccountReport,
  computeBucketReport,
  computeNeeds,
  reservePool,
  simulateApprovalImpact,
} from "../../src/domain/planning.ts";
import { weekFitsTiming } from "../../src/domain/pieces.ts";
import type { EditorialTarget, PieceFact } from "../../src/domain/types.ts";
import { NOW, W0, W1, W2, approvedFor, basePieces, piece, pub, replace, target } from "./fixture.ts";

const week = (pieces: PieceFact[], weekStart = W1, targets: EditorialTarget[] = [target()], now = NOW) =>
  computeWeekCoverage({ accountId: "A", bucket: "feed", weekStart, targets, pieces, now });

const report = (pieces: PieceFact[], targets: EditorialTarget[] = [target()], now = NOW) =>
  computeBucketReport({ accountId: "A", bucket: "feed", targets, pieces, now });

test("C01 fixture W1: safe 2, projected 4, AT_RISK", () => {
  const w = week(basePieces());
  assert.deepEqual(
    { required: w.required, safe: w.safe, projected: w.projected, safeGap: w.safeGap, projectedGap: w.projectedGap, status: w.status },
    { required: 4, safe: 2, projected: 4, safeGap: 2, projectedGap: 0, status: "AT_RISK" },
  );
});

test("C02 P2 con IG+FB cuenta una sola unidad", () => {
  const w = week(basePieces());
  assert.equal(w.safePending.filter((id) => id === "P2").length, 1);
  assert.equal(w.safe, 2);
});

test("C03 P4 vuelve a planned: projected 3, GAP", () => {
  const w = week(replace(basePieces(), "P4", { productionStatus: "planned" }));
  assert.equal(w.safe, 2);
  assert.equal(w.projected, 3);
  assert.equal(w.status, "GAP");
});

test("C04 reserva A contiene P7, no P8; achievable 3 sin cambiar SAFE", () => {
  const pieces = basePieces();
  const reserve = reservePool(pieces, "A", "feed").map((p) => p.id);
  assert.deepEqual(reserve, ["P7"]);
  const w = week(pieces);
  assert.equal(w.safe, 2);
  assert.equal(achievable(w, reserve.length), 3);
  assert.equal(w.status, "AT_RISK");
});

test("C05 asignar P7 a W1: safe 3, projected 5, reserva vacía, sin scheduled", () => {
  const pieces = replace(basePieces(), "P7", { assignedWeek: W1 });
  const w = week(pieces);
  assert.equal(w.safe, 3);
  assert.equal(w.projected, 5);
  assert.equal(reservePool(pieces, "A", "feed").length, 0);
  assert.equal(pieces.find((p) => p.id === "P7")!.publications.length, 0);
});

test("C06 una pieza solo aporta a la semana asignada", () => {
  const pieces = replace(basePieces(), "P7", { assignedWeek: W1 });
  assert.equal(week(pieces, W2).safe, 0);
});

test("C07 excedente de W0 no compensa W1", () => {
  const pieces = [...approvedFor(W0, 6), ...approvedFor(W1, 2)];
  const w0 = week(pieces, W0);
  const w1 = week(pieces, W1);
  assert.equal(w0.safe, 6);
  assert.equal(w1.safeGap, 2);
  assert.equal(w1.status, "GAP");
});

test("C08 reabrir approved: sale de SAFE y entra a PROJECTED", () => {
  const pieces = replace(basePieces(), "P1", { productionStatus: "in_production", approvedRevision: null });
  const w = week(pieces);
  assert.equal(w.safe, 1);
  assert.equal(w.projected, 4);
});

test("C09 changes_requested sale de PROJECTED", () => {
  const w = week(replace(basePieces(), "P3", { productionStatus: "changes_requested" }));
  assert.equal(w.projected, 3);
});

test("C10 hold excluye de ambas capas y de reserva; liberar restaura", () => {
  let pieces = replace(basePieces(), "P3", { onHold: true });
  pieces = replace(pieces, "P7", { onHold: true });
  const w = week(pieces);
  assert.equal(w.projected, 3);
  assert.ok(w.excluded.some((e) => e.pieceId === "P3" && e.reason === "on_hold"));
  assert.equal(reservePool(pieces, "A", "feed").length, 0);
  const released = replace(replace(pieces, "P3", { onHold: false }), "P7", { onHold: false });
  assert.equal(week(released).projected, 4);
  assert.equal(reservePool(released, "A", "feed").length, 1);
});

test("C11 W0 sin cubrir: runway seguro 0 y CRITICAL aunque W1 esté cubierta", () => {
  const r = report(approvedFor(W1, 4));
  assert.equal(r.safeRunway.kind, "gap");
  assert.equal(r.safeRunway.kind !== "no_target" && r.safeRunway.days, 0);
  assert.equal(r.health, "CRITICAL");
});

test("C12 W0/W1 cubiertas, W2 gap: until 2026-11-09T06:00Z, 12 días", () => {
  const r = report([...approvedFor(W0, 4), ...approvedFor(W1, 4)]);
  assert.equal(r.safeRunway.kind, "gap");
  if (r.safeRunway.kind !== "gap") return;
  assert.equal(r.safeRunway.until.toISOString(), "2026-11-09T06:00:00.000Z");
  assert.equal(r.safeRunway.days, 12);
  assert.equal(r.safeRunway.gapWeek, W2);
  assert.equal(r.health, "HEALTHY"); // 12 >= buffer 7
});

test("C13 SAFE falla W1 y PROJECTED falla W2: 5 y 12 días", () => {
  const inProd = (w: string, n: number) =>
    approvedFor(w, n, `${w}-p`).map((p) => ({ ...p, productionStatus: "in_production" as const, approvedRevision: null }));
  const r = report([...approvedFor(W0, 4), ...approvedFor(W1, 2), ...inProd(W1, 2)]);
  assert.equal(r.safeRunway.kind !== "no_target" && r.safeRunway.days, 5);
  assert.equal(r.projectedRunway.kind !== "no_target" && r.projectedRunway.days, 12);
  assert.equal(r.health, "LOW"); // 5 < 7
});

test("C14 12 ventanas cubiertas: at_least hasta 18 ene 2027 00:00 local", () => {
  const weeks = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 9, 26 + i * 7)).toISOString().slice(0, 10));
  const r = report(weeks.flatMap((w) => approvedFor(w, 4)));
  assert.equal(r.safeRunway.kind, "at_least");
  if (r.safeRunway.kind !== "at_least") return;
  assert.equal(r.safeRunway.until.toISOString(), "2027-01-18T06:00:00.000Z");
  assert.ok(Number.isFinite(r.safeRunway.days));
});

test("C15 la política termina en W2: unknown_after 9 nov, W2 no se declara cubierta", () => {
  const r = report([...approvedFor(W0, 4), ...approvedFor(W1, 4)], [target({ activeUntil: W2 })]);
  assert.equal(r.safeRunway.kind, "unknown_after");
  if (r.safeRunway.kind !== "unknown_after") return;
  assert.equal(r.safeRunway.until.toISOString(), "2026-11-09T06:00:00.000Z");
  assert.equal(r.weeks[2].status, "NO_TARGET");
  assert.equal(r.health, "HEALTHY"); // 12 días conocidos >= 7
});

test("C16 cuenta weekly sin objetivo: SIN_CONFIGURAR, nunca verde", () => {
  const acc = computeAccountReport({
    account: { id: "A", brandId: "b", name: "A", active: true, coverageMode: "unconfigured" },
    targets: [],
    pieces: basePieces(),
    now: NOW,
  });
  assert.equal(acc.health, "SIN_CONFIGURAR");
  const r = report(basePieces(), []);
  assert.equal(r.safeRunway.kind, "no_target");
  assert.equal(r.weeks[0].status, "NO_TARGET");
  assert.equal(r.health, "SIN_CONFIGURAR");
});

test("C17 cuenta sin cuota: SIN_CUOTA, sin buckets ni necesidades", () => {
  const acc = computeAccountReport({
    account: { id: "A", brandId: "b", name: "Rectora", active: true, coverageMode: "not_required" },
    targets: [],
    pieces: [],
    now: NOW,
  });
  assert.equal(acc.health, "SIN_CUOTA");
  assert.deepEqual(computeNeeds(acc), []);
});

test("C18 dos buckets: stories insuficiente no se compensa con feed", () => {
  const targets = [target(), target({ id: "tA-st", bucket: "stories", requiredCount: 2 })];
  const pieces = [...approvedFor(W0, 6), ...approvedFor(W1, 4)];
  const acc = computeAccountReport({
    account: { id: "A", brandId: "b", name: "A", active: true, coverageMode: "weekly" },
    targets,
    pieces,
    now: NOW,
  });
  const feed = acc.buckets.find((b) => b.bucket === "feed")!;
  const stories = acc.buckets.find((b) => b.bucket === "stories")!;
  assert.equal(feed.health, "HEALTHY");
  assert.equal(stories.health, "CRITICAL");
  assert.equal(acc.health, "CRITICAL");
});

test("C19 cambio de semana exacto en hora local", () => {
  const sunday = new Date("2026-11-02T05:59:00Z"); // dom 1 nov 23:59 CDMX
  const monday = new Date("2026-11-02T06:00:00Z"); // lun 2 nov 00:00 CDMX
  assert.equal(report([], [target()], sunday).weeks[0].weekStart, W0);
  assert.equal(report([], [target()], monday).weeks[0].weekStart, W1);
});

test("C20 timing fijo y ventana validan la semana", () => {
  const fixed = { mode: "fixed" as const, fixedDate: "2026-10-30", validFrom: null, validUntil: null };
  assert.equal(weekFitsTiming(fixed, W1), false);
  assert.equal(weekFitsTiming(fixed, W0), true);
  const window = { mode: "window" as const, fixedDate: null, validFrom: "2026-11-03", validUntil: "2026-11-09" };
  assert.equal(weekFitsTiming(window, W1), true);
  assert.equal(weekFitsTiming(window, W2), true);
  assert.equal(weekFitsTiming(window, W0), false);
});

test("C21 pieza fija vencida sin publicar queda excluida", () => {
  const pieces = replace(approvedFor(W1, 4), `${W1}-0`, {
    timing: { mode: "fixed", fixedDate: "2026-11-03", validFrom: null, validUntil: null },
  });
  const later = new Date("2026-11-04T18:00:00Z");
  const w = week(pieces, W1, [target()], later);
  assert.equal(w.safe, 3);
  assert.ok(w.excluded.some((e) => e.reason === "timing_expired"));
  assert.equal(week(pieces).safe, 4); // antes de la fecha sí cuenta
});

test("C22 Stories sin política no se evalúa ni se deriva de feed", () => {
  const acc = computeAccountReport({
    account: { id: "A", brandId: "b", name: "Campus", active: true, coverageMode: "weekly" },
    targets: [target()],
    pieces: [],
    now: NOW,
  });
  assert.deepEqual(acc.buckets.map((b) => b.bucket), ["feed"]);
});

test("R01 aprobada asignada sin Publication cuenta SAFE", () => {
  assert.ok(week(basePieces()).safePending.includes("P1"));
});

test("R02/R03 publicada se mueve a fulfilled sin duplicar ni caer", () => {
  const published = pub("ig", { status: "published", publishedAt: new Date("2026-10-27T17:00:00Z") });
  const pieces = [piece("X", { assignedWeek: W0, publications: [published] })];
  let w = week(pieces, W0);
  assert.deepEqual([w.fulfilled, w.safePending, w.safe], [["X"], [], 1]);
  const second = pub("fb", { channelId: "facebook", status: "published", publishedAt: new Date("2026-10-27T17:30:00Z") });
  w = week([piece("X", { assignedWeek: W0, publications: [published, second] })], W0);
  assert.equal(w.safe, 1);
  // cumplida y archivada sigue contando
  w = week([piece("X", { assignedWeek: W0, archived: true, publications: [published] })], W0);
  assert.equal(w.fulfilled.length, 1);
});

test("R04 scheduled vencida sin confirmar sale de SAFE y PROJECTED", () => {
  const overdue = pub("ig", { status: "scheduled", scheduledAt: new Date("2026-10-27T15:00:00Z") });
  const w = week([piece("X", { assignedWeek: W0, publications: [overdue] })], W0);
  assert.equal(w.safe, 0);
  assert.equal(w.projected, 0);
  assert.ok(w.excluded.some((e) => e.reason === "overdue_schedule"));
  assert.equal(overdue.status, "scheduled");
  // si otro destino ya está publicado, la unidad cumplida permanece
  const done = pub("fb", { channelId: "facebook", status: "published", publishedAt: new Date("2026-10-27T14:00:00Z") });
  assert.equal(week([piece("X", { assignedWeek: W0, publications: [overdue, done] })], W0).safe, 1);
});

test("R08 cancelar el único destino no saca la pieza de SAFE ni la devuelve a reserva", () => {
  const pieces = [piece("X", { publications: [pub("ig", { status: "cancelled" })] })];
  assert.equal(week(pieces).safe, 1);
  assert.equal(reservePool(pieces, "A", "feed").length, 0);
});

test("R17 espejo aprobado sin revisión completa queda fuera de SAFE y reserva", () => {
  const observation = {
    observedStatus: "approved" as const,
    reviewCompleteConfirmed: false,
    observedOnHold: false,
    observedAt: new Date("2026-10-20T12:00:00Z"),
    sourceStateRaw: "P03 audiovisual v10 aprobado; caption y portada pendientes",
  };
  const mirror = piece("M", { ownership: "external", productionStatus: null, approvedRevision: null, latestObservation: observation });
  const w = week([mirror]);
  assert.equal(w.safe, 0);
  assert.ok(w.excluded.some((e) => e.reason === "external_review_incomplete"));
  assert.equal(reservePool([{ ...mirror, assignedWeek: null }], "A", "feed").length, 0);
  const complete = { ...mirror, latestObservation: { ...observation, reviewCompleteConfirmed: true } };
  assert.equal(week([complete]).safe, 1);
  const unknown = { ...mirror, latestObservation: { ...observation, observedStatus: "unknown" as const } };
  assert.ok(week([unknown]).excluded.some((e) => e.reason === "external_unverified"));
});

test("R20 aprobar pieza sin asignación no cambia runway", () => {
  const pieces = [...approvedFor(W0, 4), piece("Z", { productionStatus: "in_review", approvedRevision: null, assignedWeek: null })];
  const impact = simulateApprovalImpact({ piece: pieces[4], targets: [target()], pieces, now: NOW });
  assert.equal(impact.changesRunway, false);
  const assigned = [...approvedFor(W0, 4), ...approvedFor(W1, 3), piece("Z", { productionStatus: "in_review", approvedRevision: null, assignedWeek: W1 })];
  const impact2 = simulateApprovalImpact({ piece: assigned.at(-1)!, targets: [target()], pieces: assigned, now: NOW });
  assert.equal(impact2.changesRunway, true);
  assert.equal(impact2.before.safeRunway.kind !== "no_target" && impact2.before.safeRunway.days, 5);
  assert.equal(impact2.after.safeRunway.kind !== "no_target" && impact2.after.safeRunway.days, 12);
});

test("Necesidades: proyección por semana sin crear piezas", () => {
  const acc = computeAccountReport({
    account: { id: "A", brandId: "b", name: "A", active: true, coverageMode: "weekly" },
    targets: [target()],
    pieces: basePieces(),
    now: NOW,
  });
  const needs = computeNeeds(acc);
  const w1 = needs.find((n) => n.weekStart === W1)!;
  assert.equal(w1.safeGap, 2);
  assert.equal(w1.projectedGap, 0);
  assert.equal(needs.length, 12); // W0 vacío + W1 + W2..W11 vacíos
});
