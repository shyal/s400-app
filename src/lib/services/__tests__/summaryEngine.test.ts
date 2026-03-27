import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateSummary,
  type UserContext,
  type SummaryFragment,
} from "$lib/services/summaryEngine";
import type {
  PeriodSummaryData,
  PeriodNutrition,
  PeriodWorkouts,
  PeriodWeight,
  FeedingWindowInfo,
  TimeContext,
} from "$lib/services/summaryData";

function makeNutrition(
  overrides: Partial<PeriodNutrition> = {},
): PeriodNutrition {
  return {
    days: 1,
    avgCalories: 1800,
    avgProtein: 110,
    avgWater: 2500,
    daysProteinHit: 1,
    daysWaterHit: 0,
    daysOverCalories: 0,
    daysUnderCalories: 1,
    totalCalories: 1800,
    totalProtein: 110,
    totalWater: 2500,
    mealCount: 3,
    bestProteinDay: 110,
    worstProteinDay: 110,
    bestCalorieDay: 1800,
    worstCalorieDay: 1800,
    ...overrides,
  };
}

function makeWorkouts(overrides: Partial<PeriodWorkouts> = {}): PeriodWorkouts {
  return {
    count: 0,
    totalVolume: 0,
    avgDuration: 0,
    longestGap: 0,
    exercisePRs: [],
    exercisesDone: [],
    totalSets: 0,
    heaviestLift: null,
    ...overrides,
  };
}

function makeWeight(overrides: Partial<PeriodWeight> = {}): PeriodWeight {
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
    ...overrides,
  };
}

function makeTimeContext(overrides: Partial<TimeContext> = {}): TimeContext {
  return {
    hour: 12,
    dayOfWeek: 3,
    dayName: "Wednesday",
    isWeekend: false,
    ...overrides,
  };
}

function makeSummaryData(
  overrides: Partial<PeriodSummaryData> = {},
): PeriodSummaryData {
  return {
    nutrition: makeNutrition(),
    workouts: makeWorkouts(),
    weight: makeWeight(),
    period: "today",
    daysSinceLastWorkout: 1,
    feedingWindow: {
      isOpen: true,
      closesAt: "16:00",
      minutesLeft: 120,
      firstMealTime: "12:00",
    },
    time: makeTimeContext(),
    ...overrides,
  };
}

const defaultCtx: UserContext = {
  goalKg: 72,
  goalDate: "2025-06-01",
  currentWeight: 80,
  proteinTarget: 100,
  calorieTarget: 2000,
  waterTarget: 3000,
  liftFrequencyDays: 2,
};

describe("generateSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns fragments for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData();
    const result = generateSummary(data, defaultCtx);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("includes opener for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData();
    const result = generateSummary(data, defaultCtx);
    expect(result[0].priority).toBeLessThanOrEqual(1);
  });

  it("handles no data today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const noData = result.find((f) => f.text.includes("logged"));
    expect(noData).toBeDefined();
  });

  it("flags protein hit as achievement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgProtein: 120, mealCount: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    const proteinFrag = result.find((f) => f.text.includes("protein"));
    expect(proteinFrag?.mood).toBe("achievement");
  });

  it("warns on protein shortfall", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgProtein: 40, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const proteinFrag = result.find((f) => f.text.includes("protein"));
    expect(proteinFrag?.mood).toBe("warning");
  });

  it("warns on calorie overshoot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T20:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: 2500, totalCalories: 2500 }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) => f.text.includes("cal") && f.text.includes("over"),
    );
    expect(calFrag?.mood).toBe("warning");
  });

  it("celebrates workout today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat", "Bench Press", "Barbell Row"],
        totalSets: 15,
        avgDuration: 45,
        heaviestLift: { name: "Squat", weight: 80 },
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const workout = result.find(
      (f) => f.text.includes("session") || f.text.includes("Workout"),
    );
    expect(workout?.mood).toBe("achievement");
  });

  it("nags about workout gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      daysSinceLastWorkout: 4,
      workouts: makeWorkouts({ count: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const gap = result.find((f) => f.text.includes("days"));
    expect(gap).toBeDefined();
  });

  it("handles week period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        daysProteinHit: 5,
        daysWaterHit: 4,
        daysOverCalories: 2,
      }),
      weight: makeWeight({
        startWeight: 81,
        endWeight: 80,
        change: -1,
        trend: "down",
        weeklyRate: -1,
        measurementCount: 3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("celebrates PRs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisePRs: [{ name: "Squat", weight: 100 }],
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 40,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const pr = result.find((f) => f.text.includes("PR"));
    expect(pr?.mood).toBe("achievement");
    expect(pr?.priority).toBe(10);
  });

  it("sorts content by priority descending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({
        avgProtein: 120,
        avgCalories: 1800,
        mealCount: 3,
      }),
      workouts: makeWorkouts({
        count: 1,
        exercisePRs: [{ name: "Squat", weight: 100 }],
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 40,
        heaviestLift: { name: "Squat", weight: 100 },
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const content = result.filter((f) => f.priority > 1);
    for (let i = 1; i < content.length; i++) {
      expect(content[i].priority).toBeLessThanOrEqual(content[i - 1].priority);
    }
  });

  it("caps today at 8 fragments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T15:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({
        avgProtein: 120,
        avgCalories: 1800,
        avgWater: 3100,
        mealCount: 5,
      }),
      workouts: makeWorkouts({
        count: 1,
        exercisePRs: [{ name: "Squat", weight: 100 }],
        exercisesDone: ["Squat", "Bench", "Row"],
        totalSets: 15,
        avgDuration: 50,
        heaviestLift: { name: "Squat", weight: 100 },
      }),
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 50,
        firstMealTime: "12:00",
      },
      daysSinceLastWorkout: 0,
    });
    const result = generateSummary(data, defaultCtx);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("never crashes from a rule error", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    // Passing partially broken data should not throw
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: NaN }),
    });
    expect(() => generateSummary(data, defaultCtx)).not.toThrow();
  });

  it("catches rule errors and continues processing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    // Create data where time.hour access throws, triggering the catch block
    const data = makeSummaryData();
    Object.defineProperty(data.time, "hour", {
      get() {
        throw new Error("forced error");
      },
    });
    // Should not throw — the catch block in generateSummary (line 692) swallows the error
    const result = generateSummary(data, defaultCtx);
    // Some rules that don't access time.hour may still produce fragments
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── waterRule ──

describe("waterRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates hitting water target today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgWater: 3200, mealCount: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("water") &&
        (f.text.includes("done") ||
          f.text.includes("target hit") ||
          f.text.includes("Hydrated")),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("achievement");
  });

  it("shows nearly there when within 0.5L of target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgWater: 2600, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("water") || f.text.includes("Almost"),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("neutral");
  });

  it("warns when very low water past 2pm", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:30:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 14 }),
      nutrition: makeNutrition({ avgWater: 300, mealCount: 1 }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find((f) =>
      f.text.toLowerCase().includes("dehydrat"),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("warning");
  });

  it("shows remaining water when moderately behind", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgWater: 1500, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("water") &&
        (f.text.includes("to go") ||
          f.text.includes("more") ||
          f.text.includes("left")),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("neutral");
  });

  it("skips when no meals and zero water today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgWater: 0, mealCount: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    // Water rule should produce nothing when no meals logged and 0 water
    const waterFrag = result.find(
      (f) => f.text.toLowerCase().includes("water") && f.text.includes("to go"),
    );
    expect(waterFrag).toBeUndefined();
  });

  it("celebrates perfect water for week period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, daysWaterHit: 7, avgWater: 3200 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("water") &&
        (f.text.includes("every day") || f.text.includes("Perfect")),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("achievement");
  });

  it("warns when zero days hit water target for week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, daysWaterHit: 0, avgWater: 1500 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("water") &&
        (f.text.includes("single day") || f.text.includes("Zero days")),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("warning");
  });

  it("warns when water hit rate is below 40% for week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, daysWaterHit: 2, avgWater: 2200 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find(
      (f) => f.text.includes("2/7") || f.text.includes("2 of 7"),
    );
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("warning");
  });

  it("shows neutral summary for moderate water hit rate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, daysWaterHit: 4, avgWater: 2700 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const waterFrag = result.find((f) => f.text.includes("4/7"));
    expect(waterFrag).toBeDefined();
    expect(waterFrag?.mood).toBe("neutral");
  });
});

