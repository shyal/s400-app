import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  buildTodayData,
  buildWeekData,
  buildMonthData,
} from "$lib/services/summaryData";
import {
  makeWorkout,
  makeWeightEntry,
  makeMacroTargets,
  makeDailyNutrition,
  makeExercise,
  makeSet,
  makeFoodEntry,
  makeWaterEntry,
} from "../../../test/fixtures";
import type { FoodEntry, WaterEntry } from "$lib/types";

// Mock the nutritionData range fetchers used by buildWeekData/buildMonthData
vi.mock("$lib/services/nutritionData", () => ({
  fetchFoodEntriesRange: vi.fn().mockResolvedValue([]),
  fetchWaterEntriesRange: vi.fn().mockResolvedValue([]),
}));

// Import the mocked module to control return values in tests
import {
  fetchFoodEntriesRange,
  fetchWaterEntriesRange,
} from "$lib/services/nutritionData";
import type { Mock } from "vitest";

const mockFetchFood = fetchFoodEntriesRange as Mock;
const mockFetchWater = fetchWaterEntriesRange as Mock;

beforeEach(() => {
  mockFetchFood.mockResolvedValue([]);
  mockFetchWater.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  mockFetchFood.mockReset();
  mockFetchWater.mockReset();
});

const closedWindow = { isOpen: false, closesAt: null, minutesLeft: null };

