import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/supabase", () => ({ supabase: null }));

import {
  fitFastingBaseline,
  fitMealSensitivity,
  fitExerciseReduction,
  fitParams,
  parameterConfidence,
  type PairedReading,
} from "$lib/services/glucoseModelFitter";
import {
  defaultParams,
  exerciseDrawdown,
  predictGlucoseCurve,
  type MealEvent,
  type ExerciseEvent,
} from "$lib/services/glucoseModel";
import { makeGlucoseReading } from "../../../test/fixtures";

// ── Helpers ──

function makePaired(
  mgdl: number,
  timeMin: number,
  readingType?: string,
): PairedReading {
  const [h, m] = [Math.floor(timeMin / 60), timeMin % 60];
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return {
    reading: makeGlucoseReading({
      time,
      value: mgdl,
      unit: "mg/dL",
      reading_type: (readingType as any) ?? "random",
    }),
    mgdl,
    timeMin,
  };
}

function makeMealEvent(overrides: Partial<MealEvent> = {}): MealEvent {
  return {
    timeMin: 12 * 60,
    netCarbs: 50,
    protein: 30,
    fat: 15,
    totalGrams: 95,
    ...overrides,
  };
}

// ── fitFastingBaseline ──

describe("fitFastingBaseline", () => {
  it("returns default with no readings", () => {
    expect(fitFastingBaseline([])).toBe(90);
  });

  it("returns single reading value without params", () => {
    const result = fitFastingBaseline([makePaired(85, 6 * 60)]);
    expect(result).toBeCloseTo(85, 0);
  });

  it("computes EMA of multiple readings without params", () => {
    const readings = [
      makePaired(90, 6 * 60),
      makePaired(88, 6 * 60),
      makePaired(86, 6 * 60),
      makePaired(84, 6 * 60),
    ];
    const result = fitFastingBaseline(readings);
    // EMA: alpha=0.3
    // 90 → 0.3*88 + 0.7*90 = 89.4 → 0.3*86 + 0.7*89.4 = 88.38 → 0.3*84 + 0.7*88.38 = 87.066
    expect(result).toBeCloseTo(87.1, 0);
  });

  it("recent readings have more weight", () => {
    const improving = [
      makePaired(100, 6 * 60),
      makePaired(95, 6 * 60),
      makePaired(90, 6 * 60),
      makePaired(85, 6 * 60),
    ];
    const result = fitFastingBaseline(improving);
    expect(result).toBeLessThan(95); // weighted toward recent lower values
  });

  it("dawn-adjusts morning readings when params provided", () => {
    const params = defaultParams(); // dawn_phenomenon_mgdl: 10
    // Reading at 6am (peak dawn) of 92 should be adjusted to ~82
    const readings = [makePaired(92, 6 * 60)];
    const result = fitFastingBaseline(readings, params);
    // dawnPhenomenonCurve at 6am ≈ 10 (peak), so adjusted = 92 - 10 = 82
    expect(result).toBeCloseTo(82, 0);
  });

  it("dawn adjustment is minimal for afternoon readings", () => {
    const params = defaultParams();
    // Reading at 1pm (780 min) — dawn contribution is negligible
    const readings = [makePaired(81, 13 * 60)];
    const result = fitFastingBaseline(readings, params);
    // Dawn at 1pm is essentially 0, so result ≈ 81
    expect(result).toBeCloseTo(81, 0);
  });
});

// ── fitMealSensitivity ──

