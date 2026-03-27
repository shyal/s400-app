<script lang="ts">
  import { workoutStore } from "$lib/stores/workout.svelte";
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import {
    buildAllStreaks,
    type StreakInfo,
    type DayActivity,
  } from "$lib/services/streakData";
  import {
    fetchFoodEntriesRange,
    fetchWaterEntriesRange,
  } from "$lib/services/nutritionData";
  import { localDateStr } from "$lib/utils/date";
  import type { FoodEntry, WaterEntry } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Progress } from "$lib/components/ui/progress";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import BeefIcon from "@lucide/svelte/icons/beef";
  import UtensilsIcon from "@lucide/svelte/icons/utensils";
  import GlassWaterIcon from "@lucide/svelte/icons/glass-water";

  const STREAK_META: Record<
    string,
    { icon: typeof DumbbellIcon; color: string; barColor: string }
  > = {
    lifting: {
      icon: DumbbellIcon,
      color: "text-violet-400",
      barColor: "bg-violet-400",
    },
    protein: {
      icon: BeefIcon,
      color: "text-orange-400",
      barColor: "bg-orange-400",
    },
    food: {
      icon: UtensilsIcon,
      color: "text-emerald-400",
      barColor: "bg-emerald-400",
    },
    water: {
      icon: GlassWaterIcon,
      color: "text-sky-400",
      barColor: "bg-sky-400",
    },
  };

  const HEATMAP_COLORS = [
    "bg-muted/30",
    "bg-emerald-500/30",
    "bg-emerald-500/50",
    "bg-emerald-500/70",
    "bg-emerald-500",
  ];

  let foodEntries = $state<FoodEntry[]>([]);
  let waterEntries = $state<WaterEntry[]>([]);
  let loaded = $state(false);

  $effect(() => {
    // Access stores to create dependency
    const _targets = nutritionStore.macroTargets;
    const _workouts = workoutStore.history.workouts;

    const today = localDateStr();
    const d = new Date();
    d.setDate(d.getDate() - 90);
    const startDate = localDateStr(d);

    Promise.all([
      fetchFoodEntriesRange(startDate, today),
      fetchWaterEntriesRange(startDate, today),
    ])
      .then(([food, water]) => {
        foodEntries = food;
        waterEntries = water;
        loaded = true;
      })
      .catch(() => {
        loaded = true;
      });
  });

  const result = $derived(
    loaded
      ? buildAllStreaks(
          workoutStore.history.workouts,
          foodEntries,
          waterEntries,
          nutritionStore.macroTargets,
        )
      : { streaks: [], activity: [] },
  );

  const hasHotStreak = $derived(result.streaks.some((s) => s.current >= 7));

  const today = $derived(
    result.activity.length > 0
      ? result.activity[result.activity.length - 1]
      : null,
  );

  const todayMissing = $derived.by(() => {
    if (!today) return [];
    const missing: string[] = [];
    if (!today.foodLogged) missing.push("LOG YOUR FOOD");
    if (!today.proteinHit) missing.push("HIT 100g PROTEIN");
    if (!today.waterHit) missing.push("DRINK 3L WATER");
    // Lifting: check if due (last workout > 1 day ago)
    if (!today.workout) {
      const lastDate = workoutStore.history.lastWorkoutDate;
      if (lastDate) {
        const gap = Math.floor(
          (Date.now() - new Date(lastDate + "T00:00:00").getTime()) /
            (1000 * 60 * 60 * 24),
        );
        if (gap >= 2) missing.push("TIME TO LIFT");
      } else {
        missing.push("TIME TO LIFT");
      }
    }
    return missing;
  });

  function activityTitle(day: DayActivity): string {
    const parts: string[] = [];
    if (day.workout) parts.push("Workout");
    if (day.foodLogged) parts.push("Food logged");
    if (day.proteinHit) parts.push("Protein hit");
    if (day.waterHit) parts.push("Water hit");
    return `${day.date}: ${parts.length > 0 ? parts.join(", ") : "Nothing logged"}`;
  }
</script>

<Card.Root>
  <Card.Header class="pb-3">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10"
      >
        <TrophyIcon class="h-5 w-5 text-amber-400" />
      </div>
      <div class="flex-1">
        <Card.Title>Streaks</Card.Title>
        <Card.Description>Consistency builds results</Card.Description>
      </div>
      {#if hasHotStreak}
        <Badge variant="secondary" class="text-orange-400 gap-1">
          <FlameIcon class="h-3 w-3" />
          On fire
        </Badge>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="space-y-4">
    {#if !loaded}
      <p class="text-sm text-muted-foreground animate-pulse">
        Loading streaks...
      </p>
    {:else if result.streaks.length > 0}
      <!-- Today's focus -->
      {#if todayMissing.length > 0}
        <div
          class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1"
        >
          {#each todayMissing as item (item)}
            <p class="text-base font-extrabold tracking-wide text-amber-300">
              {item}
            </p>
          {/each}
        </div>
      {:else if today && today.score === 4}
        <div
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"
        >
          <p class="text-base font-extrabold tracking-wide text-emerald-400">
            ALL HABITS HIT TODAY
          </p>
        </div>
      {/if}

      <!-- Streak rows -->
      <div class="space-y-3">
        {#each result.streaks as streak (streak.key)}
          {@const meta = STREAK_META[streak.key]}
          {@const Icon = meta.icon}
          {@const pct =
            streak.best > 0
              ? Math.min((streak.current / streak.best) * 100, 100)
              : 0}
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Icon class="h-4 w-4 {meta.color}" />
                <span class="text-sm font-medium">{streak.label}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-lg font-bold font-mono tabular-nums"
                  >{streak.current}</span
                >
                <span class="text-xs text-muted-foreground"
                  >Best: {streak.best}</span
                >
              </div>
            </div>
            <div class="relative">
              <Progress
                value={pct}
                max={100}
                class="h-1.5 {meta.barColor.replace('bg-', '[&>div]:bg-')}"
              />
            </div>
          </div>
        {/each}
      </div>

      <!-- 30-day heatmap -->
      {#if result.activity.length > 0}
        <div class="pt-2">
          <p
            class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1"
          >
            Last 30 days
          </p>
          <p class="text-[10px] text-muted-foreground mb-2">
            Each square = 1 day. Brighter = more habits hit (lift, food,
            protein, water).
          </p>
          <div class="grid grid-cols-6 gap-1.5">
            {#each result.activity as day (day.date)}
              <div
                class="h-5 w-5 rounded-sm {HEATMAP_COLORS[day.score]}"
                title={activityTitle(day)}
              ></div>
            {/each}
          </div>
          <div class="flex items-center justify-end gap-1.5 mt-2">
            <span class="text-[10px] text-muted-foreground">0/4</span>
            {#each HEATMAP_COLORS as color, i (i)}
              <div class="h-2.5 w-2.5 rounded-sm {color}"></div>
            {/each}
            <span class="text-[10px] text-muted-foreground">4/4</span>
          </div>
        </div>
      {/if}
    {:else}
      <p class="text-sm text-muted-foreground">
        No streak data yet. Start logging!
      </p>
    {/if}
  </Card.Content>
</Card.Root>
