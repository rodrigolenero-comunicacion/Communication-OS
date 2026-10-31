// Context Builder: arma el contexto MÍNIMO de una llamada al generador a partir del Brain,
// las fuentes, los ejes, el calendario reciente y la biblioteca de UN cliente.
// Puro (sin E/S): todo llega como argumento, incluido `now`.

import type { SchemaOptions } from "./schema.ts";

export type GenStage = "classify" | "develop" | "ideas" | "package";

export interface CtxBrainEntry {
  id: string; brand_id: string; category: string; title: string; content: string | null; status: string;
  provisional: boolean; claim_status: string | null; source_reference_id: string | null; applies_to?: string[] | null; sort: number;
}
export interface CtxAxis { id: string; brand_id: string; kind: "pillar" | "territory"; code: string | null; name: string;
  description?: string | null; provisional: boolean; active: boolean }
export interface CtxSource { id: string; brand_id: string | null; relation_kind: string; title: string; institution?: string | null;
  source_type?: string; document_version?: string | null; status?: string; source_url: string | null }
export interface CtxPiece { id: string; brand_id: string; title: string; idea: string | null; format_key: string | null;
  pillar_id: string | null; territory_id: string | null; date: string | null; archived: boolean; library_idea_id?: string | null }
export interface CtxLibraryIdea { id: string; brand_id: string; code: string; title: string; summary: string | null;
  pillar_id: string | null; territory_id: string | null; suggested_format: string | null; active: boolean }
export interface CtxCatalog { key: string; label: string; active: boolean }

export interface ContextInput {
  stage: GenStage;
  brand: { id: string; name: string };
  account: { id: string; name: string };
  date: string;                       // día objetivo (YYYY-MM-DD, local)
  userInput?: string | null;          // idea del usuario (classify/develop)
  feedback?: string | null;           // indicación de revisión («hazlo menos comercial»)
  concept?: Record<string, unknown> | null; // concepto aceptado (package)
  format?: string | null;
  mode?: string | null;
  pillarId?: string | null;
  territoryId?: string | null;
  brain: readonly CtxBrainEntry[];
  axes: readonly CtxAxis[];
  sources: readonly CtxSource[];
  pieces: readonly CtxPiece[];
  library: readonly CtxLibraryIdea[];
  formats: readonly CtxCatalog[];
  modes: readonly CtxCatalog[];
}

export interface GenerationContext {
  stage: GenStage;
  client: string;
  account: string;
  target_date: string;
  brain: Record<string, { title: string; content: string | null; provisional: boolean; source: string | null }[]>;
  pillars: { ref: string; name: string; description: string | null; provisional: boolean }[];
  territories: { ref: string; name: string; description: string | null; provisional: boolean }[];
  sources: { ref: string; title: string; institution: string | null; type: string | null; version: string | null; status: string }[];
  recent_content: { title: string; idea: string | null; format: string | null; pillar: string | null; territory: string | null; date: string | null }[];
  usage_last_weeks: { pillars: Record<string, number>; territories: Record<string, number>; formats: Record<string, number> };
  idea_bank?: { code: string; title: string; summary: string | null; pillar: string | null; territory: string | null; format: string | null; used: boolean }[];
  formats: { key: string; label: string }[];
  production_modes: { key: string; label: string }[];
  request: {
    user_input: string | null; feedback: string | null; concept: Record<string, unknown> | null;
    format: string | null; production_mode: string | null; pillar: string | null; territory: string | null;
  };
}

export interface BuiltContext {
  context: GenerationContext;
  options: SchemaOptions;
  /** Referencias cortas → ids reales del cliente (el modelo nunca ve ni inventa ids). */
  refs: { pillars: Map<string, string>; territories: Map<string, string>; sources: Map<string, string> };
}

/** Quita correos y teléfonos del texto libre antes de enviarlo al proveedor (ids y fechas intactos). */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[correo omitido]")
    .replace(/(?<![\w-])(?:\+\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}(?![\w-])/g, "[teléfono omitido]");
}

const RECENT_DAYS = 60;
const RECENT_LIMIT = 12;

/** Categorías del Brain que entran en cada etapa. Producción solo cuando se arma el paquete. */
const STAGE_CATEGORIES: Record<GenStage, readonly string[]> = {
  classify: ["identity", "strategy", "objective", "audience", "segment", "voice", "editorial_rule", "constraint"],
  develop: ["identity", "strategy", "objective", "audience", "segment", "voice", "editorial_rule", "constraint"],
  ideas: ["identity", "strategy", "objective", "audience", "segment", "voice", "editorial_rule", "constraint", "learning"],
  package: ["strategy", "audience", "segment", "voice", "editorial_rule", "evidence_rule", "review_rule", "production_rule", "constraint", "claim"],
};

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Una regla aplica si no declara ámbito o si su ámbito incluye el formato o el modo elegidos. */
export function ruleApplies(appliesTo: readonly string[] | null | undefined, format: string | null, mode: string | null): boolean {
  if (!appliesTo || appliesTo.length === 0) return true;
  return (!!format && appliesTo.includes(format)) || (!!mode && appliesTo.includes(mode));
}