describe("fitMealSensitivity", () => {
  const params = defaultParams();

  it("returns current params with no readings", () => {
    const result = fitMealSensitivity([], [], params);
    expect(result.carb_sensitivity).toBe(params.carb_sensitivity);
    expect(result.protein_sensitivity).toBe(params.protein_sensitivity);
  });

  it("fits sensitivity from single observation", () => {
    const readings = [makePaired(120, 12 * 60 + 30)];
    const meals = [makeMealEvent({ netCarbs: 50, protein: 30 })];
    const result = fitMealSensitivity(readings, meals, params);
    // Single observation should produce fitted values, not defaults
    expect(result.carb_sensitivity).toBeGreaterThan(0);
    expect(result.protein_sensitivity).toBeGreaterThan(0);
  });

  it("returns defaults for single observation with near-zero macros", () => {
    const readings = [makePaired(95, 12 * 60 + 30)];
    const meals = [makeMealEvent({ netCarbs: 0, protein: 0 })];
    const result = fitMealSensitivity(readings, meals, params);
    expect(result.carb_sensitivity).toBe(params.carb_sensitivity);
    expect(result.protein_sensitivity).toBe(params.protein_sensitivity);
  });

  it("handles negative delta (BG below baseline after meal)", () => {
    const lowParams = { ...params, fasting_baseline_mgdl: 90 };
    const readings = [
      makePaired(82, 12 * 60 + 30), // below baseline
      makePaired(95, 18 * 60 + 30), // above baseline
    ];
    const meals = [
      makeMealEvent({ timeMin: 12 * 60, netCarbs: 5, protein: 20 }),
      makeMealEvent({ timeMin: 18 * 60, netCarbs: 50, protein: 10 }),
    ];
    const result = fitMealSensitivity(readings, meals, lowParams);
    // Should fit — low-carb meal producing sub-baseline readings is valid data
    // Carb sensitivity should be low since the low-carb meal didn't spike
    expect(result.carb_sensitivity).toBeDefined();
    expect(result.protein_sensitivity).toBeDefined();
  });

  it("adjusts sensitivity with adequate paired readings", () => {
    const meals = [
      makeMealEvent({ timeMin: 12 * 60, netCarbs: 50, protein: 10 }),
      makeMealEvent({ timeMin: 18 * 60, netCarbs: 20, protein: 40 }),
    ];
    const readings = [
      makePaired(250, 12 * 60 + 30), // high carb meal
      makePaired(160, 18 * 60 + 30), // high protein meal
    ];
    const result = fitMealSensitivity(readings, meals, params);
    expect(result.carb_sensitivity).toBeGreaterThan(0);
    expect(result.protein_sensitivity).toBeGreaterThan(0);
  });

  it("clamps values to safe ranges", () => {
    const meals = [
      makeMealEvent({ timeMin: 12 * 60, netCarbs: 1, protein: 1 }),
      makeMealEvent({ timeMin: 18 * 60, netCarbs: 1, protein: 1 }),
    ];
    const readings = [
      makePaired(500, 12 * 60 + 30),
      makePaired(500, 18 * 60 + 30),
    ];
    const result = fitMealSensitivity(readings, meals, params);
    expect(result.carb_sensitivity).toBeLessThanOrEqual(10);
    expect(result.protein_sensitivity).toBeLessThanOrEqual(3);
  });

  it("ignores readings too far from meals", () => {
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const readings = [
      makePaired(120, 15 * 60), // 3 hours later, outside 120min window
      makePaired(110, 16 * 60), // 4 hours later
    ];
    const result = fitMealSensitivity(readings, meals, params);
    expect(result.carb_sensitivity).toBe(params.carb_sensitivity);
  });
});

// ── fitExerciseReduction ──

describe("fitExerciseReduction", () => {
  const params = defaultParams();

  it("returns current value with no exercises", () => {
    expect(fitExerciseReduction([], [], [], params)).toBe(30);
  });

  it("returns current value with no readings", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    expect(fitExerciseReduction([], [], exercises, params)).toBe(30);
  });

  it("returns current value with insufficient exercise readings", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    const readings = [makePaired(100, 10 * 60)]; // no readings during exercise
    expect(fitExerciseReduction(readings, [], exercises, params)).toBe(30);
  });

  it("optimizes reduction percentage with exercise readings", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.8 },
    ];
    const meals = [makeMealEvent({ timeMin: 12 * 60 + 30 })];
    const readings = [
      makePaired(110, 13 * 60 + 15), // during exercise
      makePaired(105, 13 * 60 + 45), // right after
    ];
    const result = fitExerciseReduction(readings, meals, exercises, params);
    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(60);
  });
});

// ── fitParams (staged coordinator) ──

