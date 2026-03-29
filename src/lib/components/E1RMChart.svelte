<script lang="ts">
  import type { Workout } from "$lib/types";
  import { epleyE1RM } from "$lib/utils/progression";
  import {
    mulberry32,
    boxMullerTransform,
  } from "$lib/services/simulationEngine";
  import * as Card from "$lib/components/ui/card";
  import TrophyIcon from "@lucide/svelte/icons/trophy";

  interface Props {
    workouts: Workout[];
    showProjection?: boolean;
    projectionDays?: number;
  }

  let {
    workouts,
    showProjection = false,
    projectionDays = 90,
  }: Props = $props();

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
    let maxT = Math.max(...times);
    if (hasProjections) {
      for (const name of Object.keys(liftProjections)) {
        const pp = liftProjections[name].projPoints;
        if (pp.length > 0) {
          const lastT = new Date(
            pp[pp.length - 1].date + "T00:00:00",
          ).getTime();
          if (lastT > maxT) maxT = lastT;
        }
      }
    }
    return { min: Math.min(...times), max: maxT };
  });

  const yDomain = $derived.by(() => {
    if (allPoints.length === 0) return { min: 0, max: 100 };
    const vals = allPoints.map((p) => p.e1rm);
    if (hasProjections) {
      for (const name of Object.keys(liftProjections)) {
        for (const p of liftProjections[name].projPoints) {
          vals.push(p.upper, p.lower);
        }
      }
    }
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

  // ── Monte Carlo e1RM Projections ──
  type ProjPoint = {
    date: string;
    median: number;
    upper: number;
    lower: number;
  };
  type LiftProjection = { projPoints: ProjPoint[] };

  const liftProjections = $derived.by(() => {
    if (!showProjection) return {} as Record<string, LiftProjection>;
    const result: Record<string, LiftProjection> = {};

    for (const name of activLifts) {
      const pts = liftData[name];
      if (pts.length < 3) continue;

      const t0 = new Date(pts[0].date + "T00:00:00").getTime();
      const mapped = pts.map((p) => ({
        x: (new Date(p.date + "T00:00:00").getTime() - t0) / 86400000,
        y: p.e1rm,
      }));

      const n = mapped.length;
      let sx = 0,
        sy = 0,
        sxx = 0,
        sxy = 0;
      for (const p of mapped) {
        sx += p.x;
        sy += p.y;
        sxx += p.x * p.x;
        sxy += p.x * p.y;
      }
      const denom = n * sxx - sx * sx;
      if (Math.abs(denom) < 1e-12) continue;
      const slope = (n * sxy - sx * sy) / denom;
      const intercept = (sy - slope * sx) / n;

      let ssRes = 0;
      for (const p of mapped) ssRes += (p.y - (intercept + slope * p.x)) ** 2;
      const residStd = Math.sqrt(ssRes / n);

      const diffs: number[] = [];
      for (let i = 1; i < mapped.length; i++) {
        const gap = mapped[i].x - mapped[i - 1].x;
        if (gap > 0)
          diffs.push((mapped[i].y - mapped[i - 1].y) / Math.sqrt(gap));
      }
      const vol =
        diffs.length > 0
          ? Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length)
          : residStd * 0.1;

      const lastDay = mapped[mapped.length - 1].x;
      const lastVal = pts[pts.length - 1].e1rm;
      // Use a different seed per exercise for variety
      const seed = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      const rng = mulberry32(seed);
      const numPaths = 30;
      const allPaths: number[][] = [];

      for (let p = 0; p < numPaths; p++) {
        const path: number[] = [];
        let v = lastVal;
        for (let day = 1; day <= projectionDays; day++) {
          const trendVal = intercept + slope * (lastDay + day);
          const noise = boxMullerTransform(rng) * vol;
          v = v + slope + noise;
          v = v * 0.98 + trendVal * 0.02;
          path.push(Math.max(0, v));
        }
        allPaths.push(path);
      }

      const today = new Date();
      const projPoints: ProjPoint[] = [];
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

      result[name] = { projPoints };
    }
    return result;
  });

  const hasProjections = $derived(
    showProjection && Object.keys(liftProjections).length > 0,
  );
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
          <!-- Projection band + median -->
          {#if liftProjections[name]}
            {@const pp = liftProjections[name].projPoints}
            {@const bandD = (() => {
              let d = `M ${dateToX(pp[0].date)},${scaleY(pp[0].upper)}`;
              for (const p of pp)
                d += ` L ${dateToX(p.date)},${scaleY(p.upper)}`;
              for (let i = pp.length - 1; i >= 0; i--)
                d += ` L ${dateToX(pp[i].date)},${scaleY(pp[i].lower)}`;
              d += " Z";
              return d;
            })()}
            {@const medD = pp
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"} ${dateToX(p.date)},${scaleY(p.median)}`,
              )
              .join(" ")}
            <path d={bandD} fill={liftColors[name]} opacity="0.06" />
            <path
              d={medD}
              stroke={liftColors[name]}
              stroke-width="1"
              fill="none"
              stroke-dasharray="4,3"
              opacity="0.4"
            />
          {/if}

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
