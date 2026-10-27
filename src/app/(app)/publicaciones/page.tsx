import Link from "next/link";
import { loadContext } from "@/application/context";
import { PublicationPanel } from "@/components/PublicationPanel";
import { fmtWeek } from "@/components/format";
import { Empty, PageHeader, Section } from "@/components/ui";
import { hasCurrentApproval } from "@/domain/pieces";

export default async function PublicationQueuePage() {
  const { snapshot } = await loadContext();
  const { pieces, facts, publications, accounts, channels, accountChannels, now } = snapshot;
  const factById = new Map(facts.map((f) => [f.id, f]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const pubsByPiece = (id: string) => publications.filter((p) => p.content_piece_id === id);

  const withoutDestination = pieces.filter((p) => {
    const f = factById.get(p.id)!;
    return hasCurrentApproval(f) && pubsByPiece(p.id).every((x) => x.status === "cancelled");
  });
  const openIds = new Set(publications.filter((p) => p.status === "unscheduled" || p.status === "scheduled").map((p) => p.content_piece_id));
  const withOpen = pieces.filter((p) => openIds.has(p.id))
    .sort((a, b) => (factById.get(a.id)!.assignedWeek ?? "9999").localeCompare(factById.get(b.id)!.assignedWeek ?? "9999"));
  const overdue = publications.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= now).length;

  const panel = (pieceId: string, onlyOpen: boolean) => {
    const f = factById.get(pieceId)!;
    const piece = pieces.find((p) => p.id === pieceId)!;
    const account = accountById.get(piece.account_id)!;
    return (
      <div key={pieceId} className="rounded-lg border border-line p-3">
        <div className="mb-2 text-sm">
          <Link href={`/piezas/${pieceId}`} className="font-medium underline">{piece.title}</Link>{" "}
          <span className="text-muted">· {account.name} · {f.assignedWeek ? `semana ${fmtWeek(f.assignedWeek)}` : "sin semana asignada"}</span>
        </div>
        <PublicationPanel
          pieceId={pieceId}
          publications={pubsByPiece(pieceId).filter((p) => !onlyOpen || p.status === "unscheduled" || p.status === "scheduled")}
          channels={channels}
          activeChannelIds={accountChannels.filter((ac) => ac.account_id === account.id && ac.active).map((ac) => ac.channel_id)}
          canCreate={hasCurrentApproval(f) && account.active}
          assignedWeek={f.assignedWeek}
          now={now}
          contentType={piece.content_type}
        />
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Publication Queue"
        subtitle="Registros manuales. Guardar aquí no publica nada: confirma lo que hiciste en la plataforma. Si IG ya se publicó y FB sigue pendiente, la semana conserva una unidad y FB permanece en cola."
      />
      {overdue > 0 && <p className="mb-4 rounded-md border border-bad/30 bg-bad/5 p-3 text-sm text-bad">{overdue} programación(es) vencida(s) sin confirmar.</p>}
      <Section title={`Aprobadas sin destino (${withoutDestination.length})`} description="Aprobar no crea registros de publicación automáticamente.">
        {withoutDestination.length === 0 ? <Empty>Nada pendiente.</Empty> : <div className="space-y-3">{withoutDestination.map((p) => panel(p.id, false))}</div>}
      </Section>
      <Section title={`Destinos sin programar o programados (${withOpen.length} pieza(s))`}>
        {withOpen.length === 0 ? <Empty>Sin destinos abiertos.</Empty> : <div className="space-y-3">{withOpen.map((p) => panel(p.id, true))}</div>}
      </Section>
    </>
  );
}
