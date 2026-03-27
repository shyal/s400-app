import type {
  Workout,
  Exercise,
  WorkoutSet,
  ExerciseProgress,
  WorkoutHistory,
  FoodEntry,
  WaterEntry,
  WeightEntry,
  MacroTargets,
  Recipe,
  SupplementEntry,
  BiomarkerDefinition,
  BiomarkerMeasurement,
  BiomarkerUserTarget,
  Settings,
  DailyNutrition,
  TestEquipment,
  GlucoseReading,
  GlucoseModelParams,
} from "$lib/types";
import type {
  MealEvent,
  ExerciseEvent,
  GlucosePoint,
} from "$lib/services/glucoseModel";
import type { GPGlucosePoint } from "$lib/services/glucoseModelGP";
import type { ScheduledReading } from "$lib/services/glucoseScheduler";

// ── Workout fixtures ──

let _setId = 0;
export function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    setNumber: ++_setId,
    reps: 5,
    weight_kg: 60,
    completed: true,
    ...overrides,
  };
}

export function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    name: "Squat",
    targetSets: 5,
    targetReps: 5,
    targetWeight_kg: 60,
    sets: Array.from({ length: 5 }, (_, i) => makeSet({ setNumber: i + 1 })),
    ...overrides,
  };
}

export function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    time: "08:00",
    type: "workout",
    activity: "StrongLifts Workout A",
    workoutType: "A",
    duration_min: 45,
    exercises: [
      makeExercise({ name: "Squat" }),
      makeExercise({ name: "Bench Press", targetWeight_kg: 50 }),
      makeExercise({ name: "Barbell Row", targetWeight_kg: 45 }),
    ],
    synced: true,
    startedAt: "2025-01-15T08:00:00Z",
    completedAt: "2025-01-15T08:45:00Z",
    ...overrides,
  };
}

export function makeExerciseProgress(
  overrides: Partial<ExerciseProgress> = {},
): ExerciseProgress {
  return {
    name: "Squat",
    weight_kg: 60,
    failureCount: 0,
    ...overrides,
  };
}

export function makeWorkoutHistory(
  overrides: Partial<WorkoutHistory> = {},
): WorkoutHistory {
  return {
    workouts: [],
    exerciseProgress: {},
    lastWorkoutType: null,
    lastWorkoutDate: null,
    ...overrides,
  };
}

// ── Nutrition fixtures ──

export function makeFoodEntry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    time: "12:00",
    name: "Chicken Breast",
    servings: 1,
    calories: 250,
    protein_g: 40,
    carbs_g: 0,
    fat_g: 8,
    fiber_g: 0,
    water_ml: 0,
    ...overrides,
  };
}

export function makeWaterEntry(
  overrides: Partial<WaterEntry> = {},
): WaterEntry {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    time: "10:00",
    amount_ml: 500,
    ...overrides,
  };
}

export function makeWeightEntry(
  overrides: Partial<WeightEntry> = {},
): WeightEntry {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    weight_kg: 80,
    body_fat_pct: null,
    muscle_mass_kg: null,
    visceral_fat: null,
    water_percent: null,
    ...overrides,
  };
}

export function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: crypto.randomUUID(),
    name: "Protein Shake",
    calories: 300,
    protein_g: 40,
    carbs_g: 20,
    fat_g: 5,
    fiber_g: 2,
    water_ml: 0,
    serving_size: 1,
    serving_unit: "serving",
    ...overrides,
  };
}

export function makeSupplementEntry(
  overrides: Partial<SupplementEntry> = {},
): SupplementEntry {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    time: "08:00",
    name: "Creatine",
    dose: "5g",
    notes: null,
    ...overrides,
  };
}

export function makeMacroTargets(
  overrides: Partial<MacroTargets> = {},
): MacroTargets {
  return {
    calories: 2000,
    protein_g: 100,
    carbs_g: 200,
    fat_g: 80,
    water_ml: 3000,
    ...overrides,
  };
}

export function makeDailyNutrition(
  overrides: Partial<DailyNutrition> = {},
): DailyNutrition {
  return {
    calories: 1500,
    protein_g: 110,
    carbs_g: 120,
    fat_g: 60,
    fiber_g: 15,
    water_ml: 2500,
    firstMealTime: "12:00",
    lastMealTime: "15:30",
    ...overrides,
  };
}

// ── Biomarker fixtures ──

export function makeBiomarkerDefinition(
  overrides: Partial<BiomarkerDefinition> = {},
): BiomarkerDefinition {
  return {
    id: crypto.randomUUID(),
    name: "LDL-C",
    category: "cardiovascular",
    unit: "mg/dL",
    unitAlt: null,
    optimalMin: null,
    optimalMax: 100,
    warningMin: null,
    warningMax: 130,
    testFrequencyDays: 180,
    description: "Low-density lipoprotein cholesterol",
    displayOrder: 1,
    ...overrides,
  };
}

