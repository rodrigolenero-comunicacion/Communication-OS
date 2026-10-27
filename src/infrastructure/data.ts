// Lectura bajo RLS con la sesión del usuario y mapeo a hechos de dominio.
// Los cálculos (cobertura, runway, reserva) se hacen después, en src/domain.
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountFact,
  Bucket,
  CoverageMode,
  EditorialTarget,
  ObservedStatus,
  PieceFact,
  ProductionStatus,
  PublicationStatus,
  TimingMode,
} from "@/domain/types";

export interface BrandRow { id: string; name: string; slug: string; active: boolean; version: number }
export interface AccountRow {
  id: string; brand_id: string; name: string; slug: string; active: boolean;
  context_notes: string | null; coverage_mode: CoverageMode; version: number;
}
export interface ChannelRow { id: string; key: string; name: string }
export interface AccountChannelRow { account_id: string; channel_id: string; active: boolean }
export interface TargetRow {
  id: string; account_id: string; bucket: Bucket; required_count: number; buffer_target_days: number;
  active_from: string; active_until: string | null;
}
export interface PieceRow {
  id: string; account_id: string; title: string; bucket: Bucket; content_type: string | null;
  objective: string | null; audience: string | null; editorial_role: string | null; campaign: string | null;
  owner_label: string | null; due_date: string | null; priority: "normal" | "high";
  ownership: "local" | "external"; production_status: ProductionStatus | null; on_hold: boolean;
  archived_at: string | null; content_revision: number; approved_revision: number | null; approved_at: string | null;
  timing_mode: TimingMode; fixed_date: string | null; valid_from: string | null; valid_until: string | null;
  production_spec_text: string | null; production_spec_url: string | null; version: number;
  created_at: string; updated_at: string;
  category: Category | null; template_id: string | null;
}
export type Category = "conectar" | "educativo" | "cobertura" | "institucional" | "promocional";
export interface TemplateRow {
  id: string; account_id: string | null; category: Category; name: string; content_type: string | null;
  suggested_format: string | null; objective: string | null; audience: string | null; experience: string | null;
  spec_text: string | null; words_guide: Record<string, string>; is_draft: boolean; active: boolean; version: number;
}
export interface AssignmentRow { id: string; content_piece_id: string; week_start: string; version: number }
export interface PublicationRow {
  id: string; content_piece_id: string; channel_id: string; format: string; status: PublicationStatus;
  scheduled_at: string | null; published_at: string | null; external_post_id: string | null;
  external_url: string | null; evidence_note: string | null; record_kind: "local_record" | "source_observation";
  version: number; updated_at: string;
}
export interface SourceReferenceRow {
  id: string; content_piece_id: string | null; account_id: string | null; brand_id: string | null;
  relation_kind: "context_reference" | "external_mirror"; source_system: string;
  source_entity_type: string | null; source_entity_id: string | null; source_url: string | null;
  title: string; locator: string | null; scope_kind: "account" | "brand" | "public_general"; created_at: string;
}
export interface ObservationRow {
  id: string; source_reference_id: string; source_state_raw: string; observed_status: ObservedStatus | null;
  review_complete_confirmed: boolean; observed_on_hold: boolean; observed_at: string; recorded_at: string;
  evidence_note: string | null;
}

export interface Snapshot {
  now: Date;
  brands: BrandRow[];
  accounts: AccountRow[];
  channels: ChannelRow[];
  accountChannels: AccountChannelRow[];
  targets: EditorialTarget[];
  targetRows: TargetRow[];
  pieces: PieceRow[];
  assignments: Map<string, AssignmentRow>;
  publications: PublicationRow[];
  references: SourceReferenceRow[];
  observations: ObservationRow[];
  templates: TemplateRow[];
  facts: PieceFact[];
  accountFacts: AccountFact[];
}

async function all<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`Error de lectura: ${error.message}`);
  return data ?? [];
}

