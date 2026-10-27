"use client";

import { useState } from "react";
import type { TimingMode } from "@/domain/types";
import { Field } from "./ui";

/** Campos de timing: solo se muestran (y envían) las fechas del modo elegido. */
export function TimingFields({
  mode = "flexible",
  fixedDate,
  validFrom,
  validUntil,
}: {
  mode?: TimingMode;
  fixedDate?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
}) {
  const [current, setCurrent] = useState<TimingMode>(mode);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Timing</legend>
      <div className="flex flex-wrap gap-3 text-sm">
        {(["flexible", "fixed", "window"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5">
            <input type="radio" name="timing_mode" value={m} checked={current === m} onChange={() => setCurrent(m)} />
            {m === "flexible" ? "Flexible" : m === "fixed" ? "Fecha fija" : "Ventana"}
          </label>
        ))}
      </div>
      {current === "fixed" && (
        <Field label="Fecha (Ciudad de México)"><input type="date" name="fixed_date" required defaultValue={fixedDate ?? ""} className="input" /></Field>
      )}
      {current === "window" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Desde (inclusive)"><input type="date" name="valid_from" required defaultValue={validFrom ?? ""} className="input" /></Field>
          <Field label="Hasta (inclusive)"><input type="date" name="valid_until" required defaultValue={validUntil ?? ""} className="input" /></Field>
        </div>
      )}
      {current === "flexible" && <p className="text-xs text-muted">Sin fecha obligatoria; si se aprueba y no se asigna, entra a reserva.</p>}
    </fieldset>
  );
}
