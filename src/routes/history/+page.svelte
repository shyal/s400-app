<script lang="ts">
  import { base } from "$app/paths";
  import { workoutStore } from "$lib/stores/workout.svelte";
  import WorkoutSummary from "$lib/components/WorkoutSummary.svelte";
  import ProgressChart from "$lib/components/ProgressChart.svelte";
  import { tick } from "svelte";

  import * as Card from "$lib/components/ui/card";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";

  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import LayersIcon from "@lucide/svelte/icons/layers";
  import WeightIcon from "@lucide/svelte/icons/weight";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import ChartLineIcon from "@lucide/svelte/icons/chart-line";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
  import ZapIcon from "@lucide/svelte/icons/zap";

  const workouts = $derived(workoutStore.history.workouts);

  let showCharts = $state(true);
  let timeRange = $state("all");
  let visibleCount = $state(20);
  let chartsReady = $state(false);

  $effect(() => {
    if (workouts.length > 0 && showCharts) {
      chartsReady = false;
      tick().then(() => {
        chartsReady = true;
      });
    }
  });

  const timeRanges = [
    { value: "1w", label: "1W" },
    { value: "1m", label: "1M" },
    { value: "3m", label: "3M" },
    { value: "6m", label: "6M" },
    { value: "1y", label: "1Y" },
    { value: "2y", label: "2Y" },
    { value: "all", label: "All" },
  ];

  const big5 = [
    "Squat",
    "Bench Press",
    "Deadlift",
    "Overhead Press",
    "Barbell Row",
  ];
  const preferredColors: Record<string, string> = {
    Squat: "#ef4444",
    "Bench Press": "#3b82f6",
    Deadlift: "#a855f7",
    "Overhead Press": "#f59e0b",
    "Barbell Row": "#22c55e",
  };
  const extraPalette = [
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#f97316",
    "#8b5cf6",
    "#14b8a6",
    "#e11d48",
    "#facc15",
    "#6366f1",
    "#22d3ee",
    "#fb923c",
    "#a3e635",
    "#c084fc",
    "#2dd4bf",
    "#f43f5e",
  ];

  // Normalize exercise name variants
  function normalizeName(name: string): string {
    const lower = name.toLowerCase().trim();
    const aliases: Record<string, string> = {
      pullups: "Pull-ups",
      "pull-ups": "Pull-ups",
      "lat pulldown": "Lat Pulldown",
    };
    return aliases[lower] ?? name;
  }

  // Discover all exercises with ≥2 sessions, big 5 first then alphabetical
  const allLifts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const w of workouts) {
      for (const ex of w.exercises) {
        const name = normalizeName(ex.name);
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
    const qualified = Object.keys(counts).filter((n) => counts[n] >= 2);
    const ordered = big5.filter((n) => qualified.includes(n));
    const rest = qualified
      .filter((n) => !big5.includes(n))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...rest];
  });

  // Assign colors: preferred for big 5, palette for the rest
  const liftColors = $derived.by(() => {
    const colors: Record<string, string> = {};
    let extraIdx = 0;
    for (const name of allLifts) {
      if (preferredColors[name]) {
        colors[name] = preferredColors[name];
      } else {
        colors[name] = extraPalette[extraIdx % extraPalette.length];
        extraIdx++;
      }
    }
    return colors;
  });

  // Shared X domain across all charts so they align
  function getDateCutoff(range: string): Date | null {
    const now = new Date();
    switch (range) {
      case "1w":
        return new Date(now.getTime() - 7 * 86400000);
      case "1m":
        return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      case "3m":
        return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      case "6m":
        return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      case "1y":
        return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      case "2y":
        return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      default:
        return null;
    }
  }

  const sharedXDomain = $derived.by(() => {
    if (workouts.length === 0) return undefined;
    const cutoff = getDateCutoff(timeRange);
    const filtered = cutoff
      ? workouts.filter((w) => new Date(w.date) >= cutoff)
      : workouts;
    if (filtered.length === 0) return undefined;
    const times = filtered.map((w) => new Date(w.date + "T00:00:00").getTime());
    return { min: Math.min(...times), max: Math.max(...times) };
  });

  const stats = $derived.by(() => {
    if (workouts.length === 0) return null;

    const totalWorkouts = workouts.length;
    const totalSets = workouts.reduce(
      (sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets.length, 0),
      0,
    );
    const totalVolume = workouts.reduce(
      (sum, w) =>
        sum +
        w.exercises.reduce(
          (s, e) =>
            s + e.sets.reduce((v, set) => v + set.reps * set.weight_kg, 0),
          0,
        ),
      0,
    );
    const avgDuration = Math.round(
      workouts.reduce((sum, w) => sum + w.duration_min, 0) / totalWorkouts,
    );

    return { totalWorkouts, totalSets, totalVolume, avgDuration };
  });

  const streak = $derived.by(() => {
    if (workouts.length < 2) return null;
    let count = 0;
    for (let i = 0; i < workouts.length - 1; i++) {
      const curr = new Date(workouts[i].date);
      const next = new Date(workouts[i + 1].date);
      const daysBetween = (curr.getTime() - next.getTime()) / 86400000;
      if (daysBetween <= 4) {
        count++;
      } else {
        break;
      }
    }
    return count > 1 ? count : null;
  });

  const pendingSync = $derived(workoutStore.getPendingSync());
