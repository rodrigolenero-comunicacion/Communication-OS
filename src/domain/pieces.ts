// Predicados sobre piezas: aprobación vigente, timing y condiciones de exclusión.
import { addDays, compareDates, localDateOf, weekStartOf, type LocalDate } from "./time.ts";
import type { PieceFact, Timing } from "./types.ts";

/** Aprobación vigente local, o aprobación observada de la pieza completa en el sistema fuente. */
export function hasCurrentApproval(piece: PieceFact): boolean {
  if (piece.ownership === "local") {
    return (
      piece.productionStatus === "approved" &&
      piece.approvedRevision !== null &&
      piece.approvedRevision === piece.contentRevision
    );
  }
  const obs = piece.latestObservation;
  return obs !== null && obs.observedStatus === "approved" && obs.reviewCompleteConfirmed;
}

/** Estado efectivo para la capa PROJECTED. Espejo sin observación o `unknown` no cuenta. */
export function effectiveStatus(piece: PieceFact) {
  if (piece.ownership === "local") return piece.productionStatus;
  const obs = piece.latestObservation;
  if (!obs || obs.observedStatus === null || obs.observedStatus === "unknown") return null;
  return obs.observedStatus;
}

export function isOnHold(piece: PieceFact): boolean {
  if (piece.ownership === "local") return piece.onHold;
  return piece.latestObservation?.observedOnHold ?? false;
}

export function isFulfilled(piece: PieceFact): boolean {
  return piece.publications.some((p) => p.status === "published");
}

/** Algún destino scheduled cuya hora ya pasó sin confirmación de publicación. */
export function hasOverdueSchedule(piece: PieceFact, now: Date): boolean {
  return piece.publications.some(
    (p) => p.status === "scheduled" && p.scheduledAt !== null && p.scheduledAt.getTime() <= now.getTime(),
  );
}

/** Último día local admisible para la pieza; null si flexible. */
export function timingLastDay(timing: Timing): LocalDate | null {
  if (timing.mode === "fixed") return timing.fixedDate;
  if (timing.mode === "window") return timing.validUntil;
  return null;
}

/** El timing expiró (sin publicación): su último día admisible ya pasó. */
export function isTimingExpired(timing: Timing, now: Date): boolean {
  const last = timingLastDay(timing);
  return last !== null && compareDates(last, localDateOf(now)) < 0;
}

/** ¿Una fecha local concreta cumple el timing? */
export function dateFitsTiming(timing: Timing, date: LocalDate): boolean {
  if (timing.mode === "fixed") return timing.fixedDate === date;
  if (timing.mode === "window") {
    return (
      timing.validFrom !== null &&
      timing.validUntil !== null &&
      compareDates(timing.validFrom, date) <= 0 &&
      compareDates(date, timing.validUntil) <= 0
    );
  }
  return true;
}

/** ¿La semana (lunes) es asignable según el timing? fixed: contiene la fecha; window: intersecta. */
export function weekFitsTiming(timing: Timing, weekStart: LocalDate): boolean {
  const weekEnd = addDays(weekStart, 6);
  if (timing.mode === "fixed") {
    return timing.fixedDate !== null && weekStartOf(timing.fixedDate) === weekStart;
  }
  if (timing.mode === "window") {
    if (timing.validFrom === null || timing.validUntil === null) return false;
    return compareDates(timing.validFrom, weekEnd) <= 0 && compareDates(weekStart, timing.validUntil) <= 0;
  }
  return true;
}

export function validateTiming(timing: Timing): string | null {
  if (timing.mode === "fixed") {
    if (!timing.fixedDate) return "El timing fijo requiere fecha.";
    if (timing.validFrom || timing.validUntil) return "El timing fijo no admite rango.";
  } else if (timing.mode === "window") {
    if (!timing.validFrom || !timing.validUntil) return "La ventana requiere fecha inicial y final.";
    if (compareDates(timing.validFrom, timing.validUntil) > 0) return "La ventana termina antes de empezar.";
    if (timing.fixedDate) return "La ventana no admite fecha fija.";
  } else if (timing.fixedDate || timing.validFrom || timing.validUntil) {
    return "El timing flexible no lleva fechas.";
  }
  return null;
}
