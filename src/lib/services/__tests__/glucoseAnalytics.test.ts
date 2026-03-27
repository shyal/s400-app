import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/supabase", () => ({ supabase: null }));

import {
  fastingGlucoseTrend,
  postMealResponseSummary,
  glucoseZones,
  modelAccuracy,
} from "$lib/services/glucoseAnalytics";
import type { GlucosePoint } from "$lib/services/glucoseModel";
import { makeGlucoseReading, makeFoodEntry } from "../../../test/fixtures";

// Use a fixed "today" for tests
const TODAY = "2026-02-14";
const YESTERDAY = "2026-02-13";

// ── fastingGlucoseTrend ──

describe("fastingGlucoseTrend", () => {
  it("returns zeros with no readings", () => {
    const result = fastingGlucoseTrend([]);
    expect(result.average).toBe(0);
    expect(result.trend).toBe("stable");
    expect(result.readings).toHaveLength(0);
    expect(result.dawnPhenomenonDetected).toBe(false);
  });

  it("computes average of fasting readings", () => {
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "06:00",
        value: 90,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: YESTERDAY,
        time: "06:00",
        value: 100,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.average).toBeCloseTo(95, 0);
    expect(result.readings).toHaveLength(2);
  });

  it("detects improving trend", () => {
    const readings = [
      makeGlucoseReading({
        date: "2026-02-01",
        value: 100,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-03",
        value: 98,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-10",
        value: 88,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-12",
        value: 85,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.trend).toBe("improving");
  });

  it("detects worsening trend", () => {
    const readings = [
      makeGlucoseReading({
        date: "2026-02-01",
        value: 85,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-03",
        value: 88,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-10",
        value: 98,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-12",
        value: 100,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.trend).toBe("worsening");
  });

  it("detects stable trend", () => {
    const readings = [
      makeGlucoseReading({
        date: "2026-02-01",
        value: 90,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-03",
        value: 91,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-10",
        value: 90,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-12",
        value: 91,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.trend).toBe("stable");
  });

  it("detects dawn phenomenon", () => {
    const readings = [
      makeGlucoseReading({
        date: "2026-02-10",
        value: 98,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-11",
        value: 100,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: "2026-02-12",
        value: 96,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.dawnPhenomenonDetected).toBe(true);
  });

  it("filters by day window", () => {
    const readings = [
      makeGlucoseReading({
        date: "2025-01-01",
        value: 200,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
      makeGlucoseReading({
        date: TODAY,
        value: 90,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 7);
    // Only the recent reading should be included
    expect(result.readings).toHaveLength(1);
    expect(result.average).toBeCloseTo(90, 0);
  });

  it("ignores non-fasting readings", () => {
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        value: 150,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
      makeGlucoseReading({
        date: TODAY,
        value: 90,
        unit: "mg/dL",
        reading_type: "fasting",
      }),
    ];
    const result = fastingGlucoseTrend(readings, 30);
    expect(result.readings).toHaveLength(1);
    expect(result.average).toBeCloseTo(90, 0);
  });
});

// ── postMealResponseSummary ──

describe("postMealResponseSummary", () => {
  it("returns zeros with no post-meal readings", () => {
    const result = postMealResponseSummary([], []);
    expect(result.averagePeak).toBe(0);
    expect(result.worstMeal).toBeNull();
    expect(result.bestMeal).toBeNull();
    expect(result.responseCount).toBe(0);
  });

  it("computes average peak from post-meal readings", () => {
    const meals = [
      makeFoodEntry({ date: TODAY, time: "12:00", name: "Lunch" }),
      makeFoodEntry({ date: TODAY, time: "18:00", name: "Dinner" }),
    ];
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "12:30",
        value: 140,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
      makeGlucoseReading({
        date: TODAY,
        time: "18:30",
        value: 160,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = postMealResponseSummary(readings, meals);
    expect(result.averagePeak).toBeCloseTo(150, 0);
    expect(result.responseCount).toBe(2);
  });

  it("identifies worst and best meals", () => {
    const meals = [
      makeFoodEntry({ date: TODAY, time: "12:00", name: "Salad" }),
      makeFoodEntry({ date: TODAY, time: "18:00", name: "Pasta" }),
    ];
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "12:30",
        value: 110,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
      makeGlucoseReading({
        date: TODAY,
        time: "18:30",
        value: 180,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = postMealResponseSummary(readings, meals);
    expect(result.bestMeal?.name).toBe("Salad");
    expect(result.worstMeal?.name).toBe("Pasta");
  });

  it("includes post_meal_60 readings", () => {
    const meals = [
      makeFoodEntry({ date: TODAY, time: "12:00", name: "Lunch" }),
    ];
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "13:00",
        value: 120,
        unit: "mg/dL",
        reading_type: "post_meal_60",
      }),
    ];
    const result = postMealResponseSummary(readings, meals);
    expect(result.responseCount).toBe(1);
    expect(result.averagePeak).toBeCloseTo(120, 0);
  });

  it("handles unmatched readings", () => {
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "12:30",
        value: 130,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = postMealResponseSummary(readings, []);
    expect(result.responseCount).toBe(1);
    expect(result.bestMeal?.name).toBe("Unknown meal");
  });

  it("sorts multiple matching meals to find closest", () => {
    const meals = [
      makeFoodEntry({ date: TODAY, time: "11:00", name: "Snack" }),
      makeFoodEntry({ date: TODAY, time: "12:00", name: "Lunch" }),
    ];
    const readings = [
      makeGlucoseReading({
        date: TODAY,
        time: "12:30",
        value: 140,
        unit: "mg/dL",
        reading_type: "post_meal_30",
      }),
    ];
    const result = postMealResponseSummary(readings, meals);
    expect(result.responseCount).toBe(1);
    // Should match the closer meal (Lunch at 12:00, 30 min before reading)
    expect(result.bestMeal?.name).toBe("Lunch");
  });
});

// ── glucoseZones ──

describe("glucoseZones", () => {
  it("returns zeros for empty curve", () => {
    const result = glucoseZones([]);
    expect(result.total).toBe(0);
  });

  it("categorizes points into zones", () => {
    const curve: GlucosePoint[] = [
      { timeMin: 0, value: 60 }, // hypo
      { timeMin: 5, value: 85 }, // normal
      { timeMin: 10, value: 120 }, // elevated
      { timeMin: 15, value: 150 }, // high
    ];
    const result = glucoseZones(curve);
    expect(result.hypo).toBe(5);
    expect(result.normal).toBe(5);
    expect(result.elevated).toBe(5);
    expect(result.high).toBe(5);
    expect(result.total).toBe(20);
  });

  it("handles boundary values", () => {
    const curve: GlucosePoint[] = [
      { timeMin: 0, value: 70 }, // exactly 70 → normal
      { timeMin: 5, value: 100 }, // exactly 100 → normal
      { timeMin: 10, value: 140 }, // exactly 140 → elevated
    ];
    const result = glucoseZones(curve);
    expect(result.normal).toBe(10);
    expect(result.elevated).toBe(5);
  });

  it("handles single-point curve", () => {
    const curve: GlucosePoint[] = [{ timeMin: 0, value: 90 }];
    const result = glucoseZones(curve);
    expect(result.normal).toBe(5); // default step
    expect(result.total).toBe(5);
  });

  it("handles all-normal curve", () => {
    const curve: GlucosePoint[] = Array.from({ length: 10 }, (_, i) => ({
      timeMin: i * 5,
      value: 85,
    }));
    const result = glucoseZones(curve);
    expect(result.normal).toBe(50);
    expect(result.hypo).toBe(0);
    expect(result.elevated).toBe(0);
    expect(result.high).toBe(0);
  });
});

// ── modelAccuracy ──

describe("modelAccuracy", () => {
  it("returns zeros with no actuals", () => {
    const result = modelAccuracy([], []);
    expect(result.mae).toBe(0);
    expect(result.r2).toBe(0);
    expect(result.n).toBe(0);
  });

  it("computes MAE correctly", () => {
    const predicted: GlucosePoint[] = [
      { timeMin: 6 * 60, value: 90 },
      { timeMin: 12 * 60, value: 130 },
      { timeMin: 12 * 60 + 30, value: 150 },
    ];
    const actuals = [
      makeGlucoseReading({ time: "06:00", value: 95, unit: "mg/dL" }),
      makeGlucoseReading({ time: "12:00", value: 120, unit: "mg/dL" }),
    ];
    const result = modelAccuracy(predicted, actuals);
    // MAE: (|90-95| + |130-120|) / 2 = 7.5
    expect(result.mae).toBeCloseTo(7.5, 0);
    expect(result.n).toBe(2);
  });

  it("computes R-squared for perfect prediction", () => {
    const predicted: GlucosePoint[] = [
      { timeMin: 6 * 60, value: 90 },
      { timeMin: 12 * 60, value: 130 },
    ];
    const actuals = [
      makeGlucoseReading({ time: "06:00", value: 90, unit: "mg/dL" }),
      makeGlucoseReading({ time: "12:00", value: 130, unit: "mg/dL" }),
    ];
    const result = modelAccuracy(predicted, actuals);
    expect(result.r2).toBe(1);
  });

  it("skips actuals too far from predicted points", () => {
    const predicted: GlucosePoint[] = [{ timeMin: 6 * 60, value: 90 }];
    const actuals = [
      makeGlucoseReading({ time: "12:00", value: 130, unit: "mg/dL" }), // no predicted point near 12:00
    ];
    const result = modelAccuracy(predicted, actuals);
    expect(result.n).toBe(0);
  });

  it("handles mmol/L conversion", () => {
    const predicted: GlucosePoint[] = [{ timeMin: 6 * 60, value: 90 }];
    const actuals = [
      makeGlucoseReading({ time: "06:00", value: 5.0, unit: "mmol/L" }), // ~90 mg/dL
    ];
    const result = modelAccuracy(predicted, actuals);
    expect(result.n).toBe(1);
    expect(result.mae).toBeLessThan(2); // should be close
  });
});
