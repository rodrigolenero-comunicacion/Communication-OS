import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { EVIDENCE_LABEL, type ClaimAssessment } from "@/domain/generation/evidence";
import { visibleSections } from "@/domain/generation/package";
import type { PackageOut } from "@/domain/generation/schema";

type Stored = Partial<PackageOut> & {
  concept?: Record<string, unknown>; concept_summary?: string;
  evidence?: { creative?: ClaimAssessment[]; assessed?: ClaimAssessment[] };
};

const Block = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-md border border-line p-3"><h4 className="mb-1 text-sm font-semibold">{title}</h4><div className="space-y-1 text-sm">{children}</div></div>
);
const Lines = ({ items }: { items: string[] | undefined }) => (items?.length ? <ul className="list-disc pl-5">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : null);
const T = ({ v }: { v: unknown }) => (typeof v === "string" && v.trim() ? <p className="whitespace-pre-wrap">{v}</p> : null);

/** Paquete con revelado progresivo: concepto, mensaje, preview textual y caption; producción plegada. */
export function PackageView({ pkg, sourceTitle }: { pkg: Stored; sourceTitle: (id: string | null) => string | null }) {
  const concept: Record<string, unknown> = pkg.concept ?? {};
  const hasProduction = typeof pkg.caption === "string";
  const sections = visibleSections(pkg);
  const assessed = pkg.evidence?.assessed ?? [];
  const creative = pkg.evidence?.creative ?? [];

  return (
    <div className="space-y-3">
      <Block title="Concepto">
        <T v={pkg.concept_summary ?? concept.idea} />
        {typeof concept.central_message === "string" && <p><span className="font-medium">Mensaje:</span> {concept.central_message}</p>}
        {typeof concept.editorial_reason === "string" && <p className="text-xs text-muted">{concept.editorial_reason}</p>}
      </Block>
      {!hasProduction ? <p className="text-sm text-muted">Concepto aceptado. Falta generar el paquete de producción.</p> : (
        <>
          <Block title="Preview">
            {pkg.hook && <p><span className="font-medium">Gancho:</span> {pkg.hook}</p>}
            <T v={pkg.development} />
            {pkg.closing && <p><span className="font-medium">Cierre:</span> {pkg.closing}</p>}
            {(pkg.carousel_slides?.length ?? 0) > 0 && (
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {pkg.carousel_slides!.map((s, i) => (
                  <li key={i} className="rounded border border-line bg-soft p-2">
                    <p className="font-medium">{s.title}</p><p className="text-xs">{s.body}</p>
                    {s.source_credit && <p className="mt-1 text-xs text-muted">{s.source_credit}</p>}
                  </li>
                ))}
              </ol>
            )}
            {(pkg.storyboard?.length ?? 0) > 0 && (
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {pkg.storyboard!.map((s) => (
                  <li key={s.scene} className="rounded border border-line bg-soft p-2 text-xs">
                    <p className="font-medium">Escena {s.scene} · {s.timing}{s.bars ? ` · ${s.bars}` : ""}</p><p>{s.text}</p>
                  </li>
                ))}
              </ol>
            )}
            {(pkg.screen_text?.length ?? 0) > 0 && !pkg.carousel_slides?.length && <><p className="font-medium">Texto en pantalla</p><Lines items={pkg.screen_text} /></>}
          </Block>
          <Block title="Caption">
            <T v={pkg.caption} />
            {pkg.cta && <p><span className="font-medium">CTA:</span> {pkg.cta}</p>}
          </Block>

          {(assessed.length > 0 || creative.length > 0) && (
            <Block title="Evidencia">
              <ul className="space-y-2">
                {assessed.map((c, i) => (
                  <li key={i}>
                    <p>«{c.statement}»</p>
                    <p className="mt-0.5 flex flex-wrap gap-1 text-xs">
                      <Badge>{EVIDENCE_LABEL[c.evidence_class]}</Badge>
                      {c.source_missing && <Badge tone="bad">Fuente necesaria</Badge>}
                      {c.source_reference_id && <Badge tone="good">{sourceTitle(c.source_reference_id) ?? "Con fuente"}</Badge>}
                      {c.needs_academic_review && <Badge tone="warn">Revisión de Dirección Académica</Badge>}
                    </p>
                  </li>
                ))}
                {creative.map((c, i) => (
                  <li key={`c${i}`}><p>«{c.statement}»</p><p className="mt-0.5 text-xs"><Badge tone="info">Invitación creativa · sin afirmación científica</Badge></p></li>
                ))}
              </ul>
            </Block>
          )}

          {sections.length > 0 && (
            <details className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ver producción</summary>
              <div className="space-y-3 border-t border-line p-3">
                {pkg.capture_guide && (
                  <Block title="Guía de captura">
                    <p className="font-medium">Momentos a buscar</p><Lines items={pkg.capture_guide.moments} />
                    <p><span className="font-medium">Dirección:</span> {pkg.capture_guide.direction}</p>
                    {pkg.capture_guide.broll.length > 0 && <><p className="font-medium">B-roll</p><Lines items={pkg.capture_guide.broll} /></>}
                    <p><span className="font-medium">Privacidad:</span> {pkg.capture_guide.privacy}</p>
                    {pkg.capture_guide.materials.length > 0 && <><p className="font-medium">Material necesario</p><Lines items={pkg.capture_guide.materials} /></>}
                  </Block>
                )}
                {sections.includes("interaction") && (
                  <Block title="Interacción y voz">
                    {pkg.interaction_prompts!.length > 0 && <><p className="font-medium">Preguntas detonadoras</p><Lines items={pkg.interaction_prompts} /></>}
                    {pkg.voiceover && <p><span className="font-medium">Voz en off:</span> {pkg.voiceover}</p>}
                    {pkg.teacher_lines!.length > 0 && <><p className="font-medium">Líneas exactas de docente</p><Lines items={pkg.teacher_lines} /></>}
                  </Block>
                )}
                {pkg.edit_structure && pkg.edit_structure.length > 0 && <Block title="Edición por bloques"><Lines items={pkg.edit_structure} /></Block>}
                {pkg.creative_brief && <Block title="Creative brief"><T v={pkg.creative_brief} /></Block>}
                {pkg.storyboard && pkg.storyboard.length > 0 && (
                  <Block title="Storyboard">
                    {pkg.storyboard.map((s) => (
                      <div key={s.scene} className="rounded border border-line p-2 text-xs">
                        <p className="font-medium">Escena {s.scene} · {s.timing}{s.bars ? ` · ${s.bars}` : ""}</p>
                        <p>Texto: {s.text}</p><p>Layout: {s.layout}</p><p>Movimiento: {s.movement}</p>
                        {s.camera && <p>Cámara: {s.camera}</p>}{s.transition && <p>Transición: {s.transition}</p>}{s.sound && <p>Sonido: {s.sound}</p>}
                      </div>
                    ))}
                  </Block>
                )}
                {pkg.carousel_slides && pkg.carousel_slides.length > 0 && (
                  <Block title="Láminas">
                    {pkg.carousel_slides.map((s, i) => (
                      <div key={i} className="rounded border border-line p-2 text-xs">
                        <p className="font-medium">{s.title}</p><p>{s.body}</p><p className="text-muted">Visual: {s.visual_direction}</p>
                        {s.source_credit && <p className="text-muted">Crédito: {s.source_credit}</p>}
                      </div>
                    ))}
                  </Block>
                )}
                {pkg.graphics_spec && pkg.graphics_spec.length > 0 && (
                  <Block title="Graphics spec">
                    {pkg.graphics_spec.map((g, i) => (
                      <p key={i} className="text-xs"><span className="font-medium">{g.element}</span> · {g.function} · {g.moment} · {g.movement} · {g.relation_to_image} · Restricción: {g.constraint}</p>
                    ))}
                  </Block>
                )}
                {pkg.audio_spec && (
                  <Block title="Diseño sonoro (especificación; no se ha escuchado audio)">
                    <p>Intención: {pkg.audio_spec.intention}</p><p>Ritmo: {pkg.audio_spec.rhythm}</p>
                    <p className="font-medium">Momentos</p><Lines items={pkg.audio_spec.key_moments} />
                    <p className="font-medium">Timbres</p><Lines items={pkg.audio_spec.timbres} />
                    <p>Jingle: {pkg.audio_spec.jingle_relation}</p>
                    {pkg.audio_spec.sfx.length > 0 && <><p className="font-medium">SFX</p><Lines items={pkg.audio_spec.sfx} /></>}
                    <p>Nivel: {pkg.audio_spec.level}</p>
                  </Block>
                )}
                {pkg.fallback && <Block title="Plan B / versión estática"><T v={pkg.fallback} /></Block>}
                {pkg.output && <Block title="Entregables"><T v={pkg.output} /></Block>}
                {pkg.alt_text && <Block title="Texto alternativo"><T v={pkg.alt_text} /></Block>}
                {pkg.alternative && <Block title="Alternativa"><T v={pkg.alternative} /></Block>}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
