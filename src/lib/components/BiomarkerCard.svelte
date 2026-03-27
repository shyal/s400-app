<script lang="ts">
  import type { BiomarkerWithLatest } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import BiomarkerStatusBadge from "./BiomarkerStatusBadge.svelte";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";

  interface Props {
    biomarker: BiomarkerWithLatest;
    onclick?: () => void;
  }

  let { biomarker, onclick }: Props = $props();

  const categoryLabels: Record<string, string> = {
    cardiovascular: "Cardio",
    metabolic: "Metabolic",
    inflammatory: "Inflammatory",
    cellular_aging: "Cellular",
    functional: "Functional",
    other: "Other",
  };

  const isOverdue = $derived(
    biomarker.daysSinceTest != null &&
      biomarker.daysSinceTest > biomarker.testFrequencyDays,
  );

  function formatRange(
    min: number | null | undefined,
    max: number | null | undefined,
  ): string {
    if (min != null && max != null) return `${min}–${max}`;
    if (max != null) return `≤${max}`;
    if (min != null) return `≥${min}`;
    return "—";
  }
</script>

<button class="w-full text-left" {onclick}>
  <Card.Root class="transition-all hover:border-muted-foreground/30">
    <Card.Content class="p-3">
      <div class="flex items-start justify-between mb-2">
        <div>
          <h3 class="font-semibold text-sm">{biomarker.name}</h3>
          <Badge variant="secondary" class="text-[10px] mt-0.5 px-1.5 py-0"
            >{categoryLabels[biomarker.category]}</Badge
          >
        </div>
        <BiomarkerStatusBadge
          status={biomarker.status}
          trend={biomarker.trend}
        />
      </div>

      <div class="flex items-baseline gap-2 mb-2">
        <span class="text-2xl font-bold font-mono tabular-nums">
          {biomarker.latestMeasurement?.value.toFixed(1) ?? "—"}
        </span>
        <span class="text-sm text-muted-foreground">{biomarker.unit}</span>
      </div>

      <div
        class="flex items-center justify-between text-xs text-muted-foreground"
      >
        <span
          >Optimal: {formatRange(biomarker.optimalMin, biomarker.optimalMax)}
          {biomarker.unit}</span
        >

        {#if biomarker.daysSinceTest !== null}
          {#if isOverdue}
            <span class="flex items-center gap-1 text-yellow-400">
              <AlertTriangleIcon class="h-3 w-3" />
              {biomarker.daysSinceTest}d ago
            </span>
          {:else}
            <span class="flex items-center gap-1">
              <ClockIcon class="h-3 w-3" />
              {biomarker.daysSinceTest}d ago
            </span>
          {/if}
        {:else}
          <span>Never tested</span>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</button>