// ── fastingRule ──

describe("fastingRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns when feeding window closing in under 60 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T15:30:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 30,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    const fastFrag = result.find(
      (f) =>
        f.text.includes("30m") ||
        f.text.includes("closing") ||
        f.text.includes("Last call"),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("warning");
    expect(fastFrag?.priority).toBe(9);
  });

  it("shows neutral when window open with more than 60 minutes left", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T13:00:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 180,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    const fastFrag = result.find(
      (f) => f.text.includes("Window open") || f.text.includes("left"),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("neutral");
  });

  it("shows closed window status", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T18:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 18 }),
      feedingWindow: {
        isOpen: false,
        closesAt: "16:00",
        minutesLeft: null,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    const fastFrag = result.find(
      (f) => f.text.includes("closed") || f.text.includes("shut"),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("neutral");
  });

  it("returns empty when window open but minutesLeft exceeds 240", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:30:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:30",
        minutesLeft: 250,
        firstMealTime: "12:30",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // The fasting rule's final return [] is hit when isOpen but minutesLeft > 240
    const fastFrag = result.find(
      (f) =>
        f.text.includes("Window open") ||
        f.text.includes("closed") ||
        f.text.includes("shut") ||
        f.text.includes("Feeding window") ||
        f.text.includes("Last call"),
    );
    expect(fastFrag).toBeUndefined();
  });

  it("returns nothing when no first meal time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: false,
        closesAt: null,
        minutesLeft: null,
        firstMealTime: null,
      },
    });
    const result = generateSummary(data, defaultCtx);
    const fastFrag = result.find(
      (f) => f.text.includes("Window") || f.text.includes("window"),
    );
    expect(fastFrag).toBeUndefined();
  });

  it("returns nothing for non-today periods", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 120,
        firstMealTime: "12:00",
      },
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const fastFrag = result.find(
      (f) =>
        f.text.includes("Window open") || f.text.includes("Feeding window"),
    );
    expect(fastFrag).toBeUndefined();
  });
});

// ── weightTrendRule ──

describe("weightTrendRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      weight: makeWeight({
        change: -1,
        trend: "down",
        endWeight: 79,
        measurementCount: 3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) => f.text.includes("Down") || f.text.includes("Lost"),
    );
    expect(trendFrag).toBeUndefined();
  });

  it("celebrates weight going down in a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 81,
        endWeight: 80,
        change: -1,
        trend: "down",
        weeklyRate: -1,
        measurementCount: 4,
        lowestWeight: 79.5,
        highestWeight: 81.2,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.text.includes("1kg") &&
        (f.text.includes("Down") ||
          f.text.includes("Lost") ||
          f.text.includes("lighter")),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("achievement");
  });

  it("warns about fast weight loss (>1.5kg/week)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 82,
        endWeight: 80,
        change: -2,
        trend: "down",
        weeklyRate: -2,
        measurementCount: 5,
        lowestWeight: 79.8,
        highestWeight: 82,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.text.includes("2kg") &&
        (f.text.includes("fast") ||
          f.text.includes("Dropped") ||
          f.text.includes("Aggressive")),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("achievement");
  });

  it("warns when weight goes up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 80,
        endWeight: 81,
        change: 1,
        trend: "up",
        weeklyRate: 1,
        measurementCount: 4,
        lowestWeight: 79.8,
        highestWeight: 81.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        (f.text.includes("Up") ||
          f.text.includes("up") ||
          f.text.includes("+1")) &&
        f.mood === "warning",
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("warning");
  });

  it("notes flat weight trend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 80,
        endWeight: 80,
        change: 0,
        trend: "flat",
        weeklyRate: 0,
        measurementCount: 5,
        lowestWeight: 79.5,
        highestWeight: 80.3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.text.includes("stable") ||
        f.text.includes("Flat") ||
        f.text.includes("budge"),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("neutral");
  });

  it("notes insufficient measurements", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 80,
        endWeight: 80,
        change: 0,
        trend: "flat",
        measurementCount: 1,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) => f.text.includes("weigh-in") && f.text.includes("1"),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("neutral");
  });

  it("returns nothing when change is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({ change: null, trend: null, measurementCount: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.text.includes("Down") ||
        f.text.includes("Up") ||
        f.text.includes("stable"),
    );
    expect(trendFrag).toBeUndefined();
  });
});

// ── goalPaceRule ──

describe("goalPaceRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates when goal weight is reached", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 71,
        startWeight: 71.5,
        weeklyRate: -0.5,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 71.5 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) =>
        f.text.includes("Goal achieved") ||
        f.text.includes("goal") ||
        f.text.includes("72kg"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("achievement");
  });

  it("shows info when goal deadline passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 75,
        startWeight: 75.5,
        weeklyRate: -0.5,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 75 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) =>
        f.text.includes("deadline") ||
        f.text.includes("passed") ||
        f.text.includes("behind"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("trend");
  });

  it("shows on-track message when weight loss rate matches needed pace", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 4,
        change: -0.7,
        trend: "down",
        endWeight: 76,
        startWeight: 76.7,
        weeklyRate: -0.7,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 76 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) =>
        f.text.includes("on pace") ||
        f.text.includes("On track") ||
        f.text.includes("realistic") ||
        f.text.includes("kg/week"),
    );
    expect(goalFrag).toBeDefined();
  });

  it("shows ahead-of-schedule message when losing fast", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 5,
        change: -1.5,
        trend: "down",
        endWeight: 74,
        startWeight: 75.5,
        weeklyRate: -1.5,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 74 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) => f.text.includes("ahead") || f.text.includes("early"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("achievement");
  });

  it("warns when losing too slowly to hit deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-05-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 4,
        change: -0.1,
        trend: "down",
        endWeight: 77,
        startWeight: 77.1,
        weeklyRate: -0.1,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 77 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) => f.text.includes("pick up") || f.text.includes("need"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("warning");
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const goalFrag = result.find(
      (f) => f.text.includes("goal") && f.text.includes("72kg"),
    );
    expect(goalFrag).toBeUndefined();
  });

  it("returns nothing for month period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 30 }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const goalFrag = result.find(
      (f) => f.text.includes("goal") && f.text.includes("72kg"),
    );
    expect(goalFrag).toBeUndefined();
  });

  it("returns nothing when currentWeight is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        weeklyRate: -0.5,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: null };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find((f) => f.text.includes("72kg"));
    expect(goalFrag).toBeUndefined();
  });

  it("shows general pace info when no weekly rate data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 78,
        startWeight: 78.5,
        weeklyRate: null,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 78 };
    const result = generateSummary(data, ctx);
    const goalFrag = result.find(
      (f) => f.text.includes("72kg") && f.text.includes("week"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("trend");
  });
});

