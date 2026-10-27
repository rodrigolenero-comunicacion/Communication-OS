// Contrato único de cobertura (PRODUCT_MODEL §«Contrato único de cobertura»).
// Lo usan Control Tower, runway, reserva y el impacto de aprobación.
import { compareDates, type LocalDate } from "./time.ts";
import {
  effectiveStatus,
  hasCurrentApproval,
  hasOverdueSchedule,
  isFulfilled,
  isOnHold,
  isTimingExpired,
  weekFitsTiming,
} from "./pieces.ts";
import type { Bucket, EditorialTarget, PieceFact } from "./types.ts";

export type WeekStatus = "COVERED" | "AT_RISK" | "GAP" | "NO_TARGET";

export type ExclusionReason =
  | "archived"
  | "on_hold"
  | "overdue_schedule"
  | "timing_expired"
  | "timing_mismatch"
  | "external_unverified"
  | "external_review_incomplete"
  | "not_counted_status";

export interface WeekCoverage {
  weekStart: LocalDate;
  target: EditorialTarget | null;
  required: number;
  fulfilled: string[];
  safePending: string[];
  projectedOnly: string[]; // en PROJECTED pero no en SAFE
  excluded: { pieceId: string; reason: ExclusionReason }[];
  safe: number;
  projected: number;
  safeGap: number;
  projectedGap: number;
  status: WeekStatus;
}

export function targetForWeek(
  targets: readonly EditorialTarget[],
  accountId: string,
  bucket: Bucket,
  weekStart: LocalDate,
): EditorialTarget | null {
  return (
    targets.find(
      (t) =>
        t.accountId === accountId &&
        t.bucket === bucket &&
        compareDates(t.activeFrom, weekStart) <= 0 &&
        (t.activeUntil === null || compareDates(weekStart, t.activeUntil) < 0),
    ) ?? null
  );
}

export function computeWeekCoverage(args: {
  accountId: string;
  bucket: Bucket;
  weekStart: LocalDate;
  targets: readonly EditorialTarget[];
  pieces: readonly PieceFact[];
  now: Date;
}): WeekCoverage {
  const { accountId, bucket, weekStart, targets, pieces, now } = args;
  const target = targetForWeek(targets, accountId, bucket, weekStart);

  const seen = new Set<string>();
  const fulfilled: string[] = [];
  const safePending: string[] = [];
  const projectedOnly: string[] = [];
  const excluded: WeekCoverage["excluded"] = [];

  for (const piece of pieces) {
    if (piece.accountId !== accountId || piece.bucket !== bucket) continue;
    if (piece.assignedWeek !== weekStart) continue;
    if (seen.has(piece.id)) continue;
    seen.add(piece.id);

    // Demanda cumplida: se conserva aunque la pieza se archive.
    if (isFulfilled(piece)) {
      fulfilled.push(piece.id);
      continue;
    }
    const reason = exclusionReason(piece, weekStart, now);
    if (reason) {
      excluded.push({ pieceId: piece.id, reason });
      continue;
    }
    if (hasCurrentApproval(piece)) {
      safePending.push(piece.id);
      continue;
    }
    const status = effectiveStatus(piece);
    if (status === "in_review" || status === "in_production") {
      projectedOnly.push(piece.id);
    } else if (piece.ownership === "external" && status === "approved") {
      excluded.push({ pieceId: piece.id, reason: "external_review_incomplete" });
    } else {
      excluded.push({ pieceId: piece.id, reason: "not_counted_status" });
    }
  }

  const required = target?.requiredCount ?? 0;
  const safe = fulfilled.length + safePending.length;
  const projected = safe + projectedOnly.length;
  const safeGap = Math.max(0, required - safe);
  const projectedGap = Math.max(0, required - projected);
  let status: WeekStatus;
  if (!target) status = "NO_TARGET";
  else if (safe >= required) status = "COVERED";
  else if (projected >= required) status = "AT_RISK";
  else status = "GAP";

  return {
    weekStart,
    target,
    required,
    fulfilled,
    safePending,
    projectedOnly,
    excluded,
    safe,
    projected,
    safeGap: target ? safeGap : 0,
    projectedGap: target ? projectedGap : 0,
    status,
  };
}

function exclusionReason(piece: PieceFact, weekStart: LocalDate, now: Date): ExclusionReason | null {
  if (piece.archived) return "archived";
  if (isOnHold(piece)) return "on_hold";
  if (piece.ownership === "external" && effectiveStatus(piece) === null) return "external_unverified";
  if (!weekFitsTiming(piece.timing, weekStart)) return "timing_mismatch";
  if (hasOverdueSchedule(piece, now)) return "overdue_schedule";
  if (isTimingExpired(piece.timing, now)) return "timing_expired";
  return null;
}

export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  archived: "Archivada",
  on_hold: "En hold",
  overdue_schedule: "Programación vencida sin confirmar",
  timing_expired: "Fecha límite vencida sin publicar",
  timing_mismatch: "Timing incompatible con la semana",
  external_unverified: "Espejo sin estado verificable",
  external_review_incomplete: "Espejo aprobado sin revisión completa confirmada",
  not_counted_status: "Estado que no cuenta (idea, planned o cambios solicitados)",
};
