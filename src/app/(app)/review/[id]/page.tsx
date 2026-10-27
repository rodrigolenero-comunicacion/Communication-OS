import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { PacketView } from "@/components/PacketView";
import { BUCKET_LABEL, STATUS_LABEL, STATUS_TONE, WEEK_LABEL, describeRunway, fmtInstant, fmtWeek } from "@/components/format";
import { Badge, Card, Details, Empty, Field, PageHeader, SafeLink, Section } from "@/components/ui";
import { simulateApprovalImpact } from "@/domain/planning";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { snapshot, supabase } = await loadContext();
  const piece = snapshot.pieces.find((p) => p.id === id);
  if (!piece) notFound();
  const fact = snapshot.facts.find((f) => f.id === id)!;
  const account = snapshot.accounts.find((a) => a.id === piece.account_id)!;

  if (piece.ownership === "external") {
    const mirror = snapshot.references.find((r) => r.content_piece_id === id && r.relation_kind === "external_mirror");
    return (
      <>
        <PageHeader title={piece.title} subtitle={`${account.name} · espejo externo`} />
        <Card className="max-w-xl">
          <p className="text-sm">Este objeto pertenece a su sistema fuente. Content OS no registra decisiones editoriales locales sobre él.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <SafeLink href={mirror?.source_url}>Abrir en sistema fuente</SafeLink>
            <Link href={`/piezas/${id}`} className="underline">Registrar observación</Link>
          </div>
        </Card>
      </>
    );
  }

  const [packetRes, claimsRes, depsRes, decisionsRes, blockersRes] = await Promise.all([
    supabase.from("review_packets").select("*").eq("content_piece_id", id).maybeSingle(),
    supabase.from("claims").select("*").eq("content_piece_id", id).order("created_at"),
    supabase.from("approval_dependencies").select("*").eq("content_piece_id", id).order("created_at"),
    supabase.from("review_decisions").select("id, action, content_revision, decided_at, comment").eq("content_piece_id", id).order("decided_at"),
    supabase.rpc("approval_blockers", { p_piece_id: id }),
  ]);
  const blockers = (blockersRes.data ?? []) as string[];
  const claims = claimsRes.data ?? [];
  const deps = depsRes.data ?? [];
  const v = piece.version;
  const inReview = piece.production_status === "in_review";
  const impact = inReview
    ? simulateApprovalImpact({ piece: fact, targets: snapshot.targets, pieces: snapshot.facts, now: snapshot.now })
    : null;
  const weekIndex = impact && fact.assignedWeek ? impact.before.weeks.findIndex((w) => w.weekStart === fact.assignedWeek) : -1;

  return (
    <>
      <PageHeader
        title={piece.title}
        subtitle={<>{account.name} · {BUCKET_LABEL[piece.bucket]} · revisión de contenido {piece.content_revision} · <Link href={`/piezas/${id}`} className="underline">Ver ficha completa</Link></>}
        actions={<div className="flex gap-1"><Badge tone={STATUS_TONE[piece.production_status!]}>{STATUS_LABEL[piece.production_status!]}</Badge>{piece.on_hold && <Badge tone="warn">Hold</Badge>}</div>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Concepto y objetivo">
            <p className="whitespace-pre-wrap text-sm"><strong>Objetivo:</strong> {piece.objective || "—"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm"><strong>Audiencia:</strong> {piece.audience || "—"}</p>
          </Section>
          <Section title="Review Packet">{packetRes.data ? <PacketView packet={packetRes.data} /> : <Empty>Sin packet.</Empty>}</Section>
          <Section title="Claims y evidencia">
            {claims.length === 0 ? <Empty>Sin claims (confirmado en el packet si aplica).</Empty> : (
              <ul className="space-y-1 text-sm">
                {claims.map((c) => (
                  <li key={c.id}>
                    <Badge tone={c.verification_status === "supported" ? "good" : "bad"}>{c.verification_status === "supported" ? "Soportado" : c.verification_status === "unsupported" ? "Sin soporte" : "Pendiente"}</Badge>{" "}
                    {c.statement}{c.source_locator && <span className="text-muted"> · {c.source_locator}</span>}
                    {c.verification_note && <span className="text-muted"> · {c.verification_note}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs"><Link href={`/piezas/${id}`} className="underline">Verificar claims en la ficha</Link></p>
          </Section>
          <Section title="Dependencias">
            {deps.length === 0 ? <Empty>Sin dependencias.</Empty> : (
              <ul className="space-y-1 text-sm">
                {deps.map((d) => (
                  <li key={d.id}>
                    <Badge tone={d.status === "pending" ? "warn" : "good"}>{d.status === "pending" ? "Pendiente" : d.status === "satisfied" ? "Satisfecha" : "No aplica"}</Badge> {d.label}
                    {d.evidence_note && <span className="text-muted"> · {d.evidence_note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Details summary="Production Spec completa">
            {piece.production_spec_url && <p className="text-sm"><SafeLink href={piece.production_spec_url}>Abrir spec enlazada</SafeLink></p>}
            <p className="mt-2 whitespace-pre-wrap text-sm">{piece.production_spec_text || "—"}</p>
          </Details>
        </div>

        <aside className="space-y-6">
          {inReview && (
            <Section title="Impacto de aprobar" description="Estimación con las mismas funciones de cobertura; no escribe nada.">
              {!impact || weekIndex < 0 ? (
                <p className="text-sm">La pieza no tiene semana asignada: aprobarla no cambia cobertura ni runway{piece.timing_mode === "flexible" ? "; entraría a reserva" : ""}.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>Semana {fmtWeek(fact.assignedWeek!)}: SAFE {impact.before.weeks[weekIndex].safe} → <strong>{impact.after.weeks[weekIndex].safe}</strong> de {impact.before.weeks[weekIndex].required} ({WEEK_LABEL[impact.before.weeks[weekIndex].status]} → {WEEK_LABEL[impact.after.weeks[weekIndex].status]})</p>
                  <p className="text-xs">Runway seguro antes: {describeRunway(impact.before.safeRunway)}</p>
                  <p className="text-xs">Runway seguro después: {describeRunway(impact.after.safeRunway)}</p>
                </div>
              )}
            </Section>
          )}
          <Section title="Decisión">
            {blockers.length > 0 && inReview && (
              <div className="mb-3 rounded-md border border-bad/30 bg-bad/5 p-3 text-sm">
                <p className="font-medium text-bad">Impedimentos para aprobar</p>
                <ul className="list-disc pl-5">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            )}
            {inReview && !piece.on_hold && (
              <div className="space-y-4">
                {blockers.length === 0 && (
                  <CommandForm command="approve_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Aprobar">
                    <Field label="Comentario (opcional)"><input name="comment" className="input" /></Field>
                  </CommandForm>
                )}
                <CommandForm command="request_changes" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Pedir cambios" tone="secondary">
                  <Field label="Instrucción breve"><textarea name="comment" required rows={2} className="input" /></Field>
                </CommandForm>
              </div>
            )}
            {(inReview || piece.production_status === "approved") && !piece.on_hold && (
              <div className="mt-4">
                <Details summary="Poner en hold">
                  <p className="mb-2 text-xs text-muted">Hold no aprueba ni rechaza: saca la pieza de cobertura pendiente y reserva hasta liberarla.</p>
                  <CommandForm command="hold_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Poner en hold" tone="danger">
                    <Field label="Motivo"><input name="reason" required className="input" /></Field>
                  </CommandForm>
                </Details>
              </div>
            )}
            {piece.on_hold && (
              <CommandForm command="release_hold" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Liberar hold">
                <Field label="Comentario (opcional)"><input name="comment" className="input" /></Field>
              </CommandForm>
            )}
            {!inReview && !piece.on_hold && <p className="text-sm text-muted">La pieza no está en revisión.</p>}
          </Section>
          <Section title="Historial de decisiones" description="Inmutable.">
            {(decisionsRes.data ?? []).length === 0 ? <p className="text-sm text-muted">Sin decisiones.</p> : (
              <ul className="space-y-1 text-xs">
                {(decisionsRes.data ?? []).map((d) => (
                  <li key={d.id}><strong>{d.action}</strong> · rev. {d.content_revision} · {fmtInstant(d.decided_at)}{d.comment && <> · {d.comment}</>}</li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
