import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-paper p-4 ${className}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">{children}</p>;
}

export type Tone = "good" | "warn" | "bad" | "neutral" | "info";

/** Estado con texto siempre visible; el color solo refuerza. */
export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const styles: Record<Tone, string> = {
    good: "bg-good/10 text-good border-good/30",
    warn: "bg-warn/10 text-warn border-warn/40",
    bad: "bg-bad/10 text-bad border-bad/30",
    info: "bg-info/10 text-info border-info/30",
    neutral: "bg-soft text-muted border-line",
  };
  return (
    <span title={title} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Details({ summary, children, open = false }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg border border-line bg-paper">
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">{summary}</summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

/** Enlace externo: solo http(s), sin referrer, en pestaña nueva. Texto como texto. */
export function SafeLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href || !/^https?:\/\//i.test(href)) return <span className="text-muted">{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-dotted underline-offset-2">
      {children}
    </a>
  );
}
