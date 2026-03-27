<script lang="ts">
  import type { DailyNutrition, MacroTargets } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Progress } from "$lib/components/ui/progress";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import BeefIcon from "@lucide/svelte/icons/beef";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import TimerIcon from "@lucide/svelte/icons/timer";

  interface Props {
    totals: DailyNutrition;
    targets: MacroTargets;
    feedingWindow: {
      isOpen: boolean;
      opensAt: string | null;
      closesAt: string | null;
      minutesLeft: number | null;
    };
  }

  let { totals, targets, feedingWindow }: Props = $props();

  const calPct = $derived(
    Math.min(
      100,
      Math.round((totals.calories / Math.max(1, targets.calories)) * 100),
    ),
  );
  const proteinPct = $derived(
    Math.min(
      100,
      Math.round((totals.protein_g / Math.max(1, targets.protein_g)) * 100),
    ),
  );
  const waterL = $derived(totals.water_ml / 1000);
  const waterTargetL = $derived(targets.water_ml / 1000);
  const waterPct = $derived(
    Math.min(
      100,
      Math.round((totals.water_ml / Math.max(1, targets.water_ml)) * 100),
    ),
  );

  const ifMinutes = $derived(feedingWindow.minutesLeft ?? 0);
  const ifHours = $derived(Math.floor(ifMinutes / 60));
  const ifMins = $derived(ifMinutes % 60);

  function progressColor(pct: number, invert: boolean = false): string {
    if (invert) return pct >= 90 ? "[&>div]:bg-red-500" : "";
    return pct >= 100
      ? "[&>div]:bg-emerald-500"
      : pct >= 75
        ? "[&>div]:bg-yellow-500"
        : "";
  }
</script>

<div class="grid grid-cols-2 gap-2">
  <!-- Calories -->
  <Card.Root class="p-3">
    <div class="flex items-center gap-1.5 mb-2">
      <FlameIcon class="h-3.5 w-3.5 text-orange-400" />
      <span class="text-xs font-medium text-muted-foreground">Calories</span>
    </div>
    <p class="text-lg font-bold font-mono tabular-nums leading-none mb-1">
      {Math.round(totals.calories)}
      <span class="text-xs font-normal text-muted-foreground"
        >/ {targets.calories}</span
      >
    </p>
    <Progress
      value={calPct}
      max={100}
      class="h-1.5 {progressColor(calPct, true)}"
    />
  </Card.Root>

  <!-- Protein -->
  <Card.Root class="p-3">
    <div class="flex items-center gap-1.5 mb-2">
      <BeefIcon class="h-3.5 w-3.5 text-red-400" />
      <span class="text-xs font-medium text-muted-foreground">Protein</span>
    </div>
    <p class="text-lg font-bold font-mono tabular-nums leading-none mb-1">
      {Math.round(totals.protein_g)}g
      <span class="text-xs font-normal text-muted-foreground"
        >/ {targets.protein_g}g</span
      >
    </p>
    <Progress
      value={proteinPct}
      max={100}
      class="h-1.5 {progressColor(proteinPct)}"
    />
  </Card.Root>

  <!-- Water -->
  <Card.Root class="p-3">
    <div class="flex items-center gap-1.5 mb-2">
      <DropletIcon class="h-3.5 w-3.5 text-blue-400" />
      <span class="text-xs font-medium text-muted-foreground">Water</span>
    </div>
    <p class="text-lg font-bold font-mono tabular-nums leading-none mb-1">
      {waterL.toFixed(1)}L
      <span class="text-xs font-normal text-muted-foreground"
        >/ {waterTargetL.toFixed(1)}L</span
      >
    </p>
    <Progress
      value={waterPct}
      max={100}
      class="h-1.5 {progressColor(waterPct)}"
    />
  </Card.Root>

  <!-- IF Window -->
  <Card.Root
    class="p-3 {feedingWindow.isOpen
      ? 'border-emerald-500/30'
      : feedingWindow.closesAt
        ? 'border-red-500/30'
        : ''}"
  >
    <div class="flex items-center gap-1.5 mb-2">
      <TimerIcon
        class="h-3.5 w-3.5 {feedingWindow.isOpen
          ? 'text-emerald-400'
          : 'text-muted-foreground'}"
      />
      <span class="text-xs font-medium text-muted-foreground">IF Window</span>
    </div>
    {#if feedingWindow.isOpen && feedingWindow.minutesLeft}
      <p
        class="text-lg font-bold font-mono tabular-nums leading-none mb-1 text-emerald-400"
      >
        {ifHours}h {ifMins}m
      </p>
      <p class="text-[10px] text-muted-foreground">
        closes {feedingWindow.closesAt}
      </p>
    {:else if feedingWindow.closesAt}
      <p class="text-lg font-bold leading-none mb-1 text-red-400">Closed</p>
      <p class="text-[10px] text-muted-foreground">
        was {feedingWindow.opensAt}–{feedingWindow.closesAt}
      </p>
    {:else}
      <p class="text-lg font-bold leading-none mb-1 text-muted-foreground">
        Fasting
      </p>
      <p class="text-[10px] text-muted-foreground">no meals yet today</p>
    {/if}
  </Card.Root>
</div>
