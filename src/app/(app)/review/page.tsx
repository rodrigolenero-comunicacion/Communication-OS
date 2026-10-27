import Link from "next/link";
import { loadContext } from "@/application/context";
import { BUCKET_LABEL, HEALTH_LABEL, HEALTH_TONE, fmtDate, fmtInstant, fmtWeek } from "@/components/format";
import { Badge, Empty, PageHeader, Section } from "@/components/ui";
import type { BufferHealth } from "@/domain/planning";
import type { PieceRow } from "@/infrastructure/data";

const HEALTH_RANK: Partial<Record<BufferHealth, number>> = { CRITICAL: 0, LOW: 1 };

export default async function ReviewDeskPage() {
  const { snapshot, reports, supabase } = await loadContext();
  const { pieces, accounts, facts } = snapshot;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const factById = new Map(facts.map((f) => [f.id, f]));

  const queue = pieces.filter((p) => p.ownership === "local" && p.production_status === "in_review" && !p.on_hold && !p.archived_at);
  const holds = pieces.filter((p) => p.on_hold && !p.archived_at);
  const mirrors = facts.filter((f) => f.ownership === "external" && !f.archived && f.latestObservation?.observedStatus === "in_review");

  const { data: submitted } = queue.length
    ? await supabase.from("operation_events").select("content_piece_id, occurred_at").eq("event_type", "review_submitted")
        .in("content_piece_id", queue.map((p) => p.id))
    : { data: [] as { content_piece_id: string; occurred_at: string }[] };
  const enteredAt = new Map<string, string>();
  for (const e of submitted ?? []) {
    const prev = enteredAt.get(e.content_piece_id);
    if (!prev || e.occurred_at > prev) enteredAt.set(e.content_piece_id, e.occurred_at);
  }

  /** Fecha objetivo: semana asignada, fecha fija, fin de ventana o vencimiento productivo. */
  const targetDate = (p: PieceRow) =>
    factById.get(p.id)?.assignedWeek ?? p.fixed_date ?? p.valid_until ?? p.due_date ?? null;
  const health = (p: PieceRow) => reports.get(p.account_id)?.health ?? "SIN_CONFIGURAR";
  const sorted = [...queue].sort((a, b) => {
    const ta = targetDate(a) ?? "9999-12-31";
    const tb = targetDate(b) ?? "9999-12-31";
    if (ta !== tb) return ta < tb ? -1 : 1;
    const ha = HEALTH_RANK[health(a)] ?? 2;
    const hb = HEALTH_RANK[health(b)] ?? 2;
    if (ha !== hb) return ha - hb;
    return (enteredAt.get(a.id) ?? "").localeCompare(enteredAt.get(b.id) ?? "");
  });

  return (
    <>
      <PageHeader
        title="Review Desk"
        subtitle="Orden: fecha objetivo más próxima → salud de la cuenta (crítico, bajo, resto) → fecha de entrada a revisión. Sin puntuaciones opacas."
      />
      <Section title={`Pendientes de decisión (${sorted.length})`}>
        {sorted.length === 0 ? <Empty>No hay piezas en revisión.</Empty> : (
          <ol className="space-y-2">
            {sorted.map((p) => {
              const f = factById.get(p.id)!;
              return (
                <li key={p.id} className="rounded-lg border border-line bg-paper p-3">
                  <Link href={`/review/${p.id}`} className="font-medium underline">{p.title}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{accountById.get(p.account_id)?.name} · {BUCKET_LABEL[p.bucket]}</span>
                    <Badge tone={HEALTH_TONE[health(p)]}>{HEALTH_LABEL[health(p)]}</Badge>
                    <span>{f.assignedWeek ? `Semana ${fmtWeek(f.assignedWeek)}` : "Sin semana"}</span>
                    {!f.assignedWeek && targetDate(p) && <span>Fecha objetivo {fmtDate(targetDate(p))}</span>}
                    {enteredAt.get(p.id) && <span>En revisión desde {fmtInstant(enteredAt.get(p.id))}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
      {holds.length > 0 && (
        <Section title={`En hold (${holds.length})`} description="Fuera de cobertura pendiente y de reserva hasta liberarse explícitamente.">
          <ul className="space-y-1 text-sm">
            {holds.map((p) => <li key={p.id}><Link href={`/review/${p.id}`} className="underline">{p.title}</Link> · {accountById.get(p.account_id)?.name}</li>)}
          </ul>
        </Section>
      )}
      {mirrors.length > 0 && (
        <Section title="Espejos en revisión en su sistema fuente" description="No se deciden aquí: abre la fuente o registra una nueva observación.">
          <ul className="space-y-1 text-sm">
            {mirrors.map((f) => (
              <li key={f.id}>
                <Link href={`/piezas/${f.id}`} className="underline">{f.title}</Link> · observado {fmtInstant(f.latestObservation!.observedAt)} · «{f.latestObservation!.sourceStateRaw}»
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
