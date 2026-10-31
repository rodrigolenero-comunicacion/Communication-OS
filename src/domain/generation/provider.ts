// Puerto del proveedor. El dominio no sabe si debajo hay Anthropic u otro.

import type { JsonSchema } from "./schema.ts";

export interface StructuredRequest {
  system: string;
  prompt: string;
  schema: JsonSchema;
  maxTokens: number;
  effort: "low" | "medium" | "high";
}

export type GenerationFailure = "not_configured" | "provider_error" | "timeout" | "refused" | "truncated" | "invalid_json" | "rate_limited";

export type StructuredResult =
  | { ok: true; data: unknown; model: string; inputTokens: number | null; outputTokens: number | null }
  | { ok: false; code: GenerationFailure; model: string | null; inputTokens?: number | null; outputTokens?: number | null };

export interface StructuredGenerator {
  provider: string;
  /** Falso si falta configuración (p. ej. la clave): la app degrada sin llamar. */
  configured: boolean;
  generate(req: StructuredRequest): Promise<StructuredResult>;
}

export const FAILURE_MESSAGE: Record<GenerationFailure | "invalid_output", string> = {
  not_configured: "Generación no configurada.",
  provider_error: "El proveedor no respondió correctamente. Intenta de nuevo.",
  timeout: "La generación tardó demasiado. Intenta de nuevo o con una indicación más acotada.",
  refused: "El proveedor declinó esta solicitud. Reformula la idea e intenta de nuevo.",
  truncated: "La respuesta quedó incompleta. Intenta de nuevo.",
  invalid_json: "La respuesta no tenía el formato esperado. No se guardó nada; intenta de nuevo.",
  invalid_output: "La respuesta no cumplió el esquema. No se guardó nada; intenta de nuevo.",
  rate_limited: "El proveedor está limitando solicitudes. Espera un momento e intenta de nuevo.",
};
