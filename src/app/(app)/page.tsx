import Link from "next/link";
import { loadContext, newRequestId } from "@/application/context";
import { BootstrapPortfolio } from "@/components/BootstrapPortfolio";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { buildCards, type CardData } from "@/components/calendar/card-data";
import { PageHeader } from "@/components/ui";
import { addMonths, isMonthKey, monthGrid, monthOf } from "@/domain/calendar";
import { computeNeeds } from "@/domain/planning";
import { addDays, currentWeekStart, localDateOf } from "@/domain/time";

const monthTitle = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", month: "long", year: "numeric" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const { snapshot, reports } = await loadContext();
  const today = localDateOf(snapshot.now);
  const month = isMonthKey(m) ? m : monthOf(today);
  const weeks = monthGrid(month);

  if (snapshot.brands.length === 0) {
    return (
      <>
        <PageHeader title="Calendario" subtitle="Primer uso: todavía no hay clientes ni cuentas." />
        <BootstrapPortfolio requestId={newRequestId()} />
      </>
    );
  }

  const first = weeks[0][0].date;
  const last = weeks.at(-1)!.at(-1)!.date;
  const cardsByDate: Record<string, CardData[]> = {};
  for (const card of buildCards(snapshot)) {
    if (card.date && card.date >= first && card.date <= last) (cardsByDate[card.date] ??= []).push(card);
  }

  // Inteligencia secundaria: gaps seguros de la próxima semana por cliente.
  const nextWeek = addDays(currentWeekStart(snapshot.now), 7);
  const brandName = new Map(snapshot.brands.map((b) => [b.id, b.short_label || b.name]));
  const gapsByBrand = new Map<string, number>();
  for (const account of snapshot.accounts.filter((a) => a.active)) {
    const gap = computeNeeds(reports.get(account.id)!).filter((n) => n.weekStart === nextWeek).reduce((s, n) => s + n.safeGap, 0);
    if (gap > 0) gapsByBrand.set(account.brand_id, (gapsByBrand.get(account.brand_id) ?? 0) + gap);
  }
  const migrationPending = snapshot.formats.length === 0;

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{monthTitle.format(new Date(`${month}-01T00:00:00Z`))}</h1>
        <nav aria-label="Cambiar de mes" className="flex items-center gap-1">
          <Link href={`/?m=${addMonths(month, -1)}`} className="btn border border-line bg-paper" aria-label="Mes anterior">←</Link>
          <Link href="/" className="btn border border-line bg-paper">Hoy</Link>
          <Link href={`/?m=${addMonths(month, 1)}`} className="btn border border-line bg-paper" aria-label="Mes siguiente">→</Link>
        </nav>
      </header>

      {migrationPending && (
        <p className="mb-3 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm">
          Falta aplicar la migración 0008 en Supabase: el calendario muestra lo existente, pero aún no puedes crear contenido desde un día.
        </p>
      )}
      {gapsByBrand.size > 0 && (
        <p className="mb-2 text-sm text-muted">
          Próxima semana:{" "}
          {[...gapsByBrand].map(([id, gap], i) => (
            <span key={id}>{i > 0 && " · "}{brandName.get(id)} faltan {gap}</span>
          ))}{" "}
          · <Link href="/operacion" className="underline">Ver operación</Link>
        </p>
      )}

      <MonthCalendar weeks={weeks} today={today} cardsByDate={cardsByDate} />
      <p className="mt-2 text-xs text-muted">
        Abre un día para agregar contenido. Arrastra una tarjeta para cambiarla de día; también puedes hacerlo desde el día o la ficha con «Mover a».
      </p>
    </>
  );
}
