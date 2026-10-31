import { notFound } from "next/navigation";
import { loadContext } from "@/application/context";
import { ClientTabs, MigrationPending, SourceForm, SourceStatusBadge } from "@/components/brain/BrainParts";
import { fmtDate } from "@/components/format";
import { Details, Empty, PageHeader, SafeLink, Section } from "@/components/ui";
import { SOURCE_TYPE_LABEL, sourcesByStatus, type SourceStatus } from "@/domain/brain";
import type { SourceReferenceRow } from "@/infrastructure/data";

const GROUPS: { key: SourceStatus; title: string; description: string; open: boolean }[] = [
  { key: "active", title: "Activas", description: "Fuentes vigentes: respaldan el Brain de este cliente.", open: true },
  { key: "provisional", title: "Provisionales", description: "Pendientes de validar. Lo que se apoya en ellas se marca provisional.", open: true },
  { key: "superseded", title: "Superseded", description: "Reemplazadas por una versión posterior. Se conservan como historial; no son la regla vigente.", open: false },
  { key: "archived", title: "Archivadas", description: "Ya no se usan.", open: false },
];

export default async function SourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { snapshot } = await loadContext();
  const brand = snapshot.brands.find((b) => b.slug === slug);
  if (!brand) notFound();
  const accounts = snapshot.accounts.filter((a) => a.brand_id === brand.id);
  const grouped = sourcesByStatus(snapshot.references, brand.id, accounts.map((a) => a.id));
  const migrated = snapshot.brain !== null;
  const uses = (id: string) =>
    (snapshot.brain ?? []).filter((e) => e.source_reference_id === id).length + snapshot.axes.filter((x) => x.source_reference_id === id).length;

  const row = (s: SourceReferenceRow) => (
    <tr key={s.id} className="border-t border-line align-top">
      <td className="py-2 pr-3">
        <SafeLink href={s.source_url}>{s.title}</SafeLink>
        {s.document_name && <div className="text-xs text-muted">{s.document_name}</div>}
        {s.notes && <div className="mt-1 whitespace-pre-wrap text-xs text-muted">{s.notes}</div>}
        {s.locator && <div className="text-xs text-muted">{s.locator}</div>}
      </td>
      <td className="py-2 pr-3">{s.institution ?? "—"}</td>
      <td className="py-2 pr-3">{s.source_type ? SOURCE_TYPE_LABEL[s.source_type] ?? s.source_type : "—"}</td>
      <td className="py-2 pr-3">{s.document_version ?? "—"}</td>
      <td className="py-2 pr-3"><SourceStatusBadge status={s.status} /></td>
      <td className="py-2 pr-3">{fmtDate(s.accessed_at)}</td>
      <td className="py-2 pr-3">{uses(s.id)}</td>
      <td className="py-2">
        {migrated && s.scope_kind === "brand" ? (
          <Details summary="Editar"><SourceForm brandId={brand.id} source={s} /></Details>
        ) : <span className="text-xs text-muted">{s.scope_kind === "account" ? "Ámbito cuenta: se edita en Clientes" : "—"}</span>}
      </td>
    </tr>
  );

  return (
    <>
      <PageHeader title={`${brand.name} · Fuentes`} subtitle="Documentos, sistemas y decisiones que respaldan el Brain de este cliente. Solo fuentes de este cliente." />
      <ClientTabs brand={brand} current="fuentes" />
      {!migrated && <MigrationPending />}
      {GROUPS.map((g) => {
        const list = grouped[g.key];
        const table = (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th className="pr-3">Título</th><th className="pr-3">Institución</th><th className="pr-3">Tipo</th><th className="pr-3">Versión</th>
                  <th className="pr-3">Estado</th><th className="pr-3">Consulta</th><th className="pr-3">Usos</th><th /></tr>
              </thead>
              <tbody>{list.map(row)}</tbody>
            </table>
          </div>
        );
        return (
          <Section key={g.key} id={g.key} title={`${g.title} (${list.length})`} description={g.description}>
            {list.length === 0 ? <Empty>Ninguna.</Empty> : g.open ? table : <Details summary={`Ver ${list.length}`}>{table}</Details>}
          </Section>
        );
      })}
      {migrated && (
        <div className="max-w-2xl">
          <Details summary="Registrar fuente de este cliente">
            <SourceForm brandId={brand.id} />
          </Details>
        </div>
      )}
    </>
  );
}
