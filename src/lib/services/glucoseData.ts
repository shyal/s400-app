import { supabase } from "$lib/supabase";
import type {
  GlucoseReading,
  GlucoseUnit,
  GlucoseModelParams,
  GlucoseReadingType,
} from "$lib/types";

const MMOL_TO_MG = 18.018;

export function toMgDl(value: number, unit: GlucoseUnit): number {
  return unit === "mg/dL" ? value : Math.round(value * MMOL_TO_MG * 10) / 10;
}

export function toMmolL(value: number, unit: GlucoseUnit): number {
  return unit === "mmol/L" ? value : Math.round((value / MMOL_TO_MG) * 10) / 10;
}

export async function fetchGlucoseReadings(
  date: string,
): Promise<GlucoseReading[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("glucose_readings")
    .select("*")
    .eq("date", date)
    .order("time", { ascending: true });
  if (error) {
    console.error("fetchGlucoseReadings:", error);
    return [];
  }
  return (data ?? []).map(rowToReading);
}

export async function addGlucoseReading(
  reading: Omit<GlucoseReading, "id">,
): Promise<GlucoseReading | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("glucose_readings")
    .insert(readingToRow(reading))
    .select()
    .single();
  if (error) {
    console.error("addGlucoseReading:", error);
    return null;
  }
  return rowToReading(data);
}

export async function deleteGlucoseReading(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("glucose_readings")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("deleteGlucoseReading:", error);
    return false;
  }
  return true;
}

export async function decrementMatchingStrips(
  meterMaker: string | null,
): Promise<boolean> {
  if (!supabase || !meterMaker) return false;
  const { data, error } = await supabase
    .from("test_equipment")
    .select("*")
    .eq("type", "glucose_strips")
    .eq("maker", meterMaker)
    .order("created_at", { ascending: true });
  if (error || !data || data.length === 0) return false;

  const strip = data[0];
  if (strip.quantity <= 0) return false;

  const { error: updateError } = await supabase
    .from("test_equipment")
    .update({
      quantity: strip.quantity - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", strip.id);
  if (updateError) {
    console.error("decrementMatchingStrips:", updateError);
    return false;
  }
  return true;
}

// ── Range Fetch ──

export async function fetchGlucoseReadingsRange(
  startDate: string,
  endDate: string,
): Promise<GlucoseReading[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("glucose_readings")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (error) {
    console.error("fetchGlucoseReadingsRange:", error);
    return [];
  }
  return (data ?? []).map(rowToReading);
}

// ── Model Params ──

export async function fetchGlucoseModelParams(): Promise<GlucoseModelParams | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("glucose_model_params")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("fetchGlucoseModelParams:", error);
    return null;
  }
  if (!data) return null;
  return rowToModelParams(data);
}

export async function upsertGlucoseModelParams(
  params: GlucoseModelParams,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("glucose_model_params")
    .upsert(modelParamsToRow(params));
  if (error) {
    console.error("upsertGlucoseModelParams:", error);
    return false;
  }
  return true;
}

// ── Row Mappers ──

function rowToReading(row: Record<string, unknown>): GlucoseReading {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    value: Number(row.value),
    unit: (row.unit as GlucoseUnit) ?? "mmol/L",
    equipment_id: (row.equipment_id as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    reading_type: (row.reading_type as GlucoseReadingType) ?? "random",
  };
}

function readingToRow(
  reading: Omit<GlucoseReading, "id">,
): Record<string, unknown> {
  return {
    date: reading.date,
    time: reading.time,
    value: reading.value,
    unit: reading.unit,
    equipment_id: reading.equipment_id ?? null,
    notes: reading.notes ?? null,
    reading_type: reading.reading_type ?? "random",
  };
}

function rowToModelParams(row: Record<string, unknown>): GlucoseModelParams {
  return {
    fasting_baseline_mgdl: Number(row.fasting_baseline_mgdl),
    carb_sensitivity: Number(row.carb_sensitivity),
    protein_sensitivity: Number(row.protein_sensitivity),
    fat_delay_factor: Number(row.fat_delay_factor),
    exercise_reduction_pct: Number(row.exercise_reduction_pct),
    gym_sensitivity_hours: Number(row.gym_sensitivity_hours),
    gym_sensitivity_pct: Number(row.gym_sensitivity_pct),
    circadian_evening_pct: Number(row.circadian_evening_pct),
    dawn_phenomenon_mgdl: Number(row.dawn_phenomenon_mgdl),
    peak_time_min: Number(row.peak_time_min),
    curve_shape_k: Number(row.curve_shape_k),
    data_points_used: Number(row.data_points_used),
    last_fit_at: (row.last_fit_at as string | null) ?? null,
  };
}

function modelParamsToRow(params: GlucoseModelParams): Record<string, unknown> {
  return {
    fasting_baseline_mgdl: params.fasting_baseline_mgdl,
    carb_sensitivity: params.carb_sensitivity,
    protein_sensitivity: params.protein_sensitivity,
    fat_delay_factor: params.fat_delay_factor,
    exercise_reduction_pct: params.exercise_reduction_pct,
    gym_sensitivity_hours: params.gym_sensitivity_hours,
    gym_sensitivity_pct: params.gym_sensitivity_pct,
    circadian_evening_pct: params.circadian_evening_pct,
    dawn_phenomenon_mgdl: params.dawn_phenomenon_mgdl,
    peak_time_min: params.peak_time_min,
    curve_shape_k: params.curve_shape_k,
    data_points_used: params.data_points_used,
    last_fit_at: params.last_fit_at,
    updated_at: new Date().toISOString(),
  };
}
