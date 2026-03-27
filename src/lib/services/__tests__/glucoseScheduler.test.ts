import { describe, it, expect } from "vitest";
import {
  generateSchedule,
  nextDueReading,
  readingTypeForTime,
  type ScheduledReading,
  type ScheduleContext,
} from "$lib/services/glucoseScheduler";
import { makeFoodEntry, makeGlucoseReading } from "../../../test/fixtures";

// ── Helpers ──

function makeContext(
  overrides: Partial<ScheduleContext> = {},
): ScheduleContext {
  return {
    meals: [],
    existingReadings: [],
    fastBrokenAt: null,
    stripsRemaining: 50,
    nowMin: 12 * 60,
    ...overrides,
  };
}

// ── generateSchedule ──

describe("generateSchedule", () => {
  it("includes fasting reading when fast not broken", () => {
    const schedule = generateSchedule(makeContext());
    const fasting = schedule.find((s) => s.type === "fasting");
    expect(fasting).toBeDefined();
    expect(fasting!.priority).toBe(1);
  });

  it("includes fasting reading before first meal when fast broken", () => {
    const schedule = generateSchedule(makeContext({ fastBrokenAt: "12:00" }));
    const fasting = schedule.find((s) => s.type === "fasting");
    expect(fasting).toBeDefined();
    expect(fasting!.timeMin).toBeLessThanOrEqual(12 * 60);
  });

  it("generates post-meal readings for each meal", () => {
    const meals = [
      makeFoodEntry({ time: "12:00", name: "Lunch" }),
      makeFoodEntry({ time: "16:00", name: "Dinner" }),
    ];
    const schedule = generateSchedule(makeContext({ meals }));
    const pm30 = schedule.filter((s) => s.type === "post_meal_30");
    expect(pm30).toHaveLength(2);
    expect(pm30[0].timeMin).toBe(12 * 60 + 30);
    expect(pm30[1].timeMin).toBe(16 * 60 + 30);
  });

  it("includes post_meal_60 and post_meal_120 for each meal", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    const schedule = generateSchedule(makeContext({ meals }));
    expect(schedule.filter((s) => s.type === "post_meal_60")).toHaveLength(1);
    expect(schedule.filter((s) => s.type === "post_meal_120")).toHaveLength(1);
  });

  it("includes bedtime reading", () => {
    const schedule = generateSchedule(makeContext());
    const bedtime = schedule.find((s) => s.type === "bedtime");
    expect(bedtime).toBeDefined();
    expect(bedtime!.priority).toBe(5);
    expect(bedtime!.timeMin).toBe(21 * 60 + 30);
  });

  it("marks readings as taken when existing reading matches", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    const existingReadings = [
      makeGlucoseReading({ time: "12:30" }), // matches post_meal_30
    ];
    const schedule = generateSchedule(makeContext({ meals, existingReadings }));
    const pm30 = schedule.find((s) => s.type === "post_meal_30");
    expect(pm30!.taken).toBe(true);
  });

  it("matches readings within 15min tolerance", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    const existingReadings = [
      makeGlucoseReading({ time: "12:40" }), // within 15 min of 12:30
    ];
    const schedule = generateSchedule(makeContext({ meals, existingReadings }));
    const pm30 = schedule.find((s) => s.type === "post_meal_30");
    expect(pm30!.taken).toBe(true);
  });

  it("does not match readings outside tolerance", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    const existingReadings = [
      makeGlucoseReading({ time: "13:00" }), // 30 min from 12:30, outside 15min
    ];
    const schedule = generateSchedule(makeContext({ meals, existingReadings }));
    const pm30 = schedule.find((s) => s.type === "post_meal_30");
    expect(pm30!.taken).toBe(false);
  });

  it("strip conservation: <10 strips shows only P1-2", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    const schedule = generateSchedule(
      makeContext({ meals, stripsRemaining: 8 }),
    );
    const untaken = schedule.filter((s) => !s.taken);
    // Should have fasting + post_meal_30 only
    expect(untaken.every((s) => s.priority <= 2)).toBe(true);
  });

  it("strip conservation: <5 strips shows fasting + one post_meal_30", () => {
    const meals = [
      makeFoodEntry({ time: "12:00" }),
      makeFoodEntry({ time: "16:00" }),
    ];
    const schedule = generateSchedule(
      makeContext({ meals, stripsRemaining: 3 }),
    );
    const untaken = schedule.filter((s) => !s.taken);
    const types = untaken.map((s) => s.type);
    expect(types.includes("fasting")).toBe(true);
    // At most one post_meal_30
    expect(
      untaken.filter((s) => s.type === "post_meal_30").length,
    ).toBeLessThanOrEqual(1);
  });

  it('uses meal name in reason or defaults to "meal"', () => {
    const meals = [
      makeFoodEntry({ time: "12:00", name: "Lunch" }),
      makeFoodEntry({ time: "16:00", name: "" }),
    ];
    const schedule = generateSchedule(makeContext({ meals }));
    const pm30 = schedule.filter((s) => s.type === "post_meal_30");
    expect(pm30.some((s) => s.reason.includes("Lunch"))).toBe(true);
    expect(pm30.some((s) => s.reason.includes("meal"))).toBe(true);
    const pm60 = schedule.filter((s) => s.type === "post_meal_60");
    expect(pm60.some((s) => s.reason.includes("meal"))).toBe(true);
    const pm120 = schedule.filter((s) => s.type === "post_meal_120");
    expect(pm120.some((s) => s.reason.includes("meal"))).toBe(true);
  });

  it("returns sorted by time", () => {
    const meals = [
      makeFoodEntry({ time: "16:00" }),
      makeFoodEntry({ time: "12:00" }),
    ];
    const schedule = generateSchedule(
      makeContext({ meals, stripsRemaining: 50 }),
    );
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].timeMin).toBeGreaterThanOrEqual(
        schedule[i - 1].timeMin,
      );
    }
  });
});

