<script lang="ts">
  import type { BiomarkerDefinition } from "$lib/types";
  import { biomarkerStore } from "$lib/stores/biomarker.svelte";
  import { localDateStr } from "$lib/utils/date";

  interface Props {
    definitions: BiomarkerDefinition[];
    preselectedId?: string;
    onclose: () => void;
    onsave: () => void;
  }

  let { definitions, preselectedId, onclose, onsave }: Props = $props();

  let selectedBiomarkerId = $state(preselectedId ?? "");
  let value = $state("");
  let date = $state(localDateStr());
  let notes = $state("");
  let labName = $state("");
  let saving = $state(false);

  const selectedDef = $derived(
    definitions.find((d) => d.id === selectedBiomarkerId),
  );

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
      onsave();
    } finally {
      saving = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onclose();
    }
  }
</script>

<div
  class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
  onclick={handleBackdropClick}
  role="dialog"
  aria-modal="true"
>
  <div class="card max-w-md w-full max-h-[90vh] overflow-y-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-slate-200">Add Measurement</h2>
      <button
        class="text-slate-400 hover:text-slate-200 text-xl"
        onclick={onclose}>×</button
      >
    </div>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1">Biomarker</label>
        <select
          bind:value={selectedBiomarkerId}
          class="input w-full"
          required
          disabled={!!preselectedId}
        >
          <option value="">Select a biomarker...</option>
          {#each definitions as def}
            <option value={def.id}>{def.name} ({def.unit})</option>
          {/each}
        </select>
      </div>

      {#if selectedDef}
        <div class="text-xs text-slate-500 -mt-2">
          {selectedDef.description ?? ""}
        </div>
      {/if}

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
            <span class="text-sm text-slate-500">{selectedDef?.unit ?? ""}</span
            >
          </div>
        </div>
        <div>
          <label class="block text-sm text-slate-400 mb-1">Date</label>
          <input type="date" bind:value={date} class="input w-full" required />
        </div>
      </div>

      {#if selectedDef}
        <div class="text-xs text-slate-500">
          Optimal range: {selectedDef.optimalMin ?? "—"} – {selectedDef.optimalMax ??
            "—"}
          {selectedDef.unit}
        </div>
      {/if}

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

      <div>
        <label class="block text-sm text-slate-400 mb-1">Notes (optional)</label
        >
        <textarea
          bind:value={notes}
          class="input w-full"
          rows="2"
          placeholder="Any context..."
        ></textarea>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="button" class="btn flex-1" onclick={onclose}
          >Cancel</button
        >
        <button
          type="submit"
          class="btn-primary flex-1"
          disabled={saving || !selectedBiomarkerId || !value}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  </div>
</div>
