import { supabase } from "$lib/supabase";
import type {
  BiomarkerDefinition,
  BiomarkerMeasurement,
  BiomarkerUserTarget,
} from "$lib/types";

// ── Biomarker Definitions ──

export async function fetchBiomarkerDefinitions(): Promise<
  BiomarkerDefinition[]
> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("biomarker_definitions")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) {
    console.error("fetchBiomarkerDefinitions:", error);
    return [];
  }
  return (data ?? []).map(rowToDefinition);
}

// ── Biomarker Measurements ──

export async function fetchBiomarkerMeasurements(
  biomarkerId?: string,
  limit?: number,
): Promise<BiomarkerMeasurement[]> {
  if (!supabase) return [];
  let query = supabase
    .from("biomarker_measurements")
    .select("*")
    .order("date", { ascending: false });

  if (biomarkerId) {
    query = query.eq("biomarker_id", biomarkerId);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchBiomarkerMeasurements:", error);
    return [];
  }
  return (data ?? []).map(rowToMeasurement);
}

export async function fetchLatestMeasurements(): Promise<
  Map<string, BiomarkerMeasurement>
> {
  if (!supabase) return new Map();

  // Get the most recent measurement for each biomarker
  const { data, error } = await supabase
    .from("biomarker_measurements")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("fetchLatestMeasurements:", error);
    return new Map();
  }

  const latestMap = new Map<string, BiomarkerMeasurement>();
  for (const row of data ?? []) {
    const m = rowToMeasurement(row);
    if (!latestMap.has(m.biomarkerId)) {
      latestMap.set(m.biomarkerId, m);
    }
  }
  return latestMap;
}

export async function upsertMeasurement(
  m: Omit<BiomarkerMeasurement, "id" | "createdAt" | "updatedAt">,
): Promise<BiomarkerMeasurement | null> {
  if (!supabase) return null;

  const row = {
    biomarker_id: m.biomarkerId,
    date: m.date,
    value: m.value,
    unit: m.unit,
    notes: m.notes ?? null,
    lab_name: m.labName ?? null,
  };

  const { data, error } = await supabase
    .from("biomarker_measurements")
    .upsert(row, { onConflict: "user_id,biomarker_id,date" })
    .select()
    .single();

  if (error) {
    console.error("upsertMeasurement:", error);
    return null;
  }
  return rowToMeasurement(data);
}

export async function deleteMeasurement(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("biomarker_measurements")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("deleteMeasurement:", error);
    return false;
  }
  return true;
}

// ── User Targets ──

export async function fetchUserTargets(): Promise<
  Map<string, BiomarkerUserTarget>
> {
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("biomarker_user_targets")
    .select("*");
  if (error) {
    console.error("fetchUserTargets:", error);
    return new Map();
  }
  const map = new Map<string, BiomarkerUserTarget>();
  for (const row of data ?? []) {
    const t = rowToUserTarget(row);
    map.set(t.biomarkerId, t);
  }
  return map;
}

export async function upsertUserTarget(
  t: Omit<BiomarkerUserTarget, "id">,
): Promise<boolean> {
  if (!supabase) return false;
  const row = {
    biomarker_id: t.biomarkerId,
    optimal_min: t.optimalMin ?? null,
    optimal_max: t.optimalMax ?? null,
    target_value: t.targetValue ?? null,
    notes: t.notes ?? null,
  };
  const { error } = await supabase
    .from("biomarker_user_targets")
    .upsert(row, { onConflict: "user_id,biomarker_id" });
  if (error) {
    console.error("upsertUserTarget:", error);
    return false;
  }
  return true;
}

// ── Row Mappers ──

function rowToDefinition(row: Record<string, unknown>): BiomarkerDefinition {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as BiomarkerDefinition["category"],
    unit: row.unit as string,
    unitAlt: row.unit_alt as string | null,
    optimalMin: row.optimal_min as number | null,
    optimalMax: row.optimal_max as number | null,
    warningMin: row.warning_min as number | null,
    warningMax: row.warning_max as number | null,
    testFrequencyDays: (row.test_frequency_days as number) ?? 365,
    description: row.description as string | null,
    displayOrder: (row.display_order as number) ?? 0,
  };
}

function rowToMeasurement(row: Record<string, unknown>): BiomarkerMeasurement {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    biomarkerId: row.biomarker_id as string,
    date: row.date as string,
    value: Number(row.value),
    unit: row.unit as string,
    notes: row.notes as string | null,
    labName: row.lab_name as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToUserTarget(row: Record<string, unknown>): BiomarkerUserTarget {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    biomarkerId: row.biomarker_id as string,
    optimalMin: row.optimal_min as number | null,
    optimalMax: row.optimal_max as number | null,
    targetValue: row.target_value as number | null,
    notes: row.notes as string | null,
  };
}
