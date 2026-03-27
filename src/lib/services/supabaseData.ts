import { supabase } from "$lib/supabase";
import type {
  Workout,
  ExerciseProgress,
  Settings,
  WorkoutSchedule,
} from "$lib/types";

// ── Workouts ──

export async function fetchWorkouts(): Promise<Workout[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    console.error("fetchWorkouts:", error);
    return [];
  }
  return (data ?? []).map(rowToWorkout);
}

export async function upsertWorkout(workout: Workout): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("workouts")
    .upsert(workoutToRow(workout));
  if (error) {
    console.error("upsertWorkout:", error);
    return false;
  }
  return true;
}

export async function deleteWorkout(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) {
    console.error("deleteWorkout:", error);
    return false;
  }
  return true;
}

// ── Exercise Progress ──

export async function fetchExerciseProgress(): Promise<
  Record<string, ExerciseProgress>
> {
  if (!supabase) return {};
  const { data, error } = await supabase.from("exercise_progress").select("*");
  if (error) {
    console.error("fetchExerciseProgress:", error);
    return {};
  }
  const map: Record<string, ExerciseProgress> = {};
  for (const row of data ?? []) {
    map[row.name] = {
      name: row.name,
      weight_kg: Number(row.weight_kg),
      failureCount: row.failure_count,
    };
  }
  return map;
}

export async function upsertExerciseProgress(
  progress: Record<string, ExerciseProgress>,
): Promise<boolean> {
  if (!supabase) return false;
  const rows = Object.values(progress).map((p) => ({
    name: p.name,
    weight_kg: p.weight_kg,
    failure_count: p.failureCount,
  }));
  if (rows.length === 0) return true;
  const { error } = await supabase.from("exercise_progress").upsert(rows);
  if (error) {
    console.error("upsertExerciseProgress:", error);
    return false;
  }
  return true;
}

// ── Workout Meta (derived from workouts table) ──

export async function fetchWorkoutMeta(): Promise<{
  lastWorkoutType: string | null;
  lastWorkoutDate: string | null;
}> {
  if (!supabase) return { lastWorkoutType: null, lastWorkoutDate: null };
  const { data, error } = await supabase
    .from("workouts")
    .select("workout_type, date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return { lastWorkoutType: null, lastWorkoutDate: null };
  return { lastWorkoutType: data.workout_type, lastWorkoutDate: data.date };
}

// ── Settings ──

export async function fetchSettings(): Promise<Partial<Settings> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return {
    restTimerSeconds: data.rest_timer_seconds,
    weightUnit: data.weight_unit,
    program: data.program,
    soundEnabled: data.sound_enabled,
    vibrationEnabled: data.vibration_enabled,
    increments: data.increments,
    ...(data.workout_schedule
      ? { workoutSchedule: data.workout_schedule as WorkoutSchedule }
      : {}),
    ...(data.plateau_exercises
      ? { plateauExercises: data.plateau_exercises as string[] }
      : {}),
    ...(data.moving_average_window != null
      ? { movingAverageWindow: data.moving_average_window as number }
      : {}),
  };
}

export async function upsertSettings(s: Settings): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("user_settings").upsert({
    rest_timer_seconds: s.restTimerSeconds,
    weight_unit: s.weightUnit,
    program: s.program,
    sound_enabled: s.soundEnabled,
    vibration_enabled: s.vibrationEnabled,
    increments: s.increments,
    workout_schedule: s.workoutSchedule,
    plateau_exercises: s.plateauExercises ?? [],
    moving_average_window: s.movingAverageWindow ?? 7,
  });
  if (error) {
    console.error("upsertSettings:", error);
    return false;
  }
  return true;
}

// ── Row mappers ──

function rowToWorkout(row: Record<string, unknown>): Workout {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    type: "workout",
    activity: row.activity as string,
    workoutType: row.workout_type as Workout["workoutType"],
    duration_min: row.duration_min as number,
    exercises: row.exercises as Workout["exercises"],
    synced: true,
    startedAt: row.started_at as string | undefined,
    completedAt: row.completed_at as string | undefined,
  };
}

function workoutToRow(w: Workout) {
  return {
    id: w.id,
    date: w.date,
    time: w.time,
    workout_type: w.workoutType,
    activity: w.activity,
    duration_min: w.duration_min,
    exercises: w.exercises,
    started_at: w.startedAt ?? null,
    completed_at: w.completedAt ?? null,
  };
}
