// Puente entre el snapshot de la app y el motor de generación (solo servidor).

import type { ContextInput } from "@/domain/generation/context";
import type { RunRecord } from "@/domain/generation/engine";
import type { ReviewRule } from "@/domain/generation/evidence";
import type { AccountRow, BrandRow, Snapshot } from "@/infrastructure/data";
import { anthropicGenerator } from "@/infrastructure/llm/anthropic";

export const GENERATION_CAPABILITY = "editorial_generation";

/** El cliente tiene la capacidad y la migración 0012 está aplicada. La base lo vuelve a comprobar al escribir. */
export function canGenerate(snapshot: Snapshot, brand: BrandRow): boolean {
  return snapshot.library !== null && (brand.capabilities ?? []).includes(GENERATION_CAPABILITY);
}

export const generator = () => anthropicGenerator();

/** Datos del cliente para el Context Builder. El builder vuelve a filtrar por cliente. */
export function contextInput(
  snapshot: Snapshot, brand: BrandRow, account: AccountRow, date: string,
  extra: Partial<Omit<ContextInput, "stage" | "brand" | "account" | "date">> = {},
): Omit<ContextInput, "stage"> {
  const accountBrand = new Map(snapshot.accounts.map((a) => [a.id, a.brand_id]));
  const factById = new Map(snapshot.facts.map((f) => [f.id, f]));
  return {
    brand: { id: brand.id, name: brand.name },
    account: { id: account.id, name: account.name },
    date,
    brain: (snapshot.brain ?? []).filter((e) => e.brand_id === brand.id),
    axes: snapshot.axes.filter((a) => a.brand_id === brand.id),
    sources: snapshot.references.filter((r) => r.brand_id === brand.id),
    pieces: snapshot.pieces
      .filter((p) => accountBrand.get(p.account_id) === brand.id)
      .map((p) => ({
        id: p.id, brand_id: brand.id, title: p.title, idea: p.idea ?? null, format_key: p.format_key ?? null,
        pillar_id: p.pillar_id ?? null, territory_id: p.territory_id ?? null, archived: p.archived_at !== null,
        date: factById.get(p.id)?.plannedDate ?? null, library_idea_id: p.library_idea_id ?? null,
      })),
    library: (snapshot.library ?? []).filter((l) => l.brand_id === brand.id),
    formats: snapshot.formats,
    modes: snapshot.modes,
    ...extra,
  };
}

export function reviewRules(snapshot: Snapshot, brandId: string): ReviewRule[] {
  return (snapshot.brain ?? [])
    .filter((e) => e.brand_id === brandId && e.category === "review_rule" && e.status === "active")
    .map((e) => ({ key: e.key, title: e.title, content: e.content }));
}

type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> };

/** Registro técnico (sin contenido). Si falla, no interrumpe la generación. */
export function runRecorder(supabase: Rpc, brandId: string, pieceId: string | null) {
  return async (r: RunRecord) => {
    await supabase.rpc("record_generation_run", {
      p_brand_id: brandId, p_piece_id: pieceId, p_stage: r.stage, p_provider: r.provider, p_model: r.model,
      p_input_hash: r.inputHash, p_status: r.status, p_error_code: r.errorCode,
      p_input_tokens: r.inputTokens, p_output_tokens: r.outputTokens,
    });
  };
}
