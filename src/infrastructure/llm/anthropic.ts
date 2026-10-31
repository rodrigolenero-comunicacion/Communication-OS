// Adaptador Anthropic del puerto StructuredGenerator. Solo servidor: usa ANTHROPIC_API_KEY
// del entorno (Netlify), nunca del repo ni del cliente. Una llamada, salida estructurada.

import Anthropic from "@anthropic-ai/sdk";
import type { GenerationFailure, StructuredGenerator, StructuredRequest, StructuredResult } from "@/domain/generation/provider";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Netlify Functions estándar cortan a los 60 s: el tiempo total de la llamada debe quedar por debajo.
const DEFAULT_TIMEOUT_MS = 55_000;

/** Mínimo del cliente que usa el adaptador (permite inyectar un doble en pruebas). */
type MessagesClient = { beta: { messages: { create: (body: never) => Promise<unknown> } } };

export interface ProviderErrorLog {
  stage: string | null; provider: "anthropic"; code: GenerationFailure; status: number | null; name: string;
  type: string | null; requestId: string | null; message: string; durationMs: number;
}

/** Quita credenciales y saltos de línea, y acota la longitud. Nunca recibe el cuerpo de la petición. */
export function sanitizeProviderMessage(text: unknown, secrets: readonly string[] = []): string {
  let out = typeof text === "string" ? text : "";
  for (const s of secrets) if (s && s.length >= 8) out = out.split(s).join("[redacted]");
  return out
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(x-api-key|authorization)\s*[:=]\s*\S+/gi, "$1: [redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Clasifica cualquier excepción del SDK. El orden importa: timeout es subclase de error de conexión. */
export function classifyProviderError(error: unknown): GenerationFailure {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) return "bad_request";
  if (error instanceof Anthropic.AuthenticationError) return "authentication";
  if (error instanceof Anthropic.PermissionDeniedError) return "permission";
  if (error instanceof Anthropic.NotFoundError) return "not_found";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  return "provider_error";
}

/** Solo metadatos del error: estado, tipo, request id y mensaje del proveedor sanitizado. */
export function describeProviderError(error: unknown, stage: string | null, durationMs: number, secrets: readonly string[] = []): ProviderErrorLog {
  const code = classifyProviderError(error);
  if (error instanceof Anthropic.APIError) {
    const body = error.error as { error?: { type?: unknown; message?: unknown } } | undefined;
    return {
      stage, provider: "anthropic", code, status: typeof error.status === "number" ? error.status : null,
      name: error.constructor?.name ?? "APIError",
      type: (typeof body?.error?.type === "string" ? body.error.type : null) ?? error.type ?? null,
      requestId: error.requestID ?? null,
      message: sanitizeProviderMessage(typeof body?.error?.message === "string" ? body.error.message : error.message, secrets),
      durationMs,
    };
  }
  const e = error instanceof Error ? error : null;
  return { stage, provider: "anthropic", code, status: null, name: e?.name ?? typeof error, type: null, requestId: null,
    message: sanitizeProviderMessage(e?.message, secrets), durationMs };
}

export function anthropicGenerator(
  env: Record<string, string | undefined> = process.env,
  deps: { client?: MessagesClient; log?: (line: string) => void; clock?: () => number } = {},
): StructuredGenerator {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.GENERATION_MODEL?.trim() || DEFAULT_MODEL;
  const timeout = Number(env.GENERATION_TIMEOUT_MS) > 0 ? Number(env.GENERATION_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  if (!apiKey) {
    return { provider: "anthropic", configured: false, generate: async () => ({ ok: false, code: "not_configured", model: null }) };
  }
  // Sin reintentos automáticos: un reintento tras un timeout duplicaría el tiempo y rebasaría el límite de
  // Netlify. Si falla, la UI ofrece reintentar y no se guarda nada.
  const client = (deps.client ?? new Anthropic({ apiKey, timeout, maxRetries: 0 })) as Anthropic;
  const log = deps.log ?? ((line: string) => console.error(line));
  const clock = deps.clock ?? (() => Date.now());

  return {
    provider: "anthropic",
    configured: true,
    async generate(req: StructuredRequest): Promise<StructuredResult> {
      const started = clock();
      try {
        const res = await client.beta.messages.create({
          model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
          // Sonnet 5.5: thinking adaptativo (no se puede desactivar con `disabled`); profundidad vía effort.
          thinking: { type: "adaptive" },
          output_config: { effort: req.effort, format: { type: "json_schema", schema: req.schema as Record<string, unknown> } },
          // Si el modelo declina por categoría, el servidor reintenta con el modelo recomendado.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        const usage = { model: res.model, inputTokens: res.usage?.input_tokens ?? null, outputTokens: res.usage?.output_tokens ?? null };
        if (res.stop_reason === "refusal") return { ok: false, code: "refused", ...usage };
        if (res.stop_reason === "max_tokens") return { ok: false, code: "truncated", ...usage };
        const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
        try {
          return { ok: true, data: JSON.parse(text), ...usage };
        } catch {
          return { ok: false, code: "invalid_json", ...usage };
        }
      } catch (error) {
        // Diagnóstico: una línea con metadatos del error. Nunca prompt, system, contexto, headers ni clave.
        const info = describeProviderError(error, req.stage ?? null, clock() - started, [apiKey]);
        log(`[editorial-generation] ${JSON.stringify(info)}`);
        return { ok: false, code: info.code, model };
      }
    },
  };
}
