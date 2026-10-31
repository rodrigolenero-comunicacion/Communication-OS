import Link from "next/link";
import { loadContext } from "@/application/context";
import { CalendarCard } from "@/components/calendar/CalendarCard";
import { MoveDateControl } from "@/components/calendar/MoveDateControl";
import { buildCards, type CardData } from "@/components/calendar/card-data";
import { fmtWeek } from "@/components/format";
import { Empty, PageHeader, Section } from "@/components/ui";
import { CONTENT_ORIGINS, type ContentOrigin } from "@/domain/calendar";

type Group = "listas" | "material" | "ideas" | "borradores";

const GROUPS: { key: Group; title: string; description: string }[] = [
  { key: "listas", title: "Listas sin fecha", description: "Aprobadas, o de evento/material con el material disponible. Agéndalas para que entren al calendario." },
  { key: "material", title: "Esperando material", description: "Dependen de material que todavía no está disponible." },
  { key: "ideas", title: "Ideas", description: "Ideas y piezas planificadas que aún no tienen día." },
  { key: "borradores", title: "Borradores", description: "En producción, revisión, con cambios pedidos o en hold." },
];

const ORIGIN_FILTER: { key: ContentOrigin | ""; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "organic", label: "Orgánico" },
  { key: "event_coverage", label: "Evento" },
  { key: "existing_material", label: "Material existente" },
];

/** Grupo del banco: material pendiente no aparenta estar listo; evento/material disponible sí está listo. */
function groupOf(c: CardData): Group {
  if (c.attention?.label === "Material pendiente") return "material";
  if (c.statusKey === "approved") return "listas";
  if (c.contentOrigin !== "organic" && c.attention && ["idea", "planned"].includes(c.statusKey)) return "listas";
  if (["idea", "planned"].includes(c.statusKey)) return "ideas";
  return "borradores";
}

export default async function ContentBankPage({ searchParams }: { searchParams: Promise<{ origen?: string }> }) {
  const { origen } = await searchParams;
  const origin = (CONTENT_ORIGINS as readonly string[]).includes(origen ?? "") ? (origen as ContentOrigin) : "";
  const { snapshot } = await loadContext();
  const undated = buildCards(snapshot).filter(
    (c) => c.date === null && c.statusKey !== "external" && (!origin || c.contentOrigin === origin),
  );
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
      <nav aria-label="Filtrar por origen" className="mb-5 flex flex-wrap gap-1 text-sm">
        {ORIGIN_FILTER.map((f) => (
          <Link key={f.key} href={f.key ? `/banco?origen=${f.key}` : "/banco"} aria-current={origin === f.key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${origin === f.key ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
            {f.label}
          </Link>
        ))}
      </nav>
      {undated.length === 0 && (
        <p role="status" className="mb-5 rounded-md border border-line bg-paper p-3 text-sm">
          Nada sin fecha{origin ? " con este filtro" : ""}. Tus piezas con fecha están en el{" "}
          <Link href="/" className="underline">calendario</Link>. Para traer una aquí, ábrela y usa «Quitar del calendario».
        </p>
      )}
      {GROUPS.map((g) => {
        const list = undated.filter((c) => groupOf(c) === g.key);
        return (
          <Section key={g.key} id={g.key} title={`${g.title} (${list.length})`} description={g.description}>
            {list.length === 0 ? <Empty>Nada sin fecha en este grupo.</Empty> : <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map(item)}</ul>}
          </Section>
        );
      })}
    </>
  );
}
