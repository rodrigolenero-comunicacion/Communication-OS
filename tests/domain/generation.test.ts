import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContext, ruleApplies, type ContextInput } from "../../src/domain/generation/context.ts";
import { generatePackage, generateProposals, type RunRecord } from "../../src/domain/generation/engine.ts";
import { ACADEMIC_DEPENDENCY, assessEvidence } from "../../src/domain/generation/evidence.ts";
import { packageWords, visibleSections } from "../../src/domain/generation/package.ts";
import { SYSTEM_PROMPT } from "../../src/domain/generation/prompt.ts";
import type { StructuredGenerator, StructuredRequest } from "../../src/domain/generation/provider.ts";
import { checkPackage, checkProposals, validate, packageSchema, type PackageOut } from "../../src/domain/generation/schema.ts";
import { batchDiversity, similarityWarnings } from "../../src/domain/generation/similarity.ts";

const IJLV = "b-ijlv", TEC = "b-tec";
const entry = (id: string, brand: string, category: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, brand_id: brand, category, title, content: `${title} contenido`, status: "active", provisional: false, claim_status: null,
  source_reference_id: null, applies_to: [] as string[], sort: 0, ...extra,
});

function input(over: Partial<ContextInput> = {}): ContextInput {
  return {
    stage: "classify",
    brand: { id: IJLV, name: "IJLV" }, account: { id: "acc", name: "IJLV" }, date: "2026-11-10",
    brain: [
      entry("e1", IJLV, "voice", "Atributos de voz"),
      entry("e2", IJLV, "production_rule", "Guía de captura", { applies_to: ["real_people", "real_plus_graphics"] }),
      entry("e3", IJLV, "production_rule", "Sincronía", { applies_to: ["fully_graphic", "motion"] }),
      entry("e4", IJLV, "production_rule", "Composición"),
      entry("e5", IJLV, "review_rule", "Orientación educativa general", { key: "general_guidance", content: "Requiere fuente + revisión de Dirección Académica." }),
      entry("e6", IJLV, "voice", "Voz vieja", { status: "superseded" }),
      entry("e7", IJLV, "claim", "Dato sin confirmar", { claim_status: "provisional", provisional: true }),
      entry("t1", TEC, "voice", "Tono institucional Tec"),
      entry("t2", TEC, "production_rule", "Regla Tec"),
    ],
    axes: [
      { id: "p3", brand_id: IJLV, kind: "pillar", code: "P3", name: "Crecer juntos", description: "Aportar valor", provisional: false, active: true },
      { id: "pe", brand_id: IJLV, kind: "territory", code: null, name: "Pensamiento", provisional: false, active: true },
      { id: "pt", brand_id: TEC, kind: "pillar", code: null, name: "Vivencia Tec", provisional: true, active: true },
    ],
    sources: [
      { id: "s14", brand_id: IJLV, relation_kind: "context_reference", title: "Sistema Editorial v1.4", status: "active", source_url: null },
      { id: "s12", brand_id: IJLV, relation_kind: "context_reference", title: "Sistema Editorial v1.2", status: "superseded", source_url: null },
      { id: "su", brand_id: IJLV, relation_kind: "context_reference", title: "UNICEF", status: "active", source_url: "https://x" },
      { id: "st", brand_id: TEC, relation_kind: "context_reference", title: "ST Hub", status: "active", source_url: null },
    ],
    pieces: [
      { id: "x1", brand_id: IJLV, title: "Otra pregunta después de cómo te fue", idea: "Invitaciones a conversar", format_key: "carousel", pillar_id: "p3", territory_id: "pe", date: "2026-11-03", archived: false },
      { id: "x2", brand_id: IJLV, title: "Antigua", idea: null, format_key: "reel", pillar_id: null, territory_id: null, date: "2026-05-01", archived: false },
      { id: "x3", brand_id: TEC, title: "Pieza Tec reciente", idea: null, format_key: "reel", pillar_id: "pt", territory_id: null, date: "2026-11-04", archived: false },
    ],
    library: [
      { id: "l36", brand_id: IJLV, code: "36", title: "Una pregunta antes de explicar", summary: "¿Qué crees que sucede?", pillar_id: "p3", territory_id: "pe", suggested_format: "Motion / B", active: true },
    ],
    formats: [{ key: "carousel", label: "Carrusel", active: true }, { key: "reel", label: "Reel", active: true }, { key: "motion", label: "Motion", active: true }],
    modes: [{ key: "real_people", label: "Personas reales", active: true }, { key: "fully_graphic", label: "Gráfico", active: true }],
    ...over,
  };
}

