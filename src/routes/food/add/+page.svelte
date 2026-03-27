<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import type { FastingAssessment, Macros } from "$lib/stores/nutrition.svelte";
  import RecipeCard from "$lib/components/RecipeCard.svelte";
  import FastBreakDialog from "$lib/components/FastBreakDialog.svelte";
  import { goto } from "$app/navigation";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";

  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import SearchIcon from "@lucide/svelte/icons/search";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";

  let search = $state("");
  let showQuickAdd = $state(false);

  let name = $state("");
  let calories = $state(0);
  let protein_g = $state(0);
  let carbs_g = $state(0);
  let fat_g = $state(0);
  let water_ml = $state(0);
  let servings = $state(1);

  // Fasting dialog state
  let fastDialogOpen = $state(false);
  let fastDialogAssessment = $state<FastingAssessment>({
    impact: "SAFE",
    rollingCalories: 0,
    proposedCalories: 0,
  });
  let fastDialogFoodName = $state("");
  let fastDialogAction = $state<(() => void) | null>(null);

  function logFoodWithFastCheck(
    foodName: string,
    macros: Macros,
    action: () => void,
  ) {
    if (nutritionStore.fastBrokenAt) {
      action();
      return;
    }
    const assessment = nutritionStore.assessFastImpact(macros);
    if (assessment.impact === "SAFE") {
      action();
      return;
    }
    fastDialogAssessment = assessment;
    fastDialogFoodName = foodName;
    fastDialogAction = action;
    fastDialogOpen = true;
  }

  function handleFastDialogConfirm() {
    if (fastDialogAssessment.impact === "BREAKS_FAST")
      nutritionStore.breakFast();
    fastDialogAction?.();
    fastDialogOpen = false;
    fastDialogAction = null;
  }

  function handleFastDialogCancel() {
    fastDialogOpen = false;
    fastDialogAction = null;
  }

  const filteredRecipes = $derived(
    search.trim()
      ? nutritionStore.recipes.filter((r) =>
          r.name.toLowerCase().includes(search.toLowerCase()),
        )
      : nutritionStore.recipes,
  );

  function addFromRecipe(recipe: (typeof nutritionStore.recipes)[0]) {
    logFoodWithFastCheck(
      recipe.name,
      {
        calories: Math.round(recipe.calories * servings),
        protein_g: recipe.protein_g * servings,
        carbs_g: recipe.carbs_g * servings,
        fat_g: recipe.fat_g * servings,
        fiber_g: recipe.fiber_g * servings,
      },
      () => {
        nutritionStore.addFoodFromRecipe(recipe, servings);
        goto("/food");
      },
    );
  }

  function quickAdd() {
    if (!name.trim()) return;
    logFoodWithFastCheck(
      name.trim(),
      { calories, protein_g, carbs_g, fat_g, fiber_g: 0 },
      () => {
        nutritionStore.addFood({
          recipe_id: null,
          name: name.trim(),
          servings: 1,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g: 0,
          water_ml,
        });
        goto("/food");
      },
    );
  }
</script>

<svelte:head>
  <title>Add Food</title>
</svelte:head>

<div class="p-4 space-y-4 pb-24">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Button variant="ghost" size="icon-sm" onclick={() => goto("/food")}>
      <ArrowLeftIcon class="h-4 w-4" />
    </Button>
    <h1 class="text-lg font-bold tracking-tight">Add Food</h1>
  </div>

  <!-- Search -->
  <div class="relative">
    <SearchIcon
      class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
    />
    <Input
      type="text"
      placeholder="Search recipes..."
      bind:value={search}
      class="pl-9"
    />
  </div>

  <!-- Quick Add Toggle -->
  <Button
    variant={showQuickAdd ? "default" : "outline"}
    class="w-full"
    onclick={() => (showQuickAdd = !showQuickAdd)}
  >
    <ZapIcon class="h-4 w-4 mr-1.5" />
    {showQuickAdd ? "Hide Quick Add" : "Quick Add (custom entry)"}
  </Button>

  {#if showQuickAdd}
    <Card.Root>
      <Card.Header class="pb-2 pt-3 px-4">
        <Card.Title class="text-sm font-semibold">Custom Entry</Card.Title>
      </Card.Header>
      <Card.Content class="px-4 pb-4 space-y-3">
        <Input type="text" placeholder="Food name" bind:value={name} />
        <div class="grid grid-cols-2 gap-2">
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">Calories</span>
            <Input type="number" bind:value={calories} />
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">Protein (g)</span>
            <Input type="number" bind:value={protein_g} step="0.1" />
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">Carbs (g)</span>
            <Input type="number" bind:value={carbs_g} step="0.1" />
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">Fat (g)</span>
            <Input type="number" bind:value={fat_g} step="0.1" />
          </label>
          <label class="space-y-1">
            <span class="text-xs text-muted-foreground">Water (ml)</span>
            <Input type="number" bind:value={water_ml} />
          </label>
        </div>
        <Button class="w-full" onclick={quickAdd} disabled={!name.trim()}>
          <PlusIcon class="h-4 w-4 mr-1.5" />
          Add Entry
        </Button>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Recipe List -->
  {#if filteredRecipes.length > 0}
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <BookOpenIcon class="h-4 w-4 text-muted-foreground" />
          <h3 class="text-sm font-semibold">Saved Recipes</h3>
        </div>
        <Badge variant="secondary" class="text-xs"
          >{filteredRecipes.length}</Badge
        >
      </div>

      <!-- Servings selector -->
      <Card.Root>
        <Card.Content class="p-3 flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Servings</span>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => (servings = Math.max(0.5, servings - 0.5))}
            >
              <MinusIcon class="h-3 w-3" />
            </Button>
            <span class="font-mono font-bold tabular-nums w-8 text-center"
              >{servings}</span
            >
            <Button
              variant="outline"
              size="icon-sm"
              onclick={() => (servings += 0.5)}
            >
              <PlusIcon class="h-3 w-3" />
            </Button>
          </div>
        </Card.Content>
      </Card.Root>

      <div class="space-y-2">
        {#each filteredRecipes as recipe (recipe.id)}
          <RecipeCard {recipe} onclick={() => addFromRecipe(recipe)} />
        {/each}
      </div>
    </div>
  {:else if search.trim()}
    <div class="text-center py-8">
      <SearchIcon class="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
      <p class="text-sm text-muted-foreground">
        No recipes found matching "{search}"
      </p>
    </div>
  {:else}
    <div class="text-center py-8">
      <BookOpenIcon class="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
      <p class="text-sm text-muted-foreground mb-2">No saved recipes yet.</p>
      <Button
        variant="outline"
        size="sm"
        onclick={() => goto("/food/recipes/new")}
      >
        Create one
      </Button>
    </div>
  {/if}
</div>

<!-- Fasting dialog -->
<FastBreakDialog
  bind:open={fastDialogOpen}
  assessment={fastDialogAssessment}
  foodName={fastDialogFoodName}
  onconfirm={handleFastDialogConfirm}
  oncancel={handleFastDialogCancel}
/>
