import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicGenerator, classifyProviderError, sanitizeProviderMessage } from "../../src/infrastructure/llm/anthropic.ts";

const KEY = "sk-ant-api03-SECRETOdePRUEBA123456789";
const REQ = { system: "SYSTEM-CONFIDENCIAL", prompt: "PROMPT-CON-CONTEXTO-DEL-BRAIN", schema: { type: "null" } as const, maxTokens: 10, effort: "medium" as const, stage: "develop" };
const body = (type: string, message: string) => ({ type: "error", error: { type, message } });
const headers = (id = "req_011CTest") => new Headers({ "request-id": id, "x-api-key": KEY });

/** Generador con un cliente doble que lanza `error`; captura las líneas de log. */
function failing(error: unknown) {
  const lines: string[] = [];
  let sent: unknown = null;
  let t = 1000;
  const g = anthropicGenerator({ ANTHROPIC_API_KEY: KEY }, {
    client: { beta: { messages: { create: async (b: never) => { sent = b; throw error; } } } },
    log: (l) => lines.push(l),
    clock: () => (t += 250),
  });
  return { g, lines, sent: () => sent };
}

test("adaptador: sin ANTHROPIC_API_KEY degrada a «no configurado» sin llamar a la red", async () => {
  const g = anthropicGenerator({});
  assert.equal(g.configured, false);
  const r = await g.generate({ system: "s", prompt: "p", schema: { type: "null" }, maxTokens: 10, effort: "low" });
  assert.deepEqual(r, { ok: false, code: "not_configured", model: null });
});

test("adaptador: con clave queda configurado (la clave no se expone)", () => {
  const g = anthropicGenerator({ ANTHROPIC_API_KEY: "sk-test-no-real" });
  assert.equal(g.configured, true);
  assert.ok(!JSON.stringify(g).includes("sk-test"));
});

const CASES: [string, unknown, string, number | null][] = [
  ["BadRequestError", new Anthropic.BadRequestError(400, body("invalid_request_error", "output_config.format.schema: unsupported"), undefined, headers()), "bad_request", 400],
  ["AuthenticationError", new Anthropic.AuthenticationError(401, body("authentication_error", "invalid x-api-key"), undefined, headers()), "authentication", 401],
  ["PermissionDeniedError", new Anthropic.PermissionDeniedError(403, body("permission_error", "not allowed"), undefined, headers()), "permission", 403],
  ["NotFoundError", new Anthropic.NotFoundError(404, body("not_found_error", "model: claude-x"), undefined, headers()), "not_found", 404],
  ["RateLimitError", new Anthropic.RateLimitError(429, body("rate_limit_error", "slow down"), undefined, headers()), "rate_limited", 429],
  ["timeout", new Anthropic.APIConnectionTimeoutError(), "timeout", null],
  ["APIError genérico (500)", new Anthropic.InternalServerError(500, body("api_error", "internal"), undefined, headers()), "provider_error", 500],
  ["error no-API", new TypeError("fetch failed"), "provider_error", null],
];

for (const [name, error, code, status] of CASES) {
  test(`clasificación: ${name} → ${code}`, async () => {
    assert.equal(classifyProviderError(error), code);
    const { g, lines } = failing(error);
    const r = await g.generate(REQ);
    assert.deepEqual(r, { ok: false, code, model: "claude-sonnet-5-5" });
    assert.equal(lines.length, 1, "una sola línea de log");
    assert.ok(lines[0].startsWith("[editorial-generation] "));
    const info = JSON.parse(lines[0].slice("[editorial-generation] ".length));
    assert.equal(info.stage, "develop");
    assert.equal(info.provider, "anthropic");
    assert.equal(info.code, code);
    assert.equal(info.status, status);
    assert.equal(info.durationMs, 250);
    if (status !== null) {
      assert.equal(info.requestId, "req_011CTest");
      assert.match(info.type, /_error$/);
    }
  });
}

test("log: BadRequest trae tipo y mensaje del proveedor", async () => {
  const { g, lines } = failing(CASES[0][1]);
  await g.generate(REQ);
  const info = JSON.parse(lines[0].slice(23));
  assert.equal(info.type, "invalid_request_error");
  assert.equal(info.message, "output_config.format.schema: unsupported");
  assert.equal(info.name, "BadRequestError");
});

test("log: nunca incluye clave, headers, prompt, system ni cuerpo de la petición", async () => {
  const leaky = new Anthropic.BadRequestError(400,
    body("invalid_request_error", `bad key ${KEY} and\nauthorization: Bearer ${KEY}`), undefined, headers());
  const { g, lines, sent } = failing(leaky);
  await g.generate(REQ);
  const line = lines.join("\n");
  for (const forbidden of [KEY, "SECRETOdePRUEBA", "SYSTEM-CONFIDENCIAL", "PROMPT-CON-CONTEXTO-DEL-BRAIN", "x-api-key", "\n"]) {
    assert.ok(!line.includes(forbidden), `no debe aparecer: ${forbidden}`);
  }
  // La petición enviada no cambia (mismos campos) y no lleva la etapa.
  const b = sent() as Record<string, unknown>;
  assert.deepEqual(Object.keys(b).sort(), ["betas", "fallbacks", "max_tokens", "messages", "model", "output_config", "system", "thinking"]);
  assert.equal(b.fallbacks, "default");
  assert.deepEqual(b.thinking, { type: "adaptive" });
  assert.deepEqual(b.betas, ["server-side-fallback-2026-07-01"]);
});

test("sanitizado: acota longitud y redacta credenciales", () => {
  assert.equal(sanitizeProviderMessage(`x ${"a".repeat(400)}`).length, 300);
  assert.equal(sanitizeProviderMessage("token sk-ant-abc_DEF-123 fin"), "token [redacted] fin");
  assert.equal(sanitizeProviderMessage(undefined), "");
});
