// Esquemas de salida del generador (Stage A y Stage B) y su validador.
// El mismo esquema se envía al proveedor (salida estructurada) y valida la respuesta antes
// de persistir: nunca se confía en texto libre.

export type JsonSchema =
  | { type: "string"; enum?: readonly string[]; description?: string }
  | { type: "integer"; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "array"; items: JsonSchema; description?: string }
  | { type: "object"; properties: Record<string, JsonSchema>; required: readonly string[]; additionalProperties: false; description?: string }
  | { anyOf: readonly JsonSchema[]; description?: string }
  | { type: "null" };

const str = (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) });
const nullable = (s: JsonSchema): JsonSchema => ({ anyOf: [s, { type: "null" }] });
/** Texto opcional SIN unión de tipos: cadena vacía = no aplica (la API limita las uniones a 16 por petición). */
const opt = (description?: string): JsonSchema => str(description ? `${description}. Cadena vacía si no aplica` : "Cadena vacía si no aplica");
/** Límite de la API: campos con anyOf/nullable por petición. Una prueba lo vigila. */
export const MAX_UNION_FIELDS = 16;
const list = (items: JsonSchema, description?: string): JsonSchema => ({ type: "array", items, ...(description ? { description } : {}) });
const obj = (properties: Record<string, JsonSchema>, description?: string): JsonSchema => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false, ...(description ? { description } : {}),
});
const oneOf = (values: readonly string[], description?: string): JsonSchema => ({ type: "string", enum: values, ...(description ? { description } : {}) });

export const STAGES = ["maternal", "preescolar", "primaria", "todas"] as const;
export const EVIDENCE_CLASSES = ["observation", "institutional", "educational_general", "specialized", "creative_metaphor"] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/** Opciones válidas en esta llamada: salen del contexto del cliente (Brain y catálogos), no del código. */
export interface SchemaOptions {
  pillarRefs: readonly string[];
  territoryRefs: readonly string[];
  formatKeys: readonly string[];
  modeKeys: readonly string[];
  sourceRefs: readonly string[];
}

export function conceptSchema(o: SchemaOptions): JsonSchema {
  return obj({
    title: str("Título conceptual breve"),
    idea: str("La idea en una o dos frases"),
    objective: str("Qué debe lograr la pieza"),
    audience: str("A quién se dirige, según las audiencias del Brain"),
    stage: oneOf([...STAGES, ""], "Etapa a la que se dirige; cadena vacía si no aplica"),
    pillar: oneOf(o.pillarRefs, "Referencia del pilar (campo ref del contexto)"),
    territory: oneOf(o.territoryRefs, "Referencia del territorio (campo ref del contexto)"),
    suggested_format: oneOf(o.formatKeys),
    suggested_production_mode: oneOf(o.modeKeys),
    central_message: str("Mensaje que debe quedar"),
    editorial_reason: str("Por qué encaja con la estrategia; breve"),
    similar_to: opt("Pieza reciente o idea del banco parecida y en qué"),
  });
}

export function proposalsSchema(o: SchemaOptions): JsonSchema {
  return obj({ proposals: list(conceptSchema(o)) });
}

export function packageSchema(o: SchemaOptions): JsonSchema {
  const sourceRef = oneOf([...o.sourceRefs, ""], "ref de una fuente del contexto que respalde la afirmación; cadena vacía si ninguna");
  return obj({
    concept: str(), central_message: str(), objective: str(),
    hook: opt(), development: opt(), closing: opt(),
    screen_text: list(str(), "Textos exactos en pantalla, en orden"),
    voiceover: opt(),
    teacher_lines: list(str(), "Como máximo dos líneas exactas de docente si se usan"),
    interaction_prompts: list(str(), "Preguntas detonadoras abiertas; nunca respuestas guionizadas de niños"),
    capture_guide: nullable(obj({
      moments: list(str()), direction: str(), broll: list(str()), privacy: str(), materials: list(str()),
    })),
    edit_structure: list(str(), "Estructura de edición por bloques"),
    creative_brief: opt(),
    storyboard: list(obj({
      scene: { type: "integer" }, timing: str(), bars: opt("Compases"), text: str("Texto exacto"),
      layout: str(), movement: str(), camera: opt(), transition: opt(), sound: opt(),
    })),
    carousel_slides: list(obj({ title: str(), body: str(), visual_direction: str(), source_credit: opt() })),
    graphics_spec: list(obj({
      element: str(), function: str(), moment: str(), movement: str(), relation_to_image: str(), constraint: str(),
    })),
    audio_spec: nullable(obj({
      intention: str(), rhythm: str(), key_moments: list(str()), timbres: list(str()), jingle_relation: str(),
      sfx: list(str()), level: str(),
    })),
    caption: str(), cta: opt(), alt_text: opt(),
    fallback: opt("Plan B / versión estática"),
    output: opt("Entregables"),
    claims: list(obj({
      statement: str("Afirmación exacta que aparece en la pieza"),
      evidence_class: oneOf(EVIDENCE_CLASSES),
      source_ref: sourceRef,
      on_screen_credit: opt(),
    })),
    dependencies: list(str(), "Condiciones necesarias antes de aprobar (autorizaciones, material, validaciones)"),
    alternative: opt(),
  });
}

// --- Validador del subconjunto de JSON Schema que usamos -------------------------------

