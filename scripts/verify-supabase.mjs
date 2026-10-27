// Verificación contra un proyecto Supabase REAL (no modifica datos operativos).
// Uso: node --env-file=.env.local scripts/verify-supabase.mjs
// Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY y,
// para la parte autenticada, VERIFY_EMAIL y VERIFY_PASSWORD del usuario provisionado
// (pásalas solo en la línea de comandos; no las guardes en archivos versionados).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}
let failed = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};

const anon = createClient(url, key, { auth: { persistSession: false } });
for (const table of ["content_pieces", "brands", "review_decisions", "authorized_users"]) {
  const { data, error } = await anon.from(table).select("*").limit(1);
  check(Boolean(error) || (data ?? []).length === 0, `S01 anónimo no lee ${table}`, error?.code ?? `${data?.length} filas`);
}
const anonCmd = await anon.rpc("create_brand", { p_request_id: crypto.randomUUID(), p_name: "x", p_slug: "x" });
check(Boolean(anonCmd.error), "S01 anónimo no invoca comandos", anonCmd.error?.code);

const email = process.env.VERIFY_EMAIL;
const password = process.env.VERIFY_PASSWORD;
if (!email || !password) {
  console.log("BLOCKED: parte autenticada omitida (define VERIFY_EMAIL y VERIFY_PASSWORD)");
} else {
  const user = createClient(url, key, { auth: { persistSession: false } });
  const { error: loginError } = await user.auth.signInWithPassword({ email, password });
  check(!loginError, "Login con el usuario provisionado", loginError?.message);
  if (!loginError) {
    const who = await user.rpc("whoami");
    check(who.data?.authorized === true, "S03 usuario en allowlist activa", JSON.stringify(who.data));
    const channels = await user.from("channels").select("key");
    check((channels.data ?? []).length >= 2, "Autorizado lee catálogo de canales");
    const direct = await user.from("brands").insert({ name: "x", slug: "verify-direct" });
    check(Boolean(direct.error), "S04 escritura directa a tablas rechazada", direct.error?.code);
    const decisions = await user.from("review_decisions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    check(Boolean(decisions.error) || (decisions.data ?? []).length === 0, "S05 historial no se borra desde la API", decisions.error?.code);
    await user.auth.signOut();
  }
}
console.log(failed ? `\n${failed} comprobación(es) fallida(s)` : "\nSin fallos");
process.exit(failed ? 1 : 0);
