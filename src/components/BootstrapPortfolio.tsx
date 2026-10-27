"use client";

import { useActionState } from "react";
import { bootstrapPortfolio, type CommandResult } from "@/app/actions";
import { Card } from "./ui";

export function BootstrapPortfolio({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<CommandResult | null, FormData>(bootstrapPortfolio, null);
  return (
    <Card className="max-w-2xl">
      <h2 className="font-semibold">Crear el portfolio sugerido</h2>
      <p className="mt-1 text-sm text-muted">
        Crea 3 marcas y 5 cuentas: Tec de Monterrey (Campus Puebla, PrepaTec Puebla, Directora / Rectora), Instituto Juan Luis
        Vives (IJLV) y Solotu.IA (Solotu.IA). Los nombres son editables. No activa canales ni objetivos: eso lo confirmas
        después en Portfolio. También puedes crear marcas manualmente desde Portfolio.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="request_id" value={requestId} />
        <button type="submit" disabled={pending} className="btn bg-ink text-paper">
          {pending ? "Creando…" : "Crear marcas y cuentas"}
        </button>
        {state && <p role="status" className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.message}</p>}
      </form>
    </Card>
  );
}
