"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { proposeAction, type ProposalResult } from "@/app/generation-actions";
import type { Proposal } from "@/domain/generation/engine";
import type { AxisRow, CatalogRow } from "@/infrastructure/data";
import { ConceptForm } from "./ConceptForm";

type Mode = "classify" | "develop" | "ideas";

const COPY: Record<Mode, { label: string; placeholder: string; submit: string; again: string }> = {
  classify: { label: "Tu idea", placeholder: "Ej. Quiero hacer algo sobre cómo los niños toman decisiones.", submit: "Proponer concepto", again: "Otra propuesta" },
  develop: { label: "Tu idea incompleta", placeholder: "Ej. Algo con preguntas en casa.", submit: "Proponer direcciones", again: "Otras direcciones" },
  ideas: { label: "", placeholder: "", submit: "Generar 5 ideas", again: "Otras 5 ideas" },
};

function Run({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn bg-ink text-paper">
      {pending ? "Generando…" : label}
    </button>
  );
}

export function ProposalStudio({ mode, accountId, date, origin, pillars, territories, formats, modes }: {
  mode: Mode; accountId: string; date: string; origin: string;
  pillars: AxisRow[]; territories: AxisRow[]; formats: CatalogRow[]; modes: CatalogRow[];
}) {
  const [state, action] = useActionState<ProposalResult | null, FormData>(proposeAction, null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const copy = COPY[mode];
  const proposals = state?.ok ? state.proposals ?? [] : [];
  const axis = (id: string) => [...pillars, ...territories].find((a) => a.id === id);

  return (
    <div className="space-y-4">
      <form action={(fd) => { setChosen(null); action(fd); }} className="space-y-3">
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="account_id" value={accountId} />
        <input type="hidden" name="date" value={date} />
        {mode !== "ideas" && (
          <label className="block text-sm"><span className="font-medium">{copy.label}</span>
            <textarea name="user_input" value={input} onChange={(e) => setInput(e.target.value)} required rows={3} maxLength={1500}
              placeholder={copy.placeholder} className="input mt-1" /></label>
        )}
        {state?.ok && (
          <label className="block text-sm"><span className="font-medium">Indicación para la siguiente propuesta (opcional)</span>
            <input name="feedback" maxLength={500} placeholder="Ej. Hazlo menos comercial · Evita que dependa de niños hablando" className="input mt-1" /></label>
        )}
        <p className="text-xs text-muted">No escribas nombres de alumnos ni datos personales: solo se envía contexto editorial.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Run label={state?.ok ? copy.again : copy.submit} />
          {state && !state.ok && <p role="alert" className="text-sm text-bad">{state.message}</p>}
        </div>
      </form>

      {proposals.length > 0 && (
        <ul className={`grid gap-3 ${proposals.length > 1 ? "sm:grid-cols-2" : ""}`} aria-label="Propuestas">
          {proposals.map((p: Proposal, i) => (
            <li key={`${state?.at}-${i}`} className={`rounded-lg border p-3 ${chosen === i ? "border-ink" : "border-line"} bg-paper`}>
              {mode === "develop" && <p className="text-xs font-semibold text-muted">{String.fromCharCode(65 + i)}.</p>}
              <p className="font-semibold">{p.title}</p>
              <p className="mt-1 text-sm">{p.idea}</p>
              <p className="mt-2 text-xs text-muted">
                {axis(p.pillar_id)?.code ?? p.pillar} · {p.territory}{p.stage ? ` · ${p.stage}` : ""} · {formats.find((f) => f.key === p.suggested_format)?.label ?? p.suggested_format}
              </p>
              <p className="mt-2 text-sm"><span className="font-medium">Mensaje:</span> {p.central_message}</p>
              <p className="mt-1 text-xs text-muted">{p.editorial_reason}</p>
              {[...p.warnings.map((w) => w.message), ...(p.similar_to ? [`Nota del generador: ${p.similar_to}`] : [])].map((w) => (
                <p key={w} className="mt-1 text-xs text-warn">⚠ {w}</p>
              ))}
              <button type="button" onClick={() => setChosen(i)} className="btn mt-2 border border-line bg-paper text-sm">
                {chosen === i ? "Seleccionada" : "Elegir esta"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen !== null && proposals[chosen] && (() => {
        const p = proposals[chosen];
        const { warnings: _w, ...concept } = p;
        return (
          <section aria-label="Confirmar concepto" className="rounded-lg border border-ink bg-paper p-4">
            <h2 className="mb-3 text-lg font-semibold">Confirma o ajusta</h2>
            <ConceptForm key={`${state?.at}-${chosen}`} accountId={accountId} date={date} origin={origin}
              draft={{ title: p.title, idea: p.idea, central_message: p.central_message, stage: p.stage, pillar_id: p.pillar_id,
                territory_id: p.territory_id, format_key: p.suggested_format, production_mode_key: p.suggested_production_mode, concept }}
              pillars={pillars} territories={territories} formats={formats} modes={modes} />
          </section>
        );
      })()}
    </div>
  );
}
