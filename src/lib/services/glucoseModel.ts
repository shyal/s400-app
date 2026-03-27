import type { FoodEntry, StravaActivity, GlucoseModelParams } from "$lib/types";

// ── Internal Types ──

export interface MealEvent {
  timeMin: number;
  netCarbs: number;
  protein: number;
  fat: number;
  totalGrams: number;
}

export interface ExerciseEvent {
  startMin: number;
  endMin: number;
  intensityFactor: number; // 0-1, derived from watts/HR
}

export interface GlucosePoint {
  timeMin: number;
  value: number; // mg/dL
}

export interface GlucosePrediction {
  curve: GlucosePoint[];
  peakValue: number;
  peakTimeMin: number;
}

// ── Constants ──

const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
const STEP = 5;

// ── Default Parameters ──

export function defaultParams(): GlucoseModelParams {
  return {
    fasting_baseline_mgdl: 90,
    carb_sensitivity: 4.0,
    protein_sensitivity: 0.7,
    fat_delay_factor: 1.0,
    exercise_reduction_pct: 30,
    gym_sensitivity_hours: 36,
    gym_sensitivity_pct: 15,
    circadian_evening_pct: 10,
    dawn_phenomenon_mgdl: 10,
    peak_time_min: 30,
    curve_shape_k: 2,
    data_points_used: 0,
    last_fit_at: null,
  };
}

// ── Core Functions ──

/** Peak mg/dL rise from a meal */
export function glucoseRise(
  meal: MealEvent,
  params: GlucoseModelParams,
): number {
  return (
    meal.netCarbs * params.carb_sensitivity +
    meal.protein * params.protein_sensitivity
  );
}

/** Time in minutes to peak glucose for a meal (fat delays the peak) */
export function mealPeakTime(
  meal: MealEvent,
  params: GlucoseModelParams,
): number {
  const fatRatio = meal.totalGrams > 0 ? meal.fat / meal.totalGrams : 0;
  return params.peak_time_min * (1 + params.fat_delay_factor * fatRatio);
}

/** Gamma-shaped impulse response, normalized so peak = 1 */
export function gammaResponse(
  elapsed: number,
  peakTime: number,
  k: number,
): number {
  if (elapsed <= 0 || peakTime <= 0) return 0;
  const x = elapsed / peakTime;
  return Math.pow(x, k) * Math.exp(k * (1 - x));
}

/** Circadian modifier: >1.0 in evening (worse insulin sensitivity) */
export function circadianModifier(
  timeMin: number,
  params: GlucoseModelParams,
): number {
  // Ramp from 1.0 at noon to 1.0 + circadianEveningPct/100 at 9pm
  const eveningStart = 12 * 60; // noon
  const eveningPeak = 21 * 60; // 9pm
  if (timeMin <= eveningStart) return 1.0;
  if (timeMin >= eveningPeak) return 1.0 + params.circadian_evening_pct / 100;
  const progress = (timeMin - eveningStart) / (eveningPeak - eveningStart);
  return 1.0 + (params.circadian_evening_pct / 100) * progress;
}

/** Dawn phenomenon: bell curve peaking ~6am adding baseline glucose */
export function dawnPhenomenonCurve(
  timeMin: number,
  params: GlucoseModelParams,
): number {
  const peakMin = 6 * 60; // 6am
  const sigma = 60; // 1h standard deviation
  const diff = timeMin - peakMin;
  return (
    params.dawn_phenomenon_mgdl * Math.exp(-(diff * diff) / (2 * sigma * sigma))
  );
}

/** Exercise modifier: <1.0 during/after exercise (GLUT4 effect on meal spikes) */
export function exerciseModifier(
  timeMin: number,
  exercises: ExerciseEvent[],
  params: GlucoseModelParams,
): number {
  let modifier = 1.0;
  for (const ex of exercises) {
    if (timeMin >= ex.startMin) {
      const reductionPct = params.exercise_reduction_pct * ex.intensityFactor;
      if (timeMin <= ex.endMin) {
        // During exercise: full reduction
        modifier *= 1 - reductionPct / 100;
      } else {
        // Post-exercise: decaying effect over 2h
        const elapsed = timeMin - ex.endMin;
        const decayWindow = 120;
        if (elapsed < decayWindow) {
          const decay = 1 - elapsed / decayWindow;
          modifier *= 1 - (reductionPct / 100) * decay * 0.5;
        }
      }
    }
  }
  return modifier;
}

/** Exercise drawdown: absolute mg/dL drop from GLUT4 (works even when fasting) */
export function exerciseDrawdown(
  timeMin: number,
  exercises: ExerciseEvent[],
  params: GlucoseModelParams,
): number {
  let totalDrawdown = 0;
  for (const ex of exercises) {
    if (timeMin >= ex.startMin) {
      const peakDrop = params.exercise_reduction_pct * 0.5 * ex.intensityFactor;
      if (timeMin <= ex.endMin) {
        // During exercise: full drawdown
        totalDrawdown += peakDrop;
      } else {
        // Post-exercise: linear decay over 2h to 50% of peak (GLUT4 stays active)
        const elapsed = timeMin - ex.endMin;
        const decayWindow = 120;
        if (elapsed < decayWindow) {
          const decay = 1 - elapsed / decayWindow;
          totalDrawdown += peakDrop * (0.5 + 0.5 * decay);
        }
      }
    }
  }
  return totalDrawdown;
}

