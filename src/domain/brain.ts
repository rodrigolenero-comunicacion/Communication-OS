// Client Brain: vista por secciones y fuentes por estado. Puro; filtra siempre por cliente.

export type BrainCategory =
  | "identity" | "audience" | "segment" | "objective" | "strategy" | "voice"
  | "editorial_rule" | "production_rule" | "evidence_rule" | "review_rule"
  | "constraint" | "claim" | "learning";

export type EntryStatus = "active" | "superseded" | "archived";
export type SourceStatus = "active" | "superseded" | "provisional" | "archived";

export const CATEGORY_LABEL: Record<BrainCategory, string> = {
  identity: "Identidad",
  audience: "Audiencia",
  segment: "Segmento",
  objective: "Objetivo",
  strategy: "Estrategia",
  voice: "Voz",
  editorial_rule: "Regla editorial",
  production_rule: "Regla de producción",
  evidence_rule: "Regla de evidencia",
  review_rule: "Regla de revisión",
  constraint: "Restricción",
  claim: "Claim",
  learning: "Aprendizaje",
};

export const BRAIN_SECTIONS: readonly { key: string; title: string; categories: readonly BrainCategory[] }[] = [
  { key: "strategy", title: "Estrategia", categories: ["identity", "strategy", "objective"] },
  { key: "audiences", title: "Audiencias", categories: ["audience", "segment"] },
  { key: "voice", title: "Voz", categories: ["voice"] },
  { key: "rules", title: "Reglas", categories: ["editorial_rule", "review_rule", "evidence_rule", "production_rule", "constraint"] },
  { key: "claims", title: "Claims", categories: ["claim"] },
  { key: "learnings", title: "Aprendizajes", categories: ["learning"] },
];

export interface BrainEntryLike {
  id: string;
  brand_id: string;
  category: BrainCategory;
  status: EntryStatus;
  provisional: boolean;
  sort: number;
  title: string;
}

/** Secciones del Brain de UN cliente. Por defecto solo entradas activas. */
export function brainView<T extends BrainEntryLike>(
  entries: readonly T[],
  brandId: string,
  opts: { includeInactive?: boolean; onlyProvisional?: boolean } = {},
): { key: string; title: string; entries: T[] }[] {
  const order = (c: BrainCategory) => BRAIN_SECTIONS.flatMap((s) => s.categories).indexOf(c);
  const mine = entries
    .filter((e) => e.brand_id === brandId)
    .filter((e) => opts.includeInactive || e.status === "active")
    .filter((e) => !opts.onlyProvisional || e.provisional)
    .sort((a, b) => order(a.category) - order(b.category) || a.sort - b.sort || a.title.localeCompare(b.title));
  return BRAIN_SECTIONS.map((s) => ({ key: s.key, title: s.title, entries: mine.filter((e) => s.categories.includes(e.category)) }));
}

export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  active: "Activa",
  superseded: "Superseded",
  provisional: "Provisional",
  archived: "Archivada",
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  institutional_document: "Documento institucional",
  internal_system: "Sistema interno",
  web: "Web",
  research: "Investigación",
  decision: "Decisión del propietario",
  reference: "Referencia",
  other: "Otro",
};

export interface SourceLike {
  id: string;
  brand_id: string | null;
  account_id?: string | null;
  scope_kind?: string;
  relation_kind: string;
  status?: SourceStatus;
}

/**
 * Fuentes del cliente agrupadas por estado (datos previos a V0.3 cuentan como activas).
 * Incluye las de ámbito cuenta solo si la cuenta está en `accountIds` (cuentas de ese cliente).
 */
export function sourcesByStatus<T extends SourceLike>(
  sources: readonly T[],
  brandId: string,
  accountIds: readonly string[] = [],
): Record<SourceStatus, T[]> {
  const out: Record<SourceStatus, T[]> = { active: [], superseded: [], provisional: [], archived: [] };
  for (const s of sources) {
    if (s.relation_kind !== "context_reference") continue;
    const mine = s.brand_id === brandId || (s.scope_kind === "account" && !!s.account_id && accountIds.includes(s.account_id));
    if (!mine) continue;
    out[s.status ?? "active"].push(s);
  }
  return out;
}
