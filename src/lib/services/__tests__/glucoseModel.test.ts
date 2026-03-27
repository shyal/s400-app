import { describe, it, expect } from "vitest";
import {
  defaultParams,
  glucoseRise,
  mealPeakTime,
  gammaResponse,
  circadianModifier,
  dawnPhenomenonCurve,
  exerciseModifier,
  gymModifier,
  predictGlucoseCurve,
  foodEntryToMealEvent,
  stravaToExerciseEvent,
  aggregateMeals,
  type MealEvent,
  type ExerciseEvent,
} from "$lib/services/glucoseModel";
import { makeFoodEntry } from "../../../test/fixtures";

// ── Helper ──

function makeMeal(overrides: Partial<MealEvent> = {}): MealEvent {
  return {
    timeMin: 12 * 60,
    netCarbs: 50,
    protein: 30,
    fat: 15,
    totalGrams: 95,
    ...overrides,
  };
}

function makeExercise(overrides: Partial<ExerciseEvent> = {}): ExerciseEvent {
  return {
    startMin: 13 * 60,
    endMin: 13 * 60 + 30,
    intensityFactor: 0.7,
    ...overrides,
  };
}

// ── defaultParams ──

describe("defaultParams", () => {
  it("returns physiological defaults", () => {
    const p = defaultParams();
    expect(p.fasting_baseline_mgdl).toBe(90);
    expect(p.carb_sensitivity).toBe(4.0);
    expect(p.protein_sensitivity).toBe(0.7);
    expect(p.fat_delay_factor).toBe(1.0);
    expect(p.exercise_reduction_pct).toBe(30);
    expect(p.gym_sensitivity_hours).toBe(36);
    expect(p.gym_sensitivity_pct).toBe(15);
    expect(p.circadian_evening_pct).toBe(10);
    expect(p.dawn_phenomenon_mgdl).toBe(10);
    expect(p.peak_time_min).toBe(30);
    expect(p.curve_shape_k).toBe(2);
    expect(p.data_points_used).toBe(0);
    expect(p.last_fit_at).toBeNull();
  });
});

// ── glucoseRise ──

describe("glucoseRise", () => {
  const params = defaultParams();

  it("computes rise from carbs and protein", () => {
    const meal = makeMeal({ netCarbs: 50, protein: 30 });
    // 50 * 4.0 + 30 * 0.7 = 200 + 21 = 221
    expect(glucoseRise(meal, params)).toBeCloseTo(221, 1);
  });

  it("returns 0 for zero-macro meal", () => {
    const meal = makeMeal({ netCarbs: 0, protein: 0 });
    expect(glucoseRise(meal, params)).toBe(0);
  });

  it("uses custom sensitivity params", () => {
    const customParams = {
      ...defaultParams(),
      carb_sensitivity: 3.0,
      protein_sensitivity: 1.0,
    };
    const meal = makeMeal({ netCarbs: 10, protein: 10 });
    expect(glucoseRise(meal, customParams)).toBeCloseTo(40, 1);
  });
});

// ── mealPeakTime ──

describe("mealPeakTime", () => {
  const params = defaultParams();

  it("returns base peak time for zero-fat meal", () => {
    const meal = makeMeal({ fat: 0, totalGrams: 80 });
    expect(mealPeakTime(meal, params)).toBe(30);
  });

  it("delays peak for fat-heavy meal", () => {
    const meal = makeMeal({ fat: 40, totalGrams: 100 });
    // 30 * (1 + 1.0 * 0.4) = 30 * 1.4 = 42
    expect(mealPeakTime(meal, params)).toBeCloseTo(42, 1);
  });

  it("handles zero totalGrams gracefully", () => {
    const meal = makeMeal({ fat: 10, totalGrams: 0 });
    expect(mealPeakTime(meal, params)).toBe(30);
  });
});

// ── gammaResponse ──

