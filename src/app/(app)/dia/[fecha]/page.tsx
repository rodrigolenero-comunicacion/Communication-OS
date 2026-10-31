import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext } from "@/application/context";
import { CalendarCard } from "@/components/calendar/CalendarCard";
import { MoveDateControl } from "@/components/calendar/MoveDateControl";
import { buildCards } from "@/components/calendar/card-data";
import { monthOf } from "@/domain/calendar";
import { addDays, currentWeekStart, isLocalDate, localDateOf, weekStartOf } from "@/domain/time";

const dayTitle = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function DayStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ nueva?: string; cliente?: string }>;
}) {
  const { fecha } = await params;
  const { nueva, cliente } = await searchParams;
  if (!isLocalDate(fecha)) notFound();
  const { snapshot } = await loadContext();
  const cards = buildCards(snapshot).filter((c) => c.date === fecha);
  const canCreate = weekStartOf(fecha) >= currentWeekStart(snapshot.now) && snapshot.formats.length > 0;
  const brands = snapshot.brands.filter((b) => b.active);
  const today = localDateOf(snapshot.now);

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/?m=${monthOf(fecha)}`} className="text-sm text-muted underline">← Volver al mes</Link>
          <h1 className="mt-1 text-2xl font-semibold first-letter:uppercase">{dayTitle.format(new Date(`${fecha}T00:00:00Z`))}</h1>
          {fecha === today && <p className="text-sm text-muted">Hoy</p>}
        </div>
        <nav aria-label="Cambiar de día" className="flex gap-1">
          <Link href={`/dia/${addDays(fecha, -1)}`} className="btn border border-line bg-paper" aria-label="Día anterior">←</Link>
          <Link href={`/dia/${addDays(fecha, 1)}`} className="btn border border-line bg-paper" aria-label="Día siguiente">→</Link>
        </nav>
      </header>

      {nueva && cards.some((c) => c.pieceId === nueva) && (
        <p role="status" className="mb-4 rounded-md border border-good/30 bg-good/5 p-3 text-sm text-good">Contenido guardado en este día.</p>
      )}
      {!canCreate && (
        <p className="mb-4 text-sm text-muted">
          {snapshot.formats.length === 0 ? "Falta aplicar la migración 0008 para crear contenido desde el calendario." : "Este día pertenece a una semana pasada: puedes consultar, pero no planear contenido nuevo."}
        </p>
      )}

      <div className="space-y-3">
        {brands.map((brand) => {
          const accounts = snapshot.accounts.filter((a) => a.brand_id === brand.id && a.active);
          const brandCards = cards.filter((c) => c.brandId === brand.id);
          const open = brandCards.length > 0 || cliente === brand.id || brands.length === 1;
          return (
            <details key={brand.id} open={open} className={`client-${brand.color ?? "gray"} client-stripe rounded-lg border border-line bg-paper`}>
              <summary className="cursor-pointer select-none px-4 py-3">
                <span className="client-tag mr-2">{brand.short_label || brand.name}</span>
                <span className="font-semibold">{brand.name}</span>
                <span className="ml-2 text-sm text-muted">{brandCards.length} contenido(s)</span>
              </summary>
              <div className="space-y-4 border-t border-line p-4">
                {accounts.length === 0 && <p className="text-sm text-muted">Sin cuentas activas. Configúralas en Clientes.</p>}
                {accounts.map((account) => {
                  const accountCards = brandCards.filter((c) => c.accountId === account.id);
                  return (
                    <section key={account.id} aria-label={account.name}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-medium">{account.name}</h2>
                        {canCreate && (
                          <Link href={`/dia/${fecha}/nuevo?cuenta=${account.id}`} className="btn bg-ink text-paper">+ Agregar contenido</Link>
                        )}
                      </div>
                      {accountCards.length === 0 ? (
                        <p className="mt-1 text-sm text-muted">Nada planeado para este día.</p>
                      ) : (
                        <ul className="mt-2 grid gap-2 md:grid-cols-2">
                          {accountCards.map((c) => (
                            <li key={c.pieceId} className="space-y-2 rounded-md border border-line p-2">
                              <CalendarCard card={c} highlight={c.pieceId === nueva} />
                              <MoveDateControl pieceId={c.pieceId} version={c.version} currentDate={c.date} movable={c.movable} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
