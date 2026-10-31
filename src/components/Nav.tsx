"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRIMARY = [
  { href: "/", label: "Calendario" },
  { href: "/banco", label: "Banco" },
  { href: "/operacion", label: "Operación" },
];

const MORE = [
  { href: "/review", label: "Review Desk" },
  { href: "/publicaciones", label: "Publication Queue" },
  { href: "/portfolio", label: "Clientes" },
  { href: "/plantillas", label: "Plantillas" },
  { href: "/inventario", label: "Inventario completo" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/dia/");
  return path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  const moreActive = MORE.some((l) => isActive(path, l.href));
  return (
    <nav aria-label="Secciones" className="flex flex-wrap items-center gap-1">
      {PRIMARY.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(path, l.href) ? "page" : undefined}
          className={`rounded-md px-2.5 py-1.5 text-sm ${isActive(path, l.href) ? "bg-ink text-paper" : "text-ink hover:bg-soft"}`}
        >
          {l.label}
        </Link>
      ))}
      <details key={path} className="relative">
        <summary className={`cursor-pointer list-none rounded-md px-2.5 py-1.5 text-sm ${moreActive ? "bg-ink text-paper" : "text-ink hover:bg-soft"}`}>
          Más ▾
        </summary>
        <ul className="absolute left-0 z-20 mt-1 w-52 rounded-md border border-line bg-paper p-1 shadow-sm">
          {MORE.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}
                className={`block rounded px-2.5 py-1.5 text-sm hover:bg-soft ${isActive(path, l.href) ? "font-semibold" : ""}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