describe("gammaResponse", () => {
  it("returns 0 at t=0", () => {
    expect(gammaResponse(0, 30, 2)).toBe(0);
  });

  it("returns 0 for negative elapsed", () => {
    expect(gammaResponse(-5, 30, 2)).toBe(0);
  });

  it("peaks at t = peakTime", () => {
    const atPeak = gammaResponse(30, 30, 2);
    const before = gammaResponse(20, 30, 2);
    const after = gammaResponse(40, 30, 2);
    expect(atPeak).toBeCloseTo(1.0, 2);
    expect(before).toBeLessThan(atPeak);
    expect(after).toBeLessThan(atPeak);
  });

  it("decays toward 0 at large elapsed", () => {
    expect(gammaResponse(300, 30, 2)).toBeLessThan(0.01);
  });

  it("returns 0 when peakTime is 0", () => {
    expect(gammaResponse(10, 0, 2)).toBe(0);
  });
});

// ── circadianModifier ──

describe("circadianModifier", () => {
  const params = defaultParams();

  it("returns 1.0 before noon", () => {
    expect(circadianModifier(8 * 60, params)).toBe(1.0);
  });

  it("returns 1.0 at noon", () => {
    expect(circadianModifier(12 * 60, params)).toBe(1.0);
  });

  it("returns 1.1 at 9pm", () => {
    expect(circadianModifier(21 * 60, params)).toBeCloseTo(1.1, 2);
  });

  it("returns intermediate value at 6pm", () => {
    const mod = circadianModifier(18 * 60, params);
    expect(mod).toBeGreaterThan(1.0);
    expect(mod).toBeLessThan(1.1);
  });

  it("stays at max after 9pm", () => {
    expect(circadianModifier(23 * 60, params)).toBeCloseTo(1.1, 2);
  });
});

// ── dawnPhenomenonCurve ──

describe("dawnPhenomenonCurve", () => {
  const params = defaultParams();

  it("peaks at 6am", () => {
    const atPeak = dawnPhenomenonCurve(6 * 60, params);
    expect(atPeak).toBeCloseTo(10, 1);
  });

  it("is near zero far from 6am", () => {
    expect(dawnPhenomenonCurve(12 * 60, params)).toBeLessThan(0.1);
    expect(dawnPhenomenonCurve(18 * 60, params)).toBeLessThan(0.001);
  });

  it("is symmetric around 6am", () => {
    const before = dawnPhenomenonCurve(5 * 60, params);
    const after = dawnPhenomenonCurve(7 * 60, params);
    expect(before).toBeCloseTo(after, 4);
  });
});

// ── exerciseModifier ──

describe("exerciseModifier", () => {
  const params = defaultParams();

  it("returns 1.0 with no exercises", () => {
    expect(exerciseModifier(12 * 60, [], params)).toBe(1.0);
  });

  it("returns 1.0 before exercise starts", () => {
    const ex = makeExercise({ startMin: 13 * 60 });
    expect(exerciseModifier(12 * 60, [ex], params)).toBe(1.0);
  });

  it("reduces during exercise", () => {
    const ex = makeExercise({
      startMin: 13 * 60,
      endMin: 13 * 60 + 30,
      intensityFactor: 1.0,
    });
    const mod = exerciseModifier(13 * 60 + 15, [ex], params);
    // 1 - 30/100 = 0.7
    expect(mod).toBeCloseTo(0.7, 2);
  });

  it("partially reduces after exercise with decay", () => {
    const ex = makeExercise({
      startMin: 13 * 60,
      endMin: 13 * 60 + 30,
      intensityFactor: 1.0,
    });
    const mod = exerciseModifier(13 * 60 + 90, [ex], params);
    // 60 min after end, 120 decay window
    // decay = 1 - 60/120 = 0.5
    // modifier = 1 - 0.3 * 0.5 * 0.5 = 1 - 0.075 = 0.925
    expect(mod).toBeCloseTo(0.925, 2);
  });

  it("returns 1.0 well after decay window", () => {
    const ex = makeExercise({
      startMin: 13 * 60,
      endMin: 13 * 60 + 30,
      intensityFactor: 1.0,
    });
    expect(exerciseModifier(16 * 60, [ex], params)).toBe(1.0);
  });

  it("scales with intensity factor", () => {
    const lowEx = makeExercise({ intensityFactor: 0.3 });
    const highEx = makeExercise({ intensityFactor: 0.9 });
    const time = 13 * 60 + 15;
    const lowMod = exerciseModifier(time, [lowEx], params);
    const highMod = exerciseModifier(time, [highEx], params);
    expect(lowMod).toBeGreaterThan(highMod);
  });
});

