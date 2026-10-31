"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AxisRow, CatalogRow } from "@/infrastructure/data";
import { Submit } from "../CommandForm";

const START_OPTIONS = [
  { key: "own_idea", label: "Ya tengo una idea", generator: false },
  { key: "develop", label: "Ayúdame a desarrollar una idea", generator: true },
  { key: "generate", label: "Genera ideas desde cero", generator: true },
  // Sin integración real de investigación web: no se simula (V0.4).
  { key: "research", label: "Investiga un tema y propón ideas", generator: null },
  { key: "library", label: "Usar biblioteca", generator: true },
] as const;

const STEPS = ["¿Cómo quieres empezar?", "Tu idea", "¿Qué quieres crear?", "¿Cómo se producirá?", "Últimos detalles"];

/**
 * Pasos de creación. Todos los campos quedan montados (se envían juntos al guardar);
 * cada paso valida lo suyo antes de avanzar. Formatos y modos vienen del catálogo.
 */
export function CreateContentSteps({
  formats,
  modes,
  pillars,
  territories,
  generatorHref,
  manualHref,
}: {
  /** Si el cliente tiene generación editorial: ruta del generador (sin el parámetro de modo). */
  generatorHref?: string;
  /** Con generador: enlace para crear a mano sin generador. */
  manualHref?: string;
  formats: CatalogRow[];
  modes: CatalogRow[];
  pillars: AxisRow[];
  territories: AxisRow[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [origin, setOrigin] = useState("own_idea");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState("");
  const [mode, setMode] = useState("");

  const available = (o: (typeof START_OPTIONS)[number]) => o.generator === false || (o.generator === true && !!generatorHref);
  const canAdvance = [START_OPTIONS.some((o) => o.key === origin && available(o)), title.trim().length > 0, format !== "", mode !== "", true][step];
  const formatLabel = formats.find((f) => f.key === format)?.label;
  const modeLabel = modes.find((m) => m.key === mode)?.label;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-1 text-xs" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
            className={`rounded-full border px-2 py-0.5 ${i === step ? "border-ink bg-ink text-paper" : i < step ? "border-line text-ink" : "border-line text-muted"}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <fieldset hidden={step !== 0} className="space-y-2">
        <legend className="mb-2 text-lg font-semibold">¿Cómo quieres empezar?</legend>
        {START_OPTIONS.map((o) => (
          <label key={o.key} className={`flex items-center gap-2 rounded-md border border-line p-3 ${available(o) ? "cursor-pointer bg-paper" : "opacity-60"}`}>
            <input type="radio" name="origin" value={o.key} checked={origin === o.key} disabled={!available(o)} onChange={() => setOrigin(o.key)} />
            <span>{o.label}</span>
            {!available(o) && <span className="ml-auto text-xs text-muted">{o.generator === null ? "Próximamente: sin investigación web todavía" : "Próximamente"}</span>}
          </label>
        ))}
        {generatorHref && manualHref && (
          <p className="text-xs text-muted">Con generador editorial. <a href={manualHref} className="underline">Prefiero llenarlo yo, sin generador</a>.</p>
        )}
      </fieldset>

      <fieldset hidden={step !== 1} className="space-y-3">
        <legend className="mb-2 text-lg font-semibold">Tu idea</legend>
        <label className="block text-sm">
          <span className="font-medium">Título de trabajo</span>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="input mt-1" placeholder="Ej. Otra pregunta después de «¿cómo te fue?»" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">La idea en pocas líneas (opcional)</span>
          <textarea name="idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} maxLength={4000} className="input mt-1" />
        </label>
      </fieldset>

      <fieldset hidden={step !== 2} className="space-y-2">
        <legend className="mb-2 text-lg font-semibold">¿Qué quieres crear?</legend>
        {formats.filter((f) => f.active).map((f) => (
          <label key={f.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper p-3">
            <input type="radio" name="format_key" value={f.key} checked={format === f.key} onChange={() => setFormat(f.key)} />
            {f.label}
          </label>
        ))}
      </fieldset>

      <fieldset hidden={step !== 3} className="space-y-2">
        <legend className="mb-2 text-lg font-semibold">¿Cómo se producirá?</legend>
        {modes.filter((m) => m.active).map((m) => (
          <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper p-3">
            <input type="radio" name="production_mode_key" value={m.key} checked={mode === m.key} onChange={() => setMode(m.key)} />
            {m.label}
          </label>
        ))}
      </fieldset>

      <fieldset hidden={step !== 4} className="space-y-3">
        <legend className="mb-2 text-lg font-semibold">Últimos detalles</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Ubicación</span>
            <select name="bucket" defaultValue="feed" className="input mt-1"><option value="feed">Feed</option><option value="stories">Stories</option></select>
          </label>
          {pillars.length > 0 && (
            <label className="block text-sm">
              <span className="font-medium">Pilar (opcional)</span>
              <select name="pillar_id" defaultValue="" className="input mt-1">
                <option value="">—</option>
                {pillars.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ` : ""}{p.name}{p.provisional ? " (provisional)" : ""}</option>)}
              </select>
            </label>
          )}
          {territories.length > 0 && (
            <label className="block text-sm">
              <span className="font-medium">Territorio (opcional)</span>
              <select name="territory_id" defaultValue="" className="input mt-1">
                <option value="">—</option>
                {territories.map((t) => <option key={t.id} value={t.id}>{t.name}{t.provisional ? " (provisional)" : ""}</option>)}
              </select>
            </label>
          )}
        </div>
        <div className="rounded-md border border-line bg-soft p-3 text-sm">
          <p><strong>{title || "Sin título"}</strong></p>
          {idea && <p className="mt-1 whitespace-pre-wrap text-muted">{idea}</p>}
          <p className="mt-1">{formatLabel ?? "—"} · {modeLabel ?? "—"}</p>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="btn border border-line bg-paper">Atrás</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" disabled={!canAdvance} className="btn bg-ink text-paper"
            onClick={() => (step === 0 && generatorHref ? router.push(`${generatorHref}&modo=${origin}`) : setStep(step + 1))}>Siguiente</button>
        ) : (
          <Submit label="Guardar en el calendario" />
        )}
        {step === 1 && !canAdvance && <span className="text-xs text-muted">Escribe un título para continuar.</span>}
      </div>
    </div>
  );
}
