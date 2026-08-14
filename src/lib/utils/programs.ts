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

// Evidence-based hypertrophy: each muscle trained 2-3×/week, ~10-20 hard sets
// per muscle per week, 6-12 reps on compounds and 12-15 on isolation work.
const hypertrophyFullBody: Program = {
  name: "Hypertrophy Full Body (3-Day)",
  alternating: false,
  workouts: {
    A: {
      name: "Full Body A (Squat)",
      exercises: [
        {
          name: "Squat",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Bench Press",
          sets: 4,
          reps: 8,
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
        {
          name: "Dumbbell Shoulder Press",
          sets: 3,
          reps: 10,
          increment_kg: 2,
          isCompound: true,
        },
        {
          name: "Leg Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Bicep Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2,
          isCompound: false,
        },
      ],
    },
    B: {
      name: "Full Body B (Hinge)",
      exercises: [
        {
          name: "Romanian Deadlift",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Incline Dumbbell Press",
          sets: 4,
          reps: 10,
          increment_kg: 2,
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
          name: "Leg Press",
          sets: 3,
          reps: 12,
          increment_kg: 5,
          isCompound: false,
        },
        {
          name: "Lateral Raises",
          sets: 3,
          reps: 15,
          increment_kg: 1,
          isCompound: false,
        },
        {
          name: "Tricep Pushdown",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    C: {
      name: "Full Body C (Pull)",
      exercises: [
        {
          name: "Deadlift",
          sets: 3,
          reps: 6,
          increment_kg: 5,
          isCompound: true,
        },
        {
          name: "Overhead Press",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Barbell Row",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Leg Extension",
          sets: 3,
          reps: 15,
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

const hypertrophyPPLUL: Program = {
  name: "Hypertrophy PPL + Upper/Lower (5-Day)",
  alternating: false,
  workouts: {
    A: {
      name: "Push",
      exercises: [
        {
          name: "Bench Press",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Dumbbell Shoulder Press",
          sets: 3,
          reps: 10,
          increment_kg: 2,
          isCompound: true,
        },
        {
          name: "Incline Dumbbell Press",
          sets: 3,
          reps: 10,
          increment_kg: 2,
          isCompound: true,
        },
        {
          name: "Lateral Raises",
          sets: 3,
          reps: 15,
          increment_kg: 1,
          isCompound: false,
        },
        {
          name: "Tricep Pushdown",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    B: {
      name: "Pull",
      exercises: [
        {
          name: "Barbell Row",
          sets: 4,
          reps: 8,
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
        {
          name: "Cable Row",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Face Pulls",
          sets: 3,
          reps: 15,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Bicep Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2,
          isCompound: false,
        },
      ],
    },
    C: {
      name: "Legs",
      exercises: [
        {
          name: "Squat",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Romanian Deadlift",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Leg Press",
          sets: 3,
          reps: 12,
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
        {
          name: "Calf Raises",
          sets: 4,
          reps: 15,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    D: {
      name: "Upper",
      exercises: [
        {
          name: "Overhead Press",
          sets: 4,
          reps: 8,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Bench Press",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: true,
        },
        {
          name: "Lat Pulldown",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Cable Row",
          sets: 3,
          reps: 10,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Bicep Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2,
          isCompound: false,
        },
        {
          name: "Tricep Pushdown",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
      ],
    },
    E: {
      name: "Lower",
      exercises: [
        {
          name: "Deadlift",
          sets: 3,
          reps: 6,
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
          reps: 15,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Leg Curl",
          sets: 3,
          reps: 12,
          increment_kg: 2.5,
          isCompound: false,
        },
        {
          name: "Calf Raises",
          sets: 4,
          reps: 15,
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
  hypertrophy3: hypertrophyFullBody,
  hypertrophy5: hypertrophyPPLUL,
};

export function getProgram(name: string): Program {
  return programs[name] ?? stronglifts;
}

export function getNextWorkoutType(
  lastType: WorkoutType | null,
  programName: string = "custom",
): WorkoutType {
  const program = programs[programName] ?? stronglifts;
  const order = Object.keys(program.workouts) as WorkoutType[];
  if (lastType === null) return order[0];
  const idx = order.indexOf(lastType);
  if (idx === -1) return order[0];
  return order[(idx + 1) % order.length];
}

export function getAllPrograms(): Program[] {
  return Object.values(programs);
}
