<script lang="ts">
  import type { Workout } from "$lib/types";
  import { getAvgSetWeight } from "$lib/utils/progression";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import TrophyIcon from "@lucide/svelte/icons/trophy";

  interface Props {
    workouts: Workout[];
    exerciseName: string;
    color?: string;
    timeRange?: string;
    xDomainOverride?: { min: number; max: number };
  }

  let {
    workouts,
    exerciseName,
    color = "#3b82f6",
    timeRange = "all",
    xDomainOverride,
  }: Props = $props();

  const chartW = 800;
  const chartH = 120;
  const pad = { top: 6, right: 4, bottom: 18, left: 32 };

  // Normalize exercise name variants for matching
  function normalizeName(name: string): string {
    const lower = name.toLowerCase().trim();
    const aliases: Record<string, string> = {
      pullups: "Pull-ups",
      "pull-ups": "Pull-ups",
      "lat pulldown": "Lat Pulldown",
    };
    return aliases[lower] ?? name;
  }

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

  const dataPoints = $derived.by(() => {
    const points: { date: string; weight: number }[] = [];
    const cutoff = getDateCutoff(timeRange);
    for (let i = workouts.length - 1; i >= 0; i--) {
      const w = workouts[i];
      if (cutoff && new Date(w.date) < cutoff) continue;
      const exercise = w.exercises.find(
        (e) => normalizeName(e.name) === exerciseName,
      );
      if (exercise && exercise.sets.length > 0) {
        points.push({
          date: w.date,
          weight: getAvgSetWeight(exercise.sets, exercise.targetWeight_kg),
        });
      }
    }
    return points;
  });

  const latestWeight = $derived(
    dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].weight : 0,
  );
  const maxWeight = $derived(
    dataPoints.length > 0 ? Math.max(...dataPoints.map((p) => p.weight)) : 0,
  );
  const progression = $derived.by(() => {
    if (dataPoints.length < 2) return null;
    const diff =
      dataPoints[dataPoints.length - 1].weight - dataPoints[0].weight;
    return { diff, percent: ((diff / dataPoints[0].weight) * 100).toFixed(0) };
  });

  const yDomain = $derived.by(() => {
    if (dataPoints.length === 0) return { min: 0, max: 100 };
    const vals = dataPoints.map((p) => p.weight);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max((hi - lo) * 0.15, 2.5);
    return {
      min: Math.max(0, Math.floor((lo - margin) / 2.5) * 2.5),
      max: Math.ceil((hi + margin) / 2.5) * 2.5,
    };
  });

  // Date-based X domain for linear time axis (use shared override if provided)
  const xDomain = $derived.by(() => {
    if (xDomainOverride) return xDomainOverride;
    if (dataPoints.length === 0) return { min: 0, max: 1 };
    const times = dataPoints.map((p) =>
      new Date(p.date + "T00:00:00").getTime(),
    );
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

  const polyline = $derived(
    dataPoints.map((p) => `${dateToX(p.date)},${scaleY(p.weight)}`).join(" "),
  );
  const areaPath = $derived.by(() => {
    if (dataPoints.length < 2) return "";
    const bottom = chartH - pad.bottom;
    const pts = dataPoints.map((p) => `${dateToX(p.date)},${scaleY(p.weight)}`);
    return `M${dateToX(dataPoints[0].date)},${bottom} L${pts.join(" L")} L${dateToX(dataPoints[dataPoints.length - 1].date)},${bottom} Z`;
  });

  const yTicks = $derived.by(() => {
    const range = yDomain.max - yDomain.min;
    const step = range <= 10 ? 2.5 : range <= 30 ? 5 : range <= 60 ? 10 : 20;
    const ticks: number[] = [];
    for (let v = yDomain.min; v <= yDomain.max; v += step) ticks.push(v);
    return ticks;
  });

  const xLabels = $derived.by(() => {
    if (dataPoints.length <= 1) return [];
    const maxLabels = 6;
    const timeRange_ms = xDomain.max - xDomain.min;
    const step = timeRange_ms / maxLabels;
    const labels: { x: number; label: string }[] = [];
    const shortRange =
      timeRange === "1w" ||
      timeRange === "1m" ||
      timeRange === "3m" ||
      timeRange === "6m";
    for (let i = 0; i <= maxLabels; i++) {
      const t = xDomain.min + i * step;
      const d = new Date(t);
      const xPos = pad.left + (i / maxLabels) * (chartW - pad.left - pad.right);
      const label = shortRange
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleDateString("en-US", { year: "2-digit", month: "short" });
      labels.push({ x: xPos, label });
    }
    return labels;
  });

  const isPR = $derived(latestWeight === maxWeight && latestWeight > 0);

  // Year bands for visual differentiation (using actual Jan 1 boundaries)
  const yearBands = $derived.by(() => {
    if (dataPoints.length < 2) return [];
    const firstYear = new Date(dataPoints[0].date).getFullYear();
    const lastYear = new Date(
      dataPoints[dataPoints.length - 1].date,
    ).getFullYear();
    if (firstYear === lastYear) return []; // single year, no bands needed

    const bands: { year: number; x1: number; x2: number; even: boolean }[] = [];
    const chartLeft = pad.left;
    const chartRight = chartW - pad.right;

    for (let y = firstYear; y <= lastYear; y++) {
      const yearStart = `${y}-01-01`;
      const yearEnd = `${y}-12-31`;
      const x1 = Math.max(dateToX(yearStart), chartLeft);
      const x2 = Math.min(dateToX(yearEnd), chartRight);
      if (x2 > x1) {
        bands.push({
          year: y,
          x1,
          x2,
          even: (y - firstYear) % 2 === 0,
        });
      }
    }
    return bands;
  });
</script>

<Card.Root class="overflow-hidden">
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div
          class="w-2 h-2 rounded-full"
          style="background-color: {color}"
        ></div>
        <Card.Title class="text-sm font-semibold">{exerciseName}</Card.Title>
      </div>
      <div class="flex items-center gap-1.5">
        {#if isPR}
          <Badge
            variant="default"
            class="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1 px-1.5 py-0"
          >
            <TrophyIcon class="h-3 w-3" />
            PR
          </Badge>
        {:else if maxWeight > latestWeight}
          <Badge
            variant="outline"
            class="text-xs text-muted-foreground px-1.5 py-0"
          >
            PR {maxWeight}kg
          </Badge>
        {/if}
        <span
          class="text-sm font-mono font-bold tabular-nums"
          style="color: {color}">{latestWeight}kg</span
        >
        {#if progression}
          <Badge
            variant="outline"
            class="text-xs gap-0.5 px-1.5 py-0 {progression.diff > 0
              ? 'text-emerald-400 border-emerald-500/30'
              : progression.diff < 0
                ? 'text-red-400 border-red-500/30'
                : 'text-muted-foreground'}"
          >
            {#if progression.diff > 0}
              <TrendingUpIcon class="h-3 w-3" />
              +{progression.diff}kg
            {:else if progression.diff < 0}
              <TrendingDownIcon class="h-3 w-3" />
              {progression.diff}kg
            {:else}
              0kg
            {/if}
          </Badge>
        {/if}
      </div>
    </div>
  </Card.Header>

  <Card.Content class="p-0">
    {#if dataPoints.length >= 2}
      <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
        <defs>
          <linearGradient
            id="grad-{exerciseName.replace(/\s/g, '')}"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stop-color={color} stop-opacity="0.25" />
            <stop offset="100%" stop-color={color} stop-opacity="0.02" />
          </linearGradient>
        </defs>

        <!-- Year bands -->
        {#each yearBands as band (band.year)}
          {#if band.even}
            <rect
              x={band.x1}
              y={pad.top}
              width={band.x2 - band.x1}
              height={chartH - pad.top - pad.bottom}
              fill="currentColor"
              class="text-muted-foreground"
              opacity="0.04"
            />
          {/if}
          <!-- Year label at center of band -->
          {#if band.x2 - band.x1 > 30}
            <text
              x={(band.x1 + band.x2) / 2}
              y={pad.top + 8}
              text-anchor="middle"
              fill="currentColor"
              class="text-muted-foreground"
              font-size="5"
              opacity="0.35">{band.year}</text
            >
          {/if}
        {/each}

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

        {#each xLabels as { x, label } (x)}
          <text
            {x}
            y={chartH - 2}
            text-anchor="middle"
            fill="currentColor"
            class="text-muted-foreground"
            font-size="5">{label}</text
          >
        {/each}

        <path
          d={areaPath}
          fill="url(#grad-{exerciseName.replace(/\s/g, '')})"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          stroke-width="1.2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />

        {#if dataPoints.length > 0}
          <circle
            cx={dateToX(dataPoints[dataPoints.length - 1].date)}
            cy={scaleY(dataPoints[dataPoints.length - 1].weight)}
            r="2.5"
            fill={color}
            stroke="var(--card)"
            stroke-width="1"
          />
        {/if}
      </svg>
    {:else if dataPoints.length === 1}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        1 session @ {dataPoints[0].weight}kg — need more data for a chart
      </div>
    {:else}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        No data for this exercise
      </div>
    {/if}
  </Card.Content>
</Card.Root>
