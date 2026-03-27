import type { Workout, FoodEntry, WaterEntry, MacroTargets } from "$lib/types";
import { localDateStr } from "$lib/utils/date";

export interface StreakInfo {
  key: string;
  label: string;
  current: number;
  best: number;
  unit: string;
}

export interface DayActivity {
  date: string;
  workout: boolean;
  foodLogged: boolean;
  proteinHit: boolean;
  waterHit: boolean;
  score: number;
}

function todayStr(): string {
  return localDateStr();
}

function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function computeWorkoutStreak(workouts: Workout[]): {
  current: number;
  best: number;
} {
  if (workouts.length === 0) return { current: 0, best: 0 };

  // Workouts are sorted newest-first
  let current = 1;
  let best = 1;
  let run = 1;

  for (let i = 0; i < workouts.length - 1; i++) {
    const cur = new Date(workouts[i].date);
    const prev = new Date(workouts[i + 1].date);
    const gap = Math.floor(
      (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (gap <= 3) {
      run++;
    } else {
      if (i === 0) current = run; // haven't broken current yet
      best = Math.max(best, run);
      run = 1;
    }
    if (i === 0) current = run; // keep updating current while unbroken
  }

  // Check if first gap broke the current streak
  if (workouts.length >= 2) {
    const firstGap = Math.floor(
      (new Date(workouts[0].date).getTime() -
        new Date(workouts[1].date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (firstGap > 3) {
      current = 1;
    }
  }

  // Also check if the most recent workout is too old (gap from today)
  const today = new Date();
  const lastDate = new Date(workouts[0].date);
  const gapFromToday = Math.floor(
    (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (gapFromToday > 3) {
    current = 0;
  }

  // Final run
  best = Math.max(best, run);

  // Recalculate current properly by walking from the start
  current = 1;
  for (let i = 0; i < workouts.length - 1; i++) {
    const cur = new Date(workouts[i].date);
    const prev = new Date(workouts[i + 1].date);
    const gap = Math.floor(
      (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (gap <= 3) {
      current++;
    } else {
      break;
    }
  }

  if (gapFromToday > 3) {
    current = 0;
  }

  return { current, best };
}

function aggregateByDate<T extends { date: string }>(
  entries: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const arr = map.get(e.date);
    if (arr) arr.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

function computeDailyStreak(
  dates: Set<string>,
  checkFn: (date: string) => boolean,
): { current: number; best: number } {
  const today = todayStr();
  let current = 0;
  let best = 0;
  let run = 0;
  let foundCurrent = false;

  // Walk backward from today
  for (let i = 0; i < 365; i++) {
    const date = dateAddDays(today, -i);
    if (checkFn(date)) {
      run++;
      if (!foundCurrent) current = run;
    } else {
      if (!foundCurrent && i > 0) foundCurrent = true;
      best = Math.max(best, run);
      run = 0;
    }
  }
  best = Math.max(best, run);
  return { current, best };
}

export function computeNutritionStreaks(
  foodEntries: FoodEntry[],
  waterEntries: WaterEntry[],
  targets: MacroTargets,
): {
  protein: { current: number; best: number };
  food: { current: number; best: number };
  water: { current: number; best: number };
} {
  const foodByDate = aggregateByDate(foodEntries);
  const waterByDate = aggregateByDate(waterEntries);

  // Pre-compute daily totals
  const proteinByDate = new Map<string, number>();
  const waterMlByDate = new Map<string, number>();
  const foodDates = new Set<string>();

  for (const [date, entries] of foodByDate) {
    foodDates.add(date);
    proteinByDate.set(
      date,
      entries.reduce((s, e) => s + e.protein_g, 0),
    );
  }

  for (const [date, entries] of waterByDate) {
    const foodWater = (foodByDate.get(date) ?? []).reduce(
      (s, e) => s + (e.water_ml ?? 0),
      0,
    );
    waterMlByDate.set(
      date,
      entries.reduce((s, e) => s + e.amount_ml, 0) + foodWater,
    );
  }
  // Also account for water from food on dates with no explicit water entries
  for (const [date, entries] of foodByDate) {
    if (!waterMlByDate.has(date)) {
      const foodWater = entries.reduce((s, e) => s + (e.water_ml ?? 0), 0);
      if (foodWater > 0) waterMlByDate.set(date, foodWater);
    }
  }

  const protein = computeDailyStreak(foodDates, (date) => {
    return (proteinByDate.get(date) ?? 0) >= targets.protein_g;
  });

  const food = computeDailyStreak(foodDates, (date) => {
    return foodDates.has(date);
  });

  const water = computeDailyStreak(new Set(waterMlByDate.keys()), (date) => {
    return (waterMlByDate.get(date) ?? 0) >= targets.water_ml;
  });

  return { protein, food, water };
}

export function buildActivityMap(
  workouts: Workout[],
  foodEntries: FoodEntry[],
  waterEntries: WaterEntry[],
  targets: MacroTargets,
  days: number = 30,
): DayActivity[] {
  const today = todayStr();
  const workoutDates = new Set(workouts.map((w) => w.date));
  const foodByDate = aggregateByDate(foodEntries);
  const waterByDate = aggregateByDate(waterEntries);

  const activity: DayActivity[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = dateAddDays(today, -i);
    const food = foodByDate.get(date) ?? [];
    const water = waterByDate.get(date) ?? [];

    const workout = workoutDates.has(date);
    const foodLogged = food.length > 0;
    const proteinHit =
      food.reduce((s, e) => s + e.protein_g, 0) >= targets.protein_g;
    const foodWater = food.reduce((s, e) => s + (e.water_ml ?? 0), 0);
    const waterHit =
      water.reduce((s, e) => s + e.amount_ml, 0) + foodWater >=
      targets.water_ml;

    const score = [workout, foodLogged, proteinHit, waterHit].filter(
      Boolean,
    ).length;

    activity.push({ date, workout, foodLogged, proteinHit, waterHit, score });
  }

  return activity;
}

export function buildAllStreaks(
  workouts: Workout[],
  foodEntries: FoodEntry[],
  waterEntries: WaterEntry[],
  targets: MacroTargets,
): { streaks: StreakInfo[]; activity: DayActivity[] } {
  const workoutStreak = computeWorkoutStreak(workouts);
  const nutritionStreaks = computeNutritionStreaks(
    foodEntries,
    waterEntries,
    targets,
  );
  const activity = buildActivityMap(
    workouts,
    foodEntries,
    waterEntries,
    targets,
  );

  const streaks: StreakInfo[] = [
    {
      key: "lifting",
      label: "Lift Cadence",
      current: workoutStreak.current,
      best: workoutStreak.best,
      unit: "sessions",
    },
    {
      key: "protein",
      label: "Protein Target",
      current: nutritionStreaks.protein.current,
      best: nutritionStreaks.protein.best,
      unit: "days",
    },
    {
      key: "food",
      label: "Food Logged",
      current: nutritionStreaks.food.current,
      best: nutritionStreaks.food.best,
      unit: "days",
    },
    {
      key: "water",
      label: "Water Target",
      current: nutritionStreaks.water.current,
      best: nutritionStreaks.water.best,
      unit: "days",
    },
  ];

  return { streaks, activity };
}
