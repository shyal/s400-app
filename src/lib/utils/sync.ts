import type { Workout } from "$lib/types";
import { upsertWorkout } from "$lib/services/supabaseData";

const PENDING_KEY = "stronglifts-pending";

export async function syncPendingWorkouts(): Promise<number> {
  if (typeof localStorage === "undefined") return 0;

  const stored = localStorage.getItem(PENDING_KEY);
  if (!stored) return 0;

  let pending: Workout[];
  try {
    pending = JSON.parse(stored);
  } catch {
    return 0;
  }

  if (pending.length === 0) return 0;

  const failed: Workout[] = [];
  let synced = 0;

  for (const workout of pending) {
    const ok = await upsertWorkout(workout);
    if (ok) {
      synced++;
    } else {
      failed.push(workout);
    }
  }

  if (failed.length > 0) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(failed));
  } else {
    localStorage.removeItem(PENDING_KEY);
  }

  return synced;
}

export function formatForFoodLog(workout: Workout): Record<string, unknown> {
  const totalSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0,
  );
  const completedSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
    0,
  );

  return {
    date: workout.date,
    time: workout.time,
    type: "workout",
    activity: workout.activity,
    duration_min: workout.duration_min,
    sets_completed: `${completedSets}/${totalSets}`,
    exercises: workout.exercises.map((ex) => ({
      name: ex.name,
      weight_kg: ex.targetWeight_kg,
      sets: ex.sets.length,
      reps: ex.sets.map((s) => s.reps).join("/"),
    })),
  };
}

export function generateSyncCommand(): string {
  return "python src/sync_workouts.py";
}
