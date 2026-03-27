import type {
  DailyNutrition,
  MacroTargets,
  FoodEntry,
  WaterEntry,
  WeightEntry,
  Workout,
} from "$lib/types";
import { localDateStr } from "$lib/utils/date";
import { fetchFoodEntriesRange, fetchWaterEntriesRange } from "./nutritionData";

// ── Types ──

export interface PeriodNutrition {
  days: number;
  avgCalories: number;
  avgProtein: number;
  avgWater: number;
  daysProteinHit: number;
  daysWaterHit: number;
  daysOverCalories: number;
  daysUnderCalories: number;
  totalCalories: number;
  totalProtein: number;
  totalWater: number;
  mealCount: number;
  bestProteinDay: number;
  worstProteinDay: number;
  bestCalorieDay: number;
  worstCalorieDay: number;
}

export interface PeriodWorkouts {
  count: number;
  totalVolume: number;
  avgDuration: number;
  longestGap: number;
  exercisePRs: { name: string; weight: number }[];
  exercisesDone: string[];
  totalSets: number;
  heaviestLift: { name: string; weight: number } | null;
}

export interface PeriodWeight {
  startWeight: number | null;
  endWeight: number | null;
  change: number | null;
  trend: "down" | "up" | "flat" | null;
  weeklyRate: number | null;
  bodyFatStart: number | null;
  bodyFatEnd: number | null;
  bodyFatChange: number | null;
  muscleStart: number | null;
  muscleEnd: number | null;
  muscleChange: number | null;
  lowestWeight: number | null;
  highestWeight: number | null;
  measurementCount: number;
}

export interface FeedingWindowInfo {
  isOpen: boolean;
  closesAt: string | null;
  minutesLeft: number | null;
  firstMealTime: string | null;
}

export interface TimeContext {
  hour: number;
  dayOfWeek: number; // 0=Sun
  dayName: string;
  isWeekend: boolean;
}

export type SummaryPeriod = "today" | "week" | "month";

export interface PeriodSummaryData {
  nutrition: PeriodNutrition;
  workouts: PeriodWorkouts;
  weight: PeriodWeight;
  period: SummaryPeriod;
  daysSinceLastWorkout: number | null;
  feedingWindow: FeedingWindowInfo | null;
  time: TimeContext;
}

// ── Helpers ──

function todayStr(): string {
  return localDateStr();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

function getTimeContext(): TimeContext {
  const now = new Date();
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dow = now.getDay();
  return {
    hour: now.getHours(),
    dayOfWeek: dow,
    dayName: dayNames[dow],
    isWeekend: dow === 0 || dow === 6,
  };
}

function getDaysSinceLastWorkout(workouts: Workout[]): number | null {
  if (workouts.length === 0) return null;
  const last = new Date(workouts[0].date);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

function computeWorkoutStats(
  workouts: Workout[],
  startDate: string,
  endDate: string,
): PeriodWorkouts {
  const filtered = workouts.filter(
    (w) => w.date >= startDate && w.date <= endDate,
  );
  if (filtered.length === 0) {
    return {
      count: 0,
      totalVolume: 0,
      avgDuration: 0,
      longestGap: 0,
      exercisePRs: [],
      exercisesDone: [],
      totalSets: 0,
      heaviestLift: null,
    };
  }

  let totalVolume = 0;
  let totalDuration = 0;
  let totalSets = 0;
  const maxWeights = new Map<string, number>();
  const exerciseNames = new Set<string>();
  let heaviest: { name: string; weight: number } | null = null;

  for (const w of filtered) {
    totalDuration += w.duration_min;
    for (const ex of w.exercises) {
      exerciseNames.add(ex.name);
      for (const set of ex.sets) {
        if (set.completed) {
          totalSets++;
          totalVolume += set.reps * set.weight_kg;
          const cur = maxWeights.get(ex.name) ?? 0;
          if (set.weight_kg > cur) maxWeights.set(ex.name, set.weight_kg);
          if (!heaviest || set.weight_kg > heaviest.weight) {
            heaviest = { name: ex.name, weight: set.weight_kg };
          }
        }
      }
    }
  }

  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
  let longestGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.floor(
      (new Date(sorted[i].date).getTime() -
        new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (gap > longestGap) longestGap = gap;
  }

  const allBefore = workouts.filter((w) => w.date < startDate);
  const prevMax = new Map<string, number>();
  for (const w of allBefore) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (set.completed) {
          const cur = prevMax.get(ex.name) ?? 0;
          if (set.weight_kg > cur) prevMax.set(ex.name, set.weight_kg);
        }
      }
    }
  }
  const prs: { name: string; weight: number }[] = [];
  for (const [name, weight] of maxWeights) {
    const prev = prevMax.get(name) ?? 0;
    if (weight > prev) prs.push({ name, weight });
  }

  return {
    count: filtered.length,
    totalVolume: Math.round(totalVolume),
    avgDuration: Math.round(totalDuration / filtered.length),
    longestGap,
    exercisePRs: prs,
    exercisesDone: [...exerciseNames],
    totalSets,
    heaviestLift: heaviest,
  };
}

