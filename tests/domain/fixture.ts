// Fixture ficticio de docs/ACCEPTANCE_TESTS.md. No representa datos operativos reales.
import type { EditorialTarget, PieceFact, PublicationFact, Timing } from "../../src/domain/types.ts";

export const NOW = new Date("2026-10-27T18:00:00Z"); // 2026-10-27 12:00 America/Mexico_City
export const W0 = "2026-10-26";
export const W1 = "2026-11-02";
export const W2 = "2026-11-09";

export const FLEX: Timing = { mode: "flexible", fixedDate: null, validFrom: null, validUntil: null };

export function target(overrides: Partial<EditorialTarget> = {}): EditorialTarget {
  return {
    id: "tA-feed",
    accountId: "A",
    bucket: "feed",
    requiredCount: 4,
    bufferTargetDays: 7,
    activeFrom: W0,
    activeUntil: null,
    ...overrides,
  };
}

export function piece(id: string, overrides: Partial<PieceFact> = {}): PieceFact {
  return {
    id,
    accountId: "A",
    bucket: "feed",
    title: id,
    ownership: "local",
    productionStatus: "approved",
    onHold: false,
    archived: false,
    contentRevision: 1,
    approvedRevision: 1,
    timing: FLEX,
    assignedWeek: W1,
    publications: [],
    latestObservation: null,
    ...overrides,
  };
}

export function pub(id: string, overrides: Partial<PublicationFact> = {}): PublicationFact {
  return { id, channelId: "instagram", status: "unscheduled", scheduledAt: null, publishedAt: null, ...overrides };
}

const notApproved = { approvedRevision: null } as const;

/** P1..P8 según el fixture base. */
export function basePieces(): PieceFact[] {
  return [
    piece("P1"),
    piece("P2", {
      publications: [
        pub("P2-ig", { status: "scheduled", scheduledAt: new Date("2026-11-03T17:00:00Z") }),
        pub("P2-fb", { channelId: "facebook", status: "scheduled", scheduledAt: new Date("2026-11-03T17:00:00Z") }),
      ],
    }),
    piece("P3", { productionStatus: "in_review", ...notApproved }),
    piece("P4", { productionStatus: "in_production", ...notApproved }),
    piece("P5", { productionStatus: "planned", ...notApproved }),
    piece("P6", { productionStatus: "idea", ...notApproved }),
    piece("P7", { assignedWeek: null }),
    piece("P8", { accountId: "B", assignedWeek: null }),
  ];
}

export function replace(pieces: PieceFact[], id: string, patch: Partial<PieceFact>): PieceFact[] {
  return pieces.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

/** n piezas aprobadas asignadas a una semana. */
export function approvedFor(week: string, n: number, prefix = week): PieceFact[] {
  return Array.from({ length: n }, (_, i) => piece(`${prefix}-${i}`, { assignedWeek: week }));
}
