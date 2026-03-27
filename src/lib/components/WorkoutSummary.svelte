<script lang="ts">
  import type { Workout } from "$lib/types";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { formatWeight, formatWeightRange } from "$lib/utils/progression";

  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";

  import ClockIcon from "@lucide/svelte/icons/clock";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import WeightIcon from "@lucide/svelte/icons/weight";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle-2";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";

  interface Props {
    workout: Workout;
    expanded?: boolean;
  }

  let { workout, expanded = false }: Props = $props();

  let isExpanded = $state(false);

  $effect(() => {
    isExpanded = expanded;
  });

  const totalSets = $derived(
    workout.exercises.reduce((sum, ex) => sum + ex.targetSets, 0),
  );
  const completedSets = $derived(
    workout.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0,
    ),
  );
  const totalVolume = $derived(
    workout.exercises.reduce(
      (sum, ex) =>
        sum + ex.sets.reduce((s, set) => s + set.reps * set.weight_kg, 0),
      0,
    ),
  );
  const allComplete = $derived(completedSets === totalSets);
  const completionPct = $derived(
    totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0,
  );
</script>

<Card.Root class="transition-colors">
  <button class="w-full text-left" onclick={() => (isExpanded = !isExpanded)}>
    <Card.Header class="py-3 px-4">
      <div class="flex items-center gap-3">
        <!-- Completion indicator -->
        <div class="shrink-0">
          {#if allComplete}
            <CheckCircleIcon class="h-5 w-5 text-emerald-400" />
          {:else}
            <CircleAlertIcon class="h-5 w-5 text-amber-400" />
          {/if}
        </div>

        <!-- Workout info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <Card.Title class="text-sm font-medium truncate"
              >{workout.activity}</Card.Title
            >
          </div>
          <Card.Description class="flex items-center gap-3 mt-0.5">
            <span class="flex items-center gap-1 text-xs">
              <CalendarIcon class="h-3 w-3" />
              {workout.date}
            </span>
            <span class="flex items-center gap-1 text-xs">
              <ClockIcon class="h-3 w-3" />
              {workout.duration_min}m
            </span>
          </Card.Description>
        </div>

        <!-- Right side -->
        <div class="flex items-center gap-2 shrink-0">
          <Badge
            variant={allComplete ? "default" : "secondary"}
            class="text-xs {allComplete
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30'
              : ''}"
          >
            {completedSets}/{totalSets}
          </Badge>
          <ChevronDownIcon
            class="h-4 w-4 text-muted-foreground transition-transform {isExpanded
              ? 'rotate-180'
              : ''}"
          />
        </div>
      </div>
    </Card.Header>
  </button>

  {#if isExpanded}
    <Card.Content class="space-y-2.5 pt-0 px-4 pb-3">
      <Separator />

      {#each workout.exercises as exercise (exercise.name)}
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-sm truncate">{exercise.name}</p>
            <p class="text-xs text-muted-foreground">
              {formatWeightRange(
                exercise.sets,
                exercise.targetWeight_kg,
                settingsStore.value.weightUnit,
              )}
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            {#each exercise.sets as set (set.setNumber)}
              <span
                class="w-7 h-7 rounded-md text-xs font-medium flex items-center justify-center
									{set.completed
                  ? 'bg-emerald-600/15 text-emerald-400 ring-1 ring-emerald-600/30'
                  : 'bg-red-600/15 text-red-400 ring-1 ring-red-600/30'}"
              >
                {set.reps}
              </span>
            {/each}
            {#each Array(exercise.targetSets - exercise.sets.length) as _, i (i)}
              <span
                class="w-7 h-7 rounded-md text-xs flex items-center justify-center bg-secondary text-muted-foreground"
              >
                -
              </span>
            {/each}
          </div>
        </div>
      {/each}

      <Separator />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
          <WeightIcon class="h-3 w-3" />
          {formatWeight(totalVolume, settingsStore.value.weightUnit)}
        </div>
        <Badge variant="outline" class="text-xs text-muted-foreground"
          >{completionPct}%</Badge
        >
      </div>
    </Card.Content>
  {/if}
</Card.Root>
