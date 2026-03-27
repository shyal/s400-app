<script lang="ts">
  import type {
    FoodEntry,
    StravaActivity,
    GlucoseReading,
    GlucoseModelParams,
    GlucoseModelType,
  } from "$lib/types";
  import { toMgDl } from "$lib/services/glucoseData";
  import * as Card from "$lib/components/ui/card";

  import { Badge } from "$lib/components/ui/badge";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import FlameIcon from "@lucide/svelte/icons/flame";

  import type { GlucosePoint } from "$lib/services/glucoseModel";
  import type { GPGlucosePoint } from "$lib/services/glucoseModelGP";

  interface Props {
    entries: FoodEntry[];
    isToday?: boolean;
    rideWindow?: { startMin: number; endMin: number } | null;
    activities?: StravaActivity[];
    glucoseReadings?: GlucoseReading[];
    predictedGlucose?: GlucosePoint[] | GPGlucosePoint[];
    modelLabel?: string;
    feedingWindow?: { opensAt: string | null; closesAt: string | null } | null;
    glucoseParams?: GlucoseModelParams;
    glucoseModelType?: GlucoseModelType;
    onModelChange?: (model: GlucoseModelType) => void;
  }

  let {
    entries,
    isToday = false,
    rideWindow = null,
    activities = [],
    glucoseReadings = [],
    predictedGlucose = [],
    modelLabel = "",
    feedingWindow = null,
    glucoseParams,
    glucoseModelType = "parametric",
    onModelChange,
  }: Props = $props();

  const isGP = $derived(glucoseModelType === "gp");
  const gpPoints = $derived(
    isGP ? (predictedGlucose as GPGlucosePoint[]) : null,
  );

  /** Parse feeding window times to minutes */
  const feedingBand = $derived.by(() => {
    if (!feedingWindow?.opensAt || !feedingWindow?.closesAt) return null;
    const [oh, om] = feedingWindow.opensAt.split(":").map(Number);
    const [ch, cm] = feedingWindow.closesAt.split(":").map(Number);
    return { startMin: oh * 60 + om, endMin: ch * 60 + cm };
  });

  /** Convert strava activities to time bands for chart overlay */
  const activityBands = $derived(
    activities
      .filter((a) => a.type === "Ride")
      .map((a) => {
        const d = new Date(a.start_date);
        const startMin = d.getHours() * 60 + d.getMinutes();
        const endMin = startMin + Math.round(a.moving_time_sec / 60);
        const distKm = Math.round(a.distance_m / 100) / 10;
        return { startMin, endMin, name: a.name, distKm };
      }),
  );

  const START_HOUR = 0;
  const END_HOUR = 24;
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;
  const STEP = 5;

  const hasGlucose = $derived(glucoseReadings.length > 0);
  const hasPrediction = $derived(predictedGlucose.length > 0);
  const pad = { top: 12, right: 8, bottom: 22, left: 36 };
  const chartW = 800;
  const chartH = 300;

  // ── Glucose scale (sole Y-axis) ──

  const GLUCOSE_MIN = 50;
  const GLUCOSE_MAX = 200;
  const GLUCOSE_HYPO = 70;
  const GLUCOSE_FASTING = 100;
  const GLUCOSE_POST_MEAL = 140;

  /** Parse "HH:MM" time string to minutes since midnight */
  function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function scaleX(min: number): number {
    const startMin = START_HOUR * 60;
    return (
      pad.left +
      ((min - startMin) / TOTAL_MINUTES) * (chartW - pad.left - pad.right)
    );
  }

  function scaleGlucoseY(mgdl: number): number {
    const ratio = (mgdl - GLUCOSE_MIN) / (GLUCOSE_MAX - GLUCOSE_MIN);
    return pad.top + (1 - ratio) * (chartH - pad.top - pad.bottom);
  }

  /** X-axis time labels every 3 hours */
  const xLabels = $derived.by(() => {
    const labels: { x: number; label: string }[] = [];
    for (let h = START_HOUR; h <= END_HOUR; h += 3) {
      const min = h * 60;
      const display = h === 0 || h === 24 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 || h === 24 ? "am" : "pm";
      labels.push({ x: scaleX(min), label: `${display}${ampm}` });
    }
    return labels;
  });

  /** Current time marker */
  let nowMin = $state<number | null>(null);

  function updateNow() {
    if (!isToday) {
      nowMin = null;
      return;
    }
    const now = new Date();
    nowMin = now.getHours() * 60 + now.getMinutes();
  }

  $effect(() => {
    updateNow();
    const id = setInterval(updateNow, 60_000);
    return () => clearInterval(id);
  });

  const nowX = $derived(nowMin !== null ? scaleX(nowMin) : 0);

  /** Fasting baseline from model params */
  const baseline = $derived(glucoseParams?.fasting_baseline_mgdl ?? 90);

  /** SVG polyline for predicted glucose curve (solid primary) */
  const filteredPrediction = $derived(
    predictedGlucose.filter((p) => p.value > 0),
  );

  const predictedGlucosePath = $derived(
    filteredPrediction
      .map((p) => `${scaleX(p.timeMin)},${scaleGlucoseY(p.value)}`)
      .join(" "),
  );

  /** SVG path for the filled area under the predicted glucose curve */
  const predictedAreaPath = $derived.by(() => {
    if (filteredPrediction.length === 0) return "";
    const bottom = chartH - pad.bottom;
    const pts = filteredPrediction.map(
      (p) => `${scaleX(p.timeMin)},${scaleGlucoseY(p.value)}`,
    );
    return `M${scaleX(filteredPrediction[0].timeMin)},${bottom} L${pts.join(" L")} L${scaleX(filteredPrediction[filteredPrediction.length - 1].timeMin)},${bottom} Z`;
  });

  /** Glucose markers positioned on the chart */
  const glucoseMarkers = $derived(
    glucoseReadings.map((r) => {
      const mgdl = toMgDl(r.value, r.unit);
      const min = timeToMinutes(r.time);
      return {
        x: scaleX(min),
        y: scaleGlucoseY(mgdl),
        mgdl: Math.round(mgdl),
        time: r.time,
      };
    }),
  );

  /** Glucose zone bands */
  const ZONE_NORMAL_TOP = $derived(scaleGlucoseY(100));
  const ZONE_NORMAL_BOTTOM = $derived(scaleGlucoseY(70));
  const ZONE_ELEVATED_TOP = $derived(scaleGlucoseY(140));
  const ZONE_ELEVATED_BOTTOM = $derived(scaleGlucoseY(100));

  /** Meal markers — placed on the predicted BG curve at meal time, or at baseline */
  const mealMarkers = $derived(
    entries.map((e) => {
      const min = timeToMinutes(e.time);
      // Find nearest predicted point, or fall back to baseline
      let bgAtMeal = baseline;
      if (filteredPrediction.length > 0) {
        let closest = filteredPrediction[0];
        let bestDist = Math.abs(closest.timeMin - min);
        for (const p of filteredPrediction) {
          const d = Math.abs(p.timeMin - min);
          if (d < bestDist) {
            closest = p;
            bestDist = d;
          }
        }
        if (bestDist <= STEP) bgAtMeal = closest.value;
      }
      return {
        x: scaleX(min),
        y: scaleGlucoseY(bgAtMeal),
        name: e.name,
        time: e.time,
      };
    }),
  );

  /** SVG path for GP confidence ribbon (upper forward, lower backward) */
  const confidenceRibbonPath = $derived.by(() => {
    if (!gpPoints || gpPoints.length === 0) return "";
    const filtered = gpPoints.filter((p) => p.value > 0);
    if (filtered.length === 0) return "";
    const upper = filtered.map(
      (p) => `${scaleX(p.timeMin)},${scaleGlucoseY(p.upper)}`,
    );
    const lower = filtered.map(
      (p) => `${scaleX(p.timeMin)},${scaleGlucoseY(p.lower)}`,
    );
    return `M${upper.join(" L")} L${lower.reverse().join(" L")} Z`;
  });

  /** Fat burn hours: time where predicted BG ≤ baseline + 5 (low insulin) */
  const fatBurnHours = $derived.by(() => {
    if (filteredPrediction.length === 0) return 0;
    const threshold = baseline + 5;
    let minutes = 0;
    for (const p of filteredPrediction) {
      if (p.value <= threshold) minutes += STEP;
    }
    return Math.round((minutes / 60) * 10) / 10;
  });
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <ActivityIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">Glucose Response</Card.Title>
        {#if modelLabel}
          <Badge
            variant="secondary"
            class="text-[10px] px-1.5 py-0 {modelLabel === 'Personalized'
              ? 'text-emerald-400'
              : modelLabel.startsWith('Learning')
                ? 'text-amber-400'
                : 'text-muted-foreground'}"
          >
            {modelLabel}
          </Badge>
        {/if}
        {#if onModelChange}
          <select
            value={glucoseModelType}
            onchange={(e) =>
              onModelChange?.(
                (e.currentTarget as HTMLSelectElement)
                  .value as GlucoseModelType,
              )}
            class="h-5 rounded border border-input bg-transparent px-1 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="parametric">Parametric</option>
            <option value="gp">GP Hybrid</option>
          </select>
        {/if}
      </div>
      {#if hasPrediction}
        <Badge
          variant="outline"
          class="text-[10px] tabular-nums gap-1 {fatBurnHours >= 16
            ? 'text-emerald-400 border-emerald-500/30'
            : fatBurnHours >= 12
              ? 'text-amber-400 border-amber-500/30'
              : 'text-muted-foreground'}"
        >
          <FlameIcon class="h-3 w-3" />
          {fatBurnHours}h fat burn
        </Badge>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="px-2 pb-3">
    <svg viewBox="0 0 {chartW} {chartH}" class="w-full block">
      <defs>
        <linearGradient id="glucoseFill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stop-color="oklch(0.72 0.17 45)"
            stop-opacity="0.25"
          />
          <stop
            offset="100%"
            stop-color="oklch(0.72 0.17 45)"
            stop-opacity="0.03"
          />
        </linearGradient>
      </defs>

      <!-- Zone bands -->
      <rect
        x={pad.left}
        y={ZONE_NORMAL_TOP}
        width={chartW - pad.left - pad.right}
        height={ZONE_NORMAL_BOTTOM - ZONE_NORMAL_TOP}
        fill="oklch(0.72 0.19 155)"
        fill-opacity="0.04"
      />
      <rect
        x={pad.left}
        y={ZONE_ELEVATED_TOP}
        width={chartW - pad.left - pad.right}
        height={ZONE_ELEVATED_BOTTOM - ZONE_ELEVATED_TOP}
        fill="oklch(0.75 0.15 70)"
        fill-opacity="0.04"
      />

      <!-- Reference lines (70 / 100 / 140) -->
      {#each [{ val: GLUCOSE_HYPO, color: "oklch(0.7 0.18 30)", label: "70" }, { val: GLUCOSE_FASTING, color: "oklch(0.7 0.12 90)", label: "100" }, { val: GLUCOSE_POST_MEAL, color: "oklch(0.7 0.15 50)", label: "140" }] as ref (ref.val)}
        <line
          x1={pad.left}
          y1={scaleGlucoseY(ref.val)}
          x2={chartW - pad.right}
          y2={scaleGlucoseY(ref.val)}
          stroke={ref.color}
          stroke-width="0.4"
          stroke-dasharray="2,3"
          stroke-opacity="0.5"
        />
        <text
          x={pad.left - 2}
          y={scaleGlucoseY(ref.val) + 2}
          text-anchor="end"
          font-size="4.5"
          fill={ref.color}
          opacity="0.7">{ref.label}</text
        >
      {/each}

      <!-- Left Y-axis label -->
      <text
        x={pad.left - 2}
        y={pad.top - 3}
        text-anchor="end"
        font-size="4"
        fill="oklch(0.65 0.15 45)"
        font-weight="600">mg/dL</text
      >

      <!-- X labels -->
      {#each xLabels as { x, label }, i (i)}
        <text
          {x}
          y={chartH - 5}
          text-anchor="middle"
          fill="currentColor"
          class="text-muted-foreground"
          font-size="5">{label}</text
        >
      {/each}

      <!-- IF feeding window -->
      {#if feedingBand}
        {#if feedingBand.startMin > START_HOUR * 60}
          <rect
            x={scaleX(START_HOUR * 60)}
            y={pad.top}
            width={scaleX(feedingBand.startMin) - scaleX(START_HOUR * 60)}
            height={chartH - pad.top - pad.bottom}
            fill="oklch(0.65 0.15 25)"
            fill-opacity="0.04"
          />
        {/if}
        {#if feedingBand.endMin < END_HOUR * 60}
          <rect
            x={scaleX(feedingBand.endMin)}
            y={pad.top}
            width={scaleX(END_HOUR * 60) - scaleX(feedingBand.endMin)}
            height={chartH - pad.top - pad.bottom}
            fill="oklch(0.65 0.15 25)"
            fill-opacity="0.04"
          />
        {/if}
        <line
          x1={scaleX(feedingBand.startMin)}
          y1={pad.top}
          x2={scaleX(feedingBand.startMin)}
          y2={chartH - pad.bottom}
          stroke="oklch(0.7 0.18 145)"
          stroke-width="0.8"
          stroke-dasharray="4,3"
        />
        <line
          x1={scaleX(feedingBand.endMin)}
          y1={pad.top}
          x2={scaleX(feedingBand.endMin)}
          y2={chartH - pad.bottom}
          stroke="oklch(0.7 0.18 145)"
          stroke-width="0.8"
          stroke-dasharray="4,3"
        />
        <text
          x={(scaleX(feedingBand.startMin) + scaleX(feedingBand.endMin)) / 2}
          y={chartH - pad.bottom - 3}
          text-anchor="middle"
          font-size="4.5"
          fill="oklch(0.7 0.18 145)"
          font-weight="500">4h feeding window</text
        >
      {/if}

      <!-- Ride window overlay -->
      {#if rideWindow}
        <rect
          x={scaleX(rideWindow.startMin)}
          y={pad.top}
          width={scaleX(rideWindow.endMin) - scaleX(rideWindow.startMin)}
          height={chartH - pad.top - pad.bottom}
          fill="oklch(0.72 0.19 155)"
          fill-opacity="0.08"
          rx="2"
        />
        <line
          x1={scaleX(rideWindow.startMin)}
          y1={pad.top}
          x2={scaleX(rideWindow.startMin)}
          y2={chartH - pad.bottom}
          stroke="oklch(0.72 0.19 155)"
          stroke-width="0.6"
          stroke-dasharray="3,2"
        />
        <line
          x1={scaleX(rideWindow.endMin)}
          y1={pad.top}
          x2={scaleX(rideWindow.endMin)}
          y2={chartH - pad.bottom}
          stroke="oklch(0.72 0.19 155)"
          stroke-width="0.6"
          stroke-dasharray="3,2"
        />
        <text
          x={(scaleX(rideWindow.startMin) + scaleX(rideWindow.endMin)) / 2}
          y={pad.top + 8}
          text-anchor="middle"
          font-size="4.5"
          fill="oklch(0.72 0.19 155)"
          font-weight="600">ride window</text
        >
      {/if}

      <!-- Actual ride activity bands -->
      {#each activityBands as band, i (i)}
        <rect
          x={scaleX(band.startMin)}
          y={pad.top}
          width={Math.max(scaleX(band.endMin) - scaleX(band.startMin), 4)}
          height={chartH - pad.top - pad.bottom}
          fill="oklch(0.72 0.19 155)"
          fill-opacity="0.15"
          rx="2"
        />
        <line
          x1={scaleX(band.startMin)}
          y1={pad.top}
          x2={scaleX(band.startMin)}
          y2={chartH - pad.bottom}
          stroke="oklch(0.72 0.19 155)"
          stroke-width="1"
          stroke-opacity="0.5"
        />
        <text
          x={(scaleX(band.startMin) + scaleX(band.endMin)) / 2}
          y={chartH - pad.bottom - 6}
          text-anchor="middle"
          font-size="4"
          fill="oklch(0.72 0.19 155)"
          font-weight="600">{band.distKm}km</text
        >
      {/each}

      <!-- GP confidence ribbon -->
      {#if isGP && confidenceRibbonPath}
        <path
          d={confidenceRibbonPath}
          fill="oklch(0.72 0.17 45)"
          fill-opacity="0.12"
        />
      {/if}

      <!-- Predicted glucose: filled area + solid line -->
      {#if hasPrediction}
        <path d={predictedAreaPath} fill="url(#glucoseFill)" />
        <polyline
          points={predictedGlucosePath}
          fill="none"
          stroke="oklch(0.72 0.17 45)"
          stroke-width="1.4"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      {/if}

      <!-- Meal markers -->
      {#each mealMarkers as marker, i (i)}
        <g transform="translate({marker.x},{marker.y})">
          <circle
            r="2.5"
            fill="oklch(0.75 0.15 70)"
            stroke="var(--card)"
            stroke-width="1"
          />
          <text
            x="0"
            y="-5"
            text-anchor="middle"
            font-size="3.5"
            fill="oklch(0.75 0.15 70)"
            font-weight="500"
            opacity="0.8"
            >{marker.name.length > 18
              ? marker.name.slice(0, 16) + "…"
              : marker.name}</text
          >
        </g>
      {/each}

      <!-- Glucose diamond markers -->
      {#if hasGlucose}
        {#each glucoseMarkers as gm, i (i)}
          <g transform="translate({gm.x},{gm.y})">
            <polygon
              points="0,-4 4,0 0,4 -4,0"
              fill="oklch(0.72 0.18 280)"
              stroke="var(--card)"
              stroke-width="1"
            />
            <text
              x="0"
              y="-6"
              text-anchor="middle"
              font-size="4.5"
              fill="oklch(0.72 0.18 280)"
              font-weight="600">{gm.mgdl}</text
            >
          </g>
        {/each}
      {/if}

      <!-- Current time indicator -->
      {#if nowMin !== null}
        <line
          x1={nowX}
          y1={pad.top}
          x2={nowX}
          y2={chartH - pad.bottom}
          stroke="oklch(0.7 0.15 250)"
          stroke-width="0.8"
          stroke-dasharray="3,2"
        />
        <text
          x={nowX}
          y={pad.top - 3}
          text-anchor="middle"
          fill="oklch(0.7 0.15 250)"
          font-size="4.5"
          font-weight="600">now</text
        >
      {/if}
    </svg>

    <!-- Legend -->
    <div
      class="flex items-center gap-4 mt-1.5 px-2 text-[10px] text-muted-foreground flex-wrap"
    >
      {#if hasPrediction}
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-0.5 rounded-full inline-block"
            style="background: oklch(0.72 0.17 45);"
          ></span>
          Predicted BG
        </span>
      {/if}
      {#if isGP}
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-2.5 rounded-sm inline-block"
            style="background: oklch(0.72 0.17 45 / 0.15);"
          ></span>
          &pm;1&sigma;
        </span>
      {/if}
      {#if entries.length > 0}
        <span class="flex items-center gap-1.5">
          <span
            class="w-2 h-2 rounded-full inline-block"
            style="background: oklch(0.75 0.15 70);"
          ></span>
          Meals
        </span>
      {/if}
      {#if hasGlucose}
        <span class="flex items-center gap-1.5">
          <svg class="w-3 h-3 inline-block" viewBox="0 0 8 8"
            ><polygon
              points="4,0 8,4 4,8 0,4"
              fill="oklch(0.72 0.18 280)"
            /></svg
          >
          BG reading
        </span>
      {/if}
      {#if rideWindow}
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-2.5 rounded-sm inline-block"
            style="background: oklch(0.72 0.19 155 / 0.2);"
          ></span>
          Ride window
        </span>
      {/if}
      {#if feedingBand}
        <span class="flex items-center gap-1.5">
          <span
            class="w-4 h-px border-t border-dashed inline-block"
            style="border-color: oklch(0.7 0.18 145);"
          ></span>
          IF window
        </span>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
