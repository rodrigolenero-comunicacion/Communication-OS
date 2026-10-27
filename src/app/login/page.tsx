import { redirect } from "next/navigation";
import { getSession } from "@/application/session";
import { isSupabaseConfigured } from "@/infrastructure/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-xl font-semibold">Content OS</h1>
        <p className="mt-3 text-sm text-muted">
          Falta configurar Supabase (NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY). Consulta el README.
        </p>
      </main>
    );
  }
  const session = await getSession();
  if (session.kind === "authorized") redirect("/");
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Content OS</h1>
      <p className="mt-1 text-sm text-muted">Acceso privado. No hay registro público.</p>
      {session.kind === "denied" ? (
        <p role="alert" className="mt-6 rounded-md border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
          La cuenta {session.email ?? ""} inició sesión pero no está autorizada para Content OS.
        </p>
      ) : null}
      <LoginForm />
    </main>
  );
}
