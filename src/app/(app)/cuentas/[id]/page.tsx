import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import {
  BUCKET_LABEL,
  HEALTH_LABEL,
  HEALTH_TONE,
  WEEK_LABEL,
  WEEK_TONE,
  describeRunway,
  fmtInstant,
  fmtWeek,
} from "@/components/format";
import { Badge, Card, Empty, PageHeader, Section } from "@/components/ui";
import { EXCLUSION_LABELS } from "@/domain/coverage";
import { achievable, computeNeeds } from "@/domain/planning";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { snapshot, reports } = await loadContext();
  const account = snapshot.accounts.find((a) => a.id === id);
  if (!account) notFound();
  const brand = snapshot.brands.find((b) => b.id === account.brand_id);
  const report = reports.get(account.id)!;
  const pieceById = new Map(snapshot.pieces.map((p) => [p.id, p]));
  const needs = computeNeeds(report);

  const pieceLinks = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="text-muted">—</span>
    ) : (
      <ul className="space-y-0.5">
        {ids.map((pid) => (
          <li key={pid}>
            <Link href={`/piezas/${pid}`} className="underline">{pieceById.get(pid)?.title ?? pid}</Link>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <PageHeader
        title={account.name}
        subtitle={
          <>
            {brand?.name} · Calculado {fmtInstant(snapshot.now)} ·{" "}
            <Link href={`/inventario?account=${account.id}`} className="underline">Ver inventario de la cuenta</Link>
          </>
        }
        actions={<Badge tone={HEALTH_TONE[report.health]}>{HEALTH_LABEL[report.health]}</Badge>}
      />
      {!account.active && <p className="mb-4 text-sm text-warn">Cuenta inactiva: se conserva historial; no admite nuevas asignaciones ni publicaciones.</p>}
      {report.buckets.length === 0 && (
        <Empty>
          {report.health === "SIN_CUOTA"
            ? "Cuenta declarada sin cuota: no se calculan gaps ni runway."
            : "Sin objetivo configurado: configura un objetivo semanal en Portfolio para evaluar cobertura."}{" "}
          <Link href={`/portfolio#${account.id}`} className="underline">Ir a Portfolio</Link>
        </Empty>
      )}

      {report.buckets.map((b) => (
        <Section
          key={b.bucket}
          id={b.bucket}
          title={`${BUCKET_LABEL[b.bucket]} · ${HEALTH_LABEL[b.health]}`}
          description={
            <>
              Runway seguro: {describeRunway(b.safeRunway)}. Runway proyectado: {describeRunway(b.projectedRunway)}.
              {b.bufferTargetDays !== null && <> Buffer objetivo: {b.bufferTargetDays} día(s).</>}
              {b.bucket === "stories" && <> Meta local semanal: la cadencia diaria de Stories de ST Hub no se evalúa aquí.</>}
              {b.health === "INDETERMINADO" && <> El límite conocido no alcanza para demostrar el buffer (horizonte o fin de política).</>}
            </>
          }
        >
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="data">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Estado</th>
                  <th>Objetivo</th>
                  <th>Cumplidas</th>
                  <th>Seguro pendiente</th>
                  <th>Solo proyectado</th>
                  <th>Gap seguro / proyectado</th>
                  <th>Alcanzable con reserva</th>
                  <th>Excluidas</th>
                </tr>
              </thead>
              <tbody>
                {b.weeks.map((w) => (
                  <tr key={w.weekStart}>
                    <td className="whitespace-nowrap">{fmtWeek(w.weekStart)}</td>
                    <td><Badge tone={WEEK_TONE[w.status]}>{WEEK_LABEL[w.status]}</Badge></td>
                    <td>{w.target ? w.required : "—"}</td>
                    <td>{w.fulfilled.length} {pieceLinks(w.fulfilled)}</td>
                    <td>{w.safePending.length} {pieceLinks(w.safePending)}</td>
                    <td>{w.projectedOnly.length} {pieceLinks(w.projectedOnly)}</td>
                    <td>{w.target ? `${w.safeGap} / ${w.projectedGap}` : "—"}</td>
                    <td className="text-muted">{w.target && w.safeGap > 0 ? `${achievable(w, b.reserve.length)} de ${w.required}` : "—"}</td>
                    <td className="text-xs">
                      {w.excluded.length === 0 ? "—" : (
                        <ul>
                          {w.excluded.map((e) => (
                            <li key={e.pieceId}>
                              <Link href={`/piezas/${e.pieceId}`} className="underline">{pieceById.get(e.pieceId)?.title}</Link>: {EXCLUSION_LABELS[e.reason]}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            «Alcanzable con reserva» es una posibilidad para esa semana aislada: la misma reserva no puede cubrir varias semanas y no cambia el estado hasta asignarla.
          </p>

          <h3 className="mt-5 font-semibold">Reserva ({b.reserve.length})</h3>
          <p className="text-sm text-muted">Piezas aprobadas, flexibles y sin asignar de esta cuenta y bucket.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {b.reserve.length === 0 && <Empty>Sin reserva.</Empty>}
            {b.reserve.map((pid) => {
              const piece = pieceById.get(pid)!;
              return (
                <Card key={pid}>
                  <Link href={`/piezas/${pid}`} className="font-medium underline">{piece.title}</Link>
                  <CommandForm command="assign_week" requestId={newRequestId()} hidden={{ piece_id: pid, expected_version: piece.version }}
                    submitLabel="Asignar" inline className="mt-2">
                    <select name="week_start" className="input w-auto" aria-label="Semana" defaultValue={b.weeks.find((w) => w.safeGap > 0)?.weekStart}>
                      {b.weeks.map((w) => (
                        <option key={w.weekStart} value={w.weekStart}>
                          {fmtWeek(w.weekStart)} {w.safeGap > 0 ? `· faltan ${w.safeGap}` : ""}
                        </option>
                      ))}
                    </select>
                  </CommandForm>
                </Card>
              );
            })}
          </div>
        </Section>
      ))}

      {needs.length > 0 && (
        <Section title="Necesidades calculadas" description="Proyección de gaps; no crea piezas. «Planificar» abre el formulario de pieza con la cuenta preseleccionada.">
          <ul className="space-y-1 text-sm">
            {needs.map((n) => (
              <li key={`${n.bucket}-${n.weekStart}`}>
                <strong>{BUCKET_LABEL[n.bucket]}</strong> · {fmtWeek(n.weekStart)} · {n.reason}{" "}
                <Link
                  href={`/inventario?nuevo=1&account=${account.id}&bucket=${n.bucket}&week=${n.weekStart}#nueva`}
                  className="underline"
                >
                  Planificar
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