function computeWeightStats(
  weightLog: WeightEntry[],
  startDate: string,
  endDate: string,
  periodDays: number,
): PeriodWeight {
  const filtered = weightLog
    .filter((w) => w.date >= startDate && w.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (filtered.length === 0) {
    return {
      startWeight: null,
      endWeight: null,
      change: null,
      trend: null,
      weeklyRate: null,
      bodyFatStart: null,
      bodyFatEnd: null,
      bodyFatChange: null,
      muscleStart: null,
      muscleEnd: null,
      muscleChange: null,
      lowestWeight: null,
      highestWeight: null,
      measurementCount: 0,
    };
  }

  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const change = last.weight_kg - first.weight_kg;
  const weeks = periodDays / 7;
  /* v8 ignore next */
  const weeklyRate = weeks > 0 ? change / weeks : null;
  const trend = Math.abs(change) < 0.1 ? "flat" : change < 0 ? "down" : "up";

  const weights = filtered.map((w) => w.weight_kg);
  const bfStart = first.body_fat_pct ?? null;
  const bfEnd = last.body_fat_pct ?? null;
  const mStart = first.muscle_mass_kg ?? null;
  const mEnd = last.muscle_mass_kg ?? null;

  return {
    startWeight: first.weight_kg,
    endWeight: last.weight_kg,
    change: Math.round(change * 10) / 10,
    trend,
    /* v8 ignore next */
    weeklyRate: weeklyRate !== null ? Math.round(weeklyRate * 10) / 10 : null,
    bodyFatStart: bfStart,
    bodyFatEnd: bfEnd,
    bodyFatChange:
      bfStart !== null && bfEnd !== null
        ? Math.round((bfEnd - bfStart) * 10) / 10
        : null,
    muscleStart: mStart,
    muscleEnd: mEnd,
    muscleChange:
      mStart !== null && mEnd !== null
        ? Math.round((mEnd - mStart) * 10) / 10
        : null,
    lowestWeight: Math.min(...weights),
    highestWeight: Math.max(...weights),
    measurementCount: filtered.length,
  };
}

// ── Public builders ──

export function buildTodayData(
  todaysTotals: DailyNutrition,
  feedingWindow: {
    isOpen: boolean;
    closesAt: string | null;
    minutesLeft: number | null;
  },
  macroTargets: MacroTargets,
  workouts: Workout[],
  weightLog: WeightEntry[],
  mealCount: number,
): PeriodSummaryData {
  const today = todayStr();

  const nutrition: PeriodNutrition = {
    days: 1,
    avgCalories: todaysTotals.calories,
    avgProtein: todaysTotals.protein_g,
    avgWater: todaysTotals.water_ml,
    daysProteinHit: todaysTotals.protein_g >= macroTargets.protein_g ? 1 : 0,
    daysWaterHit: todaysTotals.water_ml >= macroTargets.water_ml ? 1 : 0,
    daysOverCalories: todaysTotals.calories > macroTargets.calories ? 1 : 0,
    daysUnderCalories: todaysTotals.calories <= macroTargets.calories ? 1 : 0,
    totalCalories: todaysTotals.calories,
    totalProtein: todaysTotals.protein_g,
    totalWater: todaysTotals.water_ml,
    mealCount,
    bestProteinDay: todaysTotals.protein_g,
    worstProteinDay: todaysTotals.protein_g,
    bestCalorieDay: todaysTotals.calories,
    worstCalorieDay: todaysTotals.calories,
  };

  return {
    nutrition,
    workouts: computeWorkoutStats(workouts, today, today),
    weight: computeWeightStats(weightLog, today, today, 1),
    period: "today",
    daysSinceLastWorkout: getDaysSinceLastWorkout(workouts),
    feedingWindow: {
      isOpen: feedingWindow.isOpen,
      closesAt: feedingWindow.closesAt,
      minutesLeft: feedingWindow.minutesLeft,
      firstMealTime: todaysTotals.firstMealTime,
    },
    time: getTimeContext(),
  };
}

export async function buildWeekData(
  macroTargets: MacroTargets,
  workouts: Workout[],
  weightLog: WeightEntry[],
): Promise<PeriodSummaryData> {
  const end = todayStr();
  const start = daysAgo(6);

  const [foodEntries, waterEntries] = await Promise.all([
    fetchFoodEntriesRange(start, end),
    fetchWaterEntriesRange(start, end),
  ]);

  const nutrition = aggregateNutrition(
    foodEntries,
    waterEntries,
    macroTargets,
    7,
  );

  return {
    nutrition,
    workouts: computeWorkoutStats(workouts, start, end),
    weight: computeWeightStats(weightLog, start, end, 7),
    period: "week",
    daysSinceLastWorkout: getDaysSinceLastWorkout(workouts),
    feedingWindow: null,
    time: getTimeContext(),
  };
}

export async function buildMonthData(
  macroTargets: MacroTargets,
  workouts: Workout[],
  weightLog: WeightEntry[],
): Promise<PeriodSummaryData> {
  const end = todayStr();
  const start = daysAgo(29);

  const [foodEntries, waterEntries] = await Promise.all([
    fetchFoodEntriesRange(start, end),
    fetchWaterEntriesRange(start, end),
  ]);

  const nutrition = aggregateNutrition(
    foodEntries,
    waterEntries,
    macroTargets,
    30,
  );

  return {
    nutrition,
    workouts: computeWorkoutStats(workouts, start, end),
    weight: computeWeightStats(weightLog, start, end, 30),
    period: "month",
    daysSinceLastWorkout: getDaysSinceLastWorkout(workouts),
    feedingWindow: null,
    time: getTimeContext(),
  };
}

function aggregateNutrition(
  foodEntries: FoodEntry[],
  waterEntries: WaterEntry[],
  targets: MacroTargets,
  periodDays: number,
): PeriodNutrition {
  const dailyCals = new Map<string, number>();
  const dailyProtein = new Map<string, number>();
  const dailyWater = new Map<string, number>();

  for (const e of foodEntries) {
    dailyCals.set(e.date, (dailyCals.get(e.date) ?? 0) + e.calories);
    dailyProtein.set(e.date, (dailyProtein.get(e.date) ?? 0) + e.protein_g);
    dailyWater.set(e.date, (dailyWater.get(e.date) ?? 0) + (e.water_ml ?? 0));
  }
  for (const e of waterEntries) {
    dailyWater.set(e.date, (dailyWater.get(e.date) ?? 0) + e.amount_ml);
  }

  const datesWithData = new Set([...dailyCals.keys(), ...dailyWater.keys()]);
  const days = datesWithData.size || 1;

  let totalCals = 0,
    totalProtein = 0,
    totalWater = 0;
  let daysProteinHit = 0,
    daysWaterHit = 0,
    daysOverCalories = 0,
    daysUnderCalories = 0;
  let bestProtein = 0,
    worstProtein = Infinity,
    bestCal = 0,
    worstCal = Infinity;

  for (const date of datesWithData) {
    /* v8 ignore next 3 */
    const cal = dailyCals.get(date) ?? 0;
    const prot = dailyProtein.get(date) ?? 0;
    const wat = dailyWater.get(date) ?? 0;

    totalCals += cal;
    totalProtein += prot;
    totalWater += wat;

    if (prot >= targets.protein_g) daysProteinHit++;
    if (wat >= targets.water_ml) daysWaterHit++;
    if (cal > targets.calories) daysOverCalories++;
    if (cal <= targets.calories && cal > 0) daysUnderCalories++;

    if (prot > bestProtein) bestProtein = prot;
    if (prot < worstProtein && prot > 0) worstProtein = prot;
    if (cal > bestCal) bestCal = cal;
    if (cal < worstCal && cal > 0) worstCal = cal;
  }

  return {
    days,
    avgCalories: Math.round(totalCals / days),
    avgProtein: Math.round(totalProtein / days),
    avgWater: Math.round(totalWater / days),
    daysProteinHit,
    daysWaterHit,
    daysOverCalories,
    daysUnderCalories,
    totalCalories: Math.round(totalCals),
    totalProtein: Math.round(totalProtein),
    totalWater: Math.round(totalWater),
    mealCount: foodEntries.length,
    bestProteinDay: Math.round(bestProtein),
    worstProteinDay: worstProtein === Infinity ? 0 : Math.round(worstProtein),
    bestCalorieDay: Math.round(bestCal),
    worstCalorieDay: worstCal === Infinity ? 0 : Math.round(worstCal),
  };
}