export function buildContext(input: ContextInput): BuiltContext {
  const brandId = input.brand.id;
  const pillars = input.axes.filter((a) => a.brand_id === brandId && a.active && a.kind === "pillar");
  const territories = input.axes.filter((a) => a.brand_id === brandId && a.active && a.kind === "territory");
  const pillarRef = (a: CtxAxis) => a.code || a.name;
  const refs = {
    pillars: new Map(pillars.map((a) => [pillarRef(a), a.id])),
    territories: new Map(territories.map((a) => [a.name, a.id])),
    sources: new Map<string, string>(),
  };
  const axisRef = new Map([...pillars.map((a) => [a.id, pillarRef(a)] as const), ...territories.map((a) => [a.id, a.name] as const)]);

  // Fuentes del cliente utilizables: activas y provisionales (superseded/archivadas no respaldan nada).
  const usable = input.sources.filter((s) => s.relation_kind === "context_reference" && s.brand_id === brandId
    && ["active", "provisional", undefined].includes(s.status));
  const sources = usable.map((s, i) => {
    const ref = `S${i + 1}`;
    refs.sources.set(ref, s.id);
    return { ref, title: s.title, institution: s.institution ?? null, type: s.source_type ?? null, version: s.document_version ?? null, status: s.status ?? "active" };
  });
  const sourceRef = new Map([...refs.sources].map(([ref, id]) => [id, ref]));

  const format = input.format ?? null;
  const mode = input.mode ?? null;
  const categories = STAGE_CATEGORIES[input.stage];
  const brain: GenerationContext["brain"] = {};
  for (const e of [...input.brain].sort((a, b) => a.sort - b.sort)) {
    if (e.brand_id !== brandId || e.status !== "active" || !categories.includes(e.category)) continue;
    if (e.category === "production_rule" && !ruleApplies(e.applies_to, format, mode)) continue;
    if (e.category === "claim" && e.claim_status !== "confirmed") continue; // solo claims confirmados como hechos
    (brain[e.category] ??= []).push({
      title: e.title, content: e.content, provisional: e.provisional,
      source: e.source_reference_id ? sourceRef.get(e.source_reference_id) ?? null : null,
    });
  }

  const from = addDays(input.date, -RECENT_DAYS);
  const to = addDays(input.date, RECENT_DAYS);
  const recent = input.pieces
    .filter((p) => p.brand_id === brandId && !p.archived && p.date !== null && p.date >= from && p.date <= to)
    .sort((a, b) => (b.date! < a.date! ? -1 : 1))
    .slice(0, RECENT_LIMIT);
  const count = (keys: (string | null)[]) => keys.reduce<Record<string, number>>((acc, k) => (k ? { ...acc, [k]: (acc[k] ?? 0) + 1 } : acc), {});

  const used = new Set(input.pieces.filter((p) => p.brand_id === brandId && !p.archived && p.library_idea_id).map((p) => p.library_idea_id!));
  const context: GenerationContext = {
    stage: input.stage,
    client: input.brand.name,
    account: input.account.name,
    target_date: input.date,
    brain,
    pillars: pillars.map((a) => ({ ref: pillarRef(a), name: a.name, description: a.description ?? null, provisional: a.provisional })),
    territories: territories.map((a) => ({ ref: a.name, name: a.name, description: a.description ?? null, provisional: a.provisional })),
    sources: input.stage === "package" ? sources : [],
    recent_content: recent.map((p) => ({
      title: p.title, idea: p.idea, format: p.format_key, date: p.date,
      pillar: p.pillar_id ? axisRef.get(p.pillar_id) ?? null : null, territory: p.territory_id ? axisRef.get(p.territory_id) ?? null : null,
    })),
    usage_last_weeks: {
      pillars: count(recent.map((p) => (p.pillar_id ? axisRef.get(p.pillar_id) ?? null : null))),
      territories: count(recent.map((p) => (p.territory_id ? axisRef.get(p.territory_id) ?? null : null))),
      formats: count(recent.map((p) => p.format_key)),
    },
    formats: input.formats.filter((f) => f.active).map((f) => ({ key: f.key, label: f.label })),
    production_modes: input.modes.filter((m) => m.active).map((m) => ({ key: m.key, label: m.label })),
    request: {
      user_input: input.userInput?.trim() || null,
      feedback: input.feedback?.trim() || null,
      concept: input.concept ?? null,
      format, production_mode: mode,
      pillar: input.pillarId ? axisRef.get(input.pillarId) ?? null : null,
      territory: input.territoryId ? axisRef.get(input.territoryId) ?? null : null,
    },
  };
  if (input.stage === "ideas") {
    context.idea_bank = input.library.filter((l) => l.brand_id === brandId && l.active).map((l) => ({
      code: l.code, title: l.title, summary: l.summary, format: l.suggested_format, used: used.has(l.id),
      pillar: l.pillar_id ? axisRef.get(l.pillar_id) ?? null : null, territory: l.territory_id ? axisRef.get(l.territory_id) ?? null : null,
    }));
  }

  const options: SchemaOptions = {
    pillarRefs: [...refs.pillars.keys()],
    territoryRefs: [...refs.territories.keys()],
    formatKeys: context.formats.map((f) => f.key),
    modeKeys: context.production_modes.map((m) => m.key),
    sourceRefs: [...refs.sources.keys()],
  };
  return { context, options, refs };
}
