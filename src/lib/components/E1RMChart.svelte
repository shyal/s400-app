<script lang="ts">
  import type { Workout } from "$lib/types";
  import { epleyE1RM } from "$lib/utils/progression";
  import * as Card from "$lib/components/ui/card";
  import TrophyIcon from "@lucide/svelte/icons/trophy";

  interface Props {
    workouts: Workout[];
  }

  let { workouts }: Props = $props();

  const pad = { top: 10, right: 4, bottom: 18, left: 28 };
  const chartW = 800;
  const chartH = 280;

  // Preferred colors for the big 5, then a palette for everything else
  const preferredColors: Record<string, string> = {
    Squat: "#10b981",
    "Bench Press": "#3b82f6",
    "Overhead Press": "#a855f7",
    "Barbell Row": "#f59e0b",
    Deadlift: "#ef4444",
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

  // Normalize exercise name variants (case-insensitive dedup)
  function normalizeName(name: string): string {
    const lower = name.toLowerCase().trim();
    const aliases: Record<string, string> = {
      pullups: "Pull-ups",
      "pull-ups": "Pull-ups",
      "lat pulldown": "Lat Pulldown",
    };
    return aliases[lower] ?? name;
  }

  // Extract best e1RM per lift per workout, sorted by date
  const liftData = $derived.by(() => {
    const result: Record<string, { date: string; e1rm: number }[]> = {};

    const thisYear = new Date().getFullYear().toString();
    const sorted = [...workouts]
      .filter((w) => w.date.startsWith(thisYear))
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const w of sorted) {
      for (const ex of w.exercises) {
        const name = normalizeName(ex.name);
        if (!result[name]) result[name] = [];
        let best = 0;
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const e1rm = epleyE1RM(set.weight_kg, set.reps);
          if (e1rm > best) best = e1rm;
        }
        if (best > 0) {
          result[name].push({ date: w.date, e1rm: best });
        }
      }
    }
    return result;
  });

  // All exercises with at least 2 data points, big 5 first then alphabetical
  const activLifts = $derived.by(() => {
    const big5 = [
      "Squat",
      "Bench Press",
      "Overhead Press",
      "Barbell Row",
      "Deadlift",
    ];
    const all = Object.keys(liftData).filter((n) => liftData[n].length >= 2);
    const ordered = big5.filter((n) => all.includes(n));
    const rest = all
      .filter((n) => !big5.includes(n))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...rest];
  });

  // Assign colors: preferred for big 5, palette for the rest
  const liftColors = $derived.by(() => {
    const colors: Record<string, string> = {};
    let extraIdx = 0;
    for (const name of activLifts) {
      if (preferredColors[name]) {
        colors[name] = preferredColors[name];
      } else {
        colors[name] = extraPalette[extraIdx % extraPalette.length];
        extraIdx++;
      }
    }
    return colors;
  });
  const hasData = $derived(activLifts.length > 0);

  // All dates and values for domain calculation
  const allPoints = $derived(activLifts.flatMap((n) => liftData[n]));

  const xDomain = $derived.by(() => {
    if (allPoints.length === 0) return { min: 0, max: 1 };
    const times = allPoints.map((p) =>
      new Date(p.date + "T00:00:00").getTime(),
    );
    return { min: Math.min(...times), max: Math.max(...times) };
  });

  const yDomain = $derived.by(() => {
    if (allPoints.length === 0) return { min: 0, max: 100 };
    const vals = allPoints.map((p) => p.e1rm);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max((hi - lo) * 0.08, 2);
    return {
      min: Math.max(0, Math.floor((lo - margin) / 5) * 5),
      max: Math.ceil((hi + margin) / 5) * 5,
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
    const step = range <= 20 ? 5 : range <= 50 ? 10 : range <= 100 ? 20 : 50;
    const ticks: number[] = [];
    for (let v = yDomain.min; v <= yDomain.max; v += step) ticks.push(v);
    return ticks;
  });

  const xLabels = $derived.by(() => {
    if (allPoints.length === 0) return [];
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

  // Latest e1RM per lift
  const latestE1RM = $derived.by(() => {
    const result: Record<string, number> = {};
    for (const name of activLifts) {
      const pts = liftData[name];
      result[name] = pts[pts.length - 1].e1rm;
    }
    return result;
  });
</script>

<Card.Root class="overflow-hidden">
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <TrophyIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">Estimated 1RM</Card.Title>
      </div>
    </div>
  </Card.Header>

  <Card.Content class="p-0">
    {#if hasData}
      <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
        {#each yTicks as tick (tick)}
          <line
            x1={pad.left}
            y1={scaleY(tick)}
            x2={chartW}
            y2={scaleY(tick)}
            stroke="currentColor"
            class="text-border"
            stroke-width="0.5"
          />
          <text
            x={pad.left - 2}
            y={scaleY(tick) + 2}
            text-anchor="end"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{tick}</text
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

        {#each activLifts as name (name)}
          <!-- Connecting line -->
          {@const linePts = liftData[name]
            .map((pt) => `${dateToX(pt.date)},${scaleY(pt.e1rm)}`)
            .join(" ")}
          <polyline
            points={linePts}
            fill="none"
            stroke={liftColors[name]}
            stroke-width="1"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.5"
          />

          <!-- All data points as dots -->
          {#each liftData[name] as pt}
            <circle
              cx={dateToX(pt.date)}
              cy={scaleY(pt.e1rm)}
              r="1.5"
              fill={liftColors[name]}
              opacity="0.6"
            />
          {/each}
          <!-- Latest point (larger) -->
          {@const pts = liftData[name]}
          {@const last = pts[pts.length - 1]}
          <circle
            cx={dateToX(last.date)}
            cy={scaleY(last.e1rm)}
            r="2.5"
            fill={liftColors[name]}
            stroke="var(--card)"
            stroke-width="1"
          />
          <!-- Label at end -->
          <text
            x={dateToX(last.date) + 4}
            y={scaleY(last.e1rm) + 2}
            fill={liftColors[name]}
            font-size="4.5"
            font-weight="600">{Math.round(last.e1rm)}</text
          >
        {/each}
      </svg>

      <!-- Legend -->
      <div
        class="flex flex-wrap gap-x-3 gap-y-1 px-4 pb-3 text-[10px] text-muted-foreground"
      >
        {#each activLifts as name (name)}
          <span class="flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full inline-block"
              style="background-color: {liftColors[name]}"
            ></span>
            {name}
            <span
              class="font-mono font-medium tabular-nums"
              style="color: {liftColors[name]}">{latestE1RM[name]}kg</span
            >
          </span>
        {/each}
      </div>
    {:else}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        Need more workout data for e1RM charts
      </div>
    {/if}
  </Card.Content>
</Card.Root>