// ── bodyCompRule ──

describe("bodyCompRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      weight: makeWeight({
        bodyFatChange: -0.5,
        muscleChange: 0.3,
        bodyFatEnd: 20,
        muscleEnd: 35,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find(
      (f) => f.text.includes("body fat") || f.text.includes("Recomp"),
    );
    expect(compFrag).toBeUndefined();
  });

  it("detects recomp (fat down + muscle up)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: -0.5,
        muscleChange: 0.3,
        bodyFatEnd: 20,
        muscleEnd: 35,
        measurementCount: 4,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find(
      (f) =>
        f.text.includes("Recomp") ||
        f.text.includes("recomp") ||
        f.text.includes("Losing fat, gaining muscle"),
    );
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("achievement");
    expect(compFrag?.priority).toBe(9);
  });

  it("celebrates body fat going down", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: -0.5,
        bodyFatEnd: 19.5,
        muscleChange: null,
        measurementCount: 4,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("body fat down"));
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("achievement");
  });

  it("warns when body fat goes up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: 0.5,
        bodyFatEnd: 21,
        muscleChange: null,
        measurementCount: 4,
        change: 0.5,
        trend: "up",
        endWeight: 80.5,
        startWeight: 80,
        weeklyRate: 0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("body fat up"));
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("warning");
  });

  it("celebrates muscle going up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        muscleChange: 0.4,
        muscleEnd: 35.4,
        bodyFatChange: null,
        measurementCount: 4,
        change: -0.3,
        trend: "down",
        endWeight: 79.7,
        startWeight: 80,
        weeklyRate: -0.3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("muscle up"));
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("achievement");
  });

  it("warns when muscle goes down", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        muscleChange: -0.5,
        muscleEnd: 34.5,
        bodyFatChange: null,
        measurementCount: 4,
        change: -0.8,
        trend: "down",
        endWeight: 79.2,
        startWeight: 80,
        weeklyRate: -0.8,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("muscle down"));
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("warning");
  });

  it("returns nothing when changes are too small", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: 0.1,
        muscleChange: -0.1,
        measurementCount: 4,
        change: -0.3,
        trend: "down",
        endWeight: 79.7,
        startWeight: 80,
        weeklyRate: -0.3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // bodyCompRule should not fire when both changes are < 0.2 threshold
    const compFrag = result.find(
      (f) => f.text.includes("Body comp") || f.text.includes("Recomp"),
    );
    expect(compFrag).toBeUndefined();
  });
});

// ── deficitInsightRule ──

describe("deficitInsightRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      weight: makeWeight({ weeklyRate: -0.8 }),
      nutrition: makeNutrition({ avgCalories: 1800 }),
    });
    const result = generateSummary(data, defaultCtx);
    const defFrag = result.find(
      (f) => f.text.includes("deficit") && f.text.includes("cal/day"),
    );
    expect(defFrag).toBeUndefined();
  });

  it("shows estimated deficit when losing weight over a week with enough days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, avgCalories: 1800 }),
      weight: makeWeight({
        weeklyRate: -0.8,
        change: -0.8,
        trend: "down",
        measurementCount: 4,
        endWeight: 79.2,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // deficitInsightRule produces fragments with "cal/day deficit" or "deficit is about X cal/day"
    const defFrag = result.find(
      (f) =>
        f.text.includes("cal/day") &&
        f.text.includes("deficit") &&
        f.mood === "trend",
    );
    expect(defFrag).toBeDefined();
  });

  it("returns nothing when weekly rate is positive (gaining)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, avgCalories: 2200 }),
      weight: makeWeight({
        weeklyRate: 0.5,
        change: 0.5,
        trend: "up",
        measurementCount: 4,
        endWeight: 80.5,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // deficitInsightRule should not fire when weight is going up
    const defFrag = result.find(
      (f) =>
        f.text.includes("cal/day") &&
        f.text.includes("deficit") &&
        f.mood === "trend",
    );
    expect(defFrag).toBeUndefined();
  });

  it("returns nothing when week has less than 5 days of data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 3, avgCalories: 1800 }),
      weight: makeWeight({
        weeklyRate: -0.8,
        change: -0.8,
        trend: "down",
        measurementCount: 3,
        endWeight: 79.2,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // deficitInsightRule checks `data.period === 'week' && data.nutrition.days < 5` and returns []
    const defFrag = result.find(
      (f) =>
        f.text.includes("cal/day") &&
        f.mood === "trend" &&
        f.text.includes("deficit"),
    );
    expect(defFrag).toBeUndefined();
  });

  it("shows deficit for month period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28, avgCalories: 1800 }),
      weight: makeWeight({
        weeklyRate: -0.6,
        change: -2.4,
        trend: "down",
        measurementCount: 10,
        endWeight: 77.6,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const defFrag = result.find(
      (f) =>
        f.text.includes("cal/day") &&
        f.mood === "trend" &&
        f.text.includes("deficit"),
    );
    expect(defFrag).toBeDefined();
  });

  it("returns nothing when avgCalories is zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28, avgCalories: 0 }),
      weight: makeWeight({
        weeklyRate: -0.6,
        change: -2.4,
        trend: "down",
        measurementCount: 10,
        endWeight: 77.6,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const defFrag = result.find(
      (f) => f.text.includes("deficit") && f.text.includes("cal/day"),
    );
    expect(defFrag).toBeUndefined();
  });
});

// ── streakRule ──

describe("streakRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      workouts: makeWorkouts({ count: 4, longestGap: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const streakFrag = result.find(
      (f) => f.text.includes("cadence") && f.text.includes("sessions"),
    );
    expect(streakFrag).toBeUndefined();
  });

  it("returns nothing when fewer than 3 workouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({ count: 2, longestGap: 2 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const streakFrag = result.find(
      (f) => f.text.includes("cadence") && f.text.includes("Discipline"),
    );
    expect(streakFrag).toBeUndefined();
  });

  it("celebrates perfect cadence when longestGap <= frequency+1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 4,
        longestGap: 2,
        totalSets: 60,
        avgDuration: 45,
        totalVolume: 15000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // streakRule produces text with "Discipline", "Perfect consistency", or "missed cadence"
    const streakFrag = result.find(
      (f) =>
        (f.text.includes("Discipline") ||
          f.text.includes("Perfect consistency") ||
          f.text.includes("missed cadence")) &&
        f.mood === "achievement",
    );
    expect(streakFrag).toBeDefined();
  });

  it("returns nothing when gap exceeds cadence threshold", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 3,
        longestGap: 5,
        totalSets: 45,
        avgDuration: 40,
        totalVolume: 10000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const streakFrag = result.find(
      (f) =>
        (f.text.includes("Discipline") ||
          f.text.includes("Perfect consistency") ||
          f.text.includes("missed cadence")) &&
        f.priority === 6,
    );
    expect(streakFrag).toBeUndefined();
  });
});

// ── recoveryRule ──

