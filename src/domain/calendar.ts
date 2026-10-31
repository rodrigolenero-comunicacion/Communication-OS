// Calendario mensual (lunes–domingo) y estado visible de una pieza en su tarjeta.
// Puro: recibe fechas locales y hechos; no lee el reloj.
import { addDays, isLocalDate, localDateOf, weekStartOf, type LocalDate } from "./time.ts";
import type { PieceFact } from "./types.ts";

/** Mes como "YYYY-MM". */
export type MonthKey = string;

export interface CalendarDay {
  date: LocalDate;
  inMonth: boolean;
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthOf(date: LocalDate): MonthKey {
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Semanas completas (lunes–domingo) que cubren el mes; incluye días vecinos marcados fuera de mes. */
export function monthGrid(month: MonthKey): CalendarDay[][] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  const weeks: CalendarDay[][] = [];
  for (let start = weekStartOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        return { date, inMonth: monthOf(date) === month };
      }),
    );
  }
  return weeks;
}

export function isDateInMonth(date: unknown, month: MonthKey): boolean {
  return isLocalDate(date) && monthOf(date) === month;
}

export type CardStatusKey =
  | "idea"
  | "planned"
  | "in_production"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "held"
  | "external";

export interface CardStatus {
  key: CardStatusKey;
  label: string;
  /** Símbolo textual: el estado nunca depende solo del color. */
  symbol: string;
}

const CARD_STATUS: Record<CardStatusKey, Omit<CardStatus, "key">> = {
  idea: { label: "Idea", symbol: "○" },
  planned: { label: "Planificada", symbol: "○" },
  in_production: { label: "Producción", symbol: "●" },
  in_review: { label: "En revisión", symbol: "◐" },
  changes_requested: { label: "Cambios", symbol: "↺" },
  approved: { label: "Aprobada", symbol: "✓" },
  scheduled: { label: "Programada", symbol: "◷" },
  published: { label: "Publicada", symbol: "✔" },
  held: { label: "En hold", symbol: "‖" },
  external: { label: "Espejo", symbol: "⇄" },
};

/**
 * Estado que muestra la tarjeta, derivado de la máquina existente sin crear otra:
 * publicada > programada > hold > estado de producción. Espejos muestran su origen.
 */
export function cardStatus(piece: Pick<PieceFact, "ownership" | "productionStatus" | "onHold" | "publications">): CardStatus {
  let key: CardStatusKey;
  if (piece.publications.some((p) => p.status === "published")) key = "published";
  else if (piece.publications.some((p) => p.status === "scheduled")) key = "scheduled";
  else if (piece.ownership === "external") key = "external";
  else if (piece.onHold) key = "held";
  else key = piece.productionStatus ?? "idea";
  return { key, ...CARD_STATUS[key] };
}

/**
 * Día en que la pieza aparece en el calendario: día planeado; si no hay, el de su
 * primera publicación confirmada o, en su defecto, programada. Null = sin fecha (Content Bank).
 */
export function calendarDateOf(piece: Pick<PieceFact, "plannedDate" | "publications">): LocalDate | null {
  if (piece.plannedDate) return piece.plannedDate;
  const first = (status: "published" | "scheduled") =>
    piece.publications
      .filter((p) => p.status === status)
      .map((p) => (status === "published" ? p.publishedAt : p.scheduledAt))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0];
  const instant = first("published") ?? first("scheduled");
  return instant ? localDateOf(instant) : null;
}

/** ¿Se puede arrastrar? D1: no con publicación programada o confirmada, ni archivada. */
export function canMoveByDrag(piece: Pick<PieceFact, "archived" | "publications">): boolean {
  return !piece.archived && !piece.publications.some((p) => p.status === "scheduled" || p.status === "published");
}
