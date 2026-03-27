<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import WeightChart from "$lib/components/WeightChart.svelte";

  nutritionStore.ensureHydrated();

  const entries = $derived(nutritionStore.weightLog);
  const latest = $derived(entries[0]);
  const goalKg = 72;
  const progress = $derived(
    latest
      ? ((latest.weight_kg - goalKg) /
          (entries[entries.length - 1]?.weight_kg - goalKg)) *
          100
      : 0,
  );
  const remaining = $derived(latest ? latest.weight_kg - goalKg : 0);

  // Last 7 entries (most recent first)
  const recent = $derived(entries.slice(0, 7));
</script>

<svelte:head>
  <title>Weight</title>
</svelte:head>

<div class="p-4 space-y-4">
  <header class="text-center py-2">
    <h1 class="text-2xl font-bold">Weight</h1>
  </header>

  {#if latest}
    <div class="card text-center">
      <p class="text-4xl font-bold">
        {latest.weight_kg.toFixed(1)}<span class="text-lg text-slate-400">
          kg</span
        >
      </p>
      <p class="text-sm text-slate-400 mt-1">
        {remaining > 0 ? `${remaining.toFixed(1)} kg to goal` : "Goal reached!"}
      </p>
      {#if latest.body_fat_pct}
        <div class="flex justify-center gap-4 mt-2 text-xs text-slate-500">
          <span>BF {latest.body_fat_pct.toFixed(1)}%</span>
          {#if latest.muscle_mass_kg}
            <span>Muscle {latest.muscle_mass_kg.toFixed(1)}kg</span>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="card text-center py-8">
      <p class="text-slate-500">No weight data yet.</p>
    </div>
  {/if}

  <WeightChart
    {entries}
    {goalKg}
    movingAverageWindow={settingsStore.value.movingAverageWindow ?? 7}
  />

  {#if recent.length > 0}
    <div class="card">
      <h3 class="font-bold text-sm text-slate-300 mb-2">Recent</h3>
      <div class="space-y-1">
        {#each recent as entry (entry.id)}
          <div
            class="flex justify-between text-sm py-1 border-b border-slate-700"
          >
            <span class="text-slate-400">{entry.date}</span>
            <span class="font-mono">{entry.weight_kg.toFixed(1)} kg</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
