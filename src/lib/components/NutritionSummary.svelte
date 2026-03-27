<script lang="ts">
  import type { DailyNutrition, MacroTargets } from "$lib/types";
  import MacroProgressBar from "./MacroProgressBar.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  import FlameIcon from "@lucide/svelte/icons/flame";
  import BeefIcon from "@lucide/svelte/icons/beef";
  import WheatIcon from "@lucide/svelte/icons/wheat";
  import DropletIcon from "@lucide/svelte/icons/droplet";

  interface Props {
    totals: DailyNutrition;
    targets: MacroTargets;
  }

  let { totals, targets }: Props = $props();

  const calPct = $derived(
    targets.calories > 0
      ? Math.round((totals.calories / targets.calories) * 100)
      : 0,
  );
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <Card.Title class="text-sm font-semibold">Daily Macros</Card.Title>
      <Badge
        variant="outline"
        class="text-xs tabular-nums {calPct >= 100
          ? 'text-red-400 border-red-500/30'
          : calPct >= 80
            ? 'text-amber-400 border-amber-500/30'
            : 'text-muted-foreground'}"
      >
        {calPct}%
      </Badge>
    </div>
  </Card.Header>
  <Card.Content class="space-y-3 px-4 pb-4">
    <MacroProgressBar
      label="Calories"
      current={totals.calories}
      target={targets.calories}
      unit=" kcal"
      color="blue"
      icon={FlameIcon}
    />
    <MacroProgressBar
      label="Protein"
      current={totals.protein_g}
      target={targets.protein_g}
      unit="g"
      color="green"
      icon={BeefIcon}
    />
    <MacroProgressBar
      label="Net Carbs"
      current={Math.round((totals.carbs_g - totals.fiber_g) * 10) / 10}
      target={targets.carbs_g}
      unit="g"
      color="yellow"
      icon={WheatIcon}
      subtitle="{totals.carbs_g}g total, {totals.fiber_g}g fiber"
    />
    <MacroProgressBar
      label="Fat"
      current={totals.fat_g}
      target={targets.fat_g}
      unit="g"
      color="purple"
      icon={DropletIcon}
    />
  </Card.Content>
</Card.Root>
