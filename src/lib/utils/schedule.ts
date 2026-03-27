import type { Workout, WorkoutSchedule, WorkoutType } from "$lib/types";
import { getNextWorkoutType } from "$lib/utils/programs";

export interface NextWorkoutInfo {
  nextDate: string;
  msUntil: number;
  isOverdue: boolean;
  overdueMs: number;
  nextType: WorkoutType;
  consecutiveCount: number;
  isExtraRestDay: boolean;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

export function countConsecutiveOnSchedule(
  workouts: Workout[],
  frequencyDays: number,
): number {
  if (workouts.length < 2) return workouts.length;

  let count = 1;
  for (let i = 0; i < workouts.length - 1; i++) {
    const gap = daysBetween(workouts[i + 1].date, workouts[i].date);
    if (gap === frequencyDays) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function computeNextWorkout(
  workouts: Workout[],
  schedule: WorkoutSchedule,
  now: Date,
  programName: string = "stronglifts",
): NextWorkoutInfo {
  const today = toDateStr(now);

  if (workouts.length === 0) {
    return {
      nextDate: today,
      msUntil: 0,
      isOverdue: false,
      overdueMs: 0,
      nextType: "A",
      consecutiveCount: 0,
      isExtraRestDay: false,
    };
  }

  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  const lastWorkout = sorted[0];
  const lastType = lastWorkout.workoutType;
  const nextType = getNextWorkoutType(lastType, programName);

  const consecutive = countConsecutiveOnSchedule(
    sorted,
    schedule.frequencyDays,
  );
  const isExtraRestDay = consecutive >= schedule.consecutiveForExtraRest;
  const restDays = isExtraRestDay
    ? schedule.frequencyDays + schedule.extraRestDays
    : schedule.frequencyDays;

  const nextDate = addDays(lastWorkout.date, restDays);
  const isOverdue = today > nextDate;
  const endOfNextDate = new Date(nextDate + "T23:59:59").getTime() + 1000;
  const msUntil = isOverdue ? 0 : Math.max(0, endOfNextDate - now.getTime());
  const overdueMs = isOverdue
    ? now.getTime() - new Date(nextDate + "T23:59:59").getTime() - 1000
    : 0;

  return {
    nextDate,
    msUntil,
    isOverdue,
    overdueMs: Math.max(0, overdueMs),
    nextType,
    consecutiveCount: consecutive,
    isExtraRestDay,
  };
}