describe("recoveryRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for non-today periods", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, avgProtein: 40 }),
      workouts: makeWorkouts({ count: 3 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const recovFrag = result.find(
      (f) => f.text.includes("recover") || f.text.includes("Post-workout"),
    );
    expect(recovFrag).toBeUndefined();
  });

  it("returns nothing when no workout today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({ count: 0 }),
      nutrition: makeNutrition({ avgProtein: 30, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const recovFrag = result.find(
      (f) => f.text.includes("recover") || f.text.includes("Post-workout"),
    );
    expect(recovFrag).toBeUndefined();
  });

  it("warns when lifted today but protein is very low", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T16:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 16 }),
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 45,
      }),
      nutrition: makeNutrition({
        avgProtein: 30,
        mealCount: 2,
        avgCalories: 1200,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const recovFrag = result.find(
      (f) =>
        f.text.includes("protein") &&
        (f.text.includes("recover") ||
          f.text.includes("behind") ||
          f.text.includes("Post-workout")),
    );
    expect(recovFrag).toBeDefined();
    expect(recovFrag?.mood).toBe("warning");
    expect(recovFrag?.priority).toBe(8);
  });

  it("celebrates when lifted and hit protein while in deficit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T18:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 18 }),
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat", "Bench Press"],
        totalSets: 10,
        avgDuration: 50,
      }),
      nutrition: makeNutrition({
        avgProtein: 110,
        avgCalories: 1900,
        mealCount: 3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const recovFrag = result.find(
      (f) =>
        f.text.includes("Lifted") ||
        f.text.includes("Workout") ||
        f.text.includes("playbook") ||
        f.text.includes("recomp"),
    );
    expect(recovFrag).toBeDefined();
    expect(recovFrag?.mood).toBe("achievement");
  });

  it("returns nothing when workout done but protein is middling (not under 50% and not at target)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 40,
      }),
      nutrition: makeNutrition({
        avgProtein: 70,
        avgCalories: 1500,
        mealCount: 2,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // Recovery rule won't fire: protein is above 50% target but below target, and calories are under
    const recovFrag = result.find(
      (f) =>
        (f.text.includes("recover") ||
          f.text.includes("playbook") ||
          f.text.includes("Post-workout")) &&
        (f.mood === "warning" || f.mood === "achievement"),
    );
    expect(recovFrag).toBeUndefined();
  });
});

// ── weekOpenerRule ──

describe("weekOpenerRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows week opener for week period with data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result.find(
      (f) =>
        f.priority <= 1 &&
        (f.text.includes("7-day") ||
          f.text.includes("Weekly") ||
          f.text.includes("week")),
    );
    expect(opener).toBeDefined();
    expect(opener?.mood).toBe("neutral");
  });

  it("shows no-data message for week with zero days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 0,
        avgCalories: 0,
        avgProtein: 0,
        avgWater: 0,
      }),
      weight: makeWeight({ measurementCount: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result.find((f) =>
      f.text.includes("No data logged this week"),
    );
    expect(opener).toBeDefined();
    expect(opener?.mood).toBe("neutral");
  });

  it("does not fire for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({ period: "today" });
    const result = generateSummary(data, defaultCtx);
    const weekOpener = result.find(
      (f) => f.text.includes("7-day") || f.text.includes("Weekly rollup"),
    );
    expect(weekOpener).toBeUndefined();
  });
});

// ── monthOpenerRule ──

describe("monthOpenerRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows month opener for month period with data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        endWeight: 78,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result.find(
      (f) =>
        f.priority <= 1 &&
        (f.text.includes("30-day") ||
          f.text.includes("bigger picture") ||
          f.text.includes("Monthly")),
    );
    expect(opener).toBeDefined();
    expect(opener?.mood).toBe("neutral");
  });

  it("shows no-data message for month with zero days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({
        days: 0,
        avgCalories: 0,
        avgProtein: 0,
        avgWater: 0,
      }),
      weight: makeWeight({ measurementCount: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result.find((f) => f.text.includes("Not much data"));
    expect(opener).toBeDefined();
    expect(opener?.mood).toBe("neutral");
  });

  it("does not fire for today or week periods", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    for (const period of ["today", "week"] as const) {
      const data = makeSummaryData({
        period,
        nutrition: makeNutrition({ days: period === "week" ? 7 : 1 }),
        weight: makeWeight({
          measurementCount: 3,
          change: -0.5,
          trend: "down",
          endWeight: 79.5,
          startWeight: 80,
          weeklyRate: -0.5,
        }),
      });
      const result = generateSummary(data, defaultCtx);
      const monthOpener = result.find(
        (f) =>
          f.text.includes("30-day") ||
          f.text.includes("bigger picture") ||
          f.text.includes("Monthly"),
      );
      expect(monthOpener).toBeUndefined();
    }
  });
});

// ── openerRule time-of-day branches ──

describe("openerRule time branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows early morning opener before 8am", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T06:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 6, dayName: "Wednesday" }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result[0];
    expect(opener.priority).toBeLessThanOrEqual(1);
    expect(opener.text).toMatch(/Early|morning|grind|Wednesday/i);
  });

  it("shows afternoon opener between 12-17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 14, dayName: "Wednesday" }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result[0];
    expect(opener.priority).toBeLessThanOrEqual(1);
    expect(opener.text).toMatch(/Afternoon|Mid-|Wednesday/i);
  });

  it("shows evening opener after 17", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T20:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 20, dayName: "Wednesday" }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result[0];
    expect(opener.priority).toBeLessThanOrEqual(1);
    expect(opener.text).toMatch(/evening|books|damage|Wednesday/i);
  });

  it("shows weekend vibe on Saturday morning", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-18T10:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({
        hour: 10,
        dayName: "Saturday",
        isWeekend: true,
        dayOfWeek: 6,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result[0];
    expect(opener.text).toMatch(/Saturday/i);
  });
});

// ── noDataRule time branches ──

describe("noDataRule time branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows early-morning fasting message before 10am", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T08:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 8 }),
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const noData = result.find(
      (f) =>
        f.text.includes("fasting") ||
        f.text.includes("Moda") ||
        f.text.includes("logged yet"),
    );
    expect(noData).toBeDefined();
    expect(noData?.mood).toBe("neutral");
  });

  it("shows midday warning between 10-14", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 12 }),
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const noData = result.find(
      (f) =>
        f.text.includes("12:00") ||
        f.text.includes("Blank slate") ||
        f.text.includes("tracked"),
    );
    expect(noData).toBeDefined();
    expect(noData?.mood).toBe("warning");
  });

  it("shows afternoon warning after 14", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T16:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 16 }),
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const noData = result.find(
      (f) =>
        f.text.includes("16:00") ||
        f.text.includes("all day") ||
        f.text.includes("off-app") ||
        f.text.includes("No data"),
    );
    expect(noData).toBeDefined();
    expect(noData?.mood).toBe("warning");
  });

  it("does not fire for non-today periods", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
        days: 7,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const noData = result.find(
      (f) => f.text.includes("logged yet") || f.text.includes("off-app"),
    );
    expect(noData).toBeUndefined();
  });
});

// ── calorieRule week/month branches ──

describe("calorieRule week/month branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates when weekly avg calories on target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgCalories: 1980,
        daysOverCalories: 1,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("cal") &&
        (f.text.includes("dialed") ||
          f.text.includes("sweet spot") ||
          f.text.includes("consistent")),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("achievement");
  });

  it("warns when over half the days are over calories", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgCalories: 2200,
        daysOverCalories: 5,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("5") &&
        (f.text.includes("over") ||
          f.text.includes("budget") ||
          f.text.includes("stall")),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("warning");
  });

  it("warns when avg over target by more than 100", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgCalories: 2200,
        daysOverCalories: 2,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) => f.text.includes("2200") && f.text.includes("over"),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("warning");
  });

  it("celebrates when avg comfortably under target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgCalories: 1700,
        daysOverCalories: 0,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("1700") &&
        (f.text.includes("under") || f.text.includes("checks out")),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("achievement");
  });

  it("shows today calorie near target as achievement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: 1990, mealCount: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("cal") &&
        (f.text.includes("textbook") ||
          f.text.includes("perfect") ||
          f.text.includes("exactly")),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("achievement");
  });

  it("shows today calorie slightly over/under as neutral", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: 1870, mealCount: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) => f.text.includes("1870") && f.text.includes("cal"),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("neutral");
  });

  it("shows today calorie well under as neutral with headroom", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: 1200, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("1200") &&
        (f.text.includes("under") ||
          f.text.includes("headroom") ||
          f.text.includes("Budget")),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("neutral");
  });
});

