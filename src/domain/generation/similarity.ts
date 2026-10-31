// Anti-repetición: advierte, nunca bloquea. Similitud léxica simple (sin embeddings).

const STOP = new Set(("a al algo como con de del el en es esa ese esta este hay la las lo los más mas no o para pero por " +
  "que qué se sin su sus también tu un una uno y ya otra otro cómo como cuando donde").split(" "));

export function tokens(text: string): Set<string> {
  return new Set(
    text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ")
      .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 5 ? w.slice(0, 5) : w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Comparable { label: string; text: string }
export interface SimilarityWarning { kind: "similar" | "pillar_overuse" | "territory_overuse" | "format_repeat"; message: string }

export const SIMILARITY_THRESHOLD = 0.3;

/** Advertencias para una propuesta frente al contenido reciente y la biblioteca del mismo cliente. */
export function similarityWarnings(
  proposal: { title: string; idea: string; central_message: string; pillar: string | null; territory: string | null; format: string | null },
  recent: readonly (Comparable & { pillar: string | null; territory: string | null; format: string | null })[],
  bank: readonly Comparable[] = [],
): SimilarityWarning[] {
  const mine = tokens(`${proposal.title} ${proposal.idea} ${proposal.central_message}`);
  const out: SimilarityWarning[] = [];
  const best = [...recent, ...bank]
    .map((c) => ({ c, score: jaccard(mine, tokens(c.text)) }))
    .filter((x) => x.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];
  if (best) out.push({ kind: "similar", message: `Similar a ${best.c.label}. Usar el mismo principio es válido; evita repetir tema, recurso y conclusión.` });

  const last = recent.slice(0, 6);
  if (proposal.pillar && last.filter((r) => r.pillar === proposal.pillar).length >= 3) {
    out.push({ kind: "pillar_overuse", message: `${proposal.pillar} ya aparece ${last.filter((r) => r.pillar === proposal.pillar).length} veces en las últimas ${last.length} piezas.` });
  }
  if (proposal.territory && last.filter((r) => r.territory === proposal.territory).length >= 3) {
    out.push({ kind: "territory_overuse", message: `El territorio ${proposal.territory} se repite en las piezas recientes.` });
  }
  if (proposal.format && recent.length >= 2 && recent.slice(0, 2).every((r) => r.format === proposal.format)) {
    out.push({ kind: "format_repeat", message: `Las dos piezas más recientes ya usan este formato.` });
  }
  return out;
}

/** Lo diferentes que son entre sí las ideas de un lote (0 = idénticas, 1 = sin palabras en común). */
export function batchDiversity(items: readonly string[]): number {
  const sets = items.map(tokens);
  let total = 0, pairs = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { total += 1 - jaccard(sets[i], sets[j]); pairs++; }
  return pairs ? total / pairs : 1;
}
