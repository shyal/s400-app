<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { biomarkerStore } from "$lib/stores/biomarker.svelte";
  import BiomarkerStatusBadge from "$lib/components/BiomarkerStatusBadge.svelte";
  import BiomarkerChart from "$lib/components/BiomarkerChart.svelte";
  import AddBiomarkerModal from "$lib/components/AddBiomarkerModal.svelte";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";

  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import TargetIcon from "@lucide/svelte/icons/target";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";

  const biomarkerId = $derived($page.params.id);
  const definition = $derived(biomarkerStore.getDefinition(biomarkerId));
  const biomarkerWithLatest = $derived(
    biomarkerStore.biomarkersWithLatest.find((b) => b.id === biomarkerId),
  );
  const history = $derived(biomarkerStore.getHistory(biomarkerId));

  let showAddModal = $state(false);

  const categoryLabels: Record<string, string> = {
    cardiovascular: "Cardiovascular",
    metabolic: "Metabolic",
    inflammatory: "Inflammatory",
    cellular_aging: "Cellular/Aging",
    functional: "Functional",
    other: "Other",
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function handleDelete(id: string) {
    if (confirm("Delete this measurement?")) {
      await biomarkerStore.removeMeasurement(id);
    }
  }

  function handleModalSave() {
    showAddModal = false;
  }
</script>

<svelte:head>
  <title>{definition?.name ?? "Biomarker"} | Labs</title>
</svelte:head>

{#if !definition || !biomarkerWithLatest}
  <div class="p-4 space-y-4">
    <FlaskConicalIcon class="h-8 w-8 text-muted-foreground/30" />
    <p class="text-muted-foreground">Biomarker not found</p>
    <Button variant="outline" href="/biomarkers" class="gap-1.5">
      <ArrowLeftIcon class="h-4 w-4" />
      Back to Labs
    </Button>
  </div>
{:else}
  <div class="p-4 space-y-4">
    <!-- Header -->
    <div>
      <Button
        variant="ghost"
        size="sm"
        href="/biomarkers"
        class="gap-1 -ml-2 mb-2 text-muted-foreground"
      >
        <ArrowLeftIcon class="h-3.5 w-3.5" />
        Labs
      </Button>
      <div class="flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold">{definition.name}</h1>
          <Badge variant="secondary" class="mt-1"
            >{categoryLabels[definition.category]}</Badge
          >
        </div>
        <BiomarkerStatusBadge
          status={biomarkerWithLatest.status}
          trend={biomarkerWithLatest.trend}
          size="lg"
        />
      </div>
    </div>

    <!-- Current Value -->
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-baseline gap-3 mb-3">
          <span class="text-4xl font-bold font-mono tabular-nums">
            {biomarkerWithLatest.latestMeasurement?.value.toFixed(1) ?? "—"}
          </span>
          <span class="text-lg text-muted-foreground">{definition.unit}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg border p-2.5">
            <div class="flex items-center gap-1.5 mb-1">
              <TargetIcon class="h-3 w-3 text-emerald-400" />
              <span class="text-[10px] text-muted-foreground"
                >Optimal Range</span
              >
            </div>
            <p class="text-sm font-mono tabular-nums">
              {#if definition.optimalMin != null && definition.optimalMax != null}
                {definition.optimalMin} – {definition.optimalMax}
                {definition.unit}
              {:else if definition.optimalMax != null}
                ≤ {definition.optimalMax} {definition.unit}
              {:else if definition.optimalMin != null}
                ≥ {definition.optimalMin} {definition.unit}
              {:else}
                Not defined
              {/if}
            </p>
          </div>
          <div class="rounded-lg border p-2.5">
            <div class="flex items-center gap-1.5 mb-1">
              <CalendarIcon class="h-3 w-3 text-sky-400" />
              <span class="text-[10px] text-muted-foreground"
                >Test Frequency</span
              >
            </div>
            <p class="text-sm font-mono tabular-nums">
              Every {definition.testFrequencyDays}d
            </p>
          </div>
        </div>

        {#if definition.description}
          <p class="mt-3 text-sm text-muted-foreground">
            {definition.description}
          </p>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Chart -->
    <BiomarkerChart {definition} measurements={history} />

    <!-- Add Button -->
    <Button class="w-full gap-1.5" onclick={() => (showAddModal = true)}>
      <PlusIcon class="h-4 w-4" />
      Add Measurement
    </Button>

    <!-- History -->
    <div class="space-y-3">
      <h2 class="text-lg font-semibold">History</h2>
      {#if history.length === 0}
        <div class="flex flex-col items-center justify-center py-12">
          <FlaskConicalIcon class="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p class="text-sm text-muted-foreground">No measurements yet</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each history as measurement}
            <Card.Root>
              <Card.Content class="p-3 flex items-center justify-between">
                <div>
                  <div class="font-mono tabular-nums font-semibold">
                    {measurement.value.toFixed(1)}
                    {measurement.unit}
                  </div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      class="text-xs text-muted-foreground flex items-center gap-1"
                    >
                      <ClockIcon class="h-3 w-3" />
                      {formatDate(measurement.date)}
                    </span>
                    {#if measurement.labName}
                      <Badge variant="outline" class="text-[10px] px-1.5 py-0"
                        >{measurement.labName}</Badge
                      >
                    {/if}
                  </div>
                  {#if measurement.notes}
                    <p class="text-xs text-muted-foreground mt-1">
                      {measurement.notes}
                    </p>
                  {/if}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onclick={() => handleDelete(measurement.id)}
                >
                  <Trash2Icon class="h-3.5 w-3.5" />
                </Button>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if showAddModal}
    <AddBiomarkerModal
      definitions={biomarkerStore.definitions}
      preselectedId={biomarkerId}
      onclose={() => (showAddModal = false)}
      onsave={handleModalSave}
    />
  {/if}
{/if}
