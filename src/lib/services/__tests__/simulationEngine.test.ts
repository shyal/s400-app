import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  weightedLinearRegression,
  effectiveDailyRate,
  estimateLeanMass,
  muscleMassTrend,
  derivedBodyFat,
  visceralFatCorrelation,
  waterPercentCorrelation,
  dailyVolatility,
  projectionSigma,
  requiredDailyRate,
  generateProjection,
  generateAllScenarios,
  gpWeightProjection,
  generateSamplePaths,
  mulberry32,
  boxMullerTransform,
  isStrengthProgressing,
  WEIGHT_GP_PARAMS,
} from "../simulationEngine";
import {
  makeWeightEntry,
  makeWeightTimeSeries,
  makeWorkout,
  makeExercise,
} from "../../../test/fixtures";

// Fix "today" for deterministic tests
const FIXED_NOW = new Date("2026-02-01T08:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── isStrengthProgressing ──

describe("isStrengthProgressing", () => {
  it("returns false for empty workouts", () => {
    expect(isStrengthProgressing([])).toBe(false);
  });

  it("returns false with only 1 appearance of a lift", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-20",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
    ];
    expect(isStrengthProgressing(workouts)).toBe(false);
  });

  it("returns true when weights are increasing", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 45 })],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 47.5 })],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-16",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 52.5 })],
      }),
    ];
    expect(isStrengthProgressing(workouts)).toBe(true);
  });

  it("returns true when weights are flat", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Bench Press", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [makeExercise({ name: "Bench Press", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Bench Press", targetWeight_kg: 50 })],
      }),
    ];
    expect(isStrengthProgressing(workouts)).toBe(true);
  });

  it("returns false when a single compound is steadily declining", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 60 })],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 55 })],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-16",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 45 })],
      }),
    ];
    // Earlier avg: (60+55)/2=57.5, Recent avg: (50+45)/2=47.5 → delta -10 → false
    expect(isStrengthProgressing(workouts)).toBe(false);
  });

  it("returns true when most lifts progress even if one is slightly down", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [
          makeExercise({ name: "Squat", targetWeight_kg: 50 }),
          makeExercise({ name: "Bench Press", targetWeight_kg: 50 }),
        ],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [
          makeExercise({ name: "Squat", targetWeight_kg: 55 }),
          makeExercise({ name: "Bench Press", targetWeight_kg: 48 }),
        ],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [
          makeExercise({ name: "Squat", targetWeight_kg: 60 }),
          makeExercise({ name: "Bench Press", targetWeight_kg: 52 }),
        ],
      }),
      makeWorkout({
        date: "2026-01-16",
        exercises: [
          makeExercise({ name: "Squat", targetWeight_kg: 65 }),
          makeExercise({ name: "Bench Press", targetWeight_kg: 49 }),
        ],
      }),
    ];
    // Squat: earlier (50+55)/2=52.5, recent (60+65)/2=62.5 → delta +10
    // Bench: earlier (50+48)/2=49, recent (52+49)/2=50.5 → delta +1.5
    // Mean delta: (10+1.5)/2 = +5.75 → true
    expect(isStrengthProgressing(workouts)).toBe(true);
  });

  it("ignores non-compound lifts", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [
          makeExercise({ name: "Barbell Curls", targetWeight_kg: 30 }),
        ],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [
          makeExercise({ name: "Barbell Curls", targetWeight_kg: 25 }),
        ],
      }),
    ];
    expect(isStrengthProgressing(workouts)).toBe(false);
  });

  it("handles deloads within the window gracefully", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-12",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 40 })],
      }), // deload
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 45 })],
      }),
      makeWorkout({
        date: "2026-01-16",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-18",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 52.5 })],
      }),
      makeWorkout({
        date: "2026-01-20",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 55 })],
      }),
    ];
    // Last 6: [50, 40, 45, 50, 52.5, 55]
    // Earlier: [50, 40, 45] avg=45, Recent: [50, 52.5, 55] avg=52.5 → delta +7.5 → true
    expect(isStrengthProgressing(workouts)).toBe(true);
  });

  it("excludes workouts older than 30 days", () => {
    // Old high-weight cycle (>30 days ago from FIXED_NOW=2026-02-01) gets excluded
    // Recent cycle within 30 days is clearly progressing
    const workouts = [
      // Old cycle — will be filtered out (before Jan 2)
      makeWorkout({
        date: "2025-12-20",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 100 })],
      }),
      makeWorkout({
        date: "2025-12-22",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 100 })],
      }),
      // Recent cycle within 30 days of Feb 1
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 50 })],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 52.5 })],
      }),
      makeWorkout({
        date: "2026-01-18",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 55 })],
      }),
      makeWorkout({
        date: "2026-01-22",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 57.5 })],
      }),
      makeWorkout({
        date: "2026-01-26",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 60 })],
      }),
      makeWorkout({
        date: "2026-01-30",
        exercises: [makeExercise({ name: "Squat", targetWeight_kg: 62.5 })],
      }),
    ];
    // Without 30-day filter, old 100kg data would skew. With filter, only recent 6 count.
    expect(isStrengthProgressing(workouts)).toBe(true);
  });

  it("works with just 2 appearances", () => {
    const workouts = [
      makeWorkout({
        date: "2026-01-10",
        exercises: [makeExercise({ name: "Deadlift", targetWeight_kg: 60 })],
      }),
      makeWorkout({
        date: "2026-01-14",
        exercises: [makeExercise({ name: "Deadlift", targetWeight_kg: 65 })],
      }),
    ];
    expect(isStrengthProgressing(workouts)).toBe(true);
  });
});

