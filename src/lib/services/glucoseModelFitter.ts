import type { GlucoseModelParams, GlucoseReading } from "$lib/types";
import { toMgDl } from "$lib/services/glucoseData";
import {
  defaultParams,
  glucoseRise,
  mealPeakTime,
  gammaResponse,
  circadianModifier,
  exerciseModifier,
  dawnPhenomenonCurve,
} from "$lib/services/glucoseModel";
import type { MealEvent, ExerciseEvent } from "$lib/services/glucoseModel";

// ── Types ──

export interface PairedReading {
  reading: GlucoseReading;
  mgdl: number;
  timeMin: number;
}

export type ConfidenceLevel = "none" | "low" | "medium" | "high";

export interface ParamConfidence {
  fasting_baseline: ConfidenceLevel;
  carb_sensitivity: ConfidenceLevel;
  protein_sensitivity: ConfidenceLevel;
  exercise_reduction: ConfidenceLevel;
  circadian: ConfidenceLevel;
  overall: ConfidenceLevel;
}

// ── Staged Thresholds ──

const STAGE_1_MIN = 1; // fasting baseline only
const STAGE_2_MIN = 3; // + carb/protein sensitivity
const STAGE_3_MIN = 15; // + exercise/fat delay
const STAGE_4_MIN = 30; // + circadian/dawn/peakTime

// ── Fitting Functions ──

/** Fit fasting baseline from fasting readings using exponential moving average.
 *  When params are provided, morning readings are dawn-adjusted (subtract dawn phenomenon contribution)
 *  so that the baseline reflects true resting glucose, not dawn-inflated values. */
export function fitFastingBaseline(
  fastingReadings: PairedReading[],
  params?: GlucoseModelParams,
): number {
  if (fastingReadings.length === 0)
    return defaultParams().fasting_baseline_mgdl;
  const alpha = 0.3; // EMA smoothing factor

  function adjusted(pr: PairedReading): number {
    if (!params) return pr.mgdl;
    // Subtract dawn phenomenon contribution at this reading's time
    const dawnOffset = dawnPhenomenonCurve(pr.timeMin, params);
    return pr.mgdl - dawnOffset;
  }

  let ema = adjusted(fastingReadings[0]);
  for (let i = 1; i < fastingReadings.length; i++) {
    ema = alpha * adjusted(fastingReadings[i]) + (1 - alpha) * ema;
  }
  return Math.round(ema * 10) / 10;
}

/** Fit carb and protein sensitivity using simple 2-variable linear regression */
export function fitMealSensitivity(
  pairedReadings: PairedReading[],
  meals: MealEvent[],
  params: GlucoseModelParams,
): { carb_sensitivity: number; protein_sensitivity: number } {
  // We need post-meal readings matched to meals
  const observations: { delta: number; netCarbs: number; protein: number }[] =
    [];

  for (const pr of pairedReadings) {
    // Find the meal closest before this reading (within 120 min)
    const matchingMeal = meals
      .filter((m) => pr.timeMin > m.timeMin && pr.timeMin - m.timeMin <= 120)
      .sort((a, b) => pr.timeMin - a.timeMin - (pr.timeMin - b.timeMin))[0];

    if (!matchingMeal) continue;

    const elapsed = pr.timeMin - matchingMeal.timeMin;
    const peakT = mealPeakTime(matchingMeal, params);
    const response = gammaResponse(elapsed, peakT, params.curve_shape_k);

    if (response < 0.1) continue; // too far from peak to be informative

    const delta = pr.mgdl - params.fasting_baseline_mgdl;

    observations.push({
      delta: delta / response, // normalize by response curve position
      netCarbs: matchingMeal.netCarbs,
      protein: matchingMeal.protein,
    });
  }

  if (observations.length === 0) {
    return {
      carb_sensitivity: params.carb_sensitivity,
      protein_sensitivity: params.protein_sensitivity,
    };
  }

  // Single observation: compute weighted average sensitivity directly
  if (observations.length === 1) {
    const obs = observations[0];
    const totalMacro = obs.netCarbs + obs.protein;
    if (totalMacro < 1) {
      return {
        carb_sensitivity: params.carb_sensitivity,
        protein_sensitivity: params.protein_sensitivity,
      };
    }
    // Attribute delta proportionally to carbs vs protein
    const overallSens = obs.delta / totalMacro;
    const carbRatio =
      defaultParams().carb_sensitivity /
      (defaultParams().carb_sensitivity + defaultParams().protein_sensitivity);
    return {
      carb_sensitivity: Math.max(
        0.5,
        Math.min(10, Math.round((overallSens / carbRatio) * 100) / 100),
      ),
      protein_sensitivity: Math.max(
        0.1,
        Math.min(3, Math.round((overallSens / (1 - carbRatio)) * 100) / 100),
      ),
    };
  }

  // 2+ observations: least-squares regression — delta ≈ a * netCarbs + b * protein
  let sumCC = 0,
    sumPP = 0,
    sumCP = 0,
    sumCD = 0,
    sumPD = 0;
  for (const obs of observations) {
    sumCC += obs.netCarbs * obs.netCarbs;
    sumPP += obs.protein * obs.protein;
    sumCP += obs.netCarbs * obs.protein;
    sumCD += obs.netCarbs * obs.delta;
    sumPD += obs.protein * obs.delta;
  }

  const det = sumCC * sumPP - sumCP * sumCP;
  if (Math.abs(det) < 1e-6) {
    return {
      carb_sensitivity: params.carb_sensitivity,
      protein_sensitivity: params.protein_sensitivity,
    };
  }

  const carbSens = (sumPP * sumCD - sumCP * sumPD) / det;
  const protSens = (sumCC * sumPD - sumCP * sumCD) / det;

  return {
    carb_sensitivity: Math.max(
      0.5,
      Math.min(10, Math.round(carbSens * 100) / 100),
    ),
    protein_sensitivity: Math.max(
      0.1,
      Math.min(3, Math.round(protSens * 100) / 100),
    ),
  };
}

