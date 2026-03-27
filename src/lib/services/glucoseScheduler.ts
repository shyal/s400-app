import type { GlucoseReading, GlucoseReadingType, FoodEntry } from "$lib/types";

// ── Types ──

export interface ScheduledReading {
  timeMin: number;
  type: GlucoseReadingType;
  priority: number; // 1 = highest
  reason: string;
  taken: boolean;
}

export interface ScheduleContext {
  meals: FoodEntry[];
  existingReadings: GlucoseReading[];
  fastBrokenAt: string | null;
  stripsRemaining: number;
  nowMin: number;
}

// ── Constants ──

const MATCH_TOLERANCE = 15; // minutes tolerance for matching existing readings
const BEDTIME_MIN = 21 * 60 + 30; // 21:30

// ── Schedule Generation ──

/** Generate prioritized reading schedule for today */
export function generateSchedule(ctx: ScheduleContext): ScheduledReading[] {
  const schedule: ScheduledReading[] = [];
  const { meals, existingReadings, fastBrokenAt, stripsRemaining } = ctx;

  // Sort meals by time
  const sortedMeals = [...meals].sort((a, b) => a.time.localeCompare(b.time));

  // Priority 1: Fasting reading (before first meal)
  if (!fastBrokenAt) {
    schedule.push({
      timeMin: 6 * 60, // default 6am
      type: "fasting",
      priority: 1,
      reason: "Fasting glucose before first meal",
      taken: false,
    });
  } else {
    const [h, m] = fastBrokenAt.split(":").map(Number);
    const firstMealMin = h * 60 + m;
    schedule.push({
      timeMin: Math.max(firstMealMin - 15, 6 * 60),
      type: "fasting",
      priority: 1,
      reason: "Fasting glucose before first meal",
      taken: false,
    });
  }

  // Per-meal readings
  for (const meal of sortedMeals) {
    const [mh, mm] = meal.time.split(":").map(Number);
    const mealMin = mh * 60 + mm;

    // Priority 2: Post-meal 30min (captures peak, most valuable)
    schedule.push({
      timeMin: mealMin + 30,
      type: "post_meal_30",
      priority: 2,
      reason: `30min after ${meal.name || "meal"} — peak glucose`,
      taken: false,
    });

    // Priority 3: Post-meal 60min
    schedule.push({
      timeMin: mealMin + 60,
      type: "post_meal_60",
      priority: 3,
      reason: `60min after ${meal.name || "meal"} — descent phase`,
      taken: false,
    });

    // Priority 4: Post-meal 120min
    schedule.push({
      timeMin: mealMin + 120,
      type: "post_meal_120",
      priority: 4,
      reason: `2h after ${meal.name || "meal"} — return to baseline`,
      taken: false,
    });
  }

  // Priority 5: Bedtime
  schedule.push({
    timeMin: BEDTIME_MIN,
    type: "bedtime",
    priority: 5,
    reason: "Bedtime reading",
    taken: false,
  });

  // Mark readings already taken (±15min match)
  for (const sr of schedule) {
    sr.taken = existingReadings.some((r) => {
      const [rh, rm] = r.time.split(":").map(Number);
      const readingMin = rh * 60 + rm;
      return Math.abs(readingMin - sr.timeMin) <= MATCH_TOLERANCE;
    });
  }

  // Strip conservation
  const untaken = schedule.filter((s) => !s.taken);
  if (stripsRemaining < 5) {
    // Only fasting + one post_meal_30
    return schedule.map((s) => ({
      ...s,
      taken:
        s.taken ||
        (s.type !== "fasting" &&
          !(
            s.type === "post_meal_30" &&
            untaken.filter((u) => u.type === "post_meal_30").indexOf(s) === 0
          )),
    }));
  }
  if (stripsRemaining < 10) {
    // Only P1-2 (fasting + post_meal_30)
    return schedule.map((s) => ({
      ...s,
      taken: s.taken || s.priority > 2,
    }));
  }

  return schedule.sort((a, b) => a.timeMin - b.timeMin);
}

/** Get the next due reading within a time window */
export function nextDueReading(
  schedule: ScheduledReading[],
  nowMin: number,
): ScheduledReading | null {
  const windowBefore = 15; // can take 15 min early
  const windowAfter = 5; // or 5 min late

  const due = schedule
    .filter((s) => !s.taken)
    .filter((s) => {
      const diff = s.timeMin - nowMin;
      return diff >= -windowBefore && diff <= windowAfter;
    })
    .sort((a, b) => a.priority - b.priority);

  return due[0] ?? null;
}

/** Auto-classify a reading type based on time relative to meals */
export function readingTypeForTime(
  timeMin: number,
  meals: FoodEntry[],
  fastBrokenAt: string | null,
): GlucoseReadingType {
  // Check meals FIRST — a reading near food is post-meal regardless of fasting status.
  // This prevents low-carb meals (kefir, cheese) from being misclassified as "fasting"
  // just because their insulin score didn't officially break the fast.
  for (const meal of meals) {
    const [mh, mm] = meal.time.split(":").map(Number);
    const mealMin = mh * 60 + mm;
    const diff = timeMin - mealMin;

    if (diff >= 20 && diff <= 40) return "post_meal_30";
    if (diff >= 50 && diff <= 75) return "post_meal_60";
    if (diff >= 100 && diff <= 140) return "post_meal_120";
    if (diff >= -15 && diff < 0) return "pre_meal";
  }

  // No nearby meals — check fasting status
  if (!fastBrokenAt) return "fasting";

  const [fh, fm] = fastBrokenAt.split(":").map(Number);
  const fastBrokenMin = fh * 60 + fm;
  if (timeMin < fastBrokenMin) return "fasting";

  // Bedtime (after 9pm)
  if (timeMin >= 21 * 60) return "bedtime";

  return "random";
}
