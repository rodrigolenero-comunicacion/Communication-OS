"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Control Tower" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/inventario", label: "Inventario" },
  { href: "/review", label: "Review Desk" },
  { href: "/publicaciones", label: "Publication Queue" },
  { href: "/plantillas", label: "Plantillas" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav aria-label="Secciones" className="flex flex-wrap gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-ink text-paper" : "text-ink hover:bg-soft"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
