import type { GlucoseReading, GlucoseModelParams } from "$lib/types";
import { toMgDl } from "$lib/services/glucoseData";
import {
  predictGlucoseCurve,
  type MealEvent,
  type ExerciseEvent,
  type GlucosePoint,
} from "$lib/services/glucoseModel";
import {
  gpPredict,
  defaultHyperparams,
  type GPHyperparams,
  type GPPrediction,
} from "$lib/services/gaussianProcess";

export interface GPGlucosePoint extends GlucosePoint {
  upper: number; // mean + 1σ
  lower: number; // mean - 1σ
}

export interface GPGlucosePrediction {
  curve: GPGlucosePoint[];
  peakValue: number;
  peakTimeMin: number;
}

/** Predict glucose curve using parametric model as mean function + GP correction from readings */
export function predictGlucoseCurveGP(
  meals: MealEvent[],
  exercises: ExerciseEvent[],
  lastGymTimeMin: number | null,
  params: GlucoseModelParams,
  readings: GlucoseReading[],
  hyperparams?: GPHyperparams,
): GPGlucosePrediction {
  // 1. Run parametric model
  const parametric = predictGlucoseCurve(
    meals,
    exercises,
    lastGymTimeMin,
    params,
  );

  const hp = hyperparams ?? defaultHyperparams();

  // 2. Compute residuals at reading times
  const trainX: number[] = [];
  const trainY: number[] = [];

  for (const r of readings) {
    const [h, m] = r.time.split(":").map(Number);
    const timeMin = h * 60 + m;
    const mgdl = toMgDl(r.value, r.unit);

    // Find nearest parametric point
    let nearest = parametric.curve[0];
    let bestDist = Math.abs(nearest.timeMin - timeMin);
    for (const p of parametric.curve) {
      const d = Math.abs(p.timeMin - timeMin);
      if (d < bestDist) {
        nearest = p;
        bestDist = d;
      }
    }

    const residual = mgdl - nearest.value;
    trainX.push(timeMin);
    trainY.push(residual);
  }

  // 3. GP prediction on residuals
  const testX = parametric.curve.map((p) => p.timeMin);
  const gpResults: GPPrediction[] = gpPredict(trainX, trainY, testX, hp);

  // 4. Combine: final = parametric + gpMean, bands = ±1σ
  let peakValue = 0;
  let peakTimeMin = 0;

  const curve: GPGlucosePoint[] = parametric.curve.map((p, i) => {
    const gp = gpResults[i];
    const sigma = Math.sqrt(gp.variance);
    const value = Math.max(40, p.value + gp.mean);
    const upper = Math.max(40, p.value + gp.mean + sigma);
    const lower = Math.max(40, p.value + gp.mean - sigma);

    if (value > peakValue) {
      peakValue = value;
      peakTimeMin = p.timeMin;
    }

    return {
      timeMin: p.timeMin,
      value: Math.round(value * 10) / 10,
      upper: Math.round(upper * 10) / 10,
      lower: Math.round(lower * 10) / 10,
    };
  });

  return {
    curve,
    peakValue: Math.round(peakValue * 10) / 10,
    peakTimeMin,
  };
}
