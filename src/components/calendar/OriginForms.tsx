"use client";

import { useState, type ReactNode } from "react";
import { ORIGIN_LABEL, type ContentOrigin } from "@/domain/calendar";
import type { CatalogRow } from "@/infrastructure/data";
import { CommandForm } from "../CommandForm";

const ORIGIN_HINT: Record<ContentOrigin, string> = {
  organic: "Una idea propia que se desarrolla y produce.",
  event_coverage: "Una publicación que sale de un evento o cobertura (Communication Hub).",
  existing_material: "Un asset ya terminado que solo falta publicar.",
};

const SOURCE_OPTIONS = [
  { value: "st_hub", label: "Communication Hub" },
  { value: "onedrive", label: "OneDrive" },
  { value: "other", label: "Otro" },
];

/** «¿Qué quieres agregar?» y el flujo correspondiente. El orgánico reutiliza el flujo creativo de V0.2. */
export function OriginChooser({
  origins,
  organic,
  event,
  material,
}: {
  origins: ContentOrigin[];
  organic: ReactNode;
  event: ReactNode;
  material: ReactNode;
}) {
  const [origin, setOrigin] = useState<ContentOrigin | null>(null);
  if (origin) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOrigin(null)} className="text-sm text-muted underline">← Cambiar tipo de contenido</button>
        <h2 className="text-lg font-semibold">{ORIGIN_LABEL[origin]}</h2>
        {origin === "organic" ? organic : origin === "event_coverage" ? event : material}
      </div>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-lg font-semibold">¿Qué quieres agregar?</legend>
      {origins.map((o) => (
        <button key={o} type="button" onClick={() => setOrigin(o)}
          className="block w-full rounded-md border border-line bg-paper p-3 text-left hover:bg-soft">
          <span className="font-medium">{ORIGIN_LABEL[o]}</span>
          <span className="block text-sm text-muted">{ORIGIN_HINT[o]}</span>
        </button>
      ))}
    </fieldset>
  );
}

function FormatRadios({ formats, value, onChange }: { formats: CatalogRow[]; value: string; onChange: (k: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Qué se publicará</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {formats.filter((f) => f.active).map((f) => (
          <label key={f.key} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${value === f.key ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}>
            <input type="radio" name="format_key" value={f.key} checked={value === f.key} onChange={() => onChange(f.key)} className="sr-only" />
            {f.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SourceFields({ defaultSystem, label }: { defaultSystem: string; label: string }) {
  return (
    <details className="rounded-md border border-line p-3 text-sm">
      <summary className="cursor-pointer">{label}</summary>
      <p className="mt-2 text-xs text-muted">Referencia manual: no se sincroniza ni se verifica contra el sistema fuente.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium">Sistema</span>
          <select name="source_system" defaultValue={defaultSystem} className="input mt-1">
            <option value="">No indicar</option>
            {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium">ID (opcional)</span>
          <input name="source_entity_id" className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-medium">Enlace (opcional)</span>
          <input name="source_url" type="url" className="input mt-1" placeholder="https://" />
        </label>
      </div>
    </details>
  );
}

/** Cobertura / evento: nombre, formato, material y fecha. Título sugerido editable. */
export function EventCoverageForm({ requestId, accountId, date, formats }: { requestId: string; accountId: string; date: string; formats: CatalogRow[] }) {
  const [eventName, setEventName] = useState("");
  const [format, setFormat] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const formatLabel = formats.find((f) => f.key === format)?.label;
  const suggested = [formatLabel, eventName.trim()].filter(Boolean).join(" · ");
  return (
    <CommandForm command="create_calendar_piece" requestId={requestId} submitLabel="Guardar en el calendario"
      hidden={{ account_id: accountId, content_origin: "event_coverage", bucket: "feed" }}>
      <label className="block text-sm">
        <span className="font-medium">Evento</span>
        <input name="event_name" required value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={200} className="input mt-1" placeholder="Ej. Industry Hack @ Tec" />
      </label>
      <FormatRadios formats={formats} value={format} onChange={setFormat} />
      <fieldset>
        <legend className="text-sm font-medium">Material</legend>
        <div className="mt-1 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" name="material_status" value="pending" defaultChecked /> Pendiente</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="material_status" value="available" /> Ya existe</label>
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Fecha de publicación</span>
          <input type="date" name="planned_date" required defaultValue={date} className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Título (editable)</span>
          <input name="title" required value={titleTouched ? title : suggested} onChange={(e) => { setTitleTouched(true); setTitle(e.target.value); }} maxLength={200} className="input mt-1" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="needs_copy" /> Necesita copy</label>
      <SourceFields defaultSystem="st_hub" label="Referencia en Communication Hub (opcional)" />
    </CommandForm>
  );
}

/** Material ya existente: título, formato, origen del material, enlace y fecha. Material disponible. */
export function ExistingMaterialForm({ requestId, accountId, date, formats }: { requestId: string; accountId: string; date: string; formats: CatalogRow[] }) {
  const [format, setFormat] = useState("");
  return (
    <CommandForm command="create_calendar_piece" requestId={requestId} submitLabel="Guardar en el calendario"
      hidden={{ account_id: accountId, content_origin: "existing_material", material_status: "available", bucket: "feed" }}>
      <label className="block text-sm">
        <span className="font-medium">Título</span>
        <input name="title" required maxLength={200} className="input mt-1" placeholder="Ej. Reel Día MUN" />
      </label>
      <FormatRadios formats={formats} value={format} onChange={setFormat} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Origen del material</span>
          <select name="source_system" defaultValue="st_hub" className="input mt-1">
            <option value="">No indicar</option>
            {SOURCE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Enlace (opcional)</span>
          <input name="source_url" type="url" className="input mt-1" placeholder="https://" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Fecha de publicación</span>
          <input type="date" name="planned_date" required defaultValue={date} className="input mt-1" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="needs_copy" /> Necesita copy</label>
      <p className="text-xs text-muted">El enlace es una referencia manual: no se sincroniza ni se verifica.</p>
    </CommandForm>
  );
}