export function makeBiomarkerMeasurement(
  overrides: Partial<BiomarkerMeasurement> = {},
): BiomarkerMeasurement {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    biomarkerId: "bio-1",
    date: "2025-01-15",
    value: 90,
    unit: "mg/dL",
    notes: null,
    labName: null,
    createdAt: "2025-01-15T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
    ...overrides,
  };
}

export function makeBiomarkerUserTarget(
  overrides: Partial<BiomarkerUserTarget> = {},
): BiomarkerUserTarget {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    biomarkerId: "bio-1",
    optimalMin: null,
    optimalMax: 80,
    targetValue: 70,
    notes: null,
    ...overrides,
  };
}

// ── Test Equipment fixtures ──

export function makeTestEquipment(
  overrides: Partial<TestEquipment> = {},
): TestEquipment {
  return {
    id: Math.floor(Math.random() * 10000),
    type: "glucose_meter",
    maker: "Accu-Chek",
    model: "Guide",
    quantity: 1,
    expiry_date: null,
    notes: null,
    is_favorite: false,
    ...overrides,
  };
}

export function makeGlucoseReading(
  overrides: Partial<GlucoseReading> = {},
): GlucoseReading {
  return {
    id: crypto.randomUUID(),
    date: "2025-01-15",
    time: "13:00",
    value: 5.5,
    unit: "mmol/L",
    equipment_id: null,
    notes: null,
    ...overrides,
  };
}

// ── Glucose Model fixtures ──

export function makeGlucoseModelParams(
  overrides: Partial<GlucoseModelParams> = {},
): GlucoseModelParams {
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
    ...overrides,
  };
}

export function makeMealEvent(overrides: Partial<MealEvent> = {}): MealEvent {
  return {
    timeMin: 12 * 60,
    netCarbs: 50,
    protein: 30,
    fat: 15,
    totalGrams: 95,
    ...overrides,
  };
}

export function makeExerciseEvent(
  overrides: Partial<ExerciseEvent> = {},
): ExerciseEvent {
  return {
    startMin: 13 * 60,
    endMin: 13 * 60 + 30,
    intensityFactor: 0.7,
    ...overrides,
  };
}

export function makeScheduledReading(
  overrides: Partial<ScheduledReading> = {},
): ScheduledReading {
  return {
    timeMin: 12 * 60 + 30,
    type: "post_meal_30",
    priority: 2,
    reason: "30min after meal — peak glucose",
    taken: false,
    ...overrides,
  };
}

// ── GP Glucose fixtures ──

export function makeGPGlucosePoint(
  overrides: Partial<GPGlucosePoint> = {},
): GPGlucosePoint {
  return {
    timeMin: 12 * 60,
    value: 120,
    upper: 135,
    lower: 105,
    ...overrides,
  };
}

// ── Weight Time Series fixture ──

/**
 * Generate a synthetic weight time series for simulation testing.
 * Starts at `startKg` and applies `dailyRateKg` per day with optional noise.
 */
export function makeWeightTimeSeries(
  opts: {
    days?: number;
    startKg?: number;
    dailyRateKg?: number;
    noise?: number;
    startDate?: string;
    bodyFatPct?: number;
    muscleMassKg?: number;
    visceralFat?: number;
    waterPercent?: number;
  } = {},
): WeightEntry[] {
  const {
    days = 30,
    startKg = 85,
    dailyRateKg = -0.1,
    noise = 0,
    startDate = "2026-01-01",
    bodyFatPct,
    muscleMassKg,
    visceralFat,
    waterPercent,
  } = opts;

  const entries: WeightEntry[] = [];
  const start = new Date(startDate);

  for (let d = 0; d < days; d++) {
    const date = new Date(start.getTime() + d * 24 * 60 * 60 * 1000);
    const weight =
      startKg +
      dailyRateKg * d +
      (noise > 0 ? (Math.random() - 0.5) * 2 * noise : 0);
    const dateString = date.toISOString().split("T")[0];

    entries.push(
      makeWeightEntry({
        date: dateString,
        weight_kg: Math.round(weight * 100) / 100,
        body_fat_pct: bodyFatPct ?? null,
        muscle_mass_kg: muscleMassKg ?? null,
        visceral_fat: visceralFat ?? null,
        water_percent: waterPercent ?? null,
      }),
    );
  }

  return entries;
}

// ── Settings fixture ──

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    restTimerSeconds: 90,
    weightUnit: "kg",
    program: "stronglifts",
    soundEnabled: true,
    vibrationEnabled: true,
    increments: {
      Squat: 2.5,
      "Bench Press": 2.5,
      "Barbell Row": 2.5,
      "Overhead Press": 2.5,
      Deadlift: 5,
    },
    ...overrides,
  };
}