test("context builder: solo el cliente correcto, sin contaminación", () => {
  const { context, refs } = buildContext(input({ stage: "package", format: "carousel", mode: "fully_graphic" }));
  const all = JSON.stringify(context);
  assert.ok(!all.includes("Tec"), "nada de Tec en el contexto");
  assert.equal(context.client, "IJLV");
  assert.deepEqual([...refs.pillars.keys()], ["P3"]);
  assert.deepEqual(context.sources.map((s) => s.title), ["Sistema Editorial v1.4", "UNICEF"], "sin superseded ni fuentes ajenas");
});

test("context builder: Brain vigente y reglas pertinentes al formato/modo", () => {
  const motion = buildContext(input({ stage: "package", format: "motion", mode: "fully_graphic" })).context;
  assert.deepEqual(motion.brain.production_rule.map((r) => r.title), ["Sincronía", "Composición"]);
  const real = buildContext(input({ stage: "package", format: "reel", mode: "real_people" })).context;
  assert.deepEqual(real.brain.production_rule.map((r) => r.title), ["Guía de captura", "Composición"], "sin reglas de motion en un reel real");
  assert.ok(!JSON.stringify(motion).includes("Voz vieja"), "entradas superseded fuera");
  assert.equal(motion.brain.claim, undefined, "claims provisionales no entran como hechos");
  const concept = buildContext(input({ stage: "classify" })).context;
  assert.equal(concept.brain.production_rule, undefined, "Stage A no lleva reglas de producción");
  assert.equal(concept.sources.length, 0, "Stage A no necesita fuentes");
  assert.ok(ruleApplies([], null, null) && !ruleApplies(["motion"], "reel", "real_people"));
});

test("context builder: contenido reciente del cliente y uso de ejes", () => {
  const { context } = buildContext(input({ stage: "ideas" }));
  assert.deepEqual(context.recent_content.map((r) => r.title), ["Otra pregunta después de cómo te fue"], "fuera de ventana y de otro cliente excluidos");
  assert.deepEqual(context.usage_last_weeks.pillars, { P3: 1 });
  assert.equal(context.idea_bank?.length, 1);
  assert.equal(context.idea_bank?.[0].used, false);
});

const opts = { pillarRefs: ["P3"], territoryRefs: ["Pensamiento"], formatKeys: ["carousel", "motion"], modeKeys: ["real_people", "fully_graphic"], sourceRefs: ["S1", "S2"] };
const concept = (n: number, over: Record<string, unknown> = {}) => ({
  title: `Idea ${n}`, idea: `Idea número ${n}`, objective: "o", audience: "Familias", stage: "primaria", pillar: "P3", territory: "Pensamiento",
  suggested_format: "carousel", suggested_production_mode: "fully_graphic", central_message: "m", editorial_reason: "r", similar_to: null, ...over,
});

test("schema: propuestas válidas, inválidas y número por modo", () => {
  assert.equal(checkProposals({ proposals: [concept(1)] }, "classify", opts).ok, true);
  assert.equal(checkProposals({ proposals: [1, 2, 3, 4, 5].map((n) => concept(n)) }, "ideas", opts).ok, true);
  assert.equal(checkProposals({ proposals: [1, 2, 3].map((n) => concept(n)) }, "ideas", opts).ok, false, "desde cero exige 5");
  assert.equal(checkProposals({ proposals: [1, 2, 3, 4].map((n) => concept(n)) }, "develop", opts).ok, false, "desarrollar: máximo 3");
  assert.equal(checkProposals({ proposals: [concept(1, { pillar: "P9" })] }, "classify", opts).ok, false, "pilar fuera del cliente");
  assert.equal(checkProposals({ proposals: [concept(1, { extra: "x" })] }, "classify", opts).ok, false, "campo no permitido");
  assert.equal(checkProposals("texto libre", "classify", opts).ok, false);
});

