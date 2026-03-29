<script lang="ts">
  import type { WeightEntry, SimulationResult } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Progress } from "$lib/components/ui/progress";
  import TargetIcon from "@lucide/svelte/icons/target";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ScaleIcon from "@lucide/svelte/icons/scale";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ActivityIcon from "@lucide/svelte/icons/activity";

  import PercentIcon from "@lucide/svelte/icons/percent";

  interface Props {
    entries: WeightEntry[];
    goalKg?: number;
    goalBodyFatPct?: number;
    goalVisceralFat?: number;
    /** Primary goal mode */
    mode?: "weight" | "body_fat" | "visceral_fat";
    /** Monte Carlo projection — used to find goal intersection date */
    projection?: SimulationResult;
  }

  let {
    entries,
    goalKg = 73,
    goalBodyFatPct = 15,
    goalVisceralFat = 8,
    mode = "visceral_fat",
    projection,
  }: Props = $props();

  // ── Mode-dependent values ──
  const goalValue = $derived(
    mode === "visceral_fat"
      ? goalVisceralFat
      : mode === "body_fat"
        ? goalBodyFatPct
        : goalKg,
  );
  const goalLabel = $derived(
    mode === "visceral_fat"
      ? `Visceral Fat: ${goalVisceralFat}`
      : mode === "body_fat"
        ? `Body Fat: ${goalBodyFatPct}%`
        : `Weight: ${goalKg}kg`,
  );

  function getValue(entry: WeightEntry): number | null {
    if (mode === "visceral_fat") return entry.visceral_fat ?? null;
    if (mode === "body_fat") return entry.body_fat_pct ?? null;
    return entry.weight_kg;
  }

  // Ticking clock for live countdown (survives screen-off via visibilitychange)
  let now = $state(new Date());
  $effect(() => {
    const tick = () => {
      now = new Date();
    };
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  });

  // Filter entries that have valid values for the selected mode
  const validEntries = $derived(entries.filter((e) => getValue(e) != null));

  const latest = $derived(validEntries[0]);
  const currentVal = $derived(latest ? getValue(latest)! : 0);
  const startVal = $derived(
    validEntries.length > 0
      ? getValue(validEntries[validEntries.length - 1])!
      : currentVal,
  );

  const remaining = $derived(Math.max(0, currentVal - goalValue));
  const totalToLose = $derived(Math.max(0.01, startVal - goalValue));
  const lost = $derived(Math.max(0, startVal - currentVal));
  const pctDone = $derived(Math.round((lost / totalToLose) * 100));

  // Actual rate from data (sorted oldest→newest)
  const actualRate = $derived.by(() => {
    if (validEntries.length < 2) return null;
    const sorted = [...validEntries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstVal = getValue(first)!;
    const lastVal = getValue(last)!;
    const totalChange = lastVal - firstVal;
    const days = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dailyRate = totalChange / days;
    const weeklyRate = dailyRate * 7;
    return { dailyRate, weeklyRate };
  });

  // Find goal intersection from Monte Carlo projection points
  function projectionFieldValue(point: Record<string, unknown>): number {
    if (mode === "visceral_fat") return point.visceral_fat as number;
    if (mode === "body_fat") return point.body_fat_pct as number;
    return point.weight_kg as number;
  }

  const projectionGoalDate = $derived.by(() => {
    if (!projection || projection.points.length < 2) return null;
    const pts = projection.points;
    for (let i = 1; i < pts.length; i++) {
      const prev = projectionFieldValue(pts[i - 1] as any);
      const curr = projectionFieldValue(pts[i] as any);
      if (curr <= goalValue && prev > goalValue) {
        // Linear interpolation between the two points
        const frac = (prev - goalValue) / (prev - curr);
        const prevMs = new Date(pts[i - 1].date + "T00:00:00").getTime();
        const currMs = new Date(pts[i].date + "T00:00:00").getTime();
        return new Date(prevMs + frac * (currMs - prevMs));
      }
    }
    // Check if last point is already at/below goal
    const lastVal = projectionFieldValue(pts[pts.length - 1] as any);
    if (lastVal <= goalValue)
      return new Date(pts[pts.length - 1].date + "T00:00:00");
    return null;
  });

  // ETA: prefer projection intersection, fall back to linear extrapolation
  const etaTargetMs = $derived.by(() => {
    if (projectionGoalDate) return projectionGoalDate.getTime();
    if (!actualRate || actualRate.dailyRate >= 0 || remaining <= 0) return null;
    const sorted = [...validEntries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const last = sorted[sorted.length - 1];
    const lastMs = new Date(last.date + "T00:00:00").getTime();
    const valFromLast = getValue(last)! - goalValue;
    const daysFromLast = valFromLast / Math.abs(actualRate.dailyRate);
    return lastMs + daysFromLast * 24 * 60 * 60 * 1000;
  });

  // Live countdown: ticking `now` subtracted from fixed target
  const countdown = $derived.by(() => {
    if (etaTargetMs == null) return null;
    const ms = Math.max(0, etaTargetMs - now.getTime());
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { d, h, m, s };
  });

  // Schedule + timeline data
  const schedule = $derived.by(() => {
    if (!actualRate || validEntries.length < 2) return null;
    const sorted = [...validEntries].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const startDate = new Date(sorted[0].date);

    // Prefer Monte Carlo projection intersection, fall back to linear
    let projectedDate: Date | null = projectionGoalDate;
    if (!projectedDate && actualRate.dailyRate < 0 && remaining > 0) {
      const daysToGoal = remaining / Math.abs(actualRate.dailyRate);
      projectedDate = new Date(
        now.getTime() + daysToGoal * 24 * 60 * 60 * 1000,
      );
    }

    return { projectedDate, startDate, now };
  });

  // ── Timeline SVG layout ──
  const tlPad = { left: 8, right: 8 };
  const tlW = 600;
  const tlTrackY = 32;

  // ── Color palette ──
  const col = {
    today: "oklch(0.7 0.15 240)", // blue
    projected: "oklch(0.72 0.14 195)", // cyan/teal
  };

  const timeline = $derived.by(() => {
    if (!schedule) return null;
    const { startDate, now, projectedDate } = schedule;

    const endDate = projectedDate && projectedDate > now ? projectedDate : now;
    const spanMs = endDate.getTime() - startDate.getTime();
    const totalMs = spanMs * 1.06;
    const originMs = startDate.getTime();

    function dateToX(d: Date): number {
      const pct = (d.getTime() - originMs) / totalMs;
      return tlPad.left + pct * (tlW - tlPad.left - tlPad.right);
    }

    function fmtShort(d: Date): string {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    return {
      startX: dateToX(startDate),
      nowX: dateToX(now),
      projX: projectedDate ? dateToX(projectedDate) : null,
      startLabel: fmtShort(startDate),
      projLabel: projectedDate ? fmtShort(projectedDate) : null,
    };
  });

  function fmtVal(v: number): string {
    if (mode === "body_fat") return `${v.toFixed(1)}%`;
    if (mode === "visceral_fat") return v.toFixed(1);
    return `${v.toFixed(1)}kg`;
  }

  function fmtDailyRate(v: number): string {
    if (mode === "weight") return Math.round(v * 1000) + "g";
    if (mode === "body_fat") return v.toFixed(3) + "%/day";
    return v.toFixed(3) + "/day";
  }
</script>

{#if currentVal > 0}
  <Card.Root>
    <Card.Header class="pb-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg {mode ===
          'visceral_fat'
            ? 'bg-purple-500/10'
            : mode === 'body_fat'
              ? 'bg-emerald-500/10'
              : 'bg-amber-500/10'}"
        >
          {#if mode === "visceral_fat"}
            <ActivityIcon class="h-5 w-5 text-purple-400" />
          {:else if mode === "body_fat"}
            <PercentIcon class="h-5 w-5 text-emerald-400" />
          {:else}
            <TargetIcon class="h-5 w-5 text-amber-400" />
          {/if}
        </div>
        <div class="flex-1">
          <Card.Title>{goalLabel}</Card.Title>
        </div>
        {#if pctDone > 0}
          <Badge variant="secondary" class="text-sky-400">{pctDone}% done</Badge
          >
        {/if}
      </div>
    </Card.Header>

    <Card.Content class="space-y-3">
      <!-- Progress bar -->
      <div class="flex items-center justify-between text-sm">
        <span class="font-mono tabular-nums">{fmtVal(currentVal)}</span>
        <span class="text-muted-foreground font-mono tabular-nums"
          >{fmtVal(goalValue)}</span
        >
      </div>
      <Progress value={pctDone} max={100} class="h-3" />

      <!-- ═══ Horizontal Timeline ═══ -->
      {#if timeline}
        <div class="pt-1">
          <svg viewBox="0 0 {tlW} 80" class="w-full block overflow-visible">
            <!-- Track background -->
            <line
              x1={timeline.startX}
              y1={tlTrackY}
              x2={tlW - tlPad.right}
              y2={tlTrackY}
              stroke="currentColor"
              class="text-border"
              stroke-width="1"
              stroke-linecap="round"
            />

            <!-- Projected segment (today → projected) -->
            {#if timeline.projX}
              <line
                x1={timeline.nowX}
                y1={tlTrackY}
                x2={timeline.projX}
                y2={tlTrackY}
                stroke={col.projected}
                stroke-width="1"
                stroke-dasharray="3,2.5"
                stroke-linecap="round"
                opacity="0.5"
              />
            {/if}

            <!-- ── Start marker ── -->
            <circle
              cx={timeline.startX}
              cy={tlTrackY}
              r="3"
              fill="currentColor"
              class="text-muted-foreground"
            />
            <text
              x={timeline.startX}
              y={tlTrackY - 9}
              text-anchor="start"
              fill="currentColor"
              class="text-muted-foreground"
              font-size="7"
              font-weight="500"
            >
              {timeline.startLabel}
            </text>
            <text
              x={timeline.startX}
              y={tlTrackY + 13}
              text-anchor="start"
              fill="currentColor"
              class="text-muted-foreground"
              font-size="6.5"
            >
              {fmtVal(startVal)}
            </text>

            <!-- ── Today marker ── -->
            <circle cx={timeline.nowX} cy={tlTrackY} r="4.5" fill={col.today} />
            <circle cx={timeline.nowX} cy={tlTrackY} r="2" fill="var(--card)" />
            <circle
              cx={timeline.nowX}
              cy={tlTrackY}
              r="6"
              fill="none"
              stroke={col.today}
              stroke-width="0.7"
              opacity="0.25"
            >
              <animate
                attributeName="r"
                values="6;10;6"
                dur="2.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.25;0;0.25"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x={timeline.nowX}
              y={tlTrackY - 9}
              text-anchor="middle"
              fill={col.today}
              font-size="7.5"
              font-weight="600"
            >
              Today
            </text>
            <text
              x={timeline.nowX}
              y={tlTrackY + 13}
              text-anchor="middle"
              fill={col.today}
              font-size="7"
              font-weight="500"
            >
              {fmtVal(currentVal)}
            </text>

            <!-- ── Projected marker ── -->
            {#if timeline.projX}
              <g transform="translate({timeline.projX}, {tlTrackY})">
                <rect
                  x="-3.5"
                  y="-3.5"
                  width="7"
                  height="7"
                  rx="1"
                  fill={col.projected}
                  transform="rotate(45)"
                />
              </g>
              <text
                x={timeline.projX}
                y={tlTrackY + 13}
                text-anchor="middle"
                fill={col.projected}
                font-size="7"
                font-weight="500"
              >
                {timeline.projLabel}
              </text>
              <text
                x={timeline.projX}
                y={tlTrackY + 21}
                text-anchor="middle"
                fill={col.projected}
                font-size="6"
                opacity="0.7"
              >
                projected
              </text>
            {/if}
          </svg>
        </div>
      {/if}

      <!-- ETA Countdown -->
      {#if countdown}
        <div
          class="rounded-lg border p-2.5 text-center text-sky-400 border-sky-500/30"
        >
          <div class="flex items-center justify-center gap-1 mb-1">
            <CalendarIcon class="h-3.5 w-3.5" />
            <span
              class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              >ETA</span
            >
          </div>
          <div
            class="flex items-baseline justify-center gap-1 font-mono tabular-nums"
          >
            <span class="text-2xl font-bold">{countdown.d}</span><span
              class="text-xs text-muted-foreground">d</span
            >
            <span class="text-2xl font-bold"
              >{String(countdown.h).padStart(2, "0")}</span
            ><span class="text-xs text-muted-foreground">h</span>
            <span class="text-2xl font-bold"
              >{String(countdown.m).padStart(2, "0")}</span
            ><span class="text-xs text-muted-foreground">m</span>
            <span class="text-2xl font-bold"
              >{String(countdown.s).padStart(2, "0")}</span
            ><span class="text-xs text-muted-foreground">s</span>
          </div>
        </div>
      {/if}

      <!-- Stat card: remaining -->
      <div
        class="rounded-lg border p-2 text-center text-orange-400 border-orange-500/30"
      >
        <TrendingDownIcon class="h-3.5 w-3.5 mx-auto mb-1" />
        <p class="text-lg font-bold font-mono tabular-nums">
          {remaining.toFixed(1)}
        </p>
        <p class="text-[10px] text-muted-foreground">
          {mode === "weight"
            ? "kg left"
            : mode === "body_fat"
              ? "% to go"
              : "to go"}
        </p>
      </div>

      <!-- Stat cards row 2: actual daily / actual weekly -->
      {#if actualRate}
        <div class="grid grid-cols-2 gap-2">
          <div
            class="rounded-lg border p-2 text-center {actualRate.dailyRate <= 0
              ? 'text-cyan-400 border-cyan-500/30'
              : 'text-red-400 border-red-500/30'}"
          >
            <ArrowDownIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            <p class="text-lg font-bold font-mono tabular-nums">
              {fmtDailyRate(actualRate.dailyRate)}
            </p>
            <p class="text-[10px] text-muted-foreground">avg/day actual</p>
          </div>
          <div
            class="rounded-lg border p-2 text-center {actualRate.weeklyRate <= 0
              ? 'text-violet-400 border-violet-500/30'
              : 'text-red-400 border-red-500/30'}"
          >
            {#if mode === "visceral_fat"}
              <ActivityIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            {:else if mode === "body_fat"}
              <PercentIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            {:else}
              <ScaleIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            {/if}
            <p class="text-lg font-bold font-mono tabular-nums">
              {actualRate.weeklyRate.toFixed(2)}
            </p>
            <p class="text-[10px] text-muted-foreground">
              {mode === "weight"
                ? "kg/wk actual"
                : mode === "body_fat"
                  ? "%/wk actual"
                  : "/wk actual"}
            </p>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
