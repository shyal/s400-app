import { describe, it, expect } from "vitest";
import {
  calculateProgression,
  roundToNearest,
  kgToLb,
  lbToKg,
  formatWeight,
  formatWeightRange,
  epleyE1RM,
  getMaxSetWeight,
  getAvgSetWeight,
} from "$lib/utils/progression";
import { makeExerciseProgress } from "../../../test/fixtures";

describe("calculateProgression", () => {
  it("resets failure count on success", () => {
    const current = makeExerciseProgress({ weight_kg: 60, failureCount: 2 });
    const result = calculateProgression(current, true, 2.5);
    expect(result.failureCount).toBe(0);
    expect(result.weight_kg).toBe(60); // weight doesn't change until next workout
  });

  it("increments failure count on failure", () => {
    const current = makeExerciseProgress({ weight_kg: 60, failureCount: 0 });
    const result = calculateProgression(current, false, 2.5);
    expect(result.failureCount).toBe(1);
    expect(result.weight_kg).toBe(60);
  });

  it("deloads at 3 consecutive failures", () => {
    const current = makeExerciseProgress({ weight_kg: 60, failureCount: 2 });
    const result = calculateProgression(current, false, 2.5);
    expect(result.failureCount).toBe(0);
    // 60 * 0.9 = 54, rounded to nearest 2.5 = 55
    expect(result.weight_kg).toBe(55);
  });

  it("deloads and rounds correctly for heavier weights", () => {
    const current = makeExerciseProgress({ weight_kg: 100, failureCount: 2 });
    const result = calculateProgression(current, false, 2.5);
    // 100 * 0.9 = 90, rounded to nearest 2.5 = 90
    expect(result.weight_kg).toBe(90);
    expect(result.failureCount).toBe(0);
  });

  it("keeps same weight on first or second failure", () => {
    const current = makeExerciseProgress({ weight_kg: 80, failureCount: 1 });
    const result = calculateProgression(current, false, 2.5);
    expect(result.weight_kg).toBe(80);
    expect(result.failureCount).toBe(2);
  });

  it("preserves exercise name", () => {
    const current = makeExerciseProgress({ name: "Squat", weight_kg: 60 });
    const result = calculateProgression(current, true, 2.5);
    expect(result.name).toBe("Squat");
  });
});

describe("roundToNearest", () => {
  it("rounds to nearest 2.5", () => {
    expect(roundToNearest(53, 2.5)).toBe(52.5);
    expect(roundToNearest(54, 2.5)).toBe(55);
    expect(roundToNearest(55, 2.5)).toBe(55);
  });

  it("rounds to nearest 5", () => {
    expect(roundToNearest(53, 5)).toBe(55);
    expect(roundToNearest(52, 5)).toBe(50);
  });

  it("handles exact multiples", () => {
    expect(roundToNearest(50, 2.5)).toBe(50);
  });
});

describe("kgToLb / lbToKg", () => {
  it("converts kg to lb", () => {
    expect(kgToLb(100)).toBeCloseTo(220.5, 0);
  });

  it("converts lb to kg", () => {
    expect(lbToKg(220)).toBeCloseTo(99.8, 0);
  });

  it("roundtrips approximately", () => {
    const original = 80;
    const converted = lbToKg(kgToLb(original));
    expect(converted).toBeCloseTo(original, 0);
  });
});

describe("formatWeight", () => {
  it("formats kg", () => {
    expect(formatWeight(60, "kg")).toBe("60 kg");
  });

  it("formats lb", () => {
    expect(formatWeight(60, "lb")).toBe(`${kgToLb(60)} lb`);
  });
});

describe("formatWeightRange", () => {
  it("returns fallback for empty sets", () => {
    expect(formatWeightRange([], 20, "kg")).toBe("20 kg");
  });

  it("returns single weight when all sets same", () => {
    const sets = [{ weight_kg: 60 }, { weight_kg: 60 }];
    expect(formatWeightRange(sets, 0, "kg")).toBe("60 kg");
  });

  it("returns range when weights differ", () => {
    const sets = [{ weight_kg: 50 }, { weight_kg: 60 }, { weight_kg: 55 }];
    expect(formatWeightRange(sets, 0, "kg")).toBe("50-60 kg");
  });

  it("converts range to lb", () => {
    const sets = [{ weight_kg: 50 }, { weight_kg: 60 }];
    const result = formatWeightRange(sets, 0, "lb");
    expect(result).toContain("lb");
    expect(result).toContain("-");
  });
});

describe("epleyE1RM", () => {
  it("returns 0 for 0 reps", () => {
    expect(epleyE1RM(100, 0)).toBe(0);
  });

  it("returns 0 for 0 weight", () => {
    expect(epleyE1RM(0, 5)).toBe(0);
  });

  it("returns weight itself for 1 rep", () => {
    expect(epleyE1RM(100, 1)).toBe(100);
  });

  it("calculates correctly for multi-rep sets", () => {
    // 100 * (1 + 5/30) = 100 * 1.1667 ≈ 116.7
    expect(epleyE1RM(100, 5)).toBeCloseTo(116.7, 0);
  });
});

describe("getMaxSetWeight", () => {
  it("returns fallback for empty sets", () => {
    expect(getMaxSetWeight([], 20)).toBe(20);
  });

  it("returns max weight", () => {
    const sets = [{ weight_kg: 50 }, { weight_kg: 60 }, { weight_kg: 55 }];
    expect(getMaxSetWeight(sets, 0)).toBe(60);
  });
});

describe("getAvgSetWeight", () => {
  it("returns fallback for empty sets", () => {
    expect(getAvgSetWeight([], 20)).toBe(20);
  });

  it("returns average weight", () => {
    const sets = [{ weight_kg: 50 }, { weight_kg: 60 }, { weight_kg: 55 }];
    expect(getAvgSetWeight(sets, 0)).toBe(55);
  });
});
