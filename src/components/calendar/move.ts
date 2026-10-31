"use client";

import { runCommand, type CommandResult } from "@/app/actions";

/** Envía move_piece_day. CO412 = fuera de fecha fija/ventana: requiere confirmar la conversión a flexible. */
export async function requestMove(pieceId: string, version: number, date: string, makeFlexible: boolean): Promise<CommandResult> {
  const fd = new FormData();
  fd.set("command", "move_piece_day");
  fd.set("request_id", crypto.randomUUID());
  fd.set("piece_id", pieceId);
  fd.set("expected_version", String(version));
  fd.set("date", date);
  if (makeFlexible) fd.set("make_flexible", "true");
  return runCommand(null, fd);
}

export const FLEXIBLE_CONFIRM =
  "Esta pieza tiene fecha fija o ventana y el nuevo día queda fuera.\n\n¿Mover y convertir en flexible? Se registrará en el historial.";
