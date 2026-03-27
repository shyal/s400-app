import {
  fetchWorkouts,
  upsertWorkout,
  upsertExerciseProgress,
  upsertSettings,
} from "./supabaseData";
import type { WorkoutHistory, Settings } from "$lib/types";

const MIGRATED_KEY = "stronglifts-migrated";

export async function migrateLocalToSupabase(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  // Only migrate if Supabase has no workouts yet
  const existing = await fetchWorkouts();
  if (existing.length > 0) {
    localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }

  // Migrate history
  const historyRaw = localStorage.getItem("stronglifts-history");
  if (historyRaw) {
    try {
      const history: WorkoutHistory = JSON.parse(historyRaw);
      for (const workout of history.workouts) {
        await upsertWorkout(workout);
      }
      if (Object.keys(history.exerciseProgress).length > 0) {
        await upsertExerciseProgress(history.exerciseProgress);
      }
    } catch (e) {
      console.error("Migration error (history):", e);
    }
  }

  // Migrate settings
  const settingsRaw = localStorage.getItem("stronglifts-settings");
  if (settingsRaw) {
    try {
      const settings: Settings = JSON.parse(settingsRaw);
      await upsertSettings(settings);
    } catch (e) {
      console.error("Migration error (settings):", e);
    }
  }

  // Migrate pending
  const pendingRaw = localStorage.getItem("stronglifts-pending");
  if (pendingRaw) {
    try {
      const pending = JSON.parse(pendingRaw);
      for (const workout of pending) {
        await upsertWorkout(workout);
      }
      localStorage.removeItem("stronglifts-pending");
    } catch (e) {
      console.error("Migration error (pending):", e);
    }
  }

  localStorage.setItem(MIGRATED_KEY, "true");
}