/** Gym modifier: improved sensitivity for gym_sensitivity_hours post-workout */
export function gymModifier(
  lastGymTimeMin: number | null,
  currentTimeMin: number,
  params: GlucoseModelParams,
): number {
  if (lastGymTimeMin === null) return 1.0;
  const elapsed = currentTimeMin - lastGymTimeMin;
  if (elapsed < 0 || elapsed > params.gym_sensitivity_hours * 60) return 1.0;
  // Linear decay from full effect to 0 over the sensitivity window
  const decay = 1 - elapsed / (params.gym_sensitivity_hours * 60);
  return 1 - (params.gym_sensitivity_pct / 100) * decay;
}

/** Main prediction function: full-day glucose curve at 5-min steps */
export function predictGlucoseCurve(
  meals: MealEvent[],
  exercises: ExerciseEvent[],
  lastGymTimeMin: number | null,
  params: GlucoseModelParams,
): GlucosePrediction {
  const curve: GlucosePoint[] = [];
  let peakValue = 0;
  let peakTimeMin = 0;

  for (let t = 0; t <= TOTAL_MINUTES; t += STEP) {
    const absMin = START_HOUR * 60 + t;
    let glucose = params.fasting_baseline_mgdl;

    // Dawn phenomenon
    glucose += dawnPhenomenonCurve(absMin, params);

    // Meal contributions
    for (const meal of meals) {
      const elapsed = absMin - meal.timeMin;
      if (elapsed > 0) {
        const rise = glucoseRise(meal, params);
        const peak = mealPeakTime(meal, params);
        const response = gammaResponse(elapsed, peak, params.curve_shape_k);
        const circadian = circadianModifier(meal.timeMin, params);
        glucose += rise * response * circadian;
      }
    }

    // Apply exercise and gym modifiers
    const exMod = exerciseModifier(absMin, exercises, params);
    const gymMod = gymModifier(lastGymTimeMin, absMin, params);

    // Modifiers reduce the delta above baseline
    const delta = glucose - params.fasting_baseline_mgdl;
    glucose = params.fasting_baseline_mgdl + delta * exMod * gymMod;

    // Exercise drawdown: absolute mg/dL drop via GLUT4 (works even when fasting)
    glucose -= exerciseDrawdown(absMin, exercises, params);

    // Physiological floor
    glucose = Math.max(40, glucose);

    curve.push({ timeMin: absMin, value: Math.round(glucose * 10) / 10 });

    if (glucose > peakValue) {
      peakValue = glucose;
      peakTimeMin = absMin;
    }
  }

  return {
    curve,
    peakValue: Math.round(peakValue * 10) / 10,
    peakTimeMin,
  };
}

// ── Converters ──

/** Convert a FoodEntry to a MealEvent */
export function foodEntryToMealEvent(entry: FoodEntry): MealEvent {
  const [h, m] = entry.time.split(":").map(Number);
  const netCarbs = Math.max(0, entry.carbs_g - (entry.fiber_g ?? 0));
  return {
    timeMin: h * 60 + m,
    netCarbs,
    protein: entry.protein_g,
    fat: entry.fat_g,
    totalGrams: netCarbs + entry.protein_g + entry.fat_g,
  };
}

/** Aggregate MealEvents within a time window into single physiological boluses */
export function aggregateMeals(
  meals: MealEvent[],
  windowMin: number = 15,
): MealEvent[] {
  if (meals.length === 0) return [];
  const sorted = [...meals].sort((a, b) => a.timeMin - b.timeMin);
  const groups: MealEvent[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = groups[groups.length - 1];
    if (sorted[i].timeMin - last[0].timeMin <= windowMin) {
      last.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups.map((group) => {
    const netCarbs = group.reduce((s, m) => s + m.netCarbs, 0);
    const protein = group.reduce((s, m) => s + m.protein, 0);
    const fat = group.reduce((s, m) => s + m.fat, 0);
    return {
      timeMin: group[0].timeMin,
      netCarbs,
      protein,
      fat,
      totalGrams: netCarbs + protein + fat,
    };
  });
}

/** Convert a StravaActivity to an ExerciseEvent */
export function stravaToExerciseEvent(activity: StravaActivity): ExerciseEvent {
  const d = new Date(activity.start_date);
  const startMin = d.getHours() * 60 + d.getMinutes();
  const durationMin = Math.round(activity.moving_time_sec / 60);
  // Intensity factor: normalize watts (0-300W range) or heartrate (100-190 range)
  let intensityFactor = 0.5; // default moderate
  if (activity.average_watts != null) {
    intensityFactor = Math.min(1, Math.max(0.1, activity.average_watts / 250));
  } else if (activity.average_heartrate != null) {
    intensityFactor = Math.min(
      1,
      Math.max(0.1, (activity.average_heartrate - 80) / 120),
    );
  }
  return {
    startMin,
    endMin: startMin + durationMin,
    intensityFactor,
  };
}