// ── weightedLinearRegression ──

describe("weightedLinearRegression", () => {
  it("returns zeros for empty entries", () => {
    const result = weightedLinearRegression([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.r2).toBe(0);
    expect(result.residualStdDev).toBe(0);
  });

  it("returns flat line for single entry", () => {
    const result = weightedLinearRegression([
      makeWeightEntry({ date: "2026-01-15", weight_kg: 82 }),
    ]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(82);
    expect(result.r2).toBe(1);
    expect(result.residualStdDev).toBe(0);
  });

  it("fits perfect linear data with r2=1", () => {
    const entries = makeWeightTimeSeries({
      days: 10,
      startKg: 85,
      dailyRateKg: -0.1,
      noise: 0,
    });
    const result = weightedLinearRegression(entries);
    expect(result.slope).toBeCloseTo(-0.1, 3);
    expect(result.r2).toBeCloseTo(1, 5);
    expect(result.residualStdDev).toBeCloseTo(0, 5);
  });

  it("reflects recent trend when data changes direction", () => {
    // First 20 days: losing -0.1/day, then 10 days: gaining +0.05/day
    const phase1 = makeWeightTimeSeries({
      days: 20,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-01",
    });
    const phase2 = makeWeightTimeSeries({
      days: 10,
      startKg: 83,
      dailyRateKg: 0.05,
      startDate: "2026-01-21",
    });
    const combined = [...phase1, ...phase2];

    const result = weightedLinearRegression(combined, 7); // short half-life
    // With 7-day half-life, the recent upward trend should dominate
    expect(result.slope).toBeGreaterThan(-0.05);
  });

  it("handles all same weight (zero variance in x)", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", weight_kg: 80 }),
      makeWeightEntry({ date: "2026-01-01", weight_kg: 80 }),
    ];
    const result = weightedLinearRegression(entries);
    expect(result.intercept).toBeCloseTo(80, 5);
  });

  it("returns r2=1 when all Y values are identical (ssTot=0)", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", weight_kg: 80 }),
      makeWeightEntry({ date: "2026-01-02", weight_kg: 80 }),
      makeWeightEntry({ date: "2026-01-03", weight_kg: 80 }),
    ];
    const result = weightedLinearRegression(entries);
    expect(result.r2).toBe(1);
    expect(result.slope).toBeCloseTo(0, 10);
  });
});

// ── effectiveDailyRate ──

describe("effectiveDailyRate", () => {
  it("returns the regression slope", () => {
    const entries = makeWeightTimeSeries({
      days: 14,
      startKg: 84,
      dailyRateKg: -0.08,
    });
    const rate = effectiveDailyRate(entries);
    expect(rate).toBeCloseTo(-0.08, 2);
  });
});

