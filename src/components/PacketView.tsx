import { SafeLink } from "./ui";

export function PacketView({ packet }: { packet: { what_is_it: string | null; why_it_exists: string | null; experience: string | null; words: unknown; preview_kind: string | null; preview_url: string | null } }) {
  const words = (packet.words ?? {}) as Record<string, string>;
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <div><p className="text-xs text-muted">Qué es</p><p className="whitespace-pre-wrap">{packet.what_is_it || "—"}</p></div>
        <div><p className="text-xs text-muted">Por qué existe</p><p className="whitespace-pre-wrap">{packet.why_it_exists || "—"}</p></div>
      </div>
      <div>
        <p className="text-xs text-muted">Preview</p>
        {packet.preview_url ? (
          <p>{packet.preview_kind ?? "Preview"}: <SafeLink href={packet.preview_url}>Abrir preview</SafeLink></p>
        ) : (
          <p className="text-muted">Sin preview visual: revisión sobre texto estructurado.</p>
        )}
      </div>
      <div><p className="text-xs text-muted">Experiencia</p><p className="whitespace-pre-wrap">{packet.experience || "—"}</p></div>
      <dl className="grid gap-2 md:grid-cols-2">
        {[["hook", "Hook"], ["on_screen", "Texto en pantalla"], ["final_line", "Cierre"], ["caption", "Caption"], ["cta", "CTA"]].map(([k, label]) => (
          <div key={k}><dt className="text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap">{words[k] || "—"}</dd></div>
        ))}
      </dl>
    </div>
  );
}
