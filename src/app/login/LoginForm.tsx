"use client";

import { useActionState } from "react";
import { signIn, signOut, type CommandResult } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<CommandResult | null, FormData>(signIn, null);
  return (
    <>
      <form action={action} className="mt-6 space-y-3">
        <label className="block text-sm">
          <span className="font-medium">Correo</span>
          <input name="email" type="email" autoComplete="username" required className="input mt-1" />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Contraseña</span>
          <input name="password" type="password" autoComplete="current-password" required className="input mt-1" />
        </label>
        <button type="submit" disabled={pending} className="btn w-full justify-center bg-ink text-paper">
          {pending ? "Entrando…" : "Entrar"}
        </button>
        {state && !state.ok && <p role="alert" className="text-sm text-bad">{state.message}</p>}
      </form>
      <form action={signOut} className="mt-4">
        <button type="submit" className="text-xs text-muted underline">Cerrar una sesión existente</button>
      </form>
    </>
  );
}
