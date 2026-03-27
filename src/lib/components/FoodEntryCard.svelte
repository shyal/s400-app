<script lang="ts">
  import type { FoodEntry } from "$lib/types";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";

  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import DropletsIcon from "@lucide/svelte/icons/droplets";

  interface Props {
    entry: FoodEntry;
    ondelete?: (id: string) => void;
  }

  let { entry, ondelete }: Props = $props();
</script>

<div class="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
  <!-- Time badge -->
  <Badge
    variant="outline"
    class="text-[10px] tabular-nums shrink-0 mt-0.5 text-muted-foreground px-1.5 py-0"
  >
    {entry.time}
  </Badge>

  <!-- Content -->
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-1.5">
      <span class="text-sm font-medium truncate">{entry.name}</span>
      {#if entry.servings !== 1}
        <Badge variant="secondary" class="text-[10px] px-1 py-0"
          >x{entry.servings}</Badge
        >
      {/if}
    </div>
    <div class="flex items-center gap-2 mt-0.5 flex-wrap">
      <span class="text-xs tabular-nums text-blue-400"
        >{Math.round(entry.calories)} cal</span
      >
      <span class="text-xs tabular-nums text-emerald-400"
        >P{Math.round(entry.protein_g)}</span
      >
      <span class="text-xs tabular-nums text-amber-400"
        >C{Math.round(entry.carbs_g - (entry.fiber_g ?? 0))} net</span
      >
      {#if entry.fiber_g}
        <span class="text-xs tabular-nums text-muted-foreground"
          >Fi{Math.round(entry.fiber_g)}</span
        >
      {/if}
      <span class="text-xs tabular-nums text-purple-400"
        >F{Math.round(entry.fat_g)}</span
      >
      {#if entry.water_ml}
        <span
          class="text-xs tabular-nums text-cyan-400 flex items-center gap-0.5"
        >
          <DropletsIcon class="h-3 w-3" />
          {entry.water_ml}ml
        </span>
      {/if}
    </div>
  </div>

  <!-- Delete -->
  {#if ondelete}
    <Button
      variant="ghost"
      size="icon-sm"
      class="shrink-0 text-muted-foreground hover:text-red-400 h-7 w-7"
      onclick={() => ondelete?.(entry.id)}
    >
      <TrashIcon class="h-3.5 w-3.5" />
    </Button>
  {/if}
</div>
