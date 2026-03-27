import type { ExerciseProgress } from "$lib/types";

const DELOAD_THRESHOLD = 3;
const DELOAD_PERCENTAGE = 0.1; // 10% deload

export function calculateProgression(
  current: ExerciseProgress,
  allSetsCompleted: boolean,
  increment_kg: number,
): ExerciseProgress {
  if (allSetsCompleted) {
    // Success: store current weight, reset failure count
    // (increment happens at next workout start)
    return {
      ...current,
      failureCount: 0,
    };
  }

  // Failure: increment failure count
  const newFailureCount = current.failureCount + 1;

  if (newFailureCount >= DELOAD_THRESHOLD) {
    // Deload: reduce weight by 10%, reset failure count
    const deloadedWeight = current.weight_kg * (1 - DELOAD_PERCENTAGE);
    return {
      ...current,
      weight_kg: roundToNearest(deloadedWeight, 2.5),
      failureCount: 0,
    };
  }

  // Keep same weight, track failure
  return {
    ...current,
    failureCount: newFailureCount,
  };
}

export function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export function kgToLb(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / 2.20462) * 10) / 10;
}

export function formatWeight(kg: number, unit: "kg" | "lb"): string {
  if (unit === "lb") {
    return `${kgToLb(kg)} lb`;
  }
  return `${kg} kg`;
}

export function formatWeightRange(
  sets: { weight_kg: number }[],
  fallback: number,
  unit: "kg" | "lb",
): string {
  if (sets.length === 0) return formatWeight(fallback, unit);
  const weights = sets.map((s) => s.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  if (min === max) return formatWeight(min, unit);
  if (unit === "lb") return `${kgToLb(min)}-${kgToLb(max)} lb`;
  return `${min}-${max} kg`;
}

export function getMaxSetWeight(
  sets: { weight_kg: number }[],
  fallback: number,
): number {
  if (sets.length === 0) return fallback;
  return Math.max(...sets.map((s) => s.weight_kg));
}

export function epleyE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function getAvgSetWeight(
  sets: { weight_kg: number }[],
  fallback: number,
): number {
  if (sets.length === 0) return fallback;
  const sum = sets.reduce((acc, s) => acc + s.weight_kg, 0);
  return Math.round((sum / sets.length) * 10) / 10;
}
