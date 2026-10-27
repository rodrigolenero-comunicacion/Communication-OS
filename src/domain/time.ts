// Tiempo editorial: fechas locales en America/Mexico_City, semanas lunes–domingo.
// Toda función recibe `now` u otra fecha como argumento; ninguna lee el reloj.

export const EDITORIAL_TZ = "America/Mexico_City";
export const DAY_MS = 86_400_000;

/** Fecha local ISO (YYYY-MM-DD). */
export type LocalDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EDITORIAL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EDITORIAL_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Día editorial local de un instante. */
export function localDateOf(instant: Date): LocalDate {
  return dateFormatter.format(instant);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 1 = lunes … 7 = domingo. */
export function isoWeekday(date: LocalDate): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isMonday(date: LocalDate): boolean {
  return isLocalDate(date) && isoWeekday(date) === 1;
}

/** Lunes de la semana editorial que contiene `date`. */
export function weekStartOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function currentWeekStart(now: Date): LocalDate {
  return weekStartOf(localDateOf(now));
}

/** Desfase (ms) de la zona editorial respecto a UTC en un instante dado. */
function zoneOffsetMs(instant: Date): number {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC de una fecha y hora locales (HH:mm) en la zona editorial. */
export function localDateTime(date: LocalDate, time = "00:00"): Date {
  const guess = Date.parse(`${date}T${time}:00Z`);
  let instant = guess - zoneOffsetMs(new Date(guess));
  // Segunda pasada por si el desfase cambia entre la estimación y el resultado.
  instant = guess - zoneOffsetMs(new Date(instant));
  return new Date(instant);
}

/** Instante UTC correspondiente a las 00:00 locales de `date`. */
export function localMidnight(date: LocalDate): Date {
  return localDateTime(date, "00:00");
}

/** Comparación lexicográfica válida para fechas ISO. */
export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Días completos entre dos instantes, nunca negativos. */
export function wholeDaysBetween(from: Date, until: Date): number {
  return Math.max(0, Math.floor((until.getTime() - from.getTime()) / DAY_MS));
}

export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
