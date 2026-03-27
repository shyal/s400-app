<script lang="ts">
  import { goto } from "$app/navigation";
  import { biomarkerStore } from "$lib/stores/biomarker.svelte";
  import BiomarkerCard from "$lib/components/BiomarkerCard.svelte";
  import BiomarkerCategorySummary from "$lib/components/BiomarkerCategorySummary.svelte";
  import BiomarkerStatusBadge from "$lib/components/BiomarkerStatusBadge.svelte";
  import type { BiomarkerCategory } from "$lib/types";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";

  import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
  import CalendarClockIcon from "@lucide/svelte/icons/calendar-clock";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  const categories: (BiomarkerCategory | "all")[] = [
    "all",
    "cardiovascular",
    "metabolic",
    "inflammatory",
    "cellular_aging",
    "functional",
    "other",
  ];

  function handleCategoryClick(category: BiomarkerCategory | "all") {
    biomarkerStore.setCategory(category);
  }

  function handleBiomarkerClick(id: string) {
    goto(`/biomarkers/${id}`);
  }
</script>

<svelte:head>
  <title>Biomarkers | Labs</title>
</svelte:head>

<div class="p-4 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10"
      >
        <FlaskConicalIcon class="h-5 w-5 text-cyan-400" />
      </div>
      <h1 class="text-2xl font-bold">Lab Results</h1>
    </div>
    <Button href="/biomarkers/add" size="sm" class="gap-1.5">
      <PlusIcon class="h-4 w-4" />
      Add
    </Button>
  </div>

  <!-- Attention Items -->
  {#if biomarkerStore.attentionItems.length > 0}
    <Card.Root class="border-yellow-500/30">
      <Card.Header class="pb-2 pt-3 px-4">
        <div class="flex items-center gap-2">
          <AlertTriangleIcon class="h-4 w-4 text-yellow-400" />
          <Card.Title class="text-sm font-semibold text-yellow-400"
            >Needs Attention</Card.Title
          >
        </div>
      </Card.Header>
      <Card.Content class="px-4 pb-3 space-y-1.5">
        {#each biomarkerStore.attentionItems.slice(0, 3) as item}
          <button
            class="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors"
            onclick={() => handleBiomarkerClick(item.id)}
          >
            <div class="flex items-center gap-2.5">
              <BiomarkerStatusBadge
                status={item.status}
                trend={item.trend}
                size="sm"
              />
              <span class="text-sm">{item.name}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span
                class="text-sm font-mono tabular-nums text-muted-foreground"
              >
                {item.latestMeasurement?.value.toFixed(1) ?? "—"}
                {item.unit}
              </span>
              <ChevronRightIcon class="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </button>
        {/each}
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Overdue Tests -->
  {#if biomarkerStore.overdueTests.length > 0}
    <Card.Root class="border-sky-500/30">
      <Card.Header class="pb-2 pt-3 px-4">
        <div class="flex items-center gap-2">
          <CalendarClockIcon class="h-4 w-4 text-sky-400" />
          <Card.Title class="text-sm font-semibold text-sky-400"
            >Overdue for Testing</Card.Title
          >
        </div>
      </Card.Header>
      <Card.Content class="px-4 pb-3">
        <div class="flex flex-wrap gap-1.5">
          {#each biomarkerStore.overdueTests.slice(0, 5) as item}
            <button onclick={() => handleBiomarkerClick(item.id)}>
              <Badge
                variant="secondary"
                class="cursor-pointer hover:bg-accent transition-colors"
                >{item.name}</Badge
              >
            </button>
          {/each}
          {#if biomarkerStore.overdueTests.length > 5}
            <Badge variant="outline" class="text-muted-foreground"
              >+{biomarkerStore.overdueTests.length - 5} more</Badge
            >
          {/if}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Category Summaries -->
  <div class="grid grid-cols-2 gap-2">
    {#each categories as category}
      <BiomarkerCategorySummary
        {category}
        stats={biomarkerStore.categoryStats[category]}
        selected={biomarkerStore.selectedCategory === category}
        onclick={() => handleCategoryClick(category)}
      />
    {/each}
  </div>

  <Separator />

  <!-- Filtered Biomarkers -->
  <div class="space-y-3">
    <h2 class="text-lg font-semibold capitalize">
      {biomarkerStore.selectedCategory === "all"
        ? "All Markers"
        : biomarkerStore.selectedCategory.replace("_", " ")}
    </h2>
    {#if biomarkerStore.filteredBiomarkers.length === 0}
      <div class="flex flex-col items-center justify-center py-12">
        <FlaskConicalIcon class="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p class="text-sm text-muted-foreground">
          No biomarkers in this category
        </p>
      </div>
    {:else}
      <div class="grid gap-2">
        {#each biomarkerStore.filteredBiomarkers as biomarker}
          <BiomarkerCard
            {biomarker}
            onclick={() => handleBiomarkerClick(biomarker.id)}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>
