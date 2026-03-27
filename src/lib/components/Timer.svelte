<script lang="ts">
  import { timerStore } from "$lib/stores/timer.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";

  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import TimerIcon from "@lucide/svelte/icons/timer";

  const presets = [60, 90, 120, 180];

  function formatPreset(seconds: number) {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
  }

  let selectedPreset = $state(String(settingsStore.value.restTimerSeconds));

  function handlePresetChange(value: string | undefined) {
    if (value) {
      const seconds = Number(value);
      selectedPreset = value;
      settingsStore.update({ restTimerSeconds: seconds });
      if (timerStore.state === "idle") timerStore.start(seconds);
    }
  }
</script>

<Card.Root>
  <Card.Header class="pb-2">
    <Card.Title
      class="text-sm font-medium flex items-center gap-2 text-muted-foreground"
    >
      <TimerIcon class="h-4 w-4" />
      Rest Timer
    </Card.Title>
  </Card.Header>
  <Card.Content class="space-y-4">
    <!-- Timer display -->
    <div class="text-center">
      <div
        class="text-6xl font-mono font-bold tabular-nums transition-colors duration-300
					{timerStore.state === 'finished' ? 'text-green-400' : ''}
					{timerStore.state === 'running' ? 'text-yellow-400' : ''}
					{timerStore.state === 'idle' ? 'text-muted-foreground' : ''}"
      >
        {timerStore.formattedTime}
      </div>

      {#if timerStore.state === "finished"}
        <p class="text-green-400 font-semibold mt-2 animate-pulse text-sm">
          Rest Complete!
        </p>
      {/if}
    </div>

    <!-- Control buttons -->
    <div class="flex gap-2 justify-center">
      {#if timerStore.state === "idle"}
        <Button onclick={() => timerStore.start()}>
          <PlayIcon class="mr-2 h-4 w-4" />
          Start Rest
        </Button>
      {:else if timerStore.state === "running"}
        <Button variant="destructive" onclick={() => timerStore.stop()}>
          <SquareIcon class="mr-2 h-4 w-4" />
          Stop
        </Button>
        <Button variant="secondary" onclick={() => timerStore.addTime(30)}>
          <PlusIcon class="mr-1 h-4 w-4" />
          30s
        </Button>
      {:else}
        <Button onclick={() => timerStore.start()}>
          <RotateCcwIcon class="mr-2 h-4 w-4" />
          Restart
        </Button>
        <Button variant="secondary" onclick={() => timerStore.reset()}>
          <XIcon class="mr-2 h-4 w-4" />
          Dismiss
        </Button>
      {/if}
    </div>

    <!-- Preset selector -->
    <div class="flex justify-center">
      <ToggleGroup.Root
        type="single"
        value={selectedPreset}
        onValueChange={handlePresetChange}
        variant="outline"
        size="sm"
      >
        {#each presets as seconds}
          <ToggleGroup.Item value={String(seconds)} class="text-xs px-3">
            {formatPreset(seconds)}
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  </Card.Content>
</Card.Root>
