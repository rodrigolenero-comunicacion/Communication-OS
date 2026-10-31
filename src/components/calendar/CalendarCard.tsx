"use client";

import Link from "next/link";
import type { CardData } from "./card-data";

/** Tarjeta compacta: cliente (color + etiqueta), formato · eje, título y estado con símbolo. */
export function CalendarCard({ card, highlight = false, draggable = false }: { card: CardData; highlight?: boolean; draggable?: boolean }) {
  return (
    <Link
      href={`/piezas/${card.pieceId}`}
      draggable={draggable && card.movable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-content-piece", JSON.stringify({ id: card.pieceId, version: card.version, title: card.title }));
        e.dataTransfer.effectAllowed = "move";
      }}
      aria-label={`${card.clientName}, ${card.accountName}: ${card.title}. ${card.formatLabel ?? "Sin formato"}. Estado: ${card.statusLabel}`}
      className={`client-${card.color} client-stripe block rounded-md border border-line bg-paper px-2 py-1.5 text-xs leading-snug hover:bg-soft ${highlight ? "ring-2 ring-good" : ""} ${draggable && card.movable ? "cursor-grab" : ""}`}
    >
      <span className="client-tag block truncate">{card.clientLabel}</span>
      {(card.formatLabel || card.axisLabel) && (
        <span className="block truncate text-muted">{[card.formatLabel, card.axisLabel].filter(Boolean).join(" · ")}</span>
      )}
      <span className="mt-0.5 line-clamp-2 block font-medium text-ink">{card.title}</span>
      <span className="mt-0.5 block text-muted" aria-hidden="true">{card.statusSymbol} {card.statusLabel}</span>
    </Link>
  );
}
