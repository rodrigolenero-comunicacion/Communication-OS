// Orquestación determinística de una generación: contexto → proveedor → validación → resultado.
// Sin E/S propia: el proveedor y el registro de la ejecución se inyectan. Nada se persiste aquí;
// quien llama solo guarda si `ok` es verdadero.

import { buildContext, type ContextInput } from "./context.ts";
import { assessEvidence, type EvidenceResult, type ReviewRule } from "./evidence.ts";
import { inputHash } from "./package.ts";
import { SYSTEM_PROMPT, packagePrompt, proposalPrompt } from "./prompt.ts";
import { FAILURE_MESSAGE, type GenerationFailure, type StructuredGenerator } from "./provider.ts";
import { checkPackage, checkProposals, packageSchema, proposalsSchema, type ConceptOut, type PackageOut, type ProposalMode } from "./schema.ts";
import { similarityWarnings, type SimilarityWarning } from "./similarity.ts";

export interface RunRecord {
  stage: "classify" | "develop" | "ideas" | "package";
  provider: string; model: string | null; inputHash: string | null;
  status: "succeeded" | "failed" | "invalid_output" | "not_configured" | "refused";
  errorCode: string | null; inputTokens: number | null; outputTokens: number | null;
}

export type Failure = { ok: false; code: GenerationFailure | "invalid_output"; message: string };

export interface Proposal extends ConceptOut {
  pillar_id: string; territory_id: string; warnings: SimilarityWarning[];
}

const MAX_TOKENS = { classify: 2500, develop: 4000, ideas: 6000, package: 12000 } as const;
/**
 * Esfuerzo explícito en ambas etapas. En Claude Sonnet 5.5 el valor por defecto de la API es `high` y el
 * thinking adaptativo está siempre activo; `medium` reduce latencia frente al límite síncrono de 60 s de
 * Netlify manteniendo calidad editorial. Ajustar solo tras medir en uso real.
 */
export const GENERATION_EFFORT = "medium" as const;

function failureStatus(code: GenerationFailure): RunRecord["status"] {
  return code === "not_configured" ? "not_configured" : code === "refused" ? "refused" : "failed";
}

export async function generateProposals(
  mode: ProposalMode, input: Omit<ContextInput, "stage">, generator: StructuredGenerator, record: (r: RunRecord) => Promise<void>,
): Promise<{ ok: true; proposals: Proposal[] } | Failure> {
  if (!generator.configured) return { ok: false, code: "not_configured", message: FAILURE_MESSAGE.not_configured };
  const built = buildContext({ ...input, stage: mode });
  const prompt = proposalPrompt(mode, built.context);
  const hash = await inputHash(SYSTEM_PROMPT + prompt);
  const res = await generator.generate({ system: SYSTEM_PROMPT, prompt, schema: proposalsSchema(built.options), maxTokens: MAX_TOKENS[mode], effort: GENERATION_EFFORT });
  const base = { stage: mode, provider: generator.provider, inputHash: hash } as const;
  if (!res.ok) {
    await record({ ...base, model: res.model, status: failureStatus(res.code), errorCode: res.code, inputTokens: res.inputTokens ?? null, outputTokens: res.outputTokens ?? null });
    return { ok: false, code: res.code, message: FAILURE_MESSAGE[res.code] };
  }
  const checked = checkProposals(res.data, mode, built.options);
  const usage = { model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
  if (!checked.ok) {
    await record({ ...base, ...usage, status: "invalid_output", errorCode: "schema" });
    return { ok: false, code: "invalid_output", message: FAILURE_MESSAGE.invalid_output };
  }
  await record({ ...base, ...usage, status: "succeeded", errorCode: null });

  const recent = built.context.recent_content.map((r) => ({
    label: `«${r.title}»${r.date ? ` (${r.date})` : ""}`, text: `${r.title} ${r.idea ?? ""}`, pillar: r.pillar, territory: r.territory, format: r.format,
  }));
  const bank = (built.context.idea_bank ?? []).filter((b) => b.used).map((b) => ({ label: `la idea ${b.code} del banco (ya usada)`, text: `${b.title} ${b.summary ?? ""}` }));
  return {
    ok: true,
    proposals: checked.value.map((p) => ({
      ...p,
      pillar_id: built.refs.pillars.get(p.pillar)!,
      territory_id: built.refs.territories.get(p.territory)!,
      warnings: similarityWarnings({ title: p.title, idea: p.idea, central_message: p.central_message, pillar: p.pillar, territory: p.territory, format: p.suggested_format }, recent, bank),
    })),
  };
}

export async function generatePackage(
  input: Omit<ContextInput, "stage">, reviewRules: readonly ReviewRule[], generator: StructuredGenerator, record: (r: RunRecord) => Promise<void>,
): Promise<{ ok: true; pkg: PackageOut; evidence: EvidenceResult } | Failure> {
  if (!generator.configured) return { ok: false, code: "not_configured", message: FAILURE_MESSAGE.not_configured };
  const built = buildContext({ ...input, stage: "package" });
  const prompt = packagePrompt(built.context);
  const hash = await inputHash(SYSTEM_PROMPT + prompt);
  const res = await generator.generate({ system: SYSTEM_PROMPT, prompt, schema: packageSchema(built.options), maxTokens: MAX_TOKENS.package, effort: GENERATION_EFFORT });
  const base = { stage: "package", provider: generator.provider, inputHash: hash } as const;
  if (!res.ok) {
    await record({ ...base, model: res.model, status: failureStatus(res.code), errorCode: res.code, inputTokens: res.inputTokens ?? null, outputTokens: res.outputTokens ?? null });
    return { ok: false, code: res.code, message: FAILURE_MESSAGE[res.code] };
  }
  const checked = checkPackage(res.data, built.options);
  const usage = { model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
  if (!checked.ok) {
    await record({ ...base, ...usage, status: "invalid_output", errorCode: "schema" });
    return { ok: false, code: "invalid_output", message: FAILURE_MESSAGE.invalid_output };
  }
  await record({ ...base, ...usage, status: "succeeded", errorCode: null });
  return { ok: true, pkg: checked.value, evidence: assessEvidence(checked.value, reviewRules, built.refs.sources) };
}
