import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { CATEGORY_LABEL } from "@/components/NewPieceFields";
import { FORMAT_LABEL } from "@/components/format";
import { Badge, Details, Field, PageHeader, Section } from "@/components/ui";
import type { Category, TemplateRow } from "@/infrastructure/data";

const GUIDE_FIELDS = [
  ["hook", "Hook"],
  ["on_screen", "Texto en pantalla"],
  ["final_line", "Cierre"],
  ["caption", "Caption"],
  ["cta", "CTA"],
] as const;

export default async function TemplatesPage() {
  const { snapshot } = await loadContext();
  const { templates, accounts } = snapshot;
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <>
      <PageHeader
        title="Plantillas"
        subtitle="Prellenan lo repetitivo al crear una pieza. Las preguntas guía orientan el texto creativo; no lo escriben. Las marcadas como borrador son genéricas: ajústalas a tu forma de trabajar."
      />
      {(Object.keys(CATEGORY_LABEL) as Category[]).map((cat) => {
        const list = templates.filter((t) => t.category === cat);
        return (
          <Section key={cat} title={`${CATEGORY_LABEL[cat]} (${list.length})`}>
            <div className="space-y-2">
              {list.map((t) => (
                <Details key={t.id} summary={`${t.name}${t.account_id ? ` · ${accountName.get(t.account_id)}` : " · general"}${t.is_draft ? " · borrador" : ""}${t.active ? "" : " · desactivada"}`}>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {t.is_draft && <Badge tone="warn">Borrador</Badge>}
                    {!t.active && <Badge>Desactivada</Badge>}
                    <CommandForm command="set_template_active" requestId={newRequestId()} inline tone="secondary"
                      hidden={{ template_id: t.id, expected_version: t.version, active: t.active ? "false" : "true" }}
                      submitLabel={t.active ? "Desactivar" : "Activar"} />
                  </div>
                  <TemplateForm template={t} accounts={accounts} />
                </Details>
              ))}
              <Details summary={`Nueva plantilla de ${CATEGORY_LABEL[cat]}`}>
                <TemplateForm category={cat} accounts={accounts} />
              </Details>
            </div>
          </Section>
        );
      })}
    </>
  );
}

function TemplateForm({ template, category, accounts }: {
  template?: TemplateRow;
  category?: Category;
  accounts: { id: string; name: string }[];
}) {
  const t = template;
  return (
    <CommandForm command="upsert_template" requestId={newRequestId()} submitLabel="Guardar plantilla"
      hidden={{ template_id: t?.id, expected_version: t?.version }}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nombre del tipo"><input name="name" defaultValue={t?.name ?? ""} required className="input" /></Field>
        <Field label="Categoría">
          <select name="category" defaultValue={t?.category ?? category} className="input">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Cuenta" hint="General = disponible para todas las cuentas.">
          <select name="account_id" defaultValue={t?.account_id ?? ""} className="input">
            <option value="">General</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo de contenido"><input name="content_type" defaultValue={t?.content_type ?? ""} className="input" /></Field>
        <Field label="Formato sugerido">
          <select name="suggested_format" defaultValue={t?.suggested_format ?? ""} className="input">
            <option value="">—</option>
            {Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Objetivo"><textarea name="objective" defaultValue={t?.objective ?? ""} rows={3} className="input" /></Field>
        <Field label="Audiencia"><textarea name="audience" defaultValue={t?.audience ?? ""} rows={3} className="input" /></Field>
      </div>
      <Field label="Experiencia base"><textarea name="experience" defaultValue={t?.experience ?? ""} rows={2} className="input" /></Field>
      <Field label="Spec base"><textarea name="spec_text" defaultValue={t?.spec_text ?? ""} rows={3} className="input" /></Field>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Preguntas guía (aparecen como ayuda en el Review Packet)</legend>
        {GUIDE_FIELDS.map(([k, label]) => (
          <Field key={k} label={label}><input name={`guide_${k}`} defaultValue={t?.words_guide?.[k] ?? ""} className="input" /></Field>
        ))}
      </fieldset>
    </CommandForm>
  );
}
