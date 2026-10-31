// Tipos del dominio. Reflejan el contrato de docs/PRODUCT_MODEL.md y docs/DATA_MODEL.md.
import type { LocalDate } from "./time.ts";

export type Bucket = "feed" | "stories";
export const BUCKETS: readonly Bucket[] = ["feed", "stories"];

export type CoverageMode = "unconfigured" | "weekly" | "not_required";

export type ProductionStatus =
  | "idea"
  | "planned"
  | "in_production"
  | "in_review"
  | "changes_requested"
  | "approved";

export type ObservedStatus = ProductionStatus | "unknown";

export type Ownership = "local" | "external";

export type TimingMode = "fixed" | "window" | "flexible";

export type PublicationStatus = "unscheduled" | "scheduled" | "published" | "cancelled";

export interface Timing {
  mode: TimingMode;
  fixedDate: LocalDate | null;
  validFrom: LocalDate | null;
  validUntil: LocalDate | null; // inclusivo
}

export interface EditorialTarget {
  id: string;
  accountId: string;
  bucket: Bucket;
  requiredCount: number;
  bufferTargetDays: number;
  activeFrom: LocalDate; // lunes, inclusivo
  activeUntil: LocalDate | null; // lunes, exclusivo
}

export interface PublicationFact {
  id: string;
  channelId: string;
  status: PublicationStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
}

export interface SourceObservationFact {
  observedStatus: ObservedStatus | null;
  reviewCompleteConfirmed: boolean;
  observedOnHold: boolean;
  observedAt: Date;
  sourceStateRaw: string;
}

/** Vista mínima de una pieza para cobertura, reserva y runway. */
export interface PieceFact {
  id: string;
  accountId: string;
  bucket: Bucket;
  title: string;
  ownership: Ownership;
  productionStatus: ProductionStatus | null; // null para espejos externos
  onHold: boolean;
  archived: boolean;
  contentRevision: number;
  approvedRevision: number | null;
  timing: Timing;
  assignedWeek: LocalDate | null;
  /** Día del calendario dentro de la semana asignada (V0.2); null si solo hay semana. */
  plannedDate?: LocalDate | null;
  publications: PublicationFact[];
  latestObservation: SourceObservationFact | null;
}

export interface AccountFact {
  id: string;
  brandId: string;
  name: string;
  active: boolean;
  coverageMode: CoverageMode;
}