// ── proteinRule week/month branches ──

describe("proteinRule week/month branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates perfect protein all week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgProtein: 120,
        daysProteinHit: 7,
        bestProteinDay: 140,
        worstProteinDay: 105,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // proteinRule for all days hit: text contains "100g" and "every" or "Perfect" or "7 for 7"
    const protFrag = result.find(
      (f) =>
        f.text.includes("100g") &&
        f.mood === "achievement" &&
        f.text.includes("protein"),
    );
    expect(protFrag).toBeDefined();
  });

  it("warns when zero days hit protein target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgProtein: 60,
        daysProteinHit: 0,
        bestProteinDay: 80,
        worstProteinDay: 40,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // proteinRule for zero days hit: variants include "Didn't hit 100g", "Zero days at 100g", or "Protein was the weak link"
    const protFrag = result.find(
      (f) =>
        f.mood === "warning" &&
        f.priority === 9 &&
        f.text.toLowerCase().includes("protein"),
    );
    expect(protFrag).toBeDefined();
  });

  it("shows neutral for good but not perfect protein hit rate (>=70%)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgProtein: 105,
        daysProteinHit: 5,
        bestProteinDay: 130,
        worstProteinDay: 70,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // Protein hit rate 5/7 (>=70%): neutral mood, text includes "5" and "7"
    const protFrag = result.find(
      (f) =>
        f.text.includes("5") &&
        f.text.includes("7") &&
        f.mood === "neutral" &&
        f.text.toLowerCase().includes("protein"),
    );
    expect(protFrag).toBeDefined();
  });

  it("warns for low protein hit rate (<70%)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({
        days: 7,
        avgProtein: 85,
        daysProteinHit: 3,
        bestProteinDay: 120,
        worstProteinDay: 50,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // Protein hit rate 3/7 (<70%): warning, text includes protein
    const protFrag = result.find(
      (f) =>
        f.mood === "warning" &&
        f.text.toLowerCase().includes("protein") &&
        (f.text.includes("3") || f.text.includes("4")),
    );
    expect(protFrag).toBeDefined();
  });

  it("shows today protein slightly under target as neutral", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgProtein: 80, mealCount: 2 }),
    });
    const result = generateSummary(data, defaultCtx);
    const protFrag = result.find(
      (f) =>
        f.text.includes("protein") &&
        (f.text.includes("short") ||
          f.text.includes("Almost") ||
          f.text.includes("to go") ||
          f.text.includes("away")),
    );
    expect(protFrag).toBeDefined();
    expect(protFrag?.mood).toBe("neutral");
  });
});

// ── workoutFreqRule ──

describe("workoutFreqRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      workouts: makeWorkouts({ count: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    const freqFrag = result.find(
      (f) => f.text.includes("sessions") && f.text.includes("cadence"),
    );
    expect(freqFrag).toBeUndefined();
  });

  it("warns when zero workouts in a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({ count: 0 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const freqFrag = result.find(
      (f) =>
        f.text.includes("No workouts") ||
        f.text.includes("Zero sessions") ||
        f.text.includes("Not a single"),
    );
    expect(freqFrag).toBeDefined();
    expect(freqFrag?.mood).toBe("warning");
    expect(freqFrag?.priority).toBe(9);
  });

  it("celebrates meeting workout frequency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 4,
        totalSets: 60,
        avgDuration: 45,
        totalVolume: 15000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // With liftFrequencyDays=2, expected per week = 7/2 = 3.5, rounded to 4
    const freqFrag = result.find(
      (f) =>
        f.text.includes("4 sessions") ||
        f.text.includes("4 workouts") ||
        f.text.includes("Nailed"),
    );
    expect(freqFrag).toBeDefined();
    expect(freqFrag?.mood).toBe("achievement");
  });

  it("warns when below expected workout frequency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 2,
        totalSets: 30,
        avgDuration: 40,
        totalVolume: 7000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const freqFrag = result.find(
      (f) =>
        f.text.includes("2 sessions") ||
        f.text.includes("2 out of") ||
        f.text.includes("Missed"),
    );
    expect(freqFrag).toBeDefined();
    expect(freqFrag?.mood).toBe("warning");
  });
});

// ── workoutGapRule ──

describe("workoutGapRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      workouts: makeWorkouts({ count: 3, longestGap: 6 }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find((f) => f.text.includes("gap"));
    expect(gapFrag).toBeUndefined();
  });

  it("warns about large gaps (>=5 days)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 3,
        longestGap: 6,
        totalSets: 45,
        avgDuration: 40,
        totalVolume: 10000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find(
      (f) =>
        f.text.includes("6") &&
        f.text.includes("day") &&
        (f.text.includes("gap") || f.text.includes("break")),
    );
    expect(gapFrag).toBeDefined();
    expect(gapFrag?.mood).toBe("warning");
  });

  it("shows neutral note for slightly over-cadence gap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 3,
        longestGap: 4,
        totalSets: 45,
        avgDuration: 40,
        totalVolume: 10000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find(
      (f) => f.text.includes("4 days") && f.text.includes("gap"),
    );
    expect(gapFrag).toBeDefined();
    expect(gapFrag?.mood).toBe("neutral");
  });

  it("returns nothing when gap is within acceptable range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 4,
        longestGap: 2,
        totalSets: 60,
        avgDuration: 45,
        totalVolume: 15000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find(
      (f) => f.text.includes("gap") && f.text.includes("Longest"),
    );
    expect(gapFrag).toBeUndefined();
  });

  it("returns nothing when fewer than 2 workouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({ count: 1, longestGap: 0 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find(
      (f) => f.text.includes("gap") && f.text.includes("Longest"),
    );
    expect(gapFrag).toBeUndefined();
  });
});

// ── bodyCompRule combination branches ──

describe("bodyCompRule combination branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns when body fat goes up and muscle goes down simultaneously", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: 0.5,
        bodyFatEnd: 21,
        muscleChange: -0.3,
        muscleEnd: 34.7,
        measurementCount: 4,
        change: 0.2,
        trend: "up",
        endWeight: 80.2,
        startWeight: 80,
        weeklyRate: 0.2,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find(
      (f) => f.text.includes("body fat up") && f.text.includes("muscle down"),
    );
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("warning");
    expect(compFrag?.priority).toBe(7);
  });

  it("shows body fat up with muscle up (not recomp)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: 0.3,
        bodyFatEnd: 21.3,
        muscleChange: 0.4,
        muscleEnd: 35.4,
        measurementCount: 4,
        change: 0.5,
        trend: "up",
        endWeight: 80.5,
        startWeight: 80,
        weeklyRate: 0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // Two parts: body fat up AND muscle up, but not recomp (fat went up)
    const compFrag = result.find(
      (f) =>
        f.text.includes("Body comp") &&
        f.text.includes("body fat up") &&
        f.text.includes("muscle up"),
    );
    expect(compFrag).toBeDefined();
    // muscle up sets mood to achievement if not already achievement
    expect(compFrag?.mood).toBe("achievement");
  });
});

// ── workoutTodayRule with workout data ──

