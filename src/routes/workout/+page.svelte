<script lang="ts">
  import { workoutStore } from "$lib/stores/workout.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { timerStore } from "$lib/stores/timer.svelte";
  import { getProgram, getNextWorkoutType } from "$lib/utils/programs";
  import { formatWeight } from "$lib/utils/progression";
  import ExerciseCard from "$lib/components/ExerciseCard.svelte";
  import Timer from "$lib/components/Timer.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Progress } from "$lib/components/ui/progress";
  import { Separator } from "$lib/components/ui/separator";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import PlayIcon from "@lucide/svelte/icons/play";
  import CheckCircle2Icon from "@lucide/svelte/icons/circle-check-big";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import TargetIcon from "@lucide/svelte/icons/target";

  let showFinishDialog = $state(false);
  let showCancelDialog = $state(false);

  const program = $derived(getProgram(settingsStore.value.program));
  const nextType = $derived(
    getNextWorkoutType(
      workoutStore.history.lastWorkoutType,
      settingsStore.value.program,
    ),
  );
  const nextWorkout = $derived(program.workouts[nextType]);

  function startWorkout() {
    workoutStore.startWorkout(nextType);
    toast.success("Workout started! Let's go!");
    goto("/workout");
  }

  const allExercisesComplete = $derived(
    workoutStore.current?.exercises.every(
      (ex) => ex.sets.length >= ex.targetSets,
    ) ?? false,
  );

  const workoutProgress = $derived(() => {
    if (!workoutStore.current) return 0;
    const totalSets = workoutStore.current.exercises.reduce(
      (sum, ex) => sum + ex.targetSets,
      0,
    );
    const completedSets = workoutStore.current.exercises.reduce(
      (sum, ex) => sum + ex.sets.length,
      0,
    );
    return Math.round((completedSets / totalSets) * 100);
  });

  const totalSets = $derived(() => {
    if (!workoutStore.current) return 0;
    return workoutStore.current.exercises.reduce(
      (sum, ex) => sum + ex.targetSets,
      0,
    );
  });

  const completedSets = $derived(() => {
    if (!workoutStore.current) return 0;
    return workoutStore.current.exercises.reduce(
      (sum, ex) => sum + ex.sets.length,
      0,
    );
  });

  function handleLogSet(exerciseIndex: number, reps: number) {
    workoutStore.logSet(exerciseIndex, reps);
  }

  function handleUpdateSet(
    exerciseIndex: number,
    setIndex: number,
    reps: number,
  ) {
    workoutStore.updateSetReps(exerciseIndex, setIndex, reps);
  }

  function handleUpdateWeight(exerciseIndex: number, weight: number) {
    workoutStore.updateExerciseWeight(exerciseIndex, weight);
  }

  function finishWorkout() {
    workoutStore.completeWorkout();
    timerStore.reset();
    toast.success("Workout complete! Great job!");
    goto("/");
  }

  function cancelWorkout() {
    workoutStore.cancelWorkout();
    timerStore.reset();
    toast("Workout discarded");
    goto("/");
  }
</script>

<svelte:head>
  <title>Workout - StrongLifts</title>
</svelte:head>

<div class="p-4 space-y-4">
  {#if !workoutStore.current}
    <!-- ═══ Next Workout Preview ═══ -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
            >
              <DumbbellIcon class="h-5 w-5 text-primary" />
            </div>
            <div>
              <Card.Title class="text-lg">Next Workout</Card.Title>
              <Card.Description>
                {nextWorkout.name}
              </Card.Description>
            </div>
          </div>
          <Badge variant="secondary">{nextType}</Badge>
        </div>
      </Card.Header>

      <Card.Content class="space-y-3">
        {#each nextWorkout.exercises as exercise, i}
          {#if i > 0}
            <Separator />
          {/if}
          <div class="flex items-center justify-between py-1">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-bold"
              >
                {i + 1}
              </div>
              <span class="font-medium">{exercise.name}</span>
            </div>
            <Badge variant="outline">
              {exercise.sets}&times;{exercise.reps} @ {formatWeight(
                workoutStore.getNextExerciseWeight(exercise.name),
                settingsStore.value.weightUnit,
              )}
            </Badge>
          </div>
        {/each}
      </Card.Content>

      <Card.Footer>
        <Button
          class="w-full h-12 text-base font-semibold"
          onclick={startWorkout}
        >
          <PlayIcon class="mr-2 h-5 w-5" />
          Start Workout {nextType}
        </Button>
      </Card.Footer>
    </Card.Root>
  {:else}
    <!-- ═══ Active Workout ═══ -->

    <!-- Progress Header -->
    <Card.Root>
      <Card.Header class="pb-2">
        <div class="flex items-center justify-between">
          <div>
            <Card.Title class="text-xl flex items-center gap-2">
              <DumbbellIcon class="h-5 w-5" />
              {workoutStore.current.activity}
            </Card.Title>
            <Card.Description class="flex items-center gap-1 mt-1">
              <ClockIcon class="h-3 w-3" />
              Started at {workoutStore.current.time}
            </Card.Description>
          </div>
          <div class="text-right">
            <div class="text-3xl font-bold tabular-nums text-primary">
              {workoutProgress()}%
            </div>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <Progress value={workoutProgress()} max={100} class="h-2.5" />
        <div class="flex justify-between mt-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <TargetIcon class="h-3 w-3" />
            {completedSets()}/{totalSets()} sets
          </span>
          {#if allExercisesComplete}
            <span class="flex items-center gap-1 text-green-400">
              <TrophyIcon class="h-3 w-3" />
              All exercises done!
            </span>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Rest Timer -->
    <Timer />

    <!-- Exercise Cards -->
    <div class="space-y-4">
      {#each workoutStore.current.exercises as exercise, i}
        <ExerciseCard
          {exercise}
          exerciseIndex={i}
          onLogSet={handleLogSet}
          onUpdateSet={handleUpdateSet}
          onUpdateWeight={handleUpdateWeight}
        />
      {/each}
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3 pt-2 pb-4">
      <AlertDialog.Root bind:open={showFinishDialog}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="flex-1 h-12 text-base font-semibold {allExercisesComplete
                ? ''
                : 'opacity-60'}"
            >
              <CheckCircle2Icon class="mr-2 h-5 w-5" />
              {allExercisesComplete ? "Complete Workout" : "Finish Early"}
            </Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>
              {allExercisesComplete ? "Complete Workout?" : "Finish Early?"}
            </AlertDialog.Title>
            <AlertDialog.Description>
              {#if allExercisesComplete}
                All exercises are done. Save this workout to your history.
              {:else}
                You haven't finished all exercises yet. Save what you've
                completed so far?
              {/if}
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep Going</AlertDialog.Cancel>
            <AlertDialog.Action onclick={finishWorkout}>
              {allExercisesComplete ? "Save Workout" : "Save & Finish"}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>

      <AlertDialog.Root bind:open={showCancelDialog}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="destructive"
              size="icon"
              class="h-12 w-12"
            >
              <XCircleIcon class="h-5 w-5" />
            </Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Discard Workout?</AlertDialog.Title>
            <AlertDialog.Description>
              This will delete all progress from this session. This can't be
              undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Keep Workout</AlertDialog.Cancel>
            <AlertDialog.Action onclick={cancelWorkout}>
              Discard
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  {/if}
</div>