export function samplePackage(over: Partial<PackageOut> = {}): PackageOut {
  return {
    concept: "c", central_message: "m", objective: "o", hook: "¿Qué crees que pasa?", development: null, closing: "Las preguntas abren caminos.",
    screen_text: ["¿Qué crees que pasa?"], voiceover: null, teacher_lines: [], interaction_prompts: [], capture_guide: null, edit_structure: [],
    creative_brief: null, storyboard: [], carousel_slides: [{ title: "¿Qué crees que pasa?", body: "b", visual_direction: "v", source_credit: null }],
    graphics_spec: [], audio_spec: null, caption: "Una idea para casa", cta: "Guarda esta pregunta", alt_text: null, fallback: null, output: null,
    claims: [], dependencies: [], alternative: null, ...over,
  };
}

test("schema: paquete válido e inválido; el esquema del proveedor valida su propia salida", () => {
  assert.equal(checkPackage(samplePackage(), opts).ok, true);
  assert.equal(checkPackage({ ...samplePackage(), caption: 5 }, opts).ok, false);
  assert.equal(checkPackage(samplePackage({ teacher_lines: ["a", "b", "c"] }), opts).ok, false, "máximo dos líneas de docente");
  assert.equal(checkPackage(samplePackage({ claims: [{ statement: "x", evidence_class: "rumor" as never, source_ref: null, on_screen_credit: null }] }), opts).ok, false);
  assert.equal(checkPackage(samplePackage({ claims: [{ statement: "x", evidence_class: "observation", source_ref: "S9", on_screen_credit: null }] }), opts).ok, false, "fuente inexistente");
  assert.deepEqual(validate(packageSchema(opts), samplePackage()), []);
});

test("anti-repetición: advierte similitud y sobreuso sin bloquear", () => {
  const recent = [
    { label: "«P20»", text: "cambio de perspectiva mirar desde otro lado", pillar: "P2", territory: "Mundo", format: "motion" },
    { label: "«b»", text: "otra cosa", pillar: "P2", territory: "Mundo", format: "motion" },
    { label: "«c»", text: "algo distinto", pillar: "P2", territory: "Mundo", format: "carousel" },
  ];
  const w = similarityWarnings({ title: "Mirar desde otro lado", idea: "Un cambio de perspectiva", central_message: "", pillar: "P2", territory: "Mundo", format: "motion" }, recent);
  assert.deepEqual(w.map((x) => x.kind).sort(), ["format_repeat", "pillar_overuse", "similar", "territory_overuse"]);
  assert.match(w.find((x) => x.kind === "similar")!.message, /Similar a «P20»/);
  assert.deepEqual(similarityWarnings({ title: "Escuchar antes de responder", idea: "Atención", central_message: "", pillar: "P3", territory: "Humanidad", format: "carousel" }, recent), []);
  assert.ok(batchDiversity(["preguntas en casa", "una torre de bloques", "la ofrenda del colegio"]) > 0.9);
});

test("evidencias: claim con fuente, sin fuente y dependencia académica según el Brain", () => {
  const rules = [
    { key: "general_guidance", title: "Orientación educativa general", content: "Requiere fuente + revisión de Dirección Académica." },
    { key: "creative_invitation", title: "Invitación creativa", content: "Requiere revisión editorial." },
  ];
  const r = assessEvidence({
    claims: [
      { statement: "Preguntar favorece la observación", evidence_class: "educational_general", source_ref: "S2", on_screen_credit: "Fuente: UNICEF" },
      { statement: "Esta pregunta desarrolla pensamiento crítico", evidence_class: "educational_general", source_ref: null, on_screen_credit: "x" },
      { statement: "Prueben esta pregunta durante la cena", evidence_class: "creative_metaphor", source_ref: null, on_screen_credit: null },
    ],
    dependencies: ["Autorización de imagen"],
  }, rules, new Map([["S2", "su"]]));
  assert.equal(r.claims.length, 2, "la invitación creativa no se guarda como claim");
  assert.equal(r.claims[0].source_reference_id, "su");
  assert.equal(r.claims[1].source_missing, true, "Fuente necesaria");
  assert.equal(r.claims[1].on_screen_credit, null, "sin fuente no hay crédito");
  assert.ok(r.claims.every((c) => c.needs_academic_review));
  assert.deepEqual(r.dependencies, ["Autorización de imagen", ACADEMIC_DEPENDENCY]);
  assert.equal(r.creative[0].needs_academic_review, false);
  const noRules = assessEvidence({ claims: [{ statement: "x", evidence_class: "educational_general", source_ref: null, on_screen_credit: null }], dependencies: [] }, [], new Map());
  assert.equal(noRules.dependencies.length, 0, "sin regla en el Brain no se inventa revisor");
  assert.equal(noRules.claims[0].source_missing, true);
});

