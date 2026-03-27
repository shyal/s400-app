import type {
  Workout,
  WorkoutHistory,
  Exercise,
  WorkoutType,
} from "$lib/types";
import { getProgram, getNextWorkoutType } from "$lib/utils/programs";
import { roundToNearest } from "$lib/utils/progression";
import { localDateStr } from "$lib/utils/date";
import { settingsStore } from "./settings.svelte";
import {
  upsertWorkout,
  deleteWorkout as deleteWorkoutRemote,
  fetchWorkouts,
  fetchWorkoutMeta,
} from "$lib/services/supabaseData";
import { syncPendingWorkouts } from "$lib/utils/sync";
import { uuid } from "$lib/uuid";
import { idbGet, idbSet } from "$lib/services/idb";

const IDB_HISTORY_KEY = "workout-history";
const LS_HISTORY_KEY = "stronglifts-history"; // legacy, for migration
const CURRENT_KEY = "stronglifts-current";
const PENDING_KEY = "stronglifts-pending";

function generateId(): string {
  return uuid();
}

const EMPTY_HISTORY: WorkoutHistory = {
  workouts: [],
  exerciseProgress: {},
  lastWorkoutType: null,
  lastWorkoutDate: null,
};

function loadHistory(): WorkoutHistory {
  if (typeof localStorage === "undefined")
    return { ...EMPTY_HISTORY, exerciseProgress: {} };
  const stored = localStorage.getItem(LS_HISTORY_KEY);
  if (!stored) return { ...EMPTY_HISTORY, exerciseProgress: {} };
  try {
    return JSON.parse(stored);
  } catch {
    return { ...EMPTY_HISTORY, exerciseProgress: {} };
  }
}

