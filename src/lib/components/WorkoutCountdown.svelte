<script lang="ts">
  import type { Workout, WorkoutSchedule } from "$lib/types";
  import { computeNextWorkout } from "$lib/utils/schedule";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import FlameIcon from "@lucide/svelte/icons/flame";

  interface Props {
    workouts: Workout[];
    schedule: WorkoutSchedule;
    programName?: string;
  }

  let { workouts, schedule, programName = "stronglifts" }: Props = $props();

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

  const info = $derived(
    computeNextWorkout(workouts, schedule, now, programName),
  );

  const countdown = $derived.by(() => {
    const ms = info.isOverdue ? info.overdueMs : info.msUntil;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { h, m, s };
  });

  const status = $derived.by<"overdue" | "today" | "tomorrow" | "upcoming">(
    () => {
      if (info.isOverdue) return "overdue";
      const todayStr = now.toISOString().slice(0, 10);
      if (info.nextDate === todayStr) return "today";
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      if (info.nextDate === tomorrowStr) return "tomorrow";
      return "upcoming";
    },
  );

  const statusColors: Record<string, string> = {
    overdue: "border-red-500/50 bg-red-500/5",
    today: "border-green-500/50 bg-green-500/5",
    tomorrow: "border-yellow-500/50 bg-yellow-500/5",
    upcoming: "",
  };

  const countdownColor: Record<string, string> = {
    overdue: "text-red-400",
    today: "text-green-400",
    tomorrow: "text-yellow-400",
    upcoming: "text-muted-foreground",
  };

  const statusLabel: Record<string, string> = {
    overdue: "Overdue",
    today: "Due Today",
    tomorrow: "Due Tomorrow",
    upcoming: "Upcoming",
  };
</script>

<Card.Root class={statusColors[status]}>
  <Card.Header class="pb-2">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
      >
        <DumbbellIcon class="h-5 w-5 text-primary" />
      </div>
      <div class="flex-1">
        <Card.Title class="text-base">Next Workout</Card.Title>
        <Card.Description>
          {info.nextDate}
          {#if info.isExtraRestDay}
            <span class="text-emerald-400"> &middot; Extra rest earned!</span>
          {/if}
        </Card.Description>
      </div>
      <Badge variant="secondary" class="text-sm">{info.nextType}</Badge>
    </div>
  </Card.Header>

  <Card.Content class="space-y-2">
    <!-- Countdown -->
    <div class="rounded-lg border p-2.5 text-center {countdownColor[status]}">
      <div class="flex items-center justify-center gap-1 mb-1">
        <ClockIcon class="h-3.5 w-3.5" />
        <span
          class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          {statusLabel[status]}
        </span>
        {#if status === "today"}
          <span class="relative flex h-2 w-2 ml-1">
            <span
              class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"
            ></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"
            ></span>
          </span>
        {/if}
      </div>
      <div
        class="flex items-baseline justify-center gap-1 font-mono tabular-nums"
      >
        {#if info.isOverdue}
          <span class="text-xs mr-1">-</span>
        {/if}
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

    <!-- Streak -->
    {#if info.consecutiveCount > 0}
      <div
        class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
      >
        <FlameIcon class="h-3 w-3 text-orange-400" />
        <span
          >{info.consecutiveCount} consecutive on-schedule workout{info.consecutiveCount ===
          1
            ? ""
            : "s"}</span
        >
      </div>
    {/if}
  </Card.Content>
</Card.Root>
