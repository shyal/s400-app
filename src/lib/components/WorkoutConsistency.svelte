<script lang="ts">
  import type { Workout } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import WeightIcon from "@lucide/svelte/icons/weight";

  interface Props {
    workouts: Workout[];
  }

  let { workouts }: Props = $props();

  const now = new Date();

  const startOfWeek = $derived.by(() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const thisWeek = $derived(
    workouts.filter((w) => new Date(w.date) >= startOfWeek),
  );
  const thisMonth = $derived(
    workouts.filter((w) => {
      const d = new Date(w.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }),
  );

  const streak = $derived.by(() => {
    if (workouts.length === 0) return 0;
    let count = 1;
    for (let i = 0; i < workouts.length - 1; i++) {
      const cur = new Date(workouts[i].date);
      const prev = new Date(workouts[i + 1].date);
      const gap = Math.floor(
        (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (gap <= 3) {
        count++;
      } else {
        break;
      }
    }
    return count;
  });

  const avgDuration = $derived.by(() => {
    const recent = workouts.slice(0, 10);
    if (recent.length === 0) return 0;
    return Math.round(
      recent.reduce((s, w) => s + w.duration_min, 0) / recent.length,
    );
  });

  const weeklyVolume = $derived.by(() => {
    let vol = 0;
    for (const w of thisWeek) {
      for (const ex of w.exercises) {
        for (const set of ex.sets) {
          if (set.completed) {
            vol += set.reps * set.weight_kg;
          }
        }
      }
    }
    return Math.round(vol);
  });

  function fmtVolume(v: number): string {
    if (v >= 1000) return (v / 1000).toFixed(1) + "k";
    return v.toString();
  }
</script>

{#if workouts.length > 0}
  <Card.Root>
    <Card.Header class="pb-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10"
        >
          <ActivityIcon class="h-5 w-5 text-violet-400" />
        </div>
        <div class="flex-1">
          <Card.Title>Consistency</Card.Title>
          <Card.Description
            >{thisMonth.length} sessions in {now.toLocaleDateString("en-US", {
              month: "long",
            })}</Card.Description
          >
        </div>
        {#if streak >= 3}
          <Badge variant="secondary" class="text-orange-400 gap-1">
            <FlameIcon class="h-3 w-3" />
            {streak}
          </Badge>
        {/if}
      </div>
    </Card.Header>

    <Card.Content>
      <div class="grid grid-cols-4 gap-2">
        <div class="text-center">
          <FlameIcon class="h-3.5 w-3.5 mx-auto mb-1 text-orange-400" />
          <p class="text-lg font-bold font-mono tabular-nums">{streak}</p>
          <p class="text-[10px] text-muted-foreground">streak</p>
        </div>
        <div class="text-center">
          <ActivityIcon class="h-3.5 w-3.5 mx-auto mb-1 text-violet-400" />
          <p class="text-lg font-bold font-mono tabular-nums">
            {thisWeek.length}
          </p>
          <p class="text-[10px] text-muted-foreground">this week</p>
        </div>
        <div class="text-center">
          <ClockIcon class="h-3.5 w-3.5 mx-auto mb-1 text-blue-400" />
          <p class="text-lg font-bold font-mono tabular-nums">{avgDuration}</p>
          <p class="text-[10px] text-muted-foreground">avg min</p>
        </div>
        <div class="text-center">
          <WeightIcon class="h-3.5 w-3.5 mx-auto mb-1 text-emerald-400" />
          <p class="text-lg font-bold font-mono tabular-nums">
            {fmtVolume(weeklyVolume)}
          </p>
          <p class="text-[10px] text-muted-foreground">vol/wk</p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>
{/if}
