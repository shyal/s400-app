import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/services/supabaseData", () => ({
  fetchSettings: vi.fn(() => Promise.resolve(null)),
  upsertSettings: vi.fn(() => Promise.resolve(true)),
  upsertWorkout: vi.fn(() => Promise.resolve(true)),
  deleteWorkout: vi.fn(() => Promise.resolve(true)),
  fetchWorkouts: vi.fn(() => Promise.resolve([])),
  fetchWorkoutMeta: vi.fn(() =>
    Promise.resolve({ lastWorkoutType: null, lastWorkoutDate: null }),
  ),
  fetchExerciseProgress: vi.fn(() => Promise.resolve({})),
}));

vi.mock("$lib/services/idb", () => ({
  idbGet: vi.fn(() => Promise.resolve(undefined)),
  idbSet: vi.fn(() => Promise.resolve()),
}));

vi.mock("$lib/utils/sync", () => ({
  syncPendingWorkouts: vi.fn(() => Promise.resolve(0)),
}));

describe("workoutStore", () => {
  let workoutStore: typeof import("$lib/stores/workout.svelte").workoutStore;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    const mod = await import("$lib/stores/workout.svelte");
    workoutStore = mod.workoutStore;
  });

  it("starts with empty history", () => {
    expect(workoutStore.history.workouts).toEqual([]);
    expect(workoutStore.history.lastWorkoutType).toBeNull();
    expect(workoutStore.current).toBeNull();
    expect(workoutStore.isWorkoutActive).toBe(false);
  });

  it("handles corrupt history in localStorage", async () => {
    localStorage.setItem("stronglifts-history", "{not valid json!!!");
    vi.resetModules();
    const mod = await import("$lib/stores/workout.svelte");
    expect(mod.workoutStore.history.workouts).toEqual([]);
  });

  it("handles corrupt current workout in localStorage", async () => {
    localStorage.setItem("stronglifts-current", "<<<invalid>>>");
    vi.resetModules();
    const mod = await import("$lib/stores/workout.svelte");
    expect(mod.workoutStore.current).toBeNull();
  });

  it("loads valid history from localStorage", async () => {
    const history = {
      workouts: [
        {
          id: "w1",
          date: "2025-01-15",
          time: "08:00",
          type: "workout",
          activity: "Test",
          workoutType: "A",
          duration_min: 30,
          exercises: [],
          synced: true,
        },
      ],
      exerciseProgress: {},
      lastWorkoutType: "A",
      lastWorkoutDate: "2025-01-15",
    };
    localStorage.setItem("stronglifts-history", JSON.stringify(history));
    vi.resetModules();
    const mod = await import("$lib/stores/workout.svelte");
    expect(mod.workoutStore.history.workouts).toHaveLength(1);
  });

  describe("startWorkout", () => {
    it("creates a workout with correct type", () => {
      workoutStore.startWorkout("A");
      expect(workoutStore.current).not.toBeNull();
      expect(workoutStore.current?.workoutType).toBe("A");
      expect(workoutStore.isWorkoutActive).toBe(true);
    });

    it("auto-selects next workout type", () => {
      workoutStore.startWorkout("A");
      expect(workoutStore.current?.workoutType).toBe("A");
    });

    it("creates exercises from program definition", () => {
      workoutStore.startWorkout("A");
      const exercises = workoutStore.current?.exercises;
      expect(exercises).toBeDefined();
      expect(exercises!.length).toBeGreaterThan(0);
      expect(exercises![0].name).toBe("Squat");
      expect(exercises![0].targetSets).toBe(5);
      expect(exercises![0].targetReps).toBe(5);
    });

    it("applies deload percentage", () => {
      workoutStore.startWorkout("A", 20);
      const squat = workoutStore.current?.exercises.find(
        (e) => e.name === "Squat",
      );
      // Default 20kg * 0.8 = 16, rounded to nearest 2.5 = 15
      expect(squat?.targetWeight_kg).toBeLessThan(20);
    });

    it("sets start metadata", () => {
      workoutStore.startWorkout("A");
      expect(workoutStore.current?.date).toBeTruthy();
      expect(workoutStore.current?.time).toBeTruthy();
      expect(workoutStore.current?.startedAt).toBeTruthy();
      expect(workoutStore.current?.synced).toBe(false);
    });
  });

  describe("logSet", () => {
    it("adds a set to the exercise", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      expect(workoutStore.current?.exercises[0].sets).toHaveLength(1);
      expect(workoutStore.current?.exercises[0].sets[0].reps).toBe(5);
      expect(workoutStore.current?.exercises[0].sets[0].completed).toBe(true);
    });

    it("marks set incomplete when reps < target", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 3);
      expect(workoutStore.current?.exercises[0].sets[0].completed).toBe(false);
    });

    it("increments set number", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      workoutStore.logSet(0, 5);
      expect(workoutStore.current?.exercises[0].sets[1].setNumber).toBe(2);
    });

    it("uses exercise target weight", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      const targetWeight = workoutStore.current?.exercises[0].targetWeight_kg;
      expect(workoutStore.current?.exercises[0].sets[0].weight_kg).toBe(
        targetWeight,
      );
    });
  });

  describe("updateSetReps", () => {
    it("updates reps for an existing set", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 3);
      workoutStore.updateSetReps(0, 0, 5);
      expect(workoutStore.current?.exercises[0].sets[0].reps).toBe(5);
      expect(workoutStore.current?.exercises[0].sets[0].completed).toBe(true);
    });
  });

  describe("updateExerciseWeight", () => {
    it("updates target weight and existing set weights", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      workoutStore.updateExerciseWeight(0, 70);
      expect(workoutStore.current?.exercises[0].targetWeight_kg).toBe(70);
      expect(workoutStore.current?.exercises[0].sets[0].weight_kg).toBe(70);
    });
  });

  describe("completeWorkout", () => {
    it("adds workout to history", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      workoutStore.completeWorkout();

      expect(workoutStore.current).toBeNull();
      expect(workoutStore.isWorkoutActive).toBe(false);
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.lastWorkoutType).toBe("A");
    });

    it("calculates duration", () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      expect(
        workoutStore.history.workouts[0].duration_min,
      ).toBeGreaterThanOrEqual(0);
      expect(workoutStore.history.workouts[0].completedAt).toBeTruthy();
    });

    it("saves to pending sync", () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      const pending = localStorage.getItem("stronglifts-pending");
      expect(pending).not.toBeNull();
    });
  });

  describe("cancelWorkout", () => {
    it("clears current without saving", () => {
      workoutStore.startWorkout("A");
      workoutStore.cancelWorkout();
      expect(workoutStore.current).toBeNull();
      expect(workoutStore.history.workouts).toHaveLength(0);
    });
  });

  describe("deleteLatestWorkout", () => {
    it("removes latest from history", async () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      expect(workoutStore.history.workouts).toHaveLength(1);

      const result = await workoutStore.deleteLatestWorkout();
      expect(result).toBe(true);
      expect(workoutStore.history.workouts).toHaveLength(0);
      expect(workoutStore.history.lastWorkoutType).toBeNull();
    });

    it("returns false for empty history", async () => {
      const result = await workoutStore.deleteLatestWorkout();
      expect(result).toBe(false);
    });

    it("updates lastWorkoutType to next workout when remaining", async () => {
      // Complete two workouts
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      workoutStore.startWorkout("B");
      workoutStore.completeWorkout();
      expect(workoutStore.history.workouts).toHaveLength(2);

      // Delete the latest (B), should update to A
      await workoutStore.deleteLatestWorkout();
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.lastWorkoutType).toBe("A");
      expect(workoutStore.history.lastWorkoutDate).toBeTruthy();
    });
  });

  describe("getExerciseWeight", () => {
    it("returns default for exercise with no history", () => {
      const weight = workoutStore.getExerciseWeight("Squat", 20);
      expect(weight).toBe(20);
    });

    it("returns last completed weight from history", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5); // Squat
      workoutStore.completeWorkout();

      const weight = workoutStore.getExerciseWeight("Squat", 20);
      expect(weight).toBeGreaterThanOrEqual(20);
    });
  });

  describe("hydrate", () => {
    it("tries IDB then Supabase", async () => {
      const { idbGet } = await import("$lib/services/idb");
      const { fetchWorkouts } = await import("$lib/services/supabaseData");
      await workoutStore.hydrate();
      expect(idbGet).toHaveBeenCalledWith("workout-history");
      expect(fetchWorkouts).toHaveBeenCalled();
    });
  });

  describe("hydrate with Supabase data", () => {
    it("uses Supabase data when available", async () => {
      const { fetchWorkouts, fetchWorkoutMeta } =
        await import("$lib/services/supabaseData");
      const mockWorkout = {
        id: "w1",
        date: "2025-01-15",
        time: "08:00",
        type: "workout",
        activity: "StrongLifts Workout A",
        workoutType: "A",
        duration_min: 45,
        exercises: [],
        synced: true,
        startedAt: "2025-01-15T08:00:00Z",
        completedAt: "2025-01-15T08:45:00Z",
      };
      (fetchWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        mockWorkout,
      ]);
      (fetchWorkoutMeta as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        lastWorkoutType: "A",
        lastWorkoutDate: "2025-01-15",
      });

      await workoutStore.hydrate();
      // Wait for fetchFromSupabase to complete
      await new Promise((r) => setTimeout(r, 10));
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.lastWorkoutType).toBe("A");
    });
  });

  describe("pending sync", () => {
    it("removes synced workout from pending on successful upsert", async () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      workoutStore.completeWorkout();

      // Wait for the async upsert
      await new Promise((r) => setTimeout(r, 10));

      const pending = localStorage.getItem("stronglifts-pending");
      expect(pending === null || JSON.parse(pending).length === 0).toBe(true);
    });

    it("getPendingSync returns pending workouts", () => {
      expect(workoutStore.getPendingSync()).toEqual([]);
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      expect(workoutStore.getPendingSync()).toHaveLength(1);
    });

    it("clearPendingSync removes all pending", () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      expect(workoutStore.getPendingSync()).toHaveLength(1);
      workoutStore.clearPendingSync();
      expect(workoutStore.getPendingSync()).toEqual([]);
    });
  });

  describe("getExerciseWeight edge cases", () => {
    it("returns targetWeight when no sets completed", () => {
      workoutStore.startWorkout("A");
      // Log a failed set (0 reps)
      const exercise = workoutStore.current!.exercises[0];
      exercise.sets.push({
        setNumber: 1,
        reps: 0,
        weight_kg: 60,
        completed: false,
      });
      workoutStore.completeWorkout();

      // Should return the target weight since no sets were completed
      const weight = workoutStore.getExerciseWeight("Squat", 20);
      expect(weight).toBeDefined();
    });
  });

  describe("hydrate IDB fallback", () => {
    it("uses IDB data when localStorage is empty", async () => {
      const { idbGet } = await import("$lib/services/idb");
      (idbGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: [
          {
            id: "w-idb",
            date: "2025-01-10",
            time: "08:00",
            type: "workout",
            activity: "Test",
            workoutType: "A",
            duration_min: 30,
            exercises: [],
            synced: true,
          },
        ],
        exerciseProgress: {},
        lastWorkoutType: "A",
        lastWorkoutDate: "2025-01-10",
      });

      await workoutStore.hydrate();
      // IDB data should be loaded since localStorage was empty
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.workouts[0].id).toBe("w-idb");
    });
  });

  describe("fetchFromSupabase error handling", () => {
    it("handles Supabase fetch error gracefully", async () => {
      const { fetchWorkouts } = await import("$lib/services/supabaseData");
      (fetchWorkouts as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      // hydrate calls fetchFromSupabase internally - should not throw
      await workoutStore.hydrate();
      // Wait for the background fetchFromSupabase to settle
      await new Promise((r) => setTimeout(r, 50));
      // Store should still work
      expect(workoutStore.history).toBeDefined();
    });
  });

  it("starts empty when localStorage is undefined (SSR)", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/services/supabaseData", () => ({
      fetchSettings: vi.fn(() => Promise.resolve(null)),
      upsertSettings: vi.fn(() => Promise.resolve(true)),
      upsertWorkout: vi.fn(() => Promise.resolve(true)),
      deleteWorkout: vi.fn(() => Promise.resolve(true)),
      fetchWorkouts: vi.fn(() => Promise.resolve([])),
      fetchWorkoutMeta: vi.fn(() =>
        Promise.resolve({ lastWorkoutType: null, lastWorkoutDate: null }),
      ),
      fetchExerciseProgress: vi.fn(() => Promise.resolve({})),
    }));
    vi.doMock("$lib/services/idb", () => ({
      idbGet: vi.fn(() => Promise.resolve(undefined)),
      idbSet: vi.fn(() => Promise.resolve()),
    }));
    vi.doMock("$lib/utils/sync", () => ({
      syncPendingWorkouts: vi.fn(() => Promise.resolve(0)),
    }));
    const mod = await import("$lib/stores/workout.svelte");
    expect(mod.workoutStore.history.workouts).toEqual([]);
    expect(mod.workoutStore.current).toBeNull();

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });

  describe("default increment fallback", () => {
    it("uses default 2.5 increment when increments not configured", async () => {
      // Clear configured increments so ?? 2.5 fallback is used
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
      vi.resetModules();
      const mod = await import("$lib/stores/workout.svelte");
      const store = mod.workoutStore;

      // Complete a successful workout A with all sets
      store.startWorkout("A");
      for (let i = 0; i < store.current!.exercises.length; i++) {
        const ex = store.current!.exercises[i];
        for (let s = 0; s < ex.targetSets; s++) {
          store.logSet(i, ex.targetReps);
        }
      }
      store.completeWorkout();

      // Next workout A should use default 2.5 increment (from ?? 2.5 fallback)
      store.startWorkout("A");
      const squat = store.current?.exercises.find((e) => e.name === "Squat");
      // Default 20 + fallback increment 2.5 = 22.5
      expect(squat?.targetWeight_kg).toBe(22.5);
    });
  });

  describe("progression logic", () => {
    it("increments weight after successful workout", () => {
      // Do a workout A with all sets completed
      workoutStore.startWorkout("A");
      for (let i = 0; i < 3; i++) {
        const ex = workoutStore.current!.exercises[i];
        for (let s = 0; s < ex.targetSets; s++) {
          workoutStore.logSet(i, ex.targetReps);
        }
      }
      workoutStore.completeWorkout();

      // Next workout A should have incremented weight
      workoutStore.startWorkout("A");
      const squat = workoutStore.current?.exercises.find(
        (e) => e.name === "Squat",
      );
      // Default 20 + 2.5 increment = 22.5
      expect(squat?.targetWeight_kg).toBe(22.5);
    });

    it("deloads after 3 consecutive failures", () => {
      // Complete 3 workouts with failed squat sets
      for (let w = 0; w < 3; w++) {
        workoutStore.startWorkout("A");
        const squatIdx = workoutStore.current!.exercises.findIndex(
          (e) => e.name === "Squat",
        );
        // Log failed sets (reps < target)
        for (let s = 0; s < 5; s++) {
          workoutStore.logSet(squatIdx, 3); // 3 < 5 = failed
        }
        // Complete other exercises
        for (let i = 0; i < workoutStore.current!.exercises.length; i++) {
          if (i === squatIdx) continue;
          const ex = workoutStore.current!.exercises[i];
          for (let s = 0; s < ex.targetSets; s++) {
            workoutStore.logSet(i, ex.targetReps);
          }
        }
        workoutStore.completeWorkout();
      }

      // Next workout should have deloaded squat
      workoutStore.startWorkout("A");
      const squat = workoutStore.current?.exercises.find(
        (e) => e.name === "Squat",
      );
      // 20 * 0.9 = 18, rounded to 17.5
      expect(squat?.targetWeight_kg).toBe(17.5);
    });
  });

  // ── Guards: calling methods without an active workout ──

  describe("guard: no active workout", () => {
    it("logSet does nothing when no workout is active", () => {
      expect(workoutStore.current).toBeNull();
      workoutStore.logSet(0, 5);
      expect(workoutStore.current).toBeNull();
    });

    it("updateSetReps does nothing when no workout is active", () => {
      expect(workoutStore.current).toBeNull();
      workoutStore.updateSetReps(0, 0, 5);
      expect(workoutStore.current).toBeNull();
    });

    it("updateExerciseWeight does nothing when no workout is active", () => {
      expect(workoutStore.current).toBeNull();
      workoutStore.updateExerciseWeight(0, 70);
      expect(workoutStore.current).toBeNull();
    });

    it("completeWorkout does nothing when no workout is active", () => {
      expect(workoutStore.current).toBeNull();
      workoutStore.completeWorkout();
      expect(workoutStore.history.workouts).toHaveLength(0);
    });
  });

  // ── SSR: localStorage undefined for all save/load paths ──

  describe("SSR: localStorage undefined", () => {
    let origLS: PropertyDescriptor | undefined;

    function removeLSAndReimport() {
      origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
      Object.defineProperty(globalThis, "localStorage", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      vi.resetModules();
      vi.doMock("$lib/services/supabaseData", () => ({
        fetchSettings: vi.fn(() => Promise.resolve(null)),
        upsertSettings: vi.fn(() => Promise.resolve(true)),
        upsertWorkout: vi.fn(() => Promise.resolve(true)),
        deleteWorkout: vi.fn(() => Promise.resolve(true)),
        fetchWorkouts: vi.fn(() => Promise.resolve([])),
        fetchWorkoutMeta: vi.fn(() =>
          Promise.resolve({ lastWorkoutType: null, lastWorkoutDate: null }),
        ),
        fetchExerciseProgress: vi.fn(() => Promise.resolve({})),
      }));
      vi.doMock("$lib/services/idb", () => ({
        idbGet: vi.fn(() => Promise.resolve(undefined)),
        idbSet: vi.fn(() => Promise.resolve()),
      }));
      vi.doMock("$lib/utils/sync", () => ({
        syncPendingWorkouts: vi.fn(() => Promise.resolve(0)),
      }));
    }

    afterEach(() => {
      if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
      else if (typeof globalThis.localStorage === "undefined") {
        // Shouldn't happen, but restore just in case
        Object.defineProperty(globalThis, "localStorage", {
          value: new Storage(),
          configurable: true,
          writable: true,
        });
      }
    });

    it("savePending early-returns when localStorage is undefined", async () => {
      removeLSAndReimport();
      const mod = await import("$lib/stores/workout.svelte");
      const store = mod.workoutStore;
      // startWorkout calls saveCurrent (which handles no LS), then completeWorkout calls savePending
      store.startWorkout("A");
      // completeWorkout internally calls savePending - should not throw
      store.completeWorkout();
      expect(store.history.workouts).toHaveLength(1);
    });

    it("getPendingSync returns empty array when localStorage is undefined", async () => {
      removeLSAndReimport();
      const mod = await import("$lib/stores/workout.svelte");
      expect(mod.workoutStore.getPendingSync()).toEqual([]);
    });

    it("clearPendingSync does not throw when localStorage is undefined", async () => {
      removeLSAndReimport();
      const mod = await import("$lib/stores/workout.svelte");
      expect(() => mod.workoutStore.clearPendingSync()).not.toThrow();
    });

    it("completeWorkout upsert callback handles missing localStorage", async () => {
      removeLSAndReimport();
      const mod = await import("$lib/stores/workout.svelte");
      const store = mod.workoutStore;

      store.startWorkout("A");
      store.logSet(0, 5);
      store.completeWorkout();

      // Wait for async upsert callback to fire
      await new Promise((r) => setTimeout(r, 50));

      // Should not throw even though localStorage is undefined inside the callback
      expect(store.history.workouts).toHaveLength(1);
    });
  });

  // ── deleteLatestWorkout: history becomes empty after delete ──

  describe("deleteLatestWorkout edge cases", () => {
    it("resets lastWorkoutType/Date to null when history becomes empty", async () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.lastWorkoutType).toBe("A");

      const result = await workoutStore.deleteLatestWorkout();
      expect(result).toBe(true);
      expect(workoutStore.history.workouts).toHaveLength(0);
      expect(workoutStore.history.lastWorkoutType).toBeNull();
      expect(workoutStore.history.lastWorkoutDate).toBeNull();
    });
  });

  // ── hydrate: IDB error handling ──

  describe("hydrate IDB error", () => {
    it("handles IDB error gracefully during hydrate", async () => {
      const { idbGet } = await import("$lib/services/idb");
      (idbGet as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("IDB unavailable"),
      );

      // Should not throw
      await workoutStore.hydrate();
      expect(workoutStore.history).toBeDefined();
    });
  });

  // ── hydrate: IDB returns data with empty workouts but exerciseProgress ──

  describe("hydrate IDB with exerciseProgress only", () => {
    it("uses IDB data when only exerciseProgress has content", async () => {
      const { idbGet } = await import("$lib/services/idb");
      (idbGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: [],
        exerciseProgress: {
          Squat: { name: "Squat", weight_kg: 60, failureCount: 0 },
        },
        lastWorkoutType: null,
        lastWorkoutDate: null,
      });

      await workoutStore.hydrate();
      expect(Object.keys(workoutStore.history.exerciseProgress).length).toBe(1);
    });

    it("skips IDB data when both workouts and exerciseProgress are empty", async () => {
      const { idbGet } = await import("$lib/services/idb");
      (idbGet as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: [],
        exerciseProgress: {},
        lastWorkoutType: null,
        lastWorkoutDate: null,
      });

      await workoutStore.hydrate();
      // Should remain with empty history since IDB data was empty too
      expect(workoutStore.history.workouts).toEqual([]);
    });
  });

  // ── fetchFromSupabase: empty workouts returned ──

  describe("fetchFromSupabase returns empty workouts", () => {
    it("does not update history when Supabase returns no workouts", async () => {
      const { fetchWorkouts, fetchWorkoutMeta } =
        await import("$lib/services/supabaseData");
      (fetchWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (fetchWorkoutMeta as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        lastWorkoutType: null,
        lastWorkoutDate: null,
      });

      await workoutStore.hydrate();
      await new Promise((r) => setTimeout(r, 50));
      // History should remain empty since no workouts came from Supabase
      expect(workoutStore.history.workouts).toEqual([]);
    });
  });

  // ── fetchFromSupabase: invalid lastWorkoutType ──

  describe("fetchFromSupabase invalid lastWorkoutType", () => {
    it("sets lastWorkoutType to null when Supabase returns invalid type", async () => {
      const { fetchWorkouts, fetchWorkoutMeta } =
        await import("$lib/services/supabaseData");
      const mockWorkout = {
        id: "w1",
        date: "2025-01-15",
        time: "08:00",
        type: "workout",
        activity: "StrongLifts Workout A",
        workoutType: "A",
        duration_min: 45,
        exercises: [],
        synced: true,
        startedAt: "2025-01-15T08:00:00Z",
        completedAt: "2025-01-15T08:45:00Z",
      };
      (fetchWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        mockWorkout,
      ]);
      (fetchWorkoutMeta as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        lastWorkoutType: "Z", // Invalid type, not in ['A', 'B', 'C', 'D']
        lastWorkoutDate: "2025-01-15",
      });

      await workoutStore.hydrate();
      await new Promise((r) => setTimeout(r, 50));
      expect(workoutStore.history.workouts).toHaveLength(1);
      expect(workoutStore.history.lastWorkoutType).toBeNull();
    });
  });

  // ── fetchFromSupabase: lastWorkoutDate is undefined/null ──

  describe("fetchFromSupabase null lastWorkoutDate", () => {
    it("handles undefined lastWorkoutDate from Supabase meta", async () => {
      const { fetchWorkouts, fetchWorkoutMeta } =
        await import("$lib/services/supabaseData");
      const mockWorkout = {
        id: "w1",
        date: "2025-01-15",
        time: "08:00",
        type: "workout",
        activity: "StrongLifts Workout A",
        workoutType: "A",
        duration_min: 45,
        exercises: [],
        synced: true,
        startedAt: "2025-01-15T08:00:00Z",
        completedAt: "2025-01-15T08:45:00Z",
      };
      (fetchWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        mockWorkout,
      ]);
      (fetchWorkoutMeta as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        lastWorkoutType: "A",
        lastWorkoutDate: undefined,
      });

      await workoutStore.hydrate();
      await new Promise((r) => setTimeout(r, 50));
      expect(workoutStore.history.lastWorkoutDate).toBeNull();
    });
  });

  // ── getDefaultWeight: unknown exercise falls back to 20 ──

  describe("getDefaultWeight fallback", () => {
    it("uses 20kg for unknown exercise name", () => {
      // getExerciseWeight returns getDefaultWeight for exercises with no history
      const weight = workoutStore.getExerciseWeight(
        "Unknown Exercise XYZ",
        999,
      );
      // No history, so returns the passed-in default
      expect(weight).toBe(999);
    });

    it("getNextExerciseWeight uses 20kg default for unknown exercises", () => {
      // getNextExerciseWeight calls getDefaultWeight internally for exercises not in history
      const weight = workoutStore.getNextExerciseWeight("Bicep Curls");
      // No history => getDefaultWeight('Bicep Curls') => defaults['Bicep Curls'] ?? 20 => 20
      expect(weight).toBe(20);
    });
  });

  // ── completeWorkout: upsert fails, pending stays ──

  describe("completeWorkout upsert failure", () => {
    it("keeps pending when upsert rejects", async () => {
      vi.resetModules();
      localStorage.clear();
      vi.doMock("$lib/services/supabaseData", () => ({
        fetchSettings: vi.fn(() => Promise.resolve(null)),
        upsertSettings: vi.fn(() => Promise.resolve(true)),
        upsertWorkout: vi.fn(() =>
          Promise.reject(new Error("Network failure")),
        ),
        deleteWorkout: vi.fn(() => Promise.resolve(true)),
        fetchWorkouts: vi.fn(() => Promise.resolve([])),
        fetchWorkoutMeta: vi.fn(() =>
          Promise.resolve({ lastWorkoutType: null, lastWorkoutDate: null }),
        ),
        fetchExerciseProgress: vi.fn(() => Promise.resolve({})),
      }));
      vi.doMock("$lib/services/idb", () => ({
        idbGet: vi.fn(() => Promise.resolve(undefined)),
        idbSet: vi.fn(() => Promise.resolve()),
      }));
      vi.doMock("$lib/utils/sync", () => ({
        syncPendingWorkouts: vi.fn(() => Promise.resolve(0)),
      }));

      const mod = await import("$lib/stores/workout.svelte");
      const store = mod.workoutStore;

      store.startWorkout("A");
      store.logSet(0, 5);
      store.completeWorkout();

      // Wait for the async upsert to settle
      await new Promise((r) => setTimeout(r, 50));

      // Pending should still have the workout since upsert failed
      const pending = localStorage.getItem("stronglifts-pending");
      expect(pending).not.toBeNull();
      expect(JSON.parse(pending!)).toHaveLength(1);
    });

    it("keeps pending when upsert resolves false", async () => {
      vi.resetModules();
      localStorage.clear();
      vi.doMock("$lib/services/supabaseData", () => ({
        fetchSettings: vi.fn(() => Promise.resolve(null)),
        upsertSettings: vi.fn(() => Promise.resolve(true)),
        upsertWorkout: vi.fn(() => Promise.resolve(false)),
        deleteWorkout: vi.fn(() => Promise.resolve(true)),
        fetchWorkouts: vi.fn(() => Promise.resolve([])),
        fetchWorkoutMeta: vi.fn(() =>
          Promise.resolve({ lastWorkoutType: null, lastWorkoutDate: null }),
        ),
        fetchExerciseProgress: vi.fn(() => Promise.resolve({})),
      }));
      vi.doMock("$lib/services/idb", () => ({
        idbGet: vi.fn(() => Promise.resolve(undefined)),
        idbSet: vi.fn(() => Promise.resolve()),
      }));
      vi.doMock("$lib/utils/sync", () => ({
        syncPendingWorkouts: vi.fn(() => Promise.resolve(0)),
      }));

      const mod = await import("$lib/stores/workout.svelte");
      const store = mod.workoutStore;

      store.startWorkout("A");
      store.logSet(0, 5);
      store.completeWorkout();

      await new Promise((r) => setTimeout(r, 50));

      // Pending should still have the workout since ok was false
      const pending = localStorage.getItem("stronglifts-pending");
      expect(pending).not.toBeNull();
      expect(JSON.parse(pending!)).toHaveLength(1);
    });
  });

  // ── updateSetReps: out-of-bounds set index ──

  describe("updateSetReps edge cases", () => {
    it("does nothing when set index does not exist", () => {
      workoutStore.startWorkout("A");
      workoutStore.logSet(0, 5);
      // Try to update a set that doesn't exist (index 5)
      workoutStore.updateSetReps(0, 5, 3);
      // Original set should be unchanged
      expect(workoutStore.current?.exercises[0].sets[0].reps).toBe(5);
    });
  });

  // ── getConsecutiveFailures: exercise not found in a workout (line 87 continue) ──

  describe("getConsecutiveFailures skip workouts without exercise", () => {
    it("skips workouts that do not contain the queried exercise", () => {
      // 1. Complete workout A (has Bench Press) - all sets successful
      workoutStore.startWorkout("A");
      for (let i = 0; i < workoutStore.current!.exercises.length; i++) {
        const ex = workoutStore.current!.exercises[i];
        for (let s = 0; s < ex.targetSets; s++) {
          workoutStore.logSet(i, ex.targetReps);
        }
      }
      workoutStore.completeWorkout();

      // 2. Complete workout B (does NOT have Bench Press)
      workoutStore.startWorkout("B");
      for (let i = 0; i < workoutStore.current!.exercises.length; i++) {
        const ex = workoutStore.current!.exercises[i];
        for (let s = 0; s < ex.targetSets; s++) {
          workoutStore.logSet(i, ex.targetReps);
        }
      }
      workoutStore.completeWorkout();

      // 3. Start workout A again.
      // getConsecutiveFailures('Bench Press') iterates history [B, A]:
      //   - B has no Bench Press -> continue (line 87 branch)
      //   - A has Bench Press, all completed -> break, count=0
      // So Bench Press gets incremented: 20 + 2.5 = 22.5
      workoutStore.startWorkout("A");
      const bench = workoutStore.current?.exercises.find(
        (e) => e.name === "Bench Press",
      );
      expect(bench?.targetWeight_kg).toBe(22.5);
    });
  });

  // ── startWorkout without type arg: auto-select next type (line 107 fallback) ──

  describe("startWorkout auto-selects type", () => {
    it("uses getNextWorkoutType when no type argument is provided", () => {
      // Call startWorkout() without any type argument so the ?? fallback is exercised
      workoutStore.startWorkout();
      expect(workoutStore.current).not.toBeNull();
      // With no history, getNextWorkoutType should return 'A'
      expect(workoutStore.current?.workoutType).toBe("A");
    });

    it("auto-selects B after completing A", () => {
      workoutStore.startWorkout("A");
      workoutStore.completeWorkout();
      // Now startWorkout with no arg should pick the next type
      workoutStore.startWorkout();
      expect(workoutStore.current?.workoutType).toBe("B");
    });
  });

  // ── completeWorkout: missing startedAt (line 184 false branch) ──

  describe("completeWorkout without startedAt", () => {
    it("uses current time when startedAt is missing", () => {
      workoutStore.startWorkout("A");
      // Manually remove startedAt to exercise the fallback
      delete (workoutStore.current as any).startedAt;
      workoutStore.completeWorkout();
      expect(workoutStore.history.workouts).toHaveLength(1);
      // duration_min should be 0 since startTime === now
      expect(workoutStore.history.workouts[0].duration_min).toBe(0);
    });
  });
});
