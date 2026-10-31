import Link from "next/link";
import { loadContext, newRequestId } from "@/application/context";
import { BootstrapPortfolio } from "@/components/BootstrapPortfolio";
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
import { computeNeeds, worstHealth } from "@/domain/planning";
import type { WeekCoverage } from "@/domain/coverage";

export default async function OperationPage() {
  const { snapshot, reports } = await loadContext();
  const { now, accounts, brands, pieces, publications } = snapshot;
  const pieceById = new Map(pieces.map((p) => [p.id, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const activeAccounts = accounts.filter((a) => a.active);

  if (brands.length === 0) {
    return (
      <>
        <PageHeader title="Operación" subtitle="Primer uso: todavía no hay marcas ni cuentas." />
        <BootstrapPortfolio requestId={newRequestId()} />
      </>
    );
  }

  const inReview = pieces.filter((p) => p.production_status === "in_review" && !p.archived_at && p.ownership === "local");
  const overdue = publications.filter((p) => p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= now);
  const lowBuffer = activeAccounts.filter((a) => {
    const h = reports.get(a.id)?.health;
    return h === "CRITICAL" || h === "LOW";
  });
  const nearGaps = activeAccounts.flatMap((a) =>
    computeNeeds(reports.get(a.id)!).filter((n) => n.safeGap > 0).slice(0, 2).map((n) => ({ ...n, account: a })),
  );
  const unconfigured = activeAccounts.filter((a) => reports.get(a.id)?.health === "SIN_CONFIGURAR");

  return (
    <>
      <PageHeader
        title="Operación"
        subtitle={
          <>
            Calculado {fmtInstant(now)}. Unidad: <strong>piezas editoriales semanales</strong> por cuenta y bucket. Una pieza
            publicada en IG y FB cuenta una vez; no mide cumplimiento por canal. La cadencia diaria de Stories no se evalúa en esta vista.
          </>
        }
      />

      <Section title="Atención">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <h3 className="text-sm font-semibold">Revisiones pendientes</h3>
            <p className="mt-1 text-2xl font-semibold">{inReview.length}</p>
            <Link href="/review" className="text-sm underline">Abrir Review Desk</Link>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold">Confirmar publicación</h3>
            <p className="mt-1 text-2xl font-semibold">{overdue.length}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {overdue.slice(0, 4).map((p) => (
                <li key={p.id}>
                  <Link href={`/piezas/${p.content_piece_id}#publicaciones`} className="underline">
                    {pieceById.get(p.content_piece_id)?.title}
                  </Link>{" "}
                  <span className="text-muted">· programada {fmtInstant(p.scheduled_at)}</span>
                </li>
              ))}
            </ul>
            {overdue.length > 0 && (
              <p className="mt-1 text-xs text-muted">El tiempo no confirma publicación: estas unidades salen de SAFE/PROJECTED hasta resolverlas.</p>
            )}
          </Card>
          <Card>
            <h3 className="text-sm font-semibold">Cuentas bajo buffer</h3>
            <p className="mt-1 text-2xl font-semibold">{lowBuffer.length}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {lowBuffer.map((a) => (
                <li key={a.id}>
                  <Link href={`/cuentas/${a.id}`} className="underline">{a.name}</Link>{" "}
                  <Badge tone={HEALTH_TONE[reports.get(a.id)!.health]}>{HEALTH_LABEL[reports.get(a.id)!.health]}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold">Gaps seguros próximos</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {nearGaps.length === 0 && <li className="text-muted">Sin gaps seguros en cuentas con objetivo.</li>}
              {nearGaps.slice(0, 6).map((n) => (
                <li key={`${n.accountId}-${n.bucket}-${n.weekStart}`}>
                  <Link href={`/cuentas/${n.accountId}#${n.bucket}`} className="underline">{n.account.name}</Link>{" "}
                  · {BUCKET_LABEL[n.bucket]} · semana {fmtWeek(n.weekStart)} · faltan {n.safeGap}
                </li>
              ))}
            </ul>
            {unconfigured.length > 0 && (
              <p className="mt-2 text-xs text-muted">{unconfigured.length} cuenta(s) sin objetivo configurado: no se pintan en verde.</p>
            )}
          </Card>
        </div>
      </Section>

      <Section
        title="Cobertura por cuenta"
        description="SAFE = cumplidas + aprobadas asignadas. PROJECTED = SAFE + en producción o revisión. Las reservas no suman hasta asignarse."
      >
        {activeAccounts.length === 0 ? (
          <Empty>No hay cuentas activas.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="data">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Salud</th>
                  <th>Bucket</th>
                  <th>Esta semana</th>
                  <th>Próxima</th>
                  <th>Runway seguro</th>
                  <th>Runway proyectado</th>
                  <th>Reserva</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) =>
                  activeAccounts
                    .filter((a) => a.brand_id === brand.id)
                    .map((a) => {
                      const report = reports.get(a.id)!;
                      const buckets = report.buckets;
                      const name = (
                        <>
                          <Link href={`/cuentas/${a.id}`} className="font-medium underline">{a.name}</Link>
                          <div className="text-xs text-muted">{brand.name}</div>
                        </>
                      );
                      if (buckets.length === 0) {
                        return (
                          <tr key={a.id}>
                            <td>{name}</td>
                            <td><Badge tone={HEALTH_TONE[report.health]}>{HEALTH_LABEL[report.health]}</Badge></td>
                            <td colSpan={6} className="text-muted">
                              {report.health === "SIN_CUOTA"
                                ? "Declarada sin cuota: fuera del ranking de gaps."
                                : <>Sin objetivo configurado. <Link href={`/portfolio#${a.id}`} className="underline">Configurar</Link></>}
                            </td>
                          </tr>
                        );
                      }
                      return buckets.map((b, i) => (
                        <tr key={`${a.id}-${b.bucket}`}>
                          {i === 0 && (
                            <>
                              <td rowSpan={buckets.length}>{name}</td>
                              <td rowSpan={buckets.length}>
                                <Badge tone={HEALTH_TONE[worstHealth(buckets.map((x) => x.health))]}>{HEALTH_LABEL[report.health]}</Badge>
                              </td>
                            </>
                          )}
                          <td>
                            {BUCKET_LABEL[b.bucket]}
                            {b.bucket === "stories" && <div className="text-xs text-muted">Meta local semanal; cadencia diaria no evaluada</div>}
                          </td>
                          <td><WeekCell week={b.weeks[0]} /></td>
                          <td><WeekCell week={b.weeks[1]} compact /></td>
                          <td className="max-w-56 text-xs">{describeRunway(b.safeRunway)}</td>
                          <td className="max-w-56 text-xs text-muted">{describeRunway(b.projectedRunway)}</td>
                          <td>{b.reserve.length}</td>
                        </tr>
                      ));
                    }),
                )}
              </tbody>
            </table>
          </div>
        )}
        {accounts.length > activeAccounts.length && (
          <p className="mt-2 text-xs text-muted">{accounts.length - activeAccounts.length} cuenta(s) inactiva(s) excluidas de la atención operativa.</p>
        )}
      </Section>
    </>
  );
}

function WeekCell({ week, compact = false }: { week: WeekCoverage; compact?: boolean }) {
  if (!week.target) return <Badge>{WEEK_LABEL.NO_TARGET}</Badge>;
  return (
    <div className="space-y-1">
      <Badge tone={WEEK_TONE[week.status]}>{WEEK_LABEL[week.status]}</Badge>
      {!compact && (
        <div className="text-xs">
          objetivo {week.required} · cumplido {week.fulfilled.length} · seguro pend. {week.safePending.length} · proyectado total{" "}
          {week.projected}
        </div>
      )}
      {compact && <div className="text-xs text-muted">seguro {week.safe}/{week.required} · proy. {week.projected}</div>}
    </div>
  );
}
