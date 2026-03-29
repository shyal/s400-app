<script lang="ts">
  import { workoutStore } from "$lib/stores/workout.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { getProgram, getNextWorkoutType } from "$lib/utils/programs";
  import { formatWeight } from "$lib/utils/progression";
  import {
    generateProjection,
    isStrengthProgressing,
  } from "$lib/services/simulationEngine";
  import type { SimulationConfig } from "$lib/types";
  import WorkoutSummary from "$lib/components/WorkoutSummary.svelte";
  import WeightChart from "$lib/components/WeightChart.svelte";
  import BodyMetricChart from "$lib/components/BodyMetricChart.svelte";
  import E1RMChart from "$lib/components/E1RMChart.svelte";
  import StrengthWeightChart from "$lib/components/StrengthWeightChart.svelte";
  import DOTSChart from "$lib/components/DOTSChart.svelte";
  import TodoList from "$lib/components/TodoList.svelte";
  import GoalCountdown from "$lib/components/GoalCountdown.svelte";
  import WorkoutCountdown from "$lib/components/WorkoutCountdown.svelte";
  import TodayStats from "$lib/components/TodayStats.svelte";
  import WorkoutConsistency from "$lib/components/WorkoutConsistency.svelte";
  import DaySummary from "$lib/components/DaySummary.svelte";
  import StreakCard from "$lib/components/StreakCard.svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";

  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import PlayIcon from "@lucide/svelte/icons/play";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import BeefIcon from "@lucide/svelte/icons/beef";
  import PercentIcon from "@lucide/svelte/icons/percent";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import ChartLineIcon from "@lucide/svelte/icons/chart-line";

  const program = $derived(getProgram(settingsStore.value.program));
  const nextType = $derived(
    getNextWorkoutType(
      workoutStore.history.lastWorkoutType,
      settingsStore.value.program,
    ),
  );
  const nextWorkout = $derived(program.workouts[nextType]);

  const daysSinceLastWorkout = $derived(() => {
    if (!workoutStore.history.lastWorkoutDate) return null;
    const last = new Date(workoutStore.history.lastWorkoutDate);
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  });

  const deloadPct = $derived(() => {
    const days = daysSinceLastWorkout();
    if (days === null || days < 7) return 0;
    const weeks = Math.floor(days / 7);
    return Math.min(weeks * 10, 50);
  });

  let showSimulation = $state(
    typeof localStorage !== "undefined" &&
      localStorage.getItem("showSimulation") === "1",
  );
  $effect(() => {
    localStorage.setItem("showSimulation", showSimulation ? "1" : "0");
  });

  const goalWeightKg = $derived(settingsStore.value.goalWeightKg ?? 73);
  const goalBodyFatPct = $derived(settingsStore.value.goalBodyFatPct ?? 15);
  const goalVisceralFat = $derived(settingsStore.value.goalVisceralFat ?? 8);
  const goalMode = $derived(settingsStore.value.goalMode ?? "visceral_fat");

  const simConfig = $derived<SimulationConfig>({
    goalKg: goalWeightKg,
    goalDate: "2026-06-01",
    goalVisceralFat: goalVisceralFat,
    strengthProgressing: isStrengthProgressing(workoutStore.history.workouts),
  });
  const currentProjection = $derived(
    showSimulation
      ? generateProjection(nutritionStore.weightLog, "current", simConfig)
      : undefined,
  );

  let showDeloadPrompt = $state(false);
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);
  const lastWorkout = $derived(workoutStore.history.workouts[0]);

  const exerciseEntries = $derived(
    Object.entries(workoutStore.history.exerciseProgress),
  );
  const compoundLifts = $derived(
    exerciseEntries.filter(([name]) =>
      [
        "Squat",
        "Bench Press",
        "Barbell Row",
        "Overhead Press",
        "Deadlift",
      ].includes(name),
    ),
  );

  async function deleteLatest() {
    deleting = true;
    await workoutStore.deleteLatestWorkout();
    deleting = false;
    showDeleteConfirm = false;
    toast("Last workout deleted");
  }

  function startWorkout(deload: number = 0) {
    workoutStore.startWorkout(nextType, deload);
    toast.success("Let's go!");
    goto("/workout");
  }

  function handleStart() {
    const pct = deloadPct();
    if (pct > 0) {
      showDeloadPrompt = true;
    } else {
      startWorkout();
    }
  }

  function resumeWorkout() {
    goto("/workout");
  }

  // Hydrate weight data for the chart
  nutritionStore.ensureHydrated();
</script>

<svelte:head>
  <title>StrongLifts Tracker</title>
</svelte:head>

