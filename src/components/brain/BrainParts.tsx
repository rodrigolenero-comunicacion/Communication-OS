import Link from "next/link";
import { newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { SOURCE_LABEL } from "@/components/format";
import { Badge, Field } from "@/components/ui";
import { CATEGORY_LABEL, SOURCE_STATUS_LABEL, SOURCE_TYPE_LABEL, type BrainCategory } from "@/domain/brain";
import type { AccountRow, BrainEntryRow, BrandRow, SourceReferenceRow } from "@/infrastructure/data";

/** Cabecera común del cliente: Brain | Fuentes | volver a Clientes. */
export function ClientTabs({ brand, current }: { brand: BrandRow; current: "brain" | "fuentes" }) {
  const tab = (key: "brain" | "fuentes", label: string) => (
    <Link href={`/portfolio/${brand.slug}/${key}`} aria-current={current === key ? "page" : undefined}
      className={`rounded-full border px-3 py-1 ${current === key ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label={`Secciones de ${brand.name}`} className="mb-5 flex flex-wrap items-center gap-1 text-sm">
      <Link href="/portfolio" className="mr-2 underline">← Clientes</Link>
      {tab("brain", "Brain")}
      {tab("fuentes", "Fuentes")}
    </nav>
  );
}

export function MigrationPending() {
  return (
    <p role="status" className="mb-5 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm">
      El Client Brain necesita la migración <code>20261031000010_client_brain.sql</code> (y después la carga{" "}
      <code>20261031000011_client_brain_seed.sql</code>). Hasta aplicarlas, esta vista no tiene datos; el resto de la app funciona igual.
    </p>
  );
}

const SOURCE_TONE = { active: "good", superseded: "neutral", provisional: "warn", archived: "neutral" } as const;

/** Atribución visible de una entrada o eje: título, versión y estado de la fuente. */
export function SourceAttribution({ source, locator }: { source: SourceReferenceRow | undefined; locator?: string | null }) {
  if (!source) return <span className="text-xs text-warn">Sin fuente registrada</span>;
  const status = source.status ?? "active";
  return (
    <span className="text-xs text-muted">
      Fuente: {source.title}{source.document_version ? ` ${source.document_version}` : ""}
      {status !== "active" && <> · <Badge tone={SOURCE_TONE[status]}>{SOURCE_STATUS_LABEL[status]}</Badge></>}
      {locator && ` · ${locator}`}
    </span>
  );
}

export function SourceStatusBadge({ status }: { status: SourceReferenceRow["status"] }) {
  const s = status ?? "active";
  return <Badge tone={SOURCE_TONE[s]}>{SOURCE_STATUS_LABEL[s]}</Badge>;
}

export function EntryForm({ brandId, entry, category, sources, accounts }: {
  brandId: string; entry?: BrainEntryRow; category?: BrainCategory;
  sources: SourceReferenceRow[]; accounts: AccountRow[];
}) {
  const fixed = entry?.category ?? category;
  // key y vigencia no se editan aquí; se reenvían para no borrarlos al guardar.
  return (
    <CommandForm command="upsert_brain_entry" requestId={newRequestId()} submitLabel="Guardar"
            hidden={{ entry_id: entry?.id, expected_version: entry?.version, brand_id: brandId, category: fixed,
        key: entry?.key, valid_from: entry?.valid_from, valid_until: entry?.valid_until }}>
      {!fixed && (
        <Field label="Categoría">
          <select name="category" className="input" required>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      )}
      <Field label="Título"><input name="title" defaultValue={entry?.title ?? ""} required maxLength={200} className="input" /></Field>
      <Field label="Contenido"><textarea name="content" defaultValue={entry?.content ?? ""} rows={4} maxLength={8000} className="input" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fuente" hint="Solo fuentes de este cliente.">
          <select name="source_reference_id" defaultValue={entry?.source_reference_id ?? ""} className="input">
            <option value="">— Sin fuente —</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}{s.document_version ? ` ${s.document_version}` : ""} · {SOURCE_STATUS_LABEL[s.status ?? "active"]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Localizador en la fuente" hint="Sección o página."><input name="source_locator" defaultValue={entry?.source_locator ?? ""} className="input" /></Field>
        <Field label="Cuenta (opcional)">
          <select name="account_id" defaultValue={entry?.account_id ?? ""} className="input">
            <option value="">Todo el cliente</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={entry?.status ?? "active"} className="input">
            <option value="active">Activa</option><option value="superseded">Superseded</option><option value="archived">Archivada</option>
          </select>
        </Field>
        {fixed === "claim" || (!fixed) ? (
          <Field label="Estado del claim" hint="Obligatorio si la categoría es Claim.">
            <select name="claim_status" defaultValue={entry?.claim_status ?? "provisional"} className="input">
              <option value="confirmed">Confirmado</option><option value="provisional">Provisional</option><option value="unsupported">Sin respaldo</option>
            </select>
          </Field>
        ) : null}
        <Field label="Orden"><input name="sort" type="number" defaultValue={entry?.sort ?? 0} className="input" /></Field>
      </div>
      {fixed !== "claim" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="provisional" defaultChecked={entry?.provisional ?? false} /> Provisional (pendiente de validar contra fuente)
        </label>
      )}
    </CommandForm>
  );
}

export function SourceForm({ brandId, source }: { brandId: string; source?: SourceReferenceRow }) {
  return (
    <CommandForm command="upsert_brand_source" requestId={newRequestId()} submitLabel="Guardar fuente"
      hidden={{ source_id: source?.id, expected_version: source?.version, brand_id: brandId }}>
      <Field label="Título"><input name="title" defaultValue={source?.title ?? ""} required maxLength={200} className="input" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institución"><input name="institution" defaultValue={source?.institution ?? ""} maxLength={200} className="input" /></Field>
        <Field label="Tipo">
          <select name="source_type" defaultValue={source?.source_type ?? "reference"} className="input">
            {Object.entries(SOURCE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Sistema de origen">
          <select name="source_system" defaultValue={source?.source_system ?? "manual"} className="input">
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={source?.status ?? "active"} className="input">
            {Object.entries(SOURCE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Nombre del documento"><input name="document_name" defaultValue={source?.document_name ?? ""} maxLength={200} className="input" /></Field>
        <Field label="Versión"><input name="document_version" defaultValue={source?.document_version ?? ""} maxLength={40} className="input" /></Field>
        <Field label="Fecha de consulta"><input name="accessed_at" type="date" defaultValue={source?.accessed_at ?? ""} className="input" /></Field>
        <Field label="Fecha de publicación"><input name="published_at" type="date" defaultValue={source?.published_at ?? ""} className="input" /></Field>
      </div>
      <Field label="URL (http/https)"><input name="url" type="url" defaultValue={source?.source_url ?? ""} className="input" /></Field>
      <Field label="Localizador" hint="Ruta, carpeta o identificador dentro del sistema."><input name="locator" defaultValue={source?.locator ?? ""} className="input" /></Field>
      <Field label="Notas"><textarea name="notes" defaultValue={source?.notes ?? ""} rows={3} maxLength={4000} className="input" /></Field>
    </CommandForm>
  );
}
