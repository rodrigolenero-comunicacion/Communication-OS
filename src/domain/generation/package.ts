// Del paquete validado a lo que se persiste: textos del Review Packet y secciones visibles.

import type { PackageOut } from "./schema.ts";

/** Textos clave en `review_packets.words` (mismas claves que el Review Packet manual). */
export function packageWords(p: PackageOut): Record<string, string> {
  const words: Record<string, string> = {};
  const put = (k: string, v: string | null | undefined) => { const t = v?.trim(); if (t) words[k] = t.slice(0, 2200); };
  put("hook", p.hook ?? p.carousel_slides[0]?.title ?? null);
  put("on_screen", p.screen_text.join("\n"));
  put("final_line", p.closing);
  put("caption", p.caption);
  put("cta", p.cta);
  return words;
}

export type PackageSection =
  | "capture" | "interaction" | "edit" | "graphics" | "slides" | "storyboard" | "audio" | "brief" | "fallback" | "output";

/** Qué secciones mostrar: solo las que tienen contenido (no se muestran vacíos por formato). */
export function visibleSections(p: Partial<PackageOut>): PackageSection[] {
  const out: PackageSection[] = [];
  if (p.capture_guide) out.push("capture");
  if (p.interaction_prompts?.length || p.teacher_lines?.length) out.push("interaction");
  if (p.edit_structure?.length) out.push("edit");
  if (p.graphics_spec?.length) out.push("graphics");
  if (p.carousel_slides?.length) out.push("slides");
  if (p.creative_brief) out.push("brief");
  if (p.storyboard?.length) out.push("storyboard");
  if (p.audio_spec) out.push("audio");
  if (p.fallback) out.push("fallback");
  if (p.output) out.push("output");
  return out;
}

/** Huella estable del contexto enviado (para auditoría sin guardar el contenido). */
export async function inputHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
