<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { toast } from "svelte-sonner";
  import { onDestroy } from "svelte";

  const WAKE_HOUR = 6;
  const SLEEP_HOUR = 22;
  const DEFAULT_INTERVAL_MIN = 60;

  let timer: ReturnType<typeof setInterval> | null = null;
  let lastNotifiedAt = 0;

  function wakingMinutesElapsed(): number {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < WAKE_HOUR || h >= SLEEP_HOUR) return -1; // outside waking hours
    return (h - WAKE_HOUR) * 60 + m;
  }

  function wakingMinutesTotal(): number {
    return (SLEEP_HOUR - WAKE_HOUR) * 60;
  }

  function expectedMl(): number {
    const elapsed = wakingMinutesElapsed();
    if (elapsed < 0) return 0;
    const target = nutritionStore.macroTargets.water_ml;
    return Math.round((elapsed / wakingMinutesTotal()) * target);
  }

  function remainingMl(): number {
    const target = nutritionStore.macroTargets.water_ml;
    const current = nutritionStore.todaysTotals.water_ml;
    return Math.max(0, target - current);
  }

  function checkAndNotify() {
    const enabled = settingsStore.value.waterReminderEnabled ?? true;
    if (!enabled) return;

    const elapsed = wakingMinutesElapsed();
    if (elapsed < 0) return; // outside waking hours

    const target = nutritionStore.macroTargets.water_ml;
    const current = nutritionStore.todaysTotals.water_ml;

    // Already hit target
    if (current >= target) return;

    const expected = expectedMl();
    const behind = expected - current;

    // Only nag if behind by at least 250ml
    if (behind < 250) return;

    // Don't double-notify within 5 minutes
    const now = Date.now();
    if (now - lastNotifiedAt < 5 * 60 * 1000) return;
    lastNotifiedAt = now;

    const remaining = remainingMl();
    const hoursLeft = Math.max(
      1,
      Math.round((SLEEP_HOUR * 60 - (WAKE_HOUR * 60 + elapsed)) / 60),
    );
    const perHour = Math.round(remaining / hoursLeft);

    const message = `You're ${Math.round(behind)}ml behind pace. ${Math.round(remaining)}ml left (~${perHour}ml/hr).`;

    toast.info("Drink water", { description: message, duration: 10000 });

    // Try browser notification for background awareness
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Drink water", {
          body: message,
          icon: "/icon-192.png",
          tag: "water-reminder",
        });
      } catch {}
    }
  }

  function start() {
    stop();
    const intervalMin =
      settingsStore.value.waterReminderIntervalMin ?? DEFAULT_INTERVAL_MIN;
    timer = setInterval(checkAndNotify, intervalMin * 60 * 1000);
    // Also check once shortly after mount
    setTimeout(checkAndNotify, 5000);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Request notification permission on mount
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission().catch(() => {});
  }

  $effect(() => {
    // Re-start timer whenever settings change
    const _enabled = settingsStore.value.waterReminderEnabled;
    const _interval = settingsStore.value.waterReminderIntervalMin;
    start();
  });

  onDestroy(stop);
</script>