// ── nextDueReading ──

describe("nextDueReading", () => {
  it("returns null for empty schedule", () => {
    expect(nextDueReading([], 12 * 60)).toBeNull();
  });

  it("returns null when no readings are due", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 15 * 60,
        type: "post_meal_30",
        priority: 2,
        reason: "",
        taken: false,
      },
    ];
    expect(nextDueReading(schedule, 12 * 60)).toBeNull();
  });

  it("returns reading within window (±15/+5)", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 12 * 60 + 30,
        type: "post_meal_30",
        priority: 2,
        reason: "",
        taken: false,
      },
    ];
    // 12:25 → 5 min before target, within 15min early window
    expect(nextDueReading(schedule, 12 * 60 + 25)).not.toBeNull();
  });

  it("skips taken readings", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 12 * 60 + 30,
        type: "post_meal_30",
        priority: 2,
        reason: "",
        taken: true,
      },
    ];
    expect(nextDueReading(schedule, 12 * 60 + 30)).toBeNull();
  });

  it("returns highest priority when multiple are due", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 12 * 60,
        type: "post_meal_60",
        priority: 3,
        reason: "",
        taken: false,
      },
      {
        timeMin: 12 * 60,
        type: "fasting",
        priority: 1,
        reason: "",
        taken: false,
      },
    ];
    const result = nextDueReading(schedule, 12 * 60);
    expect(result!.type).toBe("fasting");
  });

  it("respects late window boundary", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 12 * 60,
        type: "post_meal_30",
        priority: 2,
        reason: "",
        taken: false,
      },
    ];
    // 16 min after → outside +5 and also outside -15 early window
    expect(nextDueReading(schedule, 12 * 60 + 16)).toBeNull();
  });

  it("respects early window boundary", () => {
    const schedule: ScheduledReading[] = [
      {
        timeMin: 12 * 60 + 30,
        type: "post_meal_30",
        priority: 2,
        reason: "",
        taken: false,
      },
    ];
    // 16 min early → outside 15min early window
    expect(nextDueReading(schedule, 12 * 60 + 14)).toBeNull();
  });
});

// ── readingTypeForTime ──

describe("readingTypeForTime", () => {
  it("returns fasting before fast is broken", () => {
    expect(readingTypeForTime(8 * 60, [], null)).toBe("fasting");
  });

  it("returns fasting before first meal", () => {
    expect(readingTypeForTime(10 * 60, [], "12:00")).toBe("fasting");
  });

  it("returns post_meal_30 at 20-40 min after meal", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    expect(readingTypeForTime(12 * 60 + 30, meals, "12:00")).toBe(
      "post_meal_30",
    );
    expect(readingTypeForTime(12 * 60 + 25, meals, "12:00")).toBe(
      "post_meal_30",
    );
  });

  it("returns post_meal_60 at 50-75 min after meal", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    expect(readingTypeForTime(12 * 60 + 60, meals, "12:00")).toBe(
      "post_meal_60",
    );
  });

  it("returns post_meal_120 at 100-140 min after meal", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    expect(readingTypeForTime(12 * 60 + 120, meals, "12:00")).toBe(
      "post_meal_120",
    );
  });

  it("returns pre_meal up to 15 min before meal", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    expect(readingTypeForTime(11 * 60 + 50, meals, "10:00")).toBe("pre_meal");
  });

  it("returns bedtime after 9pm", () => {
    expect(readingTypeForTime(21 * 60 + 30, [], "12:00")).toBe("bedtime");
  });

  it("returns random for unclassifiable time", () => {
    const meals = [makeFoodEntry({ time: "12:00" })];
    expect(readingTypeForTime(15 * 60, meals, "12:00")).toBe("random");
  });
});
