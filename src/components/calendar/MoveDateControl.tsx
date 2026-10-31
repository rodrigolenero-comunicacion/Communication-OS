"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestMove } from "./move";

/**
 * Alternativa accesible al arrastre: elegir día y mover. Respeta D1: si queda fuera
 * de la restricción ofrece «Mover y convertir en flexible»; bloqueado con publicaciones.
 */
export function MoveDateControl({
  pieceId,
  version,
  currentDate,
  movable,
  label = "Mover a",
}: {
  pieceId: string;
  version: number;
  currentDate: string | null;
  movable: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(currentDate ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [needsFlexible, setNeedsFlexible] = useState(false);
  const [pending, start] = useTransition();

  if (!movable) {
    return (
      <p className="text-xs text-muted">
        La fecha no se puede mover aquí: la pieza tiene una publicación programada o confirmada. Cancela o registra
        primero la publicación en su ficha.
      </p>
    );
  }

  const submit = (makeFlexible: boolean) =>
    start(async () => {
      const res = await requestMove(pieceId, version, date, makeFlexible);
      if (res.code === "CO412") {
        setNeedsFlexible(true);
        setMessage({ ok: false, text: res.message });
        return;
      }
      setNeedsFlexible(false);
      setMessage({ ok: res.ok, text: res.message });
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="block font-medium">{label}</span>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setNeedsFlexible(false); }} className="input mt-1 w-auto" />
        </label>
        <button type="button" disabled={pending || !date || date === currentDate} onClick={() => submit(false)} className="btn border border-line bg-paper">
          {pending ? "Moviendo…" : currentDate ? "Mover" : "Agendar"}
        </button>
      </div>
      {needsFlexible && (
        <button type="button" disabled={pending} onClick={() => submit(true)} className="btn border border-warn/50 bg-paper text-warn">
          Mover y convertir en flexible
        </button>
      )}
      {message && <p role="status" aria-live="polite" className={`text-xs ${message.ok ? "text-good" : "text-bad"}`}>{message.text}</p>}
    </div>
  );
}
