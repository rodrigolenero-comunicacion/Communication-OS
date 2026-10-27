// Runway, buffer, reserva, necesidades e impacto de aprobación.
// Todo se deriva de computeWeekCoverage; nada se persiste.
import { computeWeekCoverage, targetForWeek, type WeekCoverage } from "./coverage.ts";
import { hasCurrentApproval, isOnHold } from "./pieces.ts";
import { addDays, currentWeekStart, localMidnight, wholeDaysBetween, type LocalDate } from "./time.ts";
import { BUCKETS, type AccountFact, type Bucket, type EditorialTarget, type PieceFact } from "./types.ts";

export const DEFAULT_HORIZON_WEEKS = 12;

export type Layer = "safe" | "projected";

export type Runway =
  /** Primera semana no cubierta: `until` es su lunes 00:00 local (límite exclusivo). */
  | { kind: "gap"; gapWeek: LocalDate; until: Date; days: number }
  /** Todo el horizonte cubierto: cota inferior, nunca infinito. */
  | { kind: "at_least"; until: Date; days: number }
  /** Se acaba la política antes de encontrar gap: demanda posterior desconocida. */
  | { kind: "unknown_after"; until: Date; days: number }
  /** No hay objetivo aplicable en la semana actual. */
  | { kind: "no_target" };

export type BufferHealth = "CRITICAL" | "LOW" | "INDETERMINADO" | "HEALTHY" | "SIN_CONFIGURAR" | "SIN_CUOTA";

export interface BucketReport {
  bucket: Bucket;
  weeks: WeekCoverage[];
  safeRunway: Runway;
  projectedRunway: Runway;
  health: BufferHealth;
  bufferTargetDays: number | null;
  reserve: string[];
  hasOverdueSchedules: boolean;
}

export interface AccountReport {
  accountId: string;
  coverageMode: AccountFact["coverageMode"];
  active: boolean;
  buckets: BucketReport[];
  health: BufferHealth;
  /** Runway seguro mínimo entre buckets evaluados. */
  minSafeRunway: Runway | null;
}

export function horizonWeeks(now: Date, count = DEFAULT_HORIZON_WEEKS): LocalDate[] {
  const w0 = currentWeekStart(now);
  return Array.from({ length: count }, (_, i) => addDays(w0, i * 7));
}

export function computeRunway(weeks: readonly WeekCoverage[], layer: Layer, now: Date): Runway {
  if (weeks.length === 0 || weeks[0].target === null) return { kind: "no_target" };
  for (const week of weeks) {
    if (week.target === null) {
      const until = localMidnight(week.weekStart);
      return { kind: "unknown_after", until, days: wholeDaysBetween(now, until) };
    }
    const total = layer === "safe" ? week.safe : week.projected;
    if (total < week.required) {
      const until = localMidnight(week.weekStart);
      return { kind: "gap", gapWeek: week.weekStart, until, days: wholeDaysBetween(now, until) };
    }
  }
  const until = localMidnight(addDays(weeks[weeks.length - 1].weekStart, 7));
  return { kind: "at_least", until, days: wholeDaysBetween(now, until) };
}

export function computeBufferHealth(
  weeks: readonly WeekCoverage[],
  safeRunway: Runway,
): BufferHealth {
  if (safeRunway.kind === "no_target") return "SIN_CONFIGURAR";
  const current = weeks[0];
  const bufferTarget = current.target!.bufferTargetDays;
  if (current.safeGap > 0 || safeRunway.days === 0) return "CRITICAL";
  if (safeRunway.days >= bufferTarget) return "HEALTHY";
  // Un gap conocido antes del objetivo es falta de buffer; una cota del horizonte
  // o un fin de política no demuestran ni salud ni falta.
  return safeRunway.kind === "gap" ? "LOW" : "INDETERMINADO";
}

/** Piezas en reserva para una cuenta/bucket (PRODUCT_MODEL §«Reserva y necesidades»). */
export function reservePool(pieces: readonly PieceFact[], accountId: string, bucket: Bucket): PieceFact[] {
  return pieces.filter(
    (p) =>
      p.accountId === accountId &&
      p.bucket === bucket &&
      p.timing.mode === "flexible" &&
      p.assignedWeek === null &&
      !p.archived &&
      !isOnHold(p) &&
      hasCurrentApproval(p) &&
      !p.publications.some((pub) => pub.status === "scheduled" || pub.status === "published"),
  );
}

/** Posibilidad para UNA ventana; no agregar entre semanas. No cambia el estado de la semana. */
export function achievable(week: WeekCoverage, reserveCount: number): number {
  return Math.min(week.required, week.safe + reserveCount);
}

function bucketsToEvaluate(targets: readonly EditorialTarget[], accountId: string, now: Date): Bucket[] {
  const w0 = currentWeekStart(now);
  // Buckets con política vigente o pendiente de vigencia.
  return BUCKETS.filter((b) =>
    targets.some((t) => t.accountId === accountId && t.bucket === b && (t.activeUntil === null || t.activeUntil > w0)),
  );
}