// ── gymModifier ──

describe("gymModifier", () => {
  const params = defaultParams();

  it("returns 1.0 when no gym session", () => {
    expect(gymModifier(null, 12 * 60, params)).toBe(1.0);
  });

  it("returns full effect right after gym", () => {
    const gymTime = 10 * 60;
    const now = 10 * 60 + 1;
    const mod = gymModifier(gymTime, now, params);
    expect(mod).toBeLessThan(1.0);
    expect(mod).toBeCloseTo(0.85, 1);
  });

  it("returns 1.0 after sensitivity window expires", () => {
    const gymTime = 0;
    const now = 37 * 60; // 37 hours later
    expect(gymModifier(gymTime, now, params)).toBe(1.0);
  });

  it("decays linearly over the window", () => {
    const gymTime = 0;
    const halfWay = (36 * 60) / 2;
    const mod = gymModifier(gymTime, halfWay, params);
    // Halfway through: decay = 0.5, modifier = 1 - 0.15 * 0.5 = 0.925
    expect(mod).toBeCloseTo(0.925, 2);
  });

  it("returns 1.0 when gym is in the future", () => {
    expect(gymModifier(15 * 60, 10 * 60, params)).toBe(1.0);
  });
});

// ── predictGlucoseCurve ──

describe("predictGlucoseCurve", () => {
  const params = defaultParams();

  it("returns baseline with no meals", () => {
    const result = predictGlucoseCurve([], [], null, params);
    expect(result.curve.length).toBeGreaterThan(0);
    // All points near baseline except dawn phenomenon
    const noonPoint = result.curve.find((p) => p.timeMin === 12 * 60);
    expect(noonPoint?.value).toBeCloseTo(90, 0);
  });

  it("shows rise after a meal", () => {
    const meal = makeMeal({ timeMin: 12 * 60 });
    const result = predictGlucoseCurve([meal], [], null, params);
    const atMeal = result.curve.find((p) => p.timeMin === 12 * 60)!;
    const afterMeal = result.curve.find((p) => p.timeMin === 12 * 60 + 30)!;
    expect(afterMeal.value).toBeGreaterThan(atMeal.value);
  });

  it("peak exceeds baseline", () => {
    const meal = makeMeal({ timeMin: 12 * 60, netCarbs: 50 });
    const result = predictGlucoseCurve([meal], [], null, params);
    expect(result.peakValue).toBeGreaterThan(90);
  });

  it("exercise reduces peak", () => {
    const meal = makeMeal({ timeMin: 12 * 60 });
    const ex = makeExercise({
      startMin: 12 * 60 + 15,
      endMin: 12 * 60 + 45,
      intensityFactor: 0.8,
    });
    const withoutEx = predictGlucoseCurve([meal], [], null, params);
    const withEx = predictGlucoseCurve([meal], [ex], null, params);
    expect(withEx.peakValue).toBeLessThan(withoutEx.peakValue);
  });

  it("gym session reduces response", () => {
    const meal = makeMeal({ timeMin: 12 * 60 });
    const withoutGym = predictGlucoseCurve([meal], [], null, params);
    const withGym = predictGlucoseCurve([meal], [], 8 * 60, params);
    expect(withGym.peakValue).toBeLessThan(withoutGym.peakValue);
  });

  it("generates 5-minute interval points", () => {
    const result = predictGlucoseCurve([], [], null, params);
    const intervals = result.curve.map((p, i) =>
      i > 0 ? p.timeMin - result.curve[i - 1].timeMin : 0,
    );
    // All intervals (except first) should be 5
    expect(intervals.slice(1).every((i) => i === 5)).toBe(true);
  });

  it("includes dawn phenomenon in early morning", () => {
    const result = predictGlucoseCurve([], [], null, params);
    const at6am = result.curve.find((p) => p.timeMin === 6 * 60)!;
    expect(at6am.value).toBeGreaterThan(90 + 5); // baseline + noticeable dawn effect
  });
});

