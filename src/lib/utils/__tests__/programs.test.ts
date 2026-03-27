import { describe, it, expect } from "vitest";
import {
  getProgram,
  getNextWorkoutType,
  getAllPrograms,
} from "$lib/utils/programs";

describe("getProgram", () => {
  it("returns stronglifts by name", () => {
    const p = getProgram("stronglifts");
    expect(p.name).toBe("StrongLifts 5×5");
    expect(Object.keys(p.workouts)).toEqual(["A", "B"]);
  });

  it("returns custom (upper/lower) by name", () => {
    const p = getProgram("custom");
    expect(p.name).toBe("Upper/Lower 4-Day Split");
    expect(Object.keys(p.workouts)).toEqual(["A", "B", "C", "D"]);
  });

  it("returns recovery program by name", () => {
    const p = getProgram("recovery");
    expect(p.name).toBe("Lower Back Recovery");
    expect(Object.keys(p.workouts)).toEqual(["A", "B"]);
    expect(p.alternating).toBe(true);
  });

  it("has correct exercise definitions for recovery A", () => {
    const p = getProgram("recovery");
    const workoutA = p.workouts["A"];
    expect(workoutA.name).toBe("Recovery A");
    expect(workoutA.exercises).toHaveLength(3);
    expect(workoutA.exercises.map((e) => e.name)).toEqual([
      "Goblet Squat",
      "Bench Press",
      "Chest-Supported DB Row",
    ]);
    expect(workoutA.exercises[0].sets).toBe(3);
    expect(workoutA.exercises[0].reps).toBe(10);
  });

  it("has correct exercise definitions for recovery B", () => {
    const p = getProgram("recovery");
    const workoutB = p.workouts["B"];
    expect(workoutB.name).toBe("Recovery B");
    expect(workoutB.exercises).toHaveLength(3);
    expect(workoutB.exercises.map((e) => e.name)).toEqual([
      "Leg Press",
      "Overhead Press",
      "Lat Pulldown",
    ]);
    expect(workoutB.exercises[0].sets).toBe(3);
    expect(workoutB.exercises[0].reps).toBe(10);
  });

  it("recovery program has no deadlifts, squats, or barbell rows", () => {
    const p = getProgram("recovery");
    const allExercises = Object.values(p.workouts).flatMap((d) =>
      d.exercises.map((e) => e.name),
    );
    expect(allExercises).not.toContain("Squat");
    expect(allExercises).not.toContain("Deadlift");
    expect(allExercises).not.toContain("Barbell Row");
  });

  it("falls back to stronglifts for unknown name", () => {
    const p = getProgram("nonexistent");
    expect(p.name).toBe("StrongLifts 5×5");
  });

  it("has correct exercise definitions for stronglifts A", () => {
    const p = getProgram("stronglifts");
    const workoutA = p.workouts["A"];
    expect(workoutA.exercises).toHaveLength(3);
    expect(workoutA.exercises.map((e) => e.name)).toEqual([
      "Squat",
      "Bench Press",
      "Barbell Row",
    ]);
  });

  it("has correct exercise definitions for stronglifts B", () => {
    const p = getProgram("stronglifts");
    const workoutB = p.workouts["B"];
    expect(workoutB.exercises).toHaveLength(3);
    expect(workoutB.exercises.map((e) => e.name)).toEqual([
      "Squat",
      "Overhead Press",
      "Deadlift",
    ]);
    expect(workoutB.exercises[2].sets).toBe(1); // Deadlift is 1x5
    expect(workoutB.exercises[2].increment_kg).toBe(5);
  });
});

describe("getNextWorkoutType", () => {
  describe("2-day alternating (stronglifts)", () => {
    it("returns A for null (first workout)", () => {
      expect(getNextWorkoutType(null, "stronglifts")).toBe("A");
    });

    it("returns B after A", () => {
      expect(getNextWorkoutType("A", "stronglifts")).toBe("B");
    });

    it("returns A after B", () => {
      expect(getNextWorkoutType("B", "stronglifts")).toBe("A");
    });
  });

  describe("4-day split (custom)", () => {
    it("returns A for null (first workout)", () => {
      expect(getNextWorkoutType(null, "custom")).toBe("A");
    });

    it("cycles A -> B -> C -> D -> A", () => {
      expect(getNextWorkoutType("A", "custom")).toBe("B");
      expect(getNextWorkoutType("B", "custom")).toBe("C");
      expect(getNextWorkoutType("C", "custom")).toBe("D");
      expect(getNextWorkoutType("D", "custom")).toBe("A");
    });
  });

  describe("2-day alternating (recovery)", () => {
    it("returns A for null (first workout)", () => {
      expect(getNextWorkoutType(null, "recovery")).toBe("A");
    });

    it("alternates A <-> B", () => {
      expect(getNextWorkoutType("A", "recovery")).toBe("B");
      expect(getNextWorkoutType("B", "recovery")).toBe("A");
    });
  });

  it("defaults to custom program when no program specified", () => {
    // default is 'custom'
    expect(getNextWorkoutType("A")).toBe("B");
    expect(getNextWorkoutType("D")).toBe("A");
  });
});

describe("getAllPrograms", () => {
  it("returns all available programs", () => {
    const programs = getAllPrograms();
    expect(programs.length).toBeGreaterThanOrEqual(3);
    expect(programs.map((p) => p.name)).toContain("StrongLifts 5×5");
    expect(programs.map((p) => p.name)).toContain("Upper/Lower 4-Day Split");
    expect(programs.map((p) => p.name)).toContain("Lower Back Recovery");
  });
});