export function validate(schema: JsonSchema, value: unknown, path = "$"): string[] {
  if ("anyOf" in schema) {
    const ok = schema.anyOf.some((s) => validate(s, value, path).length === 0);
    return ok ? [] : [`${path}: no coincide con ninguna opción`];
  }
  switch (schema.type) {
    case "null": return value === null ? [] : [`${path}: debe ser null`];
    case "string":
      if (typeof value !== "string") return [`${path}: debe ser texto`];
      if (schema.enum && !schema.enum.includes(value)) return [`${path}: valor no permitido`];
      return value.length > 8000 ? [`${path}: texto demasiado largo`] : [];
    case "integer": return Number.isInteger(value) ? [] : [`${path}: debe ser entero`];
    case "boolean": return typeof value === "boolean" ? [] : [`${path}: debe ser booleano`];
    case "array":
      if (!Array.isArray(value)) return [`${path}: debe ser lista`];
      if (value.length > 40) return [`${path}: demasiados elementos`];
      return value.flatMap((v, i) => validate(schema.items, v, `${path}[${i}]`));
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path}: debe ser objeto`];
      const rec = value as Record<string, unknown>;
      const extra = Object.keys(rec).filter((k) => !(k in schema.properties)).map((k) => `${path}.${k}: campo no permitido`);
      const missing = schema.required.filter((k) => !(k in rec)).map((k) => `${path}.${k}: falta`);
      const nested = Object.entries(schema.properties).flatMap(([k, s]) => (k in rec ? validate(s, rec[k], `${path}.${k}`) : []));
      return [...extra, ...missing, ...nested];
    }
  }
}

// --- Tipos de salida ------------------------------------------------------------

export interface ConceptOut {
  title: string; idea: string; objective: string; audience: string; stage: (typeof STAGES)[number] | null;
  pillar: string; territory: string; suggested_format: string; suggested_production_mode: string;
  central_message: string; editorial_reason: string; similar_to: string | null;
}

export interface PackageOut {
  concept: string; central_message: string; objective: string;
  hook: string | null; development: string | null; closing: string | null;
  screen_text: string[]; voiceover: string | null; teacher_lines: string[]; interaction_prompts: string[];
  capture_guide: { moments: string[]; direction: string; broll: string[]; privacy: string; materials: string[] } | null;
  edit_structure: string[]; creative_brief: string | null;
  storyboard: { scene: number; timing: string; bars: string | null; text: string; layout: string; movement: string;
    camera: string | null; transition: string | null; sound: string | null }[];
  carousel_slides: { title: string; body: string; visual_direction: string; source_credit: string | null }[];
  graphics_spec: { element: string; function: string; moment: string; movement: string; relation_to_image: string; constraint: string }[];
  audio_spec: { intention: string; rhythm: string; key_moments: string[]; timbres: string[]; jingle_relation: string; sfx: string[]; level: string } | null;
  caption: string; cta: string | null; alt_text: string | null; fallback: string | null; output: string | null;
  claims: { statement: string; evidence_class: EvidenceClass; source_ref: string | null; on_screen_credit: string | null }[];
  dependencies: string[]; alternative: string | null;
}

export type ProposalMode = "classify" | "develop" | "ideas";
/** Cuántas propuestas debe traer cada modo: clasificar 1, desarrollar hasta 3, desde cero 5. */
export const PROPOSAL_COUNT: Record<ProposalMode, { min: number; max: number }> = {
  classify: { min: 1, max: 1 },
  develop: { min: 1, max: 3 },
  ideas: { min: 5, max: 5 },
};

export type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[] };

/** Cadena vacía → null en campos de texto y sin vacíos en listas de texto (tras validar). */
export function emptyToNull<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => !(typeof v === "string" && v.trim() === "")).map((v) => emptyToNull(v)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typeof v === "string" && v.trim() === "" ? null : emptyToNull(v)])) as T;
  }
  return value;
}

export function checkProposals(raw: unknown, mode: ProposalMode, o: SchemaOptions): Checked<ConceptOut[]> {
  const errors = validate(proposalsSchema(o), raw);
  if (errors.length) return { ok: false, errors };
  const list = emptyToNull((raw as { proposals: ConceptOut[] }).proposals);
  const { min, max } = PROPOSAL_COUNT[mode];
  if (list.length < min || list.length > max) return { ok: false, errors: [`Se esperaban entre ${min} y ${max} propuestas; llegaron ${list.length}`] };
  const blank = list.findIndex((p) => !p.title || !p.idea || !p.central_message);
  if (blank >= 0) return { ok: false, errors: [`Propuesta ${blank + 1} incompleta`] };
  return { ok: true, value: list };
}

export function checkPackage(raw: unknown, o: SchemaOptions): Checked<PackageOut> {
  const errors = validate(packageSchema(o), raw);
  if (errors.length) return { ok: false, errors };
  const problems: string[] = [];
  if (!(raw as PackageOut).caption.trim()) problems.push("Falta el caption");
  const p = emptyToNull(raw as PackageOut);
  if (p.teacher_lines.length > 2) problems.push("Más de dos líneas de docente");
  if (p.claims.length > 30 || p.dependencies.length > 10) problems.push("Demasiados claims o dependencias");
  return problems.length ? { ok: false, errors: problems } : { ok: true, value: p };
}
