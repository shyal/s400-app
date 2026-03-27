<script lang="ts">
  import type { Workout, WeightEntry } from "$lib/types";
  import { epleyE1RM } from "$lib/utils/progression";
  import * as Card from "$lib/components/ui/card";
  import GaugeIcon from "@lucide/svelte/icons/gauge";

  interface Props {
    workouts: Workout[];
    entries: WeightEntry[];
  }

  let { workouts, entries }: Props = $props();

  const pad = { top: 12, right: 8, bottom: 18, left: 32 };
  const chartW = 800;
  const chartH = 200;

  const liftNames = [
    "Squat",
    "Bench Press",
    "Overhead Press",
    "Barbell Row",
    "Deadlift",
  ];

  // Sort weight entries for interpolation
  const sortedWeights = $derived(
    [...entries]
      .filter((e) => e.weight_kg > 0)
      .sort((a, b) => a.date.localeCompare(b.date)),
  );

  function getWeightAtDate(dateStr: string): number | null {
    if (sortedWeights.length === 0) return null;
    const t = new Date(dateStr + "T00:00:00").getTime();
    let before: WeightEntry | null = null;
    let after: WeightEntry | null = null;
    for (const e of sortedWeights) {
      const et = new Date(e.date + "T00:00:00").getTime();
      if (et <= t) before = e;
      if (et >= t && !after) after = e;
    }
    if (before && after && before !== after) {
      const bt = new Date(before.date + "T00:00:00").getTime();
      const at = new Date(after.date + "T00:00:00").getTime();
      const frac = (t - bt) / (at - bt);
      return before.weight_kg + frac * (after.weight_kg - before.weight_kg);
    }
    return (before ?? after)!.weight_kg;
  }

  // Get ISO week string (YYYY-WW) for grouping
  function weekOf(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    const week = Math.ceil((days + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  // Compute weekly Relative Strength Index
  // Walk workouts chronologically, track current e1RM per lift,
  // emit one point per week: avg(current e1RMs) / bodyweight
  const weeklyData = $derived.by(() => {
    const thisYear = new Date().getFullYear().toString();
    const sorted = [...workouts]
      .filter((w) => w.date.startsWith(thisYear))
      .sort((a, b) => a.date.localeCompare(b.date));
    const currentE1RM: Record<string, number> = {};
    const weekMap = new Map<
      string,
      { date: string; rsi: number; bw: number; liftCount: number }
    >();

    for (const w of sorted) {
      // Update current e1RM for each lift trained
      for (const ex of w.exercises) {
        if (!liftNames.includes(ex.name)) continue;
        let best = 0;
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const e1rm = epleyE1RM(set.weight_kg, set.reps);
          if (e1rm > best) best = e1rm;
        }
        if (best > 0) currentE1RM[ex.name] = best;
      }

      const tracked = Object.values(currentE1RM);
      if (tracked.length < 2) continue;

      const bw = getWeightAtDate(w.date);
      if (!bw) continue;

      const avgE1RM = tracked.reduce((s, v) => s + v, 0) / tracked.length;
      const rsi = avgE1RM / bw;
      const week = weekOf(w.date);

      // Keep last workout of each week
      weekMap.set(week, { date: w.date, rsi, bw, liftCount: tracked.length });
    }

    return [...weekMap.values()];
  });

  const hasData = $derived(weeklyData.length >= 2);

  const xDomain = $derived.by(() => {
    if (weeklyData.length === 0) return { min: 0, max: 1 };
    const times = weeklyData.map((p) =>
      new Date(p.date + "T00:00:00").getTime(),
    );
    return { min: Math.min(...times), max: Math.max(...times) };
  });

  const yDomain = $derived.by(() => {
    if (weeklyData.length === 0) return { min: 0, max: 1 };
    const vals = weeklyData.map((p) => p.rsi);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max((hi - lo) * 0.15, 0.05);
    return {
      min: Math.max(0, Math.floor((lo - margin) * 20) / 20),
      max: Math.ceil((hi + margin) * 20) / 20,
    };
  });

  function dateToX(dateStr: string): number {
    const t = new Date(dateStr + "T00:00:00").getTime();
    const range = xDomain.max - xDomain.min || 1;
    return (
      pad.left + ((t - xDomain.min) / range) * (chartW - pad.left - pad.right)
    );
  }

  function scaleY(v: number): number {
    const range = yDomain.max - yDomain.min || 1;
    return (
      pad.top +
      (1 - (v - yDomain.min) / range) * (chartH - pad.top - pad.bottom)
    );
  }

  const yTicks = $derived.by(() => {
    const range = yDomain.max - yDomain.min;
    const step =
      range <= 0.3 ? 0.05 : range <= 0.6 ? 0.1 : range <= 1.2 ? 0.2 : 0.5;
    const ticks: number[] = [];
    const start = Math.ceil(yDomain.min / step) * step;
    for (let v = start; v <= yDomain.max + 0.001; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return ticks;
  });

  const xLabels = $derived.by(() => {
    if (weeklyData.length === 0) return [];
    const maxLabels = 6;
    const timeRange = xDomain.max - xDomain.min;
    const step = timeRange / maxLabels;
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i <= maxLabels; i++) {
      const t = xDomain.min + i * step;
      const d = new Date(t);
      const xPos = pad.left + (i / maxLabels) * (chartW - pad.left - pad.right);
      labels.push({
        x: xPos,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
    }
    return labels;
  });

  // Smooth line path (no polyline — use SVG path for clean curves)
  const linePath = $derived.by(() => {
    if (weeklyData.length < 2) return "";
    return weeklyData
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${dateToX(p.date)},${scaleY(p.rsi)}`,
      )
      .join(" ");
  });

  const areaPath = $derived.by(() => {
    if (weeklyData.length < 2) return "";
    const baseY = scaleY(yDomain.min);
    let d = `M ${dateToX(weeklyData[0].date)},${baseY}`;
    for (const p of weeklyData) d += ` L ${dateToX(p.date)},${scaleY(p.rsi)}`;
    d += ` L ${dateToX(weeklyData[weeklyData.length - 1].date)},${baseY} Z`;
    return d;
  });

  const latest = $derived(
    weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null,
  );
  const first = $derived(weeklyData.length > 0 ? weeklyData[0] : null);
  const change = $derived(latest && first ? latest.rsi - first.rsi : 0);
  const changePct = $derived(
    latest && first && first.rsi > 0 ? (change / first.rsi) * 100 : 0,
  );
</script>

<Card.Root class="overflow-hidden">
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <GaugeIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">Relative Strength</Card.Title>
      </div>
      {#if latest}
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold font-mono tabular-nums text-cyan-400">
            {latest.rsi.toFixed(2)}x BW
          </span>
          {#if change > 0}
            <span class="text-xs font-medium text-emerald-400"
              >+{changePct.toFixed(0)}%</span
            >
          {:else if change < 0}
            <span class="text-xs font-medium text-red-400"
              >{changePct.toFixed(0)}%</span
            >
          {/if}
        </div>
      {/if}
    </div>
    <p class="text-[10px] text-muted-foreground mt-0.5">
      Avg e1RM across {latest?.liftCount ?? 0} lifts / bodyweight &middot; Weekly
    </p>
  </Card.Header>

  <Card.Content class="p-0">
    {#if hasData}
      <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
        <defs>
          <linearGradient id="rsi-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <!-- Grid -->
        {#each yTicks as tick (tick)}
          <line
            x1={pad.left}
            y1={scaleY(tick)}
            x2={chartW - pad.right}
            y2={scaleY(tick)}
            stroke="currentColor"
            class="text-border"
            stroke-width="0.5"
          />
          <text
            x={pad.left - 3}
            y={scaleY(tick) + 2}
            text-anchor="end"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{tick.toFixed(2)}</text
          >
        {/each}

        {#each xLabels as { x, label: lbl } (x)}
          <text
            {x}
            y={chartH - 4}
            text-anchor="middle"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{lbl}</text
          >
        {/each}

        <!-- Area -->
        <path d={areaPath} fill="url(#rsi-grad)" />

        <!-- Line -->
        <path
          d={linePath}
          stroke="#22d3ee"
          stroke-width="2.5"
          fill="none"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        <!-- Latest point -->
        {#if latest}
          {@const lastPt = weeklyData[weeklyData.length - 1]}
          <circle
            cx={dateToX(lastPt.date)}
            cy={scaleY(lastPt.rsi)}
            r="3.5"
            fill="#22d3ee"
            stroke="var(--card)"
            stroke-width="1.5"
          />
        {/if}
      </svg>
    {:else}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        Need more workout data
      </div>
    {/if}
  </Card.Content>
</Card.Root>
