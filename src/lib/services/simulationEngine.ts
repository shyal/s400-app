import type {
  WeightEntry,
  Workout,
  SimScenario,
  ProjectionPoint,
  SimulationResult,
  SimulationConfig,
  SamplePath,
  SamplePathPoint,
} from "$lib/types";
import type { GPHyperparams } from "./gaussianProcess";
import { gpPredict } from "./gaussianProcess";

// ── Strength Progression Detection ──

const COMPOUND_LIFTS = [
  "Squat",
  "Bench Press",
  "Barbell Row",
  "Overhead Press",
  "Deadlift",
];

/**
 * Determines if strength is progressing based on recent workout history.
 * Only considers workouts from the last 30 days. For each compound lift,
 * takes the last `window` appearances, splits into an earlier half and
 * recent half, and compares averages. Returns true if at least one compound
 * is tracked and the mean recent average across all compounds >= earlier.
 */
export function isStrengthProgressing(
  workouts: Workout[],
  window: number = 6,
): boolean {
  if (workouts.length === 0) return false;

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const sorted = [...workouts]
    .filter((w) => w.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const liftDeltas: number[] = [];

  for (const liftName of COMPOUND_LIFTS) {
    const weights: number[] = [];
    for (const w of sorted) {
      const ex = w.exercises.find((e) => e.name === liftName);
      if (ex) weights.push(ex.targetWeight_kg);
    }

    if (weights.length < 2) continue;

    // Only look at the last `window` appearances
    const recent = weights.slice(-window);
    const mid = Math.floor(recent.length / 2);
    const earlierHalf = recent.slice(0, mid);
    const recentHalf = recent.slice(mid);

    const earlierAvg =
      earlierHalf.reduce((s, v) => s + v, 0) / earlierHalf.length;
    const recentAvg = recentHalf.reduce((s, v) => s + v, 0) / recentHalf.length;

    liftDeltas.push(recentAvg - earlierAvg);
  }

  if (liftDeltas.length === 0) return false;

  // Average delta across all tracked compounds
  const meanDelta = liftDeltas.reduce((s, v) => s + v, 0) / liftDeltas.length;
  return meanDelta >= 0;
}

// ── Weighted Linear Regression ──

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  residualStdDev: number;
}

/**
 * Weighted linear regression with exponential decay.
 * Recent data points get more weight (half-life in days).
 * X values = days since first entry, Y values = weight_kg.
 */