function fake(responses: unknown[], configured = true): StructuredGenerator & { calls: StructuredRequest[] } {
  const calls: StructuredRequest[] = [];
  return {
    provider: "fake", configured, calls,
    async generate(req) {
      calls.push(req);
      const r = responses.shift();
      if (r instanceof Error) return { ok: false, code: "timeout", model: "m" };
      return { ok: true, data: r, model: "m", inputTokens: 10, outputTokens: 5 };
    },
  };
}

test("motor: sin configuración no llama al proveedor", async () => {
  const g = fake([], false);
  const runs: RunRecord[] = [];
  const r = await generateProposals("ideas", input(), g, async (x) => { runs.push(x); });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.message, "Generación no configurada.");
  assert.equal(g.calls.length, 0);
});

test("motor: 5 ideas con ids reales, aviso de similitud y registro de la ejecución", async () => {
  const runs: RunRecord[] = [];
  const g = fake([{ proposals: [concept(1, { title: "Otra pregunta después de cómo te fue", idea: "Invitaciones a conversar" }), concept(2), concept(3), concept(4), concept(5)] }]);
  const r = await generateProposals("ideas", input(), g, async (x) => { runs.push(x); });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.proposals.length, 5);
  assert.equal(r.proposals[0].pillar_id, "p3");
  assert.equal(r.proposals[0].territory_id, "pe");
  assert.ok(r.proposals[0].warnings.some((w) => w.kind === "similar"));
  assert.equal(runs[0].status, "succeeded");
  assert.equal(runs[0].inputHash?.length, 64);
  assert.equal(g.calls[0].system, SYSTEM_PROMPT);
  assert.ok(!g.calls[0].prompt.includes("Tec"), "el prompt no lleva datos de otro cliente");
});

test("motor: salida inválida no produce resultado y se registra; reintento posible", async () => {
  const runs: RunRecord[] = [];
  const g = fake([{ proposals: [concept(1)] }, new Error("t"), { proposals: [concept(1)] }]);
  const bad = await generateProposals("ideas", input(), g, async (x) => { runs.push(x); });
  assert.equal(bad.ok, false);
  assert.equal(runs[0].status, "invalid_output");
  const timeout = await generateProposals("classify", input(), g, async (x) => { runs.push(x); });
  assert.equal(!timeout.ok && timeout.code, "timeout");
  const retry = await generateProposals("classify", input(), g, async (x) => { runs.push(x); });
  assert.equal(retry.ok, true, "el reintento funciona");
  assert.deepEqual(runs.map((x) => x.status), ["invalid_output", "failed", "succeeded"]);
});

test("motor: paquete con evidencias y dependencia académica; textos para el Review Packet", async () => {
  const pkg = samplePackage({ claims: [{ statement: "Esta pregunta desarrolla pensamiento crítico", evidence_class: "educational_general", source_ref: null, on_screen_credit: null }] });
  const runs: RunRecord[] = [];
  const r = await generatePackage(input({ format: "carousel", mode: "fully_graphic", concept: { idea: "x" } }),
    [{ key: "general_guidance", title: "Orientación", content: "Requiere fuente + revisión de Dirección Académica." }], fake([pkg]), async (x) => { runs.push(x); });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.evidence.claims[0].source_missing, true);
  assert.deepEqual(r.evidence.dependencies, [ACADEMIC_DEPENDENCY]);
  assert.deepEqual(packageWords(r.pkg), { hook: "¿Qué crees que pasa?", on_screen: "¿Qué crees que pasa?", final_line: "Las preguntas abren caminos.", caption: "Una idea para casa", cta: "Guarda esta pregunta" });
  assert.deepEqual(visibleSections(r.pkg), ["slides"], "solo lo aplicable");
  assert.equal(runs[0].stage, "package");
});