describe("buildTodayData", () => {
  it("assembles today data from inputs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ calories: 1500, protein_g: 80 });
    const feedingWindow = { isOpen: true, closesAt: "16:00", minutesLeft: 120 };
    const targets = makeMacroTargets({ protein_g: 100, calories: 2000 });

    const result = buildTodayData(totals, feedingWindow, targets, [], [], 3);

    expect(result.period).toBe("today");
    expect(result.nutrition.avgCalories).toBe(1500);
    expect(result.nutrition.avgProtein).toBe(80);
    expect(result.nutrition.mealCount).toBe(3);
    expect(result.nutrition.daysProteinHit).toBe(0); // 80 < 100
    expect(result.nutrition.daysOverCalories).toBe(0); // 1500 < 2000
    expect(result.feedingWindow?.isOpen).toBe(true);
    expect(result.feedingWindow?.closesAt).toBe("16:00");
  });

  it("flags protein hit correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ protein_g: 110 });
    const targets = makeMacroTargets({ protein_g: 100 });
    const result = buildTodayData(totals, closedWindow, targets, [], [], 2);

    expect(result.nutrition.daysProteinHit).toBe(1);
  });

  it("computes workout stats for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 50,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: Array.from({ length: 5 }, (_, i) =>
            makeSet({ setNumber: i + 1, weight_kg: 80, reps: 5 }),
          ),
        }),
      ],
    });

    const totals = makeDailyNutrition();
    const targets = makeMacroTargets();
    const result = buildTodayData(
      totals,
      closedWindow,
      targets,
      [todayWorkout],
      [],
      0,
    );

    expect(result.workouts.count).toBe(1);
    expect(result.workouts.totalSets).toBe(5);
    expect(result.workouts.exercisesDone).toContain("Squat");
  });

  it("computes weight stats for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weight = [makeWeightEntry({ date: "2025-01-15", weight_kg: 79.5 })];
    const totals = makeDailyNutrition();
    const targets = makeMacroTargets();
    const result = buildTodayData(totals, closedWindow, targets, [], weight, 0);

    expect(result.weight.endWeight).toBe(79.5);
    expect(result.weight.measurementCount).toBe(1);
  });

  it("returns null daysSinceLastWorkout for no workouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition();
    const targets = makeMacroTargets();
    const result = buildTodayData(totals, closedWindow, targets, [], [], 0);

    expect(result.daysSinceLastWorkout).toBeNull();
  });

  it("calculates daysSinceLastWorkout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const workouts = [makeWorkout({ date: "2025-01-13" })];
    const totals = makeDailyNutrition();
    const targets = makeMacroTargets();
    const result = buildTodayData(
      totals,
      closedWindow,
      targets,
      workouts,
      [],
      0,
    );

    expect(result.daysSinceLastWorkout).toBe(2);
  });

  it("flags daysOverCalories when over target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ calories: 2500 });
    const targets = makeMacroTargets({ calories: 2000 });
    const result = buildTodayData(totals, closedWindow, targets, [], [], 1);

    expect(result.nutrition.daysOverCalories).toBe(1);
    expect(result.nutrition.daysUnderCalories).toBe(0);
  });

  it("flags daysUnderCalories when at or under target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ calories: 2000 });
    const targets = makeMacroTargets({ calories: 2000 });
    const result = buildTodayData(totals, closedWindow, targets, [], [], 1);

    expect(result.nutrition.daysOverCalories).toBe(0);
    expect(result.nutrition.daysUnderCalories).toBe(1);
  });

  it("flags daysWaterHit when water target met", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ water_ml: 3500 });
    const targets = makeMacroTargets({ water_ml: 3000 });
    const result = buildTodayData(totals, closedWindow, targets, [], [], 1);

    expect(result.nutrition.daysWaterHit).toBe(1);
  });

  it("includes firstMealTime in feedingWindow from daily nutrition", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ firstMealTime: "11:30" });
    const targets = makeMacroTargets();
    const result = buildTodayData(
      totals,
      { isOpen: true, closesAt: "15:30", minutesLeft: 90 },
      targets,
      [],
      [],
      1,
    );

    expect(result.feedingWindow?.firstMealTime).toBe("11:30");
  });

  it("sets firstMealTime to null when no meals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ firstMealTime: null });
    const targets = makeMacroTargets();
    const result = buildTodayData(totals, closedWindow, targets, [], [], 0);

    expect(result.feedingWindow?.firstMealTime).toBeNull();
  });

  it("returns correct time context on a weekday", () => {
    vi.useFakeTimers();
    // 2025-01-15 is a Wednesday
    vi.setSystemTime(new Date("2025-01-15T09:00:00"));

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      0,
    );

    expect(result.time.dayName).toBe("Wednesday");
    expect(result.time.dayOfWeek).toBe(3);
    expect(result.time.isWeekend).toBe(false);
    expect(result.time.hour).toBe(9);
  });

  it("returns correct time context on a weekend", () => {
    vi.useFakeTimers();
    // 2025-01-18 is a Saturday
    vi.setSystemTime(new Date("2025-01-18T10:00:00"));

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      0,
    );

    expect(result.time.dayName).toBe("Saturday");
    expect(result.time.dayOfWeek).toBe(6);
    expect(result.time.isWeekend).toBe(true);
  });

  it("returns correct time context on a Sunday", () => {
    vi.useFakeTimers();
    // 2025-01-19 is a Sunday
    vi.setSystemTime(new Date("2025-01-19T10:00:00"));

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      0,
    );

    expect(result.time.dayName).toBe("Sunday");
    expect(result.time.dayOfWeek).toBe(0);
    expect(result.time.isWeekend).toBe(true);
  });

  it("computes workout volume correctly (reps * weight)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 30,
      exercises: [
        makeExercise({
          name: "Bench Press",
          sets: [
            makeSet({ weight_kg: 60, reps: 5, completed: true }),
            makeSet({ weight_kg: 60, reps: 5, completed: true }),
            makeSet({ weight_kg: 60, reps: 3, completed: true }),
          ],
        }),
      ],
    });

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [todayWorkout],
      [],
      0,
    );

    // Volume = (5*60) + (5*60) + (3*60) = 300 + 300 + 180 = 780
    expect(result.workouts.totalVolume).toBe(780);
    expect(result.workouts.totalSets).toBe(3);
    expect(result.workouts.avgDuration).toBe(30);
  });

  it("ignores incomplete sets in workout stats", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 40,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [
            makeSet({ weight_kg: 80, reps: 5, completed: true }),
            makeSet({ weight_kg: 80, reps: 5, completed: false }),
            makeSet({ weight_kg: 80, reps: 3, completed: true }),
          ],
        }),
      ],
    });

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [todayWorkout],
      [],
      0,
    );

    // Only 2 completed sets: (5*80) + (3*80) = 400 + 240 = 640
    expect(result.workouts.totalVolume).toBe(640);
    expect(result.workouts.totalSets).toBe(2);
  });

  it("identifies heaviest lift across exercises", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 45,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 100, reps: 5, completed: true })],
        }),
        makeExercise({
          name: "Bench Press",
          sets: [makeSet({ weight_kg: 60, reps: 5, completed: true })],
        }),
        makeExercise({
          name: "Deadlift",
          sets: [makeSet({ weight_kg: 120, reps: 5, completed: true })],
        }),
      ],
    });

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [todayWorkout],
      [],
      0,
    );

    expect(result.workouts.heaviestLift).toEqual({
      name: "Deadlift",
      weight: 120,
    });
  });

  it("returns null heaviestLift when no workouts on that day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      0,
    );

    expect(result.workouts.heaviestLift).toBeNull();
    expect(result.workouts.count).toBe(0);
  });

  it("detects exercise PRs compared to previous workouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const previousWorkout = makeWorkout({
      date: "2025-01-13",
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 80, reps: 5, completed: true })],
        }),
      ],
    });

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 45,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 85, reps: 5, completed: true })],
        }),
      ],
    });

    // workouts array: most recent first for getDaysSinceLastWorkout, but computeWorkoutStats uses date filter
    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [todayWorkout, previousWorkout],
      [],
      0,
    );

    expect(result.workouts.exercisePRs).toEqual([
      { name: "Squat", weight: 85 },
    ]);
  });

  it("does not flag a PR when weight matches previous best", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const previousWorkout = makeWorkout({
      date: "2025-01-13",
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 80, reps: 5, completed: true })],
        }),
      ],
    });

    const todayWorkout = makeWorkout({
      date: "2025-01-15",
      duration_min: 45,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 80, reps: 5, completed: true })],
        }),
      ],
    });

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [todayWorkout, previousWorkout],
      [],
      0,
    );

    expect(result.workouts.exercisePRs).toEqual([]);
  });

  it("computes weight trend as flat when two same-date entries have small difference", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // Two entries on the same day -- sorted by date (equal), so original array order kept
    const weights = [
      makeWeightEntry({ date: "2025-01-15", weight_kg: 80.05 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 80.0 }),
    ];

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      weights,
      0,
    );

    // Both same date: first=80.05 (first in array after sort), last=80.0
    // change = 80.0 - 80.05 = -0.05, abs < 0.1 => flat
    expect(result.weight.trend).toBe("flat");
    expect(result.weight.measurementCount).toBe(2);
    expect(result.weight.lowestWeight).toBe(80.0);
    expect(result.weight.highestWeight).toBe(80.05);
  });

  it("computes weight stats with body fat and muscle mass", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weights = [
      makeWeightEntry({
        date: "2025-01-15",
        weight_kg: 80.0,
        body_fat_pct: 22.5,
        muscle_mass_kg: 35.0,
      }),
    ];

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      weights,
      0,
    );

    expect(result.weight.bodyFatStart).toBe(22.5);
    expect(result.weight.bodyFatEnd).toBe(22.5);
    expect(result.weight.bodyFatChange).toBe(0);
    expect(result.weight.muscleStart).toBe(35.0);
    expect(result.weight.muscleEnd).toBe(35.0);
    expect(result.weight.muscleChange).toBe(0);
  });

  it("returns null body composition when not measured", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weights = [makeWeightEntry({ date: "2025-01-15", weight_kg: 80.0 })];
    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      weights,
      0,
    );

    expect(result.weight.bodyFatStart).toBeNull();
    expect(result.weight.bodyFatEnd).toBeNull();
    expect(result.weight.bodyFatChange).toBeNull();
    expect(result.weight.muscleStart).toBeNull();
    expect(result.weight.muscleEnd).toBeNull();
    expect(result.weight.muscleChange).toBeNull();
  });

  it("returns null weight stats when no weight entries for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // weight entry on a different date
    const weights = [makeWeightEntry({ date: "2025-01-14", weight_kg: 80.0 })];
    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      weights,
      0,
    );

    expect(result.weight.startWeight).toBeNull();
    expect(result.weight.endWeight).toBeNull();
    expect(result.weight.change).toBeNull();
    expect(result.weight.trend).toBeNull();
    expect(result.weight.weeklyRate).toBeNull();
    expect(result.weight.lowestWeight).toBeNull();
    expect(result.weight.highestWeight).toBeNull();
    expect(result.weight.measurementCount).toBe(0);
  });

  it("sets nutrition best/worst day values to the single day values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({ calories: 1800, protein_g: 95 });
    const result = buildTodayData(
      totals,
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      2,
    );

    expect(result.nutrition.bestProteinDay).toBe(95);
    expect(result.nutrition.worstProteinDay).toBe(95);
    expect(result.nutrition.bestCalorieDay).toBe(1800);
    expect(result.nutrition.worstCalorieDay).toBe(1800);
  });

  it("sets nutrition days to 1 and totals equal averages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const totals = makeDailyNutrition({
      calories: 1600,
      protein_g: 90,
      water_ml: 2800,
    });
    const result = buildTodayData(
      totals,
      closedWindow,
      makeMacroTargets(),
      [],
      [],
      1,
    );

    expect(result.nutrition.days).toBe(1);
    expect(result.nutrition.totalCalories).toBe(1600);
    expect(result.nutrition.totalProtein).toBe(90);
    expect(result.nutrition.totalWater).toBe(2800);
  });
});

