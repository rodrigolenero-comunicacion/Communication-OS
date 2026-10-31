import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext, newRequestId } from "@/application/context";
import { canGenerate, generator } from "@/application/generation";
import { ConceptForm } from "@/components/generator/ConceptForm";
import { ProposalStudio } from "@/components/generator/ProposalStudio";
import { Empty } from "@/components/ui";
import { isLocalDate } from "@/domain/time";

const dayTitle = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

const MODES = {
  own_idea: { title: "Ya tengo una idea", engine: "classify", help: "Escribe tu idea; el generador propone concepto, pilar, territorio, etapa y formato. Tú confirmas o ajustas." },
  develop: { title: "Ayúdame a desarrollar una idea", engine: "develop", help: "Para ideas incompletas: hasta 3 direcciones distintas." },
  generate: { title: "Genera ideas desde cero", engine: "ideas", help: "5 ideas diferenciadas, revisando lo publicado recientemente, el uso de pilares y territorios y el banco de ideas." },
  library: { title: "Usar biblioteca", engine: null, help: "Ideas del banco del cliente. Elige una y ajusta antes de crear la pieza." },
} as const;
type ModeKey = keyof typeof MODES;

export default async function GeneratePage({ params, searchParams }: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ cuenta?: string; modo?: string; pilar?: string; territorio?: string; formato?: string; uso?: string; etapa?: string }>;
}) {
  const { fecha } = await params;
  const sp = await searchParams;
  if (!isLocalDate(fecha)) notFound();
  const { snapshot } = await loadContext();
  const account = snapshot.accounts.find((a) => a.id === sp.cuenta && a.active);
  if (!account) notFound();
  const brand = snapshot.brands.find((b) => b.id === account.brand_id)!;
  const mode: ModeKey = (sp.modo && sp.modo in MODES ? sp.modo : "own_idea") as ModeKey;
  const meta = MODES[mode];
  const axes = snapshot.axes.filter((x) => x.brand_id === brand.id && x.active);
  const pillars = axes.filter((x) => x.kind === "pillar");
  const territories = axes.filter((x) => x.kind === "territory");
  const back = `/dia/${fecha}/nuevo?cuenta=${account.id}`;
  const enabled = canGenerate(snapshot, brand);
  const configured = generator().configured;

  const header = (
    <>
      <Link href={back} className="text-sm text-muted underline">← Otras formas de empezar</Link>
      <h1 className="mt-1 text-2xl font-semibold">{meta.title}</h1>
      <p className={`client-${brand.color ?? "gray"} mt-1 text-sm`}>
        <span className="client-tag">{brand.short_label || brand.name}</span> · {account.name} · <span className="first-letter:uppercase">{dayTitle.format(new Date(`${fecha}T00:00:00Z`))}</span>
      </p>
      <p className="mt-2 text-sm text-muted">{meta.help}</p>
    </>
  );

  if (!enabled) {
    return (
      <div className="mx-auto max-w-2xl">{header}
        <div className="mt-5"><Empty>La generación editorial no está habilitada para este cliente. <Link href={`${back}&manual=1`} className="underline">Crear la pieza a mano</Link>.</Empty></div>
      </div>
    );
  }

  if (mode !== "library") {
    return (
      <div className="mx-auto max-w-3xl">{header}
        <div className="mt-5 rounded-lg border border-line bg-paper p-4">
          {configured ? (
            <ProposalStudio mode={meta.engine!} accountId={account.id} date={fecha} origin={mode}
              pillars={pillars} territories={territories} formats={snapshot.formats} modes={snapshot.modes} />
          ) : (
            <Empty>
              Generación no configurada. Falta la variable <code>ANTHROPIC_API_KEY</code> en el entorno del servidor (Netlify).
              Mientras tanto puedes <Link href={`${back}&manual=1`} className="underline">crear la pieza a mano</Link> o usar la <Link href={`/dia/${fecha}/generar?cuenta=${account.id}&modo=library`} className="underline">biblioteca</Link>.
            </Empty>
          )}
        </div>
      </div>
    );
  }

  // Biblioteca: filtros por pilar, territorio, etapa, formato y uso previo. No necesita al proveedor.
  const usedIds = new Set(snapshot.pieces.filter((p) => p.library_idea_id && !p.archived_at).map((p) => p.library_idea_id!));
  const all = (snapshot.library ?? []).filter((l) => l.brand_id === brand.id && l.active);
  const formatsInBank = [...new Set(all.map((l) => l.format_key).filter(Boolean))] as string[];
  const ideas = all.filter((l) =>
    (!sp.pilar || l.pillar_id === sp.pilar) && (!sp.territorio || l.territory_id === sp.territorio) &&
    (!sp.formato || l.format_key === sp.formato) && (!sp.etapa || l.stage === sp.etapa) &&
    (!sp.uso || (sp.uso === "usadas" ? usedIds.has(l.id) : !usedIds.has(l.id))));
  const axisLabel = (id: string | null) => { const a = axes.find((x) => x.id === id); return a ? (a.code ? `${a.code} · ${a.name}` : a.name) : "—"; };
  const select = (name: string, label: string, value: string | undefined, options: [string, string][]) => (
    <label className="block text-xs"><span className="font-medium">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input mt-1">
        <option value="">Todos</option>
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select></label>
  );

  return (
    <div className="mx-auto max-w-4xl">{header}
      <form method="get" className="mt-4 grid gap-2 rounded-lg border border-line bg-paper p-3 sm:grid-cols-6">
        <input type="hidden" name="cuenta" value={account.id} />
        <input type="hidden" name="modo" value="library" />
        {select("pilar", "Pilar", sp.pilar, pillars.map((p) => [p.id, `${p.code ? `${p.code} · ` : ""}${p.name}`]))}
        {select("territorio", "Territorio", sp.territorio, territories.map((t) => [t.id, t.name]))}
        {select("etapa", "Etapa", sp.etapa, [["maternal", "Maternal"], ["preescolar", "Preescolar"], ["primaria", "Primaria"], ["todas", "Todas"]])}
        {select("formato", "Formato", sp.formato, formatsInBank.map((k) => [k, snapshot.formats.find((f) => f.key === k)?.label ?? k]))}
        {select("uso", "Uso previo", sp.uso, [["sin_usar", "Sin usar"], ["usadas", "Ya usadas"]])}
        <div className="flex items-end"><button type="submit" className="btn w-full border border-line bg-paper">Filtrar</button></div>
      </form>
      <p className="mt-2 text-xs text-muted">
        {ideas.length} de {all.length} ideas. El banco no indica etapa por idea: ese filtro solo encuentra ideas a las que se les haya asignado una.
      </p>
      {ideas.length === 0 ? <div className="mt-4"><Empty>Ninguna idea con estos filtros.</Empty></div> : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {ideas.map((l) => (
            <li key={l.id} className="rounded-lg border border-line bg-paper p-3">
              <p className="text-xs text-muted">Idea {l.code} · {axisLabel(l.pillar_id)} · {axisLabel(l.territory_id)}{usedIds.has(l.id) ? " · ya usada" : ""}</p>
              <p className="mt-1 font-semibold">{l.title}</p>
              {l.summary && <p className="mt-1 text-sm">{l.summary}</p>}
              <p className="mt-1 text-xs text-muted">{l.suggested_format}{l.requirement_kind ? ` · ${l.requirement_kind}` : ""}{l.requirements ? `: ${l.requirements}` : ""}</p>
              {l.cta && <p className="mt-1 text-xs">CTA: {l.cta}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium underline">Usar esta idea</summary>
                <div className="mt-2">
                  <ConceptForm requestId={newRequestId()} accountId={account.id} date={fecha} origin="library" libraryIdeaId={l.id}
                    draft={{ title: l.title, idea: l.summary ?? "", central_message: "", stage: l.stage, pillar_id: l.pillar_id, territory_id: l.territory_id,
                      format_key: l.format_key, production_mode_key: l.suggested_production_mode,
                      concept: { title: l.title, idea: l.summary, library_code: l.code, cta: l.cta, requirements: l.requirements, suggested_format: l.suggested_format } }}
                    pillars={pillars} territories={territories} formats={snapshot.formats} modes={snapshot.modes} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
