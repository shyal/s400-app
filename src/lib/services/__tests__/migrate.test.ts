import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFetchWorkouts,
  mockUpsertWorkout,
  mockUpsertExerciseProgress,
  mockUpsertSettings,
} = vi.hoisted(() => ({
  mockFetchWorkouts: vi.fn(),
  mockUpsertWorkout: vi.fn(),
  mockUpsertExerciseProgress: vi.fn(),
  mockUpsertSettings: vi.fn(),
}));

vi.mock("$lib/services/supabaseData", () => ({
  fetchWorkouts: mockFetchWorkouts,
  upsertWorkout: mockUpsertWorkout,
  upsertExerciseProgress: mockUpsertExerciseProgress,
  upsertSettings: mockUpsertSettings,
}));

import { migrateLocalToSupabase } from "$lib/services/migrate";
import { makeWorkout, makeSettings } from "../../../test/fixtures";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockFetchWorkouts.mockResolvedValue([]);
  mockUpsertWorkout.mockResolvedValue(true);
  mockUpsertExerciseProgress.mockResolvedValue(true);
  mockUpsertSettings.mockResolvedValue(true);
});

describe("migrateLocalToSupabase", () => {
  it("skips if already migrated", async () => {
    localStorage.setItem("stronglifts-migrated", "true");
    await migrateLocalToSupabase();
    expect(mockFetchWorkouts).not.toHaveBeenCalled();
  });

  it("skips if Supabase already has workouts", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([makeWorkout()]);
    await migrateLocalToSupabase();
    expect(mockUpsertWorkout).not.toHaveBeenCalled();
    expect(localStorage.getItem("stronglifts-migrated")).toBe("true");
  });

  it("migrates history from localStorage", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    const workout = makeWorkout();
    localStorage.setItem(
      "stronglifts-history",
      JSON.stringify({
        workouts: [workout],
        exerciseProgress: {
          Squat: { name: "Squat", weight_kg: 60, failureCount: 0 },
        },
        lastWorkoutType: "A",
        lastWorkoutDate: "2025-01-15",
      }),
    );

    await migrateLocalToSupabase();

    expect(mockUpsertWorkout).toHaveBeenCalledTimes(1);
    expect(mockUpsertExerciseProgress).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("stronglifts-migrated")).toBe("true");
  });

  it("migrates settings from localStorage", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    localStorage.setItem(
      "stronglifts-settings",
      JSON.stringify(makeSettings()),
    );

    await migrateLocalToSupabase();

    expect(mockUpsertSettings).toHaveBeenCalledTimes(1);
  });

  it("migrates pending workouts and removes from localStorage", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    const pending = [makeWorkout(), makeWorkout()];
    localStorage.setItem("stronglifts-pending", JSON.stringify(pending));

    await migrateLocalToSupabase();

    expect(mockUpsertWorkout).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("stronglifts-pending")).toBeNull();
  });

  it("handles settings migration error gracefully", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    mockUpsertSettings.mockRejectedValueOnce(new Error("settings fail"));
    localStorage.setItem(
      "stronglifts-settings",
      JSON.stringify({
        restTimerSeconds: 90,
        weightUnit: "kg",
        program: "stronglifts",
        soundEnabled: true,
        vibrationEnabled: true,
        increments: {},
      }),
    );

    await expect(migrateLocalToSupabase()).resolves.not.toThrow();
    expect(localStorage.getItem("stronglifts-migrated")).toBe("true");
  });

  it("handles pending migration error gracefully", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    mockUpsertWorkout.mockRejectedValueOnce(new Error("pending fail"));
    localStorage.setItem(
      "stronglifts-pending",
      JSON.stringify([{ id: "w1", date: "2025-01-15", exercises: [] }]),
    );

    await expect(migrateLocalToSupabase()).resolves.not.toThrow();
    expect(localStorage.getItem("stronglifts-migrated")).toBe("true");
  });

  it("handles invalid history JSON gracefully", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    localStorage.setItem("stronglifts-history", "not json");

    await expect(migrateLocalToSupabase()).resolves.not.toThrow();
    expect(localStorage.getItem("stronglifts-migrated")).toBe("true");
  });

  it("returns early when localStorage is undefined", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/services/supabaseData", () => ({
      fetchWorkouts: vi.fn(),
      upsertWorkout: vi.fn(),
      upsertExerciseProgress: vi.fn(),
      upsertSettings: vi.fn(),
    }));
    const { migrateLocalToSupabase } = await import("$lib/services/migrate");
    await migrateLocalToSupabase();

    const { fetchWorkouts } = await import("$lib/services/supabaseData");
    expect(fetchWorkouts).not.toHaveBeenCalled();

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });

  it("handles upsert errors gracefully", async () => {
    mockFetchWorkouts.mockResolvedValueOnce([]);
    mockUpsertWorkout.mockRejectedValueOnce(new Error("fail"));
    localStorage.setItem(
      "stronglifts-history",
      JSON.stringify({
        workouts: [makeWorkout()],
        exerciseProgress: {},
        lastWorkoutType: null,
        lastWorkoutDate: null,
      }),
    );

    // Should not throw, sets migrated flag
    await expect(migrateLocalToSupabase()).resolves.not.toThrow();
  });
});
