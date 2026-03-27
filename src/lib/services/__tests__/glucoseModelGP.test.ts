import { describe, it, expect, vi } from "vitest";

vi.mock("$lib/supabase", () => ({ supabase: null }));
vi.mock("$lib/services/glucoseData", () => ({
  toMgDl: (val: number, unit: string) =>
    unit === "mmol/L" ? val * 18.0182 : val,
}));

import {
  predictGlucoseCurveGP,
  type GPGlucosePoint,
} from "$lib/services/glucoseModelGP";
import { predictGlucoseCurve, defaultParams } from "$lib/services/glucoseModel";
import { defaultHyperparams } from "$lib/services/gaussianProcess";
import {
  makeMealEvent,
  makeGlucoseReading,
  makeGlucoseModelParams,
  makeExerciseEvent,
} from "../../../test/fixtures";

const params = makeGlucoseModelParams();

// ── No readings → matches parametric ──

describe("predictGlucoseCurveGP", () => {
  it("with no readings, output matches parametric with symmetric bands", () => {
    const meals = [
      makeMealEvent({
        timeMin: 12 * 60,
        netCarbs: 50,
        protein: 30,
        fat: 10,
        totalGrams: 90,
      }),
    ];
    const gp = predictGlucoseCurveGP(meals, [], null, params, []);
    const parametric = predictGlucoseCurve(meals, [], null, params);

    expect(gp.curve).toHaveLength(parametric.curve.length);

    // With no readings, GP correction is 0, so values should match parametric
    for (let i = 0; i < gp.curve.length; i++) {
      expect(gp.curve[i].value).toBeCloseTo(parametric.curve[i].value, 0);
      // Bands should be symmetric around value
      const upper = gp.curve[i].upper;
      const lower = gp.curve[i].lower;
      // upper - value ≈ value - lower (when above floor)
      if (lower > 40) {
        expect(upper - gp.curve[i].value).toBeCloseTo(
          gp.curve[i].value - lower,
          0,
        );
      }
    }
  });

  it("with no readings, bands have width equal to sqrt(signalVariance)", () => {
    const meals = [makeMealEvent()];
    const hp = defaultHyperparams();
    const gp = predictGlucoseCurveGP(meals, [], null, params, [], hp);
    const sigma = Math.sqrt(hp.signalVariance);
    // At a random point, band width should be ≈ 2σ (before any floor clamping)
    const midIdx = Math.floor(gp.curve.length / 2);
    const p = gp.curve[midIdx];
    if (p.lower > 40) {
      expect(p.upper - p.lower).toBeCloseTo(2 * sigma, -1);
    }
  });

  it("reading above parametric → GP pulls curve up nearby", () => {
    const mealTime = 12 * 60;
    const meals = [
      makeMealEvent({
        timeMin: mealTime,
        netCarbs: 50,
        protein: 30,
        fat: 10,
        totalGrams: 90,
      }),
    ];
    const readingTime = mealTime + 30; // 30 min after meal (near peak)
    const h = Math.floor(readingTime / 60);
    const m = readingTime % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    // Get parametric value at reading time
    const parametric = predictGlucoseCurve(meals, [], null, params);
    const parametricAtReading = parametric.curve.find(
      (p) => p.timeMin === readingTime,
    )!;

    // Create a reading that's 30 mg/dL above parametric
    const readingMgDl = parametricAtReading.value + 30;
    const readings = [
      makeGlucoseReading({
        time: timeStr,
        value: readingMgDl,
        unit: "mg/dL",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);
    const gpAtReading = gp.curve.find((p) => p.timeMin === readingTime)!;

    // GP should pull the curve upward (closer to the actual reading)
    expect(gpAtReading.value).toBeGreaterThan(parametricAtReading.value);
  });

  it("reading below parametric → GP pulls curve down nearby", () => {
    const mealTime = 12 * 60;
    const meals = [
      makeMealEvent({
        timeMin: mealTime,
        netCarbs: 50,
        protein: 30,
        fat: 10,
        totalGrams: 90,
      }),
    ];
    const readingTime = mealTime + 30;
    const h = Math.floor(readingTime / 60);
    const m = readingTime % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const parametric = predictGlucoseCurve(meals, [], null, params);
    const parametricAtReading = parametric.curve.find(
      (p) => p.timeMin === readingTime,
    )!;

    // Reading 20 mg/dL below parametric (but still above floor)
    const readingMgDl = Math.max(50, parametricAtReading.value - 20);
    const readings = [
      makeGlucoseReading({
        time: timeStr,
        value: readingMgDl,
        unit: "mg/dL",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);
    const gpAtReading = gp.curve.find((p) => p.timeMin === readingTime)!;

    expect(gpAtReading.value).toBeLessThan(parametricAtReading.value);
  });

  it("bands narrow at observations and widen far from data", () => {
    const mealTime = 12 * 60;
    const meals = [makeMealEvent({ timeMin: mealTime })];
    const readingTime = mealTime + 30;
    const h = Math.floor(readingTime / 60);
    const m = readingTime % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const readings = [
      makeGlucoseReading({
        time: timeStr,
        value: 130,
        unit: "mg/dL",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);

    // Find band width at the reading time
    const atReading = gp.curve.find((p) => p.timeMin === readingTime)!;
    const bandWidthAtReading = atReading.upper - atReading.lower;

    // Find band width far away (e.g., 6 hours before the reading)
    const farTime = readingTime - 360;
    const farPoint = gp.curve.find((p) => p.timeMin === farTime);
    if (farPoint && farPoint.lower > 40) {
      const bandWidthFar = farPoint.upper - farPoint.lower;
      expect(bandWidthFar).toBeGreaterThan(bandWidthAtReading);
    }
  });

  it("enforces physiological floor at 40 mg/dL", () => {
    const meals = [makeMealEvent()];
    // Create a reading far below normal to test floor
    const readings = [
      makeGlucoseReading({
        time: "00:30",
        value: 42, // very low
        unit: "mg/dL",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);

    for (const p of gp.curve) {
      expect(p.value).toBeGreaterThanOrEqual(40);
      expect(p.upper).toBeGreaterThanOrEqual(40);
      expect(p.lower).toBeGreaterThanOrEqual(40);
    }
  });

  it("peak tracking reflects GP-adjusted curve", () => {
    const mealTime = 12 * 60;
    // Use small meal so parametric peak is low
    const meals = [
      makeMealEvent({
        timeMin: mealTime,
        netCarbs: 10,
        protein: 5,
        fat: 2,
        totalGrams: 17,
      }),
    ];
    const readingTime = mealTime + 30;
    const h = Math.floor(readingTime / 60);
    const m = readingTime % 60;
    const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const parametric = predictGlucoseCurve(meals, [], null, params);

    // Set reading well above the parametric peak
    const readings = [
      makeGlucoseReading({
        time: timeStr,
        value: parametric.peakValue + 50,
        unit: "mg/dL",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);

    // GP peak should be higher than parametric peak due to high reading
    expect(gp.peakValue).toBeGreaterThan(parametric.peakValue);
  });

  it("works with exercises", () => {
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const exercises = [
      makeExerciseEvent({
        startMin: 12 * 60 + 30,
        endMin: 13 * 60,
        intensityFactor: 0.7,
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, exercises, null, params, []);
    expect(gp.curve.length).toBeGreaterThan(0);
    expect(gp.peakValue).toBeGreaterThan(40);
  });

  it("works with gym modifier", () => {
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const lastGymTimeMin = -6 * 60; // gym was 6h before midnight

    const gp = predictGlucoseCurveGP(meals, [], lastGymTimeMin, params, []);
    expect(gp.curve.length).toBeGreaterThan(0);
  });

  it("handles mmol/L readings", () => {
    const meals = [makeMealEvent({ timeMin: 12 * 60 })];
    const readings = [
      makeGlucoseReading({
        time: "12:30",
        value: 7.5, // mmol/L → ~135 mg/dL
        unit: "mmol/L",
      }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);
    expect(gp.curve.length).toBeGreaterThan(0);
    // Should still produce valid curve
    const atReading = gp.curve.find((p) => p.timeMin === 12 * 60 + 30)!;
    expect(atReading.value).toBeGreaterThan(40);
  });

  it("multiple readings refine the curve further", () => {
    const mealTime = 12 * 60;
    const meals = [
      makeMealEvent({
        timeMin: mealTime,
        netCarbs: 50,
        protein: 30,
        fat: 10,
        totalGrams: 90,
      }),
    ];

    const parametric = predictGlucoseCurve(meals, [], null, params);

    // One reading
    const reading1 = makeGlucoseReading({
      time: "12:30",
      value:
        parametric.curve.find((p) => p.timeMin === mealTime + 30)!.value + 15,
      unit: "mg/dL",
    });
    const gp1 = predictGlucoseCurveGP(meals, [], null, params, [reading1]);

    // Two readings
    const reading2 = makeGlucoseReading({
      time: "13:00",
      value:
        parametric.curve.find((p) => p.timeMin === mealTime + 60)!.value + 10,
      unit: "mg/dL",
    });
    const gp2 = predictGlucoseCurveGP(meals, [], null, params, [
      reading1,
      reading2,
    ]);

    // With 2 readings, band at reading2 time should be narrower than with 1 reading
    const at60min_1 = gp1.curve.find((p) => p.timeMin === mealTime + 60)!;
    const at60min_2 = gp2.curve.find((p) => p.timeMin === mealTime + 60)!;
    const band1 = at60min_1.upper - at60min_1.lower;
    const band2 = at60min_2.upper - at60min_2.lower;
    expect(band2).toBeLessThan(band1);
  });

  it("returns correct number of curve points (289 = 24*60/5 + 1)", () => {
    const meals = [makeMealEvent()];
    const gp = predictGlucoseCurveGP(meals, [], null, params, []);
    expect(gp.curve).toHaveLength(289);
  });

  it("all curve points have upper >= value >= lower", () => {
    const meals = [makeMealEvent()];
    const readings = [
      makeGlucoseReading({ time: "12:30", value: 140, unit: "mg/dL" }),
      makeGlucoseReading({ time: "13:30", value: 100, unit: "mg/dL" }),
    ];

    const gp = predictGlucoseCurveGP(meals, [], null, params, readings);
    for (const p of gp.curve) {
      expect(p.upper).toBeGreaterThanOrEqual(p.value);
      expect(p.value).toBeGreaterThanOrEqual(p.lower);
    }
  });
});
