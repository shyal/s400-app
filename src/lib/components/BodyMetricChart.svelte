<script lang="ts">
  import type { WeightEntry, SimulationResult } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";

  interface Props {
    entries: WeightEntry[];
    field: "muscle_mass_kg" | "body_fat_pct" | "visceral_fat";
    label: string;
    unit: string;
    color: string;
    icon: import("svelte").Component;
    /** Is lower better? (true for fat metrics, false for muscle) */
    lowerIsBetter?: boolean;
    /** Measurement error margin (± value) for shaded band */
    errorMargin?: number;
    projection?: SimulationResult;
    movingAverageWindow?: number;
  }

  let {
    entries,
    field,
    label,
    unit,
    color,
    icon,
    lowerIsBetter = true,
    errorMargin = 0,
    projection,
    movingAverageWindow = 7,
  }: Props = $props();

  const pad = { top: 10, right: 4, bottom: 18, left: 28 };
  const chartW = 800;
  const chartH = 400;

  // Filter to entries that have the field, sorted by date
  const sorted = $derived(
    [...entries]
      .filter((e) => e[field] != null)
      .sort((a, b) => a.date.localeCompare(b.date)),
  );

  const values = $derived(sorted.map((e) => e[field] as number));

  // Stats
  const stats = $derived.by(() => {
    if (values.length < 2) return null;
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    const isGood = lowerIsBetter ? change <= 0 : change >= 0;
    return { latest: last, change, isGood };
  });

  // Field-to-projection-key mapping
  const projKey = $derived.by(() => {
    const map: Record<
      string,
      { value: string; upper?: string; lower?: string }
    > = {
      body_fat_pct: {
        value: "body_fat_pct",
        upper: "bf_upper",
        lower: "bf_lower",
      },
      muscle_mass_kg: { value: "muscle_mass_kg" },
      visceral_fat: { value: "visceral_fat" },
    };
    return map[field];
  });

  // Y domain tight to data (account for error band + projection)
  const yDomain = $derived.by(() => {
    if (values.length === 0) return { min: 0, max: 100 };
    const allVals = [...values];
    if (projection && projKey) {
      for (const p of projection.points) {
        const v = (p as any)[projKey.value] as number;
        allVals.push(v);
        if (projKey.upper) allVals.push((p as any)[projKey.upper] as number);
        if (projKey.lower) allVals.push((p as any)[projKey.lower] as number);
      }
    }
    const lo = Math.min(...allVals) - errorMargin;
    const hi = Math.max(...allVals) + errorMargin;
    const margin = Math.max((hi - lo) * 0.08, 0.3);
    return {
      min: Math.floor((lo - margin) * 10) / 10,
      max: Math.ceil((hi + margin) * 10) / 10,
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

  // Moving average
  const movingAvg = $derived.by(() => {
    if (values.length < 2) return [];
    const window = movingAverageWindow;
    return values.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      return slice.reduce((s, v) => s + v, 0) / slice.length;
    });
  });

  const avgLine = $derived.by(() => {
    if (movingAvg.length < 2) return "";
    return movingAvg
      .map((v, i) => `${dateToX(sorted[i].date)},${scaleY(v)}`)
      .join(" ");
  });

  const dataLine = $derived(
    sorted.map((e, i) => `${dateToX(e.date)},${scaleY(values[i])}`).join(" "),
  );

  const yTicks = $derived.by(() => {
    const range = yDomain.max - yDomain.min;
    let step: number;
    if (range <= 3) step = 0.5;
    else if (range <= 6) step = 1;
    else if (range <= 15) step = 2;
    else step = 5;
    const ticks: number[] = [];
    const start = Math.ceil(yDomain.min / step) * step;
    for (let v = start; v <= yDomain.max; v += step)
      ticks.push(Math.round(v * 10) / 10);
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

  // Error band path around the data line
  const errorBandPath = $derived.by(() => {
    if (errorMargin <= 0 || values.length < 2) return "";
    const upper = values.map(
      (v, i) => `${dateToX(sorted[i].date)},${scaleY(v + errorMargin)}`,
    );
    const lower = values
      .map((v, i) => `${dateToX(sorted[i].date)},${scaleY(v - errorMargin)}`)
      .reverse();
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  });

  // Projection overlay data
  const todayStr = $derived(new Date().toISOString().split("T")[0]);
  const todayX = $derived(dateToX(todayStr));

  const projConfidenceBand = $derived.by(() => {
    if (!projection || !projKey?.upper || projection.points.length < 2)
      return "";
    const upper = projection.points.map(
      (p) => `${dateToX(p.date)},${scaleY((p as any)[projKey.upper!])}`,
    );
    const lower = [...projection.points]
      .reverse()
      .map((p) => `${dateToX(p.date)},${scaleY((p as any)[projKey.lower!])}`);
    return `M${upper.join(" L")} L${lower.join(" L")} Z`;
  });

  const projLine = $derived.by(() => {
    if (!projection || !projKey || projection.points.length < 2) return "";
    return projection.points
      .map((p) => `${dateToX(p.date)},${scaleY((p as any)[projKey.value])}`)
      .join(" ");
  });

  function fmtChange(v: number): string {
    return (v > 0 ? "+" : "") + v.toFixed(1);
  }
</script>

<Card.Root class="overflow-hidden">
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <svelte:boundary>
          {@const Icon = icon}
          <Icon class="h-4 w-4 text-muted-foreground" />
        </svelte:boundary>
        <Card.Title class="text-sm font-semibold">{label}</Card.Title>
      </div>
      {#if stats}
        <div class="flex items-center gap-1.5">
          <span
            class="text-sm font-mono font-bold tabular-nums"
            style="color: {color}">{stats.latest.toFixed(1)}{unit}</span
          >
          <Badge
            variant="outline"
            class="text-xs gap-0.5 px-1.5 py-0 {stats.isGood
              ? 'text-emerald-400 border-emerald-500/30'
              : 'text-red-400 border-red-500/30'}"
          >
            {#if stats.change > 0}
              <TrendingUpIcon class="h-3 w-3" />
            {:else}
              <TrendingDownIcon class="h-3 w-3" />
            {/if}
            {fmtChange(stats.change)}
          </Badge>
        </div>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="p-0">
    {#if sorted.length >= 2}
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

        <!-- Error band around data line -->
        {#if errorBandPath}
          <path d={errorBandPath} fill={color} opacity="0.12" />
        {/if}

        <!-- Moving average line -->
        {#if avgLine}
          <polyline
            points={avgLine}
            fill="none"
            stroke={color}
            stroke-width="1.2"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.9"
          />
        {/if}

        <!-- Data line -->
        <polyline
          points={dataLine}
          fill="none"
          stroke={color}
          stroke-width="0.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.35"
        />

        <!-- Data points -->
        {#each sorted as entry, i (entry.id)}
          <circle
            cx={dateToX(entry.date)}
            cy={scaleY(values[i])}
            r="1.2"
            fill={color}
            opacity="0.5"
          />
        {/each}

        <!-- Latest point -->
        <circle
          cx={dateToX(sorted[sorted.length - 1].date)}
          cy={scaleY(values[values.length - 1])}
          r="2.5"
          fill={color}
          stroke="var(--card)"
          stroke-width="1"
        />

        <!-- Projection overlay -->
        {#if projection && projKey}
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
            <path d={projConfidenceBand} fill={color} opacity="0.08" />
          {/if}

          <!-- Sample paths -->
          {#each projection.samplePaths as path}
            {#if path.points.length > 0 && (path.points[0] as any)[projKey.value] !== 0}
              <polyline
                points={path.points
                  .map(
                    (p) =>
                      `${dateToX(p.date)},${scaleY((p as any)[projKey.value])}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={color}
                stroke-width="0.8"
                opacity="0.18"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
            {/if}
          {/each}

          <!-- Projection line -->
          {#if projLine}
            <polyline
              points={projLine}
              fill="none"
              stroke={color}
              stroke-width="1"
              stroke-dasharray="4,2"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          {/if}
        {/if}
      </svg>

      <!-- Error margin note -->
      {#if errorMargin > 0}
        <div class="text-[10px] text-muted-foreground px-4 pb-2 text-right">
          ±{errorMargin}{unit} measurement error
        </div>
      {/if}
    {:else if sorted.length === 1}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        1 reading — need more data for a chart
      </div>
    {:else}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        No {label.toLowerCase()} data
      </div>
    {/if}
  </Card.Content>
</Card.Root>
