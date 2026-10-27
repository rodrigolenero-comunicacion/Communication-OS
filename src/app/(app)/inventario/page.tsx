import Link from "next/link";
import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { NewPieceFields } from "@/components/NewPieceFields";
import { TimingFields } from "@/components/TimingFields";
import { BUCKET_LABEL, PUB_LABEL, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, fmtDate, fmtWeek } from "@/components/format";
import { Badge, Details, Empty, Field, PageHeader, Section } from "@/components/ui";
import { hasCurrentApproval } from "@/domain/pieces";
import { horizonWeeks } from "@/domain/planning";
import type { ProductionStatus } from "@/domain/types";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { snapshot } = await loadContext();
  const { accounts, brands, pieces, facts, now, publications } = snapshot;
  const factById = new Map(facts.map((f) => [f.id, f]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const weeks = horizonWeeks(now);

  const filter = {
    account: one(sp.account),
    status: one(sp.status),
    bucket: one(sp.bucket),
    week: one(sp.week),
    archived: one(sp.archived) === "1",
  };
  const rows = pieces.filter((p) => {
    const f = factById.get(p.id)!;
    if (!filter.archived && p.archived_at) return false;
    if (filter.account && p.account_id !== filter.account) return false;
    if (filter.bucket && p.bucket !== filter.bucket) return false;
    if (filter.week === "none" && f.assignedWeek) return false;
    if (filter.week && filter.week !== "none" && f.assignedWeek !== filter.week) return false;
    if (filter.status === "external" && p.ownership !== "external") return false;
    if (filter.status === "reserve" && !(hasCurrentApproval(f) && !f.assignedWeek && p.timing_mode === "flexible")) return false;
    if (filter.status && !["external", "reserve"].includes(filter.status) && p.production_status !== filter.status) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Inventario" subtitle="Piezas locales y espejos externos. La planeación semanal y la reserva se gestionan desde aquí y desde cada cuenta." />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-paper p-3" aria-label="Filtros">
        <Field label="Cuenta">
          <select name="account" defaultValue={filter.account} className="input w-auto">
            <option value="">Todas</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={filter.status} className="input w-auto">
            <option value="">Todos</option>
            {(Object.keys(STATUS_LABEL) as ProductionStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            <option value="reserve">En reserva</option>
            <option value="external">Espejos externos</option>
          </select>
        </Field>
        <Field label="Bucket">
          <select name="bucket" defaultValue={filter.bucket} className="input w-auto">
            <option value="">Todos</option><option value="feed">Feed</option><option value="stories">Stories</option>
          </select>
        </Field>
        <Field label="Semana">
          <select name="week" defaultValue={filter.week} className="input w-auto">
            <option value="">Todas</option>
            <option value="none">Sin asignar</option>
            {weeks.map((w) => <option key={w} value={w}>{fmtWeek(w)}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="archived" value="1" defaultChecked={filter.archived} /> Incluir archivadas</label>
        <button className="btn border border-line">Filtrar</button>
        <Link href="/inventario" className="pb-2 text-sm underline">Limpiar</Link>
      </form>

      <Section title={`Piezas (${rows.length})`}>
        {rows.length === 0 ? <Empty>No hay piezas con estos filtros.</Empty> : (
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="data">
              <thead><tr><th>Pieza</th><th>Cuenta</th><th>Estado</th><th>Semana</th><th>Timing</th><th>Destinos</th></tr></thead>
              <tbody>
                {rows.map((p) => {
                  const f = factById.get(p.id)!;
                  const pubs = publications.filter((x) => x.content_piece_id === p.id && x.status !== "cancelled");
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/piezas/${p.id}`} className="font-medium underline">{p.title}</Link>
                        <div className="text-xs text-muted">{BUCKET_LABEL[p.bucket]}{p.priority === "high" ? " · prioridad alta" : ""}</div>
                      </td>
                      <td>{accountById.get(p.account_id)?.name}</td>
                      <td className="space-x-1">
                        {p.ownership === "external" ? (
                          <Badge tone="info">Espejo · {f.latestObservation ? f.latestObservation.sourceStateRaw : "sin observación"}</Badge>
                        ) : (
                          <Badge tone={STATUS_TONE[p.production_status!]}>{STATUS_LABEL[p.production_status!]}</Badge>
                        )}
                        {p.on_hold && <Badge tone="warn">Hold</Badge>}
                        {p.archived_at && <Badge>Archivada</Badge>}
                        {hasCurrentApproval(f) && !f.assignedWeek && p.timing_mode === "flexible" && <Badge tone="good">Reserva</Badge>}
                      </td>
                      <td className="whitespace-nowrap">{f.assignedWeek ? fmtWeek(f.assignedWeek) : <span className="text-muted">Sin asignar</span>}</td>
                      <td className="text-xs">
                        {p.timing_mode === "fixed" ? `Fija ${fmtDate(p.fixed_date)}` : p.timing_mode === "window" ? `Ventana ${fmtDate(p.valid_from)} – ${fmtDate(p.valid_until)}` : "Flexible"}
                      </td>
                      <td className="text-xs">{pubs.length === 0 ? "—" : pubs.map((x) => PUB_LABEL[x.status]).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section id="nueva">
          <Details summary="Nueva pieza" open={one(sp.nuevo) === "1" || pieces.length === 0}>
            {accounts.filter((a) => a.active).length === 0 ? <Empty>Primero crea una cuenta activa en Portfolio.</Empty> : (
              <CommandForm command="quick_create_piece" requestId={newRequestId()} submitLabel="Crear pieza">
                <NewPieceFields
                  accounts={accounts.filter((a) => a.active).map((a) => ({
                    id: a.id, name: a.name, brandName: brands.find((b) => b.id === a.brand_id)?.name ?? "",
                  }))}
                  templates={snapshot.templates}
                  weeks={weeks.map((w) => ({ value: w, label: fmtWeek(w) }))}
                  defaults={{ accountId: filter.account || one(sp.account), bucket: filter.bucket, week: one(sp.week) }}
                />
              </CommandForm>
            )}
          </Details>
        </section>
        <section>
          <Details summary="Registrar espejo externo">
            <p className="mb-3 text-sm text-muted">
              Representación manual de un objeto que pertenece a otro sistema (ST Hub, Sistema Editorial IJLV, Solotu_Cerebro).
              No se aprueba aquí: su estado proviene de observaciones fechadas. No hay sincronización.
            </p>
            <CommandForm command="create_external_mirror" requestId={newRequestId()} submitLabel="Registrar espejo">
              <Field label="Título"><input name="title" required className="input" /></Field>
              <Field label="Cuenta"><select name="account_id" className="input">{accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
              <Field label="Bucket"><select name="bucket" className="input"><option value="feed">Feed</option><option value="stories">Stories</option></select></Field>
              <Field label="Sistema fuente">
                <select name="source_system" className="input">
                  {Object.entries(SOURCE_LABEL).filter(([k]) => k !== "manual").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Tipo de objeto en la fuente" hint="Por ejemplo: pieza editorial social. Debe ser el objeto editorial, no una cobertura o entrega."><input name="source_entity_type" required className="input" /></Field>
              <Field label="Identificador en la fuente"><input name="source_entity_id" required className="input" /></Field>
              <Field label="URL (http/https)"><input name="source_url" type="url" className="input" /></Field>
              <Field label="Localizador" hint="Obligatorio si no hay URL."><input name="locator" className="input" /></Field>
            </CommandForm>
          </Details>
        </section>
      </div>
    </>
  );
}
