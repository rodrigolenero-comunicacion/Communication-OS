import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/infrastructure/env";
import { createSupabaseServerClient } from "@/infrastructure/supabase-server";

export type SessionState =
  | { kind: "anonymous" }
  | { kind: "denied"; email: string | null }
  | { kind: "authorized"; userId: string; email: string | null; supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> };

/** Sesión verificada contra Supabase Auth y allowlist en la base (no en la UI). */
export async function getSession(): Promise<SessionState> {
  // Sin configuración no hay sesión posible; /login explica qué falta en vez de un error 500.
  if (!isSupabaseConfigured()) return { kind: "anonymous" };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { kind: "anonymous" };
  const { data: who, error } = await supabase.rpc("whoami");
  if (error || !who?.authorized) return { kind: "denied", email: data.user.email ?? null };
  return { kind: "authorized", userId: data.user.id, email: data.user.email ?? null, supabase };
}

/** Para páginas: redirige a /login si no hay sesión. */
export async function requireSession() {
  const session = await getSession();
  if (session.kind === "anonymous") redirect("/login");
  return session;
}