export function weightedLinearRegression(
  entries: WeightEntry[],
  halfLifeDays: number = 14,
): RegressionResult {
  if (entries.length === 0) {
    return { slope: 0, intercept: 0, r2: 0, residualStdDev: 0 };
  }
  if (entries.length === 1) {
    return {
      slope: 0,
      intercept: entries[0].weight_kg,
      r2: 1,
      residualStdDev: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(sorted[0].date).getTime();
  const tLast = new Date(sorted[sorted.length - 1].date).getTime();
  const maxAge = (tLast - t0) / (1000 * 60 * 60 * 24);
  const ln2 = Math.LN2;

  // Compute weights and day offsets
  const points = sorted.map((e) => {
    const days = (new Date(e.date).getTime() - t0) / (1000 * 60 * 60 * 24);
    const age = maxAge - days; // age from most recent
    const w = Math.exp((-ln2 * age) / halfLifeDays);
    return { x: days, y: e.weight_kg, w };
  });

  // Weighted sums
  let sumW = 0,
    sumWX = 0,
    sumWY = 0,
    sumWXX = 0,
    sumWXY = 0;
  for (const p of points) {
    sumW += p.w;
    sumWX += p.w * p.x;
    sumWY += p.w * p.y;
    sumWXX += p.w * p.x * p.x;
    sumWXY += p.w * p.x * p.y;
  }

  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 1e-12) {
    const meanY = sumWY / sumW;
    return { slope: 0, intercept: meanY, r2: 0, residualStdDev: 0 };
  }

  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;

  // Weighted R² and residual std dev
  const meanY = sumWY / sumW;
  let ssTot = 0,
    ssRes = 0;
  for (const p of points) {
    const pred = intercept + slope * p.x;
    ssRes += p.w * (p.y - pred) ** 2;
    ssTot += p.w * (p.y - meanY) ** 2;
  }

  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;
  const residualStdDev = Math.sqrt(ssRes / sumW);

  return { slope, intercept, r2, residualStdDev };
}

/**
 * Convenience: effective daily rate (kg/day) from weighted regression.
 */
export function effectiveDailyRate(entries: WeightEntry[]): number {
  return weightedLinearRegression(entries).slope;
}

// ── Body Composition ──

/**
 * Estimate lean mass from last N entries that have muscle_mass_kg.
 */
export function estimateLeanMass(
  entries: WeightEntry[],
  n: number = 7,
): number {
  const withMuscle = entries
    .filter((e) => e.muscle_mass_kg != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);

  if (withMuscle.length === 0) return 0;
  return (
    withMuscle.reduce((s, e) => s + e.muscle_mass_kg!, 0) / withMuscle.length
  );
}

/**
 * Muscle mass trend: returns { latestMuscle, dailyRate } from entries with muscle data.
 * Uses simple linear regression on muscle_mass_kg over time.
 */
export function muscleMassTrend(entries: WeightEntry[]): {
  latestMuscle: number;
  dailyRate: number;
} {
  const withMuscle = entries
    .filter((e) => e.muscle_mass_kg != null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (withMuscle.length === 0) return { latestMuscle: 0, dailyRate: 0 };
  if (withMuscle.length === 1)
    return { latestMuscle: withMuscle[0].muscle_mass_kg!, dailyRate: 0 };

  const t0 = new Date(withMuscle[0].date).getTime();
  const n = withMuscle.length;
  let sumX = 0,
    sumY = 0,
    sumXX = 0,
    sumXY = 0;
  for (const e of withMuscle) {
    const x = (new Date(e.date).getTime() - t0) / (1000 * 60 * 60 * 24);
    const y = e.muscle_mass_kg!;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumXY += x * y;
  }

  const denom = n * sumXX - sumX * sumX;
  const latestMuscle = withMuscle[withMuscle.length - 1].muscle_mass_kg!;
  if (Math.abs(denom) < 1e-12) return { latestMuscle, dailyRate: 0 };

  const dailyRate = (n * sumXY - sumX * sumY) / denom;
  return { latestMuscle, dailyRate };
}

/**
 * Derive body fat % from weight and lean mass.
 */
export function derivedBodyFat(weightKg: number, leanMassKg: number): number {
  if (weightKg <= 0) return 0;
  if (leanMassKg >= weightKg) return 0;
  return ((weightKg - leanMassKg) / weightKg) * 100;
}

/**
 * Linear correlation of visceral fat vs weight.
 * Returns { slope, intercept } so visceral = slope * weight + intercept.
 */
export function visceralFatCorrelation(entries: WeightEntry[]): {
  slope: number;
  intercept: number;
} {
  const valid = entries.filter((e) => e.visceral_fat != null);
  if (valid.length < 2) {
    const avg = valid.length === 1 ? valid[0].visceral_fat! : 10;
    return { slope: 0, intercept: avg };
  }

  const n = valid.length;
  let sumX = 0,
    sumY = 0,
    sumXX = 0,
    sumXY = 0;
  for (const e of valid) {
    sumX += e.weight_kg;
    sumY += e.visceral_fat!;
    sumXX += e.weight_kg * e.weight_kg;
    sumXY += e.weight_kg * e.visceral_fat!;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Linear correlation of water% vs body_fat%.
 * Returns { slope, intercept } so water% = slope * bf% + intercept.
 */
export function waterPercentCorrelation(entries: WeightEntry[]): {
  slope: number;
  intercept: number;
} {
  const valid = entries.filter(
    (e) => e.water_percent != null && e.body_fat_pct != null,
  );
  if (valid.length < 2) {
    const avg = valid.length === 1 ? valid[0].water_percent! : 55;
    return { slope: 0, intercept: avg };
  }

  const n = valid.length;
  let sumX = 0,
    sumY = 0,
    sumXX = 0,
    sumXY = 0;
  for (const e of valid) {
    sumX += e.body_fat_pct!;
    sumY += e.water_percent!;
    sumXX += e.body_fat_pct! * e.body_fat_pct!;
    sumXY += e.body_fat_pct! * e.water_percent!;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ── Volatility & Confidence ──

/**
 * Standard deviation of day-to-day weight changes.
 */
export function dailyVolatility(entries: WeightEntry[]): number {
  if (entries.length < 2) return 0.3; // default
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const diffs: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    diffs.push(sorted[i].weight_kg - sorted[i - 1].weight_kg);
  }
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance =
    diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / diffs.length;
  return Math.sqrt(variance);
}

/**
 * Projection confidence sigma: combines residual uncertainty + drift over time.
 * sigma(d) = sqrt(residualStdDev² + d * volatility²)
 */
export function projectionSigma(
  daysOut: number,
  residualStdDev: number,
  volatility: number,
): number {
  return Math.sqrt(residualStdDev ** 2 + daysOut * volatility ** 2);
}

// ── GP Weight Projection ──

export const WEIGHT_GP_PARAMS: GPHyperparams = {
  lengthScale: 14, // 14 days — captures biweekly cycles
  signalVariance: 4, // residuals range ±2kg
  noiseVariance: 0.25, // daily scale noise ~0.5kg
};

export interface GPProjectionResult {
  projectedWeights: number[];
  upper: number[];
  lower: number[];
}

/**
 * GP-enhanced weight projection: detrend with linear regression,
 * fit GP on residuals, reconstruct with GP mean + trend.
 */
export function gpWeightProjection(
  entries: WeightEntry[],
  futureDays: number,
  dailyRate: number,
): GPProjectionResult {
  if (entries.length === 0) {
    const projectedWeights = Array.from({ length: futureDays + 1 }, () => 0);
    const sigma = Math.sqrt(WEIGHT_GP_PARAMS.signalVariance);
    return {
      projectedWeights,
      upper: projectedWeights.map((w) => w + 1.96 * sigma),
      lower: projectedWeights.map((w) => w - 1.96 * sigma),
    };
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(sorted[0].date).getTime();

  const trainX = sorted.map(
    (e) => (new Date(e.date).getTime() - t0) / (1000 * 60 * 60 * 24),
  );
  const trainY = sorted.map((e) => e.weight_kg);

  // Detrend using weighted linear regression
  const reg = weightedLinearRegression(entries);
  const residuals = trainX.map(
    (x, i) => trainY[i] - (reg.intercept + reg.slope * x),
  );

  // Build test X: future days from today
  const today = new Date();
  const todayDays = (today.getTime() - t0) / (1000 * 60 * 60 * 24);
  const testX = Array.from({ length: futureDays + 1 }, (_, d) => todayDays + d);

  // GP prediction on residuals
  const gpResults = gpPredict(trainX, residuals, testX, WEIGHT_GP_PARAMS);

  const latestWeight = sorted[sorted.length - 1].weight_kg;
  const projectedWeights: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];

  for (let d = 0; d <= futureDays; d++) {
    const trendWeight = latestWeight + dailyRate * d;
    const gpMean = gpResults[d].mean;
    const gpVar = gpResults[d].variance;
    const sigma = Math.sqrt(gpVar);

    const w = trendWeight + gpMean;
    projectedWeights.push(w);
    upper.push(w + 1.96 * sigma);
    lower.push(w - 1.96 * sigma);
  }

  return { projectedWeights, upper, lower };
}

// ── Monte Carlo Sample Paths ──

/**
 * Seeded PRNG (mulberry32). Returns a function () => number in [0,1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Box-Muller transform: generate N(0,1) sample from uniform RNG.
 */
export function boxMullerTransform(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return (
    Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
  );
}

export interface SamplePathComposition {
  latestMuscle: number;
  muscleDailyRate: number;
  bfOffset: number;
  vfSlope: number;
  vfIntercept: number;
}

/**
 * Generate N Monte Carlo sample paths starting from latestWeight.
 * Each path adds dailyRate + Gaussian noise each day.
 * When composition params are provided, derives body fat, muscle, and visceral fat.
 */
export function generateSamplePaths(
  latestWeight: number,
  dailyRate: number,
  volatility: number,
  totalDays: number,
  n: number = 30,
  seed?: number,
  composition?: SamplePathComposition,
): SamplePath[] {
  const rng = mulberry32(seed ?? Date.now());
  const today = new Date();
  const paths: SamplePath[] = [];

  for (let p = 0; p < n; p++) {
    const points: SamplePathPoint[] = [];
    let w = latestWeight;

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
      const noise = boxMullerTransform(rng) * volatility;
      w += dailyRate + noise;

      let body_fat_pct = 0;
      let muscle_mass_kg = 0;
      let visceral_fat = 0;

      if (composition) {
        // Muscle noise scales with ~0.3kg daily variation (bioimpedance measurement noise)
        const muscleNoise = boxMullerTransform(rng) * 0.3;
        muscle_mass_kg =
          composition.latestMuscle +
          composition.muscleDailyRate * d +
          muscleNoise;
        body_fat_pct =
          (muscle_mass_kg > 0 ? derivedBodyFat(w, muscle_mass_kg) : 0) +
          composition.bfOffset;
        visceral_fat = composition.vfSlope * w + composition.vfIntercept;
      }

      points.push({
        date: date.toISOString().split("T")[0],
        weight_kg: w,
        body_fat_pct,
        muscle_mass_kg,
        visceral_fat,
      });
    }
    paths.push({ points });
  }

  return paths;
}

// ── Rate & Projection ──

/**
 * Required daily rate to hit goal weight by goal date.
 */
export function requiredDailyRate(
  currentKg: number,
  goalKg: number,
  goalDate: string,
): number {
  const now = new Date();
  const goal = new Date(goalDate);
  const daysLeft = Math.max(
    1,
    (goal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return (goalKg - currentKg) / daysLeft;
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Generate a projection for a single scenario.
 */
export function generateProjection(
  entries: WeightEntry[],
  scenario: SimScenario,
  config: SimulationConfig,
): SimulationResult {
  if (entries.length === 0) {
    return {
      scenario,
      points: [],
      projectedGoalDate: null,
      projectedWeightAtGoal: config.goalKg,
      projectedBfAtGoal: 0,
      weeklyRate: 0,
      daysToGoal: null,
      samplePaths: [],
    };
  }

  const reg = weightedLinearRegression(entries);
  const vol = dailyVolatility(entries);
  const leanMass = estimateLeanMass(entries);
  const rawMuscleTrend = muscleMassTrend(entries);
  // If strength is progressing, bioimpedance muscle loss is noise — clamp to flat/positive
  const muscleTrend =
    config.strengthProgressing && rawMuscleTrend.dailyRate < 0
      ? { ...rawMuscleTrend, dailyRate: 0 }
      : rawMuscleTrend;
  const vfCorr = visceralFatCorrelation(entries);

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latestEntry = sorted[sorted.length - 1];
  const latestWeight = latestEntry.weight_kg;

  // Body fat offset: align derived bf% with last actual scale reading
  const lastMeasuredBf =
    [...sorted].reverse().find((e) => e.body_fat_pct != null)?.body_fat_pct ??
    null;
  const derivedBfAtLatest =
    leanMass > 0 ? derivedBodyFat(latestWeight, leanMass) : 0;
  const bfOffset =
    lastMeasuredBf != null && leanMass > 0
      ? lastMeasuredBf - derivedBfAtLatest
      : 0;

  // Determine daily rate based on scenario
  let dailyRate: number;
  switch (scenario) {
    case "current":
      dailyRate = reg.slope;
      break;
    case "goal":
      dailyRate = requiredDailyRate(
        latestWeight,
        config.goalKg,
        config.goalDate,
      );
      break;
    case "custom":
      dailyRate = (config.customWeeklyRate ?? -0.5) / 7;
      break;
  }

  const weeklyRate = dailyRate * 7;

  // Generate daily points from today past goalDate until goal weight is reached
  const today = new Date();
  const goalDate = new Date(config.goalDate);
  const daysToGoalDate = Math.max(
    1,
    Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // If current rate won't reach goal weight by goal date, extend until it does (max 2 years)
  let totalDays = daysToGoalDate;
  if (dailyRate < 0 && latestWeight > config.goalKg) {
    const daysNeededForGoalWeight = Math.ceil(
      (latestWeight - config.goalKg) / Math.abs(dailyRate),
    );
    totalDays = Math.min(
      Math.max(daysToGoalDate, daysNeededForGoalWeight),
      730,
    );
  }

  // Use GP projection for 'current' scenario, linear for others
  const useGP = scenario === "current" && entries.length >= 2;
  const gpResult = useGP
    ? gpWeightProjection(entries, totalDays, dailyRate)
    : null;

  const points: ProjectionPoint[] = [];
  let projectedGoalDate: string | null = null;
  let daysToGoal: number | null = null;
  let projectedWeightAtGoal = latestWeight + dailyRate * totalDays;
  let projectedBfAtGoal = 0;

  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);

    let weight: number;
    let weightUpper: number;
    let weightLower: number;

    if (gpResult) {
      weight = gpResult.projectedWeights[d];
      weightUpper = gpResult.upper[d];
      weightLower = gpResult.lower[d];
    } else {
      weight = latestWeight + dailyRate * d;
      const sigma = projectionSigma(d, reg.residualStdDev, vol);
      weightUpper = weight + 1.96 * sigma;
      weightLower = weight - 1.96 * sigma;
    }

    const muscleKg =
      muscleTrend.latestMuscle > 0
        ? muscleTrend.latestMuscle + muscleTrend.dailyRate * d
        : leanMass;
    const bf = (muscleKg > 0 ? derivedBodyFat(weight, muscleKg) : 0) + bfOffset;
    const sigma = gpResult
      ? (gpResult.upper[d] - gpResult.lower[d]) / (2 * 1.96)
      : projectionSigma(d, reg.residualStdDev, vol);
    const bfSigma = muscleKg > 0 ? (sigma / weight) * 100 : 0;
    const vf = vfCorr.slope * weight + vfCorr.intercept;

    points.push({
      date: dateStr(date),
      weight_kg: weight,
      body_fat_pct: bf,
      muscle_mass_kg: muscleKg,
      visceral_fat: vf,
      weight_upper: weightUpper,
      weight_lower: weightLower,
      bf_upper: bf + 1.96 * bfSigma,
      bf_lower: Math.max(0, bf - 1.96 * bfSigma),
    });

    // Check if we've crossed the goal
    if (
      projectedGoalDate === null &&
      weight <= config.goalKg &&
      dailyRate < 0
    ) {
      projectedGoalDate = dateStr(date);
      daysToGoal = d;
    }
  }

  // If we never crossed the goal and rate is negative, extrapolate
  if (
    projectedGoalDate === null &&
    dailyRate < 0 &&
    latestWeight > config.goalKg
  ) {
    const daysNeeded = (latestWeight - config.goalKg) / Math.abs(dailyRate);
    const goalD = new Date(today.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
    projectedGoalDate = dateStr(goalD);
    daysToGoal = Math.ceil(daysNeeded);
  }

  projectedWeightAtGoal = gpResult
    ? gpResult.projectedWeights[totalDays]
    : latestWeight + dailyRate * totalDays;
  const finalMuscle =
    muscleTrend.latestMuscle > 0
      ? muscleTrend.latestMuscle + muscleTrend.dailyRate * totalDays
      : leanMass;
  projectedBfAtGoal =
    (finalMuscle > 0 ? derivedBodyFat(projectedWeightAtGoal, finalMuscle) : 0) +
    bfOffset;

  // Generate sample paths for 'current' scenario only
  const samplePaths =
    scenario === "current"
      ? generateSamplePaths(
          latestWeight,
          dailyRate,
          vol,
          totalDays,
          30,
          undefined,
          {
            latestMuscle: muscleTrend.latestMuscle,
            muscleDailyRate: muscleTrend.dailyRate,
            bfOffset,
            vfSlope: vfCorr.slope,
            vfIntercept: vfCorr.intercept,
          },
        )
      : [];

  return {
    scenario,
    points,
    projectedGoalDate,
    projectedWeightAtGoal,
    projectedBfAtGoal,
    weeklyRate,
    daysToGoal,
    samplePaths,
  };
}

/**
 * Generate all 3 scenarios at once.
 */
export function generateAllScenarios(
  entries: WeightEntry[],
  config: SimulationConfig,
): SimulationResult[] {
  return [
    generateProjection(entries, "current", config),
    generateProjection(entries, "goal", config),
    generateProjection(entries, "custom", config),
  ];
}