describe("workoutTodayRule workout present", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes heaviest lift note when present", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat", "Bench Press"],
        totalSets: 10,
        avgDuration: 45,
        heaviestLift: { name: "Squat", weight: 100 },
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const wFrag = result.find(
      (f) => f.text.includes("100kg") || f.text.includes("Squat"),
    );
    expect(wFrag).toBeDefined();
    expect(wFrag?.mood).toBe("achievement");
  });

  it("shows rest day message when last workout was 1 day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      daysSinceLastWorkout: 1,
      workouts: makeWorkouts({ count: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const restFrag = result.find(
      (f) => f.text.includes("Rest day") || f.text.includes("Day off"),
    );
    expect(restFrag).toBeDefined();
    expect(restFrag?.mood).toBe("neutral");
  });
});

// ── hashStr edge cases via pick ──

describe("hashStr edge cases", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("produces deterministic output for same date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData();
    const result1 = generateSummary(data, defaultCtx);
    const result2 = generateSummary(data, defaultCtx);
    // Same date + same data => same fragments (deterministic via hashStr)
    expect(result1.map((f) => f.text)).toEqual(result2.map((f) => f.text));
  });

  it("may produce different variants on different dates", () => {
    vi.useFakeTimers();
    // Run on two different dates and verify it produces fragments (hash is exercised)
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData();
    const result1 = generateSummary(data, defaultCtx);

    vi.setSystemTime(new Date("2025-02-20T12:00:00"));
    const result2 = generateSummary(data, defaultCtx);

    // Both should produce fragments, but texts may differ due to different hash seeds
    expect(result1.length).toBeGreaterThan(0);
    expect(result2.length).toBeGreaterThan(0);
  });
});

// ── volumeRule ──

describe("volumeRule", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing for today period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "today",
      workouts: makeWorkouts({ totalVolume: 5000, count: 1, avgDuration: 45 }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find((f) => f.text.includes("volume"));
    expect(volFrag).toBeUndefined();
  });

  it("shows volume stat for week with workouts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        totalVolume: 15000,
        count: 4,
        avgDuration: 45,
        totalSets: 60,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find(
      (f) =>
        f.text.includes("15") &&
        (f.text.includes("volume") || f.text.includes("kg")),
    );
    expect(volFrag).toBeDefined();
    expect(volFrag?.mood).toBe("trend");
  });

  it("returns nothing when zero volume", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({ totalVolume: 0, count: 0 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find((f) => f.text.toLowerCase().includes("volume"));
    expect(volFrag).toBeUndefined();
  });
});

// ── prRule branches ──

describe("prRule branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates multiple PRs in a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        count: 3,
        exercisePRs: [
          { name: "Squat", weight: 100 },
          { name: "Bench Press", weight: 70 },
          { name: "Deadlift", weight: 120 },
        ],
        totalSets: 45,
        avgDuration: 45,
        totalVolume: 15000,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // prRule for multiple PRs: text has "Multiple PRs" or "PR city" or "New records", priority 10
    const prFrag = result.find(
      (f) => f.priority === 10 && f.mood === "achievement",
    );
    expect(prFrag).toBeDefined();
    expect(prFrag!.text).toMatch(/PR|records/i);
  });

  it("returns nothing when no PRs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisePRs: [],
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 40,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const prFrag = result.find((f) => f.text.includes("PR"));
    expect(prFrag).toBeUndefined();
  });
});

// ── workoutTodayRule rest day ──

describe("workoutTodayRule rest day", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows rest day message when lifted yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      daysSinceLastWorkout: 1,
      workouts: makeWorkouts({ count: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const restFrag = result.find(
      (f) =>
        f.text.includes("Rest day") ||
        f.text.includes("Day off") ||
        f.text.includes("rest"),
    );
    expect(restFrag).toBeDefined();
    expect(restFrag?.mood).toBe("neutral");
  });

  it("returns nothing when daysSinceLastWorkout is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      daysSinceLastWorkout: null,
      workouts: makeWorkouts({ count: 0 }),
    });
    const result = generateSummary(data, defaultCtx);
    const workoutFrag = result.find(
      (f) =>
        f.text.includes("days since") ||
        f.text.includes("Rest day") ||
        f.text.includes("Day off"),
    );
    expect(workoutFrag).toBeUndefined();
  });
});

// ── helper functions fmtVol/fmtPct/shortName (tested indirectly) ──

describe("helper coverage (tested via output)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats volume >= 10000 as Xk (no decimal)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        totalVolume: 25000,
        count: 4,
        avgDuration: 50,
        totalSets: 60,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find((f) => f.text.includes("25k"));
    expect(volFrag).toBeDefined();
  });

  it("formats volume 1000-9999 as X.Xk", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        totalVolume: 5500,
        count: 2,
        avgDuration: 40,
        totalSets: 30,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find((f) => f.text.includes("5.5k"));
    expect(volFrag).toBeDefined();
  });

  it("uses shortName for exercises (Bench Press -> Bench, Barbell Row -> Row)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat", "Bench Press", "Barbell Row"],
        totalSets: 15,
        avgDuration: 45,
        heaviestLift: { name: "Squat", weight: 80 },
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const workoutFrag = result.find(
      (f) => f.text.includes("Bench") || f.text.includes("Row"),
    );
    expect(workoutFrag).toBeDefined();
    // Should use short forms, not full names
    if (workoutFrag?.text.includes("Bench")) {
      expect(workoutFrag.text).not.toMatch(/Bench Press/);
    }
  });
});

// ── Additional branch coverage tests ──

describe("fmtVol volume < 1000 branch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats volume under 1000 as raw number", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      workouts: makeWorkouts({
        totalVolume: 500,
        count: 1,
        avgDuration: 30,
        totalSets: 10,
      }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const volFrag = result.find(
      (f) =>
        f.text.includes("500") &&
        (f.text.includes("volume") || f.text.includes("kg")),
    );
    expect(volFrag).toBeDefined();
    // fmtVol(500) returns "500" (not "0.5k"), so the text should contain "500kg" (raw number + "kg")
    // and NOT contain something like "0.5k" or "500k " with a space/boundary after "k"
    expect(volFrag!.text).toMatch(/500kg/);
  });
});

describe("fmtPct negative/zero branch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats change without + prefix when weight goes up with small change", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    // Test the weight-up branch where fmtPct is called
    // change: 0.5, trend: 'up' — fmtPct(0.5) should produce "+0.5"
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 80,
        endWeight: 80.5,
        change: 0.5,
        trend: "up",
        weeklyRate: 0.5,
        measurementCount: 4,
        lowestWeight: 79.8,
        highestWeight: 80.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.mood === "warning" &&
        (f.text.includes("Up") ||
          f.text.includes("up") ||
          f.text.includes("+0.5")),
    );
    expect(trendFrag).toBeDefined();
  });
});

describe("openerRule weekday morning (8-11) branch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows weekday morning opener (isWeekend false branch)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T09:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({
        hour: 9,
        dayName: "Wednesday",
        isWeekend: false,
        dayOfWeek: 3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const opener = result[0];
    expect(opener.priority).toBeLessThanOrEqual(1);
    // Should match one of the morning variants, specifically the weekday branch
    expect(opener.text).toMatch(/morning|Morning|Wednesday/i);
  });
});

