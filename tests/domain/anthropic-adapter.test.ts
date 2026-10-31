import { test } from "node:test";
import assert from "node:assert/strict";
import { anthropicGenerator } from "../../src/infrastructure/llm/anthropic.ts";

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
