<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { workoutStore } from "$lib/stores/workout.svelte";
  import {
    buildTodayData,
    buildWeekData,
    buildMonthData,
  } from "$lib/services/summaryData";
  import {
    generateSummary,
    type SummaryFragment,
    type UserContext,
  } from "$lib/services/summaryEngine";
  import * as Card from "$lib/components/ui/card";
  import NotebookTextIcon from "@lucide/svelte/icons/notebook-text";

  const GOAL_KG = 72;
  const GOAL_DATE = "2026-06-01";
  const LIFT_FREQ_DAYS = 2;

  const ctx: UserContext = $derived({
    goalKg: GOAL_KG,
    goalDate: GOAL_DATE,
    currentWeight: nutritionStore.weightLog[0]?.weight_kg ?? null,
    proteinTarget: nutritionStore.macroTargets.protein_g,
    calorieTarget: nutritionStore.macroTargets.calories,
    waterTarget: nutritionStore.macroTargets.water_ml,
    liftFrequencyDays: LIFT_FREQ_DAYS,
  });

  const todayData = $derived(
    buildTodayData(
      nutritionStore.todaysTotals,
      nutritionStore.feedingWindow,
      nutritionStore.macroTargets,
      workoutStore.history.workouts,
      nutritionStore.weightLog,
      nutritionStore.foodEntries.filter(
        (e) => e.date === nutritionStore.selectedDate,
      ).length,
    ),
  );
  const todayFragments = $derived(generateSummary(todayData, ctx));

  let weekFragments = $state<SummaryFragment[]>([]);
  let monthFragments = $state<SummaryFragment[]>([]);
  let weekLoaded = $state(false);
  let monthLoaded = $state(false);

  $effect(() => {
    const targets = nutritionStore.macroTargets;
    const workouts = workoutStore.history.workouts;
    const weight = nutritionStore.weightLog;
    const context = ctx;

    buildWeekData(targets, workouts, weight)
      .then((data) => {
        weekFragments = generateSummary(data, context);
        weekLoaded = true;
      })
      .catch(() => {
        weekLoaded = true;
      });

    buildMonthData(targets, workouts, weight)
      .then((data) => {
        monthFragments = generateSummary(data, context);
        monthLoaded = true;
      })
      .catch(() => {
        monthLoaded = true;
      });
  });

  const MOOD_CLASSES: Record<string, string> = {
    achievement: "text-emerald-400",
    warning: "text-amber-400",
    trend: "text-sky-400",
    neutral: "text-muted-foreground",
  };

  function joinFragments(
    frags: SummaryFragment[],
  ): { text: string; cls: string }[] {
    return frags.map((f) => ({
      text: f.text,
      cls: MOOD_CLASSES[f.mood] ?? MOOD_CLASSES.neutral,
    }));
  }
</script>

<Card.Root>
  <Card.Header class="pb-3">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10"
      >
        <NotebookTextIcon class="h-5 w-5 text-indigo-400" />
      </div>
      <div>
        <Card.Title>Summary</Card.Title>
        <Card.Description>Your day at a glance</Card.Description>
      </div>
    </div>
  </Card.Header>

  <Card.Content class="space-y-4">
    <!-- Today -->
    <div>
      <h3
        class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
      >
        Today
      </h3>
      {#if todayFragments.length > 0}
        <p class="text-sm leading-relaxed">
          {#each joinFragments(todayFragments) as seg, i}<span class={seg.cls}
              >{seg.text}</span
            >{#if i < todayFragments.length - 1}{" "}{/if}{/each}
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">Nothing to report yet.</p>
      {/if}
    </div>

    <!-- This Week -->
    <div>
      <h3
        class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
      >
        This Week
      </h3>
      {#if !weekLoaded}
        <p class="text-sm text-muted-foreground animate-pulse">Loading...</p>
      {:else if weekFragments.length > 0}
        <p class="text-sm leading-relaxed">
          {#each joinFragments(weekFragments) as seg, i}<span class={seg.cls}
              >{seg.text}</span
            >{#if i < weekFragments.length - 1}{" "}{/if}{/each}
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">Nothing to report yet.</p>
      {/if}
    </div>

    <!-- This Month -->
    <div>
      <h3
        class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
      >
        This Month
      </h3>
      {#if !monthLoaded}
        <p class="text-sm text-muted-foreground animate-pulse">Loading...</p>
      {:else if monthFragments.length > 0}
        <p class="text-sm leading-relaxed">
          {#each joinFragments(monthFragments) as seg, i}<span class={seg.cls}
              >{seg.text}</span
            >{#if i < monthFragments.length - 1}{" "}{/if}{/each}
        </p>
      {:else}
        <p class="text-sm text-muted-foreground">Nothing to report yet.</p>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