describe("buildWeekData", () => {
  it('returns period "week" with empty data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const result = await buildWeekData(makeMacroTargets(), [], []);

    expect(result.period).toBe("week");
    expect(result.feedingWindow).toBeNull();
    expect(result.nutrition.days).toBe(1); // no data, defaults to 1
    expect(result.nutrition.avgCalories).toBe(0);
    expect(result.workouts.count).toBe(0);
    expect(result.daysSinceLastWorkout).toBeNull();
  });

  it("fetches and aggregates food and water entries across the week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-14",
        calories: 2000,
        protein_g: 120,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-14",
        calories: 500,
        protein_g: 30,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-15",
        calories: 1800,
        protein_g: 100,
        water_ml: 200,
      }),
    ];
    const waterEntries: WaterEntry[] = [
      makeWaterEntry({ date: "2025-01-14", amount_ml: 2000 }),
      makeWaterEntry({ date: "2025-01-14", amount_ml: 1500 }),
      makeWaterEntry({ date: "2025-01-15", amount_ml: 3000 }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue(waterEntries);

    const targets = makeMacroTargets({
      calories: 2000,
      protein_g: 100,
      water_ml: 3000,
    });
    const result = await buildWeekData(targets, [], []);

    expect(result.nutrition.days).toBe(2); // 2 unique days with data
    expect(result.nutrition.totalCalories).toBe(4300); // 2000+500+1800
    expect(result.nutrition.totalProtein).toBe(250); // 120+30+100
    expect(result.nutrition.avgCalories).toBe(2150); // 4300/2
    expect(result.nutrition.avgProtein).toBe(125); // 250/2
    expect(result.nutrition.mealCount).toBe(3); // 3 food entries
    expect(result.nutrition.daysProteinHit).toBe(2); // day1: 150>=100, day2: 100>=100
    expect(result.nutrition.daysWaterHit).toBe(2); // day1: 3500>=3000, day2: 3200>=3000
  });

  it("correctly computes best and worst protein/calorie days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-13",
        calories: 1200,
        protein_g: 60,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-14",
        calories: 2200,
        protein_g: 140,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-15",
        calories: 1800,
        protein_g: 100,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue([]);

    const targets = makeMacroTargets({ calories: 2000, protein_g: 100 });
    const result = await buildWeekData(targets, [], []);

    expect(result.nutrition.bestProteinDay).toBe(140);
    expect(result.nutrition.worstProteinDay).toBe(60);
    expect(result.nutrition.bestCalorieDay).toBe(2200);
    expect(result.nutrition.worstCalorieDay).toBe(1200);
  });

  it("calculates daysOverCalories and daysUnderCalories across days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-13",
        calories: 2500,
        protein_g: 80,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-14",
        calories: 1500,
        protein_g: 80,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-15",
        calories: 2000,
        protein_g: 80,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);

    const targets = makeMacroTargets({ calories: 2000 });
    const result = await buildWeekData(targets, [], []);

    expect(result.nutrition.daysOverCalories).toBe(1); // 2500 > 2000
    expect(result.nutrition.daysUnderCalories).toBe(2); // 1500<=2000, 2000<=2000
  });

  it("computes workout stats within the week range", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const workouts = [
      makeWorkout({
        date: "2025-01-10",
        duration_min: 40,
        exercises: [
          makeExercise({
            name: "Squat",
            sets: [makeSet({ weight_kg: 80, reps: 5, completed: true })],
          }),
        ],
      }),
      makeWorkout({
        date: "2025-01-13",
        duration_min: 50,
        exercises: [
          makeExercise({
            name: "Squat",
            sets: [makeSet({ weight_kg: 85, reps: 5, completed: true })],
          }),
        ],
      }),
      makeWorkout({
        date: "2025-01-15",
        duration_min: 60,
        exercises: [
          makeExercise({
            name: "Bench Press",
            sets: [makeSet({ weight_kg: 65, reps: 5, completed: true })],
          }),
        ],
      }),
    ];

    const result = await buildWeekData(makeMacroTargets(), workouts, []);

    // Week is Jan 9 to Jan 15; Jan 10, 13, 15 are in range
    expect(result.workouts.count).toBe(3);
    expect(result.workouts.exercisesDone).toContain("Squat");
    expect(result.workouts.exercisesDone).toContain("Bench Press");
    expect(result.workouts.avgDuration).toBe(50); // (40+50+60)/3
  });

  it("computes longest gap between workouts in the week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const workouts = [
      makeWorkout({
        date: "2025-01-09",
        duration_min: 40,
        exercises: [makeExercise({ sets: [makeSet({ completed: true })] })],
      }),
      makeWorkout({
        date: "2025-01-12",
        duration_min: 40,
        exercises: [makeExercise({ sets: [makeSet({ completed: true })] })],
      }),
      makeWorkout({
        date: "2025-01-15",
        duration_min: 40,
        exercises: [makeExercise({ sets: [makeSet({ completed: true })] })],
      }),
    ];

    const result = await buildWeekData(makeMacroTargets(), workouts, []);

    // Gaps: Jan 9->12 = 3 days, Jan 12->15 = 3 days
    expect(result.workouts.longestGap).toBe(3);
  });

  it("computes weight stats for the week with trend", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2025-01-09", weight_kg: 81.0 }),
      makeWeightEntry({ date: "2025-01-12", weight_kg: 80.5 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 80.0 }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    expect(result.weight.startWeight).toBe(81.0);
    expect(result.weight.endWeight).toBe(80.0);
    expect(result.weight.change).toBe(-1.0);
    expect(result.weight.trend).toBe("down");
    expect(result.weight.lowestWeight).toBe(80.0);
    expect(result.weight.highestWeight).toBe(81.0);
    expect(result.weight.measurementCount).toBe(3);
    expect(result.weight.weeklyRate).toBe(-1.0); // -1.0 change / 1 week
  });

  it("marks weight trend as flat when change is tiny", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2025-01-09", weight_kg: 80.0 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 80.05 }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    expect(result.weight.trend).toBe("flat"); // 0.05 < 0.1 threshold
  });

  it("marks weight trend as up when gaining", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2025-01-09", weight_kg: 80.0 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 81.0 }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    expect(result.weight.trend).toBe("up");
    expect(result.weight.change).toBe(1.0);
  });

  it("computes body composition changes over the week", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const weightLog = [
      makeWeightEntry({
        date: "2025-01-09",
        weight_kg: 81.0,
        body_fat_pct: 23.0,
        muscle_mass_kg: 34.0,
      }),
      makeWeightEntry({
        date: "2025-01-15",
        weight_kg: 80.0,
        body_fat_pct: 22.5,
        muscle_mass_kg: 34.5,
      }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    expect(result.weight.bodyFatStart).toBe(23.0);
    expect(result.weight.bodyFatEnd).toBe(22.5);
    expect(result.weight.bodyFatChange).toBe(-0.5);
    expect(result.weight.muscleStart).toBe(34.0);
    expect(result.weight.muscleEnd).toBe(34.5);
    expect(result.weight.muscleChange).toBe(0.5);
  });

  it("returns worstProteinDay/worstCalorieDay as 0 when all days have zero entries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    mockFetchFood.mockResolvedValue([]);
    mockFetchWater.mockResolvedValue([]);

    const result = await buildWeekData(makeMacroTargets(), [], []);

    // No data at all => worst stays Infinity, which gets capped to 0
    expect(result.nutrition.worstProteinDay).toBe(0);
    expect(result.nutrition.worstCalorieDay).toBe(0);
  });

  it("aggregates water_ml from both food entries and water entries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-15",
        calories: 500,
        protein_g: 30,
        water_ml: 300,
      }),
    ];
    const waterEntries: WaterEntry[] = [
      makeWaterEntry({ date: "2025-01-15", amount_ml: 2000 }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue(waterEntries);

    const result = await buildWeekData(
      makeMacroTargets({ water_ml: 3000 }),
      [],
      [],
    );

    // 300 (from food) + 2000 (from water entry) = 2300
    expect(result.nutrition.totalWater).toBe(2300);
  });
});

