import { describe, it, expect, vi, afterEach } from "vitest";
import {
  computeWorkoutStreak,
  computeNutritionStreaks,
  buildActivityMap,
  buildAllStreaks,
} from "$lib/services/streakData";
import {
  makeWorkout,
  makeFoodEntry,
  makeWaterEntry,
  makeMacroTargets,
} from "../../../test/fixtures";

describe("computeWorkoutStreak", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0/0 for empty workouts", () => {
    expect(computeWorkoutStreak([])).toEqual({ current: 0, best: 0 });
  });

  it("returns 1/1 for a single recent workout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00"));
    const workouts = [makeWorkout({ date: "2025-01-15" })];
    const result = computeWorkoutStreak(workouts);
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });

  it("counts consecutive sessions within 3-day gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00"));
    const workouts = [
      makeWorkout({ date: "2025-01-15" }),
      makeWorkout({ date: "2025-01-13" }),
      makeWorkout({ date: "2025-01-11" }),
      makeWorkout({ date: "2025-01-09" }),
    ];
    const result = computeWorkoutStreak(workouts);
    expect(result.current).toBe(4);
    expect(result.best).toBe(4);
  });

  it("breaks streak on >3 day gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-20T10:00:00"));
    const workouts = [
      makeWorkout({ date: "2025-01-20" }),
      makeWorkout({ date: "2025-01-18" }),
      // Gap of 5 days
      makeWorkout({ date: "2025-01-13" }),
      makeWorkout({ date: "2025-01-11" }),
      makeWorkout({ date: "2025-01-09" }),
    ];
    const result = computeWorkoutStreak(workouts);
    expect(result.current).toBe(2);
    expect(result.best).toBe(3);
  });

  it("handles first gap > 3 days (lines 64-66)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-20T10:00:00"));
    const workouts = [
      makeWorkout({ date: "2025-01-20" }),
      makeWorkout({ date: "2025-01-15" }), // gap of 5 > 3
    ];
    const result = computeWorkoutStreak(workouts);
    // First gap > 3, so current streak should be 1 (only the latest workout)
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });

  it("current streak is 0 if last workout too old", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-20T10:00:00"));
    const workouts = [
      makeWorkout({ date: "2025-01-10" }),
      makeWorkout({ date: "2025-01-08" }),
    ];
    const result = computeWorkoutStreak(workouts);
    expect(result.current).toBe(0);
    expect(result.best).toBe(2);
  });
});

describe("computeNutritionStreaks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 streaks for empty data", () => {
    const targets = makeMacroTargets();
    const result = computeNutritionStreaks([], [], targets);
    expect(result.protein.current).toBe(0);
    expect(result.food.current).toBe(0);
    expect(result.water.current).toBe(0);
  });

  it("counts protein streak when target hit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ protein_g: 100 });
    const food = [
      makeFoodEntry({ date: "2025-01-15", protein_g: 110 }),
      makeFoodEntry({ date: "2025-01-14", protein_g: 105 }),
      makeFoodEntry({ date: "2025-01-13", protein_g: 80 }), // missed
    ];
    const result = computeNutritionStreaks(food, [], targets);
    expect(result.protein.current).toBe(2);
  });

  it("counts food logging streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets();
    const food = [
      makeFoodEntry({ date: "2025-01-15" }),
      makeFoodEntry({ date: "2025-01-14" }),
      makeFoodEntry({ date: "2025-01-13" }),
    ];
    const result = computeNutritionStreaks(food, [], targets);
    expect(result.food.current).toBe(3);
  });

  it("counts water streak including food water", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ water_ml: 3000 });
    const water = [makeWaterEntry({ date: "2025-01-15", amount_ml: 2500 })];
    const food = [makeFoodEntry({ date: "2025-01-15", water_ml: 600 })];
    const result = computeNutritionStreaks(food, water, targets);
    expect(result.water.current).toBe(1);
  });
});

describe("buildActivityMap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns correct number of days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets();
    const activity = buildActivityMap([], [], [], targets, 7);
    expect(activity).toHaveLength(7);
  });

  it("marks workout days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets();
    const workouts = [makeWorkout({ date: "2025-01-15" })];
    const activity = buildActivityMap(workouts, [], [], targets, 3);
    const today = activity.find((a) => a.date === "2025-01-15");
    expect(today?.workout).toBe(true);
  });

  it("scores days based on activities", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ protein_g: 50, water_ml: 500 });
    const workouts = [makeWorkout({ date: "2025-01-15" })];
    const food = [makeFoodEntry({ date: "2025-01-15", protein_g: 60 })];
    const water = [makeWaterEntry({ date: "2025-01-15", amount_ml: 600 })];
    const activity = buildActivityMap(workouts, food, water, targets, 1);
    expect(activity[0].score).toBe(4); // workout + food + protein + water
  });
});

