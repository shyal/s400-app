import type { GlucoseReading, FoodEntry } from "$lib/types";
import { toMgDl } from "$lib/services/glucoseData";
import type { GlucosePoint } from "$lib/services/glucoseModel";

// ── Types ──

export interface FastingTrend {
  average: number;
  trend: "improving" | "stable" | "worsening";
  readings: { date: string; mgdl: number }[];
  dawnPhenomenonDetected: boolean;
}

export interface PostMealSummary {
  averagePeak: number;
  worstMeal: { name: string; peakMgdl: number } | null;
  bestMeal: { name: string; peakMgdl: number } | null;
  responseCount: number;
}

export interface GlucoseZones {
  hypo: number; // minutes in <70
  normal: number; // minutes in 70-100
  elevated: number; // minutes in 100-140
  high: number; // minutes in >140
  total: number;
}

export interface ModelAccuracy {
  mae: number; // mean absolute error
  r2: number; // R-squared
  n: number; // sample count
}

// ── Functions ──

/** Fasting glucose trend over N days */
export function fastingGlucoseTrend(
  readings: GlucoseReading[],
  days: number = 14,
): FastingTrend {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const fasting = readings
    .filter((r) => r.reading_type === "fasting" && r.date >= cutoffStr)
    .map((r) => ({ date: r.date, mgdl: toMgDl(r.value, r.unit) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (fasting.length === 0) {
    return {
      average: 0,
      trend: "stable",
      readings: [],
      dawnPhenomenonDetected: false,
    };
  }

  const average =
    Math.round(
      (fasting.reduce((s, f) => s + f.mgdl, 0) / fasting.length) * 10,
    ) / 10;

  // Trend: compare first half to second half
  let trend: "improving" | "stable" | "worsening" = "stable";
  if (fasting.length >= 4) {
    const mid = Math.floor(fasting.length / 2);
    const firstHalf =
      fasting.slice(0, mid).reduce((s, f) => s + f.mgdl, 0) / mid;
    const secondHalf =
      fasting.slice(mid).reduce((s, f) => s + f.mgdl, 0) /
      (fasting.length - mid);
    const diff = secondHalf - firstHalf;
    if (diff < -3) trend = "improving";
    else if (diff > 3) trend = "worsening";
  }

  // Dawn phenomenon: fasting readings consistently above 95
  const dawnPhenomenonDetected = fasting.length >= 3 && average > 95;

  return { average, trend, readings: fasting, dawnPhenomenonDetected };
}

/** Post-meal response summary */
export function postMealResponseSummary(
  readings: GlucoseReading[],
  meals: FoodEntry[],
): PostMealSummary {
  const postMealReadings = readings.filter(
    (r) =>
      r.reading_type === "post_meal_30" || r.reading_type === "post_meal_60",
  );

  if (postMealReadings.length === 0) {
    return {
      averagePeak: 0,
      worstMeal: null,
      bestMeal: null,
      responseCount: 0,
    };
  }

  // Match readings to meals by time proximity
  const responses: { mealName: string; peakMgdl: number }[] = [];

  for (const reading of postMealReadings) {
    const mgdl = toMgDl(reading.value, reading.unit);
    const [rh, rm] = reading.time.split(":").map(Number);
    const readingMin = rh * 60 + rm;

    // Find closest preceding meal
    const matchedMeal = meals
      .filter((m) => {
        const [mh, mm] = m.time.split(":").map(Number);
        const mealMin = mh * 60 + mm;
        const diff = readingMin - mealMin;
        return diff > 0 && diff <= 120 && m.date === reading.date;
      })
      .sort((a, b) => {
        const [ah, am] = a.time.split(":").map(Number);
        const [bh, bm] = b.time.split(":").map(Number);
        // Sort by closest (smallest diff) first
        return readingMin - (ah * 60 + am) - (readingMin - (bh * 60 + bm));
      })[0];

    responses.push({
      mealName: matchedMeal?.name ?? "Unknown meal",
      peakMgdl: mgdl,
    });
  }

  const averagePeak =
    Math.round(
      (responses.reduce((s, r) => s + r.peakMgdl, 0) / responses.length) * 10,
    ) / 10;

  const sorted = [...responses].sort((a, b) => a.peakMgdl - b.peakMgdl);
  const bestMeal = { name: sorted[0].mealName, peakMgdl: sorted[0].peakMgdl };
  const worstMeal = {
    name: sorted[sorted.length - 1].mealName,
    peakMgdl: sorted[sorted.length - 1].peakMgdl,
  };

  return { averagePeak, worstMeal, bestMeal, responseCount: responses.length };
}

/** Time in glucose zones from a predicted curve */
export function glucoseZones(curve: GlucosePoint[]): GlucoseZones {
  if (curve.length === 0) {
    return { hypo: 0, normal: 0, elevated: 0, high: 0, total: 0 };
  }

  // Determine step size from curve
  const step = curve.length > 1 ? curve[1].timeMin - curve[0].timeMin : 5;

  let hypo = 0,
    normal = 0,
    elevated = 0,
    high = 0;
  for (const p of curve) {
    if (p.value < 70) hypo += step;
    else if (p.value <= 100) normal += step;
    else if (p.value <= 140) elevated += step;
    else high += step;
  }

  return {
    hypo,
    normal,
    elevated,
    high,
    total: hypo + normal + elevated + high,
  };
}

/** Model accuracy metrics: MAE and R-squared */
export function modelAccuracy(
  predicted: GlucosePoint[],
  actuals: GlucoseReading[],
): ModelAccuracy {
  if (actuals.length === 0) return { mae: 0, r2: 0, n: 0 };

  const pairs: { predicted: number; actual: number }[] = [];

  for (const reading of actuals) {
    const [rh, rm] = reading.time.split(":").map(Number);
    const readingMin = rh * 60 + rm;
    const mgdl = toMgDl(reading.value, reading.unit);

    // Find closest predicted point
    let closest = predicted[0];
    let minDiff = Math.abs(closest.timeMin - readingMin);
    for (const p of predicted) {
      const diff = Math.abs(p.timeMin - readingMin);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    if (minDiff <= 5) {
      pairs.push({ predicted: closest.value, actual: mgdl });
    }
  }

  if (pairs.length === 0) return { mae: 0, r2: 0, n: 0 };

  // MAE
  const mae =
    Math.round(
      (pairs.reduce((s, p) => s + Math.abs(p.predicted - p.actual), 0) /
        pairs.length) *
        10,
    ) / 10;

  // R-squared
  const meanActual = pairs.reduce((s, p) => s + p.actual, 0) / pairs.length;
  const ssRes = pairs.reduce(
    (s, p) => s + Math.pow(p.actual - p.predicted, 2),
    0,
  );
  const ssTot = pairs.reduce(
    (s, p) => s + Math.pow(p.actual - meanActual, 2),
    0,
  );
  const r2 = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : 0;

  return { mae, r2, n: pairs.length };
}
