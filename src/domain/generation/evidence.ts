// Evidence Engine simple: clasifica cada afirmación del paquete y decide, consultando las reglas
// de revisión del Brain del cliente, si necesita fuente y/o Dirección Académica.

import type { EvidenceClass, PackageOut } from "./schema.ts";

export interface ReviewRule { key: string | null; title: string; content: string | null }

/** Qué regla de revisión del Brain gobierna cada clase. La exigencia concreta la dice el Brain. */
const RULE_FOR_CLASS: Partial<Record<EvidenceClass, string>> = {
  educational_general: "general_guidance",
  specialized: "sensitive_topic",
  creative_metaphor: "creative_invitation",
};

export const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  observation: "Observación de una actividad real",
  institutional: "Afirmación institucional",
  educational_general: "Orientación educativa general",
  specialized: "Tema especializado o sensible",
  creative_metaphor: "Invitación creativa / metáfora",
};

const ACADEMIC = /direcci[oó]n acad[eé]mica/i;
const SOURCE = /fuente/i;

export interface ClaimAssessment {
  statement: string;
  evidence_class: EvidenceClass;
  source_reference_id: string | null;
  on_screen_credit: string | null;
  needs_source: boolean;
  needs_academic_review: boolean;
  source_missing: boolean;
  rule: string | null;
}

export interface EvidenceResult {
  claims: ClaimAssessment[];          // afirmaciones a guardar en `claims` (no incluye invitaciones creativas)
  creative: ClaimAssessment[];        // invitaciones/metáforas: sin afirmación científica
  dependencies: string[];             // a crear en approval_dependencies
}

export const ACADEMIC_DEPENDENCY = "Revisión de Dirección Académica";

export function assessEvidence(
  pkg: Pick<PackageOut, "claims" | "dependencies">,
  reviewRules: readonly ReviewRule[],
  sourceIds: ReadonlyMap<string, string>,
): EvidenceResult {
  const byKey = new Map(reviewRules.filter((r) => r.key).map((r) => [r.key!, r]));
  const assessed = pkg.claims.map((c): ClaimAssessment => {
    const rule = RULE_FOR_CLASS[c.evidence_class] ? byKey.get(RULE_FOR_CLASS[c.evidence_class]!) : undefined;
    const text = rule ? `${rule.title} ${rule.content ?? ""}` : "";
    // Sin regla en el Brain: prudencia (fuente para afirmaciones educativas o especializadas), sin inventar revisores.
    const needs_source = rule ? SOURCE.test(text) : ["educational_general", "specialized", "institutional"].includes(c.evidence_class);
    const needs_academic_review = rule ? ACADEMIC.test(text) : false;
    const source_reference_id = c.source_ref ? sourceIds.get(c.source_ref) ?? null : null;
    return {
      statement: c.statement.trim(), evidence_class: c.evidence_class, source_reference_id,
      on_screen_credit: source_reference_id ? c.on_screen_credit : null,
      needs_source, needs_academic_review, source_missing: needs_source && !source_reference_id,
      rule: rule ? rule.title : null,
    };
  }).filter((c) => c.statement.length > 0);

  const creative = assessed.filter((c) => c.evidence_class === "creative_metaphor");
  const claims = assessed.filter((c) => c.evidence_class !== "creative_metaphor");
  const deps = new Set(pkg.dependencies.map((d) => d.trim()).filter((d) => d.length > 0 && d.length <= 300));
  if (claims.some((c) => c.needs_academic_review)) deps.add(ACADEMIC_DEPENDENCY);
  return { claims, creative, dependencies: [...deps].slice(0, 10) };
}
