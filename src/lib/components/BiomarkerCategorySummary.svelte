<script lang="ts">
  import type { BiomarkerCategory } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Progress } from "$lib/components/ui/progress";

  import HeartPulseIcon from "@lucide/svelte/icons/heart-pulse";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import DnaIcon from "@lucide/svelte/icons/dna";
  import BicepsFlexedIcon from "@lucide/svelte/icons/biceps-flexed";
  import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";

  interface Props {
    category: BiomarkerCategory | "all";
    stats: {
      total: number;
      optimal: number;
      warning: number;
      critical: number;
      unknown: number;
    };
    selected?: boolean;
    onclick?: () => void;
  }

  let { category, stats, selected = false, onclick }: Props = $props();

  const categoryConfig: Record<
    BiomarkerCategory | "all",
    { label: string; icon: typeof HeartPulseIcon; color: string; bg: string }
  > = {
    all: {
      label: "All Markers",
      icon: LayoutGridIcon,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
    },
    cardiovascular: {
      label: "Cardiovascular",
      icon: HeartPulseIcon,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    metabolic: {
      label: "Metabolic",
      icon: ZapIcon,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    inflammatory: {
      label: "Inflammatory",
      icon: FlameIcon,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
    cellular_aging: {
      label: "Cellular/Aging",
      icon: DnaIcon,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    functional: {
      label: "Functional",
      icon: BicepsFlexedIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    other: {
      label: "Other",
      icon: FlaskConicalIcon,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
    },
  };

  const cfg = $derived(categoryConfig[category]);
  const testedCount = $derived(stats.total - stats.unknown);
  const testedPct = $derived(
    stats.total > 0 ? Math.round((testedCount / stats.total) * 100) : 0,
  );
</script>

<button {onclick} class="w-full text-left">
  <Card.Root
    class="transition-all {selected
      ? 'ring-2 ring-primary'
      : 'hover:border-muted-foreground/30'}"
  >
    <Card.Content class="p-3">
      <div class="flex items-center gap-2.5 mb-2.5">
        <div
          class="flex h-8 w-8 items-center justify-center rounded-md {cfg.bg}"
        >
          <cfg.icon class="h-4 w-4 {cfg.color}" />
        </div>
        <span class="font-semibold text-sm">{cfg.label}</span>
      </div>

      <div class="flex items-center gap-2 text-xs mb-2">
        {#if stats.optimal > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span class="text-emerald-400">{stats.optimal}</span>
          </span>
        {/if}
        {#if stats.warning > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span class="text-yellow-400">{stats.warning}</span>
          </span>
        {/if}
        {#if stats.critical > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span class="text-red-400">{stats.critical}</span>
          </span>
        {/if}
        {#if stats.unknown > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-muted-foreground"></span>
            <span class="text-muted-foreground">{stats.unknown}</span>
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <Progress value={testedPct} max={100} class="h-1.5 flex-1" />
        <span class="text-[10px] text-muted-foreground tabular-nums"
          >{testedCount}/{stats.total}</span
        >
      </div>
    </Card.Content>
  </Card.Root>
</button>