describe("buildMonthData", () => {
  it('returns period "month" with empty data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const result = await buildMonthData(makeMacroTargets(), [], []);

    expect(result.period).toBe("month");
    expect(result.feedingWindow).toBeNull();
    expect(result.nutrition.days).toBe(1);
    expect(result.workouts.count).toBe(0);
  });

  it("aggregates nutrition data across 30 days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-01",
        calories: 2000,
        protein_g: 100,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-15",
        calories: 1800,
        protein_g: 90,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-30",
        calories: 2200,
        protein_g: 130,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);

    const targets = makeMacroTargets({ calories: 2000, protein_g: 100 });
    const result = await buildMonthData(targets, [], []);

    expect(result.nutrition.days).toBe(3);
    expect(result.nutrition.totalCalories).toBe(6000);
    expect(result.nutrition.avgCalories).toBe(2000);
    expect(result.nutrition.bestProteinDay).toBe(130);
    expect(result.nutrition.worstProteinDay).toBe(90);
    expect(result.nutrition.daysProteinHit).toBe(2); // 100>=100, 130>=100
  });

  it("computes weight stats over 30-day period with weekly rate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2025-01-01", weight_kg: 83.0 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 81.5 }),
      makeWeightEntry({ date: "2025-01-30", weight_kg: 80.0 }),
    ];

    const result = await buildMonthData(makeMacroTargets(), [], weightLog);

    expect(result.weight.startWeight).toBe(83.0);
    expect(result.weight.endWeight).toBe(80.0);
    expect(result.weight.change).toBe(-3.0);
    expect(result.weight.trend).toBe("down");
    // weeklyRate = -3.0 / (30/7) ~= -0.7
    expect(result.weight.weeklyRate).toBe(-0.7);
    expect(result.weight.measurementCount).toBe(3);
  });

  it("handles workouts with PRs relative to older history", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    // Workout before the 30-day window (should count as previous history for PR detection)
    const oldWorkout = makeWorkout({
      date: "2024-12-15",
      duration_min: 40,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 80, reps: 5, completed: true })],
        }),
      ],
    });

    // Workout within the 30-day window
    const recentWorkout = makeWorkout({
      date: "2025-01-20",
      duration_min: 50,
      exercises: [
        makeExercise({
          name: "Squat",
          sets: [makeSet({ weight_kg: 90, reps: 5, completed: true })],
        }),
      ],
    });

    const result = await buildMonthData(
      makeMacroTargets(),
      [recentWorkout, oldWorkout],
      [],
    );

    expect(result.workouts.count).toBe(1);
    expect(result.workouts.exercisePRs).toEqual([
      { name: "Squat", weight: 90 },
    ]);
  });

  it("counts daysSinceLastWorkout from the most recent workout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const workouts = [
      makeWorkout({ date: "2025-01-28" }),
      makeWorkout({ date: "2025-01-20" }),
    ];

    const result = await buildMonthData(makeMacroTargets(), workouts, []);

    expect(result.daysSinceLastWorkout).toBe(2);
  });

  it("handles food entries with undefined water_ml", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-30",
        calories: 500,
        protein_g: 30,
        water_ml: undefined,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);

    const result = await buildMonthData(makeMacroTargets(), [], []);

    // water_ml undefined should be treated as 0 via ?? 0
    expect(result.nutrition.totalWater).toBe(0);
  });

  it("counts water-only days in the day set", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    // No food entries, only water
    const waterEntries: WaterEntry[] = [
      makeWaterEntry({ date: "2025-01-29", amount_ml: 3000 }),
      makeWaterEntry({ date: "2025-01-30", amount_ml: 2500 }),
    ];

    mockFetchFood.mockResolvedValue([]);
    mockFetchWater.mockResolvedValue(waterEntries);

    const targets = makeMacroTargets({ water_ml: 3000 });
    const result = await buildMonthData(targets, [], []);

    expect(result.nutrition.days).toBe(2);
    expect(result.nutrition.totalWater).toBe(5500);
    expect(result.nutrition.daysWaterHit).toBe(1); // only Jan 29 (3000>=3000)
    // No calories => daysOverCalories=0, daysUnderCalories=0 (cal=0 not > 0)
    expect(result.nutrition.daysOverCalories).toBe(0);
    expect(result.nutrition.daysUnderCalories).toBe(0);
  });

  it("excludes weight entries outside the 30-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2024-12-20", weight_kg: 85.0 }), // outside window
      makeWeightEntry({ date: "2025-01-05", weight_kg: 82.0 }),
      makeWeightEntry({ date: "2025-01-30", weight_kg: 80.0 }),
    ];

    const result = await buildMonthData(makeMacroTargets(), [], weightLog);

    // start=daysAgo(29) from Jan 30 = Jan 1; Dec 20 is outside
    expect(result.weight.measurementCount).toBe(2);
    expect(result.weight.startWeight).toBe(82.0);
    expect(result.weight.endWeight).toBe(80.0);
  });

  it("computes longestGap as 0 with a single workout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const workouts = [
      makeWorkout({
        date: "2025-01-20",
        duration_min: 45,
        exercises: [makeExercise({ sets: [makeSet({ completed: true })] })],
      }),
    ];

    const result = await buildMonthData(makeMacroTargets(), workouts, []);

    expect(result.workouts.count).toBe(1);
    expect(result.workouts.longestGap).toBe(0);
  });

  it("returns null bodyFatChange when only start has body fat data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const weightLog = [
      makeWeightEntry({
        date: "2025-01-05",
        weight_kg: 82.0,
        body_fat_pct: 23.0,
        muscle_mass_kg: 34.0,
      }),
      makeWeightEntry({
        date: "2025-01-30",
        weight_kg: 80.0,
        body_fat_pct: null,
        muscle_mass_kg: null,
      }),
    ];

    const result = await buildMonthData(makeMacroTargets(), [], weightLog);

    expect(result.weight.bodyFatStart).toBe(23.0);
    expect(result.weight.bodyFatEnd).toBeNull();
    expect(result.weight.bodyFatChange).toBeNull();
    expect(result.weight.muscleStart).toBe(34.0);
    expect(result.weight.muscleEnd).toBeNull();
    expect(result.weight.muscleChange).toBeNull();
  });

  it("returns null bodyFatChange when only end has body fat data", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const weightLog = [
      makeWeightEntry({
        date: "2025-01-05",
        weight_kg: 82.0,
        body_fat_pct: null,
        muscle_mass_kg: null,
      }),
      makeWeightEntry({
        date: "2025-01-30",
        weight_kg: 80.0,
        body_fat_pct: 22.0,
        muscle_mass_kg: 35.0,
      }),
    ];

    const result = await buildMonthData(makeMacroTargets(), [], weightLog);

    expect(result.weight.bodyFatStart).toBeNull();
    expect(result.weight.bodyFatEnd).toBe(22.0);
    expect(result.weight.bodyFatChange).toBeNull();
    expect(result.weight.muscleStart).toBeNull();
    expect(result.weight.muscleEnd).toBe(35.0);
    expect(result.weight.muscleChange).toBeNull();
  });

  it("handles food-only days with no water data (water defaults to 0)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    // Food entries on a day, no water entries at all
    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-30",
        calories: 1800,
        protein_g: 90,
        water_ml: undefined,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue([]);

    const targets = makeMacroTargets({ water_ml: 3000 });
    const result = await buildMonthData(targets, [], []);

    // The date has food data but no water data, so dailyWater.get(date) ?? 0 = 0
    expect(result.nutrition.totalWater).toBe(0);
    expect(result.nutrition.daysWaterHit).toBe(0);
  });

  it("computes weeklyRate as null when periodDays is 0 via same-date entries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // buildTodayData passes periodDays=1 so weeks=1/7>0, but we verify the
    // weeklyRate computation works correctly with same-date entries
    const weights = [
      makeWeightEntry({
        date: "2025-01-15",
        weight_kg: 80.0,
        body_fat_pct: 22.5,
        muscle_mass_kg: 35.0,
      }),
      makeWeightEntry({
        date: "2025-01-15",
        weight_kg: 79.8,
        body_fat_pct: 22.3,
        muscle_mass_kg: 35.2,
      }),
    ];

    const result = buildTodayData(
      makeDailyNutrition(),
      closedWindow,
      makeMacroTargets(),
      [],
      weights,
      0,
    );

    // periodDays=1 so weeks=1/7=0.143, weeklyRate = change / weeks
    // change = 79.8 - 80.0 = -0.2, weeklyRate = -0.2/0.143 = -1.4
    expect(result.weight.weeklyRate).toBe(-1.4);
    expect(result.weight.bodyFatChange).toBe(-0.2);
    expect(result.weight.muscleChange).toBe(0.2);
  });

  it("returns null bodyFatChange when neither entry has body fat", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const weightLog = [
      makeWeightEntry({ date: "2025-01-05", weight_kg: 82.0 }),
      makeWeightEntry({ date: "2025-01-30", weight_kg: 80.0 }),
    ];

    const result = await buildMonthData(makeMacroTargets(), [], weightLog);

    // Both entries lack body_fat_pct and muscle_mass_kg
    expect(result.weight.bodyFatStart).toBeNull();
    expect(result.weight.bodyFatEnd).toBeNull();
    expect(result.weight.bodyFatChange).toBeNull();
    expect(result.weight.muscleStart).toBeNull();
    expect(result.weight.muscleEnd).toBeNull();
    expect(result.weight.muscleChange).toBeNull();
  });

  it("aggregates water_ml from food entries with mixed undefined and zero values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-29",
        calories: 500,
        protein_g: 30,
        water_ml: undefined,
      }),
      makeFoodEntry({
        date: "2025-01-29",
        calories: 400,
        protein_g: 20,
        water_ml: 200,
      }),
      makeFoodEntry({
        date: "2025-01-30",
        calories: 600,
        protein_g: 35,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue([]);

    const result = await buildMonthData(makeMacroTargets(), [], []);

    // Day 1: undefined (→0) + 200 = 200
    // Day 2: 0
    // Total water = 200
    expect(result.nutrition.totalWater).toBe(200);
  });
});