describe("computeNutritionStreaks with undefined water_ml", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles food entries with undefined water_ml", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ protein_g: 50, water_ml: 500 });
    // Food entry with water_ml explicitly set to undefined
    const food = [
      {
        id: "f1",
        date: "2025-01-15",
        time: "12:00",
        name: "Test",
        servings: 1,
        calories: 100,
        protein_g: 60,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
        // water_ml is missing (undefined)
      } as any,
    ];
    const result = computeNutritionStreaks(food, [], targets);
    expect(result.protein.current).toBe(1);
    expect(result.water.current).toBe(0); // no water
  });

  it("handles food water_ml undefined with explicit water entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ water_ml: 500 });
    const food = [
      {
        id: "f1",
        date: "2025-01-15",
        time: "12:00",
        name: "Test",
        servings: 1,
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
      } as any,
    ]; // water_ml is undefined
    const water = [makeWaterEntry({ date: "2025-01-15", amount_ml: 600 })];
    const result = computeNutritionStreaks(food, water, targets);
    // Water target is 500, entry has 600 from explicit water, food water is 0 (undefined ?? 0)
    expect(result.water.current).toBe(1);
  });
});

describe("buildActivityMap with undefined water_ml", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles food entries with undefined water_ml", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets();
    const food = [
      {
        id: "f1",
        date: "2025-01-15",
        time: "12:00",
        name: "Test",
        servings: 1,
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
      } as any,
    ]; // water_ml is undefined
    const result = buildActivityMap([], food, [], targets, 1);
    expect(result).toHaveLength(1);
    expect(result[0].foodLogged).toBe(true);
  });
});

describe("buildAllStreaks", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("assembles streaks and activity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets();
    const result = buildAllStreaks([], [], [], targets);
    expect(result.streaks).toHaveLength(4);
    expect(result.streaks.map((s) => s.key)).toEqual([
      "lifting",
      "protein",
      "food",
      "water",
    ]);
    expect(result.activity).toHaveLength(30);
  });
});

describe("aggregateByDate duplicate-date branch (line 98)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups multiple food entries on the same date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ protein_g: 100 });
    // Two food entries on the same date trigger the if (arr) arr.push(e) branch
    const food = [
      makeFoodEntry({ date: "2025-01-15", protein_g: 60 }),
      makeFoodEntry({ date: "2025-01-15", protein_g: 50 }),
    ];
    const result = computeNutritionStreaks(food, [], targets);
    // Combined protein = 110 >= 100 target
    expect(result.protein.current).toBe(1);
  });
});

describe("computeDailyStreak broken streak branch (line 153)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets foundCurrent when streak breaks after today (i > 0)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ protein_g: 50 });
    // Today (Jan 15): food logged, protein hit
    // Yesterday (Jan 14): NO food logged -> breaks current streak at i=1 (i > 0), triggers foundCurrent
    // Jan 13: food logged, protein hit -> this starts a separate best run
    // Jan 12: food logged, protein hit
    const food = [
      makeFoodEntry({ date: "2025-01-15", protein_g: 60 }),
      // Jan 14 is skipped - no food entry
      makeFoodEntry({ date: "2025-01-13", protein_g: 60 }),
      makeFoodEntry({ date: "2025-01-12", protein_g: 60 }),
    ];
    const result = computeNutritionStreaks(food, [], targets);
    // Current food streak: only today (Jan 15) = 1
    expect(result.food.current).toBe(1);
    // Best food streak: Jan 12-13 = 2
    expect(result.food.best).toBe(2);
  });
});

describe("water entries on date with no food entries (line 153 ?? [] branch)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles water entries on a date that has no food entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ water_ml: 500 });
    // Water entry on Jan 15, but NO food entry on Jan 15
    // This triggers the ?? [] fallback on line 153 when foodByDate.get(date) returns undefined
    const water = [makeWaterEntry({ date: "2025-01-15", amount_ml: 600 })];
    const result = computeNutritionStreaks([], water, targets);
    // Water target met (600 >= 500) even with no food
    expect(result.water.current).toBe(1);
  });
});

describe("water from food on dates with no water entries (line 160)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts food water_ml towards water target when no explicit water entries exist for that date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ water_ml: 500 });
    // Food entry with water_ml > 0 on a date that has NO water entries
    const food = [makeFoodEntry({ date: "2025-01-15", water_ml: 600 })];
    // No water entries at all
    const result = computeNutritionStreaks(food, [], targets);
    // foodWater (600) >= target (500), so water streak = 1
    expect(result.water.current).toBe(1);
  });

  it("does not count food water when food water_ml is 0", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const targets = makeMacroTargets({ water_ml: 500 });
    // Food entry with water_ml = 0 on a date with no water entries
    const food = [makeFoodEntry({ date: "2025-01-15", water_ml: 0 })];
    const result = computeNutritionStreaks(food, [], targets);
    // foodWater is 0, so the date is NOT added to waterMlByDate
    expect(result.water.current).toBe(0);
  });
});
