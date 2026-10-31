// Adaptador Anthropic del puerto StructuredGenerator. Solo servidor: usa ANTHROPIC_API_KEY
// del entorno (Netlify), nunca del repo ni del cliente. Una llamada, salida estructurada.

import Anthropic from "@anthropic-ai/sdk";
import type { StructuredGenerator, StructuredRequest, StructuredResult } from "@/domain/generation/provider";

const DEFAULT_MODEL = "claude-sonnet-5-5";
// Netlify Functions estándar cortan a los 60 s: el tiempo total de la llamada debe quedar por debajo.
const DEFAULT_TIMEOUT_MS = 55_000;

export function anthropicGenerator(env: Record<string, string | undefined> = process.env): StructuredGenerator {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const model = env.GENERATION_MODEL?.trim() || DEFAULT_MODEL;
  const timeout = Number(env.GENERATION_TIMEOUT_MS) > 0 ? Number(env.GENERATION_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  if (!apiKey) {
    return { provider: "anthropic", configured: false, generate: async () => ({ ok: false, code: "not_configured", model: null }) };
  }
  // Sin reintentos automáticos: un reintento tras un timeout duplicaría el tiempo y rebasaría el límite de
  // Netlify. Si falla, la UI ofrece reintentar y no se guarda nada.
  const client = new Anthropic({ apiKey, timeout, maxRetries: 0 });

  return {
    provider: "anthropic",
    configured: true,
    async generate(req: StructuredRequest): Promise<StructuredResult> {
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
        // Solo el tipo de error sale de aquí: nunca el mensaje del proveedor ni datos de la petición.
        if (error instanceof Anthropic.APIConnectionTimeoutError) return { ok: false, code: "timeout", model };
        if (error instanceof Anthropic.RateLimitError) return { ok: false, code: "rate_limited", model };
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) return { ok: false, code: "not_configured", model };
        return { ok: false, code: "provider_error", model };
      }
    },
  };
}
