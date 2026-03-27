<script lang="ts">
  import type { WeightEntry } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Progress } from "$lib/components/ui/progress";
  import TargetIcon from "@lucide/svelte/icons/target";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ScaleIcon from "@lucide/svelte/icons/scale";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";

  interface Props {
    entries: WeightEntry[];
    goalKg?: number;
    goalDate?: string;
  }

  let { entries, goalKg = 72, goalDate = "2026-06-01" }: Props = $props();

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

  const latest = $derived(entries[0]);
  const currentKg = $derived(latest?.weight_kg ?? 0);
  const startKg = $derived(
    entries.length > 0 ? entries[entries.length - 1].weight_kg : currentKg,
  );

  const remaining = $derived(Math.max(0, currentKg - goalKg));
  const totalToLose = $derived(Math.max(1, startKg - goalKg));
  const lost = $derived(Math.max(0, startKg - currentKg));
  const pctDone = $derived(Math.round((lost / totalToLose) * 100));

  const daysLeft = $derived(
    Math.max(
      0,
      Math.ceil(
        (new Date(goalDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    ),
  );

  const weeksLeft = $derived(Math.max(1, daysLeft / 7));
  const weeklyRateNeeded = $derived(remaining / weeksLeft);

  const rateStatus = $derived<"green" | "yellow" | "red">(
    weeklyRateNeeded <= 0.5
      ? "green"
      : weeklyRateNeeded <= 0.75
        ? "yellow"
        : "red",
  );

  const rateColors: Record<string, string> = {
    green: "text-green-400 border-green-500/30",
    yellow: "text-yellow-400 border-yellow-500/30",
    red: "text-red-400 border-red-500/30",
  };

  // Actual rate from weight data (sorted oldest→newest)
  const actualRate = $derived.by(() => {
    if (entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalChange = last.weight_kg - first.weight_kg;
    const days = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const dailyKg = totalChange / days;
    const dailyG = Math.round(dailyKg * 1000);
    const weeklyKg = dailyKg * 7;
    return { dailyG, weeklyKg, dailyKg };
  });

  // Fixed ETA target timestamp anchored to last weigh-in
  const etaTargetMs = $derived.by(() => {
    if (!actualRate || actualRate.dailyKg >= 0 || remaining <= 0) return null;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const lastMs = new Date(last.date + "T00:00:00").getTime();
    const kgFromLast = last.weight_kg - goalKg;
    const daysFromLast = kgFromLast / Math.abs(actualRate.dailyKg);
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
    if (!actualRate || entries.length < 2) return null;
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const startDate = new Date(sorted[0].date);
    const goalD = new Date(goalDate);

    let projectedDate: Date | null = null;
    let daysAhead = 0;
    if (actualRate.dailyKg < 0 && remaining > 0) {
      const daysToGoal = remaining / Math.abs(actualRate.dailyKg);
      projectedDate = new Date(
        now.getTime() + daysToGoal * 24 * 60 * 60 * 1000,
      );
      daysAhead = Math.round(
        (goalD.getTime() - projectedDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return { projectedDate, daysAhead, startDate, goalD, now };
  });

  const ahead = $derived(schedule ? schedule.daysAhead > 0 : false);
  const behind = $derived(schedule ? schedule.daysAhead < 0 : false);

  // ── Timeline SVG layout ──
  const tlPad = { left: 8, right: 8 };
  const tlW = 600;
  const tlTrackY = 32;

  // ── Color palette ──
  const col = {
    today: "oklch(0.7 0.15 240)", // blue
    projected: "oklch(0.72 0.14 195)", // cyan/teal
    goal: "oklch(0.78 0.14 80)", // amber/gold
    behind: "oklch(0.65 0.2 25)", // red
  };

  const timeline = $derived.by(() => {
    if (!schedule) return null;
    const { startDate, now, goalD, projectedDate } = schedule;

    const endDate =
      projectedDate && projectedDate > goalD ? projectedDate : goalD;
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
      goalX: dateToX(goalD),
      projX: projectedDate ? dateToX(projectedDate) : null,
      startLabel: fmtShort(startDate),
      goalLabel: fmtShort(goalD),
      projLabel: projectedDate ? fmtShort(projectedDate) : null,
      daysAhead: schedule.daysAhead,
    };
  });
</script>

{#if currentKg > 0}
  <Card.Root>
    <Card.Header class="pb-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10"
        >
          <TargetIcon class="h-5 w-5 text-amber-400" />
        </div>
        <div class="flex-1">
          <Card.Title>Goal: {goalKg}kg</Card.Title>
          <Card.Description
            >by {new Date(goalDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}</Card.Description
          >
        </div>
        {#if pctDone > 0}
          <Badge variant="secondary" class="text-sky-400">{pctDone}% done</Badge
          >
        {/if}
      </div>
    </Card.Header>

    <Card.Content class="space-y-3">
      <!-- Weight progress bar -->
      <div class="flex items-center justify-between text-sm">
        <span class="font-mono tabular-nums">{currentKg.toFixed(1)} kg</span>
        <span class="text-muted-foreground font-mono tabular-nums"
          >{goalKg} kg</span
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
              {@const projAhead = timeline.daysAhead > 0}
              <line
                x1={timeline.nowX}
                y1={tlTrackY}
                x2={timeline.projX}
                y2={tlTrackY}
                stroke={projAhead ? col.projected : col.behind}
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
              {startKg.toFixed(1)}kg
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
              {currentKg.toFixed(1)}kg
            </text>

            <!-- ── Projected marker ── -->
            {#if timeline.projX}
              {@const projAhead = timeline.daysAhead > 0}
              {@const projColor = projAhead ? col.projected : col.behind}
              <g transform="translate({timeline.projX}, {tlTrackY})">
                <rect
                  x="-3.5"
                  y="-3.5"
                  width="7"
                  height="7"
                  rx="1"
                  fill={projColor}
                  transform="rotate(45)"
                />
              </g>
              <text
                x={timeline.projX}
                y={tlTrackY + 13}
                text-anchor="middle"
                fill={projColor}
                font-size="7"
                font-weight="500"
              >
                {timeline.projLabel}
              </text>
              <text
                x={timeline.projX}
                y={tlTrackY + 21}
                text-anchor="middle"
                fill={projColor}
                font-size="6"
                opacity="0.7"
              >
                projected
              </text>

              <!-- Bracket showing days ahead/behind -->
              {#if projAhead}
                {@const midX = (timeline.projX + timeline.goalX) / 2}
                <line
                  x1={timeline.projX}
                  y1={tlTrackY + 30}
                  x2={timeline.goalX}
                  y2={tlTrackY + 30}
                  stroke={col.projected}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <line
                  x1={timeline.projX}
                  y1={tlTrackY + 27}
                  x2={timeline.projX}
                  y2={tlTrackY + 33}
                  stroke={col.projected}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <line
                  x1={timeline.goalX}
                  y1={tlTrackY + 27}
                  x2={timeline.goalX}
                  y2={tlTrackY + 33}
                  stroke={col.projected}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <text
                  x={midX}
                  y={tlTrackY + 40}
                  text-anchor="middle"
                  fill={col.projected}
                  font-size="6.5"
                  font-weight="500"
                >
                  {timeline.daysAhead}d early
                </text>
              {:else}
                {@const midX = (timeline.goalX + timeline.projX) / 2}
                <line
                  x1={timeline.goalX}
                  y1={tlTrackY + 30}
                  x2={timeline.projX}
                  y2={tlTrackY + 30}
                  stroke={col.behind}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <line
                  x1={timeline.goalX}
                  y1={tlTrackY + 27}
                  x2={timeline.goalX}
                  y2={tlTrackY + 33}
                  stroke={col.behind}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <line
                  x1={timeline.projX}
                  y1={tlTrackY + 27}
                  x2={timeline.projX}
                  y2={tlTrackY + 33}
                  stroke={col.behind}
                  stroke-width="0.6"
                  opacity="0.35"
                />
                <text
                  x={midX}
                  y={tlTrackY + 40}
                  text-anchor="middle"
                  fill={col.behind}
                  font-size="6.5"
                  font-weight="500"
                >
                  {Math.abs(timeline.daysAhead)}d late
                </text>
              {/if}
            {/if}

            <!-- ── Goal marker (flag) ── -->
            <line
              x1={timeline.goalX}
              y1={tlTrackY - 14}
              x2={timeline.goalX}
              y2={tlTrackY + 2}
              stroke={col.goal}
              stroke-width="0.8"
              opacity="0.5"
            />
            <rect
              x={timeline.goalX}
              y={tlTrackY - 14}
              width="16"
              height="8"
              rx="1.5"
              fill={col.goal}
              opacity="0.15"
              stroke={col.goal}
              stroke-width="0.4"
            />
            <text
              x={timeline.goalX + 8}
              y={tlTrackY - 8}
              text-anchor="middle"
              fill={col.goal}
              font-size="5.5"
              font-weight="600"
            >
              GOAL
            </text>
            <circle
              cx={timeline.goalX}
              cy={tlTrackY}
              r="3"
              fill="none"
              stroke={col.goal}
              stroke-width="1"
            />
            <text
              x={timeline.goalX + 18}
              y={tlTrackY + 3}
              text-anchor="start"
              fill="currentColor"
              class="text-muted-foreground"
              font-size="6.5"
            >
              {timeline.goalLabel}
            </text>
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

      <!-- Stat cards row: remaining / needed rate -->
      <div class="grid grid-cols-2 gap-2">
        <div
          class="rounded-lg border p-2 text-center text-orange-400 border-orange-500/30"
        >
          <TrendingDownIcon class="h-3.5 w-3.5 mx-auto mb-1" />
          <p class="text-lg font-bold font-mono tabular-nums">
            {remaining.toFixed(1)}
          </p>
          <p class="text-[10px] text-muted-foreground">kg left</p>
        </div>
        <div class="rounded-lg border p-2 text-center {rateColors[rateStatus]}">
          <TrendingDownIcon class="h-3.5 w-3.5 mx-auto mb-1" />
          <p class="text-lg font-bold font-mono tabular-nums">
            {weeklyRateNeeded.toFixed(2)}
          </p>
          <p class="text-[10px] text-muted-foreground">kg/wk needed</p>
        </div>
      </div>

      <!-- Stat cards row 2: actual daily / actual weekly -->
      {#if actualRate}
        <div class="grid grid-cols-2 gap-2">
          <div
            class="rounded-lg border p-2 text-center {actualRate.dailyG <= 0
              ? 'text-cyan-400 border-cyan-500/30'
              : 'text-red-400 border-red-500/30'}"
          >
            <ArrowDownIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            <p class="text-lg font-bold font-mono tabular-nums">
              {actualRate.dailyG}g
            </p>
            <p class="text-[10px] text-muted-foreground">avg/day actual</p>
          </div>
          <div
            class="rounded-lg border p-2 text-center {actualRate.weeklyKg <= 0
              ? 'text-violet-400 border-violet-500/30'
              : 'text-red-400 border-red-500/30'}"
          >
            <ScaleIcon class="h-3.5 w-3.5 mx-auto mb-1" />
            <p class="text-lg font-bold font-mono tabular-nums">
              {actualRate.weeklyKg.toFixed(2)}
            </p>
            <p class="text-[10px] text-muted-foreground">kg/wk actual</p>
          </div>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
{/if}