// ── foodEntryToMealEvent ──

describe("foodEntryToMealEvent", () => {
  it("converts FoodEntry correctly", () => {
    const entry = makeFoodEntry({
      time: "12:30",
      carbs_g: 40,
      fiber_g: 10,
      protein_g: 25,
      fat_g: 15,
    });
    const meal = foodEntryToMealEvent(entry);
    expect(meal.timeMin).toBe(750); // 12*60 + 30
    expect(meal.netCarbs).toBe(30); // 40 - 10
    expect(meal.protein).toBe(25);
    expect(meal.fat).toBe(15);
    expect(meal.totalGrams).toBe(70); // 30 + 25 + 15
  });

  it("clamps netCarbs to 0 when fiber > carbs", () => {
    const entry = makeFoodEntry({ carbs_g: 5, fiber_g: 10 });
    const meal = foodEntryToMealEvent(entry);
    expect(meal.netCarbs).toBe(0);
  });

  it("handles zero fiber_g", () => {
    const entry = makeFoodEntry({ carbs_g: 20, fiber_g: 0 });
    const meal = foodEntryToMealEvent(entry);
    expect(meal.netCarbs).toBe(20);
  });

  it("handles undefined fiber_g", () => {
    const entry = makeFoodEntry({ carbs_g: 20 });
    // Simulate undefined fiber_g
    (entry as any).fiber_g = undefined;
    const meal = foodEntryToMealEvent(entry);
    expect(meal.netCarbs).toBe(20);
  });
});

// ── aggregateMeals ──

describe("aggregateMeals", () => {
  it("returns empty array for empty input", () => {
    expect(aggregateMeals([])).toEqual([]);
  });

  it("returns single meal unchanged", () => {
    const meals = [
      makeMeal({ timeMin: 720, netCarbs: 10, protein: 20, fat: 5 }),
    ];
    const result = aggregateMeals(meals);
    expect(result).toHaveLength(1);
    expect(result[0].netCarbs).toBe(10);
    expect(result[0].protein).toBe(20);
    expect(result[0].fat).toBe(5);
  });

  it("aggregates meals within 15-min window", () => {
    const meals = [
      makeMeal({ timeMin: 1072, netCarbs: 5, protein: 6, fat: 3 }),
      makeMeal({ timeMin: 1072, netCarbs: 0, protein: 28, fat: 8 }),
      makeMeal({ timeMin: 1073, netCarbs: 2, protein: 1, fat: 1 }),
    ];
    const result = aggregateMeals(meals);
    expect(result).toHaveLength(1);
    expect(result[0].timeMin).toBe(1072);
    expect(result[0].netCarbs).toBe(7);
    expect(result[0].protein).toBe(35);
    expect(result[0].fat).toBe(12);
    expect(result[0].totalGrams).toBe(54);
  });

  it("separates meals outside window", () => {
    const meals = [
      makeMeal({ timeMin: 720, netCarbs: 10, protein: 10, fat: 5 }),
      makeMeal({ timeMin: 800, netCarbs: 20, protein: 20, fat: 10 }),
    ];
    const result = aggregateMeals(meals);
    expect(result).toHaveLength(2);
    expect(result[0].timeMin).toBe(720);
    expect(result[1].timeMin).toBe(800);
  });

  it("creates multiple groups for spread-out meals", () => {
    const meals = [
      makeMeal({ timeMin: 1071, netCarbs: 5, protein: 6, fat: 3 }),
      makeMeal({ timeMin: 1072, netCarbs: 0, protein: 28, fat: 8 }),
      makeMeal({ timeMin: 1109, netCarbs: 2, protein: 28, fat: 8 }),
      makeMeal({ timeMin: 1110, netCarbs: 2, protein: 7, fat: 3 }),
      makeMeal({ timeMin: 1133, netCarbs: 8, protein: 45, fat: 20 }),
    ];
    const result = aggregateMeals(meals);
    // 1071-1072 group, 1109-1110 group, 1133 group
    expect(result).toHaveLength(3);
  });

  it("handles unsorted input", () => {
    const meals = [
      makeMeal({ timeMin: 800, netCarbs: 20, protein: 10, fat: 5 }),
      makeMeal({ timeMin: 720, netCarbs: 10, protein: 5, fat: 3 }),
      makeMeal({ timeMin: 725, netCarbs: 5, protein: 5, fat: 2 }),
    ];
    const result = aggregateMeals(meals);
    expect(result).toHaveLength(2);
    expect(result[0].timeMin).toBe(720);
    expect(result[0].netCarbs).toBe(15);
    expect(result[1].timeMin).toBe(800);
  });

  it("respects custom window size", () => {
    const meals = [
      makeMeal({ timeMin: 720, netCarbs: 10, protein: 5, fat: 3 }),
      makeMeal({ timeMin: 740, netCarbs: 10, protein: 5, fat: 3 }),
    ];
    // Default 15-min window: separate groups
    expect(aggregateMeals(meals)).toHaveLength(2);
    // 30-min window: single group
    expect(aggregateMeals(meals, 30)).toHaveLength(1);
  });
});

