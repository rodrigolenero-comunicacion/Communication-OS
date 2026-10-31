import { attentionBadge, calendarDateOf, canMoveByDrag, cardStatus, originTag, type AttentionBadge, type ContentOrigin } from "@/domain/calendar";
import type { LocalDate } from "@/domain/time";
import type { Snapshot } from "@/infrastructure/data";

/** Datos serializables de una tarjeta de calendario (servidor → cliente). */
export interface CardData {
  pieceId: string;
  version: number;
  title: string;
  date: LocalDate | null;
  clientLabel: string;
  clientName: string;
  color: string;
  accountId: string;
  accountName: string;
  brandId: string;
  formatLabel: string | null;
  axisLabel: string | null;
  statusLabel: string;
  statusSymbol: string;
  statusKey: string;
  movable: boolean;
  timingMode: string;
  contentOrigin: ContentOrigin;
  originTag: string | null;
  eventName: string | null;
  /** Señal de material/copy que tiene prioridad visual sobre el estado de producción. */
  attention: AttentionBadge | null;
}

/** Construye las tarjetas de piezas no archivadas a partir de la lectura coherente. */
export function buildCards(snapshot: Snapshot): CardData[] {
  const accountById = new Map(snapshot.accounts.map((a) => [a.id, a]));
  const brandById = new Map(snapshot.brands.map((b) => [b.id, b]));
  const formatLabel = new Map(snapshot.formats.map((f) => [f.key, f.label]));
  const axisById = new Map(snapshot.axes.map((x) => [x.id, x]));
  const rowById = new Map(snapshot.pieces.map((p) => [p.id, p]));
  return snapshot.facts
    .filter((f) => !f.archived)
    .map((f) => {
      const row = rowById.get(f.id)!;
      const account = accountById.get(f.accountId)!;
      const brand = brandById.get(account.brand_id)!;
      const status = cardStatus(f);
      const pillar = row.pillar_id ? axisById.get(row.pillar_id) : undefined;
      const territory = row.territory_id ? axisById.get(row.territory_id) : undefined;
      const axis = [pillar ? pillar.code ?? pillar.name : null, territory?.name ?? null].filter(Boolean).join(" · ");
      return {
        pieceId: f.id,
        version: row.version,
        title: f.title,
        date: calendarDateOf(f),
        clientLabel: brand.short_label || brand.name,
        clientName: brand.name,
        color: brand.color ?? "gray",
        accountId: account.id,
        accountName: account.name,
        brandId: brand.id,
        formatLabel: row.format_key ? formatLabel.get(row.format_key) ?? row.format_key : row.content_type,
        axisLabel: axis || null,
        statusLabel: status.label,
        statusSymbol: status.symbol,
        statusKey: status.key,
        movable: canMoveByDrag(f),
        timingMode: f.timing.mode,
        contentOrigin: row.content_origin ?? "organic",
        originTag: originTag(row.content_origin),
        eventName: row.event_name ?? null,
        attention: attentionBadge({
          contentOrigin: row.content_origin, materialStatus: row.material_status, needsCopy: row.needs_copy, publications: f.publications,
        }),
      };
    });
}
