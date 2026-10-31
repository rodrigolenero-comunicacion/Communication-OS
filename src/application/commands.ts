// Registro de comandos: traduce formularios a llamadas RPC con parámetros
// validados. La autoridad final está en los comandos SQL (sesión, allowlist,
// versión, transiciones); aquí solo se da forma y se rechaza lo malformado.
import { isLocalDate, localDateTime } from "../domain/time.ts";

export class InputError extends Error {}

type Params = Record<string, string | number | boolean | null | string[] | Record<string, unknown>>;

export interface CommandSpec {
  rpc: string;
  success: string;
  params: (fd: FormData) => Params;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function raw(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (v === null) return null;
  if (typeof v !== "string") throw new InputError(`Campo inválido: ${name}`);
  return v;
}
function text(fd: FormData, name: string): string | null {
  const v = raw(fd, name)?.trim() ?? "";
  if (v.length > 20000) throw new InputError("Texto demasiado largo");
  return v === "" ? null : v;
}
function uuid(fd: FormData, name: string, optional = false): string | null {
  const v = text(fd, name);
  if (v === null && optional) return null;
  if (!v || !UUID.test(v)) throw new InputError(`Identificador inválido: ${name}`);
  return v;
}
function int(fd: FormData, name: string): number {
  const v = text(fd, name);
  const n = v === null ? NaN : Number(v);
  if (!Number.isInteger(n)) throw new InputError(`Número entero requerido: ${name}`);
  return n;
}
function bool(fd: FormData, name: string): boolean {
  const v = raw(fd, name);
  return v === "on" || v === "true";
}
function date(fd: FormData, name: string, optional = false): string | null {
  const v = text(fd, name);
  if (v === null && optional) return null;
  if (!isLocalDate(v)) throw new InputError("Fecha inválida");
  return v;
}
function oneOf<T extends string>(fd: FormData, name: string, values: readonly T[], optional = false): T | null {
  const v = text(fd, name);
  if (v === null && optional) return null;
  if (!values.includes(v as T)) throw new InputError(`Valor no permitido: ${name}`);
  return v as T;
}
/** Fecha + hora locales (America/Mexico_City) → instante ISO. */
function localInstant(fd: FormData, prefix: string): string {
  const d = date(fd, `${prefix}_date`);
  const t = text(fd, `${prefix}_time`);
  if (!t || !/^\d{2}:\d{2}$/.test(t)) throw new InputError("Hora inválida (HH:MM)");
  return localDateTime(d!, t).toISOString();
}

const BUCKETS = ["feed", "stories"] as const;
const TIMING = ["fixed", "window", "flexible"] as const;
const FORMATS = ["post", "carousel", "reel", "video", "story", "other"] as const;
const SOURCE_SYSTEMS = ["manual", "st_hub", "ijlv_editorial", "solotu_cerebro"] as const;
export const CATEGORIES = ["conectar", "educativo", "cobertura", "institucional", "promocional"] as const;
const WORD_KEYS = ["hook", "on_screen", "final_line", "caption", "cta"] as const;
export const CLIENT_COLORS = ["blue", "yellow", "purple", "green", "red", "teal", "orange", "pink", "gray"] as const;
const ORIGINS = ["own_idea", "develop", "generate", "research", "library"] as const;
const CATALOG_KEY = /^[a-z0-9_]+$/;
const SOURCE_TYPES = ["institutional_document", "internal_system", "web", "research", "decision", "reference", "other"] as const;
const SOURCE_STATUSES = ["active", "superseded", "provisional", "archived"] as const;
export const BRAIN_CATEGORIES = ["identity", "audience", "segment", "objective", "strategy", "voice", "editorial_rule",
  "production_rule", "evidence_rule", "review_rule", "constraint", "claim", "learning"] as const;
const CONTENT_ORIGIN_KEYS = ["organic", "event_coverage", "existing_material"] as const;
function isNonOrganic(fd: FormData): boolean {
  const origin = raw(fd, "content_origin");
  return origin === "event_coverage" || origin === "existing_material";
}
const MATERIAL_STATUSES = ["not_required", "pending", "available"] as const;
const SOURCE_REF_SYSTEMS = ["st_hub", "onedrive", "other"] as const;
function catalogKey(fd: FormData, name: string, optional = false): string | null {
  const v = text(fd, name);
  if (v === null && optional) return null;
  if (!v || !CATALOG_KEY.test(v)) throw new InputError(`Elige una opción: ${name}`);
  return v;
}
const OBSERVED = ["idea", "planned", "in_production", "in_review", "changes_requested", "approved", "unknown"] as const;

const pieceVersion = (fd: FormData) => ({ p_piece_id: uuid(fd, "piece_id"), p_expected_version: int(fd, "expected_version") });
const pubVersion = (fd: FormData) => ({ p_publication_id: uuid(fd, "publication_id"), p_expected_version: int(fd, "expected_version") });

function timing(fd: FormData) {
  const mode = oneOf(fd, "timing_mode", TIMING)!;
  return {
    p_timing_mode: mode,
    p_fixed_date: mode === "fixed" ? date(fd, "fixed_date") : null,
    p_valid_from: mode === "window" ? date(fd, "valid_from") : null,
    p_valid_until: mode === "window" ? date(fd, "valid_until") : null,
  };
}

const PIECE_TEXT_FIELDS = ["title", "content_type", "objective", "audience", "editorial_role", "campaign",
  "production_spec_text", "production_spec_url", "owner_label"] as const;

export const COMMANDS: Record<string, CommandSpec> = {
  create_brand: {
    rpc: "create_brand", success: "Marca creada",
    params: (fd) => ({ p_name: text(fd, "name"), p_slug: text(fd, "slug") }),
  },
  update_brand: {
    rpc: "update_brand", success: "Marca actualizada",
    params: (fd) => ({ p_brand_id: uuid(fd, "brand_id"), p_expected_version: int(fd, "expected_version"),
      p_name: text(fd, "name"), p_active: bool(fd, "active") }),
  },
  create_account: {
    rpc: "create_account", success: "Cuenta creada",
    params: (fd) => ({ p_brand_id: uuid(fd, "brand_id"), p_name: text(fd, "name"), p_slug: text(fd, "slug"),
      p_context_notes: text(fd, "context_notes") }),
  },
  update_account: {
    rpc: "update_account", success: "Cuenta actualizada",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_expected_version: int(fd, "expected_version"),
      p_name: text(fd, "name"), p_context_notes: text(fd, "context_notes"), p_active: bool(fd, "active") }),
  },
  set_account_channel: {
    rpc: "set_account_channel", success: "Canal actualizado",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_channel_key: text(fd, "channel_key"), p_active: bool(fd, "active") }),
  },
  set_target_policy: {
    rpc: "set_target_policy", success: "Objetivo guardado",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_bucket: oneOf(fd, "bucket", BUCKETS),
      p_required_count: int(fd, "required_count"), p_buffer_target_days: int(fd, "buffer_target_days"),
      p_active_from: date(fd, "active_from") }),
  },
  end_target_policy: {
    rpc: "end_target_policy", success: "Vigencia cerrada",
    params: (fd) => ({ p_target_id: uuid(fd, "target_id"), p_active_until: date(fd, "active_until") }),
  },
  set_coverage_mode: {
    rpc: "set_coverage_mode", success: "Modo de cobertura actualizado",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_expected_version: int(fd, "expected_version"),
      p_mode: oneOf(fd, "mode", ["not_required", "unconfigured"] as const), p_reason: text(fd, "reason") }),
  },
  create_piece: {
    rpc: "create_piece", success: "Pieza creada",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_title: text(fd, "title"),
      p_bucket: oneOf(fd, "bucket", BUCKETS), ...timing(fd) }),
  },
  quick_create_piece: {
    rpc: "quick_create_piece", success: "Pieza creada",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_title: text(fd, "title"),
      p_bucket: oneOf(fd, "bucket", BUCKETS), ...timing(fd),
      p_template_id: uuid(fd, "template_id", true), p_week_start: date(fd, "week_start", true),
      p_initial_stage: oneOf(fd, "initial_stage", ["idea", "planned", "in_production"] as const, true) }),
  },
  create_calendar_piece: {
    rpc: "create_calendar_piece", success: "Contenido guardado en el calendario",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_planned_date: date(fd, "planned_date"),
      p_title: text(fd, "title"), p_idea: text(fd, "idea"), p_origin: oneOf(fd, "origin", ORIGINS, true) ?? "own_idea",
      p_format_key: catalogKey(fd, "format_key"),
      // Modo de producción: obligatorio solo en el flujo orgánico (incluida la forma V0.2 sin origen).
      // Evento y material existente lo guardan NULL; la base aplica la misma regla.
      p_production_mode_key: catalogKey(fd, "production_mode_key", isNonOrganic(fd)),
      p_pillar_id: uuid(fd, "pillar_id", true), p_territory_id: uuid(fd, "territory_id", true),
      p_bucket: oneOf(fd, "bucket", BUCKETS, true) ?? "feed",
      // V0.2.1: solo si el formulario los trae (migración 0009 aplicada); la firma de V0.2 sigue válida.
      ...(fd.has("content_origin")
        ? { p_content_origin: oneOf(fd, "content_origin", CONTENT_ORIGIN_KEYS),
            p_material_status: oneOf(fd, "material_status", MATERIAL_STATUSES, true),
            p_needs_copy: bool(fd, "needs_copy"), p_event_name: text(fd, "event_name"),
            p_source_system: oneOf(fd, "source_system", SOURCE_REF_SYSTEMS, true),
            p_source_entity_id: text(fd, "source_entity_id"), p_source_url: text(fd, "source_url") }
        : {}) }),
  },
  set_brand_content_origins: {
    rpc: "set_brand_content_origins", success: "Orígenes guardados",
    params: (fd) => ({ p_brand_id: uuid(fd, "brand_id"), p_expected_version: int(fd, "expected_version"),
      p_origins: CONTENT_ORIGIN_KEYS.filter((o) => bool(fd, `origin_${o}`)) }),
  },
  move_piece_day: {
    rpc: "move_piece_day", success: "Fecha actualizada",
    params: (fd) => ({ ...pieceVersion(fd), p_date: date(fd, "date"), p_make_flexible: bool(fd, "make_flexible") }),
  },
  set_brand_appearance: {
    rpc: "set_brand_appearance", success: "Apariencia guardada",
    params: (fd) => ({ p_brand_id: uuid(fd, "brand_id"), p_expected_version: int(fd, "expected_version"),
      p_color: oneOf(fd, "color", CLIENT_COLORS), p_short_label: text(fd, "short_label") }),
  },
  upsert_brand_axis: {
    rpc: "upsert_brand_axis", success: "Eje guardado",
    params: (fd) => {
      const axisId = uuid(fd, "axis_id", true);
      const sort = text(fd, "sort");
      return { p_axis_id: axisId, p_expected_version: axisId ? int(fd, "expected_version") : null,
        p_brand_id: uuid(fd, "brand_id"), p_kind: oneOf(fd, "kind", ["pillar", "territory"] as const),
        p_code: text(fd, "code"), p_name: text(fd, "name"), p_sort: sort === null ? 0 : int(fd, "sort"),
        p_provisional: bool(fd, "provisional"), p_source_note: text(fd, "source_note"), p_active: bool(fd, "active") };
    },
  },
  upsert_brand_source: {
    rpc: "upsert_brand_source", success: "Fuente guardada",
    params: (fd) => {
      const sourceId = uuid(fd, "source_id", true);
      return { p_source_id: sourceId, p_expected_version: sourceId ? int(fd, "expected_version") : null,
        p_brand_id: uuid(fd, "brand_id"), p_title: text(fd, "title"), p_institution: text(fd, "institution"),
        p_source_type: oneOf(fd, "source_type", SOURCE_TYPES), p_source_system: oneOf(fd, "source_system", SOURCE_SYSTEMS, true),
        p_url: text(fd, "url"), p_document_name: text(fd, "document_name"), p_document_version: text(fd, "document_version"),
        p_accessed_at: date(fd, "accessed_at", true), p_published_at: date(fd, "published_at", true),
        p_status: oneOf(fd, "status", SOURCE_STATUSES), p_notes: text(fd, "notes"), p_locator: text(fd, "locator") };
    },
  },
  upsert_brain_entry: {
    rpc: "upsert_brain_entry", success: "Entrada guardada",
    params: (fd) => {
      const entryId = uuid(fd, "entry_id", true);
      const category = oneOf(fd, "category", BRAIN_CATEGORIES)!;
      const sort = text(fd, "sort");
      return { p_entry_id: entryId, p_expected_version: entryId ? int(fd, "expected_version") : null,
        p_brand_id: uuid(fd, "brand_id"), p_account_id: uuid(fd, "account_id", true), p_category: category,
        p_key: text(fd, "key"), p_title: text(fd, "title"), p_content: text(fd, "content"),
        p_status: oneOf(fd, "status", ["active", "superseded", "archived"] as const), p_provisional: bool(fd, "provisional"),
        p_claim_status: category === "claim" ? oneOf(fd, "claim_status", ["confirmed", "provisional", "unsupported"] as const) : null,
        p_source_reference_id: uuid(fd, "source_reference_id", true), p_source_locator: text(fd, "source_locator"),
        p_valid_from: date(fd, "valid_from", true), p_valid_until: date(fd, "valid_until", true),
        p_sort: sort === null ? 0 : int(fd, "sort") };
    },
  },
  create_generated_piece: {
    rpc: "create_generated_piece", success: "Pieza creada",
    params: (fd) => {
      const origin = oneOf(fd, "origin", ["own_idea", "develop", "generate", "library"] as const)!;
      const concept = text(fd, "concept_json");
      let parsed: unknown = {};
      try { parsed = concept ? JSON.parse(concept) : {}; } catch { throw new InputError("Concepto inválido"); }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new InputError("Concepto inválido");
      // Lo que el usuario editó en el formulario prevalece sobre la propuesta.
      const edited = { ...(parsed as Record<string, unknown>), title: text(fd, "title"), idea: text(fd, "idea"),
        central_message: text(fd, "central_message"), stage: text(fd, "stage") };
      return { p_account_id: uuid(fd, "account_id"), p_planned_date: date(fd, "planned_date"), p_origin: origin,
        p_title: text(fd, "title"), p_idea: text(fd, "idea"), p_format_key: catalogKey(fd, "format_key"),
        p_production_mode_key: catalogKey(fd, "production_mode_key"),
        p_pillar_id: uuid(fd, "pillar_id", true), p_territory_id: uuid(fd, "territory_id", true),
        p_library_idea_id: origin === "library" ? uuid(fd, "library_idea_id") : null, p_concept: edited };
    },
  },
  upsert_template: {
    rpc: "upsert_template", success: "Plantilla guardada",
    params: (fd) => {
      const templateId = uuid(fd, "template_id", true);
      return {
        p_template_id: templateId,
        p_expected_version: templateId ? int(fd, "expected_version") : null,
        p_account_id: uuid(fd, "account_id", true),
        p_category: oneOf(fd, "category", CATEGORIES),
        p_name: text(fd, "name"),
        p_content_type: text(fd, "content_type"),
        p_suggested_format: oneOf(fd, "suggested_format", FORMATS, true),
        p_objective: text(fd, "objective"),
        p_audience: text(fd, "audience"),
        p_experience: text(fd, "experience"),
        p_spec_text: text(fd, "spec_text"),
        p_words_guide: Object.fromEntries(
          WORD_KEYS.map((k) => [k, text(fd, `guide_${k}`)] as const).filter(([, v]) => v !== null),
        ),
      };
    },
  },
  set_template_active: {
    rpc: "set_template_active", success: "Plantilla actualizada",
    params: (fd) => ({ p_template_id: uuid(fd, "template_id"), p_expected_version: int(fd, "expected_version"),
      p_active: bool(fd, "active") }),
  },
  update_piece: {
    rpc: "update_piece", success: "Cambios guardados",
    params: (fd) => {
      const changes: Record<string, unknown> = {};
      for (const f of PIECE_TEXT_FIELDS) if (fd.has(f)) changes[f] = text(fd, f) ?? "";
      if (fd.has("due_date")) changes.due_date = date(fd, "due_date", true) ?? "";
      if (fd.has("priority")) changes.priority = oneOf(fd, "priority", ["normal", "high"] as const);
      if (fd.has("idea")) changes.idea = text(fd, "idea") ?? "";
      if (fd.has("format_key")) changes.format_key = catalogKey(fd, "format_key", true) ?? "";
      if (fd.has("production_mode_key")) changes.production_mode_key = catalogKey(fd, "production_mode_key", true) ?? "";
      if (fd.has("pillar_id")) changes.pillar_id = uuid(fd, "pillar_id", true) ?? "";
      if (fd.has("territory_id")) changes.territory_id = uuid(fd, "territory_id", true) ?? "";
      if (fd.has("event_name")) changes.event_name = text(fd, "event_name") ?? "";
      if (fd.has("material_status")) changes.material_status = oneOf(fd, "material_status", MATERIAL_STATUSES);
      if (fd.has("needs_copy_present")) changes.needs_copy = bool(fd, "needs_copy");
      if (fd.has("source_system")) changes.source_system = oneOf(fd, "source_system", SOURCE_REF_SYSTEMS, true) ?? "";
      if (fd.has("source_entity_id")) changes.source_entity_id = text(fd, "source_entity_id") ?? "";
      if (fd.has("source_url")) changes.source_url = text(fd, "source_url") ?? "";
      if (fd.has("timing_mode")) {
        const t = timing(fd);
        Object.assign(changes, { timing_mode: t.p_timing_mode, fixed_date: t.p_fixed_date ?? "",
          valid_from: t.p_valid_from ?? "", valid_until: t.p_valid_until ?? "" });
      }
      return { ...pieceVersion(fd), p_changes: changes };
    },
  },
  plan_piece: { rpc: "plan_piece", success: "Pieza planificada", params: pieceVersion },
  start_production: { rpc: "start_production", success: "Producción iniciada", params: pieceVersion },
  submit_review: { rpc: "submit_review", success: "Enviada a revisión", params: pieceVersion },
  reopen_approved: {
    rpc: "reopen_approved", success: "Aprobación invalidada; la pieza vuelve a producción",
    params: (fd) => ({ ...pieceVersion(fd), p_reason: text(fd, "reason") }),
  },
  archive_piece: {
    rpc: "archive_piece", success: "Pieza archivada",
    params: (fd) => ({ ...pieceVersion(fd), p_reason: text(fd, "reason") }),
  },
  upsert_review_packet: {
    rpc: "upsert_review_packet", success: "Review Packet guardado",
    params: (fd) => ({
      ...pieceVersion(fd),
      p_packet: {
        what_is_it: text(fd, "what_is_it"), why_it_exists: text(fd, "why_it_exists"), experience: text(fd, "experience"),
        words: Object.fromEntries(
          (["hook", "on_screen", "final_line", "caption", "cta"] as const)
            .map((k) => [k, text(fd, `words_${k}`)] as const)
            .filter(([, v]) => v !== null),
        ),
        preview_kind: oneOf(fd, "preview_kind", ["video", "animatic", "storyboard", "frames", "text"] as const, true),
        preview_url: text(fd, "preview_url"),
        claims_checked: bool(fd, "claims_checked"),
        dependencies_checked: bool(fd, "dependencies_checked"),
      },
    }),
  },
  upsert_claim: {
    rpc: "upsert_claim", success: "Claim guardado",
    params: (fd) => ({ ...pieceVersion(fd), p_claim_id: uuid(fd, "claim_id", true), p_statement: text(fd, "statement"),
      p_kind: oneOf(fd, "claim_kind", ["fact", "estimate", "assumption"] as const),
      p_source_reference_id: uuid(fd, "source_reference_id", true), p_source_locator: text(fd, "source_locator") }),
  },
  delete_claim: {
    rpc: "delete_claim", success: "Claim eliminado",
    params: (fd) => ({ ...pieceVersion(fd), p_claim_id: uuid(fd, "claim_id") }),
  },
  verify_claim: {
    rpc: "verify_claim", success: "Verificación registrada",
    params: (fd) => ({ ...pieceVersion(fd), p_claim_id: uuid(fd, "claim_id"),
      p_status: oneOf(fd, "status", ["pending", "supported", "unsupported"] as const), p_note: text(fd, "note"),
      p_source_reference_id: uuid(fd, "source_reference_id", true), p_source_locator: text(fd, "source_locator") }),
  },
  upsert_dependency: {
    rpc: "upsert_dependency", success: "Dependencia guardada",
    params: (fd) => ({ ...pieceVersion(fd), p_dependency_id: uuid(fd, "dependency_id", true), p_label: text(fd, "label"),
      p_required: bool(fd, "required") }),
  },
  delete_dependency: {
    rpc: "delete_dependency", success: "Dependencia eliminada",
    params: (fd) => ({ ...pieceVersion(fd), p_dependency_id: uuid(fd, "dependency_id") }),
  },
  set_dependency_status: {
    rpc: "set_dependency_status", success: "Dependencia actualizada",
    params: (fd) => ({ ...pieceVersion(fd), p_dependency_id: uuid(fd, "dependency_id"),
      p_status: oneOf(fd, "status", ["pending", "satisfied", "not_applicable"] as const), p_note: text(fd, "note") }),
  },
  approve_piece: {
    rpc: "approve_piece", success: "Aprobación registrada",
    params: (fd) => ({ ...pieceVersion(fd), p_comment: text(fd, "comment") }),
  },
  request_changes: {
    rpc: "request_changes", success: "Cambios solicitados",
    params: (fd) => ({ ...pieceVersion(fd), p_comment: text(fd, "comment") }),
  },
  hold_piece: {
    rpc: "hold_piece", success: "Pieza en hold",
    params: (fd) => ({ ...pieceVersion(fd), p_reason: text(fd, "reason") }),
  },
  release_hold: {
    rpc: "release_hold", success: "Hold liberado",
    params: (fd) => ({ ...pieceVersion(fd), p_comment: text(fd, "comment") }),
  },
  assign_week: {
    rpc: "assign_week", success: "Semana asignada; aún sin programar",
    params: (fd) => ({ ...pieceVersion(fd), p_week_start: date(fd, "week_start") }),
  },
  unassign_week: { rpc: "unassign_week", success: "Asignación retirada", params: pieceVersion },
  create_publication: {
    rpc: "create_publication", success: "Registro de publicación creado",
    params: (fd) => ({ p_piece_id: uuid(fd, "piece_id"), p_channel_key: text(fd, "channel_key"),
      p_format: oneOf(fd, "format", FORMATS) }),
  },
  record_schedule: {
    rpc: "record_schedule", success: "Programación registrada",
    params: (fd) => ({ ...pubVersion(fd), p_scheduled_at: localInstant(fd, "scheduled"), p_confirmed: bool(fd, "confirmed") }),
  },
  record_published: {
    rpc: "record_published", success: "Publicación registrada",
    params: (fd) => ({ ...pubVersion(fd), p_published_at: localInstant(fd, "published"),
      p_external_url: text(fd, "external_url"), p_external_post_id: text(fd, "external_post_id"),
      p_evidence_note: text(fd, "evidence_note"), p_confirmed: bool(fd, "confirmed"),
      p_move_assignment: bool(fd, "move_assignment") }),
  },
  cancel_publication: {
    rpc: "cancel_publication", success: "Destino cancelado",
    params: (fd) => ({ ...pubVersion(fd), p_reason: text(fd, "reason") }),
  },
  reopen_publication: {
    rpc: "reopen_publication", success: "Destino reabierto",
    params: (fd) => ({ ...pubVersion(fd), p_reason: text(fd, "reason") }),
  },
  correct_publication: {
    rpc: "correct_publication", success: "Corrección registrada",
    params: (fd) => ({ ...pubVersion(fd), p_published_at: localInstant(fd, "published"),
      p_external_url: text(fd, "external_url"), p_external_post_id: text(fd, "external_post_id"),
      p_evidence_note: text(fd, "evidence_note"), p_reason: text(fd, "reason") }),
  },
  create_context_reference: {
    rpc: "create_context_reference", success: "Referencia registrada",
    params: (fd) => {
      const scope = oneOf(fd, "scope_kind", ["account", "brand", "public_general"] as const);
      return { p_scope_kind: scope, p_account_id: scope === "account" ? uuid(fd, "account_id") : null,
        p_brand_id: scope === "brand" ? uuid(fd, "brand_id") : null,
        p_source_system: oneOf(fd, "source_system", SOURCE_SYSTEMS), p_title: text(fd, "title"),
        p_source_url: text(fd, "source_url"), p_locator: text(fd, "locator") };
    },
  },
  create_external_mirror: {
    rpc: "create_external_mirror", success: "Espejo registrado",
    params: (fd) => ({ p_account_id: uuid(fd, "account_id"), p_title: text(fd, "title"), p_bucket: oneOf(fd, "bucket", BUCKETS),
      p_source_system: oneOf(fd, "source_system", SOURCE_SYSTEMS), p_source_entity_type: text(fd, "source_entity_type"),
      p_source_entity_id: text(fd, "source_entity_id"), p_source_url: text(fd, "source_url"), p_locator: text(fd, "locator") }),
  },
  record_source_observation: {
    rpc: "record_source_observation", success: "Observación registrada",
    params: (fd) => ({ p_piece_id: uuid(fd, "piece_id"), p_source_state_raw: text(fd, "source_state_raw"),
      p_observed_status: oneOf(fd, "observed_status", OBSERVED), p_review_complete_confirmed: bool(fd, "review_complete_confirmed"),
      p_observed_on_hold: bool(fd, "observed_on_hold"), p_observed_at: localInstant(fd, "observed"),
      p_evidence_note: text(fd, "evidence_note") }),
  },
};

/** Mensaje comprensible para el usuario a partir del error de PostgREST/PostgreSQL. */
export function describeError(error: { code?: string; message?: string }): string {
  const code = error.code ?? "";
  if (code.startsWith("CO")) return error.message ?? "Operación rechazada";
  if (code === "23505") return "Ya existe un registro con esos datos (identificador o combinación duplicada).";
  if (code === "23514") return "Algún dato no cumple las reglas (formato, rango, URL o campo obligatorio).";
  if (code === "23503") return "El registro está relacionado con otros datos y no se puede modificar así.";
  if (code === "22P02" || code === "22007" || code === "22008") return "Formato de dato inválido.";
  if (code === "42501") return "Sin permiso para esta operación.";
  return "No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.";
}
