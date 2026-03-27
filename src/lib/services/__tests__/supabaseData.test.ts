import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  fetchWorkouts,
  upsertWorkout,
  deleteWorkout,
  fetchExerciseProgress,
  upsertExerciseProgress,
  fetchWorkoutMeta,
  fetchSettings,
  upsertSettings,
} from "$lib/services/supabaseData";
import { makeWorkout, makeSettings } from "../../../test/fixtures";

beforeEach(() => {
  mockSb.__resetTableResults();
});

describe("fetchWorkouts", () => {
  it("queries workouts table ordered by date desc", async () => {
    mockSb.__setTableResult("workouts", {
      data: [
        {
          id: "w1",
          date: "2025-01-15",
          time: "08:00",
          workout_type: "A",
          activity: "Test",
          duration_min: 45,
          exercises: [],
          started_at: null,
          completed_at: null,
        },
      ],
      error: null,
    });

    const result = await fetchWorkouts();
    expect(mockSb.from).toHaveBeenCalledWith("workouts");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("w1");
    expect(result[0].type).toBe("workout");
    expect(result[0].synced).toBe(true);
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("workouts", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchWorkouts();
    expect(result).toEqual([]);
  });
});

describe("upsertWorkout", () => {
  it("upserts workout with mapped fields", async () => {
    mockSb.__setTableResult("workouts", { data: null, error: null });
    const workout = makeWorkout({ id: "w1", workoutType: "B" });
    const result = await upsertWorkout(workout);
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("workouts");
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("workouts", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertWorkout(makeWorkout());
    expect(result).toBe(false);
  });

  it("handles missing startedAt and completedAt", async () => {
    mockSb.__setTableResult("workouts", { data: null, error: null });
    const result = await upsertWorkout({
      id: "w1",
      date: "2025-01-15",
      time: "08:00",
      type: "workout",
      activity: "Test",
      workoutType: "A",
      duration_min: 30,
      exercises: [],
      synced: false,
      // No startedAt or completedAt
    } as any);
    expect(result).toBe(true);
  });
});

describe("deleteWorkout", () => {
  it("deletes by id", async () => {
    mockSb.__setTableResult("workouts", { data: null, error: null });
    const result = await deleteWorkout("w1");
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("workouts");
  });
});

describe("fetchExerciseProgress", () => {
  it("returns mapped exercise progress", async () => {
    mockSb.__setTableResult("exercise_progress", {
      data: [{ name: "Squat", weight_kg: "60", failure_count: 1 }],
      error: null,
    });
    const result = await fetchExerciseProgress();
    expect(result["Squat"]).toEqual({
      name: "Squat",
      weight_kg: 60,
      failureCount: 1,
    });
  });

  it("returns empty object on error", async () => {
    mockSb.__setTableResult("exercise_progress", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchExerciseProgress();
    expect(result).toEqual({});
  });
});

describe("upsertExerciseProgress", () => {
  it("maps and upserts progress rows", async () => {
    mockSb.__setTableResult("exercise_progress", { data: null, error: null });
    const result = await upsertExerciseProgress({
      Squat: { name: "Squat", weight_kg: 60, failureCount: 0 },
    });
    expect(result).toBe(true);
  });

  it("returns true for empty progress", async () => {
    const result = await upsertExerciseProgress({});
    expect(result).toBe(true);
  });
});

describe("fetchWorkoutMeta", () => {
  it("returns last workout type and date", async () => {
    mockSb.__setTableResult("workouts", {
      data: { workout_type: "A", date: "2025-01-15" },
      error: null,
    });
    const result = await fetchWorkoutMeta();
    expect(result).toEqual({
      lastWorkoutType: "A",
      lastWorkoutDate: "2025-01-15",
    });
  });

  it("returns nulls on error", async () => {
    mockSb.__setTableResult("workouts", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchWorkoutMeta();
    expect(result).toEqual({ lastWorkoutType: null, lastWorkoutDate: null });
  });
});

describe("fetchSettings", () => {
  it("maps settings from DB row", async () => {
    mockSb.__setTableResult("user_settings", {
      data: {
        rest_timer_seconds: 120,
        weight_unit: "kg",
        program: "stronglifts",
        sound_enabled: true,
        vibration_enabled: false,
        increments: { Squat: 2.5 },
      },
      error: null,
    });
    const result = await fetchSettings();
    expect(result).toEqual({
      restTimerSeconds: 120,
      weightUnit: "kg",
      program: "stronglifts",
      soundEnabled: true,
      vibrationEnabled: false,
      increments: { Squat: 2.5 },
    });
  });

  it("maps workout_schedule when present", async () => {
    mockSb.__setTableResult("user_settings", {
      data: {
        rest_timer_seconds: 90,
        weight_unit: "kg",
        program: "stronglifts",
        sound_enabled: true,
        vibration_enabled: true,
        increments: {},
        workout_schedule: {
          frequencyDays: 2,
          extraRestDays: 1,
          consecutiveForExtraRest: 3,
        },
      },
      error: null,
    });
    const result = await fetchSettings();
    expect(result).toEqual({
      restTimerSeconds: 90,
      weightUnit: "kg",
      program: "stronglifts",
      soundEnabled: true,
      vibrationEnabled: true,
      increments: {},
      workoutSchedule: {
        frequencyDays: 2,
        extraRestDays: 1,
        consecutiveForExtraRest: 3,
      },
    });
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("user_settings", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchSettings();
    expect(result).toBeNull();
  });
});

describe("upsertSettings", () => {
  it("maps and upserts settings", async () => {
    mockSb.__setTableResult("user_settings", { data: null, error: null });
    const result = await upsertSettings(makeSettings());
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("user_settings");
  });
});

describe("null-data coalesce and missing error branches", () => {
  it("fetchWorkouts returns [] when data is null (no error)", async () => {
    mockSb.__setTableResult("workouts", { data: null, error: null });
    const result = await fetchWorkouts();
    expect(result).toEqual([]);
  });

  it("deleteWorkout returns false on error", async () => {
    mockSb.__setTableResult("workouts", {
      data: null,
      error: { message: "err" },
    });
    const result = await deleteWorkout("w1");
    expect(result).toBe(false);
  });

  it("fetchExerciseProgress returns {} when data is null (no error)", async () => {
    mockSb.__setTableResult("exercise_progress", { data: null, error: null });
    const result = await fetchExerciseProgress();
    expect(result).toEqual({});
  });

  it("upsertExerciseProgress returns false on error", async () => {
    mockSb.__setTableResult("exercise_progress", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertExerciseProgress({
      Squat: { name: "Squat", weight_kg: 60, failureCount: 0 },
    });
    expect(result).toBe(false);
  });

  it("upsertSettings returns false on error", async () => {
    mockSb.__setTableResult("user_settings", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertSettings(makeSettings());
    expect(result).toBe(false);
  });
});

describe("with null supabase", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
  });

  it("fetchWorkouts returns []", async () => {
    const { fetchWorkouts } = await import("$lib/services/supabaseData");
    expect(await fetchWorkouts()).toEqual([]);
  });

  it("upsertWorkout returns false", async () => {
    const { upsertWorkout } = await import("$lib/services/supabaseData");
    expect(await upsertWorkout({} as any)).toBe(false);
  });

  it("deleteWorkout returns false", async () => {
    const { deleteWorkout } = await import("$lib/services/supabaseData");
    expect(await deleteWorkout("x")).toBe(false);
  });

  it("fetchExerciseProgress returns {}", async () => {
    const { fetchExerciseProgress } =
      await import("$lib/services/supabaseData");
    expect(await fetchExerciseProgress()).toEqual({});
  });

  it("upsertExerciseProgress returns false", async () => {
    const { upsertExerciseProgress } =
      await import("$lib/services/supabaseData");
    expect(await upsertExerciseProgress({})).toBe(false);
  });

  it("fetchWorkoutMeta returns nulls", async () => {
    const { fetchWorkoutMeta } = await import("$lib/services/supabaseData");
    expect(await fetchWorkoutMeta()).toEqual({
      lastWorkoutType: null,
      lastWorkoutDate: null,
    });
  });

  it("fetchSettings returns null", async () => {
    const { fetchSettings } = await import("$lib/services/supabaseData");
    expect(await fetchSettings()).toBeNull();
  });

  it("upsertSettings returns false", async () => {
    const { upsertSettings } = await import("$lib/services/supabaseData");
    expect(await upsertSettings({} as any)).toBe(false);
  });
});
