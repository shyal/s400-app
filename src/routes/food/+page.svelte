<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { localDateStr } from "$lib/utils/date";
  import NutritionSummary from "$lib/components/NutritionSummary.svelte";
  import WaterTracker from "$lib/components/WaterTracker.svelte";
  import FastingTimer from "$lib/components/FastingTimer.svelte";
  import InsulinChart from "$lib/components/InsulinChart.svelte";
  import GlucosePrompt from "$lib/components/GlucosePrompt.svelte";
  import FoodEntryCard from "$lib/components/FoodEntryCard.svelte";
  import ChatPanel from "$lib/components/ChatPanel.svelte";
  import FastBreakDialog from "$lib/components/FastBreakDialog.svelte";
  import NutritionCalendar from "$lib/components/NutritionCalendar.svelte";
  import RideAdvisor from "$lib/components/RideAdvisor.svelte";
  import {
    type FastingAssessment,
    type Macros,
  } from "$lib/stores/nutrition.svelte";
  import { goto } from "$app/navigation";

  import type {
    Recipe,
    StravaActivity,
    GlucoseReading,
    GlucoseUnit,
    TestEquipment as TEquipment,
    GlucoseModelType,
  } from "$lib/types";
  import { fetchStravaActivities } from "$lib/services/stravaData";
  import { toMgDl } from "$lib/services/glucoseData";
  import { decrementMatchingStrips } from "$lib/services/glucoseData";
  import {
    fetchEquipment,
    fetchFavoriteGlucoseMeter,
  } from "$lib/services/equipmentData";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Input } from "$lib/components/ui/input";
  import { Separator } from "$lib/components/ui/separator";

  import RecipeCard from "$lib/components/RecipeCard.svelte";

  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import BookOpenIcon from "@lucide/svelte/icons/book-open";
  import EggIcon from "@lucide/svelte/icons/egg";
  import SearchIcon from "@lucide/svelte/icons/search";
  import SaveIcon from "@lucide/svelte/icons/save";
  import PillIcon from "@lucide/svelte/icons/pill";
  import UtensilsCrossedIcon from "@lucide/svelte/icons/utensils-crossed";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import XIcon from "@lucide/svelte/icons/x";
  import SlidersHorizontalIcon from "@lucide/svelte/icons/sliders-horizontal";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import ZapIcon from "@lucide/svelte/icons/zap";
  import SunIcon from "@lucide/svelte/icons/sun";
  import SunMediumIcon from "@lucide/svelte/icons/sun-medium";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import LightbulbIcon from "@lucide/svelte/icons/lightbulb";
  import FootprintsIcon from "@lucide/svelte/icons/footprints";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import StarIcon from "@lucide/svelte/icons/star";

  import type { SupplementStacks } from "$lib/types";

  const MORNING_STACK = $derived(nutritionStore.supplementStacks.morning);
  const NOON_STACK = $derived(nutritionStore.supplementStacks.noon);
  const EVENING_STACK = $derived(nutritionStore.supplementStacks.evening);

  // Edit stacks state
  let editingStacks = $state(false);
  let editStacks = $state<SupplementStacks>({
    morning: [],
    noon: [],
    evening: [],
  });
  let editNewName = $state<Record<string, string>>({
    morning: "",
    noon: "",
    evening: "",
  });
  let editNewDose = $state<Record<string, string>>({
    morning: "",
    noon: "",
    evening: "",
  });

  function startEditStacks() {
    editStacks = {
      morning: nutritionStore.supplementStacks.morning.map((s) => ({ ...s })),
      noon: nutritionStore.supplementStacks.noon.map((s) => ({ ...s })),
      evening: nutritionStore.supplementStacks.evening.map((s) => ({ ...s })),
    };
    editNewName = { morning: "", noon: "", evening: "" };
    editNewDose = { morning: "", noon: "", evening: "" };
    editingStacks = true;
  }

  function cancelEditStacks() {
    editingStacks = false;
  }

  function saveEditStacks() {
    nutritionStore.setSupplementStacks(editStacks);
    editingStacks = false;
  }

  function addEditStackItem(stack: "morning" | "noon" | "evening") {
    const name = editNewName[stack].trim();
    const dose = editNewDose[stack].trim();
    if (!name || !dose) return;
    editStacks = {
      ...editStacks,
      [stack]: [...editStacks[stack], { name, dose }],
    };
    editNewName = { ...editNewName, [stack]: "" };
    editNewDose = { ...editNewDose, [stack]: "" };
  }

  function removeEditStackItem(
    stack: "morning" | "noon" | "evening",
    idx: number,
  ) {
    editStacks = {
      ...editStacks,
      [stack]: editStacks[stack].filter((_, i) => i !== idx),
    };
  }

  let showTips = $state(false);
  const TIPS = [
    "Walk 10-15 min after eating to soak up glucose",
    "15 min of sunlight after meals cuts glucose spikes by 28%",
    "Eat protein & veggies first, carbs last",
    "Combo: walk outside in the sun after breaking your fast",
  ];
  let tipIndex = $state(0);
  $effect(() => {
    if (showTips) return;
    const id = setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
    }, 5000);
    return () => clearInterval(id);
  });
  let showDatePicker = $state(false);
  let showAddSupplement = $state(false);
  let expandedStack = $state<"morning" | "noon" | "evening" | null>(null);
  let showIngredients = $state(true);
  let showRecipes = $state(true);
  let ingredientSearch = $state("");
  let recipeSearch = $state("");
  // Ingredient form state
  let editingIngredient = $state<Recipe | null>(null);
  let showIngredientForm = $state(false);
  let ifName = $state("");
  let ifCalories = $state(0);
  let ifProtein = $state(0);
  let ifCarbs = $state(0);
  let ifFiber = $state(0);
  let ifFat = $state(0);
  let ifWater = $state(0);
  let ifServingSize = $state(1);
  let ifServingUnit = $state("serving");
  let ifNotes = $state("");
  // Recipe form state
  let editingRecipe = $state<Recipe | null>(null);
  let showRecipeForm = $state(false);
  let rfName = $state("");
  let rfServingSize = $state(1);
  let rfServingUnit = $state("serving");
  let rfNotes = $state("");
  let rfIngredients = $state<
    { ingredient_id: string; quantity: number; quantity_unit: string }[]
  >([]);
  let rfAddIngId = $state("");
  let rfAddQty = $state(1);
  let rfAddUnit = $state("");

  let showChat = $state(
    typeof localStorage !== "undefined" &&
      localStorage.getItem("chat-open") === "true",
  );
  $effect(() => {
    if (typeof localStorage !== "undefined")
      localStorage.setItem("chat-open", String(showChat));
  });
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
    name: string,
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
    fastDialogFoodName = name;
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

  let newSuppName = $state("");
  let newSuppDose = $state("");
  const totals = $derived(nutritionStore.todaysTotals);
  const targets = $derived(nutritionStore.macroTargets);
  const entries = $derived(
    nutritionStore.foodEntries.filter(
      (e) => e.date === nutritionStore.selectedDate,
    ),
  );

  // Strava activities for the selected date
  let stravaActivities = $state<StravaActivity[]>([]);

  $effect(() => {
    const date = nutritionStore.selectedDate;
    fetchStravaActivities(date, date).then((a) => {
      stravaActivities = a;
    });
  });

  const todayRides = $derived(
    stravaActivities.filter((a) => a.type === "Ride"),
  );

  // Glucose entry state
  let glucoseValue = $state(5.0);
  let glucoseUnit = $state<GlucoseUnit>("mmol/L");
  let glucoseNotes = $state("");
  let glucoseMeters = $state<TEquipment[]>([]);
  let selectedMeterId = $state<number | null>(null);
  let savingGlucose = $state(false);

  // Load meters and pre-select favorite
  $effect(() => {
    fetchEquipment().then((items) => {
      glucoseMeters = items.filter(
        (i) => i.type === "glucose_meter" || i.type === "dual_meter",
      );
      const fav = glucoseMeters.find((m) => m.is_favorite);
      if (fav) selectedMeterId = fav.id;
      else if (glucoseMeters.length > 0) selectedMeterId = glucoseMeters[0].id;
    });
  });

  const glucoseReadings = $derived(
    nutritionStore.glucoseReadings.filter(
      (r) => r.date === nutritionStore.selectedDate,
    ),
  );

  // Glucose model type selection
  let glucoseModelType = $state<GlucoseModelType>("gp");

  // Predicted glucose curve from model
  const predictedGlucose = $derived(
    isToday()
      ? nutritionStore.predictGlucose(stravaActivities, null, glucoseModelType)
      : [],
  );

  // Glucose scheduler
  let dismissedPrompt = $state(false);
  let schedulerNowMin = $state(0);

  $effect(() => {
    function updateSchedulerNow() {
      const now = new Date();
      schedulerNowMin = now.getHours() * 60 + now.getMinutes();
    }
    updateSchedulerNow();
    const id = setInterval(updateSchedulerNow, 60_000);
    return () => clearInterval(id);
  });

  const nextReading = $derived(
    isToday() && !dismissedPrompt
      ? nutritionStore.getNextGlucoseReading(schedulerNowMin)
      : null,
  );

  async function saveGlucoseReading() {
    if (savingGlucose) return;
    savingGlucose = true;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const meter = glucoseMeters.find((m) => m.id === selectedMeterId);
    const result = await nutritionStore.addGlucose({
      date: nutritionStore.selectedDate,
      time,
      value: glucoseValue,
      unit: glucoseUnit,
      equipment_id: selectedMeterId,
      notes: glucoseNotes.trim() || null,
    });
    if (result && meter?.maker) {
      await decrementMatchingStrips(meter.maker);
    }
    glucoseNotes = "";
    savingGlucose = false;
  }

  // Ride window: derived from glucose model prediction (matches RideAdvisor logic)
  const rideWindow = $derived.by(() => {
    if (!isToday() || entries.length === 0) return null;
    if (predictedGlucose.length === 0) return null;

    const baseline = nutritionStore.glucoseModelParams.fasting_baseline_mgdl;
    const peak = predictedGlucose.reduce((max, p) =>
      p.value > max.value ? p : max,
    );
    const peakDelta = peak.value - baseline;

    // Same adaptive noise floor as RideAdvisor
    const n = nutritionStore.glucoseModelParams.data_points_used;
    const noiseFloor = n >= 15 ? 5 : n >= 5 ? 10 : 15;
    if (peakDelta <= noiseFloor) return null;

    return { startMin: peak.timeMin - 15, endMin: peak.timeMin + 30 };
  });

  const supplements = $derived(
    nutritionStore.supplementEntries.filter(
      (e) => e.date === nutritionStore.selectedDate,
    ),
  );
  const takenNames = $derived(
    new Set(supplements.map((s) => s.name.toLowerCase())),
  );
  const morningRemaining = $derived(
    MORNING_STACK.filter((s) => !takenNames.has(s.name.toLowerCase())).length,
  );
  const noonRemaining = $derived(
    NOON_STACK.filter((s) => !takenNames.has(s.name.toLowerCase())).length,
  );
  const eveningRemaining = $derived(
    EVENING_STACK.filter((s) => !takenNames.has(s.name.toLowerCase())).length,
  );

  // Split recipes into ingredients (atomic) and recipes (composites)
  const allIngredients = $derived(
    nutritionStore.recipes.filter((r) => !r.ingredients?.length),
  );
  const allComposites = $derived(
    nutritionStore.recipes.filter((r) => r.ingredients?.length),
  );

  const filteredIngredients = $derived(
    ingredientSearch.trim()
      ? allIngredients.filter((r) =>
          r.name.toLowerCase().includes(ingredientSearch.toLowerCase()),
        )
      : allIngredients,
  );
  const filteredComposites = $derived(
    recipeSearch.trim()
      ? allComposites.filter((r) =>
          r.name.toLowerCase().includes(recipeSearch.toLowerCase()),
        )
      : allComposites,
  );
  const rfComputedMacros = $derived(
    rfIngredients.length > 0
      ? (() => {
          const ingMap = new Map(allIngredients.map((r) => [r.id, r]));
          let cal = 0,
            p = 0,
            c = 0,
            f = 0,
            fi = 0,
            w = 0;
          for (const ing of rfIngredients) {
            const r = ingMap.get(ing.ingredient_id);
            if (!r) continue;
            const scale =
              ing.quantity_unit === r.serving_unit
                ? ing.quantity / r.serving_size
                : ing.quantity;
            cal += r.calories * scale;
            p += r.protein_g * scale;
            c += r.carbs_g * scale;
            f += r.fat_g * scale;
            fi += r.fiber_g * scale;
            w += (r.water_ml ?? 0) * scale;
          }
          return {
            calories: Math.round(cal),
            protein_g: Math.round(p * 10) / 10,
            carbs_g: Math.round(c * 10) / 10,
            fat_g: Math.round(f * 10) / 10,
            fiber_g: Math.round(fi * 10) / 10,
            water_ml: Math.round(w),
          };
        })()
      : {
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          water_ml: 0,
        },
  );

  function addSupplement() {
    if (!newSuppName.trim()) return;
    nutritionStore.addSupplement({
      name: newSuppName.trim(),
      dose: newSuppDose.trim() || null,
      notes: null,
    });
    newSuppName = "";
    newSuppDose = "";
    showAddSupplement = false;
  }

  function prevDay() {
    const [y, mo, d] = nutritionStore.selectedDate.split("-").map(Number);
    nutritionStore.setDate(localDateStr(new Date(y, mo - 1, d - 1)));
  }

  function nextDay() {
    const [y, mo, d] = nutritionStore.selectedDate.split("-").map(Number);
    nutritionStore.setDate(localDateStr(new Date(y, mo - 1, d + 1)));
  }

  function isToday(): boolean {
    return nutritionStore.selectedDate === localDateStr();
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Ingredient form helpers
  function openIngredientForm(item?: Recipe) {
    editingIngredient = item ?? null;
    ifName = item?.name ?? "";
    ifCalories = item?.calories ?? 0;
    ifProtein = item?.protein_g ?? 0;
    ifCarbs = item?.carbs_g ?? 0;
    ifFiber = item?.fiber_g ?? 0;
    ifFat = item?.fat_g ?? 0;
    ifWater = item?.water_ml ?? 0;
    ifServingSize = item?.serving_size ?? 1;
    ifServingUnit = item?.serving_unit ?? "g";
    ifNotes = item?.notes ?? "";
    showIngredientForm = true;
  }

  function closeIngredientForm() {
    showIngredientForm = false;
    editingIngredient = null;
  }

  function saveIngredient() {
    if (!ifName.trim()) return;
    const data = {
      name: ifName.trim(),
      calories: ifCalories,
      protein_g: ifProtein,
      carbs_g: ifCarbs,
      fiber_g: ifFiber,
      fat_g: ifFat,
      water_ml: ifWater,
      serving_size: ifServingSize,
      serving_unit: ifServingUnit,
      notes: ifNotes.trim() || undefined,
    };
    if (editingIngredient) {
      nutritionStore.updateRecipe({ ...editingIngredient, ...data });
    } else {
      nutritionStore.addRecipe(data);
    }
    closeIngredientForm();
  }

  // Recipe form helpers
  function openRecipeForm(recipe?: Recipe) {
    editingRecipe = recipe ?? null;
    rfName = recipe?.name ?? "";
    rfServingSize = recipe?.serving_size ?? 1;
    rfServingUnit = recipe?.serving_unit ?? "serving";
    rfNotes = recipe?.notes ?? "";
    rfIngredients =
      recipe?.ingredients?.map((i) => ({
        ingredient_id: i.ingredient_id,
        quantity: i.quantity,
        quantity_unit: i.quantity_unit,
      })) ?? [];
    rfAddIngId = "";
    rfAddQty = 1;
    rfAddUnit = "";
    showRecipeForm = true;
  }

  function closeRecipeForm() {
    showRecipeForm = false;
    editingRecipe = null;
  }

  function addRecipeIngredient() {
    if (!rfAddIngId) return;
    const ing = allIngredients.find((i) => i.id === rfAddIngId);
    rfIngredients = [
      ...rfIngredients,
      {
        ingredient_id: rfAddIngId,
        quantity: rfAddQty,
        quantity_unit: rfAddUnit || ing?.serving_unit || "g",
      },
    ];
    rfAddIngId = "";
    rfAddQty = 1;
    rfAddUnit = "";
  }

  function removeRecipeIngredient(idx: number) {
    rfIngredients = rfIngredients.filter((_, i) => i !== idx);
  }

  function ingredientName(id: string): string {
    return allIngredients.find((i) => i.id === id)?.name ?? "?";
  }

  function saveRecipe() {
    if (!rfName.trim() || rfIngredients.length === 0) return;
    if (editingRecipe) {
      nutritionStore.updateRecipeIngredients(editingRecipe.id, rfIngredients);
      nutritionStore.updateRecipe({
        ...editingRecipe,
        name: rfName.trim(),
        serving_size: rfServingSize,
        serving_unit: rfServingUnit,
        notes: rfNotes.trim() || undefined,
        ...rfComputedMacros,
      });
    } else {
      nutritionStore.addRecipeWithIngredients(
        {
          name: rfName.trim(),
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          water_ml: 0,
          serving_size: rfServingSize,
          serving_unit: rfServingUnit,
          notes: rfNotes.trim() || undefined,
        },
        rfIngredients,
      );
    }
    closeRecipeForm();
  }
</script>

<svelte:head>
  <title>Food Journal</title>
</svelte:head>

<div class="flex h-[calc(100dvh-5rem)]">
  {#if showChat}
    <div class="w-full md:w-80 lg:w-96 shrink-0">
      <ChatPanel />
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto {showChat ? 'hidden md:block' : ''}">
    <div class="p-4 space-y-3 pb-24">
      <!-- Date Navigation -->
      <div class="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon-sm" onclick={prevDay}>
          <ChevronLeftIcon class="h-4 w-4" />
        </Button>

        <button
          class="flex-1 text-center"
          onclick={() => {
            showDatePicker = !showDatePicker;
          }}
        >
          <div class="flex items-center justify-center gap-2">
            <CalendarIcon class="h-4 w-4 text-muted-foreground" />
            <h1 class="text-lg font-bold tracking-tight">
              {isToday() ? "Today" : formatDate(nutritionStore.selectedDate)}
            </h1>
          </div>
          {#if !isToday()}
            <p class="text-xs text-muted-foreground">
              {nutritionStore.selectedDate}
            </p>
          {/if}
        </button>

        <Button variant="outline" size="icon-sm" onclick={nextDay}>
          <ChevronRightIcon class="h-4 w-4" />
        </Button>
      </div>

      {#if showDatePicker}
        <Card.Root>
          <Card.Content class="p-3 flex gap-2 items-center">
            <Input
              type="date"
              value={nutritionStore.selectedDate}
              onchange={(e: Event) => {
                nutritionStore.setDate(
                  (e.currentTarget as HTMLInputElement).value,
                );
                showDatePicker = false;
              }}
              class="flex-1"
            />
            {#if !isToday()}
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  nutritionStore.setDate(localDateStr());
                  showDatePicker = false;
                }}
              >
                Today
              </Button>
            {/if}
          </Card.Content>
        </Card.Root>
      {/if}

      <!-- Macro Summary -->
      <NutritionSummary {totals} {targets} />

      <!-- Fasting + Water side by side on wider screens, stacked on mobile -->
      <div class="grid grid-cols-1 gap-3">
        <FastingTimer />
        <WaterTracker />
      </div>

      <!-- Glucose Prompt -->
      {#if nextReading}
        <GlucosePrompt
          reading={nextReading}
          onlog={() => {
            dismissedPrompt = false;
            const glucoseSection = document.getElementById("glucose-section");
            glucoseSection?.scrollIntoView({ behavior: "smooth" });
          }}
          ondismiss={() => {
            dismissedPrompt = true;
          }}
        />
      {/if}

      <!-- Insulin Response Chart -->
      {#if entries.length > 0 || glucoseReadings.length > 0 || predictedGlucose.length > 0}
        <InsulinChart
          {entries}
          isToday={isToday()}
          {rideWindow}
          activities={stravaActivities}
          {glucoseReadings}
          {predictedGlucose}
          modelLabel={nutritionStore.modelLabel}
          feedingWindow={nutritionStore.feedingWindow}
          glucoseParams={nutritionStore.glucoseModelParams}
          {glucoseModelType}
          onModelChange={(m) => {
            glucoseModelType = m;
          }}
        />
        {#if entries.length > 0}
          <RideAdvisor
            {entries}
            isToday={isToday()}
            activities={stravaActivities}
            glucoseParams={nutritionStore.glucoseModelParams}
          />
        {/if}
      {/if}

      <!-- Glucose Readings -->
      <Card.Root id="glucose-section">
        <Card.Header class="pb-2 pt-3 px-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <DropletIcon class="h-4 w-4 text-purple-400" />
              <Card.Title class="text-sm font-semibold">Glucose</Card.Title>
            </div>
            <Badge variant="secondary" class="text-xs"
              >{glucoseReadings.length}</Badge
            >
          </div>
        </Card.Header>
        <Card.Content class="px-4 pb-3 space-y-3">
          <!-- Entry form -->
          <div class="space-y-2 p-3 rounded-lg border bg-secondary/30">
            <div class="flex gap-2">
              <div class="flex-1">
                <label class="text-[10px] text-muted-foreground block mb-0.5"
                  >Value</label
                >
                <Input
                  type="number"
                  bind:value={glucoseValue}
                  step="0.1"
                  min="0"
                  class="h-8 text-sm tabular-nums"
                />
              </div>
              <div class="w-24">
                <label class="text-[10px] text-muted-foreground block mb-0.5"
                  >Unit</label
                >
                <select
                  bind:value={glucoseUnit}
                  class="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="mmol/L">mmol/L</option>
                  <option value="mg/dL">mg/dL</option>
                </select>
              </div>
            </div>
            {#if glucoseMeters.length > 0}
              <div>
                <label class="text-[10px] text-muted-foreground block mb-0.5"
                  >Meter</label
                >
                <select
                  bind:value={selectedMeterId}
                  class="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {#each glucoseMeters as meter (meter.id)}
                    <option value={meter.id}>
                      {[meter.maker, meter.model].filter(Boolean).join(" ") ||
                        "Meter"}
                      {#if meter.is_favorite}
                        *{/if}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}
            <Input
              type="text"
              bind:value={glucoseNotes}
              placeholder="Notes (optional)"
              class="h-8 text-xs"
            />
            <Button
              size="sm"
              class="w-full h-8 text-xs"
              onclick={saveGlucoseReading}
              disabled={savingGlucose || glucoseValue <= 0}
            >
              <PlusIcon class="h-3.5 w-3.5 mr-1" />
              Log Reading
            </Button>
          </div>

          <!-- Reading list -->
          {#if glucoseReadings.length === 0}
            <p class="text-sm text-muted-foreground text-center py-2">
              No readings today.
            </p>
          {:else}
            <div class="space-y-1">
              {#each glucoseReadings as reading (reading.id)}
                <div
                  class="flex items-center justify-between py-1.5 px-2 rounded-md bg-secondary/50"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      class="text-[10px] tabular-nums text-muted-foreground px-1.5 py-0 shrink-0"
                    >
                      {reading.time}
                    </Badge>
                    <span class="text-sm font-mono tabular-nums"
                      >{reading.value} {reading.unit}</span
                    >
                    <span class="text-[10px] text-muted-foreground"
                      >({Math.round(toMgDl(reading.value, reading.unit))} mg/dL)</span
                    >
                    {#if reading.notes}
                      <span class="text-xs text-muted-foreground truncate"
                        >{reading.notes}</span
                      >
                    {/if}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="shrink-0 text-muted-foreground hover:text-red-400 h-6 w-6"
                    onclick={() => nutritionStore.removeGlucose(reading.id)}
                  >
                    <TrashIcon class="h-3 w-3" />
                  </Button>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Post-Meal Tips -->
      <Card.Root>
        <Card.Header class="pb-0 pt-3 px-4">
          <button
            class="flex items-center justify-between w-full"
            onclick={() => {
              showTips = !showTips;
            }}
          >
            <div class="flex items-center gap-2">
              <LightbulbIcon class="h-4 w-4 text-amber-400" />
              <Card.Title class="text-sm font-semibold"
                >Post-Meal Glucose Tips</Card.Title
              >
            </div>
            <ChevronDownIcon
              class="h-4 w-4 text-muted-foreground transition-transform {showTips
                ? 'rotate-180'
                : ''}"
            />
          </button>
        </Card.Header>
        {#if showTips}
          <Card.Content class="px-4 pb-3 pt-2">
            <div class="space-y-2.5 text-xs text-muted-foreground">
              <div class="flex gap-2.5">
                <FootprintsIcon
                  class="h-4 w-4 text-emerald-400 shrink-0 mt-0.5"
                />
                <div>
                  <span class="text-foreground font-medium"
                    >Walk 10-15 min after eating</span
                  >
                  <p>
                    Muscles soak up circulating glucose without extra insulin.
                    Best within 30 min of a meal.
                  </p>
                </div>
              </div>
              <div class="flex gap-2.5">
                <SunIcon class="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span class="text-foreground font-medium"
                    >Get sunlight after meals</span
                  >
                  <p>
                    Natural daylight improves glucose stability and shifts
                    metabolism toward fat oxidation. 15 min of sun reduced
                    post-meal glucose spikes by 28%.
                  </p>
                </div>
              </div>
              <div class="flex gap-2.5">
                <UtensilsCrossedIcon
                  class="h-4 w-4 text-blue-400 shrink-0 mt-0.5"
                />
                <div>
                  <span class="text-foreground font-medium"
                    >Eat protein & veggies first, carbs last</span
                  >
                  <p>
                    Fiber slows gastric emptying; fat and protein buffer the
                    glucose response.
                  </p>
                </div>
              </div>
              <div
                class="rounded-md bg-primary/5 border border-primary/10 p-2 mt-1"
              >
                <p class="text-[11px]">
                  <span class="font-medium text-foreground">Combo move:</span> Walk
                  outside in the sun after breaking your fast — post-meal walk + sunlight
                  in one shot.
                </p>
              </div>
            </div>
          </Card.Content>
        {:else}
          <Card.Content class="px-4 pb-3 pt-1">
            <p
              class="text-[11px] text-muted-foreground"
              style="transition: opacity 0.3s;"
            >
              {TIPS[tipIndex]}
            </p>
          </Card.Content>
        {/if}
      </Card.Root>

      <!-- Monthly Calendar Heatmap -->
      <NutritionCalendar
        {targets}
        selectedDate={nutritionStore.selectedDate}
        onSelectDate={(d) => nutritionStore.setDate(d)}
      />

      <!-- Food Log -->
      <Card.Root>
        <Card.Header class="pb-2 pt-3 px-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UtensilsCrossedIcon class="h-4 w-4 text-muted-foreground" />
              <Card.Title class="text-sm font-semibold">Food Log</Card.Title>
            </div>
            <Badge variant="secondary" class="text-xs">{entries.length}</Badge>
          </div>
        </Card.Header>
        <Card.Content class="px-4 pb-3">
          {#if entries.length === 0}
            <div class="text-center py-6">
              <UtensilsCrossedIcon
                class="h-8 w-8 mx-auto mb-2 text-muted-foreground/30"
              />
              <p class="text-sm text-muted-foreground">No food logged yet.</p>
            </div>
          {:else}
            {#each entries as entry (entry.id)}
              <FoodEntryCard
                {entry}
                ondelete={(id) => nutritionStore.removeFood(id)}
              />
            {/each}
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Supplements -->
      <Card.Root class="overflow-hidden">
        <Card.Header class="pb-2 pt-3 px-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <PillIcon class="h-4 w-4 text-muted-foreground" />
              <Card.Title class="text-sm font-semibold">Supplements</Card.Title>
            </div>
            <div class="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon-sm"
                class="h-6 w-6 text-muted-foreground"
                onclick={startEditStacks}
              >
                <PencilIcon class="h-3.5 w-3.5" />
              </Button>
              <Badge variant="secondary" class="text-xs"
                >{supplements.length}</Badge
              >
            </div>
          </div>
        </Card.Header>
        <Card.Content class="px-4 pb-3">
          {#if editingStacks}
            <!-- Stack Editor -->
            <div class="space-y-3 mb-3">
              {#each [{ key: "morning" as const, label: "Morning", icon: SunIcon }, { key: "noon" as const, label: "Noon", icon: SunMediumIcon }, { key: "evening" as const, label: "Evening", icon: MoonIcon }] as stackInfo (stackInfo.key)}
                <div class="rounded-md border p-2 space-y-1">
                  <div class="flex items-center gap-1.5 mb-1">
                    <stackInfo.icon class="h-3.5 w-3.5" />
                    <span class="text-xs font-medium">{stackInfo.label}</span>
                  </div>
                  {#each editStacks[stackInfo.key] as item, idx (idx)}
                    <div class="flex items-center gap-1.5 py-0.5 px-1.5">
                      <span class="text-xs flex-1">{item.name}</span>
                      <span
                        class="text-[10px] text-muted-foreground tabular-nums"
                        >{item.dose}</span
                      >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="h-5 w-5 shrink-0 text-muted-foreground hover:text-red-400"
                        onclick={() => removeEditStackItem(stackInfo.key, idx)}
                      >
                        <XIcon class="h-3 w-3" />
                      </Button>
                    </div>
                  {/each}
                  <div class="flex gap-1.5 mt-1 min-w-0">
                    <Input
                      type="text"
                      placeholder="Name"
                      value={editNewName[stackInfo.key]}
                      oninput={(e: Event) => {
                        editNewName = {
                          ...editNewName,
                          [stackInfo.key]: (e.currentTarget as HTMLInputElement)
                            .value,
                        };
                      }}
                      class="flex-1 min-w-0 h-7 text-xs"
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter") addEditStackItem(stackInfo.key);
                      }}
                    />
                    <Input
                      type="text"
                      placeholder="Dose"
                      value={editNewDose[stackInfo.key]}
                      oninput={(e: Event) => {
                        editNewDose = {
                          ...editNewDose,
                          [stackInfo.key]: (e.currentTarget as HTMLInputElement)
                            .value,
                        };
                      }}
                      class="w-16 shrink-0 h-7 text-xs"
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === "Enter") addEditStackItem(stackInfo.key);
                      }}
                    />
                    <Button
                      size="sm"
                      class="h-7 px-2 shrink-0"
                      onclick={() => addEditStackItem(stackInfo.key)}
                    >
                      <PlusIcon class="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              {/each}
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  class="flex-1 h-8 text-xs"
                  onclick={cancelEditStacks}>Cancel</Button
                >
                <Button
                  size="sm"
                  class="flex-1 h-8 text-xs"
                  onclick={saveEditStacks}
                >
                  <SaveIcon class="h-3.5 w-3.5 mr-1" />
                  Save Stacks
                </Button>
              </div>
            </div>
          {:else}
            <!-- Stack Buttons -->
            <div class="space-y-2 mb-3">
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <!-- Morning -->
                <div class="flex gap-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="flex-1 h-9 text-xs gap-1 border px-2 min-w-0 {morningRemaining ===
                    0
                      ? 'opacity-60 border-border'
                      : 'border-amber-500/30 hover:bg-amber-500/10'}"
                    onclick={() => {
                      expandedStack =
                        expandedStack === "morning" ? null : "morning";
                    }}
                  >
                    <SunIcon class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span class="truncate">AM</span>
                    <ChevronDownIcon
                      class="h-3 w-3 text-muted-foreground shrink-0 transition-transform {expandedStack ===
                      'morning'
                        ? 'rotate-180'
                        : ''}"
                    />
                    {#if morningRemaining === 0}
                      <Badge
                        variant="secondary"
                        class="text-[10px] px-1 py-0 shrink-0">Done</Badge
                      >
                    {:else}
                      <Badge
                        variant="outline"
                        class="text-[10px] px-1 py-0 shrink-0 border-amber-500/30 text-amber-500"
                        >{MORNING_STACK.length -
                          morningRemaining}/{MORNING_STACK.length}</Badge
                      >
                    {/if}
                  </Button>
                  {#if morningRemaining > 0}
                    <Button
                      size="sm"
                      class="h-9 px-2.5 text-xs shrink-0 bg-amber-600 hover:bg-amber-700"
                      onclick={() =>
                        nutritionStore.addSupplementStack(MORNING_STACK)}
                    >
                      <PlusIcon class="h-3.5 w-3.5" />
                    </Button>
                  {/if}
                </div>
                <!-- Noon -->
                <div class="flex gap-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="flex-1 h-9 text-xs gap-1 border px-2 min-w-0 {noonRemaining ===
                    0
                      ? 'opacity-60 border-border'
                      : 'border-orange-500/30 hover:bg-orange-500/10'}"
                    onclick={() => {
                      expandedStack = expandedStack === "noon" ? null : "noon";
                    }}
                  >
                    <SunMediumIcon
                      class="h-3.5 w-3.5 text-orange-500 shrink-0"
                    />
                    <span class="truncate">Noon</span>
                    <ChevronDownIcon
                      class="h-3 w-3 text-muted-foreground shrink-0 transition-transform {expandedStack ===
                      'noon'
                        ? 'rotate-180'
                        : ''}"
                    />
                    {#if noonRemaining === 0}
                      <Badge
                        variant="secondary"
                        class="text-[10px] px-1 py-0 shrink-0">Done</Badge
                      >
                    {:else}
                      <Badge
                        variant="outline"
                        class="text-[10px] px-1 py-0 shrink-0 border-orange-500/30 text-orange-500"
                        >{NOON_STACK.length -
                          noonRemaining}/{NOON_STACK.length}</Badge
                      >
                    {/if}
                  </Button>
                  {#if noonRemaining > 0}
                    <Button
                      size="sm"
                      class="h-9 px-2.5 text-xs shrink-0 bg-orange-600 hover:bg-orange-700"
                      onclick={() =>
                        nutritionStore.addSupplementStack(NOON_STACK)}
                    >
                      <PlusIcon class="h-3.5 w-3.5" />
                    </Button>
                  {/if}
                </div>
                <!-- Evening -->
                <div class="flex gap-1 min-w-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="flex-1 h-9 text-xs gap-1 border px-2 min-w-0 {eveningRemaining ===
                    0
                      ? 'opacity-60 border-border'
                      : 'border-indigo-500/30 hover:bg-indigo-500/10'}"
                    onclick={() => {
                      expandedStack =
                        expandedStack === "evening" ? null : "evening";
                    }}
                  >
                    <MoonIcon class="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    <span class="truncate">PM</span>
                    <ChevronDownIcon
                      class="h-3 w-3 text-muted-foreground shrink-0 transition-transform {expandedStack ===
                      'evening'
                        ? 'rotate-180'
                        : ''}"
                    />
                    {#if eveningRemaining === 0}
                      <Badge
                        variant="secondary"
                        class="text-[10px] px-1 py-0 shrink-0">Done</Badge
                      >
                    {:else}
                      <Badge
                        variant="outline"
                        class="text-[10px] px-1 py-0 shrink-0 border-indigo-500/30 text-indigo-400"
                        >{EVENING_STACK.length -
                          eveningRemaining}/{EVENING_STACK.length}</Badge
                      >
                    {/if}
                  </Button>
                  {#if eveningRemaining > 0}
                    <Button
                      size="sm"
                      class="h-9 px-2.5 text-xs shrink-0 bg-indigo-600 hover:bg-indigo-700"
                      onclick={() =>
                        nutritionStore.addSupplementStack(EVENING_STACK)}
                    >
                      <PlusIcon class="h-3.5 w-3.5" />
                    </Button>
                  {/if}
                </div>
              </div>

              {#if expandedStack === "morning"}
                <div
                  class="rounded-md border border-amber-500/20 bg-amber-500/5 p-2 space-y-0.5"
                >
                  {#each MORNING_STACK as item (item.name)}
                    {@const taken = takenNames.has(item.name.toLowerCase())}
                    <div
                      class="flex items-center gap-2 py-1 px-1.5 rounded {taken
                        ? 'opacity-50'
                        : ''}"
                    >
                      {#if taken}
                        <CircleCheckIcon
                          class="h-3.5 w-3.5 text-emerald-500 shrink-0"
                        />
                      {:else}
                        <CircleIcon
                          class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                        />
                      {/if}
                      <span
                        class="text-xs flex-1 {taken
                          ? 'line-through text-muted-foreground'
                          : ''}">{item.name}</span
                      >
                      <span
                        class="text-[10px] text-muted-foreground tabular-nums"
                        >{item.dose}</span
                      >
                    </div>
                  {/each}
                </div>
              {/if}

              {#if expandedStack === "noon"}
                <div
                  class="rounded-md border border-orange-500/20 bg-orange-500/5 p-2 space-y-0.5"
                >
                  {#each NOON_STACK as item (item.name)}
                    {@const taken = takenNames.has(item.name.toLowerCase())}
                    <div
                      class="flex items-center gap-2 py-1 px-1.5 rounded {taken
                        ? 'opacity-50'
                        : ''}"
                    >
                      {#if taken}
                        <CircleCheckIcon
                          class="h-3.5 w-3.5 text-emerald-500 shrink-0"
                        />
                      {:else}
                        <CircleIcon
                          class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                        />
                      {/if}
                      <span
                        class="text-xs flex-1 {taken
                          ? 'line-through text-muted-foreground'
                          : ''}">{item.name}</span
                      >
                      <span
                        class="text-[10px] text-muted-foreground tabular-nums"
                        >{item.dose}</span
                      >
                    </div>
                  {/each}
                </div>
              {/if}

              {#if expandedStack === "evening"}
                <div
                  class="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-2 space-y-0.5"
                >
                  {#each EVENING_STACK as item (item.name)}
                    {@const taken = takenNames.has(item.name.toLowerCase())}
                    <div
                      class="flex items-center gap-2 py-1 px-1.5 rounded {taken
                        ? 'opacity-50'
                        : ''}"
                    >
                      {#if taken}
                        <CircleCheckIcon
                          class="h-3.5 w-3.5 text-emerald-500 shrink-0"
                        />
                      {:else}
                        <CircleIcon
                          class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                        />
                      {/if}
                      <span
                        class="text-xs flex-1 {taken
                          ? 'line-through text-muted-foreground'
                          : ''}">{item.name}</span
                      >
                      <span
                        class="text-[10px] text-muted-foreground tabular-nums"
                        >{item.dose}</span
                      >
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}

          {#if supplements.length === 0 && !showAddSupplement}
            <p class="text-sm text-muted-foreground text-center py-3">
              No supplements logged. Tap a stack above to log them all.
            </p>
          {:else}
            <div class="space-y-1">
              {#each supplements as supp (supp.id)}
                <div
                  class="flex items-center justify-between py-1.5 px-2 rounded-md bg-secondary/50"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <Badge
                      variant="outline"
                      class="text-[10px] tabular-nums text-muted-foreground px-1.5 py-0 shrink-0"
                    >
                      {supp.time}
                    </Badge>
                    <span class="text-sm truncate">{supp.name}</span>
                    {#if supp.dose}
                      <span class="text-xs text-muted-foreground shrink-0"
                        >{supp.dose}</span
                      >
                    {/if}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="shrink-0 text-muted-foreground hover:text-red-400 h-6 w-6"
                    onclick={() => nutritionStore.removeSupplement(supp.id)}
                  >
                    <TrashIcon class="h-3 w-3" />
                  </Button>
                </div>
              {/each}
            </div>
          {/if}

          {#if showAddSupplement}
            <!-- Quick-tap frequent supplements -->
            {#if nutritionStore.frequentSupplements.length > 0}
              <div class="mt-3 flex flex-wrap gap-1.5">
                {#each nutritionStore.frequentSupplements as fs (fs.name)}
                  <Button
                    variant="outline"
                    size="sm"
                    class="text-xs h-7 gap-1"
                    onclick={() => {
                      nutritionStore.addSupplement({
                        name: fs.name,
                        dose: fs.dose,
                        notes: null,
                      });
                    }}
                  >
                    <ZapIcon class="h-3 w-3" />
                    {fs.name}{#if fs.dose}
                      <span class="text-muted-foreground">{fs.dose}</span>{/if}
                  </Button>
                {/each}
              </div>
            {/if}

            <!-- Custom entry -->
            <div class="mt-3 flex gap-2">
              <Input
                type="text"
                placeholder="Name"
                bind:value={newSuppName}
                class="flex-1"
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") addSupplement();
                }}
              />
              <Input
                type="text"
                placeholder="Dose"
                bind:value={newSuppDose}
                class="w-24"
                onkeydown={(e: KeyboardEvent) => {
                  if (e.key === "Enter") addSupplement();
                }}
              />
              <Button size="sm" onclick={addSupplement}>Add</Button>
            </div>
          {:else}
            <Button
              variant="ghost"
              size="sm"
              class="mt-2 text-xs text-muted-foreground w-full"
              onclick={() => {
                showAddSupplement = true;
              }}
            >
              <PlusIcon class="h-3 w-3 mr-1" />
              Add supplement
            </Button>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Action Buttons -->
      <Button class="h-12 w-full" onclick={() => goto("/food/add")}>
        <PlusIcon class="h-4 w-4 mr-1.5" />
        Add Food
      </Button>

      <!-- Recipes Section (composites) -->
      <Card.Root>
        <Card.Header class="pb-2 pt-3 px-4">
          <button
            class="flex items-center justify-between w-full"
            onclick={() => {
              showRecipes = !showRecipes;
            }}
          >
            <div class="flex items-center gap-2">
              <BookOpenIcon class="h-4 w-4 text-muted-foreground" />
              <Card.Title class="text-sm font-semibold">Recipes</Card.Title>
              <Badge variant="secondary" class="text-xs"
                >{allComposites.length}</Badge
              >
            </div>
            <ChevronDownIcon
              class="h-4 w-4 text-muted-foreground transition-transform {showRecipes
                ? 'rotate-180'
                : ''}"
            />
          </button>
        </Card.Header>
        {#if showRecipes}
          <Card.Content class="px-4 pb-3 space-y-2">
            {#if allComposites.length > 3}
              <div class="relative">
                <SearchIcon
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search recipes..."
                  bind:value={recipeSearch}
                  class="pl-8 h-8 text-xs"
                />
              </div>
            {/if}

            <Button
              variant="outline"
              size="sm"
              class="w-full h-8 text-xs"
              onclick={() => openRecipeForm()}
              disabled={allIngredients.length === 0}
            >
              <PlusIcon class="h-3.5 w-3.5 mr-1" />
              New Recipe
            </Button>
            {#if allIngredients.length === 0}
              <p class="text-[10px] text-muted-foreground text-center">
                Add ingredients first to create recipes.
              </p>
            {/if}

            {#if showRecipeForm}
              <Card.Root class="border-primary/30">
                <Card.Content class="p-3 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium"
                      >{editingRecipe ? "Edit" : "New"} Recipe</span
                    >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="h-6 w-6"
                      onclick={closeRecipeForm}
                    >
                      <XIcon class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    type="text"
                    bind:value={rfName}
                    placeholder="e.g. Protein Shake"
                    class="h-8 text-sm"
                  />

                  <Separator />

                  <!-- Ingredient picker -->
                  <div>
                    <span class="text-xs text-muted-foreground"
                      >Ingredients</span
                    >

                    {#if rfIngredients.length > 0}
                      <div class="space-y-1 mt-1.5">
                        {#each rfIngredients as ing, idx (idx)}
                          <div
                            class="flex items-center gap-1.5 py-1 px-2 rounded-md bg-secondary/50 text-xs"
                          >
                            <span class="flex-1 truncate"
                              >{ingredientName(ing.ingredient_id)}</span
                            >
                            <span
                              class="text-muted-foreground tabular-nums shrink-0"
                              >{ing.quantity}{ing.quantity_unit}</span
                            >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              class="h-5 w-5 shrink-0 text-muted-foreground hover:text-red-400"
                              onclick={() => removeRecipeIngredient(idx)}
                            >
                              <XIcon class="h-3 w-3" />
                            </Button>
                          </div>
                        {/each}
                      </div>
                    {/if}

                    <div class="flex gap-1.5 mt-1.5">
                      <select
                        bind:value={rfAddIngId}
                        class="flex-1 h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Select ingredient...</option>
                        {#each allIngredients as ing (ing.id)}
                          <option value={ing.id}
                            >{ing.name} ({ing.serving_size}{ing.serving_unit})</option
                          >
                        {/each}
                      </select>
                      <Input
                        type="number"
                        bind:value={rfAddQty}
                        step="0.5"
                        min="0"
                        class="w-16 h-7 text-xs"
                        placeholder="Qty"
                      />
                      <Input
                        type="text"
                        bind:value={rfAddUnit}
                        class="w-14 h-7 text-xs"
                        placeholder={allIngredients.find(
                          (i) => i.id === rfAddIngId,
                        )?.serving_unit ?? "unit"}
                      />
                      <Button
                        size="sm"
                        class="h-7 px-2"
                        onclick={addRecipeIngredient}
                        disabled={!rfAddIngId}
                      >
                        <PlusIcon class="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {#if rfIngredients.length > 0}
                    <div class="flex gap-1.5 flex-wrap">
                      <Badge
                        variant="outline"
                        class="text-[10px] tabular-nums text-blue-400 border-blue-500/20"
                        >{rfComputedMacros.calories} cal</Badge
                      >
                      <Badge
                        variant="outline"
                        class="text-[10px] tabular-nums text-emerald-400 border-emerald-500/20"
                        >P{rfComputedMacros.protein_g}g</Badge
                      >
                      <Badge
                        variant="outline"
                        class="text-[10px] tabular-nums text-amber-400 border-amber-500/20"
                        >C{Math.round(
                          (rfComputedMacros.carbs_g -
                            rfComputedMacros.fiber_g) *
                            10,
                        ) / 10}g net</Badge
                      >
                      {#if rfComputedMacros.fiber_g > 0}
                        <Badge
                          variant="outline"
                          class="text-[10px] tabular-nums text-muted-foreground border-border"
                          >Fi{rfComputedMacros.fiber_g}g</Badge
                        >
                      {/if}
                      <Badge
                        variant="outline"
                        class="text-[10px] tabular-nums text-purple-400 border-purple-500/20"
                        >F{rfComputedMacros.fat_g}g</Badge
                      >
                      {#if rfComputedMacros.water_ml > 0}
                        <Badge
                          variant="outline"
                          class="text-[10px] tabular-nums text-cyan-400 border-cyan-500/20"
                          >{rfComputedMacros.water_ml}ml water</Badge
                        >
                      {/if}
                    </div>
                  {/if}

                  <Separator />

                  <div class="grid grid-cols-2 gap-2">
                    <label class="space-y-0.5">
                      <span class="text-[10px] text-muted-foreground"
                        >Serving size</span
                      >
                      <Input
                        type="number"
                        bind:value={rfServingSize}
                        step="0.5"
                        class="h-7 text-xs"
                      />
                    </label>
                    <label class="space-y-0.5">
                      <span class="text-[10px] text-muted-foreground"
                        >Serving unit</span
                      >
                      <Input
                        type="text"
                        bind:value={rfServingUnit}
                        placeholder="serving"
                        class="h-7 text-xs"
                      />
                    </label>
                  </div>

                  <Button
                    class="w-full h-8 text-xs"
                    onclick={saveRecipe}
                    disabled={!rfName.trim() || rfIngredients.length === 0}
                  >
                    <SaveIcon class="h-3.5 w-3.5 mr-1" />
                    {editingRecipe ? "Update" : "Save"} Recipe
                  </Button>
                </Card.Content>
              </Card.Root>
            {/if}

            {#if filteredComposites.length === 0 && !showRecipeForm}
              <p class="text-sm text-muted-foreground text-center py-4">
                {recipeSearch.trim()
                  ? `No recipes matching "${recipeSearch}"`
                  : "No recipes yet. Combine ingredients into recipes!"}
              </p>
            {:else}
              <div class="space-y-1.5">
                {#each filteredComposites as recipe (recipe.id)}
                  <RecipeCard
                    {recipe}
                    onclick={() => openRecipeForm(recipe)}
                    onlog={(s) =>
                      logFoodWithFastCheck(
                        recipe.name,
                        {
                          calories: Math.round(recipe.calories * s),
                          protein_g: recipe.protein_g * s,
                          carbs_g: recipe.carbs_g * s,
                          fat_g: recipe.fat_g * s,
                          fiber_g: recipe.fiber_g * s,
                        },
                        () => nutritionStore.addFoodFromRecipe(recipe, s),
                      )}
                    ondelete={() => nutritionStore.removeRecipe(recipe.id)}
                  />
                {/each}
              </div>
            {/if}
          </Card.Content>
        {/if}
      </Card.Root>

      <!-- Ingredients Section -->
      <Card.Root>
        <Card.Header class="pb-2 pt-3 px-4">
          <button
            class="flex items-center justify-between w-full"
            onclick={() => {
              showIngredients = !showIngredients;
            }}
          >
            <div class="flex items-center gap-2">
              <EggIcon class="h-4 w-4 text-muted-foreground" />
              <Card.Title class="text-sm font-semibold">Ingredients</Card.Title>
              <Badge variant="secondary" class="text-xs"
                >{allIngredients.length}</Badge
              >
            </div>
            <ChevronDownIcon
              class="h-4 w-4 text-muted-foreground transition-transform {showIngredients
                ? 'rotate-180'
                : ''}"
            />
          </button>
        </Card.Header>
        {#if showIngredients}
          <Card.Content class="px-4 pb-3 space-y-2">
            <div class="flex gap-2">
              <div class="relative flex-1">
                <SearchIcon
                  class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search ingredients..."
                  bind:value={ingredientSearch}
                  class="pl-8 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                class="h-8"
                onclick={() => openIngredientForm()}
              >
                <PlusIcon class="h-3.5 w-3.5 mr-1" />
                New
              </Button>
            </div>

            {#if showIngredientForm}
              <Card.Root class="border-primary/30">
                <Card.Content class="p-3 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium"
                      >{editingIngredient ? "Edit" : "New"} Ingredient</span
                    >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="h-6 w-6"
                      onclick={closeIngredientForm}
                    >
                      <XIcon class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    type="text"
                    bind:value={ifName}
                    placeholder="e.g. Full Cream Milk"
                    class="h-8 text-sm"
                  />

                  <Separator />

                  <div>
                    <span class="text-xs text-muted-foreground"
                      >Nutrition per serving</span
                    >
                    <div class="grid grid-cols-2 gap-2 mt-1.5">
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Calories</span
                        >
                        <Input
                          type="number"
                          bind:value={ifCalories}
                          class="h-7 text-xs"
                        />
                      </label>
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Protein (g)</span
                        >
                        <Input
                          type="number"
                          bind:value={ifProtein}
                          step="0.1"
                          class="h-7 text-xs"
                        />
                      </label>
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Carbs (g)</span
                        >
                        <Input
                          type="number"
                          bind:value={ifCarbs}
                          step="0.1"
                          class="h-7 text-xs"
                        />
                      </label>
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Fiber (g)</span
                        >
                        <Input
                          type="number"
                          bind:value={ifFiber}
                          step="0.1"
                          class="h-7 text-xs"
                        />
                      </label>
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Fat (g)</span
                        >
                        <Input
                          type="number"
                          bind:value={ifFat}
                          step="0.1"
                          class="h-7 text-xs"
                        />
                      </label>
                      <label class="space-y-0.5">
                        <span class="text-[10px] text-muted-foreground"
                          >Water (ml)</span
                        >
                        <Input
                          type="number"
                          bind:value={ifWater}
                          class="h-7 text-xs"
                        />
                      </label>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <label class="space-y-0.5">
                      <span class="text-[10px] text-muted-foreground"
                        >Serving size</span
                      >
                      <Input
                        type="number"
                        bind:value={ifServingSize}
                        step="0.5"
                        class="h-7 text-xs"
                      />
                    </label>
                    <label class="space-y-0.5">
                      <span class="text-[10px] text-muted-foreground"
                        >Serving unit</span
                      >
                      <Input
                        type="text"
                        bind:value={ifServingUnit}
                        placeholder="g"
                        class="h-7 text-xs"
                      />
                    </label>
                  </div>

                  <Button
                    class="w-full h-8 text-xs"
                    onclick={saveIngredient}
                    disabled={!ifName.trim()}
                  >
                    <SaveIcon class="h-3.5 w-3.5 mr-1" />
                    {editingIngredient ? "Update" : "Save"} Ingredient
                  </Button>
                </Card.Content>
              </Card.Root>
            {/if}

            {#if filteredIngredients.length === 0}
              <p class="text-sm text-muted-foreground text-center py-4">
                {ingredientSearch.trim()
                  ? `No ingredients matching "${ingredientSearch}"`
                  : "No ingredients yet."}
              </p>
            {:else}
              <div class="space-y-1.5">
                {#each filteredIngredients as recipe (recipe.id)}
                  <RecipeCard
                    {recipe}
                    onclick={() => openIngredientForm(recipe)}
                    onlog={(s) =>
                      logFoodWithFastCheck(
                        recipe.name,
                        {
                          calories: Math.round(recipe.calories * s),
                          protein_g: recipe.protein_g * s,
                          carbs_g: recipe.carbs_g * s,
                          fat_g: recipe.fat_g * s,
                          fiber_g: recipe.fiber_g * s,
                        },
                        () => nutritionStore.addFoodFromRecipe(recipe, s),
                      )}
                    ondelete={() => nutritionStore.removeRecipe(recipe.id)}
                  />
                {/each}
              </div>
            {/if}
          </Card.Content>
        {/if}
      </Card.Root>

      <!-- Settings link -->
      <Button
        variant="link"
        class="w-full text-xs text-muted-foreground"
        onclick={() => goto("/food/targets")}
      >
        <SlidersHorizontalIcon class="h-3 w-3 mr-1" />
        Edit macro targets
      </Button>
    </div>
  </div>
</div>

<!-- Fasting dialog -->
<FastBreakDialog
  bind:open={fastDialogOpen}
  assessment={fastDialogAssessment}
  foodName={fastDialogFoodName}
  onconfirm={handleFastDialogConfirm}
  oncancel={handleFastDialogCancel}
/>

<!-- Chat toggle FAB -->
<Button
  size="icon"
  class="fixed bottom-20 right-4 z-50 h-12 w-12 rounded-full shadow-lg {showChat
    ? 'bg-secondary text-foreground'
    : ''}"
  onclick={() => {
    showChat = !showChat;
  }}
>
  {#if showChat}
    <XIcon class="h-5 w-5" />
  {:else}
    <MessageCircleIcon class="h-5 w-5" />
  {/if}
</Button>
