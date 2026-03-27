<script lang="ts">
  import type { WorkoutSet } from "$lib/types";
  import { Button } from "$lib/components/ui/button";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";

  interface Props {
    setNumber: number;
    targetReps: number;
    set?: WorkoutSet;
    onLog: (reps: number) => void;
    onUpdate?: (reps: number) => void;
  }

  let { setNumber, targetReps, set, onLog, onUpdate }: Props = $props();

  let isEditing = $state(false);
  let editReps = $state(0);

  const defaultReps = $derived(set?.reps ?? targetReps);

  function handleTap() {
    if (set) {
      isEditing = true;
      editReps = set.reps;
    } else {
      onLog(targetReps);
    }
  }

  function handleEdit(delta: number) {
    editReps = Math.max(0, editReps + delta);
  }

  function confirmEdit() {
    if (set && onUpdate) {
      onUpdate(editReps);
    } else {
      onLog(editReps);
    }
    isEditing = false;
  }

  function cancelEdit() {
    isEditing = false;
    editReps = defaultReps;
  }
</script>

{#if isEditing}
  <div class="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2 py-1">
    <Button
      variant="outline"
      size="icon-sm"
      class="h-8 w-8 rounded-full"
      onclick={() => handleEdit(-1)}
    >
      <MinusIcon class="h-3 w-3" />
    </Button>
    <span class="w-8 text-center text-lg font-bold tabular-nums"
      >{editReps}</span
    >
    <Button
      variant="outline"
      size="icon-sm"
      class="h-8 w-8 rounded-full"
      onclick={() => handleEdit(1)}
    >
      <PlusIcon class="h-3 w-3" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-green-400 hover:text-green-300"
      onclick={confirmEdit}
    >
      <CheckIcon class="h-4 w-4" />
    </Button>
    <Button
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground"
      onclick={cancelEdit}
    >
      <XIcon class="h-4 w-4" />
    </Button>
  </div>
{:else}
  <button
    class="relative flex h-12 w-12 items-center justify-center rounded-lg font-bold text-lg tabular-nums transition-all duration-200
			{set?.completed
      ? 'bg-green-600 text-white shadow-sm shadow-green-600/25'
      : set
        ? 'bg-red-600 text-white shadow-sm shadow-red-600/25'
        : 'bg-secondary text-secondary-foreground ring-1 ring-border hover:bg-accent hover:text-accent-foreground'}"
    onclick={handleTap}
  >
    {#if set}
      {set.reps}
    {:else}
      <span class="text-muted-foreground">{setNumber}</span>
    {/if}
  </button>
{/if}