// ── stravaToExerciseEvent ──

describe("stravaToExerciseEvent", () => {
  it("converts StravaActivity with watts", () => {
    // Use local time to avoid timezone issues in tests
    const now = new Date();
    now.setHours(13, 0, 0, 0);
    const activity = {
      id: 1,
      name: "Ride",
      type: "Ride",
      start_date: now.toISOString(),
      elapsed_time_sec: 1800,
      moving_time_sec: 1500,
      distance_m: 10000,
      average_speed: 25,
      max_speed: null,
      total_elevation_gain: null,
      average_heartrate: null,
      average_watts: 150,
      kilojoules: null,
    };
    const event = stravaToExerciseEvent(activity);
    expect(event.startMin).toBe(13 * 60);
    expect(event.endMin).toBe(13 * 60 + 25);
    expect(event.intensityFactor).toBeCloseTo(0.6, 1);
  });

  it("uses heartrate when no watts", () => {
    const activity = {
      id: 2,
      name: "Run",
      type: "Run",
      start_date: "2025-01-15T08:00:00+08:00",
      elapsed_time_sec: 3600,
      moving_time_sec: 3000,
      distance_m: 5000,
      average_speed: 10,
      max_speed: null,
      total_elevation_gain: null,
      average_heartrate: 150,
      average_watts: null,
      kilojoules: null,
    };
    const event = stravaToExerciseEvent(activity);
    expect(event.intensityFactor).toBeCloseTo((150 - 80) / 120, 1);
  });

  it("defaults to 0.5 with no watts or heartrate", () => {
    const activity = {
      id: 3,
      name: "Walk",
      type: "Walk",
      start_date: "2025-01-15T10:00:00+08:00",
      elapsed_time_sec: 1800,
      moving_time_sec: 1800,
      distance_m: 3000,
      average_speed: 5,
      max_speed: null,
      total_elevation_gain: null,
      average_heartrate: null,
      average_watts: null,
      kilojoules: null,
    };
    const event = stravaToExerciseEvent(activity);
    expect(event.intensityFactor).toBe(0.5);
  });

  it("clamps intensity factor to [0.1, 1.0]", () => {
    const high = {
      id: 4,
      name: "Sprint",
      type: "Ride",
      start_date: "2025-01-15T10:00:00+08:00",
      elapsed_time_sec: 600,
      moving_time_sec: 600,
      distance_m: 5000,
      average_speed: 30,
      max_speed: null,
      total_elevation_gain: null,
      average_heartrate: null,
      average_watts: 400,
      kilojoules: null,
    };
    expect(stravaToExerciseEvent(high).intensityFactor).toBe(1.0);

    const low = {
      id: 5,
      name: "Easy",
      type: "Ride",
      start_date: "2025-01-15T10:00:00+08:00",
      elapsed_time_sec: 600,
      moving_time_sec: 600,
      distance_m: 1000,
      average_speed: 10,
      max_speed: null,
      total_elevation_gain: null,
      average_heartrate: null,
      average_watts: 10,
      kilojoules: null,
    };
    expect(stravaToExerciseEvent(low).intensityFactor).toBe(0.1);
  });
});
