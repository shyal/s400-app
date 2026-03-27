<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";

  import GlassWaterIcon from "@lucide/svelte/icons/glass-water";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Undo2Icon from "@lucide/svelte/icons/undo-2";

  const todayWater = $derived(
    nutritionStore.waterEntries.filter(
      (e) => e.date === nutritionStore.selectedDate,
    ),
  );
  const totalMl = $derived(nutritionStore.todaysTotals.water_ml);
  const targetMl = $derived(nutritionStore.macroTargets.water_ml);
  const pct = $derived(
    targetMl > 0 ? Math.min((totalMl / targetMl) * 100, 100) : 0,
  );
  const hit = $derived(totalMl >= targetMl && targetMl > 0);

  const quickAmounts = [250, 500, 750, 1000];

  function add(ml: number) {
    nutritionStore.addWater(ml);
  }

  function undo() {
    const last = todayWater[todayWater.length - 1];
    if (last) nutritionStore.removeWater(last.id);
  }

  function formatMl(ml: number): string {
    return ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;
  }
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <GlassWaterIcon class="h-4 w-4 text-cyan-400" />
        <Card.Title class="text-sm font-semibold">Water</Card.Title>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-mono tabular-nums">
          <span class="font-bold text-cyan-400"
            >{(totalMl / 1000).toFixed(1)}</span
          >
          <span class="text-muted-foreground text-xs">/ {targetMl / 1000}L</span
          >
        </span>
        {#if hit}
          <Badge
            variant="default"
            class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0"
          >
            Done
          </Badge>
        {/if}
      </div>
    </div>
  </Card.Header>

  <Card.Content class="px-4 pb-3 space-y-3">
    <div class="h-2 rounded-full overflow-hidden bg-secondary">
      <div
        class="h-full rounded-full transition-all duration-500 ease-out {hit
          ? 'bg-emerald-500'
          : 'bg-cyan-500'}"
        style="width: {pct}%"
      ></div>
    </div>

    <div class="flex gap-1.5">
      <div class="grid grid-cols-4 gap-1.5 flex-1">
        {#each quickAmounts as ml (ml)}
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-8"
            onclick={() => add(ml)}
          >
            <PlusIcon class="h-3 w-3 mr-0.5" />
            {formatMl(ml)}
          </Button>
        {/each}
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
        onclick={undo}
        disabled={todayWater.length === 0}
        title="Undo last water entry"
      >
        <Undo2Icon class="h-3.5 w-3.5" />
      </Button>
    </div>
  </Card.Content>
</Card.Root>
