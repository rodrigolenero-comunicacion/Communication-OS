"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { packageAction, regenerateConceptAction, type PackageResult, type ProposalResult } from "@/app/generation-actions";

function Run({ label, tone = "primary" }: { label: string; tone?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      className={`btn ${tone === "primary" ? "bg-ink text-paper" : "border border-line bg-paper"}`}>
      {pending ? "Generando…" : label}
    </button>
  );
}

/** Generar o regenerar el paquete (Stage B) y regenerar el concepto, con una indicación breve opcional. */
export function PackageActions({ pieceId, hasPackage, editable, configured }: { pieceId: string; hasPackage: boolean; editable: boolean; configured: boolean }) {
  const [pkg, runPackage] = useActionState<PackageResult | null, FormData>(packageAction, null);
  const [concept, runConcept] = useActionState<ProposalResult | null, FormData>(regenerateConceptAction, null);
  if (!configured) return <p className="text-sm text-muted">Generación no configurada. Falta <code>ANTHROPIC_API_KEY</code> en el entorno del servidor.</p>;
  if (!editable) return <p className="text-sm text-muted">La pieza no está en un estado editable: no se puede regenerar.</p>;
  return (
    <div className="space-y-3">
      <form action={runPackage} className="space-y-2">
        <input type="hidden" name="piece_id" value={pieceId} />
        <label className="block text-sm"><span className="font-medium">Indicación (opcional)</span>
          <input name="feedback" maxLength={500} className="input mt-1" placeholder="Ej. Quiero una metáfora más visual · Evita que dependa de niños hablando" /></label>
        <div className="flex flex-wrap items-center gap-3">
          <Run label={hasPackage ? "Regenerar paquete" : "Generar paquete"} />
          {pkg && (
            <p role="status" aria-live="polite" className={`text-sm ${pkg.ok ? "text-good" : "text-bad"}`}>
              {pkg.message}
              {pkg.ok && pkg.missingSources ? ` ${pkg.missingSources} afirmación(es) con «Fuente necesaria».` : ""}
              {pkg.ok && pkg.academic ? " Se registraron dependencias de revisión." : ""}
            </p>
          )}
        </div>
        {hasPackage && <p className="text-xs text-muted">Regenerar reemplaza el paquete actual; la versión anterior queda en el historial de la pieza.</p>}
      </form>
      <details>
        <summary className="cursor-pointer text-sm underline">Regenerar concepto</summary>
        <form action={runConcept} className="mt-2 space-y-2">
          <input type="hidden" name="piece_id" value={pieceId} />
          <input name="feedback" maxLength={500} className="input" placeholder="Qué cambiar del concepto" aria-label="Indicación para el concepto" />
          <div className="flex flex-wrap items-center gap-3">
            <Run label="Regenerar concepto" tone="secondary" />
            {concept && <p role="status" className={`text-sm ${concept.ok ? "text-good" : "text-bad"}`}>{concept.message}</p>}
          </div>
          <p className="text-xs text-muted">Cambia título, idea, pilar y territorio de esta misma pieza y vacía el paquete (queda en el historial).</p>
        </form>
      </details>
    </div>
  );
}
