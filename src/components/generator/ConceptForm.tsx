"use client";

import { useState } from "react";
import { CommandForm } from "@/components/CommandForm";
import type { AxisRow, CatalogRow } from "@/infrastructure/data";

export interface ConceptDraft {
  title: string; idea: string; central_message: string; stage: string | null;
  pillar_id: string | null; territory_id: string | null; format_key: string | null; production_mode_key: string | null;
  concept: Record<string, unknown>;
}

const STAGE_LABEL: Record<string, string> = { maternal: "Maternal", preescolar: "Preescolar", primaria: "Primaria", todas: "Todas las etapas" };

/** Confirmar o ajustar el concepto (Stage A) antes de crear la pieza. Nada se genera todavía. */
export function ConceptForm({ draft, requestId: fixedId, accountId, date, origin, libraryIdeaId, pillars, territories, formats, modes }: {
  /** Si el formulario se renderiza en el servidor, el id llega desde allí (evita diferencias al hidratar). */
  draft: ConceptDraft; requestId?: string; accountId: string; date: string; origin: string; libraryIdeaId?: string;
  pillars: AxisRow[]; territories: AxisRow[]; formats: CatalogRow[]; modes: CatalogRow[];
}) {
  // Un id por concepto mostrado: reenviar este formulario no duplica la pieza.
  const [requestId] = useState(() => fixedId ?? crypto.randomUUID());
  return (
    <CommandForm command="create_generated_piece" requestId={requestId} submitLabel="Usar esta idea"
      hidden={{ account_id: accountId, planned_date: date, origin, library_idea_id: libraryIdeaId, concept_json: JSON.stringify(draft.concept) }}>
      <label className="block text-sm"><span className="font-medium">Título</span>
        <input name="title" defaultValue={draft.title} required maxLength={200} className="input mt-1" /></label>
      <label className="block text-sm"><span className="font-medium">Idea</span>
        <textarea name="idea" defaultValue={draft.idea} rows={2} maxLength={2000} className="input mt-1" /></label>
      <label className="block text-sm"><span className="font-medium">Mensaje central</span>
        <textarea name="central_message" defaultValue={draft.central_message} rows={2} maxLength={2000} className="input mt-1" /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium">Pilar</span>
          <select name="pillar_id" defaultValue={draft.pillar_id ?? ""} className="input mt-1">
            <option value="">—</option>
            {pillars.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}</option>)}
          </select></label>
        <label className="block text-sm"><span className="font-medium">Territorio</span>
          <select name="territory_id" defaultValue={draft.territory_id ?? ""} className="input mt-1">
            <option value="">—</option>
            {territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
        <label className="block text-sm"><span className="font-medium">Formato</span>
          <select name="format_key" defaultValue={draft.format_key ?? ""} required className="input mt-1">
            <option value="" disabled>Elige</option>
            {formats.filter((f) => f.active).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select></label>
        <label className="block text-sm"><span className="font-medium">Modo de producción</span>
          <select name="production_mode_key" defaultValue={draft.production_mode_key ?? ""} required className="input mt-1">
            <option value="" disabled>Elige</option>
            {modes.filter((m) => m.active).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select></label>
        <label className="block text-sm"><span className="font-medium">Etapa</span>
          <select name="stage" defaultValue={draft.stage ?? ""} className="input mt-1">
            <option value="">No aplica</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
      </div>
      <p className="text-xs text-muted">Se guarda como borrador en este día. El paquete de producción se genera después, desde la ficha.</p>
    </CommandForm>
  );
}
