import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { CreateContentSteps } from "@/components/calendar/CreateContentSteps";
import { Empty } from "@/components/ui";
import { isLocalDate } from "@/domain/time";

const dayTitle = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

export default async function NewContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ cuenta?: string }>;
}) {
  const { fecha } = await params;
  const { cuenta } = await searchParams;
  if (!isLocalDate(fecha)) notFound();
  const { snapshot } = await loadContext();
  const account = snapshot.accounts.find((a) => a.id === cuenta && a.active);
  if (!account) notFound();
  const brand = snapshot.brands.find((b) => b.id === account.brand_id)!;
  const axes = snapshot.axes.filter((x) => x.brand_id === brand.id && x.active);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/dia/${fecha}`} className="text-sm text-muted underline">← Volver al día</Link>
      <h1 className="mt-1 text-2xl font-semibold">Agregar contenido</h1>
      <p className={`client-${brand.color ?? "gray"} mt-1 text-sm`}>
        <span className="client-tag">{brand.short_label || brand.name}</span> · {account.name} · <span className="first-letter:uppercase">{dayTitle.format(new Date(`${fecha}T00:00:00Z`))}</span>
      </p>
      <div className="mt-5 rounded-lg border border-line bg-paper p-4">
        {snapshot.formats.length === 0 ? (
          <Empty>Falta aplicar la migración 0008 en Supabase para crear contenido desde el calendario.</Empty>
        ) : (
          <CommandForm command="create_calendar_piece" requestId={newRequestId()} submitLabel="Guardar" showSubmit={false}
            hidden={{ account_id: account.id, planned_date: fecha }}>
            <CreateContentSteps
              formats={snapshot.formats}
              modes={snapshot.modes}
              pillars={axes.filter((x) => x.kind === "pillar")}
              territories={axes.filter((x) => x.kind === "territory")}
            />
          </CommandForm>
        )}
      </div>
    </div>
  );
}
