import { signOut } from "@/app/actions";
import { requireSession } from "@/application/session";
import { Nav } from "@/components/Nav";
import { RefreshOnReturn } from "@/components/RefreshOnReturn";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.kind !== "authorized") {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-xl font-semibold">Acceso denegado</h1>
        <p className="mt-2 text-sm text-muted">
          Esta cuenta ({session.email ?? "sin correo"}) no está autorizada para Content OS. No se muestra ningún dato.
        </p>
        <form action={signOut} className="mt-4">
          <button className="btn border border-line">Cerrar sesión</button>
        </form>
      </main>
    );
  }
  return (
    <div className="min-h-screen">
      <RefreshOnReturn />
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold">Content OS</span>
            <Nav />
          </div>
          <form action={signOut}>
            <button className="text-sm text-muted underline">Cerrar sesión</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
