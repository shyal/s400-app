<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  import TimerIcon from "@lucide/svelte/icons/timer";
  import UtensilsIcon from "@lucide/svelte/icons/utensils";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";

  const fw = $derived(nutritionStore.feedingWindow);
  const hasFoodEntries = $derived(
    nutritionStore.foodEntries.filter(
      (e) => e.date === nutritionStore.selectedDate,
    ).length > 0,
  );
  const fastIntact = $derived(!nutritionStore.fastBrokenAt && hasFoodEntries);

  function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const progressPct = $derived.by(() => {
    if (!fw.opensAt || !fw.minutesLeft) return fw.isOpen ? 100 : 0;
    if (fw.isOpen) return Math.round(((240 - fw.minutesLeft) / 240) * 100);
    return 100;
  });
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <TimerIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">20:4 Fasting</Card.Title>
      </div>
      {#if fw.isOpen}
        <Badge
          variant="default"
          class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs gap-1"
        >
          <UtensilsIcon class="h-3 w-3" />
          FEEDING
        </Badge>
      {:else if fw.opensAt}
        <Badge
          variant="default"
          class="bg-red-500/15 text-red-400 border border-red-500/30 text-xs gap-1"
        >
          <MoonIcon class="h-3 w-3" />
          CLOSED
        </Badge>
      {:else if fastIntact}
        <Badge
          variant="default"
          class="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs gap-1"
        >
          <ShieldCheckIcon class="h-3 w-3" />
          FAST INTACT
        </Badge>
      {:else}
        <Badge variant="secondary" class="text-xs gap-1">
          <MoonIcon class="h-3 w-3" />
          FASTING
        </Badge>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="px-4 pb-3">
    {#if fw.opensAt}
      <!-- Progress bar for feeding window -->
      <div class="h-1.5 rounded-full overflow-hidden bg-secondary mb-3">
        <div
          class="h-full rounded-full transition-all duration-500 {fw.isOpen
            ? 'bg-emerald-500'
            : 'bg-red-500'}"
          style="width: {progressPct}%"
        ></div>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-muted-foreground">Window</span>
          <span class="font-mono tabular-nums"
            >{fw.opensAt} – {fw.closesAt}</span
          >
        </div>
        {#if fw.isOpen && fw.minutesLeft}
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">Closes in</span>
            <span
              class="font-mono tabular-nums text-amber-400 font-bold text-4xl leading-none"
              >{formatMinutes(fw.minutesLeft)}</span
            >
          </div>
        {/if}
      </div>
    {:else if fastIntact}
      <p class="text-sm text-emerald-400/80">
        Fasting-safe items logged. Fast intact.
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        No meals logged yet — first meal starts the 4h window.
      </p>
    {/if}
  </Card.Content>
</Card.Root>
