<script lang="ts">
  import type { WeightEntry, Workout, SimulationResult } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  import ScaleIcon from "@lucide/svelte/icons/scale";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import TargetIcon from "@lucide/svelte/icons/target";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";

  interface Props {
    entries: WeightEntry[];
    workouts?: Workout[];
    goalKg?: number;
    goalDate?: string;
    startingKg?: number;
    projection?: SimulationResult;
    movingAverageWindow?: number;
  }

  let {
    entries,
    workouts = [],
    goalKg = 72,
    goalDate = "2026-06-01",
    startingKg = 86.4,
    projection,
    movingAverageWindow = 7,
  }: Props = $props();

  const pad = { top: 10, right: 4, bottom: 18, left: 28 };
  const chartW = 800;
  const chartH = 400;

  const sorted = $derived(
    [...entries].sort((a, b) => a.date.localeCompare(b.date)),
  );

  // Workout dates as a Set for O(1) lookup
  const gymDates = $derived(new Set(workouts.map((w) => w.date)));

  // Configurable moving average
  const movingAvg = $derived.by(() => {
    if (sorted.length < 2) return [];
    const window = movingAverageWindow;
    return sorted.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = sorted.slice(start, i + 1);
      const avg = slice.reduce((s, e) => s + e.weight_kg, 0) / slice.length;
      return avg;
    });
  });

  // Stats
  const stats = $derived.by(() => {
    if (sorted.length < 2) return null;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalChange = last.weight_kg - first.weight_kg;
    const days = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dailyRate = totalChange / days;
    const weeklyRate = dailyRate * 7;
    const remaining = last.weight_kg - goalKg;
    const daysToGoal =
      dailyRate < 0 ? Math.ceil(remaining / Math.abs(dailyRate)) : null;
    return {
      totalChange,
      dailyRate,
      weeklyRate,
      remaining,
      daysToGoal,
      latest: last.weight_kg,
    };
  });

  // Y domain: tight to actual data range, only include goal if it's close
  const yDomain = $derived.by(() => {
    if (sorted.length === 0) return { min: goalKg - 2, max: startingKg + 2 };
    const weights = sorted.map((e) => e.weight_kg);
    // Include projection bounds
    if (projection) {
      for (const p of projection.points) {
        weights.push(p.weight_kg, p.weight_upper, p.weight_lower);
      }
    }
    const lo = Math.min(...weights);
    const hi = Math.max(...weights);
    // Only include goal line in domain if it's within reasonable range of data
    const dataMin = goalKg >= lo - 3 ? Math.min(lo, goalKg) : lo;
    const margin = Math.max((hi - dataMin) * 0.06, 0.5);
    return {
      min: Math.floor((dataMin - margin) * 2) / 2,
      max: Math.ceil((hi + margin) * 2) / 2,
    };
  });

  // X domain based on actual dates + projection
  const xDomain = $derived.by(() => {
    if (sorted.length === 0) return { min: 0, max: 1 };
    const times = sorted.map((e) => new Date(e.date + "T00:00:00").getTime());
    if (projection) {
      for (const p of projection.points) {
        times.push(new Date(p.date + "T00:00:00").getTime());
      }
    }
    return { min: Math.min(...times), max: Math.max(...times) };
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

  // SVG paths
  const areaPath = $derived.by(() => {
    if (sorted.length < 2) return "";
    const bottom = chartH - pad.bottom;
    const pts = sorted.map((e) => `${dateToX(e.date)},${scaleY(e.weight_kg)}`);
    return `M${dateToX(sorted[0].date)},${bottom} L${pts.join(" L")} L${dateToX(sorted[sorted.length - 1].date)},${bottom} Z`;
  });

  const weightLine = $derived(
    sorted.map((e) => `${dateToX(e.date)},${scaleY(e.weight_kg)}`).join(" "),
  );

  const avgLine = $derived.by(() => {
    if (movingAvg.length < 2) return "";
    return movingAvg
      .map((v, i) => `${dateToX(sorted[i].date)},${scaleY(v)}`)
      .join(" ");
  });

  const yTicks = $derived.by(() => {
    const range = yDomain.max - yDomain.min;
    const step = range <= 8 ? 1 : range <= 16 ? 2 : 5;
    const ticks: number[] = [];
    for (let v = yDomain.min; v <= yDomain.max; v += step) ticks.push(v);
    return ticks;
  });

  const xLabels = $derived.by(() => {
    if (sorted.length <= 1) return [];
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

  // Gym markers (data points that fall on workout dates, deduplicated by date)
  const gymMarkers = $derived(
    sorted
      .map((e) => ({
        x: dateToX(e.date),
        y: scaleY(e.weight_kg),
        date: e.date,
      }))
      .filter((m) => gymDates.has(m.date))
      .filter((m, i, arr) => arr.findIndex((a) => a.date === m.date) === i),
  );

  const goalY = $derived(scaleY(goalKg));

  // Projection overlay data
  const todayStr = $derived(new Date().toISOString().split("T")[0]);
  const todayX = $derived(dateToX(todayStr));

  const projConfidenceBand = $derived.by(() => {
    if (!projection || projection.points.length < 2) return "";
    const upper = projection.points.map(
      (p) => `${dateToX(p.date)},${scaleY(p.weight_upper)}`,
    );
    const lower = [...projection.points]
      .reverse()
      .map((p) => `${dateToX(p.date)},${scaleY(p.weight_lower)}`);
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  });

  const projLine = $derived.by(() => {
    if (!projection || projection.points.length < 2) return "";
    return projection.points
      .map((p) => `${dateToX(p.date)},${scaleY(p.weight_kg)}`)
      .join(" ");
  });

  function fmtChange(v: number): string {
    return (v > 0 ? "+" : "") + v.toFixed(1);
  }
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ScaleIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">Weight Trend</Card.Title>
      </div>
      {#if stats}
        <Badge
          variant="outline"
          class="text-xs tabular-nums gap-1 {stats.totalChange <= 0
            ? 'text-emerald-400 border-emerald-500/20'
            : 'text-red-400 border-red-500/20'}"
        >
          <TrendingDownIcon class="h-3 w-3" />
          {fmtChange(stats.totalChange)} kg
        </Badge>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="px-2 pb-3">
    {#if sorted.length === 0}
      <div class="h-48 flex flex-col items-center justify-center">
        <ScaleIcon class="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p class="text-sm text-muted-foreground">No weight data yet</p>
      </div>
    {:else}
      <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stop-color="oklch(0.62 0.17 250)"
              stop-opacity="0.25"
            />
            <stop
              offset="100%"
              stop-color="oklch(0.62 0.17 250)"
              stop-opacity="0.02"
            />
          </linearGradient>
        </defs>

        <!-- Grid lines -->
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
            x={pad.left - 2}
            y={scaleY(tick) + 2}
            text-anchor="end"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{tick}</text
          >
        {/each}

        <!-- X labels -->
        {#each xLabels as { x, label } (x)}
          <text
            {x}
            y={chartH - 4}
            text-anchor="middle"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{label}</text
          >
        {/each}

        <!-- Goal line -->
        <line
          x1={pad.left}
          y1={goalY}
          x2={chartW - pad.right}
          y2={goalY}
          stroke="oklch(0.72 0.19 155)"
          stroke-width="0.5"
          stroke-dasharray="4,3"
        />
        <text
          x={chartW - pad.right - 1}
          y={goalY - 2}
          text-anchor="end"
          fill="oklch(0.72 0.19 155)"
          font-size="5"
          font-weight="600">{goalKg} kg</text
        >

        <!-- Area fill -->
        {#if areaPath}
          <path d={areaPath} fill="url(#weightFill)" />
        {/if}

        <!-- 7-day moving average -->
        {#if avgLine}
          <polyline
            points={avgLine}
            fill="none"
            stroke="oklch(0.62 0.17 250)"
            stroke-width="1.2"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.9"
          />
        {/if}

        <!-- Daily weight line -->
        <polyline
          points={weightLine}
          fill="none"
          stroke="oklch(0.62 0.17 250)"
          stroke-width="0.5"
          stroke-linejoin="round"
          opacity="0.35"
        />

        <!-- Data points -->
        {#each sorted as entry (entry.id)}
          <circle
            cx={dateToX(entry.date)}
            cy={scaleY(entry.weight_kg)}
            r="1.2"
            fill="oklch(0.62 0.17 250)"
            opacity="0.5"
          />
        {/each}

        <!-- Highlight latest point -->
        <circle
          cx={dateToX(sorted[sorted.length - 1].date)}
          cy={scaleY(sorted[sorted.length - 1].weight_kg)}
          r="2.5"
          fill="oklch(0.62 0.17 250)"
          stroke="var(--card)"
          stroke-width="1"
        />

        <!-- Gym markers -->
        {#each gymMarkers as marker (marker.date)}
          <g transform="translate({marker.x}, {marker.y - 12})">
            <text
              text-anchor="middle"
              fill="oklch(0.72 0.19 155)"
              font-size="5"
              font-weight="600">gym</text
            >
          </g>
        {/each}

        <!-- Projection overlay -->
        {#if projection}
          <!-- Today divider -->
          <line
            x1={todayX}
            y1={pad.top}
            x2={todayX}
            y2={chartH - pad.bottom}
            stroke="currentColor"
            class="text-muted-foreground"
            stroke-width="0.5"
            stroke-dasharray="3,2"
            opacity="0.5"
          />
          <text
            x={todayX}
            y={pad.top - 2}
            text-anchor="middle"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">Today</text
          >

          <!-- Confidence band -->
          {#if projConfidenceBand}
            <path
              d={projConfidenceBand}
              fill="oklch(0.72 0.14 195)"
              opacity="0.08"
            />
          {/if}

          <!-- Sample paths -->
          {#each projection.samplePaths as path}
            <polyline
              points={path.points
                .map((p) => `${dateToX(p.date)},${scaleY(p.weight_kg)}`)
                .join(" ")}
              fill="none"
              stroke="oklch(0.62 0.17 250)"
              stroke-width="0.8"
              opacity="0.18"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/each}

          <!-- Projection line -->
          {#if projLine}
            <polyline
              points={projLine}
              fill="none"
              stroke="oklch(0.62 0.17 250)"
              stroke-width="1"
              stroke-dasharray="4,2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/if}
        {/if}
      </svg>

      <!-- Legend -->
      <div
        class="flex items-center gap-4 mt-1.5 px-2 text-[10px] text-muted-foreground"
      >
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-0.5 rounded-full bg-blue-500 opacity-40 inline-block"
          ></span>
          Daily
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-4 h-0.5 rounded-full bg-blue-500 inline-block"></span>
          {movingAverageWindow}-day avg
        </span>
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-px border-t border-dashed border-emerald-500 inline-block"
          ></span>
          Goal
        </span>
        {#if projection}
          <span class="flex items-center gap-1.5">
            <span
              class="w-4 h-px border-t border-dashed border-blue-500 inline-block"
            ></span>
            Projected
          </span>
        {/if}
        {#if gymMarkers.length > 0}
          <span class="flex items-center gap-1">
            <DumbbellIcon class="h-2.5 w-2.5 text-emerald-400" />
            Gym
          </span>
        {/if}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