<div class="p-4 space-y-4">
  <!-- ═══ Header ═══ -->
  <header class="text-center pt-2 pb-1">
    <div class="flex items-center justify-center gap-2 mb-1">
      <DumbbellIcon class="h-6 w-6 text-primary" />
      <h1 class="text-2xl font-bold tracking-tight">StrongLifts</h1>
    </div>
    <p class="text-sm text-muted-foreground">{program.name}</p>
  </header>

  <!-- ═══ Goal Progress ═══ -->
  <div class="space-y-2">
    <div class="flex gap-1.5 justify-center">
      <button
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors {goalMode ===
        'weight'
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          : 'text-muted-foreground hover:bg-muted/50'}"
        onclick={() => settingsStore.update({ goalMode: "weight" })}
      >
        Weight
      </button>
      <button
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors {goalMode ===
        'body_fat'
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          : 'text-muted-foreground hover:bg-muted/50'}"
        onclick={() => settingsStore.update({ goalMode: "body_fat" })}
      >
        Body Fat
      </button>
      <button
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors {goalMode ===
        'visceral_fat'
          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
          : 'text-muted-foreground hover:bg-muted/50'}"
        onclick={() => settingsStore.update({ goalMode: "visceral_fat" })}
      >
        Visceral Fat
      </button>
    </div>
    <GoalCountdown
      entries={nutritionStore.weightLog}
      mode={goalMode}
      goalKg={goalWeightKg}
      {goalBodyFatPct}
      {goalVisceralFat}
      projection={currentProjection}
    />
  </div>

  <!-- ═══ Simulation Toggle ═══ -->
  <button
    onclick={() => (showSimulation = !showSimulation)}
    class="flex items-center justify-center gap-1.5 w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors {showSimulation
      ? 'bg-violet-500/15 border-violet-500/30 text-violet-400'
      : 'border-border text-muted-foreground hover:bg-muted/50'}"
  >
    <ChartLineIcon class="h-3.5 w-3.5" />
    {showSimulation ? "Hide Projection" : "Show Projection"}
  </button>

  <!-- ═══ Workout Countdown ═══ -->
  <WorkoutCountdown
    workouts={workoutStore.history.workouts}
    schedule={settingsStore.value.workoutSchedule}
    programName={settingsStore.value.program}
  />

  <!-- ═══ Active Workout Banner ═══ -->
  {#if workoutStore.isWorkoutActive}
    <Card.Root class="border-yellow-500/50 bg-yellow-500/5">
      <Card.Header>
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/20"
          >
            <ZapIcon class="h-5 w-5 text-yellow-400" />
          </div>
          <div class="flex-1">
            <Card.Title class="text-yellow-400">Workout in Progress</Card.Title>
            <Card.Description>{workoutStore.current?.activity}</Card.Description
            >
          </div>
        </div>
      </Card.Header>
      <Card.Footer>
        <Button class="w-full" onclick={resumeWorkout}>
          <ArrowRightIcon class="mr-2 h-4 w-4" />
          Continue Workout
        </Button>
      </Card.Footer>
    </Card.Root>
  {:else}
    <!-- ═══ Next Workout Card ═══ -->
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
              <Card.Description>{nextWorkout.name}</Card.Description>
            </div>
          </div>
          <Badge variant="secondary" class="text-sm">{nextType}</Badge>
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
                workoutStore.getExerciseWeight(exercise.name, 20),
                settingsStore.value.weightUnit,
              )}
            </Badge>
          </div>
        {/each}
      </Card.Content>

      <Card.Footer class="flex-col gap-3">
        <Button
          class="w-full h-12 text-base font-semibold"
          onclick={handleStart}
        >
          <PlayIcon class="mr-2 h-5 w-5" />
          Start Workout {nextType}
        </Button>

        {#if showDeloadPrompt}
          <div
            class="w-full rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3"
          >
            <div class="flex items-start gap-2">
              <TriangleAlertIcon
                class="h-4 w-4 text-yellow-400 mt-0.5 shrink-0"
              />
              <p class="text-sm text-yellow-300">
                It's been {daysSinceLastWorkout()} days since your last workout. A
                {deloadPct()}% deload is recommended.
              </p>
            </div>
            <div class="flex gap-2">
              <Button
                variant="secondary"
                class="flex-1"
                onclick={() => startWorkout(deloadPct())}
              >
                <TrendingDownIcon class="mr-1 h-4 w-4" />
                Deload {deloadPct()}%
              </Button>
              <Button
                variant="outline"
                class="flex-1"
                onclick={() => startWorkout()}
              >
                Full Weight
              </Button>
            </div>
          </div>
        {/if}
      </Card.Footer>
    </Card.Root>
  {/if}

  <!-- ═══ Today's Nutrition ═══ -->
  <TodayStats
    totals={nutritionStore.todaysTotals}
    targets={nutritionStore.macroTargets}
    feedingWindow={nutritionStore.feedingWindow}
  />

  <!-- ═══ Day Summary ═══ -->
  <DaySummary />

  <!-- ═══ Streaks ═══ -->
  <StreakCard />

  <!-- ═══ Workout Consistency ═══ -->
  <WorkoutConsistency workouts={workoutStore.history.workouts} />

  <!-- ═══ Compound Lift PRs ═══ -->
  {#if compoundLifts.length > 0}
    <div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {#each compoundLifts as [name, progress]}
        <Badge
          variant="outline"
          class="shrink-0 gap-1.5 px-2.5 py-1.5 font-mono tabular-nums text-xs"
        >
          <span class="text-muted-foreground font-sans"
            >{name
              .replace("Barbell Row", "Row")
              .replace("Bench Press", "Bench")
              .replace("Overhead Press", "OHP")}</span
          >
          {formatWeight(progress.weight_kg, settingsStore.value.weightUnit)}
        </Badge>
      {/each}
    </div>
  {/if}

  <!-- ═══ Weight Trend ═══ -->
  <WeightChart
    entries={nutritionStore.weightLog}
    workouts={workoutStore.history.workouts}
    projection={currentProjection}
    movingAverageWindow={settingsStore.value.movingAverageWindow ?? 7}
    movingAverageType={settingsStore.value.movingAverageType ?? "ema"}
  />

  <!-- ═══ Body Composition ═══ -->
  <BodyMetricChart
    entries={nutritionStore.weightLog}
    field="muscle_mass_kg"
    label="Muscle Mass"
    unit="kg"
    color="#10b981"
    icon={BeefIcon}
    lowerIsBetter={false}
    errorMargin={1.5}
    projection={currentProjection}
    movingAverageWindow={settingsStore.value.movingAverageWindow ?? 7}
    movingAverageType={settingsStore.value.movingAverageType ?? "ema"}
  />
  <BodyMetricChart
    entries={nutritionStore.weightLog}
    field="body_fat_pct"
    label="Body Fat"
    unit="%"
    color="#ef4444"
    icon={PercentIcon}
    lowerIsBetter={true}
    errorMargin={1.5}
    projection={currentProjection}
    movingAverageWindow={settingsStore.value.movingAverageWindow ?? 7}
    movingAverageType={settingsStore.value.movingAverageType ?? "ema"}
    goalValue={goalBodyFatPct}
  />
  <BodyMetricChart
    entries={nutritionStore.weightLog}
    field="visceral_fat"
    label="Visceral Fat"
    unit=""
    color="#a855f7"
    icon={ActivityIcon}
    lowerIsBetter={true}
    errorMargin={1.5}
    projection={currentProjection}
    movingAverageWindow={settingsStore.value.movingAverageWindow ?? 7}
    movingAverageType={settingsStore.value.movingAverageType ?? "ema"}
    goalValue={goalVisceralFat}
  />

  <!-- ═══ Estimated 1RM ═══ -->
  <E1RMChart
    workouts={workoutStore.history.workouts}
    showProjection={showSimulation}
  />

  <!-- ═══ Strength / Weight Ratio ═══ -->
  <StrengthWeightChart
    workouts={workoutStore.history.workouts}
    entries={nutritionStore.weightLog}
    showProjection={showSimulation}
  />

  <!-- ═══ DOTS Score ═══ -->
  <DOTSChart
    workouts={workoutStore.history.workouts}
    entries={nutritionStore.weightLog}
    showProjection={showSimulation}
  />

  <!-- ═══ Tasks ═══ -->
  <TodoList />

  <!-- ═══ Last Session ═══ -->
  {#if lastWorkout}
    <div class="space-y-2">
      <div class="flex justify-between items-center px-1">
        <h2
          class="text-sm font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Last Session
        </h2>
        <AlertDialog.Root bind:open={showDeleteConfirm}>
          <AlertDialog.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="sm"
                class="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
              >
                <Trash2Icon class="h-3 w-3 mr-1" />
                Delete
              </Button>
            {/snippet}
          </AlertDialog.Trigger>
          <AlertDialog.Content>
            <AlertDialog.Header>
              <AlertDialog.Title>Delete Last Workout?</AlertDialog.Title>
              <AlertDialog.Description>
                This will permanently remove your last workout session. Exercise
                weights will revert to their previous values.
              </AlertDialog.Description>
            </AlertDialog.Header>
            <AlertDialog.Footer>
              <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
              <AlertDialog.Action onclick={deleteLatest} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialog.Action>
            </AlertDialog.Footer>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </div>
      <WorkoutSummary workout={lastWorkout} />
    </div>
  {/if}
</div>
