import { describe, it, expect } from "vitest";
import {
  computeNextWorkout,
  countConsecutiveOnSchedule,
} from "$lib/utils/schedule";
import type { Workout, WorkoutSchedule } from "$lib/types";

function makeWorkout(
  date: string,
  workoutType: "A" | "B" | "C" | "D" = "A",
): Workout {
  return {
    id: `w-${date}`,
    date,
    time: "08:00",
    type: "workout",
    activity: `Workout ${workoutType}`,
    workoutType,
    duration_min: 45,
    exercises: [],
    synced: true,
  };
}

const defaultSchedule: WorkoutSchedule = {
  frequencyDays: 2,
  consecutiveForExtraRest: 3,
  extraRestDays: 1,
};

describe("countConsecutiveOnSchedule", () => {
  it("returns 0 for empty array", () => {
    expect(countConsecutiveOnSchedule([], 2)).toBe(0);
  });

  it("returns 1 for single workout", () => {
    expect(countConsecutiveOnSchedule([makeWorkout("2025-01-10")], 2)).toBe(1);
  });

  it("counts consecutive on-schedule workouts (newest first)", () => {
    const workouts = [
      makeWorkout("2025-01-10"),
      makeWorkout("2025-01-08"),
      makeWorkout("2025-01-06"),
    ];
    expect(countConsecutiveOnSchedule(workouts, 2)).toBe(3);
  });

  it("stops counting when gap is not frequencyDays", () => {
    const workouts = [
      makeWorkout("2025-01-10"),
      makeWorkout("2025-01-08"),
      makeWorkout("2025-01-05"), // 3-day gap, breaks streak
    ];
    expect(countConsecutiveOnSchedule(workouts, 2)).toBe(2);
  });

  it("returns 1 when first gap does not match", () => {
    const workouts = [
      makeWorkout("2025-01-10"),
      makeWorkout("2025-01-07"), // 3-day gap
    ];
    expect(countConsecutiveOnSchedule(workouts, 2)).toBe(1);
  });
});

