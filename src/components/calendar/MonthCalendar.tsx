"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CalendarDay } from "@/domain/calendar";
import { CalendarCard } from "./CalendarCard";
import type { CardData } from "./card-data";
import { FLEXIBLE_CONFIRM, requestMove } from "./move";

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MAX_CARDS = 3;
const longDate = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/**
 * Calendario mensual. Arrastrar una tarjeta a otro día la mueve (solo si es movible, D1).
 * Alternativa por teclado: abrir el día o la ficha y usar «Mover a».
 */
export function MonthCalendar({
  weeks,
  today,
  cardsByDate,
  dragEnabled = true,
}: {
  weeks: CalendarDay[][];
  today: string;
  cardsByDate: Record<string, CardData[]>;
  dragEnabled?: boolean;
}) {
  const router = useRouter();
  const [over, setOver] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const drop = (date: string, raw: string) => {
    let data: { id: string; version: number; title: string };
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    start(async () => {
      let res = await requestMove(data.id, data.version, date, false);
      if (res.code === "CO412" && window.confirm(FLEXIBLE_CONFIRM)) {
        res = await requestMove(data.id, data.version, date, true);
      }
      setStatus({ ok: res.ok, text: res.ok ? `«${data.title}» movida al ${date}` : res.message });
      if (res.ok) router.refresh();
    });
  };

  return (
    <div>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${status?.ok ? "text-good" : "text-bad"}`}>
        {pending ? "Moviendo…" : status?.text}
      </p>
      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        <div className="grid grid-cols-7 border-b border-line bg-soft text-center text-[11px] font-semibold tracking-wide text-muted" aria-hidden="true">
          {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div>
          {weeks.map((week) => (
            <div key={week[0].date} className="grid grid-cols-7 border-b border-line last:border-b-0">
              {week.map((day) => {
                const cards = cardsByDate[day.date] ?? [];
                const isToday = day.date === today;
                const dayNumber = Number(day.date.slice(8));
                return (
                  <div
                    key={day.date}
                    onDragOver={(e) => {
                      if (e.dataTransfer.types.includes("application/x-content-piece")) {
                        e.preventDefault();
                        setOver(day.date);
                      }
                    }}
                    onDragLeave={() => setOver((o) => (o === day.date ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      drop(day.date, e.dataTransfer.getData("application/x-content-piece"));
                    }}
                    className={`min-h-20 border-r border-line p-1 last:border-r-0 sm:min-h-32 ${day.inMonth ? "" : "bg-canvas/60"} ${over === day.date ? "drop-target" : ""}`}
                  >
                    <Link
                      href={`/dia/${day.date}`}
                      aria-label={`${longDate.format(new Date(`${day.date}T00:00:00Z`))}: ${cards.length} contenido(s). Abrir día`}
                      className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-semibold hover:bg-soft ${isToday ? "bg-ink text-paper hover:bg-ink" : day.inMonth ? "text-ink" : "text-muted"}`}
                    >
                      {dayNumber}
                    </Link>
                    {/* Móvil: puntos por cliente con etiqueta accesible; escritorio: tarjetas. */}
                    <div className="flex flex-wrap gap-1 sm:hidden" aria-hidden="true">
                      {cards.map((c) => <span key={c.pieceId} className={`client-${c.color} client-dot`} />)}
                    </div>
                    <div className="hidden space-y-1 sm:block">
                      {cards.slice(0, MAX_CARDS).map((c) => <CalendarCard key={c.pieceId} card={c} draggable={dragEnabled} />)}
                      {cards.length > MAX_CARDS && (
                        <Link href={`/dia/${day.date}`} className="block text-xs text-muted underline">+{cards.length - MAX_CARDS} más</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
