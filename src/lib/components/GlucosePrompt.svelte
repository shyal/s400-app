<script lang="ts">
  import type { ScheduledReading } from "$lib/services/glucoseScheduler";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import XIcon from "@lucide/svelte/icons/x";

  interface Props {
    reading: ScheduledReading;
    onlog: () => void;
    ondismiss: () => void;
  }

  let { reading, onlog, ondismiss }: Props = $props();

  const typeLabels: Record<string, string> = {
    fasting: "Fasting",
    pre_meal: "Pre-meal",
    post_meal_30: "Post-meal (30m)",
    post_meal_60: "Post-meal (60m)",
    post_meal_120: "Post-meal (2h)",
    bedtime: "Bedtime",
    random: "Random",
  };

  const priorityColors: Record<number, string> = {
    1: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    2: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    3: "text-orange-400 border-orange-500/30 bg-orange-500/10",
    4: "text-muted-foreground border-border bg-secondary/50",
    5: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  };
</script>

<Card.Root class="border-purple-500/30 bg-purple-500/5">
  <Card.Content class="px-4 py-3">
    <div class="flex items-start gap-3">
      <div class="mt-0.5">
        <DropletIcon class="h-5 w-5 text-purple-400" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-medium">Glucose reading due</span>
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 {priorityColors[reading.priority] ??
              ''}"
          >
            {typeLabels[reading.type] ?? reading.type}
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">{reading.reason}</p>
        <div class="flex gap-2 mt-2">
          <Button
            size="sm"
            class="h-7 text-xs bg-purple-600 hover:bg-purple-700"
            onclick={onlog}
          >
            Log Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 text-xs text-muted-foreground"
            onclick={ondismiss}
          >
            Dismiss
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 h-6 w-6 text-muted-foreground"
        onclick={ondismiss}
      >
        <XIcon class="h-3.5 w-3.5" />
      </Button>
    </div>
  </Card.Content>
</Card.Root>