/** Lectura coherente del estado necesario para cobertura y colas. */
export async function loadSnapshot(supabase: SupabaseClient, now = new Date()): Promise<Snapshot> {
  const [brands, accounts, channels, accountChannels, targetRows, pieces, assignments, publications, references, observations, templates] =
    await Promise.all([
      all<BrandRow>(supabase.from("brands").select("*").order("name")),
      all<AccountRow>(supabase.from("accounts").select("*").order("name")),
      all<ChannelRow>(supabase.from("channels").select("*").order("key")),
      all<AccountChannelRow>(supabase.from("account_channels").select("*")),
      all<TargetRow>(supabase.from("editorial_targets").select("*").order("active_from")),
      all<PieceRow>(supabase.from("content_pieces").select("*").order("created_at", { ascending: false }).limit(5000)),
      all<AssignmentRow>(supabase.from("planning_assignments").select("*")),
      all<PublicationRow>(supabase.from("publications").select("*").order("created_at")),
      all<SourceReferenceRow>(supabase.from("source_references").select("*").order("created_at")),
      all<ObservationRow>(supabase.from("source_observations").select("*")),
      optionalTemplates(supabase),
    ]);

  const assignmentMap = new Map(assignments.map((a) => [a.content_piece_id, a]));
  const pubsByPiece = groupBy(publications, (p) => p.content_piece_id);
  const mirrorByPiece = new Map(
    references.filter((r) => r.relation_kind === "external_mirror" && r.content_piece_id).map((r) => [r.content_piece_id!, r]),
  );
  const latestByRef = new Map<string, ObservationRow>();
  for (const o of observations) {
    const prev = latestByRef.get(o.source_reference_id);
    if (!prev || compareObservation(o, prev) > 0) latestByRef.set(o.source_reference_id, o);
  }

  const facts: PieceFact[] = pieces.map((p) => {
    const mirror = mirrorByPiece.get(p.id);
    const obs = mirror ? latestByRef.get(mirror.id) : undefined;
    return {
      id: p.id,
      accountId: p.account_id,
      bucket: p.bucket,
      title: p.title,
      ownership: p.ownership,
      productionStatus: p.production_status,
      onHold: p.on_hold,
      archived: p.archived_at !== null,
      contentRevision: p.content_revision,
      approvedRevision: p.approved_revision,
      timing: { mode: p.timing_mode, fixedDate: p.fixed_date, validFrom: p.valid_from, validUntil: p.valid_until },
      assignedWeek: assignmentMap.get(p.id)?.week_start ?? null,
      publications: (pubsByPiece.get(p.id) ?? []).map((pub) => ({
        id: pub.id,
        channelId: pub.channel_id,
        status: pub.status,
        scheduledAt: pub.scheduled_at ? new Date(pub.scheduled_at) : null,
        publishedAt: pub.published_at ? new Date(pub.published_at) : null,
      })),
      latestObservation: obs
        ? {
            observedStatus: obs.observed_status,
            reviewCompleteConfirmed: obs.review_complete_confirmed,
            observedOnHold: obs.observed_on_hold,
            observedAt: new Date(obs.observed_at),
            sourceStateRaw: obs.source_state_raw,
          }
        : null,
    };
  });

  return {
    now,
    brands,
    accounts,
    channels,
    accountChannels,
    targetRows,
    targets: targetRows.map((t) => ({
      id: t.id,
      accountId: t.account_id,
      bucket: t.bucket,
      requiredCount: t.required_count,
      bufferTargetDays: t.buffer_target_days,
      activeFrom: t.active_from,
      activeUntil: t.active_until,
    })),
    pieces,
    assignments: assignmentMap,
    publications,
    references,
    observations,
    templates,
    facts,
    accountFacts: accounts.map((a) => ({
      id: a.id,
      brandId: a.brand_id,
      name: a.name,
      active: a.active,
      coverageMode: a.coverage_mode,
    })),
  };
}

/** Las plantillas son opcionales: si su migración aún no se aplicó, la app sigue sin ellas. */
async function optionalTemplates(supabase: SupabaseClient): Promise<TemplateRow[]> {
  const { data, error } = await supabase.from("piece_templates").select("*").order("category").order("name");
  if (error) {
    console.warn(`Plantillas no disponibles: ${error.message}`);
    return [];
  }
  return (data ?? []) as TemplateRow[];
}

function compareObservation(a: ObservationRow, b: ObservationRow): number {
  return a.observed_at.localeCompare(b.observed_at) || a.recorded_at.localeCompare(b.recorded_at) || a.id.localeCompare(b.id);
}

export function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
