"use client";

import { useActionState, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { runCommand, type CommandResult } from "@/app/actions";

export function Submit({ label, tone = "primary" }: { label: string; tone?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-ink text-paper hover:opacity-90",
    secondary: "border border-line bg-paper text-ink hover:bg-soft",
    danger: "border border-bad/40 bg-paper text-bad hover:bg-bad/5",
  }[tone];
  return (
    <button type="submit" disabled={pending} className={`btn ${styles}`} aria-busy={pending}>
      {pending ? "Guardando…" : label}
    </button>
  );
}

/**
 * Formulario de un comando. `requestId` se genera en el servidor al renderizar:
 * reenviar el mismo formulario es idempotente. Los campos se conservan si hay error.
 */
export function CommandForm({
  command,
  requestId,
  hidden = {},
  submitLabel,
  tone = "primary",
  children,
  className = "",
  inline = false,
  showSubmit = true,
}: {
  command: string;
  requestId: string;
  hidden?: Record<string, string | number | null | undefined>;
  submitLabel: string;
  tone?: "primary" | "secondary" | "danger";
  children?: ReactNode;
  className?: string;
  inline?: boolean;
  /** false: el formulario renderiza su propio <Submit /> (p. ej. en el último paso). */
  showSubmit?: boolean;
}) {
  const [state, action] = useActionState<CommandResult | null, FormData>(runCommand, null);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className={`${inline ? "flex flex-wrap items-end gap-2" : "space-y-3"} ${className}`}>
      <input type="hidden" name="command" value={command} />
      <input type="hidden" name="request_id" value={requestId} />
      {Object.entries(hidden).map(([k, v]) =>
        v === null || v === undefined ? null : <input key={k} type="hidden" name={k} value={String(v)} />,
      )}
      {children}
      <div className="flex flex-wrap items-center gap-3">
        {showSubmit && <Submit label={submitLabel} tone={tone} />}
        {state && (
          <p role="status" aria-live="polite" className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