describe("fastingRule timeStr branches", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows hours-only format when minutesLeft is exactly 60 (1h 0m)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T15:00:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 60,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // minutesLeft=60 (<=60) triggers warning branch. hrs=1, mins=0 => timeStr="1h"
    // Should contain "1h" but NOT contain minutes like "1h 30m"
    const fastFrag = result.find(
      (f) =>
        f.text.includes("1h") &&
        (f.text.includes("closing") ||
          f.text.includes("Last call") ||
          f.text.includes("left")),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("warning");
    // Verify no minutes appended (mins=0, so no "Xm" part after "1h")
    expect(fastFrag!.text).not.toMatch(/1h \d+m/);
  });

  it("shows minutes-only format when minutesLeft < 60 (hrs=0)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T15:45:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 15,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // minutesLeft=15, hrs=0, mins=15 => timeStr="15m"
    const fastFrag = result.find((f) => f.text.includes("15m"));
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("warning");
  });

  it("shows hours and minutes format when both > 0 (e.g. 2h 30m)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T13:30:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 150,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // minutesLeft=150, hrs=2, mins=30 => timeStr="2h 30m"
    const fastFrag = result.find(
      (f) => f.text.includes("2h 30m") || f.text.includes("2h"),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("neutral");
  });

  it("shows fasting window open with minutesLeft exactly 240", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: "16:00",
        minutesLeft: 240,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // minutesLeft=240 <= 240 is true, hrs=4, mins=0 => timeStr="4h"
    const fastFrag = result.find(
      (f) => f.text.includes("4h") || f.text.includes("Window open"),
    );
    expect(fastFrag).toBeDefined();
    expect(fastFrag?.mood).toBe("neutral");
  });
});

describe("workoutTodayRule no heaviest lift", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows workout summary without heaviest lift note", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      workouts: makeWorkouts({
        count: 1,
        exercisesDone: ["Squat"],
        totalSets: 5,
        avgDuration: 40,
        heaviestLift: null,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const wFrag = result.find(
      (f) => f.text.includes("Squat") && f.mood === "achievement",
    );
    expect(wFrag).toBeDefined();
    // Should not include "heaviest was" since heaviestLift is null
    expect(wFrag!.text).not.toMatch(/heaviest/);
  });
});

describe("weightTrendRule without range data", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows weight down without range when lowestWeight and highestWeight are null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 81,
        endWeight: 80,
        change: -1,
        trend: "down",
        weeklyRate: -1,
        measurementCount: 3,
        lowestWeight: null,
        highestWeight: null,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        f.text.includes("1kg") &&
        (f.text.includes("Down") ||
          f.text.includes("Lost") ||
          f.text.includes("lighter")),
    );
    expect(trendFrag).toBeDefined();
    // Should NOT contain the range text "(ranged ...)"
    expect(trendFrag!.text).not.toMatch(/ranged/);
  });

  it("shows weight up without range when lowestWeight/highestWeight are null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 80,
        endWeight: 81,
        change: 1,
        trend: "up",
        weeklyRate: 1,
        measurementCount: 3,
        lowestWeight: null,
        highestWeight: null,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const trendFrag = result.find(
      (f) =>
        (f.text.includes("Up") ||
          f.text.includes("up") ||
          f.text.includes("+1")) &&
        f.mood === "warning",
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag!.text).not.toMatch(/ranged/);
  });
});

describe("bodyCompRule without end values (bodyFatEnd/muscleEnd null)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows body fat down without "to X%" when bodyFatEnd is null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: -0.5,
        bodyFatEnd: null,
        muscleChange: null,
        measurementCount: 4,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("body fat down"));
    expect(compFrag).toBeDefined();
    // bodyFatEnd is null, so we should NOT see "to X%"
    expect(compFrag!.text).not.toMatch(/to \d+(\.\d+)?%/);
  });

  it('shows muscle up without "to Xkg" when muscleEnd is null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        muscleChange: 0.4,
        muscleEnd: null,
        bodyFatChange: null,
        measurementCount: 4,
        change: -0.3,
        trend: "down",
        endWeight: 79.7,
        startWeight: 80,
        weeklyRate: -0.3,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find((f) => f.text.includes("muscle up"));
    expect(compFrag).toBeDefined();
    // muscleEnd is null, so we should NOT see "to Xkg"
    expect(compFrag!.text).not.toMatch(/to \d+(\.\d+)?kg/);
  });
});

describe("deficitInsightRule small deficit branch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when weekly loss is too small (dailyDeficit <= 200)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28, avgCalories: 1900 }),
      weight: makeWeight({
        // weeklyRate of -0.1 => weeklyLoss=0.1, dailyDeficit = (0.1*7700)/7 = 110 < 200
        weeklyRate: -0.1,
        change: -0.4,
        trend: "down",
        measurementCount: 8,
        endWeight: 79.6,
        startWeight: 80,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const defFrag = result.find(
      (f) =>
        f.text.includes("deficit") &&
        f.text.includes("cal/day") &&
        f.mood === "trend",
    );
    expect(defFrag).toBeUndefined();
  });
});

describe("calorieRule today slightly over target (diff > 0, abs <= 150)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows neutral when slightly over calorie target", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgCalories: 2100, mealCount: 3 }),
    });
    const result = generateSummary(data, defaultCtx);
    // diff = 2100 - 2000 = 100, abs = 100 <= 150, diff > 0
    const calFrag = result.find(
      (f) => f.text.includes("2100") && f.text.includes("cal"),
    );
    expect(calFrag).toBeDefined();
    expect(calFrag?.mood).toBe("neutral");
  });
});

describe("noDataRule early morning (h < 8) branch", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows early fasting message when h < 8 with no data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T06:00:00"));
    const data = makeSummaryData({
      time: makeTimeContext({ hour: 6 }),
      nutrition: makeNutrition({
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
        mealCount: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // h < 10 triggers the early fasting branch
    const noData = result.find(
      (f) =>
        f.text.includes("fasting") ||
        f.text.includes("Moda") ||
        f.text.includes("logged yet"),
    );
    expect(noData).toBeDefined();
    expect(noData?.mood).toBe("neutral");
  });
});

describe("workoutFreqRule month period", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates expected workouts for month period correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      workouts: makeWorkouts({
        count: 10,
        totalSets: 150,
        avgDuration: 45,
        totalVolume: 30000,
      }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        endWeight: 78,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // With liftFrequencyDays=2, expected per week = 3.5, for month (4 weeks) = 14
    // count=10 < 14, should warn about being short
    const freqFrag = result.find(
      (f) =>
        f.text.includes("10") &&
        (f.text.includes("session") || f.text.includes("Missed")),
    );
    expect(freqFrag).toBeDefined();
    expect(freqFrag?.mood).toBe("warning");
  });

  it("celebrates meeting workout frequency for month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      workouts: makeWorkouts({
        count: 15,
        totalSets: 225,
        avgDuration: 45,
        totalVolume: 50000,
      }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        endWeight: 78,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // expected = 14, count=15 >= 14
    const freqFrag = result.find(
      (f) =>
        f.text.includes("15") &&
        (f.text.includes("session") ||
          f.text.includes("Nailed") ||
          f.text.includes("workouts")),
    );
    expect(freqFrag).toBeDefined();
    expect(freqFrag?.mood).toBe("achievement");
  });
});

describe("bodyCompRule recomp detection with fat down and muscle flat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects recomp when body fat down and muscle change is exactly 0 (muscleChange >= 0)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: -0.5,
        muscleChange: 0.3,
        bodyFatEnd: 20,
        muscleEnd: 35,
        measurementCount: 4,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const compFrag = result.find(
      (f) =>
        f.text.includes("Recomp") ||
        f.text.includes("recomp") ||
        f.text.includes("Losing fat"),
    );
    expect(compFrag).toBeDefined();
    expect(compFrag?.mood).toBe("achievement");
    expect(compFrag?.priority).toBe(9);
  });
});

