<script lang="ts">
  import type { Exercise } from "$lib/types";
  import SetLogger from "./SetLogger.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { formatWeight, formatWeightRange } from "$lib/utils/progression";
  import { timerStore } from "$lib/stores/timer.svelte";

  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Progress } from "$lib/components/ui/progress";

  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import PencilIcon from "@lucide/svelte/icons/pencil";

  interface Props {
    exercise: Exercise;
    exerciseIndex: number;
    onLogSet: (exerciseIndex: number, reps: number) => void;
    onUpdateSet: (
      exerciseIndex: number,
      setIndex: number,
      reps: number,
    ) => void;
    onUpdateWeight?: (exerciseIndex: number, weight: number) => void;
  }

  let {
    exercise,
    exerciseIndex,
    onLogSet,
    onUpdateSet,
    onUpdateWeight,
  }: Props = $props();

  let editingWeight = $state(false);
  let weightInput = $state(exercise.targetWeight_kg);

  const completedSets = $derived(
    exercise.sets.filter((s) => s.completed).length,
  );
  const isComplete = $derived(completedSets >= exercise.targetSets);
  const progressPct = $derived(
    Math.round((exercise.sets.length / exercise.targetSets) * 100),
  );

  function handleLogSet(reps: number) {
    onLogSet(exerciseIndex, reps);
    if (exercise.sets.length < exercise.targetSets) {
      timerStore.start();
    }
  }

  function saveWeight() {
    if (onUpdateWeight && weightInput !== exercise.targetWeight_kg) {
      onUpdateWeight(exerciseIndex, weightInput);
    }
    editingWeight = false;
  }
</script>

<Card.Root class={isComplete ? "border-green-500/50 bg-green-500/5" : ""}>
  <Card.Header>
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <Card.Title class="text-base flex items-center gap-2">
          {exercise.name}
          {#if isComplete}
            <Badge variant="default" class="bg-green-600 text-white text-xs"
              >Done</Badge
            >
          {/if}
        </Card.Title>

        {#if editingWeight}
          <div class="flex items-center gap-2 mt-2">
            <span class="text-muted-foreground text-sm">
              {exercise.targetSets}&times;{exercise.targetReps} @
            </span>
            <Input
              type="number"
              step={2.5}
              min={0}
              bind:value={weightInput}
              class="w-20 h-8 text-sm"
              onkeydown={(e) => e.key === "Enter" && saveWeight()}
            />
            <span class="text-muted-foreground text-sm"
              >{settingsStore.value.weightUnit}</span
            >
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={saveWeight}
              class="text-green-400 hover:text-green-300"
            >
              <CheckIcon class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onclick={() => (editingWeight = false)}
              class="text-muted-foreground"
            >
              <XIcon class="h-4 w-4" />
            </Button>
          </div>
        {:else}
          <button
            class="text-muted-foreground text-sm hover:text-primary flex items-center gap-1 mt-1 transition-colors"
            onclick={() => {
              weightInput = exercise.targetWeight_kg;
              editingWeight = true;
            }}
          >
            {exercise.targetSets}&times;{exercise.targetReps} @ {formatWeightRange(
              exercise.sets,
              exercise.targetWeight_kg,
              settingsStore.value.weightUnit,
            )}
            <PencilIcon class="h-3 w-3 opacity-0 group-hover:opacity-100" />
          </button>
        {/if}
      </div>
    </div>
  </Card.Header>

  <Card.Content class="space-y-3">
    <!-- Set buttons -->
    <div class="flex gap-2 flex-wrap">
      {#each Array(exercise.targetSets) as _, i}
        <SetLogger
          setNumber={i + 1}
          targetReps={exercise.targetReps}
          set={exercise.sets[i]}
          onLog={handleLogSet}
          onUpdate={(reps) => onUpdateSet(exerciseIndex, i, reps)}
        />
      {/each}
    </div>

    <!-- Mini progress bar -->
    {#if exercise.sets.length > 0}
      <div class="space-y-1.5">
        <Progress value={progressPct} max={100} class="h-1.5" />
        <p class="text-xs text-muted-foreground">
          {completedSets}/{exercise.targetSets} sets completed
        </p>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
