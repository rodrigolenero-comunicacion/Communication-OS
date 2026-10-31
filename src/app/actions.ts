"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { COMMANDS, InputError, describeError } from "@/application/commands";
import { getSession } from "@/application/session";
import { createSupabaseServerClient } from "@/infrastructure/supabase-server";

export interface CommandResult {
  ok: boolean;
  message: string;
  at: number;
  /** Código de error de la base (p. ej. CO412 = requiere confirmar «Mover y convertir en flexible»). */
  code?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ejecuta un comando del registro. El request_id llega en el formulario,
 * generado al renderizar: un doble envío del mismo formulario produce un solo efecto.
 */
export async function runCommand(_prev: CommandResult | null, fd: FormData): Promise<CommandResult> {
  const at = Date.now();
  const name = fd.get("command");
  const spec = typeof name === "string" ? COMMANDS[name] : undefined;
  const requestId = fd.get("request_id");
  if (!spec || typeof requestId !== "string" || !UUID.test(requestId)) {
    return { ok: false, message: "Formulario inválido. Recarga la página.", at };
  }
  const session = await getSession();
  if (session.kind !== "authorized") return { ok: false, message: "Tu sesión no está autorizada. Vuelve a iniciar sesión.", at };

  let params;
  try {
    params = spec.params(fd);
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message, at };
    throw e;
  }
  const { data, error } = await session.supabase.rpc(spec.rpc, { p_request_id: requestId, ...params });
  if (error) {
    return { ok: false, message: describeError(error), at, code: error.code };
  }
  revalidatePath("/", "layout");
  // Al crear una pieza o un espejo, se abre su ficha para continuar el flujo.
  const pieceId = (data as { piece_id?: string } | null)?.piece_id;
  if ((name === "create_piece" || name === "quick_create_piece" || name === "create_external_mirror") && pieceId && UUID.test(pieceId)) {
    redirect(`/piezas/${pieceId}`);
  }
  if (name === "create_generated_piece" && pieceId && UUID.test(pieceId)) {
    redirect(`/piezas/${pieceId}#paquete`);
  }
  if (name === "create_calendar_piece" && pieceId && UUID.test(pieceId)) {
    redirect(`/dia/${String(fd.get("planned_date"))}?nueva=${pieceId}`);
  }
  const replayed = Boolean((data as { replayed?: boolean } | null)?.replayed);
  return { ok: true, message: replayed ? `${spec.success} (ya estaba registrado)` : spec.success, at };
}

export async function signIn(_prev: CommandResult | null, fd: FormData): Promise<CommandResult> {
  const email = fd.get("email");
  const password = fd.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { ok: false, message: "Escribe correo y contraseña.", at: Date.now() };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: "Credenciales no válidas.", at: Date.now() };
  redirect("/");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** UUID determinista para que repetir el arranque no duplique marcas ni cuentas. */
function derivedId(base: string, index: number): string {
  const h = createHash("sha256").update(`${base}:${index}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const SUGGESTED_PORTFOLIO = [
  { brand: "Tec de Monterrey", slug: "tec", accounts: [
    { name: "Campus Puebla", slug: "campus-puebla" },
    { name: "PrepaTec Puebla", slug: "prepatec-puebla" },
    { name: "Directora / Rectora", slug: "directora-rectora" },
  ] },
  { brand: "Instituto Juan Luis Vives", slug: "ijlv", accounts: [{ name: "IJLV", slug: "ijlv" }] },
  { brand: "Solotu.IA", slug: "solotu", accounts: [{ name: "Solotu.IA", slug: "solotu-ia" }] },
];

/** Crea las 3 marcas y 5 cuentas sugeridas, sin canales ni objetivos (requieren confirmación). */
export async function bootstrapPortfolio(_prev: CommandResult | null, fd: FormData): Promise<CommandResult> {
  const at = Date.now();
  const base = fd.get("request_id");
  if (typeof base !== "string" || !UUID.test(base)) return { ok: false, message: "Formulario inválido.", at };
  const session = await getSession();
  if (session.kind !== "authorized") return { ok: false, message: "Sesión no autorizada.", at };
  const { supabase } = session;
  let i = 0;
  for (const b of SUGGESTED_PORTFOLIO) {
    const { data, error } = await supabase.rpc("create_brand", { p_request_id: derivedId(base, i++), p_name: b.brand, p_slug: b.slug });
    if (error) return { ok: false, message: describeError(error), at };
    const brandId = (data as { brand_id: string }).brand_id;
    for (const a of b.accounts) {
      const res = await supabase.rpc("create_account", {
        p_request_id: derivedId(base, i++), p_brand_id: brandId, p_name: a.name, p_slug: a.slug, p_context_notes: null,
      });
      if (res.error) return { ok: false, message: describeError(res.error), at };
    }
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Portfolio creado. Activa canales y configura objetivos en cada cuenta.", at };
}