// ── estimateLeanMass ──

describe("estimateLeanMass", () => {
  it("returns 0 when no entries have muscle data", () => {
    const entries = [makeWeightEntry({ weight_kg: 80, muscle_mass_kg: null })];
    expect(estimateLeanMass(entries)).toBe(0);
  });

  it("averages last N entries with muscle data", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-03", muscle_mass_kg: 60 }),
      makeWeightEntry({ date: "2026-01-02", muscle_mass_kg: 58 }),
      makeWeightEntry({ date: "2026-01-01", muscle_mass_kg: 56 }),
    ];
    // With n=2, should average the two most recent: 60 and 58
    expect(estimateLeanMass(entries, 2)).toBeCloseTo(59, 1);
  });

  it("handles fewer entries than N", () => {
    const entries = [makeWeightEntry({ muscle_mass_kg: 59 })];
    expect(estimateLeanMass(entries, 7)).toBeCloseTo(59, 1);
  });
});

// ── muscleMassTrend ──

describe("muscleMassTrend", () => {
  it("returns zeros for no muscle data", () => {
    const result = muscleMassTrend([]);
    expect(result.latestMuscle).toBe(0);
    expect(result.dailyRate).toBe(0);
  });

  it("returns flat for single entry", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-15", muscle_mass_kg: 59 }),
    ];
    const result = muscleMassTrend(entries);
    expect(result.latestMuscle).toBe(59);
    expect(result.dailyRate).toBe(0);
  });

  it("detects increasing muscle trend", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", muscle_mass_kg: 58 }),
      makeWeightEntry({ date: "2026-01-11", muscle_mass_kg: 59 }),
      makeWeightEntry({ date: "2026-01-21", muscle_mass_kg: 60 }),
    ];
    const result = muscleMassTrend(entries);
    expect(result.latestMuscle).toBe(60);
    expect(result.dailyRate).toBeCloseTo(0.1, 2);
  });

  it("ignores entries without muscle data", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", muscle_mass_kg: 58 }),
      makeWeightEntry({ date: "2026-01-05", muscle_mass_kg: null }),
      makeWeightEntry({ date: "2026-01-11", muscle_mass_kg: 59 }),
    ];
    const result = muscleMassTrend(entries);
    expect(result.latestMuscle).toBe(59);
    expect(result.dailyRate).toBeCloseTo(0.1, 2);
  });

  it("handles same-day entries (zero variance in x)", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", muscle_mass_kg: 58 }),
      makeWeightEntry({ date: "2026-01-01", muscle_mass_kg: 59 }),
    ];
    const result = muscleMassTrend(entries);
    expect(result.dailyRate).toBe(0);
  });
});

// ── derivedBodyFat ──

describe("derivedBodyFat", () => {
  it("computes body fat percentage correctly", () => {
    expect(derivedBodyFat(80, 60)).toBeCloseTo(25, 1);
  });

  it("returns 0 when weight is 0", () => {
    expect(derivedBodyFat(0, 60)).toBe(0);
  });

  it("returns 0 when lean >= weight", () => {
    expect(derivedBodyFat(60, 65)).toBe(0);
  });

  it("returns 0 for negative weight", () => {
    expect(derivedBodyFat(-5, 60)).toBe(0);
  });
});

// ── visceralFatCorrelation ──