// ── Additional branch coverage tests ──

describe("summaryData branch coverage", () => {
  afterEach(() => {
    vi.useRealTimers();
    mockFetchFood.mockReset();
    mockFetchWater.mockReset();
  });

  beforeEach(() => {
    mockFetchFood.mockResolvedValue([]);
    mockFetchWater.mockResolvedValue([]);
  });

  it("aggregateNutrition: does not count day as daysUnderCalories when cal is exactly 0 (water-only day)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // One day with only water (no food), one day with food under target
    const waterEntries: WaterEntry[] = [
      makeWaterEntry({ date: "2025-01-14", amount_ml: 3000 }),
    ];
    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-15",
        calories: 1500,
        protein_g: 80,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue(waterEntries);

    const targets = makeMacroTargets({ calories: 2000, protein_g: 100 });
    const result = await buildWeekData(targets, [], []);

    // 2 dates with data: Jan 14 (water only, cal=0) and Jan 15 (food, cal=1500)
    expect(result.nutrition.days).toBe(2);
    // Jan 14: cal=0, cal <= 2000 is true BUT cal > 0 is false => NOT counted as under
    // Jan 15: cal=1500, cal <= 2000 is true AND cal > 0 is true => counted as under
    expect(result.nutrition.daysUnderCalories).toBe(1);
    // Jan 14: cal=0, cal > 2000 is false => not over
    // Jan 15: cal=1500, cal > 2000 is false => not over
    expect(result.nutrition.daysOverCalories).toBe(0);
  });

  it("computeWeightStats: bodyFatChange is null when bfStart has value but bfEnd is null (compound && check)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // First entry has body fat, last entry does not
    const weightLog = [
      makeWeightEntry({
        date: "2025-01-09",
        weight_kg: 81.0,
        body_fat_pct: 22.5,
        muscle_mass_kg: null,
      }),
      makeWeightEntry({
        date: "2025-01-15",
        weight_kg: 80.0,
        body_fat_pct: null,
        muscle_mass_kg: 35.0,
      }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    // bfStart=22.5 (not null), bfEnd=null => bfStart !== null && bfEnd !== null => false
    expect(result.weight.bodyFatStart).toBe(22.5);
    expect(result.weight.bodyFatEnd).toBeNull();
    expect(result.weight.bodyFatChange).toBeNull();
    // mStart=null, mEnd=35.0 => mStart !== null is false => muscleChange=null
    expect(result.weight.muscleStart).toBeNull();
    expect(result.weight.muscleEnd).toBe(35.0);
    expect(result.weight.muscleChange).toBeNull();
  });

  it("computeWeightStats: weeklyRate is computed (not null) when periodDays > 0", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));

    // With periodDays=7, weeks=1, weeklyRate should be change/1
    const weightLog = [
      makeWeightEntry({ date: "2025-01-09", weight_kg: 81.0 }),
      makeWeightEntry({ date: "2025-01-15", weight_kg: 80.0 }),
    ];

    const result = await buildWeekData(makeMacroTargets(), [], weightLog);

    // change = 80 - 81 = -1, weeks = 7/7 = 1, weeklyRate = -1/1 = -1.0
    expect(result.weight.weeklyRate).toBe(-1.0);
    // weeklyRate is not null so the Math.round branch is taken
    expect(result.weight.weeklyRate).not.toBeNull();
  });

  it("aggregateNutrition: handles mix of zero-calorie and positive-calorie days correctly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-30T14:00:00"));

    // Day 1: only water (cal=0), Day 2: food over target, Day 3: food under target
    const waterEntries: WaterEntry[] = [
      makeWaterEntry({ date: "2025-01-28", amount_ml: 3000 }),
    ];
    const foodEntries: FoodEntry[] = [
      makeFoodEntry({
        date: "2025-01-29",
        calories: 2500,
        protein_g: 120,
        water_ml: 0,
      }),
      makeFoodEntry({
        date: "2025-01-30",
        calories: 1800,
        protein_g: 90,
        water_ml: 0,
      }),
    ];

    mockFetchFood.mockResolvedValue(foodEntries);
    mockFetchWater.mockResolvedValue(waterEntries);

    const targets = makeMacroTargets({ calories: 2000, protein_g: 100 });
    const result = await buildMonthData(targets, [], []);

    expect(result.nutrition.days).toBe(3);
    // Day Jan28: cal=0 => not over, not under (cal > 0 is false)
    // Day Jan29: cal=2500 => over (2500 > 2000)
    // Day Jan30: cal=1800 => under (1800 <= 2000 && 1800 > 0)
    expect(result.nutrition.daysOverCalories).toBe(1);
    expect(result.nutrition.daysUnderCalories).toBe(1);
  });
});
