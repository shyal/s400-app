export interface WorkoutSet {
  setNumber: number;
  reps: number;
  weight_kg: number;
  completed: boolean;
}

export interface Exercise {
  name: string;
  targetSets: number;
  targetReps: number;
  targetWeight_kg: number;
  sets: WorkoutSet[];
}

export type WorkoutType = "A" | "B" | "C" | "D" | "custom";

export interface Workout {
  id: string;
  date: string;
  time: string;
  type: "workout";
  activity: string;
  workoutType: WorkoutType;
  duration_min: number;
  exercises: Exercise[];
  synced: boolean;
  startedAt?: string;
  completedAt?: string;
}

export interface ExerciseProgress {
  name: string;
  weight_kg: number;
  failureCount: number;
}

export interface WorkoutHistory {
  workouts: Workout[];
  exerciseProgress: Record<string, ExerciseProgress>;
  lastWorkoutType: WorkoutType | null;
  lastWorkoutDate: string | null;
}

export interface WorkoutSchedule {
  frequencyDays: number;
  consecutiveForExtraRest: number;
  extraRestDays: number;
}

export type GlucoseModelType = "parametric" | "gp";

export type ChatModel =
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-6"
  | "claude-haiku-4-5-20251001";

export interface Settings {
  restTimerSeconds: number;
  weightUnit: "kg" | "lb";
  program: "stronglifts" | "custom" | "recovery";
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  increments: Record<string, number>;
  workoutSchedule: WorkoutSchedule;
  chatModel?: ChatModel;
  glucoseModel?: GlucoseModelType;
  waterReminderEnabled?: boolean;
  waterReminderIntervalMin?: number;
  plateauExercises?: string[];
  movingAverageWindow?: number;
  movingAverageType?: "sma" | "ema" | "spline";
  goalWeightKg?: number;
  goalBodyFatPct?: number;
  goalVisceralFat?: number;
  /** Which metric the GoalCountdown tracks */
  goalMode?: "weight" | "body_fat" | "visceral_fat";
}

export interface ProgramExercise {
  name: string;
  sets: number;
  reps: number;
  increment_kg: number;
  isCompound: boolean;
}

export interface ProgramDay {
  name: string;
  exercises: ProgramExercise[];
}

export interface Program {
  name: string;
  workouts: Record<string, ProgramDay>;
  alternating: boolean;
}

export type TimerState = "idle" | "running" | "finished";

// ── Nutrition ──

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  quantity_unit: string;
  ingredient?: Recipe;
}

export interface Recipe {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  serving_size: number;
  serving_unit: string;
  notes?: string;
  created_at?: string;
  ingredients?: RecipeIngredient[];
}

export interface FoodEntry {
  id: string;
  date: string;
  time: string;
  recipe_id?: string | null;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml?: number;
}

export interface WaterEntry {
  id: string;
  date: string;
  time: string;
  amount_ml: number;
}

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

export interface WeightEntry {
  id: string;
  date: string;
  weight_kg: number;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  visceral_fat?: number | null;
  water_percent?: number | null;
}

export interface SupplementEntry {
  id: string;
  date: string;
  time: string;
  name: string;
  dose?: string | null;
  notes?: string | null;
}

export interface SupplementStackItem {
  name: string;
  dose: string;
}

export interface SupplementStacks {
  morning: SupplementStackItem[];
  noon: SupplementStackItem[];
  evening: SupplementStackItem[];
}

export interface DailyNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  firstMealTime: string | null;
  lastMealTime: string | null;
}

// ── Biomarkers ──

export type BiomarkerCategory =
  | "cardiovascular"
  | "metabolic"
  | "inflammatory"
  | "cellular_aging"
  | "functional"
  | "other";

export type BiomarkerStatus = "optimal" | "warning" | "critical" | "unknown";

export type BiomarkerTrend = "improving" | "stable" | "worsening" | "unknown";

