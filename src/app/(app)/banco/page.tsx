import Link from "next/link";
import { loadContext } from "@/application/context";
import { CalendarCard } from "@/components/calendar/CalendarCard";
import { MoveDateControl } from "@/components/calendar/MoveDateControl";
import { buildCards, type CardData } from "@/components/calendar/card-data";
import { fmtWeek } from "@/components/format";
import { Empty, PageHeader, Section } from "@/components/ui";

const GROUPS: { key: string; title: string; description: string; statuses: string[] }[] = [
  { key: "ideas", title: "Ideas", description: "Ideas y piezas planificadas que aún no tienen día.", statuses: ["idea", "planned"] },
  { key: "borradores", title: "Borradores", description: "En producción, revisión o con cambios pedidos, sin día.", statuses: ["in_production", "in_review", "changes_requested", "held"] },
  { key: "listas", title: "Listas sin fecha", description: "Aprobadas y sin día: agéndalas para que entren al calendario.", statuses: ["approved"] },
];

export default async function ContentBankPage() {
  const { snapshot } = await loadContext();
  const undated = buildCards(snapshot).filter((c) => c.date === null && c.statusKey !== "external");
  const v02Ready = snapshot.formats.length > 0;
  const weekByPiece = new Map(snapshot.facts.map((f) => [f.id, f.assignedWeek]));

  const item = (c: CardData) => {
    const week = weekByPiece.get(c.pieceId);
    return (
      <li key={c.pieceId} className="space-y-2 rounded-md border border-line bg-paper p-2">
        <CalendarCard card={c} />
        <p className="text-xs text-muted">{c.accountName}{week ? ` · semana del ${fmtWeek(week)}, sin día` : ""}</p>
        {v02Ready && <MoveDateControl pieceId={c.pieceId} version={c.version} currentDate={null} movable={c.movable} label="Agendar en" />}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Content Bank"
        subtitle="Lo que aún no tiene día en el calendario. Para crear algo nuevo, entra al día en el calendario."
        actions={<Link href="/inventario" className="text-sm underline">Inventario completo</Link>}
      />
      {GROUPS.map((g) => {
        const list = undated.filter((c) => g.statuses.includes(c.statusKey));
        return (
          <Section key={g.key} id={g.key} title={`${g.title} (${list.length})`} description={g.description}>
            {list.length === 0 ? <Empty>Nada por aquí.</Empty> : <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map(item)}</ul>}
          </Section>
        );
      })}
    </>
  );
}
