<script lang="ts">
  import { goto } from "$app/navigation";
  import { biomarkerStore } from "$lib/stores/biomarker.svelte";
  import { localDateStr } from "$lib/utils/date";
  import type { BiomarkerCategory } from "$lib/types";

  let selectedBiomarkerId = $state("");
  let value = $state("");
  let date = $state(localDateStr());
  let notes = $state("");
  let labName = $state("");
  let saving = $state(false);
  let filterCategory = $state<BiomarkerCategory | "all">("all");

  const selectedDef = $derived(
    biomarkerStore.definitions.find((d) => d.id === selectedBiomarkerId),
  );

  const filteredDefinitions = $derived(
    filterCategory === "all"
      ? biomarkerStore.definitions
      : biomarkerStore.definitions.filter((d) => d.category === filterCategory),
  );

  const categoryLabels: Record<BiomarkerCategory | "all", string> = {
    all: "All Categories",
    cardiovascular: "Cardiovascular",
    metabolic: "Metabolic",
    inflammatory: "Inflammatory",
    cellular_aging: "Cellular/Aging",
    functional: "Functional",
    other: "Other",
  };

  const categories: (BiomarkerCategory | "all")[] = [
    "all",
    "cardiovascular",
    "metabolic",
    "inflammatory",
    "cellular_aging",
    "functional",
    "other",
  ];

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!selectedBiomarkerId || !value) return;

    saving = true;
    try {
      await biomarkerStore.addMeasurement(
        selectedBiomarkerId,
        parseFloat(value),
        date,
        selectedDef?.unit ?? "",
        notes || undefined,
        labName || undefined,
      );
      goto(`/biomarkers/${selectedBiomarkerId}`);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Add Measurement | Labs</title>
</svelte:head>

<div class="p-4 space-y-6">
  <div>
    <a
      href="/biomarkers"
      class="text-sm text-slate-500 hover:text-slate-300 mb-2 inline-block"
    >
      ← Back
    </a>
    <h1 class="text-2xl font-bold text-slate-100">Add Measurement</h1>
  </div>

  <form onsubmit={handleSubmit} class="space-y-4">
    <!-- Category Filter -->
    <div>
      <label class="block text-sm text-slate-400 mb-2">Category</label>
      <div class="flex flex-wrap gap-2">
        {#each categories as category}
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm transition-colors {filterCategory ===
            category
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
            onclick={() => {
              filterCategory = category;
              selectedBiomarkerId = "";
            }}
          >
            {categoryLabels[category]}
          </button>
        {/each}
      </div>
    </div>

    <!-- Biomarker Selection -->
    <div>
      <label class="block text-sm text-slate-400 mb-1">Biomarker</label>
      <select bind:value={selectedBiomarkerId} class="input w-full" required>
        <option value="">Select a biomarker...</option>
        {#each filteredDefinitions as def}
          <option value={def.id}>{def.name} ({def.unit})</option>
        {/each}
      </select>
    </div>

    {#if selectedDef}
      <div class="card bg-slate-800/50 text-sm">
        <p class="text-slate-400">
          {selectedDef.description ?? "No description available."}
        </p>
        <div class="mt-2 text-xs text-slate-500">
          Optimal: {selectedDef.optimalMin ?? "—"} – {selectedDef.optimalMax ??
            "—"}
          {selectedDef.unit}
          | Test every {selectedDef.testFrequencyDays} days
        </div>
      </div>
    {/if}

    <!-- Value and Date -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1">Value</label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            step="any"
            bind:value
            class="input flex-1"
            placeholder="0.0"
            required
          />
          {#if selectedDef}
            <span class="text-sm text-slate-500">{selectedDef.unit}</span>
          {/if}
        </div>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Date</label>
        <input type="date" bind:value={date} class="input w-full" required />
      </div>
    </div>

    <!-- Lab Name -->
    <div>
      <label class="block text-sm text-slate-400 mb-1"
        >Lab Name (optional)</label
      >
      <input
        type="text"
        bind:value={labName}
        class="input w-full"
        placeholder="e.g., Quest Diagnostics"
      />
    </div>

    <!-- Notes -->
    <div>
      <label class="block text-sm text-slate-400 mb-1">Notes (optional)</label>
      <textarea
        bind:value={notes}
        class="input w-full"
        rows="3"
        placeholder="Any relevant context, fasting status, etc."
      ></textarea>
    </div>

    <!-- Submit -->
    <div class="flex gap-3 pt-4">
      <a href="/biomarkers" class="btn flex-1 text-center">Cancel</a>
      <button
        type="submit"
        class="btn-primary flex-1"
        disabled={saving || !selectedBiomarkerId || !value}
      >
        {saving ? "Saving..." : "Save Measurement"}
      </button>
    </div>
  </form>
</div>
