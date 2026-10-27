import { redirect } from "next/navigation";
import { computeAccountReport, type AccountReport } from "@/domain/planning";
import { loadSnapshot, type Snapshot } from "@/infrastructure/data";
import { getSession } from "./session";

export interface AppContext {
  snapshot: Snapshot;
  reports: Map<string, AccountReport>;
  supabase: Extract<Awaited<ReturnType<typeof getSession>>, { kind: "authorized" }>["supabase"];
  userId: string;
}

/** Carga coherente + cálculos derivados para una página. Nada se persiste. */
export async function loadContext(): Promise<AppContext> {
  const session = await getSession();
  if (session.kind !== "authorized") redirect("/login");
  const snapshot = await loadSnapshot(session.supabase);
  const reports = new Map(
    snapshot.accountFacts.map((account) => [
      account.id,
      computeAccountReport({ account, targets: snapshot.targets, pieces: snapshot.facts, now: snapshot.now }),
    ]),
  );
  return { snapshot, reports, supabase: session.supabase, userId: session.userId };
}

export const newRequestId = () => crypto.randomUUID();