describe("fitParams", () => {
  it("returns defaults with 0 readings", () => {
    const result = fitParams([], [], [], defaultParams());
    expect(result.data_points_used).toBe(0);
    expect(result.fasting_baseline_mgdl).toBe(90);
  });

  it("stage 1: fits fasting baseline with 1-2 readings (dawn-adjusted)", () => {
    const readings = [
      makeGlucoseReading({
        time: "06:00",
        value: 92,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        time: "06:00",
        value: 95,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fitParams(readings, [], [], defaultParams());
    expect(result.data_points_used).toBe(2);
    // 6am readings dawn-adjusted: 92-10=82, 95-10=85 → EMA ≈ 82.9
    expect(result.fasting_baseline_mgdl).toBeLessThan(86);
    // Should not change sensitivity (stage 2 needs 3+)
    expect(result.carb_sensitivity).toBe(4.0);
  });

  it("stage 1: uses lowest non-fasting reading as baseline ceiling when no fasting readings", () => {
    const readings = [
      makeGlucoseReading({
        time: "15:00",
        value: 77,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = fitParams(readings, [], [], defaultParams());
    expect(result.data_points_used).toBe(1);
    // Default baseline is 90, but 77 is lower, so baseline should drop to 77
    expect(result.fasting_baseline_mgdl).toBe(77);
  });

  it("stage 1: keeps baseline when non-fasting readings are above it", () => {
    const readings = [
      makeGlucoseReading({
        time: "15:00",
        value: 110,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = fitParams(readings, [], [], defaultParams());
    expect(result.data_points_used).toBe(1);
    // 110 is above default 90, so baseline stays at 90
    expect(result.fasting_baseline_mgdl).toBe(90);
  });

  it("stage 2: fits meal sensitivity with 3+ readings", () => {
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const readings = [
      makeGlucoseReading({
        time: "06:00",
        value: 85,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        time: "12:30",
        value: 120,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
      makeGlucoseReading({
        time: "13:00",
        value: 105,
        unit: "mg/dL",
        reading_type: "post_meal_60",
      }),
    ];
    const result = fitParams(readings, meals, [], defaultParams());
    expect(result.data_points_used).toBe(3);
    // Stage 2 should now be active at 3 readings
  });

  it("stage 3: fits exercise with 15+ readings", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const readings = Array.from({ length: 16 }, (_, i) =>
      makeGlucoseReading({
        time: `${String(6 + i).padStart(2, "0")}:00`,
        value: 80 + i * 3,
        unit: "mg/dL",
        reading_type: i < 2 ? "fasting" : "random",
      }),
    );
    const result = fitParams(readings, meals, exercises, defaultParams());
    expect(result.data_points_used).toBe(16);
  });

  it("stage 4: sets last_fit_at with 30+ readings", () => {
    const readings = Array.from({ length: 31 }, (_, i) =>
      makeGlucoseReading({
        time: `${String(6 + (i % 15)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`,
        value: 85 + (i % 10) * 3,
        unit: "mg/dL",
        reading_type: i < 5 ? "fasting" : "random",
      }),
    );
    const result = fitParams(readings, [], [], defaultParams());
    expect(result.data_points_used).toBe(31);
    expect(result.last_fit_at).not.toBeNull();
  });
});

// ── exerciseDrawdown ──

describe("exerciseDrawdown", () => {
  const params = defaultParams(); // exercise_reduction_pct: 30

  it("returns 0 before exercise starts", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    expect(exerciseDrawdown(12 * 60, exercises, params)).toBe(0);
  });

  it("drops BG during exercise (GLUT4 pulls from blood)", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    const drawdown = exerciseDrawdown(13 * 60 + 15, exercises, params);
    // peakDrop = 30 * 0.5 * 0.7 = 10.5 mg/dL
    expect(drawdown).toBeCloseTo(10.5, 1);
  });

  it("drops BG below baseline in predictGlucoseCurve when fasting", () => {
    // No meals — purely fasting. Exercise should still pull BG down.
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    const prediction = predictGlucoseCurve([], exercises, null, params);
    // Find the glucose during exercise (~13:15 = 795 min)
    const duringExercise = prediction.curve.find((p) => p.timeMin === 795);
    expect(duringExercise).toBeDefined();
    // Baseline is 90, drawdown is 10.5, so should be ~79.5 (plus tiny dawn residual)
    expect(duringExercise!.value).toBeLessThan(params.fasting_baseline_mgdl);
  });

  it("decays over 2h post-exercise to 50% of peak", () => {
    const exercises: ExerciseEvent[] = [
      { startMin: 13 * 60, endMin: 13 * 60 + 30, intensityFactor: 0.7 },
    ];
    // Right after exercise ends (t = 13:30)
    const atEnd = exerciseDrawdown(13 * 60 + 30, exercises, params);
    // peakDrop = 10.5, at end: 0.5 + 0.5*1.0 = 1.0 × 10.5 = 10.5
    expect(atEnd).toBeCloseTo(10.5, 1);

    // 1h after exercise ends (t = 14:30), decay = 0.5
    const at1h = exerciseDrawdown(14 * 60 + 30, exercises, params);
    // 10.5 * (0.5 + 0.5 * 0.5) = 10.5 * 0.75 = 7.875
    expect(at1h).toBeCloseTo(7.875, 1);

    // 2h after exercise ends (t = 15:30), decay window expired
    const at2h = exerciseDrawdown(15 * 60 + 30, exercises, params);
    expect(at2h).toBe(0);
  });
});

// ── afternoon fasting readings for baseline ──

describe("fitParams afternoon fasting readings", () => {
  it("uses afternoon fasting-window readings for baseline", () => {
    // Afternoon random reading with no meals in prior 3h
    const readings = [
      makeGlucoseReading({
        time: "13:00",
        value: 81,
        unit: "mg/dL",
        reading_type: "random",
      }),
    ];
    // No meals → this reading is in a fasting window
    const result = fitParams(readings, [], [], defaultParams());
    // Should use this reading for baseline (dawn-adjusted — at 1pm dawn is ~0)
    expect(result.fasting_baseline_mgdl).toBeCloseTo(81, 0);
  });

  it("ignores afternoon readings with recent meals", () => {
    const meals: MealEvent[] = [
      { timeMin: 12 * 60, netCarbs: 50, protein: 30, fat: 15, totalGrams: 95 },
    ];
    const readings = [
      makeGlucoseReading({
        time: "13:00",
        value: 120,
        unit: "mg/dL",
        reading_type: "random",
      }),
    ];
    // Meal at 12:00, reading at 13:00 (1h after) → not a fasting window
    const result = fitParams(readings, meals, [], defaultParams());
    // No fasting readings available, falls back to lowest-reading logic
    // 120 > default 90, so baseline stays at 90
    expect(result.fasting_baseline_mgdl).toBe(90);
  });
});

// ── parameterConfidence ──

describe("parameterConfidence", () => {
  it("returns all none for 0 data points", () => {
    const params = { ...defaultParams(), data_points_used: 0 };
    const conf = parameterConfidence(params);
    expect(conf.overall).toBe("none");
    expect(conf.fasting_baseline).toBe("none");
    expect(conf.carb_sensitivity).toBe("none");
    expect(conf.exercise_reduction).toBe("none");
    expect(conf.circadian).toBe("none");
  });

  it("returns low overall for 1-2 data points", () => {
    const params = { ...defaultParams(), data_points_used: 2 };
    const conf = parameterConfidence(params);
    expect(conf.overall).toBe("low");
    expect(conf.fasting_baseline).toBe("medium");
    expect(conf.carb_sensitivity).toBe("none");
  });

  it("returns medium overall for 3-29 data points", () => {
    const params = { ...defaultParams(), data_points_used: 20 };
    const conf = parameterConfidence(params);
    expect(conf.overall).toBe("medium");
    expect(conf.fasting_baseline).toBe("high");
    expect(conf.carb_sensitivity).toBe("high");
    expect(conf.exercise_reduction).toBe("medium");
  });

  it("returns medium carb/protein sensitivity for 3-14 data points", () => {
    const params = { ...defaultParams(), data_points_used: 10 };
    const conf = parameterConfidence(params);
    expect(conf.overall).toBe("medium");
    expect(conf.carb_sensitivity).toBe("medium");
    expect(conf.protein_sensitivity).toBe("medium");
    expect(conf.exercise_reduction).toBe("none");
  });

  it("returns high overall for 30+ data points", () => {
    const params = { ...defaultParams(), data_points_used: 35 };
    const conf = parameterConfidence(params);
    expect(conf.overall).toBe("high");
    expect(conf.fasting_baseline).toBe("high");
    expect(conf.carb_sensitivity).toBe("high");
    expect(conf.exercise_reduction).toBe("high");
    expect(conf.circadian).toBe("medium");
  });
});
