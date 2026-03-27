<script lang="ts">
  import type {
    FoodEntry,
    StravaActivity,
    GlucoseModelParams,
  } from "$lib/types";
  import { localDateStr } from "$lib/utils/date";
  import {
    foodEntryToMealEvent,
    stravaToExerciseEvent,
    predictGlucoseCurve,
  } from "$lib/services/glucoseModel";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import BikeIcon from "@lucide/svelte/icons/bike";
  import SunIcon from "@lucide/svelte/icons/sun";
  import CloudIcon from "@lucide/svelte/icons/cloud";
  import CloudRainIcon from "@lucide/svelte/icons/cloud-rain";
  import ThermometerIcon from "@lucide/svelte/icons/thermometer";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import CheckCircleIcon from "@lucide/svelte/icons/circle-check";
  import FootprintsIcon from "@lucide/svelte/icons/footprints";
  import HouseIcon from "@lucide/svelte/icons/house";

  interface Props {
    entries: FoodEntry[];
    isToday: boolean;
    activities?: StravaActivity[];
    glucoseParams: GlucoseModelParams;
  }

  let { entries, isToday, activities = [], glucoseParams }: Props = $props();

  // Manila coordinates
  const LAT = 14.5995;
  const LON = 120.9842;

  interface HourlyWeather {
    time: string[];
    temperature_2m: number[];
    cloud_cover: number[];
    uv_index: number[];
    precipitation_probability: number[];
  }

  let weather = $state<HourlyWeather | null>(null);

  $effect(() => {
    if (!isToday) return;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m,cloud_cover,uv_index,precipitation_probability&timezone=Asia/Manila&forecast_days=1`,
    )
      .then((r) => r.json())
      .then((data) => {
        weather = data.hourly;
      })
      .catch(() => {});
  });

  const MEAL_GAP_MIN = 20;

  // Activity options: lightest → heaviest
  const ACTIVITY_OPTIONS = [
    {
      type: "chores" as const,
      label: "light chores",
      intensity: 0.15,
      outdoor: false,
    },
    {
      type: "walk" as const,
      label: "outdoor walk",
      intensity: 0.3,
      outdoor: true,
    },
    {
      type: "ride" as const,
      label: "moderate ride",
      intensity: 0.55,
      outdoor: true,
    },
  ];

  // Group the most recent entries into a "meal"
  const lastMeal = $derived.by(() => {
    const today = localDateStr();
    const todayEntries = entries
      .filter((e) => e.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (todayEntries.length === 0) return null;

    const mealEntries: typeof todayEntries = [
      todayEntries[todayEntries.length - 1],
    ];
    for (let i = todayEntries.length - 2; i >= 0; i--) {
      const cur = todayEntries[i];
      const next = mealEntries[mealEntries.length - 1];
      const [ch, cm] = cur.time.split(":").map(Number);
      const [nh, nm] = next.time.split(":").map(Number);
      const gap = nh * 60 + nm - (ch * 60 + cm);
      if (gap <= MEAL_GAP_MIN) {
        mealEntries.push(cur);
      } else {
        break;
      }
    }

    const first = mealEntries[mealEntries.length - 1];
    const [h, m] = first.time.split(":").map(Number);
    const names = [...new Set(mealEntries.map((e) => e.name))];
    const label =
      names.length <= 2
        ? names.join(" + ")
        : `${names[0]} + ${names.length - 1} more`;
    return { time: first.time, min: h * 60 + m, name: label };
  });

  // Predict BG impact using the glucose model (not crude insulin scores)
  const mealImpact = $derived.by(() => {
    if (!lastMeal || !isToday) return null;

    const today = localDateStr();
    const todayMeals = entries
      .filter((e) => e.date === today)
      .map(foodEntryToMealEvent);
    const existingExercises = activities.map(stravaToExerciseEvent);

    // Predict the curve including existing strava activities
    const prediction = predictGlucoseCurve(
      todayMeals,
      existingExercises,
      null,
      glucoseParams,
    );

    // Find peak near the last meal (within 2h window)
    const mealStart = lastMeal.min;
    const relevantCurve = prediction.curve.filter(
      (p) => p.timeMin >= mealStart && p.timeMin <= mealStart + 120,
    );
    if (relevantCurve.length === 0) return null;

    const peak = relevantCurve.reduce((max, p) =>
      p.value > max.value ? p : max,
    );
    const baseline = glucoseParams.fasting_baseline_mgdl;
    const peakDelta = peak.value - baseline;

    return {
      peakDelta,
      peakValue: peak.value,
      peakTimeMin: peak.timeMin,
      baseline,
    };
  });

  // Adaptive noise floor: uncalibrated model → more lenient; calibrated → trust small predictions
  const noiseFloor = $derived.by(() => {
    const n = glucoseParams.data_points_used;
    if (n >= 15) return 5;
    if (n >= 5) return 10;
    return 15;
  });

  // Find the lightest activity that provides meaningful BG reduction
  const recommendation = $derived.by(() => {
    if (!mealImpact || !lastMeal) return null;
    const { peakDelta, peakTimeMin } = mealImpact;

    // Model says the spike is within physiological noise — no action needed
    if (peakDelta <= noiseFloor) return null;

    const today = localDateStr();
    const todayMeals = entries
      .filter((e) => e.date === today)
      .map(foodEntryToMealEvent);
    const existingExercises = activities.map(stravaToExerciseEvent);

    // Simulate each activity type (lightest first) at increasing durations
    // Accept the first one that provides meaningful benefit
    for (const activity of ACTIVITY_OPTIONS) {
      for (let dur = 10; dur <= 45; dur += 5) {
        const startMin = peakTimeMin - 15;
        const simEx = {
          startMin,
          endMin: startMin + dur,
          intensityFactor: activity.intensity,
        };

        const withEx = predictGlucoseCurve(
          todayMeals,
          [...existingExercises, simEx],
          null,
          glucoseParams,
        );

        const relevantCurve = withEx.curve.filter(
          (p) => p.timeMin >= lastMeal.min && p.timeMin <= lastMeal.min + 120,
        );
        if (relevantCurve.length === 0) continue;

        const newPeak = relevantCurve.reduce((max, p) =>
          p.value > max.value ? p : max,
        );
        const newDelta = newPeak.value - glucoseParams.fasting_baseline_mgdl;
        const reduction = peakDelta - newDelta;

        // Accept if: brings peak into noise floor OR achieves >= 40% reduction
        if (newDelta <= noiseFloor || reduction >= peakDelta * 0.4) {
          return {
            activityType: activity.type,
            activityLabel: activity.label,
            outdoor: activity.outdoor,
            durationMin: dur,
            peakDelta: Math.round(peakDelta),
            reduction: Math.round(reduction),
            reductionPct: Math.round((reduction / peakDelta) * 100),
            startMin,
            startTime: formatMin(startMin),
            endTime: formatMin(startMin + dur),
            peakTime: formatMin(peakTimeMin),
          };
        }
      }
    }

    // Fallback: recommend the hardest option at max duration
    const hardest = ACTIVITY_OPTIONS[ACTIVITY_OPTIONS.length - 1];
    const startMin = peakTimeMin - 15;
    return {
      activityType: hardest.type,
      activityLabel: hardest.label,
      outdoor: hardest.outdoor,
      durationMin: 45,
      peakDelta: Math.round(peakDelta),
      reduction: 0,
      reductionPct: 0,
      startMin,
      startTime: formatMin(startMin),
      endTime: formatMin(startMin + 45),
      peakTime: formatMin(peakTimeMin),
    };
  });

  const minutesUntil = $derived.by(() => {
    if (!recommendation || !isToday) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const diff = recommendation.startMin - nowMin;
    if (diff < -60) return null;
    return diff;
  });

  const activityWeather = $derived.by(() => {
    if (!weather || !recommendation) return null;
    const peakHour = Math.round(recommendation.startMin / 60);
    const idx = Math.min(Math.max(peakHour, 0), 23);
    return {
      temp: Math.round(weather.temperature_2m[idx]),
      cloud: weather.cloud_cover[idx],
      uv: weather.uv_index[idx],
      rainChance: weather.precipitation_probability[idx],
    };
  });

  const todayRides = $derived(activities.filter((a) => a.type === "Ride"));

  const confidenceLabel = $derived.by(() => {
    const n = glucoseParams.data_points_used;
    if (n === 0) return "estimated";
    if (n < 15) return `learning (${n})`;
    return "personalized";
  });

  function formatMin(m: number): string {
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    const ampm = h < 12 ? "am" : "pm";
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:${String(min).padStart(2, "0")}${ampm}`;
  }
</script>

{#if isToday && lastMeal && recommendation}
  <Card.Root>
    <Card.Header class="pb-2 pt-3 px-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if recommendation.activityType === "ride"}
            <BikeIcon class="h-4 w-4 text-emerald-400" />
          {:else if recommendation.activityType === "walk"}
            <FootprintsIcon class="h-4 w-4 text-emerald-400" />
          {:else}
            <HouseIcon class="h-4 w-4 text-emerald-400" />
          {/if}
          <Card.Title class="text-sm font-semibold">Activity Advisor</Card.Title
          >
          <Badge
            variant="outline"
            class="text-[9px] text-muted-foreground border-muted"
          >
            {confidenceLabel}
          </Badge>
        </div>
        {#if minutesUntil !== null && minutesUntil > 0}
          <Badge
            variant="outline"
            class="text-[10px] tabular-nums gap-1 text-emerald-400 border-emerald-500/30"
          >
            <ClockIcon class="h-3 w-3" />
            in {minutesUntil}min
          </Badge>
        {:else if minutesUntil !== null && minutesUntil >= -60}
          <Badge
            variant="outline"
            class="text-[10px] tabular-nums gap-1 text-amber-400 border-amber-500/30 animate-pulse"
          >
            <ZapIcon class="h-3 w-3" />
            now
          </Badge>
        {/if}
      </div>
    </Card.Header>
    <Card.Content class="px-4 pb-3">
      <div class="space-y-2">
        <!-- Activity prescription -->
        <div class="flex-1 space-y-1">
          <p class="text-xs">
            <span class="font-medium text-foreground"
              >{recommendation.durationMin} min {recommendation.activityLabel}</span
            >
            <span class="text-muted-foreground">
              — {recommendation.startTime} to {recommendation.endTime}</span
            >
          </p>
          <p class="text-[11px] text-muted-foreground">
            Predicted +{recommendation.peakDelta} mg/dL from {lastMeal.name}.
            {#if recommendation.reductionPct > 0}
              Activity reduces peak by ~{recommendation.reductionPct}%.
            {/if}
          </p>
        </div>

        <!-- Weather (outdoor activities only) -->
        {#if recommendation.outdoor && activityWeather}
          <div class="flex gap-2 flex-wrap">
            <Badge variant="secondary" class="text-[10px] gap-1">
              <ThermometerIcon class="h-3 w-3" />
              {activityWeather.temp}°C
            </Badge>
            <Badge variant="secondary" class="text-[10px] gap-1">
              {#if activityWeather.cloud < 40}
                <SunIcon class="h-3 w-3 text-amber-400" />
              {:else if activityWeather.cloud < 70}
                <CloudIcon class="h-3 w-3 text-slate-400" />
              {:else}
                <CloudIcon class="h-3 w-3 text-slate-500" />
              {/if}
              {activityWeather.cloud}% cloud
            </Badge>
            <Badge variant="secondary" class="text-[10px] gap-1">
              <SunIcon
                class="h-3 w-3 {activityWeather.uv >= 4
                  ? 'text-amber-400'
                  : 'text-muted-foreground'}"
              />
              UV {activityWeather.uv}
            </Badge>
            {#if activityWeather.rainChance > 50}
              <Badge
                variant="secondary"
                class="text-[10px] gap-1 text-blue-400"
              >
                <CloudRainIcon class="h-3 w-3" />
                {activityWeather.rainChance}% rain
              </Badge>
            {/if}
          </div>
        {/if}

        <!-- Actual rides -->
        {#if todayRides.length > 0}
          <div
            class="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-2 space-y-1"
          >
            <div class="flex items-center gap-1.5">
              <CheckCircleIcon class="h-3.5 w-3.5 text-emerald-400" />
              <span class="text-xs font-medium text-emerald-400"
                >Ride Completed</span
              >
            </div>
            {#each todayRides as ride (ride.id)}
              <div class="flex flex-wrap gap-1.5">
                <Badge variant="secondary" class="text-[10px] gap-1">
                  <ClockIcon class="h-3 w-3" />
                  {Math.round(ride.moving_time_sec / 60)}min
                </Badge>
                <Badge variant="secondary" class="text-[10px] gap-1">
                  <BikeIcon class="h-3 w-3" />
                  {(ride.distance_m / 1000).toFixed(1)}km
                </Badge>
                <Badge variant="secondary" class="text-[10px]">
                  {(ride.average_speed * 3.6).toFixed(1)}km/h avg
                </Badge>
                {#if ride.kilojoules}
                  <Badge variant="secondary" class="text-[10px] gap-1">
                    <ZapIcon class="h-3 w-3" />
                    {Math.round(ride.kilojoules)}kJ
                  </Badge>
                {/if}
                {#if ride.average_heartrate}
                  <Badge variant="secondary" class="text-[10px]">
                    {Math.round(ride.average_heartrate)}bpm
                  </Badge>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
{/if}
