import { EDITORIAL_TZ, addDays, type LocalDate } from "@/domain/time";
import type { BufferHealth, Runway } from "@/domain/planning";
import type { WeekStatus } from "@/domain/coverage";
import type { ProductionStatus, PublicationStatus } from "@/domain/types";
import type { Tone } from "./ui";

const dayFmt = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const dateFmt = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const instantFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: EDITORIAL_TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: EDITORIAL_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: EDITORIAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDate = (d: LocalDate | null | undefined) => (d ? dateFmt.format(new Date(`${d}T00:00:00Z`)) : "—");
export const fmtDay = (d: LocalDate) => dayFmt.format(new Date(`${d}T00:00:00Z`));
export const fmtWeek = (w: LocalDate) => `${fmtDay(w)} – ${fmtDay(addDays(w, 6))}`;
export const fmtInstant = (i: Date | string | null | undefined) => (i ? `${instantFmt.format(new Date(i))} (CDMX)` : "—");
export const localDateInput = (i: Date | string) => isoDateFmt.format(new Date(i));
export const localTimeInput = (i: Date | string) => timeFmt.format(new Date(i));

export const STATUS_LABEL: Record<ProductionStatus, string> = {
  idea: "Idea",
  planned: "Planificada",
  in_production: "En producción",
  in_review: "En revisión",
  changes_requested: "Cambios solicitados",
  approved: "Aprobada",
};

export const STATUS_TONE: Record<ProductionStatus, Tone> = {
  idea: "neutral",
  planned: "neutral",
  in_production: "info",
  in_review: "warn",
  changes_requested: "bad",
  approved: "good",
};

export const PUB_LABEL: Record<PublicationStatus, string> = {
  unscheduled: "Sin programar",
  scheduled: "Programada",
  published: "Publicada (confirmada)",
  cancelled: "Cancelada",
};

export const WEEK_LABEL: Record<WeekStatus, string> = {
  COVERED: "Cubierta",
  AT_RISK: "En riesgo",
  GAP: "Gap",
  NO_TARGET: "Sin objetivo",
};
export const WEEK_TONE: Record<WeekStatus, Tone> = { COVERED: "good", AT_RISK: "warn", GAP: "bad", NO_TARGET: "neutral" };

export const HEALTH_LABEL: Record<BufferHealth, string> = {
  CRITICAL: "Crítico",
  LOW: "Buffer bajo",
  INDETERMINADO: "Indeterminado",
  HEALTHY: "Saludable",
  SIN_CONFIGURAR: "Sin objetivo configurado",
  SIN_CUOTA: "Sin cuota",
};
export const HEALTH_TONE: Record<BufferHealth, Tone> = {
  CRITICAL: "bad",
  LOW: "warn",
  INDETERMINADO: "info",
  HEALTHY: "good",
  SIN_CONFIGURAR: "neutral",
  SIN_CUOTA: "neutral",
};

export const BUCKET_LABEL = { feed: "Feed", stories: "Stories" } as const;
export const FORMAT_LABEL: Record<string, string> = {
  post: "Post", carousel: "Carrusel", reel: "Reel", video: "Video", story: "Story", other: "Otro",
};
export const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual", st_hub: "ST Hub", ijlv_editorial: "Sistema Editorial IJLV", solotu_cerebro: "Solotu_Cerebro",
};

/** Runway explicado: número + límite exclusivo + certeza del cálculo. */
export function describeRunway(r: Runway): string {
  switch (r.kind) {
    case "no_target":
      return "Sin objetivo configurado";
    case "gap":
      // Un gap en la semana en curso: no hay cobertura segura que mostrar hasta una fecha.
      if (r.until.getTime() <= Date.now()) return `0 días · la semana actual (desde ${fmtDay(r.gapWeek)}) no está cubierta`;
      return `${r.days} día(s) · cubierto hasta ${fmtInstant(r.until)} (límite exclusivo)`;
    case "at_least":
      return `al menos ${r.days} día(s) · horizonte cubierto hasta ${fmtInstant(r.until)}`;
    case "unknown_after":
      return `${r.days} día(s) conocidos · desconocido después de ${fmtInstant(r.until)} (sin política)`;
  }
}
