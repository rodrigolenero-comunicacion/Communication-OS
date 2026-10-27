import { newRequestId } from "@/application/context";
import { addDays, type LocalDate } from "@/domain/time";
import type { ChannelRow, PublicationRow } from "@/infrastructure/data";
import { CommandForm } from "./CommandForm";
import { FORMAT_LABEL, PUB_LABEL, fmtInstant, localDateInput, localTimeInput } from "./format";
import { Badge, Details, Empty, Field, SafeLink } from "./ui";

function DateTime({ prefix, date, time, label }: { prefix: string; date: string; time: string; label: string }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={`${label}: fecha`}><input type="date" name={`${prefix}_date`} required defaultValue={date} className="input" /></Field>
      <Field label="Hora (Ciudad de México)"><input type="time" name={`${prefix}_time`} required defaultValue={time} className="input" /></Field>
    </div>
  );
}

export function PublicationPanel({
  pieceId,
  publications,
  channels,
  activeChannelIds,
  canCreate,
  contentType,
  assignedWeek,
  now,
}: {
  pieceId: string;
  publications: PublicationRow[];
  channels: ChannelRow[];
  activeChannelIds: string[];
  canCreate: boolean;
  assignedWeek: LocalDate | null;
  now: Date;
  contentType?: string | null;
}) {
  const channelName = new Map(channels.map((c) => [c.id, c.name]));
  const suggestedDay = assignedWeek && assignedWeek > localDateInput(now) ? assignedWeek : localDateInput(now);
  const CHANNEL_ORDER = ["instagram", "facebook"];
  const activeChannels = channels
    .filter((c) => activeChannelIds.includes(c.id))
    .sort((a, b) => (CHANNEL_ORDER.indexOf(a.key) + 1 || 99) - (CHANNEL_ORDER.indexOf(b.key) + 1 || 99));
  const suggestedFormat = formatFromContentType(contentType);

  return (
    <div className="space-y-3">
      {publications.length === 0 && <Empty>Sin registros de publicación. Aprobar no crea destinos automáticamente.</Empty>}
      {publications.map((p) => {
        const overdue = p.status === "scheduled" && p.scheduled_at !== null && new Date(p.scheduled_at) <= now;
        const hidden = { publication_id: p.id, expected_version: p.version };
        return (
          <div key={p.id} className="rounded-lg border border-line bg-paper p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{channelName.get(p.channel_id)}</strong> · {FORMAT_LABEL[p.format]}
              <Badge tone={p.status === "published" ? "good" : p.status === "scheduled" ? "info" : p.status === "cancelled" ? "neutral" : "warn"}>
                {PUB_LABEL[p.status]}
              </Badge>
              {overdue && <Badge tone="bad">Confirmar publicación</Badge>}
              {p.record_kind === "source_observation" && <Badge tone="info">Observación de la fuente</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted">
              {p.scheduled_at && <>Programada para {fmtInstant(p.scheduled_at)}. </>}
              {p.published_at && <>Publicada (confirmación manual) {fmtInstant(p.published_at)}. </>}
              {p.external_url && <SafeLink href={p.external_url}>Ver publicación</SafeLink>}
              {p.evidence_note && <> Evidencia: {p.evidence_note}</>}
            </p>
            {overdue && (
              <p className="mt-1 text-xs text-bad">
                La hora programada ya pasó. El sistema no asume que se publicó: confirma, reprograma o cancela. Mientras tanto la unidad no cuenta en SAFE ni PROJECTED.
              </p>
            )}
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {(p.status === "unscheduled" || p.status === "scheduled") && (
                <>
                  <Details summary={p.status === "scheduled" ? "Reprogramar" : "Registrar programación manual"}>
                    <CommandForm command="record_schedule" requestId={newRequestId()} hidden={hidden} submitLabel="Registrar programación">
                      <DateTime prefix="scheduled" label="Programada"
                        date={p.scheduled_at ? localDateInput(p.scheduled_at) : (assignedWeek ? addDays(assignedWeek, 0) : suggestedDay)}
                        time={p.scheduled_at ? localTimeInput(p.scheduled_at) : "10:00"} />
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" required /> Ya la programé en la herramienta externa.</label>
                    </CommandForm>
                  </Details>
                  <Details summary="Registrar publicación realizada">
                    <CommandForm command="record_published" requestId={newRequestId()} hidden={hidden} submitLabel="Registrar publicación">
                      <DateTime prefix="published" label="Publicada" date={p.scheduled_at ? localDateInput(p.scheduled_at) : localDateInput(now)}
                        time={p.scheduled_at ? localTimeInput(p.scheduled_at) : localTimeInput(now)} />
                      <Field label="URL de la publicación"><input name="external_url" type="url" className="input" /></Field>
                      <Field label="Identificador externo (opcional)"><input name="external_post_id" className="input" /></Field>
                      <Field label="Nota de evidencia" hint="URL o nota: al menos una."><input name="evidence_note" className="input" /></Field>
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" required /> Confirmo que la publicación ya ocurrió en la plataforma.</label>
                      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="move_assignment" /> Si ocurrió fuera de la semana asignada, mover la asignación completa a la semana real (corrección explícita).</label>
                    </CommandForm>
                  </Details>
                  <Details summary="Cancelar destino">
                    <p className="mb-2 text-xs text-muted">No cancela la aprobación ni quita la asignación semanal.</p>
                    <CommandForm command="cancel_publication" requestId={newRequestId()} hidden={hidden} submitLabel="Cancelar destino" tone="danger">
                      <Field label="Motivo"><input name="reason" required className="input" /></Field>
                    </CommandForm>
                  </Details>
                </>
              )}
              {p.status === "cancelled" && (
                <Details summary="Reabrir destino">
                  <CommandForm command="reopen_publication" requestId={newRequestId()} hidden={hidden} submitLabel="Reabrir">
                    <Field label="Motivo"><input name="reason" required className="input" /></Field>
                  </CommandForm>
                </Details>
              )}
              {p.status === "published" && (
                <Details summary="Corregir datos de la publicación">
                  <CommandForm command="correct_publication" requestId={newRequestId()} hidden={hidden} submitLabel="Registrar corrección" tone="secondary">
                    <DateTime prefix="published" label="Publicada" date={localDateInput(p.published_at!)} time={localTimeInput(p.published_at!)} />
                    <Field label="URL"><input name="external_url" type="url" defaultValue={p.external_url ?? ""} className="input" /></Field>
                    <Field label="Identificador externo"><input name="external_post_id" defaultValue={p.external_post_id ?? ""} className="input" /></Field>
                    <Field label="Nota de evidencia"><input name="evidence_note" defaultValue={p.evidence_note ?? ""} className="input" /></Field>
                    <Field label="Motivo de la corrección"><input name="reason" required className="input" /></Field>
                  </CommandForm>
                </Details>
              )}
            </div>
          </div>
        );
      })}
      {canCreate ? (
        activeChannels.length === 0 ? (
          <p className="text-sm text-muted">Activa al menos un canal de la cuenta en Portfolio para crear destinos.</p>
        ) : (
          <CommandForm command="create_publication" requestId={newRequestId()} hidden={{ piece_id: pieceId }} submitLabel="Crear registro de publicación" inline tone="secondary">
            <Field label="Canal">
              <select name="channel_key" className="input w-auto">{activeChannels.map((c) => <option key={c.id} value={c.key}>{c.name}</option>)}</select>
            </Field>
            <Field label="Formato">
              <select name="format" className="input w-auto" defaultValue={suggestedFormat}>{Object.entries(FORMAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
          </CommandForm>
        )
      ) : (
        <p className="text-sm text-muted">Crear destinos requiere aprobación vigente (o, en espejos, observación aprobada de revisión completa), sin hold y con la cuenta activa.</p>
      )}
    </div>
  );
}

/** Formato sugerido a partir del tipo de contenido libre de la pieza; solo un valor por defecto. */
function formatFromContentType(contentType: string | null | undefined): string {
  const t = (contentType ?? "").toLowerCase();
  if (t.includes("carrusel") || t.includes("carousel")) return "carousel";
  if (t.includes("reel")) return "reel";
  if (t.includes("story") || t.includes("historia")) return "story";
  if (t.includes("video")) return "video";
  return "post";
}
