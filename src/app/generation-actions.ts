"use server";

import { revalidatePath } from "next/cache";
import { describeError } from "@/application/commands";
import { canGenerate, contextInput, generator, reviewRules, runRecorder } from "@/application/generation";
import { getSession } from "@/application/session";
import { generatePackage, generateProposals, type Proposal } from "@/domain/generation/engine";
import { packageWords } from "@/domain/generation/package";
import { redactPersonalData } from "@/domain/generation/context";
import type { ProposalMode } from "@/domain/generation/schema";
import { isLocalDate } from "@/domain/time";
import { loadSnapshot } from "@/infrastructure/data";

export interface ProposalResult { ok: boolean; message: string; at: number; proposals?: Proposal[]; code?: string }
export interface PackageResult { ok: boolean; message: string; at: number; code?: string; missingSources?: number; academic?: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES: readonly ProposalMode[] = ["classify", "develop", "ideas"];
/** Texto libre del usuario: acotado y sin correos ni teléfonos antes de salir al proveedor. */
const field = (fd: FormData, k: string, max = 2000) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? redactPersonalData(v.trim().slice(0, max)) : null;
};

/** Stage A: propuestas de concepto. No persiste contenido: solo el registro técnico de la llamada. */
export async function proposeAction(_prev: ProposalResult | null, fd: FormData): Promise<ProposalResult> {
  const at = Date.now();
  const mode = fd.get("mode") as ProposalMode;
  const accountId = field(fd, "account_id");
  const date = field(fd, "date");
  const userInput = field(fd, "user_input", 1500);
  if (!MODES.includes(mode) || !accountId || !UUID.test(accountId) || !date || !isLocalDate(date)) {
    return { ok: false, message: "Formulario inválido. Recarga la página.", at };
  }
  if (mode !== "ideas" && !userInput) return { ok: false, message: "Escribe tu idea para continuar.", at };
  const session = await getSession();
  if (session.kind !== "authorized") return { ok: false, message: "Tu sesión no está autorizada.", at };
  const snapshot = await loadSnapshot(session.supabase);
  const account = snapshot.accounts.find((a) => a.id === accountId && a.active);
  const brand = account && snapshot.brands.find((b) => b.id === account.brand_id);
  if (!account || !brand || !canGenerate(snapshot, brand)) {
    return { ok: false, message: "La generación editorial no está habilitada para este cliente.", at };
  }
  const result = await generateProposals(mode, contextInput(snapshot, brand, account, date, { userInput, feedback: field(fd, "feedback", 500) }),
    generator(), runRecorder(session.supabase, brand.id, null));
  if (!result.ok) return { ok: false, message: result.message, at, code: result.code };
  return { ok: true, message: `${result.proposals.length} propuesta(s)`, at, proposals: result.proposals };
}

async function pieceScope(fd: FormData) {
  const pieceId = field(fd, "piece_id");
  if (!pieceId || !UUID.test(pieceId)) return null;
  const session = await getSession();
  if (session.kind !== "authorized") return null;
  const snapshot = await loadSnapshot(session.supabase);
  const piece = snapshot.pieces.find((p) => p.id === pieceId);
  const account = piece && snapshot.accounts.find((a) => a.id === piece.account_id);
  const brand = account && snapshot.brands.find((b) => b.id === account.brand_id);
  if (!piece || !account || !brand) return null;
  const fact = snapshot.facts.find((f) => f.id === piece.id);
  const { data: packet } = await session.supabase.from("review_packets").select("package").eq("content_piece_id", piece.id).maybeSingle();
  const concept = ((packet?.package as { concept?: Record<string, unknown> } | null)?.concept) ?? { title: piece.title, idea: piece.idea };
  return { session, snapshot, piece, account, brand, date: fact?.plannedDate ?? snapshot.now.toISOString().slice(0, 10), concept };
}

/** Stage B: genera el paquete y lo guarda junto con claims y dependencias (una transacción). */
export async function packageAction(_prev: PackageResult | null, fd: FormData): Promise<PackageResult> {
  const at = Date.now();
  const scope = await pieceScope(fd);
  if (!scope) return { ok: false, message: "Pieza no encontrada o sesión no autorizada.", at };
  const { session, snapshot, piece, account, brand, date, concept } = scope;
  if (!canGenerate(snapshot, brand)) return { ok: false, message: "La generación editorial no está habilitada para este cliente.", at };
  if (!piece.format_key || !piece.production_mode_key) return { ok: false, message: "Elige formato y modo de producción antes de generar el paquete.", at };

  const result = await generatePackage(
    contextInput(snapshot, brand, account, date, {
      concept, format: piece.format_key, mode: piece.production_mode_key,
      pillarId: piece.pillar_id ?? null, territoryId: piece.territory_id ?? null, feedback: field(fd, "feedback", 500),
    }),
    reviewRules(snapshot, brand.id), generator(), runRecorder(session.supabase, brand.id, piece.id),
  );
  if (!result.ok) return { ok: false, message: result.message, at, code: result.code };

  const { pkg, evidence } = result;
  const stored = { ...pkg, concept_summary: pkg.concept, concept, evidence: { creative: evidence.creative, assessed: evidence.claims } };
  const { error } = await session.supabase.rpc("save_generated_package", {
    p_request_id: crypto.randomUUID(), p_piece_id: piece.id, p_expected_version: piece.version,
    p_package: stored, p_words: packageWords(pkg),
    p_claims: evidence.claims.map((c) => ({
      statement: c.statement, evidence_class: c.evidence_class, source_reference_id: c.source_reference_id,
      on_screen_credit: c.on_screen_credit, source_locator: null,
    })),
    p_dependencies: evidence.dependencies,
  });
  if (error) return { ok: false, message: `No se guardó el paquete: ${describeError(error)}`, at };
  revalidatePath("/", "layout");
  const missing = evidence.claims.filter((c) => c.source_missing).length;
  return { ok: true, message: "Paquete generado y guardado como borrador.", at, missingSources: missing, academic: evidence.dependencies.length > 0 };
}

/** Regenera el concepto de una pieza existente con una indicación breve. */
export async function regenerateConceptAction(_prev: ProposalResult | null, fd: FormData): Promise<ProposalResult> {
  const at = Date.now();
  const scope = await pieceScope(fd);
  if (!scope) return { ok: false, message: "Pieza no encontrada o sesión no autorizada.", at };
  const { session, snapshot, piece, account, brand, date, concept } = scope;
  if (!canGenerate(snapshot, brand)) return { ok: false, message: "La generación editorial no está habilitada para este cliente.", at };
  const result = await generateProposals("classify",
    contextInput(snapshot, brand, account, date, { userInput: JSON.stringify(concept).slice(0, 1500), feedback: field(fd, "feedback", 500) }),
    generator(), runRecorder(session.supabase, brand.id, piece.id));
  if (!result.ok) return { ok: false, message: result.message, at, code: result.code };
  const p = result.proposals[0];
  const { warnings: _w, pillar_id, territory_id, ...conceptOut } = p;
  const { error } = await session.supabase.rpc("save_generated_concept", {
    p_request_id: crypto.randomUUID(), p_piece_id: piece.id, p_expected_version: piece.version, p_title: p.title, p_idea: p.idea,
    p_pillar_id: pillar_id, p_territory_id: territory_id, p_concept: conceptOut,
  });
  if (error) return { ok: false, message: `No se guardó el concepto: ${describeError(error)}`, at };
  revalidatePath("/", "layout");
  return { ok: true, message: "Concepto regenerado. El anterior queda en el historial.", at };
}
