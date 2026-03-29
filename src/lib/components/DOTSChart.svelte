<script lang="ts">
  import type { Workout, WeightEntry } from "$lib/types";
  import { epleyE1RM } from "$lib/utils/progression";
  import * as Card from "$lib/components/ui/card";
  import TrophyIcon from "@lucide/svelte/icons/trophy";
  import {
    mulberry32,
    boxMullerTransform,
  } from "$lib/services/simulationEngine";

  interface Props {
    workouts: Workout[];
    entries: WeightEntry[];
    showProjection?: boolean;
    projectionDays?: number;
  }

  let {
    workouts,
    entries,
    showProjection = false,
    projectionDays = 90,
  }: Props = $props();

  const pad = { top: 12, right: 8, bottom: 18, left: 32 };
  const chartW = 800;
  const chartH = 220;

  // ── DOTS coefficient (male) ──
  // DOTS = total × 500 / (A·bw⁴ + B·bw³ + C·bw² + D·bw + E)
  const DOTS_A = -0.000001093;
  const DOTS_B = 0.0007391293;
  const DOTS_C = -0.1918759221;
  const DOTS_D = 24.0900756104;
  const DOTS_E = -307.75076;

  function dotsCoeff(bw: number): number {
    const denom =
      DOTS_A * bw ** 4 +
      DOTS_B * bw ** 3 +
      DOTS_C * bw ** 2 +
      DOTS_D * bw +
      DOTS_E;
    return denom > 0 ? 500 / denom : 0;
  }

  function dotsScore(totalKg: number, bw: number): number {
    return totalKg * dotsCoeff(bw);
  }

  // Tier thresholds & labels
  const tiers = [
    { score: 150, label: "Beginner", color: "#94a3b8" },
    { score: 250, label: "Intermediate", color: "#22d3ee" },
    { score: 350, label: "Advanced", color: "#a78bfa" },
    { score: 450, label: "Elite", color: "#fbbf24" },
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

  // SBD = Squat + Bench + Deadlift (the big 3)
  const sbdLifts = ["Squat", "Bench Press", "Deadlift"];

  // ISO week grouping
  function weekOf(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    const week = Math.ceil((days + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  // Compute weekly DOTS score
  const weeklyData = $derived.by(() => {
    const thisYear = new Date().getFullYear().toString();
    const sorted = [...workouts]
      .filter((w) => w.date.startsWith(thisYear))
      .sort((a, b) => a.date.localeCompare(b.date));

    const currentE1RM: Record<string, number> = {};
    const weekMap = new Map<
      string,
      {
        date: string;
        dots: number;
        total: number;
        bw: number;
        lifts: Record<string, number>;
      }
    >();

    for (const w of sorted) {
      for (const ex of w.exercises) {
        if (!sbdLifts.includes(ex.name)) continue;
        let best = 0;
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const e1rm = epleyE1RM(set.weight_kg, set.reps);
          if (e1rm > best) best = e1rm;
        }
        if (best > 0) currentE1RM[ex.name] = best;
      }

      // Need at least 2 of the big 3
      const tracked = sbdLifts.filter((l) => currentE1RM[l] != null);
      if (tracked.length < 2) continue;

      const bw = getWeightAtDate(w.date);
      if (!bw) continue;

      const total = tracked.reduce((s, l) => s + currentE1RM[l], 0);
      const dots = dotsScore(total, bw);
      const week = weekOf(w.date);

      weekMap.set(week, {
        date: w.date,
        dots,
        total,
        bw,
        lifts: { ...currentE1RM },
      });
    }

    return [...weekMap.values()];
  });

  const hasData = $derived(weeklyData.length >= 2);

  // ── Monte Carlo DOTS Projection ──
  const dotsProjection = $derived.by(() => {
    if (!showProjection || weeklyData.length < 3) return null;

    const t0 = new Date(weeklyData[0].date + "T00:00:00").getTime();
    const pts = weeklyData.map((p) => ({
      x: (new Date(p.date + "T00:00:00").getTime() - t0) / 86400000,
      y: p.dots,
    }));
    const n = pts.length;
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (const p of pts) {
      sx += p.x;
      sy += p.y;
      sxx += p.x * p.x;
      sxy += p.x * p.y;
    }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-12) return null;
    const slope = (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;

    let ssRes = 0;
    for (const p of pts) ssRes += (p.y - (intercept + slope * p.x)) ** 2;
    const residStd = Math.sqrt(ssRes / n);

    const diffs: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const dayGap = pts[i].x - pts[i - 1].x;
      if (dayGap > 0) diffs.push((pts[i].y - pts[i - 1].y) / Math.sqrt(dayGap));
    }
    const vol =
      diffs.length > 0
        ? Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length)
        : residStd * 0.1;

    const lastDay = pts[pts.length - 1].x;
    const lastDOTS = weeklyData[weeklyData.length - 1].dots;
    const rng = mulberry32(42);
    const numPaths = 30;
    const allPaths: number[][] = [];

    for (let p = 0; p < numPaths; p++) {
      const path: number[] = [];
      let d = lastDOTS;
      for (let day = 1; day <= projectionDays; day++) {
        const trendVal = intercept + slope * (lastDay + day);
        const noise = boxMullerTransform(rng) * vol;
        d = d + slope + noise;
        d = d * 0.98 + trendVal * 0.02;
        path.push(Math.max(0, d));
      }
      allPaths.push(path);
    }

    const today = new Date();
    const projPoints: {
      date: string;
      median: number;
      upper: number;
      lower: number;
    }[] = [];
    for (let d = 0; d < projectionDays; d++) {
      const vals = allPaths.map((p) => p[d]).sort((a, b) => a - b);
      const pDate = new Date(today.getTime() + (d + 1) * 86400000);
      projPoints.push({
        date: pDate.toISOString().split("T")[0],
        median: vals[Math.floor(vals.length * 0.5)],
        upper: vals[Math.floor(vals.length * 0.95)],
        lower: vals[Math.floor(vals.length * 0.05)],
      });
    }

    return { projPoints, slope };
  });

  // ── Chart scales ──
  const xDomain = $derived.by(() => {
    if (weeklyData.length === 0) return { min: 0, max: 1 };
    const times = weeklyData.map((p) =>
      new Date(p.date + "T00:00:00").getTime(),
    );
    let maxT = Math.max(...times);
    if (dotsProjection && dotsProjection.projPoints.length > 0) {
      const lastProjDate =
        dotsProjection.projPoints[dotsProjection.projPoints.length - 1].date;
      maxT = Math.max(maxT, new Date(lastProjDate + "T00:00:00").getTime());
    }
    return { min: Math.min(...times), max: maxT };
  });

  const yDomain = $derived.by(() => {
    if (weeklyData.length === 0) return { min: 0, max: 300 };
    const vals = weeklyData.map((p) => p.dots);
    if (dotsProjection) {
      for (const p of dotsProjection.projPoints) {
        vals.push(p.upper, p.lower);
      }
    }
    // Include tier lines that are near the data range
    const dataMax = Math.max(...vals);
    for (const t of tiers) {
      if (t.score <= dataMax * 1.5) vals.push(t.score);
    }
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max((hi - lo) * 0.15, 20);
    return {
      min: Math.max(0, Math.floor((lo - margin) / 25) * 25),
      max: Math.ceil((hi + margin) / 25) * 25,
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
    const step = range <= 100 ? 25 : range <= 200 ? 50 : 100;
    const ticks: number[] = [];
    const start = Math.ceil(yDomain.min / step) * step;
    for (let v = start; v <= yDomain.max + 0.1; v += step) {
      ticks.push(Math.round(v));
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

  const linePath = $derived.by(() => {
    if (weeklyData.length < 2) return "";
    return weeklyData
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${dateToX(p.date)},${scaleY(p.dots)}`,
      )
      .join(" ");
  });

  const areaPath = $derived.by(() => {
    if (weeklyData.length < 2) return "";
    const baseY = scaleY(yDomain.min);
    let d = `M ${dateToX(weeklyData[0].date)},${baseY}`;
    for (const p of weeklyData) d += ` L ${dateToX(p.date)},${scaleY(p.dots)}`;
    d += ` L ${dateToX(weeklyData[weeklyData.length - 1].date)},${baseY} Z`;
    return d;
  });

  const latest = $derived(
    weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : null,
  );
  const first = $derived(weeklyData.length > 0 ? weeklyData[0] : null);
  const change = $derived(latest && first ? latest.dots - first.dots : 0);
  const changePct = $derived(
    latest && first && first.dots > 0 ? (change / first.dots) * 100 : 0,
  );

  // Current tier
  const currentTier = $derived.by(() => {
    if (!latest) return null;
    let tier = "Untrained";
    for (const t of tiers) {
      if (latest.dots >= t.score) tier = t.label;
    }
    return tier;
  });

  // Visible tier lines (within y-domain)
  const visibleTiers = $derived(
    tiers.filter((t) => t.score >= yDomain.min && t.score <= yDomain.max),
  );
</script>

<Card.Root class="overflow-hidden">
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <TrophyIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">DOTS Score</Card.Title>
      </div>
      {#if latest}
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold font-mono tabular-nums text-amber-400">
            {Math.round(latest.dots)}
          </span>
          {#if currentTier}
            <span
              class="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted"
            >
              {currentTier}
            </span>
          {/if}
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
      {#if latest}
        SBD Total: {Math.round(latest.total)}kg at {latest.bw.toFixed(1)}kg BW
        &middot; S:{Math.round(latest.lifts["Squat"] ?? 0)}
        B:{Math.round(latest.lifts["Bench Press"] ?? 0)}
        D:{Math.round(latest.lifts["Deadlift"] ?? 0)}
      {:else}
        Squat + Bench + Deadlift e1RM, normalized for bodyweight
      {/if}
    </p>
  </Card.Header>

  <Card.Content class="p-0">
    {#if hasData}
      <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
        <defs>
          <linearGradient id="dots-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.2" />
            <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.02" />
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

        <!-- Tier lines -->
        {#each visibleTiers as tier (tier.score)}
          <line
            x1={pad.left}
            y1={scaleY(tier.score)}
            x2={chartW - pad.right}
            y2={scaleY(tier.score)}
            stroke={tier.color}
            stroke-width="0.7"
            stroke-dasharray="6,4"
            opacity="0.35"
          />
          <text
            x={chartW - pad.right - 2}
            y={scaleY(tier.score) - 3}
            text-anchor="end"
            fill={tier.color}
            font-size="5"
            font-weight="500"
            opacity="0.6"
          >
            {tier.label}
          </text>
        {/each}

        <!-- Area -->
        <path d={areaPath} fill="url(#dots-grad)" />

        <!-- Projection -->
        {#if dotsProjection && dotsProjection.projPoints.length > 0}
          {@const pts = dotsProjection.projPoints}
          {@const bandPath = (() => {
            let d = `M ${dateToX(pts[0].date)},${scaleY(pts[0].upper)}`;
            for (const p of pts)
              d += ` L ${dateToX(p.date)},${scaleY(p.upper)}`;
            for (let i = pts.length - 1; i >= 0; i--)
              d += ` L ${dateToX(pts[i].date)},${scaleY(pts[i].lower)}`;
            d += " Z";
            return d;
          })()}
          {@const medianPath = pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"} ${dateToX(p.date)},${scaleY(p.median)}`,
            )
            .join(" ")}
          <path d={bandPath} fill="#fbbf24" opacity="0.06" />
          <path
            d={medianPath}
            stroke="#fbbf24"
            stroke-width="1.5"
            fill="none"
            stroke-dasharray="4,3"
            opacity="0.5"
          />
        {/if}

        <!-- Line -->
        <path
          d={linePath}
          stroke="#fbbf24"
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
            cy={scaleY(lastPt.dots)}
            r="3.5"
            fill="#fbbf24"
            stroke="var(--card)"
            stroke-width="1.5"
          />
        {/if}
      </svg>
    {:else}
      <div class="text-sm text-muted-foreground text-center py-6 px-4">
        Need at least 2 of Squat, Bench, Deadlift tracked
      </div>
    {/if}
  </Card.Content>
</Card.Root>