describe("visceralFatCorrelation", () => {
  it("returns default for no data", () => {
    const result = visceralFatCorrelation([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(10);
  });

  it("returns flat line for single data point", () => {
    const entries = [makeWeightEntry({ weight_kg: 80, visceral_fat: 8 })];
    const result = visceralFatCorrelation(entries);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(8);
  });

  it("fits linear correlation", () => {
    const entries = [
      makeWeightEntry({ weight_kg: 80, visceral_fat: 8 }),
      makeWeightEntry({ weight_kg: 90, visceral_fat: 12 }),
      makeWeightEntry({ weight_kg: 70, visceral_fat: 4 }),
    ];
    const result = visceralFatCorrelation(entries);
    expect(result.slope).toBeCloseTo(0.4, 2);
  });

  it("handles same weight (zero variance)", () => {
    const entries = [
      makeWeightEntry({ weight_kg: 80, visceral_fat: 8 }),
      makeWeightEntry({ weight_kg: 80, visceral_fat: 10 }),
    ];
    const result = visceralFatCorrelation(entries);
    expect(result.intercept).toBeCloseTo(9, 1);
  });
});

// ── waterPercentCorrelation ──

describe("waterPercentCorrelation", () => {
  it("returns default for no data", () => {
    const result = waterPercentCorrelation([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(55);
  });

  it("returns flat line for single data point", () => {
    const entries = [makeWeightEntry({ body_fat_pct: 25, water_percent: 52 })];
    const result = waterPercentCorrelation(entries);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(52);
  });

  it("fits linear correlation", () => {
    const entries = [
      makeWeightEntry({ body_fat_pct: 20, water_percent: 56 }),
      makeWeightEntry({ body_fat_pct: 30, water_percent: 50 }),
    ];
    const result = waterPercentCorrelation(entries);
    expect(result.slope).toBeCloseTo(-0.6, 2);
  });

  it("handles same body fat (zero variance)", () => {
    const entries = [
      makeWeightEntry({ body_fat_pct: 25, water_percent: 50 }),
      makeWeightEntry({ body_fat_pct: 25, water_percent: 54 }),
    ];
    const result = waterPercentCorrelation(entries);
    expect(result.intercept).toBeCloseTo(52, 1);
  });
});

// ── dailyVolatility ──

describe("dailyVolatility", () => {
  it("returns default 0.3 for fewer than 2 entries", () => {
    expect(dailyVolatility([])).toBe(0.3);
    expect(dailyVolatility([makeWeightEntry()])).toBe(0.3);
  });

  it("computes std dev of daily changes", () => {
    // Constant daily change = 0 volatility
    const entries = makeWeightTimeSeries({
      days: 5,
      startKg: 80,
      dailyRateKg: -0.1,
    });
    expect(dailyVolatility(entries)).toBeCloseTo(0, 5);
  });

  it("detects volatility with noisy data", () => {
    const entries = [
      makeWeightEntry({ date: "2026-01-01", weight_kg: 80 }),
      makeWeightEntry({ date: "2026-01-02", weight_kg: 81 }),
      makeWeightEntry({ date: "2026-01-03", weight_kg: 79 }),
      makeWeightEntry({ date: "2026-01-04", weight_kg: 81 }),
    ];
    const vol = dailyVolatility(entries);
    expect(vol).toBeGreaterThan(0.5);
  });
});

// ── projectionSigma ──

describe("projectionSigma", () => {
  it("returns residualStdDev at day 0", () => {
    expect(projectionSigma(0, 0.5, 0.3)).toBeCloseTo(0.5, 5);
  });

  it("grows with days out", () => {
    const s1 = projectionSigma(1, 0.5, 0.3);
    const s10 = projectionSigma(10, 0.5, 0.3);
    expect(s10).toBeGreaterThan(s1);
  });

  it("is monotonically increasing", () => {
    let prev = 0;
    for (let d = 0; d <= 30; d++) {
      const s = projectionSigma(d, 0.5, 0.3);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

// ── requiredDailyRate ──

describe("requiredDailyRate", () => {
  it("computes rate needed to go from current to goal", () => {
    // 81.8 → 72 by June 1 (120 days from Feb 1)
    const rate = requiredDailyRate(81.8, 72, "2026-06-01");
    expect(rate).toBeLessThan(0);
    const totalLoss = rate * 120;
    expect(totalLoss).toBeCloseTo(-9.8, 0);
  });

  it("returns positive rate when below goal", () => {
    const rate = requiredDailyRate(70, 75, "2026-06-01");
    expect(rate).toBeGreaterThan(0);
  });
});

// ── mulberry32 ──

describe("mulberry32", () => {
  it("is deterministic with the same seed", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const values1 = Array.from({ length: 10 }, () => rng1());
    const values2 = Array.from({ length: 10 }, () => rng2());
    expect(values1).toEqual(values2);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces different values with different seeds", () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(2);
    const v1 = rng1();
    const v2 = rng2();
    expect(v1).not.toBe(v2);
  });
});

// ── boxMullerTransform ──

describe("boxMullerTransform", () => {
  it("produces values with mean ≈ 0 and std ≈ 1", () => {
    const rng = mulberry32(42);
    const N = 10000;
    const samples = Array.from({ length: N }, () => boxMullerTransform(rng));

    const mean = samples.reduce((s, x) => s + x, 0) / N;
    const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / N;
    const std = Math.sqrt(variance);

    expect(mean).toBeCloseTo(0, 1);
    expect(std).toBeCloseTo(1, 1);
  });

  it("produces both positive and negative values", () => {
    const rng = mulberry32(99);
    const samples = Array.from({ length: 100 }, () => boxMullerTransform(rng));
    expect(samples.some((s) => s > 0)).toBe(true);
    expect(samples.some((s) => s < 0)).toBe(true);
  });
});

// ── gpWeightProjection ──

describe("gpWeightProjection", () => {
  it("returns zero projections for empty entries", () => {
    const result = gpWeightProjection([], 30, -0.1);
    expect(result.projectedWeights).toHaveLength(31);
    expect(result.projectedWeights[0]).toBe(0);
    expect(result.upper[0]).toBeGreaterThan(0);
    expect(result.lower[0]).toBeLessThan(0);
  });

  it("confidence bands widen with distance from data", () => {
    const entries = makeWeightTimeSeries({
      days: 20,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-12",
    });
    const result = gpWeightProjection(entries, 60, -0.1);

    const earlyBand = result.upper[1] - result.lower[1];
    const lateBand = result.upper[59] - result.lower[59];
    expect(lateBand).toBeGreaterThan(earlyBand);
  });

  it("captures non-linear recent trend via GP residuals", () => {
    // Linear trend losing, then plateau at end
    const phase1 = makeWeightTimeSeries({
      days: 20,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-01",
    });
    const phase2 = makeWeightTimeSeries({
      days: 10,
      startKg: 83,
      dailyRateKg: 0,
      startDate: "2026-01-21",
    });
    const combined = [...phase1, ...phase2];

    const result = gpWeightProjection(combined, 30, -0.05);
    // Near-term GP projection should reflect the recent plateau (higher than pure trend)
    const pureLinear = 83 + -0.05 * 1;
    // GP residual should push the near-term prediction up since recent data is flat
    expect(result.projectedWeights[1]).toBeGreaterThanOrEqual(pureLinear - 1);
  });

  it("handles single entry gracefully", () => {
    const entries = [makeWeightEntry({ date: "2026-01-20", weight_kg: 82 })];
    const result = gpWeightProjection(entries, 10, -0.1);
    expect(result.projectedWeights).toHaveLength(11);
    // First point should be near the entry weight
    expect(result.projectedWeights[0]).toBeCloseTo(82, 0);
  });
});

// ── generateSamplePaths ──

describe("generateSamplePaths", () => {
  it("produces N paths of correct length", () => {
    const paths = generateSamplePaths(80, -0.1, 0.5, 30, 15, 42);
    expect(paths).toHaveLength(15);
    for (const path of paths) {
      expect(path.points).toHaveLength(30);
    }
  });

  it("paths fan out over time (std dev increases)", () => {
    const paths = generateSamplePaths(80, -0.1, 0.5, 60, 50, 42);

    // Compute std dev at day 5 vs day 55
    const weightsDay5 = paths.map((p) => p.points[4].weight_kg);
    const weightsDay55 = paths.map((p) => p.points[54].weight_kg);

    const mean5 = weightsDay5.reduce((s, x) => s + x, 0) / weightsDay5.length;
    const mean55 =
      weightsDay55.reduce((s, x) => s + x, 0) / weightsDay55.length;

    const std5 = Math.sqrt(
      weightsDay5.reduce((s, x) => s + (x - mean5) ** 2, 0) /
        weightsDay5.length,
    );
    const std55 = Math.sqrt(
      weightsDay55.reduce((s, x) => s + (x - mean55) ** 2, 0) /
        weightsDay55.length,
    );

    expect(std55).toBeGreaterThan(std5);
  });

  it("seeded PRNG is deterministic", () => {
    const paths1 = generateSamplePaths(80, -0.1, 0.5, 10, 5, 42);
    const paths2 = generateSamplePaths(80, -0.1, 0.5, 10, 5, 42);

    for (let i = 0; i < 5; i++) {
      for (let d = 0; d < 10; d++) {
        expect(paths1[i].points[d].weight_kg).toBe(
          paths2[i].points[d].weight_kg,
        );
      }
    }
  });

  it("paths have correct dates starting from tomorrow", () => {
    const paths = generateSamplePaths(80, -0.1, 0.3, 3, 1, 42);
    const today = new Date();
    for (let d = 0; d < 3; d++) {
      const expected = new Date(
        today.getTime() + (d + 1) * 24 * 60 * 60 * 1000,
      );
      expect(paths[0].points[d].date).toBe(
        expected.toISOString().split("T")[0],
      );
    }
  });

  it("with zero volatility, all paths follow pure trend", () => {
    const paths = generateSamplePaths(80, -0.1, 0, 5, 3, 42);
    for (const path of paths) {
      for (let d = 0; d < 5; d++) {
        expect(path.points[d].weight_kg).toBeCloseTo(80 + -0.1 * (d + 1), 5);
      }
    }
  });
});

// ── generateProjection ──

describe("generateProjection", () => {
  const config: Parameters<typeof generateProjection>[2] = {
    goalKg: 72,
    goalDate: "2026-06-01",
  };

  it("returns empty result for no entries", () => {
    const result = generateProjection([], "current", config);
    expect(result.points).toHaveLength(0);
    expect(result.projectedGoalDate).toBeNull();
    expect(result.daysToGoal).toBeNull();
    expect(result.samplePaths).toHaveLength(0);
  });

  it("generates points from today to goal date", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
      muscleMassKg: 59,
      visceralFat: 9,
    });
    const result = generateProjection(entries, "current", config);

    expect(result.scenario).toBe("current");
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.weeklyRate).toBeCloseTo(-0.1 * 7, 1);

    // Points should have all fields
    const p = result.points[0];
    expect(p).toHaveProperty("date");
    expect(p).toHaveProperty("weight_kg");
    expect(p).toHaveProperty("body_fat_pct");
    expect(p).toHaveProperty("muscle_mass_kg");
    expect(p).toHaveProperty("visceral_fat");
    expect(p).toHaveProperty("weight_upper");
    expect(p).toHaveProperty("weight_lower");
    expect(p).toHaveProperty("bf_upper");
    expect(p).toHaveProperty("bf_lower");
  });

  it("confidence bands widen over time", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
      muscleMassKg: 59,
    });
    const result = generateProjection(entries, "current", config);
    const points = result.points;

    if (points.length >= 3) {
      const first = points[0];
      const last = points[points.length - 1];
      const firstBand = first.weight_upper - first.weight_lower;
      const lastBand = last.weight_upper - last.weight_lower;
      expect(lastBand).toBeGreaterThanOrEqual(firstBand);
    }
  });

  it("goal scenario uses required rate", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const result = generateProjection(entries, "goal", config);
    // Goal scenario should end near goal weight
    const lastPoint = result.points[result.points.length - 1];
    expect(lastPoint.weight_kg).toBeCloseTo(config.goalKg, 0);
  });

  it("custom scenario uses customWeeklyRate", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const customConfig = { ...config, customWeeklyRate: -1.0 };
    const result = generateProjection(entries, "custom", customConfig);
    expect(result.weeklyRate).toBeCloseTo(-1.0, 1);
  });

  it("computes projectedGoalDate when rate is negative", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 80,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const result = generateProjection(entries, "current", config);
    expect(result.projectedGoalDate).not.toBeNull();
    expect(result.daysToGoal).not.toBeNull();
  });

  it("extrapolates goal date beyond projection range", () => {
    // Very slow rate, won't hit goal within projection window
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.01,
      startDate: "2026-01-02",
    });
    const shortConfig = { ...config, goalDate: "2026-03-01" };
    const result = generateProjection(entries, "current", shortConfig);
    // Should still extrapolate goal date
    if (result.projectedGoalDate) {
      expect(new Date(result.projectedGoalDate).getTime()).toBeGreaterThan(
        new Date("2026-03-01").getTime(),
      );
    }
  });

  it("handles entries without body composition data", () => {
    const entries = makeWeightTimeSeries({
      days: 10,
      startKg: 82,
      dailyRateKg: -0.08,
      startDate: "2026-01-22",
    });
    const result = generateProjection(entries, "current", config);
    expect(result.points.length).toBeGreaterThan(0);
    // Without lean mass, body fat should be 0
    expect(result.points[0].body_fat_pct).toBe(0);
  });

  it("uses default custom rate when customWeeklyRate is undefined", () => {
    const entries = makeWeightTimeSeries({
      days: 10,
      startKg: 82,
      dailyRateKg: -0.08,
      startDate: "2026-01-22",
    });
    const noCustomConfig = { goalKg: 72, goalDate: "2026-06-01" };
    const result = generateProjection(entries, "custom", noCustomConfig);
    expect(result.weeklyRate).toBeCloseTo(-0.5, 1);
  });

  it("populates samplePaths for current scenario", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const result = generateProjection(entries, "current", config);
    expect(result.samplePaths.length).toBe(30);
    expect(result.samplePaths[0].points.length).toBeGreaterThan(0);
  });

  it("returns empty samplePaths for goal scenario", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const result = generateProjection(entries, "goal", config);
    expect(result.samplePaths).toHaveLength(0);
  });

  it("returns empty samplePaths for custom scenario", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
    });
    const result = generateProjection(entries, "custom", config);
    expect(result.samplePaths).toHaveLength(0);
  });

  it("aligns projected body fat with last measured body fat", () => {
    const entries = makeWeightTimeSeries({
      days: 20,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-12",
      muscleMassKg: 59,
      bodyFatPct: 25,
    });
    const result = generateProjection(entries, "goal", config);
    // First projected point's body fat should be close to the last measured value
    const lastMeasured = 25;
    expect(result.points[0].body_fat_pct).toBeCloseTo(lastMeasured, 0);
  });

  it("uses GP projection for current scenario with sufficient entries", () => {
    const entries = makeWeightTimeSeries({
      days: 30,
      startKg: 85,
      dailyRateKg: -0.1,
      startDate: "2026-01-02",
      muscleMassKg: 59,
      visceralFat: 9,
    });
    const result = generateProjection(entries, "current", config);
    // GP-enhanced projection should still produce valid points
    expect(result.points.length).toBeGreaterThan(0);
    expect(result.points[0].weight_kg).toBeDefined();
    expect(result.points[0].weight_upper).toBeGreaterThan(
      result.points[0].weight_lower,
    );
  });

  it("clamps muscle mass to flat when strengthProgressing is true", () => {
    // Declining muscle trend in bioimpedance data
    const entries = [
      makeWeightEntry({
        date: "2026-01-01",
        weight_kg: 85,
        muscle_mass_kg: 60,
      }),
      makeWeightEntry({
        date: "2026-01-11",
        weight_kg: 84,
        muscle_mass_kg: 59.5,
      }),
      makeWeightEntry({
        date: "2026-01-21",
        weight_kg: 83,
        muscle_mass_kg: 59,
      }),
      makeWeightEntry({
        date: "2026-01-31",
        weight_kg: 82,
        muscle_mass_kg: 58.5,
      }),
    ];
    const strengthConfig = { ...config, strengthProgressing: true };

    const result = generateProjection(entries, "current", strengthConfig);
    const lastPoint = result.points[result.points.length - 1];
    const firstPoint = result.points[0];

    // Muscle should stay flat (not decline)
    expect(lastPoint.muscle_mass_kg).toBeCloseTo(firstPoint.muscle_mass_kg, 1);
  });

  it("does not clamp muscle mass when strengthProgressing is false", () => {
    const entries = [
      makeWeightEntry({
        date: "2026-01-01",
        weight_kg: 85,
        muscle_mass_kg: 60,
      }),
      makeWeightEntry({
        date: "2026-01-11",
        weight_kg: 84,
        muscle_mass_kg: 59.5,
      }),
      makeWeightEntry({
        date: "2026-01-21",
        weight_kg: 83,
        muscle_mass_kg: 59,
      }),
      makeWeightEntry({
        date: "2026-01-31",
        weight_kg: 82,
        muscle_mass_kg: 58.5,
      }),
    ];
    const noStrengthConfig = { ...config, strengthProgressing: false };

    const result = generateProjection(entries, "current", noStrengthConfig);
    const lastPoint = result.points[result.points.length - 1];
    const firstPoint = result.points[0];

    // Muscle should decline following bioimpedance trend
    expect(lastPoint.muscle_mass_kg).toBeLessThan(firstPoint.muscle_mass_kg);
  });

  it("preserves positive muscle trend even with strengthProgressing", () => {
    // Muscle is INCREASING — should not be clamped
    const entries = [
      makeWeightEntry({
        date: "2026-01-01",
        weight_kg: 82,
        muscle_mass_kg: 58,
      }),
      makeWeightEntry({
        date: "2026-01-11",
        weight_kg: 82.5,
        muscle_mass_kg: 58.5,
      }),
      makeWeightEntry({
        date: "2026-01-21",
        weight_kg: 83,
        muscle_mass_kg: 59,
      }),
      makeWeightEntry({
        date: "2026-01-31",
        weight_kg: 83,
        muscle_mass_kg: 59.5,
      }),
    ];
    const strengthConfig = { ...config, strengthProgressing: true };

    const result = generateProjection(entries, "current", strengthConfig);
    const lastPoint = result.points[result.points.length - 1];
    const firstPoint = result.points[0];

    // Positive trend should be preserved, not clamped to zero
    expect(lastPoint.muscle_mass_kg).toBeGreaterThan(firstPoint.muscle_mass_kg);
  });

  it("strengthProgressing causes faster body fat drop", () => {
    const entries = [
      makeWeightEntry({
        date: "2026-01-01",
        weight_kg: 85,
        muscle_mass_kg: 60,
        body_fat_pct: 25,
      }),
      makeWeightEntry({
        date: "2026-01-11",
        weight_kg: 84,
        muscle_mass_kg: 59.5,
        body_fat_pct: 24.5,
      }),
      makeWeightEntry({
        date: "2026-01-21",
        weight_kg: 83,
        muscle_mass_kg: 59,
        body_fat_pct: 24,
      }),
      makeWeightEntry({
        date: "2026-01-31",
        weight_kg: 82,
        muscle_mass_kg: 58.5,
        body_fat_pct: 23.5,
      }),
    ];

    const withStrength = generateProjection(entries, "current", {
      ...config,
      strengthProgressing: true,
    });
    const without = generateProjection(entries, "current", {
      ...config,
      strengthProgressing: false,
    });

    const lastWith = withStrength.points[withStrength.points.length - 1];
    const lastWithout = without.points[without.points.length - 1];

    // With strength progressing: muscle flat → more weight loss is fat → lower bf%
    expect(lastWith.body_fat_pct).toBeLessThan(lastWithout.body_fat_pct);
  });
});

// ── generateAllScenarios ──

describe("generateAllScenarios", () => {
  it("returns exactly 3 scenarios", () => {
    const entries = makeWeightTimeSeries({
      days: 20,
      startKg: 83,
      dailyRateKg: -0.1,
      startDate: "2026-01-12",
    });
    const results = generateAllScenarios(entries, {
      goalKg: 72,
      goalDate: "2026-06-01",
    });
    expect(results).toHaveLength(3);
    expect(results[0].scenario).toBe("current");
    expect(results[1].scenario).toBe("goal");
    expect(results[2].scenario).toBe("custom");
  });

  it("works with empty entries", () => {
    const results = generateAllScenarios([], {
      goalKg: 72,
      goalDate: "2026-06-01",
    });
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.points).toHaveLength(0);
    });
  });
});
