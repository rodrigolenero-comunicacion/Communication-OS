import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContext, newRequestId } from "@/application/context";
import { CommandForm } from "@/components/CommandForm";
import { PacketView } from "@/components/PacketView";
import { PublicationPanel } from "@/components/PublicationPanel";
import { TimingFields } from "@/components/TimingFields";
import {
  BUCKET_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  fmtDate,
  fmtInstant,
  fmtWeek,
  localDateInput,
  localTimeInput,
} from "@/components/format";
import { Badge, Card, Details, Empty, Field, PageHeader, SafeLink, Section } from "@/components/ui";
import { hasCurrentApproval, weekFitsTiming } from "@/domain/pieces";
import { horizonWeeks } from "@/domain/planning";
import type { ProductionStatus } from "@/domain/types";

const EDITABLE: ProductionStatus[] = ["idea", "planned", "in_production", "changes_requested"];

export default async function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { snapshot, supabase } = await loadContext();
  const piece = snapshot.pieces.find((p) => p.id === id);
  if (!piece) notFound();
  const fact = snapshot.facts.find((f) => f.id === id)!;
  const account = snapshot.accounts.find((a) => a.id === piece.account_id)!;
  const brand = snapshot.brands.find((b) => b.id === account.brand_id)!;
  const pubs = snapshot.publications.filter((p) => p.content_piece_id === id);
  const mirror = snapshot.references.find((r) => r.content_piece_id === id && r.relation_kind === "external_mirror");
  const observations = mirror
    ? snapshot.observations.filter((o) => o.source_reference_id === mirror.id).sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    : [];
  const scopedSources = snapshot.references.filter(
    (r) => r.relation_kind === "context_reference" &&
      ((r.scope_kind === "account" && r.account_id === account.id) || (r.scope_kind === "brand" && r.brand_id === brand.id) || r.scope_kind === "public_general"),
  );

  const [packetRes, claimsRes, depsRes, decisionsRes, eventsRes, blockersRes] = await Promise.all([
    supabase.from("review_packets").select("*").eq("content_piece_id", id).maybeSingle(),
    supabase.from("claims").select("*").eq("content_piece_id", id).order("created_at"),
    supabase.from("approval_dependencies").select("*").eq("content_piece_id", id).order("created_at"),
    supabase.from("review_decisions").select("id, action, content_revision, decided_at, comment").eq("content_piece_id", id).order("decided_at"),
    supabase.from("operation_events").select("id, event_type, occurred_at, reason").eq("content_piece_id", id).order("occurred_at"),
    piece.ownership === "local" ? supabase.rpc("approval_blockers", { p_piece_id: id }) : Promise.resolve({ data: [] as string[] }),
  ]);
  const packet = packetRes.data;
  const claims = claimsRes.data ?? [];
  const deps = depsRes.data ?? [];
  const blockers = (blockersRes.data ?? []) as string[];

  const isLocal = piece.ownership === "local";
  const published = pubs.some((p) => p.status === "published");
  const editable = isLocal && !piece.archived_at && EDITABLE.includes(piece.production_status!) && !published;
  const editBlockReason = !isLocal
    ? "El contenido de un espejo se edita en su sistema fuente."
    : piece.archived_at ? "Pieza archivada."
    : published ? "Ya tiene una publicación confirmada: crea una pieza nueva para una variante editorial."
    : piece.production_status === "approved" ? "Aprobada: reábrela para editar su contenido (invalida la aprobación)."
    : piece.production_status === "in_review" ? "En revisión: pide cambios desde Review Desk para editar." : null;
  const v = piece.version;
  const assignableWeeks = horizonWeeks(snapshot.now).filter((w) => weekFitsTiming(fact.timing, w) && w !== fact.assignedWeek);
  const scheduled = pubs.filter((p) => p.status === "scheduled");

  return (
    <>
      <PageHeader
        title={piece.title}
        subtitle={
          <>
            <Link href={`/cuentas/${account.id}`} className="underline">{account.name}</Link> · {brand.name} · {BUCKET_LABEL[piece.bucket]} ·
            {isLocal ? " Pieza local (Content OS)" : ` Espejo de ${SOURCE_LABEL[mirror?.source_system ?? "manual"]}`}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-1">
            {isLocal ? <Badge tone={STATUS_TONE[piece.production_status!]}>{STATUS_LABEL[piece.production_status!]}</Badge> : <Badge tone="info">Espejo externo</Badge>}
            {piece.on_hold && <Badge tone="warn">Hold</Badge>}
            {piece.archived_at && <Badge>Archivada</Badge>}
            {hasCurrentApproval(fact) && <Badge tone="good">Aprobación vigente</Badge>}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isLocal && (
            <Section title="Estado de producción" description={`Revisión de contenido ${piece.content_revision}${piece.approved_revision ? ` · aprobada la revisión ${piece.approved_revision} el ${fmtInstant(piece.approved_at)}` : ""}.`}>
              <div className="flex flex-wrap gap-2">
                {piece.production_status === "idea" && !piece.archived_at && (
                  <CommandForm command="plan_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Planificar" />
                )}
                {(piece.production_status === "planned" || piece.production_status === "changes_requested") && !piece.archived_at && (
                  <CommandForm command="start_production" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Empezar producción" tone="secondary" />
                )}
                {(piece.production_status === "in_production" || piece.production_status === "changes_requested") && !piece.archived_at && (
                  <CommandForm command="submit_review" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Enviar a revisión" />
                )}
                {(piece.production_status === "in_review" || piece.on_hold) && (
                  <Link href={`/review/${id}`} className="btn border border-line">Abrir en Review Desk</Link>
                )}
              </div>
              {(piece.production_status === "in_production" || piece.production_status === "changes_requested" || piece.production_status === "in_review") && blockers.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium">Pendiente para enviar o aprobar:</p>
                  <ul className="list-disc pl-5 text-muted">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
              )}
              {piece.production_status === "approved" && !piece.on_hold && (
                <div className="mt-3 max-w-md">
                  <Details summary="Reabrir para edición">
                    <p className="mb-2 text-sm text-muted">Invalida la aprobación vigente. Solo si no hay destinos programados ni publicados.</p>
                    <CommandForm command="reopen_approved" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Reabrir" tone="danger">
                      <Field label="Motivo"><input name="reason" required className="input" /></Field>
                    </CommandForm>
                  </Details>
                </div>
              )}
            </Section>
          )}

          <Section title="Planeación semanal">
            <p className="text-sm">
              {fact.assignedWeek ? (
                <>
                  Asignada a la semana del <strong>{fmtWeek(fact.assignedWeek)}</strong>;{" "}
                  {published ? "con publicación confirmada." : scheduled.length > 0 ? `${scheduled.length} destino(s) programado(s).` : "aún sin programar."}
                </>
              ) : (
                <>Sin semana asignada: no cubre ninguna semana{hasCurrentApproval(fact) && piece.timing_mode === "flexible" ? " (está en reserva)" : ""}.</>
              )}
            </p>
            {!piece.archived_at && !published && (
              <div className="mt-2 flex flex-wrap gap-3">
                {assignableWeeks.length > 0 && scheduled.length === 0 && (
                  <CommandForm command="assign_week" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel={fact.assignedWeek ? "Reasignar" : "Asignar"} inline tone="secondary">
                    <select name="week_start" className="input w-auto" aria-label="Semana">
                      {assignableWeeks.map((w) => <option key={w} value={w}>{fmtWeek(w)}</option>)}
                    </select>
                  </CommandForm>
                )}
                {fact.assignedWeek && scheduled.length === 0 && (
                  <CommandForm command="unassign_week" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Quitar asignación" inline tone="secondary" />
                )}
              </div>
            )}
            {scheduled.length > 0 && <p className="mt-2 text-xs text-muted">Para cambiar de semana, cancela o confirma primero los destinos programados.</p>}
          </Section>

          <Section title="Datos editoriales" description={editBlockReason ?? "Los cambios de contenido incrementan la revisión."}>
            {editable && (
            <CommandForm command="update_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Guardar datos">
              <Field label="Título"><input name="title" defaultValue={piece.title} required className="input" /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Objetivo"><textarea name="objective" defaultValue={piece.objective ?? ""} rows={2} className="input" /></Field>
                <Field label="Audiencia"><textarea name="audience" defaultValue={piece.audience ?? ""} rows={2} className="input" /></Field>
                <Field label="Tipo de contenido"><input name="content_type" defaultValue={piece.content_type ?? ""} className="input" /></Field>
                <Field label="Rol editorial"><input name="editorial_role" defaultValue={piece.editorial_role ?? ""} className="input" /></Field>
                <Field label="Campaña / tema"><input name="campaign" defaultValue={piece.campaign ?? ""} className="input" /></Field>
                <Field label="Production Spec (enlace)"><input name="production_spec_url" type="url" defaultValue={piece.production_spec_url ?? ""} className="input" /></Field>
              </div>
              <Field label="Production Spec (texto)"><textarea name="production_spec_text" defaultValue={piece.production_spec_text ?? ""} rows={4} className="input" /></Field>
              <TimingFields mode={piece.timing_mode} fixedDate={piece.fixed_date} validFrom={piece.valid_from} validUntil={piece.valid_until} />
            </CommandForm>
            )}
            {!editable && (
              <dl className="grid gap-2 text-sm md:grid-cols-2">
                {[["Objetivo", piece.objective], ["Audiencia", piece.audience], ["Tipo", piece.content_type], ["Rol editorial", piece.editorial_role], ["Campaña", piece.campaign]].map(([k, val]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="whitespace-pre-wrap">{val || "—"}</dd></div>
                ))}
                <div><dt className="text-xs text-muted">Production Spec</dt><dd><SafeLink href={piece.production_spec_url}>{piece.production_spec_url ? "Abrir spec" : "—"}</SafeLink></dd></div>
                <div><dt className="text-xs text-muted">Timing</dt><dd>{piece.timing_mode === "fixed" ? `Fija ${fmtDate(piece.fixed_date)}` : piece.timing_mode === "window" ? `${fmtDate(piece.valid_from)} – ${fmtDate(piece.valid_until)}` : "Flexible"}</dd></div>
              </dl>
            )}
            {!isLocal && !piece.archived_at && (
              <div className="mt-3 max-w-md">
                <Details summary="Timing de coordinación">
                  <CommandForm command="update_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Guardar timing">
                    <TimingFields mode={piece.timing_mode} fixedDate={piece.fixed_date} validFrom={piece.valid_from} validUntil={piece.valid_until} />
                  </CommandForm>
                </Details>
              </div>
            )}
          </Section>

          {isLocal && (
            <Section title="Review Packet" description="Representación humana para revisar. Si no hay preview visual, el texto estructurado completo es válido y se indica como tal.">
              {editable ? (
                <CommandForm command="upsert_review_packet" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Guardar packet">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Qué es"><textarea name="what_is_it" defaultValue={packet?.what_is_it ?? ""} rows={2} className="input" /></Field>
                    <Field label="Por qué existe"><textarea name="why_it_exists" defaultValue={packet?.why_it_exists ?? ""} rows={2} className="input" /></Field>
                  </div>
                  <Field label="Experiencia (qué verá y sentirá la audiencia)"><textarea name="experience" defaultValue={packet?.experience ?? ""} rows={3} className="input" /></Field>
                  <fieldset className="grid gap-3 md:grid-cols-2">
                    <legend className="mb-1 text-sm font-medium">Words</legend>
                    {([["hook", "Hook"], ["on_screen", "Texto en pantalla"], ["final_line", "Cierre"], ["caption", "Caption"], ["cta", "CTA"]] as const).map(([k, label]) => (
                      <Field key={k} label={label}><textarea name={`words_${k}`} defaultValue={(packet?.words as Record<string, string> | undefined)?.[k] ?? ""} rows={2} className="input" /></Field>
                    ))}
                  </fieldset>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Tipo de preview">
                      <select name="preview_kind" defaultValue={packet?.preview_kind ?? ""} className="input">
                        <option value="">Sin preview</option><option value="video">Video</option><option value="animatic">Animatic</option>
                        <option value="storyboard">Storyboard</option><option value="frames">Frames</option><option value="text">Texto estructurado</option>
                      </select>
                    </Field>
                    <Field label="Enlace del preview"><input name="preview_url" type="url" defaultValue={packet?.preview_url ?? ""} className="input" /></Field>
                  </div>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="claims_checked" defaultChecked={packet?.claims_checked} /> Revisé si la pieza contiene claims verificables (registrados abajo o no aplican).</label>
                  <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="dependencies_checked" defaultChecked={packet?.dependencies_checked} /> Revisé si existen dependencias de aprobación (registradas abajo o no aplican).</label>
                </CommandForm>
              ) : packet ? (
                <PacketView packet={packet} />
              ) : (
                <Empty>Sin Review Packet.</Empty>
              )}
            </Section>
          )}

          {isLocal && (
            <Section title="Claims" description="Cada claim verificable necesita fuente identificable y verificación humana. Una URL por sí sola no verifica.">
              {claims.length === 0 && <Empty>Sin claims registrados.</Empty>}
              <ul className="space-y-3">
                {claims.map((c) => {
                  const src = snapshot.references.find((r) => r.id === c.source_reference_id);
                  return (
                    <li key={c.id}>
                      <Card>
                        <p className="whitespace-pre-wrap text-sm">{c.statement}</p>
                        <p className="mt-1 text-xs text-muted">
                          {c.claim_kind === "fact" ? "Hecho" : c.claim_kind === "estimate" ? "Estimación (debe rotularse como tal)" : "Supuesto (debe rotularse como tal)"} ·{" "}
                          <Badge tone={c.verification_status === "supported" ? "good" : c.verification_status === "unsupported" ? "bad" : "warn"}>
                            {c.verification_status === "supported" ? "Soportado" : c.verification_status === "unsupported" ? "Sin soporte" : "Pendiente"}
                          </Badge>
                          {src && <> · Fuente: <SafeLink href={src.source_url}>{src.title}</SafeLink></>}
                          {c.source_locator && <> · {c.source_locator}</>}
                          {c.verified_at && <> · verificado {fmtInstant(c.verified_at)}</>}
                        </p>
                        {c.verification_note && <p className="mt-1 text-xs">Nota: {c.verification_note}</p>}
                        {!piece.archived_at && piece.production_status !== "approved" && (
                          <div className="mt-2 flex flex-wrap gap-3">
                            <Details summary="Verificar">
                              <CommandForm command="verify_claim" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v, claim_id: c.id }} submitLabel="Registrar verificación">
                                <Field label="Resultado">
                                  <select name="status" className="input"><option value="supported">Soportado</option><option value="unsupported">Sin soporte</option><option value="pending">Volver a pendiente</option></select>
                                </Field>
                                <SourceSelect sources={scopedSources} defaultValue={c.source_reference_id} />
                                <Field label="Localizador de evidencia"><input name="source_locator" defaultValue={c.source_locator ?? ""} className="input" /></Field>
                                <Field label="Nota de verificación"><textarea name="note" rows={2} className="input" /></Field>
                              </CommandForm>
                            </Details>
                            {editable && (
                              <CommandForm command="delete_claim" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v, claim_id: c.id }} submitLabel="Eliminar" tone="danger" inline />
                            )}
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
              {editable && (
                <div className="mt-3 max-w-xl">
                  <Details summary="Añadir claim">
                    <CommandForm command="upsert_claim" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Añadir claim">
                      <Field label="Enunciado"><textarea name="statement" required rows={2} className="input" /></Field>
                      <Field label="Tipo"><select name="claim_kind" className="input"><option value="fact">Hecho</option><option value="estimate">Estimación</option><option value="assumption">Supuesto</option></select></Field>
                      <SourceSelect sources={scopedSources} />
                      <Field label="Localizador de evidencia"><input name="source_locator" className="input" /></Field>
                    </CommandForm>
                  </Details>
                </div>
              )}
            </Section>
          )}

          {isLocal && (
            <Section title="Dependencias de aprobación" description="Propias de esta pieza y su cliente. Para autorizaciones de imagen, guarda solo la confirmación y una referencia mínima.">
              {deps.length === 0 && <Empty>Sin dependencias registradas.</Empty>}
              <ul className="space-y-2">
                {deps.map((d) => (
                  <li key={d.id}>
                    <Card>
                      <p className="text-sm">
                        {d.label} {d.required ? "" : <span className="text-muted">(opcional)</span>}{" "}
                        <Badge tone={d.status === "pending" ? "warn" : "good"}>{d.status === "pending" ? "Pendiente" : d.status === "satisfied" ? "Satisfecha" : "No aplica"}</Badge>
                      </p>
                      {d.evidence_note && <p className="text-xs text-muted">{d.evidence_note}</p>}
                      {!piece.archived_at && piece.production_status !== "approved" && (
                        <div className="mt-2 flex flex-wrap gap-3">
                          <Details summary="Resolver">
                            <CommandForm command="set_dependency_status" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v, dependency_id: d.id }} submitLabel="Guardar">
                              <Field label="Estado"><select name="status" className="input"><option value="satisfied">Satisfecha</option><option value="not_applicable">No aplica</option><option value="pending">Pendiente</option></select></Field>
                              <Field label="Confirmación o motivo"><input name="note" className="input" /></Field>
                            </CommandForm>
                          </Details>
                          {editable && <CommandForm command="delete_dependency" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v, dependency_id: d.id }} submitLabel="Eliminar" tone="danger" inline />}
                        </div>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
              {editable && (
                <div className="mt-3 max-w-xl">
                  <Details summary="Añadir dependencia">
                    <CommandForm command="upsert_dependency" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Añadir">
                      <Field label="Dependencia"><input name="label" required className="input" /></Field>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked /> Obligatoria (bloquea la aprobación mientras esté pendiente)</label>
                    </CommandForm>
                  </Details>
                </div>
              )}
            </Section>
          )}

          <Section id="publicaciones" title="Publicaciones" description="Registros manuales por destino. Content OS no publica ni programa en plataformas: registra lo que confirmas.">
            <PublicationPanel
              pieceId={id}
              publications={pubs}
              channels={snapshot.channels}
              activeChannelIds={snapshot.accountChannels.filter((ac) => ac.account_id === account.id && ac.active).map((ac) => ac.channel_id)}
              canCreate={hasCurrentApproval(fact) && account.active}
              assignedWeek={fact.assignedWeek}
              now={snapshot.now}
            />
          </Section>
        </div>

        <aside className="space-y-6">
          {!isLocal && mirror && (
            <Section title="Sistema fuente" description="Observaciones manuales, no sincronización. La fuente conserva la autoridad.">
              <Card>
                <p className="text-sm">{SOURCE_LABEL[mirror.source_system]} · {mirror.source_entity_type} · {mirror.source_entity_id}</p>
                <p className="mt-1 text-sm"><SafeLink href={mirror.source_url}>Abrir en sistema fuente</SafeLink>{mirror.locator && <> · {mirror.locator}</>}</p>
              </Card>
              <h3 className="mt-4 text-sm font-semibold">Observaciones</h3>
              {observations.length === 0 ? <Empty>Sin observaciones: no cuenta en cobertura.</Empty> : (
                <ul className="mt-2 space-y-2 text-sm">
                  {observations.map((o) => (
                    <li key={o.id} className="rounded-md border border-line p-2">
                      <div>Observado manualmente el {fmtInstant(o.observed_at)}</div>
                      <div>Estado en la fuente: <strong>{o.source_state_raw}</strong></div>
                      <div className="text-xs text-muted">
                        Normalizado: {o.observed_status ?? "sin normalizar"} · revisión completa: {o.review_complete_confirmed ? "confirmada" : "no confirmada"}
                        {o.observed_on_hold ? " · en hold" : ""}
                      </div>
                      {o.evidence_note && <div className="text-xs">Evidencia: {o.evidence_note}</div>}
                    </li>
                  ))}
                </ul>
              )}
              {!piece.archived_at && (
                <div className="mt-3">
                  <Details summary="Registrar observación">
                    <CommandForm command="record_source_observation" requestId={newRequestId()} hidden={{ piece_id: id }} submitLabel="Registrar observación">
                      <Field label="Estado tal como aparece en la fuente"><input name="source_state_raw" required className="input" /></Field>
                      <Field label="Normalización" hint="Usa «desconocido» si no hay equivalencia clara; entonces no cuenta.">
                        <select name="observed_status" className="input" defaultValue="unknown">
                          <option value="unknown">Desconocido</option>
                          {(Object.keys(STATUS_LABEL) as ProductionStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </Field>
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="review_complete_confirmed" /> La pieza completa (no solo un entregable) está aprobada en la fuente.</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="observed_on_hold" /> En hold en la fuente</label>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Fecha observada"><input type="date" name="observed_date" required defaultValue={localDateInput(snapshot.now)} className="input" /></Field>
                        <Field label="Hora (CDMX)"><input type="time" name="observed_time" required defaultValue={localTimeInput(snapshot.now)} className="input" /></Field>
                      </div>
                      <Field label="Evidencia" hint="Obligatoria para un estado aprobado."><textarea name="evidence_note" rows={2} className="input" /></Field>
                    </CommandForm>
                  </Details>
                </div>
              )}
            </Section>
          )}

          <Section title="Operativo">
            {!piece.archived_at ? (
              <CommandForm command="update_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Guardar" tone="secondary">
                <Field label="Prioridad"><select name="priority" defaultValue={piece.priority} className="input"><option value="normal">Normal</option><option value="high">Alta</option></select></Field>
                <Field label="Responsable"><input name="owner_label" defaultValue={piece.owner_label ?? ""} className="input" /></Field>
                <Field label="Vencimiento productivo" hint="No es fecha de publicación."><input type="date" name="due_date" defaultValue={piece.due_date ?? ""} className="input" /></Field>
              </CommandForm>
            ) : <p className="text-sm text-muted">Archivada el {fmtInstant(piece.archived_at)}.</p>}
            {!piece.archived_at && (
              <div className="mt-3">
                <Details summary="Archivar">
                  <p className="mb-2 text-sm text-muted">Excluye del inventario pendiente y la reserva; no elimina publicaciones confirmadas.</p>
                  <CommandForm command="archive_piece" requestId={newRequestId()} hidden={{ piece_id: id, expected_version: v }} submitLabel="Archivar" tone="danger">
                    <Field label="Motivo"><input name="reason" required className="input" /></Field>
                  </CommandForm>
                </Details>
              </div>
            )}
          </Section>

          <Section title="Historial">
            <ul className="space-y-1 text-xs">
              {(decisionsRes.data ?? []).map((d) => (
                <li key={d.id}><strong>Decisión: {d.action}</strong> (rev. {d.content_revision}) · {fmtInstant(d.decided_at)}{d.comment && <> · {d.comment}</>}</li>
              ))}
              {(eventsRes.data ?? []).map((e) => (
                <li key={e.id} className="text-muted">{e.event_type} · {fmtInstant(e.occurred_at)}{e.reason && <> · {e.reason}</>}</li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}

function SourceSelect({ sources, defaultValue }: { sources: { id: string; title: string }[]; defaultValue?: string | null }) {
  return (
    <Field label="Fuente registrada" hint="Solo fuentes de esta cuenta, su marca o públicas generales.">
      <select name="source_reference_id" defaultValue={defaultValue ?? ""} className="input">
        <option value="">— Ninguna —</option>
        {sources.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
    </Field>
  );
}