export function computeBucketReport(args: {
  accountId: string;
  bucket: Bucket;
  targets: readonly EditorialTarget[];
  pieces: readonly PieceFact[];
  now: Date;
  horizon?: number;
}): BucketReport {
  const { accountId, bucket, targets, pieces, now } = args;
  const weeks = horizonWeeks(now, args.horizon).map((weekStart) =>
    computeWeekCoverage({ accountId, bucket, weekStart, targets, pieces, now }),
  );
  const safeRunway = computeRunway(weeks, "safe", now);
  const projectedRunway = computeRunway(weeks, "projected", now);
  const current = targetForWeek(targets, accountId, bucket, weeks[0].weekStart);
  return {
    bucket,
    weeks,
    safeRunway,
    projectedRunway,
    health: computeBufferHealth(weeks, safeRunway),
    bufferTargetDays: current?.bufferTargetDays ?? null,
    reserve: reservePool(pieces, accountId, bucket).map((p) => p.id),
    hasOverdueSchedules: pieces.some(
      (p) =>
        p.accountId === accountId &&
        p.bucket === bucket &&
        p.publications.some((pub) => pub.status === "scheduled" && pub.scheduledAt !== null && pub.scheduledAt <= now),
    ),
  };
}

const HEALTH_SEVERITY: Record<BufferHealth, number> = {
  CRITICAL: 0,
  LOW: 1,
  INDETERMINADO: 2,
  SIN_CONFIGURAR: 3,
  HEALTHY: 4,
  SIN_CUOTA: 5,
};

export function worstHealth(values: readonly BufferHealth[]): BufferHealth {
  return [...values].sort((a, b) => HEALTH_SEVERITY[a] - HEALTH_SEVERITY[b])[0] ?? "SIN_CONFIGURAR";
}

function runwayDays(r: Runway): number {
  return r.kind === "no_target" ? Number.POSITIVE_INFINITY : r.days;
}

export function computeAccountReport(args: {
  account: AccountFact;
  targets: readonly EditorialTarget[];
  pieces: readonly PieceFact[];
  now: Date;
  horizon?: number;
}): AccountReport {
  const { account, targets, pieces, now } = args;
  const base = { accountId: account.id, coverageMode: account.coverageMode, active: account.active };
  if (account.coverageMode === "not_required") {
    return { ...base, buckets: [], health: "SIN_CUOTA", minSafeRunway: null };
  }
  const buckets = bucketsToEvaluate(targets, account.id, now).map((bucket) =>
    computeBucketReport({ accountId: account.id, bucket, targets, pieces, now, horizon: args.horizon }),
  );
  if (buckets.length === 0) {
    return { ...base, buckets, health: "SIN_CONFIGURAR", minSafeRunway: null };
  }
  const withRunway = buckets.map((b) => b.safeRunway).filter((r) => r.kind !== "no_target");
  const minSafeRunway = withRunway.sort((a, b) => runwayDays(a) - runwayDays(b))[0] ?? null;
  return { ...base, buckets, health: worstHealth(buckets.map((b) => b.health)), minSafeRunway };
}

export interface EditorialNeed {
  accountId: string;
  bucket: Bucket;
  weekStart: LocalDate;
  safeGap: number;
  projectedGap: number;
  reason: string;
}

/** Necesidades calculadas a partir de gaps. No crean piezas. */
export function computeNeeds(report: AccountReport): EditorialNeed[] {
  const needs: EditorialNeed[] = [];
  for (const b of report.buckets) {
    for (const w of b.weeks) {
      if (w.target === null || (w.safeGap === 0 && w.projectedGap === 0)) continue;
      needs.push({
        accountId: report.accountId,
        bucket: b.bucket,
        weekStart: w.weekStart,
        safeGap: w.safeGap,
        projectedGap: w.projectedGap,
        reason:
          w.projectedGap > 0
            ? `Faltan ${w.projectedGap} pieza(s) incluso contando las que están en producción o revisión.`
            : `Faltan ${w.safeGap} aprobación(es) para cubrir con seguridad; hay piezas en curso suficientes.`,
      });
    }
  }
  return needs;
}

export interface ApprovalImpact {
  pieceId: string;
  assignedWeek: LocalDate | null;
  before: BucketReport;
  after: BucketReport;
  changesRunway: boolean;
}

/**
 * Simula aprobar la revisión vigente de una pieza con las mismas funciones de cobertura.
 * Es una estimación de la operación local; no escribe nada.
 */
export function simulateApprovalImpact(args: {
  piece: PieceFact;
  targets: readonly EditorialTarget[];
  pieces: readonly PieceFact[];
  now: Date;
}): ApprovalImpact {
  const { piece, targets, pieces, now } = args;
  const simulated: PieceFact = {
    ...piece,
    productionStatus: "approved",
    approvedRevision: piece.contentRevision,
  };
  const afterPieces = pieces.map((p) => (p.id === piece.id ? simulated : p));
  const common = { accountId: piece.accountId, bucket: piece.bucket, targets, now };
  const before = computeBucketReport({ ...common, pieces });
  const after = computeBucketReport({ ...common, pieces: afterPieces });
  return {
    pieceId: piece.id,
    assignedWeek: piece.assignedWeek,
    before,
    after,
    changesRunway:
      JSON.stringify(before.safeRunway) !== JSON.stringify(after.safeRunway) ||
      before.weeks.some((w, i) => w.safe !== after.weeks[i].safe),
  };
}
