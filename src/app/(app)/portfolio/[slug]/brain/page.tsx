import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext } from "@/application/context";
import { ClientTabs, EntryForm, MigrationPending, SourceAttribution } from "@/components/brain/BrainParts";
import { Badge, Card, Details, Empty, PageHeader, Section } from "@/components/ui";
import { CATEGORY_LABEL, brainView, sourcesByStatus, type BrainCategory } from "@/domain/brain";
import type { BrainEntryRow } from "@/infrastructure/data";

type View = "activas" | "todas" | "provisionales";
const VIEWS: { key: View; label: string }[] = [
  { key: "activas", label: "Vigente" },
  { key: "provisionales", label: "Solo provisionales" },
  { key: "todas", label: "Todo (incluye superseded y archivado)" },
];
/** Categorías que se muestran plegadas: son listas largas de reglas. */
const COLLAPSED: BrainCategory[] = ["editorial_rule", "review_rule", "evidence_rule", "production_rule", "constraint"];

export default async function BrainPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ ver?: string }>;
}) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const view: View = VIEWS.some((v) => v.key === ver) ? (ver as View) : "activas";
  const { snapshot } = await loadContext();
  const brand = snapshot.brands.find((b) => b.slug === slug);
  if (!brand) notFound();

  const accounts = snapshot.accounts.filter((a) => a.brand_id === brand.id);
  const grouped = sourcesByStatus(snapshot.references, brand.id, accounts.map((a) => a.id));
  const clientSources = [...grouped.active, ...grouped.provisional, ...grouped.superseded, ...grouped.archived];
  const sourceById = new Map(clientSources.map((s) => [s.id, s]));
  const axes = snapshot.axes.filter((x) => x.brand_id === brand.id && (view === "todas" || x.active) && (view !== "provisionales" || x.provisional));
  const brain = snapshot.brain;
  const sections = brain ? brainView(brain, brand.id, { includeInactive: view === "todas", onlyProvisional: view === "provisionales" }) : [];
  const all = brain?.filter((e) => e.brand_id === brand.id) ?? [];
  const provisionalCount = all.filter((e) => e.status === "active" && e.provisional).length
    + snapshot.axes.filter((x) => x.brand_id === brand.id && x.active && x.provisional).length;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  const entry = (e: BrainEntryRow) => (
    <li key={e.id} className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm">{e.title}</strong>
        {e.provisional && <Badge tone="warn">Provisional</Badge>}
        {e.claim_status === "unsupported" && <Badge tone="bad">Sin respaldo</Badge>}
        {e.claim_status === "confirmed" && <Badge tone="good">Confirmado</Badge>}
        {e.status !== "active" && <Badge>{e.status === "superseded" ? "Superseded" : "Archivada"}</Badge>}
        {e.account_id && <Badge tone="info">{accountName(e.account_id) ?? "Cuenta"}</Badge>}
      </div>
      {e.content && <p className="mt-1 whitespace-pre-wrap text-sm">{e.content}</p>}
      <div className="mt-1"><SourceAttribution source={e.source_reference_id ? sourceById.get(e.source_reference_id) : undefined} locator={e.source_locator} /></div>
      <div className="mt-2">
        <Details summary="Editar">
          <EntryForm brandId={brand.id} entry={e} sources={clientSources} accounts={accounts} />
        </Details>
      </div>
    </li>
  );

  return (
    <>
      <PageHeader
        title={`${brand.name} · Brain`}
        subtitle="Conocimiento estructurado de este cliente: estrategia, audiencias, voz y reglas, cada dato con su fuente. Solo muestra información de este cliente."
      />
      <ClientTabs brand={brand} current="brain" />
      {brain === null ? <MigrationPending /> : (
        <>
          <p className="mb-3 text-sm text-muted">
            {all.filter((e) => e.status === "active").length} entradas vigentes · {grouped.active.length} fuentes activas ·{" "}
            {provisionalCount > 0 ? (
              <Link href={`/portfolio/${brand.slug}/brain?ver=provisionales`} className="text-warn underline">{provisionalCount} provisionales por validar</Link>
            ) : "nada provisional"}
          </p>
          <nav aria-label="Qué mostrar" className="mb-5 flex flex-wrap gap-1 text-sm">
            {VIEWS.map((v) => (
              <Link key={v.key} href={v.key === "activas" ? `/portfolio/${brand.slug}/brain` : `/portfolio/${brand.slug}/brain?ver=${v.key}`}
                aria-current={view === v.key ? "page" : undefined}
                className={`rounded-full border px-3 py-1 ${view === v.key ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
                {v.label}
              </Link>
            ))}
          </nav>

          {sections.filter((s) => s.key === "strategy").map((s) => (
            <Section key={s.key} title={s.title}>
              {s.entries.length === 0 ? <Empty>Sin entradas de estrategia.</Empty> : <ul className="space-y-2">{s.entries.map(entry)}</ul>}
            </Section>
          ))}

          <Section title="Pilares y territorios" description="Se editan en Clientes. Los provisionales están pendientes de validar contra su fuente.">
            {axes.length === 0 ? <Empty>Sin pilares ni territorios{view === "provisionales" ? " provisionales" : ""}.</Empty> : (
              <div className="grid gap-4 md:grid-cols-2">
                {(["pillar", "territory"] as const).map((kind) => (
                  <Card key={kind}>
                    <h3 className="text-sm font-semibold">{kind === "pillar" ? "Pilares" : "Territorios"}</h3>
                    <ul className="mt-2 space-y-2 text-sm">
                      {axes.filter((x) => x.kind === kind).map((x) => (
                        <li key={x.id}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{x.code ? `${x.code} · ` : ""}{x.name}</span>
                            {x.provisional && <Badge tone="warn">Provisional</Badge>}
                            {!x.active && <Badge>Inactivo</Badge>}
                          </div>
                          {x.source_reference_id ? <SourceAttribution source={sourceById.get(x.source_reference_id)} /> :
                            x.source_note ? <span className="text-xs text-muted">{x.source_note}</span> : <SourceAttribution source={undefined} />}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {sections.filter((s) => s.key !== "strategy").map((s) => {
            if (s.key === "rules") {
              const cats = [...new Set(s.entries.map((e) => e.category))];
              return (
                <Section key={s.key} title={`${s.title} (${s.entries.length})`} description="Plegadas por tipo; abre cada grupo para ver las reglas.">
                  {s.entries.length === 0 ? <Empty>Sin reglas.</Empty> : (
                    <div className="space-y-2">
                      {COLLAPSED.filter((c) => cats.includes(c)).map((c) => {
                        const list = s.entries.filter((e) => e.category === c);
                        return (
                          <Details key={c} summary={`${CATEGORY_LABEL[c]} (${list.length})${list.some((e) => e.provisional) ? " · incluye provisionales" : ""}`}>
                            <ul className="space-y-2">{list.map(entry)}</ul>
                          </Details>
                        );
                      })}
                    </div>
                  )}
                </Section>
              );
            }
            if ((s.key === "claims" || s.key === "learnings") && s.entries.length === 0) return null;
            return (
              <Section key={s.key} title={s.title}>
                {s.entries.length === 0 ? <Empty>Sin entradas.</Empty> : <ul className="space-y-2">{s.entries.map(entry)}</ul>}
              </Section>
            );
          })}

          <Section title="Fuentes" description="De dónde sale cada dato de este Brain.">
            <p className="text-sm">
              {grouped.active.length} activas · {grouped.provisional.length} provisionales · {grouped.superseded.length} superseded · {grouped.archived.length} archivadas.{" "}
              <Link href={`/portfolio/${brand.slug}/fuentes`} className="underline">Ver todas las fuentes</Link>
            </p>
          </Section>

          <div className="max-w-2xl">
            <Details summary="Agregar entrada al Brain">
              <EntryForm brandId={brand.id} sources={clientSources} accounts={accounts} />
            </Details>
          </div>
        </>
      )}
    </>
  );
}
