import { test } from "node:test";
import assert from "node:assert/strict";
import { brainView, sourcesByStatus, type BrainEntryLike } from "../../src/domain/brain.ts";

const e = (id: string, brand: string, category: BrainEntryLike["category"], extra: Partial<BrainEntryLike> = {}): BrainEntryLike =>
  ({ id, brand_id: brand, category, status: "active", provisional: false, sort: 0, title: id, ...extra });

const entries = [
  e("lema", "ijlv", "identity", { sort: 20 }),
  e("campaña", "ijlv", "identity", { sort: 10 }),
  e("principio", "ijlv", "strategy"),
  e("familias", "ijlv", "audience"),
  e("maternal", "ijlv", "segment"),
  e("adulta", "ijlv", "editorial_rule"),
  e("vieja", "ijlv", "strategy", { status: "superseded" }),
  e("tono-tec", "tec", "voice", { provisional: true }),
  e("posicionamiento", "solotu", "identity"),
];

test("agrupa por secciones y ordena por categoría y orden", () => {
  const view = brainView(entries, "ijlv");
  const strategy = view.find((s) => s.key === "strategy")!;
  assert.deepEqual(strategy.entries.map((x) => x.id), ["campaña", "lema", "principio"]);
  assert.deepEqual(view.find((s) => s.key === "audiences")!.entries.map((x) => x.id), ["familias", "maternal"]);
  assert.deepEqual(view.find((s) => s.key === "rules")!.entries.map((x) => x.id), ["adulta"]);
});

test("solo el cliente correcto (sin contaminación)", () => {
  const ids = brainView(entries, "solotu").flatMap((s) => s.entries.map((x) => x.id));
  assert.deepEqual(ids, ["posicionamiento"]);
});

test("superseded oculto por defecto; visible al pedir todo", () => {
  assert.ok(!brainView(entries, "ijlv").flatMap((s) => s.entries).some((x) => x.id === "vieja"));
  assert.ok(brainView(entries, "ijlv", { includeInactive: true }).flatMap((s) => s.entries).some((x) => x.id === "vieja"));
});

test("filtro de provisionales", () => {
  assert.deepEqual(brainView(entries, "tec", { onlyProvisional: true }).flatMap((s) => s.entries.map((x) => x.id)), ["tono-tec"]);
  assert.equal(brainView(entries, "ijlv", { onlyProvisional: true }).flatMap((s) => s.entries).length, 0);
});

test("fuentes por estado y por cliente", () => {
  const sources = [
    { id: "v14", brand_id: "ijlv", relation_kind: "context_reference", status: "active" as const },
    { id: "v12", brand_id: "ijlv", relation_kind: "context_reference", status: "superseded" as const },
    { id: "legacy", brand_id: "ijlv", relation_kind: "context_reference" },
    { id: "mirror", brand_id: null, relation_kind: "external_mirror", status: "active" as const },
    { id: "tec", brand_id: "tec", relation_kind: "context_reference", status: "provisional" as const },
  ];
  const g = sourcesByStatus(sources, "ijlv");
  assert.deepEqual(g.active.map((s) => s.id), ["v14", "legacy"]);
  assert.deepEqual(g.superseded.map((s) => s.id), ["v12"]);
  assert.equal(g.provisional.length, 0);
  assert.deepEqual(sourcesByStatus(sources, "tec").provisional.map((s) => s.id), ["tec"]);
});