</script>

<svelte:head>
  <title>History - StrongLifts</title>
</svelte:head>

<div class="p-4 space-y-4 pb-24">
  <!-- Header -->
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">History</h1>
      {#if workouts.length > 0}
        <p class="text-sm text-muted-foreground">
          {workouts.length} sessions logged
        </p>
      {/if}
    </div>
    {#if streak}
      <Badge variant="outline" class="gap-1 text-amber-400 border-amber-500/30">
        <ZapIcon class="h-3.5 w-3.5" />
        {streak} workout streak
      </Badge>
    {/if}
  </header>

  <!-- Stats Grid -->
  {#if stats}
    <div class="grid grid-cols-4 gap-2">
      <Card.Root>
        <Card.Content class="p-3 text-center">
          <DumbbellIcon class="h-4 w-4 mx-auto mb-1 text-blue-400" />
          <div class="text-xl font-bold tabular-nums text-blue-400">
            {stats.totalWorkouts}
          </div>
          <div
            class="text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            Workouts
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Content class="p-3 text-center">
          <LayersIcon class="h-4 w-4 mx-auto mb-1 text-emerald-400" />
          <div class="text-xl font-bold tabular-nums text-emerald-400">
            {stats.totalSets}
          </div>
          <div
            class="text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            Sets
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Content class="p-3 text-center">
          <WeightIcon class="h-4 w-4 mx-auto mb-1 text-purple-400" />
          <div class="text-xl font-bold tabular-nums text-purple-400">
            {Math.round((stats.totalVolume ?? 0) / 1000)}k
          </div>
          <div
            class="text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            Vol (kg)
          </div>
        </Card.Content>
      </Card.Root>
      <Card.Root>
        <Card.Content class="p-3 text-center">
          <ClockIcon class="h-4 w-4 mx-auto mb-1 text-amber-400" />
          <div class="text-xl font-bold tabular-nums text-amber-400">
            {stats.avgDuration}
          </div>
          <div
            class="text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            Avg Min
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}

  <!-- Pending Sync Banner -->
  {#if pendingSync.length > 0}
    <Card.Root class="border-amber-500/30 bg-amber-500/5">
      <Card.Content class="p-3">
        <div class="flex items-center gap-3">
          <AlertTriangleIcon class="h-5 w-5 text-amber-400 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm text-amber-400">
              {pendingSync.length} pending sync
            </p>
            <code class="text-xs text-muted-foreground"
              >python src/sync_workouts.py</code
            >
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  {#if workouts.length === 0}
    <!-- Empty State -->
    <Card.Root>
      <Card.Content class="py-12 text-center">
        <DumbbellIcon class="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
        <p class="text-muted-foreground mb-4">No workouts recorded yet.</p>
        <Button href="{base}/">Start Your First Workout</Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Progress Charts Section -->
    <Collapsible.Root bind:open={showCharts}>
      <Card.Root>
        <Collapsible.Trigger class="w-full">
          <Card.Header class="py-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ChartLineIcon class="h-4 w-4 text-muted-foreground" />
                <Card.Title class="text-sm font-semibold"
                  >Progress Charts</Card.Title
                >
              </div>
              <ChevronDownIcon
                class="h-4 w-4 text-muted-foreground transition-transform {showCharts
                  ? 'rotate-180'
                  : ''}"
              />
            </div>
          </Card.Header>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <Card.Content class="pt-0 pb-3">
            <ToggleGroup.Root
              type="single"
              bind:value={timeRange}
              variant="outline"
              size="sm"
              class="flex-wrap"
            >
              {#each timeRanges as range (range.value)}
                <ToggleGroup.Item value={range.value} class="text-xs px-2.5">
                  {range.label}
                </ToggleGroup.Item>
              {/each}
            </ToggleGroup.Root>
          </Card.Content>
        </Collapsible.Content>
      </Card.Root>
    </Collapsible.Root>

    {#if showCharts && chartsReady}
      <div class="space-y-2">
        {#each allLifts as lift (lift)}
          <ProgressChart
            {workouts}
            exerciseName={lift}
            color={liftColors[lift]}
            {timeRange}
            xDomainOverride={sharedXDomain}
          />
        {/each}
      </div>
    {/if}

    <Separator />

    <!-- Workout List -->
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">All Workouts</h2>
      <Badge variant="secondary" class="text-xs">{workouts.length}</Badge>
    </div>

    <div class="space-y-2">
      {#each workouts.slice(0, visibleCount) as workout (workout.id)}
        <WorkoutSummary {workout} />
      {/each}

      {#if visibleCount < workouts.length}
        <Button
          variant="outline"
          class="w-full"
          onclick={() => (visibleCount += 20)}
        >
          Load more ({workouts.length - visibleCount} remaining)
        </Button>
      {/if}
    </div>
  {/if}
</div>
