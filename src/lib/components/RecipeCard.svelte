<script lang="ts">
  import type { Recipe } from "$lib/types";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";

  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import PlusCircleIcon from "@lucide/svelte/icons/plus-circle";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import DropletsIcon from "@lucide/svelte/icons/droplets";

  interface Props {
    recipe: Recipe;
    onclick?: () => void;
    ondelete?: () => void;
    onlog?: (servings: number) => void;
  }

  let { recipe, onclick, ondelete, onlog }: Props = $props();
  let showServingPicker = $state(false);
  let amount = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const computedServings = $derived(
    recipe.serving_size > 0 ? amount / recipe.serving_size : 0,
  );
  const scaledCal = $derived(Math.round(recipe.calories * computedServings));

  function openPicker(e: MouseEvent) {
    e.stopPropagation();
    amount = recipe.serving_size;
    showServingPicker = true;
    requestAnimationFrame(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function confirm(e: MouseEvent) {
    e.stopPropagation();
    if (computedServings > 0) onlog?.(computedServings);
    showServingPicker = false;
  }

  function cancel(e: MouseEvent) {
    e.stopPropagation();
    showServingPicker = false;
  }
</script>

<Card.Root
  class="transition-colors hover:bg-accent/50 cursor-pointer"
  {onclick}
>
  <Card.Content class="p-3">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <h4 class="text-sm font-medium truncate">{recipe.name}</h4>

        <!-- Macro chips -->
        <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 tabular-nums text-blue-400 border-blue-500/20"
          >
            {Math.round(recipe.calories)} cal
          </Badge>
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 tabular-nums text-emerald-400 border-emerald-500/20"
          >
            P{Math.round(recipe.protein_g)}
          </Badge>
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 tabular-nums text-amber-400 border-amber-500/20"
          >
            C{Math.round(recipe.carbs_g - recipe.fiber_g)} net
          </Badge>
          {#if recipe.fiber_g > 0}
            <Badge
              variant="outline"
              class="text-[10px] px-1.5 py-0 tabular-nums text-muted-foreground border-border"
            >
              Fi{Math.round(recipe.fiber_g)}
            </Badge>
          {/if}
          <Badge
            variant="outline"
            class="text-[10px] px-1.5 py-0 tabular-nums text-purple-400 border-purple-500/20"
          >
            F{Math.round(recipe.fat_g)}
          </Badge>
          {#if recipe.water_ml > 0}
            <Badge
              variant="outline"
              class="text-[10px] px-1.5 py-0 tabular-nums text-cyan-400 border-cyan-500/20"
            >
              <DropletsIcon class="h-3 w-3 mr-0.5 inline" />
              {recipe.water_ml}ml
            </Badge>
          {/if}
        </div>

        {#if recipe.serving_size !== 1 || recipe.serving_unit !== "serving"}
          <p class="text-[10px] text-muted-foreground mt-1">
            per {recipe.serving_size}
            {recipe.serving_unit}
          </p>
        {/if}

        {#if recipe.ingredients?.length}
          <div class="text-[10px] text-muted-foreground mt-1.5 space-y-0.5">
            {#each recipe.ingredients as ing (ing.id)}
              <div>
                {ing.quantity}{ing.quantity_unit}
                {ing.ingredient?.name ?? "unknown"}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex flex-col gap-1 shrink-0">
        {#if onlog}
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-emerald-400 h-7 w-7"
            onclick={openPicker}
            title="Log to today"
          >
            <PlusCircleIcon class="h-3.5 w-3.5" />
          </Button>
        {/if}
        {#if ondelete}
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-red-400 h-7 w-7"
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              ondelete?.();
            }}
          >
            <TrashIcon class="h-3.5 w-3.5" />
          </Button>
        {/if}
      </div>
    </div>

    {#if showServingPicker}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="flex items-center gap-2 mt-2 pt-2 border-t border-border"
        onclick={(e: MouseEvent) => e.stopPropagation()}
      >
        <input
          bind:this={inputEl}
          type="number"
          bind:value={amount}
          step="1"
          min="0"
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (computedServings > 0) {
                onlog?.(computedServings);
                showServingPicker = false;
              }
            }
            if (e.key === "Escape") showServingPicker = false;
          }}
          class="w-16 h-7 rounded-md border border-input bg-transparent px-2 text-xs tabular-nums text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <span class="text-xs text-muted-foreground shrink-0"
          >{recipe.serving_unit}</span
        >
        {#if amount > 0}
          <span class="text-[10px] text-muted-foreground tabular-nums">
            {scaledCal} cal
          </span>
        {/if}
        <div class="flex gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-7 w-7 text-muted-foreground hover:text-foreground"
            onclick={cancel}
          >
            <XIcon class="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-7 w-7 text-emerald-400 hover:text-emerald-300"
            onclick={confirm}
          >
            <CheckIcon class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