/** Fit exercise reduction percentage using grid search */
export function fitExerciseReduction(
  readings: PairedReading[],
  meals: MealEvent[],
  exercises: ExerciseEvent[],
  params: GlucoseModelParams,
): number {
  if (exercises.length === 0 || readings.length === 0)
    return params.exercise_reduction_pct;

  // Get readings during/after exercise windows
  const exReadings = readings.filter((pr) => {
    return exercises.some(
      (ex) => pr.timeMin >= ex.startMin && pr.timeMin <= ex.endMin + 120,
    );
  });

  if (exReadings.length < 2) return params.exercise_reduction_pct;

  let bestPct = params.exercise_reduction_pct;
  let bestError = Infinity;

  // Grid search from 10% to 60%
  for (let pct = 10; pct <= 60; pct += 5) {
    const testParams = { ...params, exercise_reduction_pct: pct };
    let totalError = 0;

    for (const pr of exReadings) {
      let predicted = testParams.fasting_baseline_mgdl;
      predicted += dawnPhenomenonCurve(pr.timeMin, testParams);

      for (const meal of meals) {
        const elapsed = pr.timeMin - meal.timeMin;
        if (elapsed > 0) {
          const rise = glucoseRise(meal, testParams);
          const peak = mealPeakTime(meal, testParams);
          const response = gammaResponse(
            elapsed,
            peak,
            testParams.curve_shape_k,
          );
          const circadian = circadianModifier(meal.timeMin, testParams);
          predicted += rise * response * circadian;
        }
      }

      const exMod = exerciseModifier(pr.timeMin, exercises, testParams);
      const delta = predicted - testParams.fasting_baseline_mgdl;
      predicted = testParams.fasting_baseline_mgdl + delta * exMod;

      totalError += Math.pow(predicted - pr.mgdl, 2);
    }

    if (totalError < bestError) {
      bestError = totalError;
      bestPct = pct;
    }
  }

  return bestPct;
}

/** Staged fitting coordinator */
export function fitParams(
  allReadings: GlucoseReading[],
  meals: MealEvent[],
  exercises: ExerciseEvent[],
  currentParams: GlucoseModelParams,
): GlucoseModelParams {
  const paired: PairedReading[] = allReadings.map((r) => ({
    reading: r,
    mgdl: toMgDl(r.value, r.unit),
    timeMin: (() => {
      const [h, m] = r.time.split(":").map(Number);
      return h * 60 + m;
    })(),
  }));

  const n = paired.length;
  const params = { ...currentParams, data_points_used: n };

  if (n < STAGE_1_MIN) return params;

  // Stage 1: fasting baseline
  // Include: tagged fasting, before-8am, and non-fasting readings with no meal within 3h
  const fastingReadings = paired.filter((p) => {
    if (p.reading.reading_type === "fasting" || p.timeMin < 8 * 60) return true;
    // Also consider readings in fasting windows (no meal within prior 3h)
    const hasRecentMeal = meals.some(
      (m) => p.timeMin > m.timeMin && p.timeMin - m.timeMin <= 180,
    );
    return (
      !hasRecentMeal &&
      (p.reading.reading_type === "random" ||
        p.reading.reading_type === "bedtime")
    );
  });
  if (fastingReadings.length > 0) {
    params.fasting_baseline_mgdl = fitFastingBaseline(fastingReadings, params);
  } else {
    // No fasting readings yet — use lowest reading as baseline ceiling
    // Any reading is an upper bound on what fasting could be
    const lowestReading = Math.min(...paired.map((p) => p.mgdl));
    if (lowestReading < params.fasting_baseline_mgdl) {
      params.fasting_baseline_mgdl = lowestReading;
    }
  }

  if (n < STAGE_2_MIN) return params;

  // Stage 2: carb + protein sensitivity
  const mealSens = fitMealSensitivity(paired, meals, params);
  params.carb_sensitivity = mealSens.carb_sensitivity;
  params.protein_sensitivity = mealSens.protein_sensitivity;

  if (n < STAGE_3_MIN) return params;

  // Stage 3: exercise reduction + fat delay
  params.exercise_reduction_pct = fitExerciseReduction(
    paired,
    meals,
    exercises,
    params,
  );

  if (n < STAGE_4_MIN) return params;

  // Stage 4: would fit circadian/dawn/peakTime (kept as defaults for now)
  // These require more sophisticated fitting with time-stratified data

  params.last_fit_at = new Date().toISOString();
  return params;
}

/** Per-parameter confidence level based on data points */
export function parameterConfidence(
  params: GlucoseModelParams,
): ParamConfidence {
  const n = params.data_points_used;
  return {
    fasting_baseline:
      n >= STAGE_1_MIN ? (n >= STAGE_2_MIN ? "high" : "medium") : "none",
    carb_sensitivity:
      n >= STAGE_2_MIN ? (n >= STAGE_3_MIN ? "high" : "medium") : "none",
    protein_sensitivity:
      n >= STAGE_2_MIN ? (n >= STAGE_3_MIN ? "high" : "medium") : "none",
    exercise_reduction:
      n >= STAGE_3_MIN ? (n >= STAGE_4_MIN ? "high" : "medium") : "none",
    circadian: n >= STAGE_4_MIN ? "medium" : "none",
    overall:
      n === 0
        ? "none"
        : n < STAGE_2_MIN
          ? "low"
          : n < STAGE_4_MIN
            ? "medium"
            : "high",
  };
}