describe("computeNextWorkout", () => {
  it("returns today when no workout history", () => {
    const now = new Date("2025-01-15T10:00:00");
    const result = computeNextWorkout([], defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.nextType).toBe("A");
    expect(result.consecutiveCount).toBe(0);
    expect(result.isExtraRestDay).toBe(false);
    expect(result.isOverdue).toBe(false);
    expect(result.msUntil).toBe(0);
    expect(result.overdueMs).toBe(0);
  });

  it("computes next date with frequencyDays=2", () => {
    const workouts = [makeWorkout("2025-01-13", "A")];
    const now = new Date("2025-01-14T10:00:00"); // 1 day after
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.isOverdue).toBe(false);
    expect(result.nextType).toBe("B");
    expect(result.msUntil).toBeGreaterThan(0);
  });

  it("due today when frequencyDays elapsed — not overdue", () => {
    const workouts = [makeWorkout("2025-01-13", "A")];
    const now = new Date("2025-01-15T05:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.isOverdue).toBe(false);
    // msUntil counts to end of due day
    expect(result.msUntil).toBeGreaterThan(0);
  });

  it("overdue when past due date", () => {
    const workouts = [makeWorkout("2025-01-13", "B")];
    const now = new Date("2025-01-16T10:00:00"); // day after due date (15th)
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.isOverdue).toBe(true);
    expect(result.overdueMs).toBeGreaterThan(0);
    expect(result.msUntil).toBe(0);
    expect(result.nextType).toBe("A");
  });

  it("grants extra rest after consecutive on-schedule workouts", () => {
    const workouts = [
      makeWorkout("2025-01-10", "B"),
      makeWorkout("2025-01-08", "A"),
      makeWorkout("2025-01-06", "B"),
    ];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.isExtraRestDay).toBe(true);
    expect(result.nextDate).toBe("2025-01-13");
    expect(result.consecutiveCount).toBe(3);
  });

  it("no extra rest when not enough consecutive workouts", () => {
    const workouts = [
      makeWorkout("2025-01-10", "B"),
      makeWorkout("2025-01-08", "A"),
    ];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.isExtraRestDay).toBe(false);
    expect(result.nextDate).toBe("2025-01-12");
    expect(result.consecutiveCount).toBe(2);
  });

  it("no extra rest when streak broken by off-schedule workout", () => {
    const workouts = [
      makeWorkout("2025-01-10", "B"),
      makeWorkout("2025-01-08", "A"),
      makeWorkout("2025-01-05", "B"), // 3-day gap, breaks streak
    ];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.isExtraRestDay).toBe(false);
    expect(result.consecutiveCount).toBe(2);
    expect(result.nextDate).toBe("2025-01-12");
  });

  it("alternates workout type A→B", () => {
    const workouts = [makeWorkout("2025-01-10", "A")];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextType).toBe("B");
  });

  it("alternates workout type B→A", () => {
    const workouts = [makeWorkout("2025-01-10", "B")];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextType).toBe("A");
  });

  it("handles 4-day cycle for custom program", () => {
    const workouts = [makeWorkout("2025-01-10", "C")];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now, "custom");
    expect(result.nextType).toBe("D");
  });

  it("4-day cycle D wraps to A", () => {
    const workouts = [makeWorkout("2025-01-10", "D")];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now, "custom");
    expect(result.nextType).toBe("A");
  });

  it("workout today is not overdue", () => {
    const workouts = [makeWorkout("2025-01-15", "A")];
    const now = new Date("2025-01-15T20:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-17");
    expect(result.isOverdue).toBe(false);
  });

  it("uses custom schedule values", () => {
    const schedule: WorkoutSchedule = {
      frequencyDays: 3,
      consecutiveForExtraRest: 2,
      extraRestDays: 2,
    };
    const workouts = [
      makeWorkout("2025-01-10", "B"),
      makeWorkout("2025-01-07", "A"),
    ];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, schedule, now);
    expect(result.isExtraRestDay).toBe(true);
    expect(result.nextDate).toBe("2025-01-15");
  });

  it("handles unsorted workout array", () => {
    const workouts = [
      makeWorkout("2025-01-06", "B"),
      makeWorkout("2025-01-10", "A"),
      makeWorkout("2025-01-08", "B"),
    ];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    // Sorted: Jan10, Jan8, Jan6. All gaps=2 → consecutive=3 → extra rest
    expect(result.nextType).toBe("B");
    expect(result.isExtraRestDay).toBe(true);
    expect(result.nextDate).toBe("2025-01-13"); // 10 + (2+1) = 13
  });

  it("msUntil counts time remaining on due day", () => {
    const workouts = [makeWorkout("2025-01-13", "A")];
    const now = new Date("2025-01-14T12:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    // msUntil is time from now to end of Jan 15 (23:59:59 + 1s)
    const endOfDay = new Date("2025-01-16T00:00:00").getTime();
    expect(result.msUntil).toBe(endOfDay - now.getTime());
  });

  it("overdueMs is correct when overdue", () => {
    const workouts = [makeWorkout("2025-01-13", "A")];
    const now = new Date("2025-01-16T06:00:00"); // day after due date
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.isOverdue).toBe(true);
    // overdueMs = now - end of Jan 15
    const endOfDueDay = new Date("2025-01-16T00:00:00").getTime();
    expect(result.overdueMs).toBe(now.getTime() - endOfDueDay);
  });

  it("no workouts: nextDate at midnight is not overdue", () => {
    const now = new Date("2025-01-15T00:00:00");
    const result = computeNextWorkout([], defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.msUntil).toBe(0);
    expect(result.isOverdue).toBe(false);
    expect(result.overdueMs).toBe(0);
  });

  it("consecutive count is 1 for a single workout", () => {
    const workouts = [makeWorkout("2025-01-10", "A")];
    const now = new Date("2025-01-11T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.consecutiveCount).toBe(1);
  });

  it("extra rest with exactly consecutiveForExtraRest workouts", () => {
    const schedule: WorkoutSchedule = {
      frequencyDays: 2,
      consecutiveForExtraRest: 2,
      extraRestDays: 1,
    };
    const workouts = [
      makeWorkout("2025-01-10", "B"),
      makeWorkout("2025-01-08", "A"),
    ];
    const now = new Date("2025-01-11T00:00:00");
    const result = computeNextWorkout(workouts, schedule, now);
    expect(result.isExtraRestDay).toBe(true);
    expect(result.nextDate).toBe("2025-01-13");
  });

  it("long streak of 5 consecutive still grants extra rest", () => {
    const workouts = [
      makeWorkout("2025-01-18", "B"),
      makeWorkout("2025-01-16", "A"),
      makeWorkout("2025-01-14", "B"),
      makeWorkout("2025-01-12", "A"),
      makeWorkout("2025-01-10", "B"),
    ];
    const now = new Date("2025-01-19T10:00:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.consecutiveCount).toBe(5);
    expect(result.isExtraRestDay).toBe(true);
    expect(result.nextDate).toBe("2025-01-21");
  });

  it("not overdue on the due date even late at night", () => {
    const workouts = [makeWorkout("2025-01-13", "A")];
    const now = new Date("2025-01-15T23:59:00");
    const result = computeNextWorkout(workouts, defaultSchedule, now);
    expect(result.nextDate).toBe("2025-01-15");
    expect(result.isOverdue).toBe(false);
    expect(result.msUntil).toBeGreaterThan(0);
    expect(result.msUntil).toBeLessThan(61000); // ~1 minute left
  });
});