function loadCurrent(): Workout | null {
  if (typeof localStorage === "undefined") return null;
  const stored = localStorage.getItem(CURRENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function createWorkoutStore() {
  let history = $state<WorkoutHistory>(loadHistory());
  let currentWorkout = $state<Workout | null>(loadCurrent());

  function saveHistory() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(history));
    }
    idbSet(IDB_HISTORY_KEY, history).catch(() => {});
  }

  function saveCurrent() {
    if (typeof localStorage !== "undefined") {
      if (currentWorkout) {
        localStorage.setItem(CURRENT_KEY, JSON.stringify(currentWorkout));
      } else {
        localStorage.removeItem(CURRENT_KEY);
      }
    }
  }

  function savePending(workout: Workout) {
    if (typeof localStorage === "undefined") return;
    const stored = localStorage.getItem(PENDING_KEY);
    const pending: Workout[] = stored ? JSON.parse(stored) : [];
    pending.push(workout);
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }

  function getExerciseWeight(
    exerciseName: string,
    defaultWeight: number,
  ): number {
    for (const workout of history.workouts) {
      const ex = workout.exercises.find((e) => e.name === exerciseName);
      if (!ex) continue;
      const completedWeights = ex.sets
        .filter((s) => s.completed)
        .map((s) => s.weight_kg);
      return completedWeights.length > 0
        ? Math.max(...completedWeights)
        : ex.targetWeight_kg;
    }
    return defaultWeight;
  }

  function getConsecutiveFailures(exerciseName: string): number {
    let count = 0;
    for (const workout of history.workouts) {
      const ex = workout.exercises.find((e) => e.name === exerciseName);
      if (!ex) continue;
      const allCompleted =
        ex.sets.length >= ex.targetSets && ex.sets.every((s) => s.completed);
      if (allCompleted) break;
      count++;
    }
    return count;
  }

  function getNextExerciseWeight(exerciseName: string): number {
    const lastWeight = getExerciseWeight(
      exerciseName,
      getDefaultWeight(exerciseName),
    );
    const hasHistory = history.workouts.some((w) =>
      w.exercises.some((e) => e.name === exerciseName),
    );
    if (!hasHistory) return getDefaultWeight(exerciseName);
    const failures = getConsecutiveFailures(exerciseName);
    if (failures === 0) {
      const isPlateaued =
        settingsStore.value.plateauExercises?.includes(exerciseName) ?? false;
      return isPlateaued ? lastWeight : lastWeight + getIncrement(exerciseName);
    }
    if (failures >= 3) return roundToNearest(lastWeight * 0.9, 2.5);
    return lastWeight;
  }

  function startWorkout(type?: WorkoutType, deloadPct: number = 0) {
    const program = getProgram(settingsStore.value.program);
    const workoutType =
      type ??
      getNextWorkoutType(history.lastWorkoutType, settingsStore.value.program);
    const programDay = program.workouts[workoutType];
    const deloadFactor = 1 - deloadPct / 100;

    const now = new Date();
    const exercises: Exercise[] = programDay.exercises.map((ex) => {
      const base = getNextExerciseWeight(ex.name);
      const weight =
        deloadPct > 0 ? roundToNearest(base * deloadFactor, 2.5) : base;
      return {
        name: ex.name,
        targetSets: ex.sets,
        targetReps: ex.reps,
        targetWeight_kg: weight,
        sets: [],
      };
    });

    currentWorkout = {
      id: generateId(),
      date: localDateStr(now),
      time: now.toTimeString().slice(0, 5),
      type: "workout",
      activity: `StrongLifts Workout ${workoutType}`,
      workoutType,
      duration_min: 0,
      exercises,
      synced: false,
      startedAt: now.toISOString(),
    };
    saveCurrent();
  }

  function logSet(exerciseIndex: number, reps: number) {
    if (!currentWorkout) return;

    const exercise = currentWorkout.exercises[exerciseIndex];
    const setNumber = exercise.sets.length + 1;

    exercise.sets.push({
      setNumber,
      reps,
      weight_kg: exercise.targetWeight_kg,
      completed: reps >= exercise.targetReps,
    });

    saveCurrent();
  }

  function updateSetReps(
    exerciseIndex: number,
    setIndex: number,
    reps: number,
  ) {
    if (!currentWorkout) return;
    const exercise = currentWorkout.exercises[exerciseIndex];
    if (exercise.sets[setIndex]) {
      exercise.sets[setIndex].reps = reps;
      exercise.sets[setIndex].completed = reps >= exercise.targetReps;
      saveCurrent();
    }
  }

  function updateExerciseWeight(exerciseIndex: number, weight: number) {
    if (!currentWorkout) return;
    const exercise = currentWorkout.exercises[exerciseIndex];
    if (exercise) {
      exercise.targetWeight_kg = weight;
      // Also update any logged sets to reflect the new weight
      for (const set of exercise.sets) {
        set.weight_kg = weight;
      }
      saveCurrent();
    }
  }

  function completeWorkout() {
    if (!currentWorkout) return;

    const now = new Date();
    const startTime = currentWorkout.startedAt
      ? new Date(currentWorkout.startedAt)
      : now;
    const durationMin = Math.round(
      (now.getTime() - startTime.getTime()) / 60000,
    );

    currentWorkout.duration_min = durationMin;
    currentWorkout.completedAt = now.toISOString();

    // Add to history
    history.workouts.unshift(currentWorkout);
    history.lastWorkoutType = currentWorkout.workoutType;
    history.lastWorkoutDate = currentWorkout.date;

    // Save to pending sync
    savePending(currentWorkout);

    // Clear current workout
    saveHistory();

    // Sync to Supabase in background
    const completedWorkout = currentWorkout;
    currentWorkout = null;
    saveCurrent();

    upsertWorkout(completedWorkout)
      .then((ok) => {
        if (ok) {
          // Remove from pending since it synced
          if (typeof localStorage !== "undefined") {
            const stored = localStorage.getItem(PENDING_KEY);
            if (stored) {
              const pending = JSON.parse(stored).filter(
                (w: Workout) => w.id !== completedWorkout.id,
              );
              if (pending.length > 0) {
                localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
              } else {
                localStorage.removeItem(PENDING_KEY);
              }
            }
          }
        }
      })
      .catch(() => {});
  }

  function cancelWorkout() {
    currentWorkout = null;
    saveCurrent();
  }

  function getPendingSync(): Workout[] {
    if (typeof localStorage === "undefined") return [];
    const stored = localStorage.getItem(PENDING_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function clearPendingSync() {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(PENDING_KEY);
    }
  }

  async function deleteLatestWorkout(): Promise<boolean> {
    if (history.workouts.length === 0) return false;
    const latest = history.workouts[0];
    // Remove from Supabase
    await deleteWorkoutRemote(latest.id);
    // Remove from local history
    history.workouts.splice(0, 1);
    // Update last workout meta from the new latest
    if (history.workouts.length > 0) {
      history.lastWorkoutType = history.workouts[0].workoutType;
      history.lastWorkoutDate = history.workouts[0].date;
    } else {
      history.lastWorkoutType = null;
      history.lastWorkoutDate = null;
    }
    saveHistory();
    return true;
  }

  async function hydrate() {
    // If localStorage was empty, try IDB as fallback
    if (history.workouts.length === 0) {
      try {
        const cached = await idbGet<WorkoutHistory>(IDB_HISTORY_KEY);
        if (
          cached &&
          (cached.workouts.length > 0 ||
            Object.keys(cached.exerciseProgress).length > 0)
        ) {
          history = cached;
        }
      } catch {
        /* IDB unavailable */
      }
    }

    // Refresh from Supabase in background
    fetchFromSupabase();
  }

  async function fetchFromSupabase() {
    try {
      const [workouts, meta] = await Promise.all([
        fetchWorkouts(),
        fetchWorkoutMeta(),
      ]);
      if (workouts.length > 0) {
        history = {
          workouts,
          exerciseProgress: {},
          lastWorkoutType: ["A", "B", "C", "D"].includes(meta.lastWorkoutType)
            ? (meta.lastWorkoutType as WorkoutType)
            : null,
          lastWorkoutDate: meta.lastWorkoutDate ?? null,
        };
        saveHistory();
      }
      await syncPendingWorkouts();
    } catch (e) {
      console.error("Supabase fetch error:", e);
    }
  }

  return {
    get history() {
      return history;
    },
    get current() {
      return currentWorkout;
    },
    get isWorkoutActive() {
      return currentWorkout !== null;
    },
    getExerciseWeight,
    getNextExerciseWeight,
    startWorkout,
    logSet,
    updateSetReps,
    updateExerciseWeight,
    completeWorkout,
    cancelWorkout,
    getPendingSync,
    clearPendingSync,
    deleteLatestWorkout,
    hydrate,
  };
}

function getDefaultWeight(exerciseName: string): number {
  const defaults: Record<string, number> = {
    // Main compound lifts
    Squat: 20,
    "Bench Press": 20,
    "Barbell Row": 20,
    "Overhead Press": 20,
    Deadlift: 40,
    // Upper/Lower split exercises
    "Romanian Deadlift": 30,
    "Leg Press": 40,
    "Leg Curl": 15,
    "Dumbbell Shoulder Press": 10,
    "Lat Pulldown": 30,
    "Front Squat": 20,
    "Leg Extension": 20,
    "Calf Raises": 30,
    "Cable Row": 30,
    "Incline Dumbbell Press": 12,
    "Face Pulls": 15,
    // Lower Back Recovery exercises
    "Goblet Squat": 15,
    "Chest-Supported DB Row": 10,
  };
  return defaults[exerciseName] ?? 20;
}

function getIncrement(exerciseName: string): number {
  return settingsStore.value.increments?.[exerciseName] ?? 2.5;
}

export const workoutStore = createWorkoutStore();
