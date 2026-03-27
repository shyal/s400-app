import type { Program, ProgramDay, WorkoutType } from "$lib/types";

const stronglifts: Program = {
  name: "StrongLifts 5×5",
  alternating: true,
  workouts: {
    A: {
      name: "Workout A",
      exercises: [
        {
          name: "Squat",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Bench Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Barbell Row",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
      ],
    },
    B: {
      name: "Workout B",
      exercises: [
        {
          name: "Squat",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Overhead Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Deadlift",
          sets: 1,
          reps: 5,
          increment_kg: 5,
          isCompound: true,
        },
      ],
    },
  },
};

const upperLowerSplit: Program = {
  name: "Upper/Lower 4-Day Split",
  alternating: false,
  workouts: {
    A: {
      name: "Lower A (Squat)",
      exercises: [
        {
          name: "Squat",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Romanian Deadlift",
          sets: 3,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Leg Press",
          sets: 3,
          reps: 10,
          increment_kg: 5,
          isCompound: false,
        },
        {
          name: "Leg Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    B: {
      name: "Upper A (Bench)",
      exercises: [
        {
          name: "Bench Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Barbell Row",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Dumbbell Shoulder Press",
          sets: 3,
          reps: 8,
          increment_kg: 2,
          isCompound: true,
        },
        {
          name: "Lat Pulldown",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    C: {
      name: "Lower B (Deadlift)",
      exercises: [
        {
          name: "Deadlift",
          sets: 5,
          reps: 5,
          increment_kg: 5,
          isCompound: true,
        },
        {
          name: "Front Squat",
          sets: 3,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Leg Extension",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Calf Raises",
          sets: 3,
          reps: 15,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    D: {
      name: "Upper B (OHP)",
      exercises: [
        {
          name: "Overhead Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Cable Row",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Incline Dumbbell Press",
          sets: 3,
          reps: 8,
          increment_kg: 2,
          isCompound: true,
        },
        {
          name: "Face Pulls",
          sets: 3,
          reps: 15,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
  },
};

const lowerBackRecovery: Program = {
  name: "Lower Back Recovery",
  alternating: true,
  workouts: {
    A: {
      name: "Recovery A",
      exercises: [
        {
          name: "Goblet Squat",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Bench Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Chest-Supported DB Row",
          sets: 3,
          reps: 10,
          increment_kg: 2,
          isCompound: true,
        },
      ],
    },
    B: {
      name: "Recovery B",
      exercises: [
        {
          name: "Leg Press",
          sets: 3,
          reps: 10,
          increment_kg: 5,
          isCompound: true,
        },
        {
          name: "Overhead Press",
          sets: 5,
          reps: 5,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Lat Pulldown",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
  },
};

const programs: Record<string, Program> = {
  stronglifts,
  custom: upperLowerSplit,
  recovery: lowerBackRecovery,
};

export function getProgram(name: string): Program {
  return programs[name] ?? stronglifts;
}

export function getNextWorkoutType(
  lastType: WorkoutType | null,
  programName: string = "custom",
): WorkoutType {
  const program = programs[programName];

  // For 4-day split (Upper/Lower)
  if (program && Object.keys(program.workouts).length === 4) {
    if (lastType === null) return "A";
    if (lastType === "A") return "B";
    if (lastType === "B") return "C";
    if (lastType === "C") return "D";
    return "A"; // D -> A
  }

  // For 2-day alternating (StrongLifts classic)
  if (lastType === null) return "A";
  return lastType === "A" ? "B" : "A";
}

export function getAllPrograms(): Program[] {
  return Object.values(programs);
}
