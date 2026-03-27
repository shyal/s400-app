import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpsertWorkout } = vi.hoisted(() => ({
  mockUpsertWorkout: vi.fn(),
}));

vi.mock("$lib/services/supabaseData", () => ({
  upsertWorkout: mockUpsertWorkout,
}));

vi.mock("$lib/supabase", () => ({
  supabase: {}, // truthy so sync proceeds
}));

import {
  syncPendingWorkouts,
  formatForFoodLog,
  generateSyncCommand,
} from "$lib/utils/sync";
import { makeWorkout, makeExercise, makeSet } from "../../../test/fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockUpsertWorkout.mockResolvedValue(true);
});

describe("syncPendingWorkouts", () => {
  it("returns 0 when no pending", async () => {
    expect(await syncPendingWorkouts()).toBe(0);
  });

  it("returns 0 for empty array", async () => {
    localStorage.setItem("stronglifts-pending", "[]");
    expect(await syncPendingWorkouts()).toBe(0);
  });

  it("returns 0 for invalid JSON", async () => {
    localStorage.setItem("stronglifts-pending", "not json");
    expect(await syncPendingWorkouts()).toBe(0);
  });

  it("syncs all pending workouts and removes key", async () => {
    const workouts = [makeWorkout({ id: "w1" }), makeWorkout({ id: "w2" })];
    localStorage.setItem("stronglifts-pending", JSON.stringify(workouts));

    const result = await syncPendingWorkouts();
    expect(result).toBe(2);
    expect(mockUpsertWorkout).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("stronglifts-pending")).toBeNull();
  });

  it("keeps failed workouts in pending", async () => {
    mockUpsertWorkout.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const workouts = [makeWorkout({ id: "w1" }), makeWorkout({ id: "w2" })];
    localStorage.setItem("stronglifts-pending", JSON.stringify(workouts));

    const result = await syncPendingWorkouts();
    expect(result).toBe(1);

    const remaining = JSON.parse(localStorage.getItem("stronglifts-pending")!);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("w2");
  });
});

describe("generateSyncCommand", () => {
  it("returns the sync command string", () => {
    expect(generateSyncCommand()).toBe("python src/sync_workouts.py");
  });
});

describe("SSR environment", () => {
  it("returns 0 when localStorage is undefined", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: {} }));
    vi.doMock("$lib/services/supabaseData", () => ({ upsertWorkout: vi.fn() }));
    const { syncPendingWorkouts } = await import("$lib/utils/sync");
    expect(await syncPendingWorkouts()).toBe(0);

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });

  it("returns 0 when supabase is null", async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
    vi.doMock("$lib/services/supabaseData", () => ({ upsertWorkout: vi.fn() }));
    const { syncPendingWorkouts } = await import("$lib/utils/sync");
    expect(await syncPendingWorkouts()).toBe(0);
  });
});

describe("formatForFoodLog", () => {
  it("formats workout for food log", () => {
    const workout = makeWorkout({
      date: "2025-01-15",
      time: "08:00",
      activity: "StrongLifts Workout A",
      duration_min: 45,
      exercises: [
        makeExercise({
          name: "Squat",
          targetWeight_kg: 60,
          sets: [
            makeSet({ completed: true, reps: 5 }),
            makeSet({ completed: true, reps: 5 }),
            makeSet({ completed: false, reps: 3 }),
          ],
        }),
      ],
    });

    const result = formatForFoodLog(workout);
    expect(result.date).toBe("2025-01-15");
    expect(result.type).toBe("workout");
    expect(result.activity).toBe("StrongLifts Workout A");
    expect(result.duration_min).toBe(45);
    expect(result.sets_completed).toBe("2/3");
    expect(result.exercises).toHaveLength(1);
    expect((result.exercises as any[])[0].name).toBe("Squat");
  });

  it("counts sets across multiple exercises", () => {
    const workout = makeWorkout({
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ completed: true }), makeSet({ completed: true })],
        }),
        makeExercise({
          name: "Bench",
          sets: [makeSet({ completed: true }), makeSet({ completed: false })],
        }),
      ],
    });

    const result = formatForFoodLog(workout);
    expect(result.sets_completed).toBe("3/4");
  });
});