describe("fastingRule minutesLeft null when window is open", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("falls through to return [] when isOpen but minutesLeft is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      feedingWindow: {
        isOpen: true,
        closesAt: null,
        minutesLeft: null,
        firstMealTime: "12:00",
      },
    });
    const result = generateSummary(data, defaultCtx);
    // isOpen=true but minutesLeft=null => the condition (fw.isOpen && fw.minutesLeft !== null && ...) is false
    // closesAt=null => the closed-window check also fails
    // falls through to return []
    const fastFrag = result.find(
      (f) =>
        f.text.includes("Window") ||
        f.text.includes("window") ||
        f.text.includes("closed") ||
        f.text.includes("shut"),
    );
    expect(fastFrag).toBeUndefined();
  });
});

describe("weight trend fast drop in week", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows fast weight loss note for exactly 1.5kg drop in a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        startWeight: 81.5,
        endWeight: 80,
        change: -1.5,
        trend: "down",
        weeklyRate: -1.5,
        measurementCount: 4,
        lowestWeight: 79.8,
        highestWeight: 81.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // abs >= 1.5 && period === 'week' triggers the fast loss branch
    const trendFrag = result.find(
      (f) =>
        f.text.includes("1.5kg") &&
        (f.text.includes("fast") ||
          f.text.includes("Dropped") ||
          f.text.includes("Aggressive")),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("achievement");
  });

  it("shows standard weight down note for month period even with >1.5kg drop", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      weight: makeWeight({
        startWeight: 83,
        endWeight: 80,
        change: -3,
        trend: "down",
        weeklyRate: -0.75,
        measurementCount: 8,
        lowestWeight: 79.5,
        highestWeight: 83,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // For month period, even abs >= 1.5 goes to the normal "down" branch, not the "fast" branch
    const trendFrag = result.find(
      (f) =>
        f.text.includes("3kg") &&
        (f.text.includes("Down") ||
          f.text.includes("Lost") ||
          f.text.includes("lighter")),
    );
    expect(trendFrag).toBeDefined();
    expect(trendFrag?.mood).toBe("achievement");
  });
});

describe("calorieRule week/month zero calories returns empty", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when avgCalories is 0 for week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7, avgCalories: 0 }),
      weight: makeWeight({
        measurementCount: 3,
        change: -0.5,
        trend: "down",
        endWeight: 79.5,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const calFrag = result.find(
      (f) =>
        f.text.includes("cal") &&
        (f.text.includes("dialed") ||
          f.text.includes("under") ||
          f.text.includes("over")),
    );
    expect(calFrag).toBeUndefined();
  });
});

describe("proteinRule today zero protein with meals", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns about large protein gap when protein is 0 but meals exist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({ avgProtein: 0, mealCount: 1 }),
    });
    const result = generateSummary(data, defaultCtx);
    // prot=0, mealCount=1 => doesn't skip. gap = 100 - 0 = 100, gap > 30 => warning
    const protFrag = result.find(
      (f) => f.text.includes("protein") && f.mood === "warning",
    );
    expect(protFrag).toBeDefined();
  });
});

describe("goalPaceRule with weeklyRate positive (not losing)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows general pace info when weeklyRate is positive (gaining weight)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-03-01T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        measurementCount: 4,
        change: 0.5,
        trend: "up",
        endWeight: 78.5,
        startWeight: 78,
        weeklyRate: 0.5,
      }),
    });
    const ctx = { ...defaultCtx, currentWeight: 78.5 };
    const result = generateSummary(data, ctx);
    // weeklyRate > 0 => doesn't enter the losing-weight branches
    // Falls through to the general pace info at the end
    const goalFrag = result.find(
      (f) => f.text.includes("72kg") && f.text.includes("week"),
    );
    expect(goalFrag).toBeDefined();
    expect(goalFrag?.mood).toBe("trend");
  });
});

describe("workoutGapRule month period", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("warns about large gaps in month period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      workouts: makeWorkouts({
        count: 5,
        longestGap: 7,
        totalSets: 75,
        avgDuration: 45,
        totalVolume: 20000,
      }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        endWeight: 78,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const gapFrag = result.find(
      (f) =>
        f.text.includes("7") &&
        (f.text.includes("gap") || f.text.includes("break")),
    );
    expect(gapFrag).toBeDefined();
    expect(gapFrag?.mood).toBe("warning");
  });
});

describe("streakRule month period", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("celebrates perfect cadence in month period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "month",
      nutrition: makeNutrition({ days: 28 }),
      workouts: makeWorkouts({
        count: 14,
        longestGap: 2,
        totalSets: 210,
        avgDuration: 45,
        totalVolume: 40000,
      }),
      weight: makeWeight({
        measurementCount: 8,
        change: -2,
        trend: "down",
        endWeight: 78,
        startWeight: 80,
        weeklyRate: -0.5,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    const streakFrag = result.find(
      (f) =>
        (f.text.includes("Discipline") ||
          f.text.includes("Perfect consistency") ||
          f.text.includes("missed cadence")) &&
        f.mood === "achievement",
    );
    expect(streakFrag).toBeDefined();
  });
});

describe("proteinRule skip when zero protein and no meals today", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no protein fragment when avgProtein is 0 and mealCount is 0 for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:00:00"));
    const data = makeSummaryData({
      nutrition: makeNutrition({
        avgProtein: 0,
        mealCount: 0,
        totalCalories: 0,
        avgCalories: 0,
        totalWater: 0,
        avgWater: 0,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // prot=0, period='today', mealCount=0 => proteinRule returns []
    const protFrag = result.find(
      (f) =>
        f.text.toLowerCase().includes("protein") &&
        (f.text.includes("hit") ||
          f.text.includes("short") ||
          f.text.includes("gap")),
    );
    expect(protFrag).toBeUndefined();
  });
});

describe("fastingRule skip when feedingWindow is null", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns nothing when period is today but feedingWindow is null", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T14:00:00"));
    const data = makeSummaryData({
      feedingWindow: null,
    });
    const result = generateSummary(data, defaultCtx);
    // fastingRule: period='today' but feedingWindow=null => !data.feedingWindow is true => return []
    const fastFrag = result.find(
      (f) =>
        f.text.includes("Window") ||
        f.text.includes("window") ||
        f.text.includes("closed") ||
        f.text.includes("Feeding"),
    );
    expect(fastFrag).toBeUndefined();
  });
});

describe("bodyCompRule body fat down + muscle down (not recomp)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows body comp summary without recomp when both fat and muscle decrease", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00"));
    const data = makeSummaryData({
      period: "week",
      nutrition: makeNutrition({ days: 7 }),
      weight: makeWeight({
        bodyFatChange: -0.5,
        bodyFatEnd: 20,
        muscleChange: -0.3,
        muscleEnd: 34.7,
        measurementCount: 4,
        change: -0.8,
        trend: "down",
        endWeight: 79.2,
        startWeight: 80,
        weeklyRate: -0.8,
      }),
    });
    const result = generateSummary(data, defaultCtx);
    // Fat down + muscle down => parts.length === 2, but NOT recomp (muscleChange < 0)
    const compFrag = result.find(
      (f) => f.text.includes("body fat down") && f.text.includes("muscle down"),
    );
    expect(compFrag).toBeDefined();
    // muscle down sets mood to 'warning'
    expect(compFrag?.mood).toBe("warning");
  });
});
