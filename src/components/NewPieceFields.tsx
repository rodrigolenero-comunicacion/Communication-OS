"use client";

import { useState } from "react";
import type { Category, TemplateRow } from "@/infrastructure/data";
import { TimingFields } from "./TimingFields";
import { Field } from "./ui";

export const CATEGORY_LABEL: Record<Category, string> = {
  conectar: "Conectar",
  educativo: "Educativo / valor",
  cobertura: "Cobertura de evento",
  institucional: "Institucional / anuncio",
  promocional: "Promocional / venta",
};

interface AccountOption { id: string; name: string; brandName: string }

/** Campos de creación rápida: cuenta → categoría → plantilla (cascada), semana y etapa inicial. */
export function NewPieceFields({
  accounts,
  templates,
  weeks,
  defaults,
}: {
  accounts: AccountOption[];
  templates: TemplateRow[];
  weeks: { value: string; label: string }[];
  defaults: { accountId?: string; bucket?: string; week?: string };
}) {
  const [accountId, setAccountId] = useState(defaults.accountId || accounts[0]?.id || "");
  const [category, setCategory] = useState<Category | "">("");
  const [templateId, setTemplateId] = useState("");

  const available = templates.filter(
    (t) => t.active && t.category === category && (t.account_id === null || t.account_id === accountId),
  );
  const selected = available.find((t) => t.id === templateId) ?? null;
  const brands = [...new Set(accounts.map((a) => a.brandName))];

  return (
    <div className="space-y-3">
      <Field label="Título"><input name="title" required maxLength={200} className="input" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cuenta">
          <select name="account_id" value={accountId} onChange={(e) => { setAccountId(e.target.value); setTemplateId(""); }} className="input">
            {brands.map((b) => (
              <optgroup key={b} label={b}>
                {accounts.filter((a) => a.brandName === b).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Bucket">
          <select name="bucket" defaultValue={defaults.bucket || "feed"} className="input"><option value="feed">Feed</option><option value="stories">Stories</option></select>
        </Field>
        <Field label="Categoría">
          <select value={category} onChange={(e) => { setCategory(e.target.value as Category | ""); setTemplateId(""); }} className="input">
            <option value="">Sin plantilla</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Tipo (plantilla)">
          <select name="template_id" value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!category} className="input">
            <option value="">{category ? "Elegir tipo…" : "Primero elige categoría"}</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.account_id ? " (de esta cuenta)" : ""}{t.is_draft ? " · borrador" : ""}</option>
            ))}
          </select>
        </Field>
      </div>
      {selected && (
        <div className="rounded-md border border-line bg-soft p-3 text-xs">
          <p className="font-medium">Se prellenará:</p>
          <p><strong>Objetivo:</strong> {selected.objective ?? "—"}</p>
          <p><strong>Audiencia:</strong> {selected.audience ?? "—"}</p>
          <p><strong>Tipo:</strong> {selected.content_type ?? "—"} · experiencia y spec base incluidas.</p>
          {selected.is_draft && <p className="mt-1 text-warn">Plantilla en borrador: ajústala en Plantillas cuando puedas.</p>}
        </div>
      )}
      <TimingFields />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Semana (opcional)">
          <select name="week_start" defaultValue={defaults.week ?? ""} className="input">
            <option value="">Sin asignar todavía</option>
            {weeks.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </Field>
        <Field label="Etapa inicial">
          <select name="initial_stage" defaultValue="idea" className="input">
            <option value="idea">Idea</option>
            <option value="planned">Planificada</option>
            <option value="in_production">En producción</option>
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted">
        Se crea como pieza local. Si eliges «En producción» con semana asignada, ya cuenta en PROJECTED (no en SAFE hasta aprobarse).
      </p>
    </div>
  );
}