export interface BiomarkerDefinition {
  id: string;
  name: string;
  category: BiomarkerCategory;
  unit: string;
  unitAlt?: string | null;
  optimalMin?: number | null;
  optimalMax?: number | null;
  warningMin?: number | null;
  warningMax?: number | null;
  testFrequencyDays: number;
  description?: string | null;
  displayOrder: number;
}

export interface BiomarkerMeasurement {
  id: string;
  userId: string;
  biomarkerId: string;
  date: string;
  value: number;
  unit: string;
  notes?: string | null;
  labName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BiomarkerUserTarget {
  id: string;
  userId: string;
  biomarkerId: string;
  optimalMin?: number | null;
  optimalMax?: number | null;
  targetValue?: number | null;
  notes?: string | null;
}

// ── Test Equipment ──

export type EquipmentType =
  | "glucose_meter"
  | "ketone_meter"
  | "dual_meter"
  | "glucose_strips"
  | "ketone_strips";

export interface TestEquipment {
  id: number;
  type: EquipmentType;
  maker: string | null;
  model: string | null;
  quantity: number;
  expiry_date: string | null;
  notes: string | null;
  is_favorite: boolean;
}

// ── Glucose ──

export type GlucoseUnit = "mg/dL" | "mmol/L";

export type GlucoseReadingType =
  | "fasting"
  | "pre_meal"
  | "post_meal_30"
  | "post_meal_60"
  | "post_meal_120"
  | "bedtime"
  | "random";

export interface GlucoseReading {
  id: string;
  date: string;
  time: string;
  value: number;
  unit: GlucoseUnit;
  equipment_id: number | null;
  notes: string | null;
  reading_type?: GlucoseReadingType;
}

export interface GlucoseModelParams {
  fasting_baseline_mgdl: number;
  carb_sensitivity: number;
  protein_sensitivity: number;
  fat_delay_factor: number;
  exercise_reduction_pct: number;
  gym_sensitivity_hours: number;
  gym_sensitivity_pct: number;
  circadian_evening_pct: number;
  dawn_phenomenon_mgdl: number;
  peak_time_min: number;
  curve_shape_k: number;
  data_points_used: number;
  last_fit_at: string | null;
}

// ── Strava ──

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time_sec: number;
  moving_time_sec: number;
  distance_m: number;
  average_speed: number;
  max_speed: number | null;
  total_elevation_gain: number | null;
  average_heartrate: number | null;
  average_watts: number | null;
  kilojoules: number | null;
}

// ── Simulation ──

export type SimScenario = "current" | "goal" | "custom";

export interface ProjectionPoint {
  date: string;
  weight_kg: number;
  body_fat_pct: number;
  muscle_mass_kg: number;
  visceral_fat: number;
  weight_upper: number;
  weight_lower: number;
  bf_upper: number;
  bf_lower: number;
}

export interface SamplePathPoint {
  date: string;
  weight_kg: number;
  body_fat_pct: number;
  muscle_mass_kg: number;
  visceral_fat: number;
}

export interface SamplePath {
  points: SamplePathPoint[];
}

export interface SimulationResult {
  scenario: SimScenario;
  points: ProjectionPoint[];
  projectedGoalDate: string | null;
  projectedWeightAtGoal: number;
  projectedBfAtGoal: number;
  weeklyRate: number;
  daysToGoal: number | null;
  samplePaths: SamplePath[];
}

export interface SimulationConfig {
  goalKg: number;
  goalDate: string;
  /** Target visceral fat level — projection extends until this is reached */
  goalVisceralFat?: number;
  customWeeklyRate?: number;
  /** When true, clamp muscle mass projection to flat/positive (strength still progressing) */
  strengthProgressing?: boolean;
}

export interface BiomarkerWithLatest extends BiomarkerDefinition {
  latestMeasurement?: BiomarkerMeasurement | null;
  status: BiomarkerStatus;
  trend: BiomarkerTrend;
  daysSinceTest?: number | null;
  userTarget?: BiomarkerUserTarget | null;
}
