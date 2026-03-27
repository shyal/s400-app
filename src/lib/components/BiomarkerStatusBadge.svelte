<script lang="ts">
  import type { BiomarkerStatus, BiomarkerTrend } from "$lib/types";
  import { Badge } from "$lib/components/ui/badge";
  import TrendingUpIcon from "@lucide/svelte/icons/trending-up";
  import TrendingDownIcon from "@lucide/svelte/icons/trending-down";
  import MinusIcon from "@lucide/svelte/icons/minus";

  interface Props {
    status: BiomarkerStatus;
    trend?: BiomarkerTrend;
    showTrend?: boolean;
    size?: "sm" | "md" | "lg";
  }

  let {
    status,
    trend = "unknown",
    showTrend = true,
    size = "md",
  }: Props = $props();

  const statusConfig: Record<
    BiomarkerStatus,
    { label: string; class: string; dot: string }
  > = {
    optimal: {
      label: "Optimal",
      class: "text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    warning: {
      label: "Warning",
      class: "text-yellow-400 border-yellow-500/30",
      dot: "bg-yellow-500",
    },
    critical: {
      label: "Critical",
      class: "text-red-400 border-red-500/30",
      dot: "bg-red-500",
    },
    unknown: {
      label: "No data",
      class: "text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    },
  };

  const trendConfig: Record<
    BiomarkerTrend,
    {
      icon:
        | typeof TrendingUpIcon
        | typeof TrendingDownIcon
        | typeof MinusIcon
        | null;
      class: string;
    }
  > = {
    improving: { icon: TrendingUpIcon, class: "text-emerald-400" },
    stable: { icon: MinusIcon, class: "text-muted-foreground" },
    worsening: { icon: TrendingDownIcon, class: "text-red-400" },
    unknown: { icon: null, class: "" },
  };

  const sizeMap = { sm: "h-2.5 w-2.5", md: "h-3 w-3", lg: "h-3.5 w-3.5" };
  const iconSize = { sm: "h-3 w-3", md: "h-3.5 w-3.5", lg: "h-4 w-4" };
</script>

<Badge variant="outline" class="gap-1.5 {statusConfig[status].class}">
  <span class="relative flex">
    <span class="{sizeMap[size]} {statusConfig[status].dot} rounded-full"
    ></span>
    {#if status === "critical"}
      <span
        class="{sizeMap[size]} {statusConfig[status]
          .dot} rounded-full animate-ping absolute"
      ></span>
    {/if}
  </span>
  {#if size !== "sm"}{statusConfig[status].label}{/if}
  {#if showTrend && trendConfig[trend].icon}
    {@const TrendIcon = trendConfig[trend].icon}
    <TrendIcon class="{iconSize[size]} {trendConfig[trend].class}" />
  {/if}
</Badge>
