import type {
  Recipe,
  RecipeIngredient,
  FoodEntry,
  WaterEntry,
  MacroTargets,
  WeightEntry,
  DailyNutrition,
  SupplementEntry,
  SupplementStacks,
  GlucoseReading,
  GlucoseModelParams,
  GlucoseModelType,
} from "$lib/types";
import { uuid } from "$lib/uuid";
import { localDateStr } from "$lib/utils/date";
import {
  fetchRecipes,
  upsertRecipe,
  deleteRecipe as deleteRecipeApi,
  fetchFoodEntries,
  fetchFoodEntriesRange,
  fetchLatestFoodDate,
  upsertFoodEntry,
  deleteFoodEntry as deleteFoodEntryApi,
  fetchWaterEntries,
  upsertWaterEntry,
  deleteWaterEntry as deleteWaterEntryApi,
  fetchSupplementEntries,
  upsertSupplementEntry,
  deleteSupplementEntry as deleteSupplementEntryApi,
  fetchFrequentSupplements,
  fetchMacroTargets,
  upsertMacroTargets,
  fetchWeightLog,
  upsertWeightEntry,
  upsertRecipeIngredients,
  computeRecipeMacros,
  fetchSupplementStacks,
  upsertSupplementStacks,
} from "$lib/services/nutritionData";
import {
  fetchGlucoseReadings,
  fetchGlucoseReadingsRange,
  addGlucoseReading as addGlucoseReadingApi,
  deleteGlucoseReading as deleteGlucoseReadingApi,
  fetchGlucoseModelParams,
  upsertGlucoseModelParams,
} from "$lib/services/glucoseData";
import {
  defaultParams,
  predictGlucoseCurve,
  foodEntryToMealEvent,
  stravaToExerciseEvent,
  aggregateMeals,
  type GlucosePoint,
  type MealEvent,
  type ExerciseEvent,
} from "$lib/services/glucoseModel";
import {
  predictGlucoseCurveGP,
  type GPGlucosePoint,
} from "$lib/services/glucoseModelGP";
import { fitParams } from "$lib/services/glucoseModelFitter";
import {
  generateSchedule,
  nextDueReading,
  readingTypeForTime,
  type ScheduledReading,
} from "$lib/services/glucoseScheduler";

// ── Fasting Threshold Constants ──

// ── Fasting Threshold Constants (applied to insulin impact score, not raw calories) ──

export const FASTING_SAFE_SCORE = 10;
export const FASTING_CAUTION_SCORE = 50;
export const FASTING_BREAK_SINGLE_SCORE = 100;
export const FASTING_WINDOW_MINUTES = 30;

// Insulin impact weights per gram of macronutrient
// Net carbs → biggest insulin spike, protein → moderate, fat → minimal
export const INSULIN_WEIGHT_CARB = 4.0; // net carbs × 4 cal/g × 1.0 weight
export const INSULIN_WEIGHT_PROTEIN = 2.0; // protein × 4 cal/g × 0.5 weight
export const INSULIN_WEIGHT_FAT = 0.9; // fat × 9 cal/g × 0.1 weight

export type FastingImpact = "SAFE" | "CAUTION" | "BREAKS_FAST";

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface FastingAssessment {
  impact: FastingImpact;
  rollingScore: number;
  proposedScore: number;
  proposedCalories: number;
}

/** Compute insulin impact score from macros */
export function insulinScore(m: Macros): number {
  const netCarbs = Math.max(0, m.carbs_g - m.fiber_g);
  return (
    netCarbs * INSULIN_WEIGHT_CARB +
    m.protein_g * INSULIN_WEIGHT_PROTEIN +
    m.fat_g * INSULIN_WEIGHT_FAT
  );
}

/** Given existing entries and proposed macros, assess fasting impact using insulin scoring */
export function assessFastImpactPure(
  proposed: Macros,
  existingEntries: FoodEntry[],
  fastBrokenAt: string | null,
): FastingAssessment {
  const proposedScore = insulinScore(proposed);
  if (fastBrokenAt) {
    return {
      impact: "SAFE",
      rollingScore: 0,
      proposedScore,
      proposedCalories: proposed.calories,
    };
  }
  if (proposedScore >= FASTING_BREAK_SINGLE_SCORE) {
    return {
      impact: "BREAKS_FAST",
      rollingScore: 0,
      proposedScore,
      proposedCalories: proposed.calories,
    };
  }

  // Sum insulin score from entries within the rolling 30-min window ending now
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - FASTING_WINDOW_MINUTES * 60 * 1000,
  );

  const today = localDateStr();
  const rollingScore = existingEntries
    .filter((e) => {
      if (e.date !== today) return false;
      const [h, m] = e.time.split(":").map(Number);
      const entryTime = new Date();
      entryTime.setHours(h, m, 0, 0);
      return entryTime >= windowStart && entryTime <= now;
    })
    .reduce((sum, e) => sum + insulinScore(e), 0);

  const totalScore = rollingScore + proposedScore;

  if (totalScore < FASTING_SAFE_SCORE) {
    return {
      impact: "SAFE",
      rollingScore,
      proposedScore,
      proposedCalories: proposed.calories,
    };
  }
  if (totalScore < FASTING_CAUTION_SCORE) {
    return {
      impact: "CAUTION",
      rollingScore,
      proposedScore,
      proposedCalories: proposed.calories,
    };
  }
  return {
    impact: "BREAKS_FAST",
    rollingScore,
    proposedScore,
    proposedCalories: proposed.calories,
  };
}

/** Replay entries chronologically to find when the fast was broken */
export function inferFastBrokenAtPure(entries: FoodEntry[]): string | null {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Single item with high insulin score breaks the fast
    if (insulinScore(entry) >= FASTING_BREAK_SINGLE_SCORE) {
      return entry.time;
    }

    // Sum insulin score within 30-min rolling window ending at this entry
    const [eh, em] = entry.time.split(":").map(Number);
    const entryMin = eh * 60 + em;

    let windowScore = 0;
    for (let j = 0; j <= i; j++) {
      const [jh, jm] = sorted[j].time.split(":").map(Number);
      const jMin = jh * 60 + jm;
      if (entryMin - jMin <= FASTING_WINDOW_MINUTES) {
        windowScore += insulinScore(sorted[j]);
      }
    }

    if (windowScore >= FASTING_CAUTION_SCORE) {
      return entry.time;
    }
  }

  return null;
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

const DEFAULT_TARGETS: MacroTargets = {
  calories: 2000,
  protein_g: 100,
  carbs_g: 200,
  fat_g: 80,
  water_ml: 3000,
};

const DEFAULT_STACKS: SupplementStacks = {
  morning: [
    { name: "Berocca", dose: "1 tablet" },
    { name: "Korean Panax Ginseng", dose: "1.5g" },
    { name: "Alpha Lipoic Acid", dose: "600mg" },
    { name: "Pendulum Akkermansia", dose: "100M AFU" },
    { name: "L-Carnitine", dose: "1g" },
  ],
  noon: [
    { name: "Omega 3", dose: "1400mg" },
    { name: "Saw Palmetto", dose: "540mg" },
    { name: "Zinc", dose: "30mg" },
    { name: "Micronized Creatine", dose: "2.5g" },
  ],
  evening: [
    { name: "Ashwagandha", dose: "450mg" },
    { name: "Magnesium Glycinate", dose: "400mg" },
  ],
};

function createNutritionStore() {
  let recipes = $state<Recipe[]>([]);
  let selectedDate = $state<string>(localDateStr());
  let foodEntries = $state<FoodEntry[]>([]);
  let waterEntries = $state<WaterEntry[]>([]);
  let macroTargets = $state<MacroTargets>(DEFAULT_TARGETS);
  let weightLog = $state<WeightEntry[]>([]);
  let supplementEntries = $state<SupplementEntry[]>([]);
  let frequentSupplements = $state<{ name: string; dose: string | null }[]>([]);
  let supplementStacks = $state<SupplementStacks>(DEFAULT_STACKS);
  let fastBrokenAt = $state<string | null>(null);
  let glucoseReadings = $state<GlucoseReading[]>([]);
  let glucoseModelParams = $state<GlucoseModelParams>(defaultParams());
  let stripsRemaining = $state(50);

  // ── Recipes ──

  function addRecipe(recipe: Omit<Recipe, "id">) {
    const r: Recipe = { ...recipe, id: uuid() };
    recipes = [...recipes, r];
    upsertRecipe(r).catch(() => {});
    return r;
  }

  function updateRecipe(recipe: Recipe) {
    recipes = recipes.map((r) => (r.id === recipe.id ? recipe : r));
    upsertRecipe(recipe).catch(() => {});
  }

  function addRecipeWithIngredients(
    recipe: Omit<Recipe, "id">,
    ingredients: {
      ingredient_id: string;
      quantity: number;
      quantity_unit: string;
    }[],
  ) {
    // Auto-compute macros from ingredients
    const macros = computeRecipeMacros(ingredients, recipes);
    const r: Recipe = {
      ...recipe,
      ...macros,
      id: uuid(),
      ingredients: ingredients.map((i) => ({
        id: uuid(),
        recipe_id: "",
        ingredient_id: i.ingredient_id,
        quantity: i.quantity,
        quantity_unit: i.quantity_unit,
        ingredient: recipes.find((r) => r.id === i.ingredient_id),
      })),
    };
    r.ingredients!.forEach((i) => (i.recipe_id = r.id));
    recipes = [...recipes, r];
    upsertRecipe(r)
      .then(() => upsertRecipeIngredients(r.id, ingredients))
      .catch(() => {});
    return r;
  }

  function updateRecipeIngredients(
    recipeId: string,
    ingredients: {
      ingredient_id: string;
      quantity: number;
      quantity_unit: string;
    }[],
  ) {
    const macros = computeRecipeMacros(ingredients, recipes);
    recipes = recipes.map((r) => {
      if (r.id !== recipeId) return r;
      return {
        ...r,
        ...macros,
        ingredients: ingredients.map((i) => ({
          id: uuid(),
          recipe_id: recipeId,
          ingredient_id: i.ingredient_id,
          quantity: i.quantity,
          quantity_unit: i.quantity_unit,
          ingredient: recipes.find((rec) => rec.id === i.ingredient_id),
        })),
      };
    });
    const updated = recipes.find((r) => r.id === recipeId);
    if (updated)
      upsertRecipe(updated)
        .then(() => upsertRecipeIngredients(recipeId, ingredients))
        .catch(() => {});
  }

  function removeRecipe(id: string) {
    recipes = recipes.filter((r) => r.id !== id);
    deleteRecipeApi(id).catch(() => {});
  }

  // ── Food Entries ──

  function addFood(
    entry: Omit<FoodEntry, "id" | "date" | "time"> & {
      date?: string;
      time?: string;
    },
  ) {
    const { date: overrideDate, time: overrideTime, ...rest } = entry;
    const e: FoodEntry = {
      ...rest,
      id: uuid(),
      date: overrideDate ?? selectedDate,
      time: overrideTime ?? nowTime(),
    };
    foodEntries = [...foodEntries, e];
    upsertFoodEntry(e).catch(() => {});
    return e;
  }

  function addFoodFromRecipe(recipe: Recipe, servings: number = 1) {
    return addFood({
      recipe_id: recipe.id,
      name: recipe.name,
      servings,
      calories: Math.round(recipe.calories * servings),
      protein_g: Math.round(recipe.protein_g * servings * 10) / 10,
      carbs_g: Math.round(recipe.carbs_g * servings * 10) / 10,
      fat_g: Math.round(recipe.fat_g * servings * 10) / 10,
      fiber_g: Math.round(recipe.fiber_g * servings * 10) / 10,
      water_ml: Math.round((recipe.water_ml ?? 0) * servings),
    });
  }

  function removeFood(id: string) {
    foodEntries = foodEntries.filter((e) => e.id !== id);
    deleteFoodEntryApi(id).catch(() => {});
  }

  function updateFood(
    id: string,
    updates: Partial<Omit<FoodEntry, "id" | "date" | "time">>,
  ) {
    const entry = foodEntries.find((e) => e.id === id);
    if (!entry) return null;
    const updated: FoodEntry = { ...entry, ...updates };
    foodEntries = foodEntries.map((e) => (e.id === id ? updated : e));
    upsertFoodEntry(updated).catch(() => {});
    return updated;
  }

  // ── Water ──

  function addWater(amount_ml: number) {
    const e: WaterEntry = {
      id: uuid(),
      date: selectedDate,
      time: nowTime(),
      amount_ml,
    };
    waterEntries = [...waterEntries, e];
    upsertWaterEntry(e).catch(() => {});
    return e;
  }

  function removeWater(id: string) {
    waterEntries = waterEntries.filter((e) => e.id !== id);
    deleteWaterEntryApi(id).catch(() => {});
  }

  // ── Supplements ──

  function addSupplement(entry: Omit<SupplementEntry, "id" | "date" | "time">) {
    const e: SupplementEntry = {
      ...entry,
      id: uuid(),
      date: selectedDate,
      time: nowTime(),
    };
    supplementEntries = [...supplementEntries, e];
    upsertSupplementEntry(e).catch(() => {});
    return e;
  }

  function addSupplementStack(items: { name: string; dose: string | null }[]) {
    const now = nowTime();
    const takenNames = new Set(
      supplementEntries
        .filter((e) => e.date === selectedDate)
        .map((e) => e.name.toLowerCase()),
    );
    const toAdd = items.filter((i) => !takenNames.has(i.name.toLowerCase()));
    if (toAdd.length === 0) return [];
    const entries: SupplementEntry[] = toAdd.map((item) => ({
      ...item,
      id: uuid(),
      date: selectedDate,
      time: now,
      notes: null,
    }));
    supplementEntries = [...supplementEntries, ...entries];
    Promise.all(entries.map((e) => upsertSupplementEntry(e))).catch(() => {});
    return entries;
  }

  function removeSupplement(id: string) {
    supplementEntries = supplementEntries.filter((e) => e.id !== id);
    deleteSupplementEntryApi(id).catch(() => {});
  }

  // ── Targets ──

  function setTargets(targets: MacroTargets) {
    macroTargets = targets;
    upsertMacroTargets(targets).catch(() => {});
  }

  function setSupplementStacks(stacks: SupplementStacks) {
    supplementStacks = stacks;
    upsertSupplementStacks(stacks).catch(() => {});
  }

  // ── Weight ──

  function addWeight(entry: Omit<WeightEntry, "id">) {
    const e: WeightEntry = { ...entry, id: uuid() };
    weightLog = [e, ...weightLog];
    upsertWeightEntry(e).catch(() => {});
    return e;
  }

  // ── Fasting ──

  function assessFastImpact(proposed: Macros): FastingAssessment {
    return assessFastImpactPure(proposed, foodEntries, fastBrokenAt);
  }

  function breakFast(time?: string) {
    fastBrokenAt = time ?? nowTime();
  }

  function inferFastBroken() {
    fastBrokenAt = inferFastBrokenAtPure(
      foodEntries.filter((e) => e.date === selectedDate),
    );
  }

  // ── Glucose ──

  /** Refit the glucose model using ALL historical readings + meals */
  async function refitGlucoseModel() {
    try {
      // Fetch all readings and their corresponding food entries
      const allReadings = await fetchGlucoseReadingsRange(
        "2020-01-01",
        "2099-12-31",
      );
      if (allReadings.length === 0) return;

      // Get the date range spanned by readings
      const dates = allReadings.map((r) => r.date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));

      const allFood = await fetchFoodEntriesRange(minDate, maxDate);
      const allMeals: MealEvent[] = allFood.map(foodEntryToMealEvent);

      const fitted = fitParams(allReadings, allMeals, [], glucoseModelParams);
      glucoseModelParams = fitted;
      upsertGlucoseModelParams(fitted).catch(() => {});
    } catch (e) {
      console.error("refitGlucoseModel:", e);
    }
  }

  async function addGlucose(reading: Omit<GlucoseReading, "id">) {
    // Auto-classify reading type if not explicitly set
    if (!reading.reading_type || reading.reading_type === "random") {
      const [h, m] = reading.time.split(":").map(Number);
      const timeMin = h * 60 + m;
      const todayFood = foodEntries.filter((e) => e.date === selectedDate);
      reading = {
        ...reading,
        reading_type: readingTypeForTime(timeMin, todayFood, fastBrokenAt),
      };
    }
    const result = await addGlucoseReadingApi(reading);
    if (result) {
      glucoseReadings = [...glucoseReadings, result];
      // Refit model with ALL historical data
      refitGlucoseModel();
    }
    return result;
  }

  async function removeGlucose(id: string) {
    glucoseReadings = glucoseReadings.filter((r) => r.id !== id);
    await deleteGlucoseReadingApi(id);
    // Refit with remaining data
    refitGlucoseModel();
  }

  // ── Date change ──

  async function setDate(date: string) {
    selectedDate = date;
    fastBrokenAt = null;
    try {
      const [food, water, supps, glucose] = await Promise.all([
        fetchFoodEntries(date),
        fetchWaterEntries(date),
        fetchSupplementEntries(date),
        fetchGlucoseReadings(date),
      ]);
      foodEntries = food;
      waterEntries = water;
      supplementEntries = supps;
      glucoseReadings = glucose;
      inferFastBroken();
    } catch {
      foodEntries = [];
      waterEntries = [];
      supplementEntries = [];
      glucoseReadings = [];
    }
  }

  // ── Hydrate from Supabase ──

  let hydrated = false;

  async function hydrate() {
    try {
      const [r, f, w, s, t, wl, ss, gl, gmp] = await Promise.all([
        fetchRecipes(),
        fetchFoodEntries(selectedDate),
        fetchWaterEntries(selectedDate),
        fetchSupplementEntries(selectedDate),
        fetchMacroTargets(),
        fetchWeightLog(),
        fetchSupplementStacks(),
        fetchGlucoseReadings(selectedDate),
        fetchGlucoseModelParams(),
      ]);
      if (r.length > 0) {
        recipes = r;
      }
      if (t) {
        macroTargets = t;
      }
      if (wl.length > 0) {
        weightLog = wl;
      }
      if (ss) {
        supplementStacks = ss;
      }
      if (gmp) {
        glucoseModelParams = gmp;
      }

      foodEntries = f;
      waterEntries = w;
      supplementEntries = s;
      glucoseReadings = gl;
      inferFastBroken();
      fetchFrequentSupplements()
        .then((fs) => {
          frequentSupplements = fs;
        })
        .catch(() => {});
    } catch (e) {
      console.error("Nutrition hydration error:", e);
    }
  }

  function ensureHydrated() {
    if (hydrated) return;
    hydrated = true;
    hydrate();
  }

  return {
    get recipes() {
      // Live-compute macros for composite recipes from current ingredient values
      return recipes.map((r) => {
        if (!r.ingredients?.length) return r;
        const macros = computeRecipeMacros(
          r.ingredients.map((i) => ({
            ingredient_id: i.ingredient_id,
            quantity: i.quantity,
            quantity_unit: i.quantity_unit,
          })),
          recipes,
        );
        return { ...r, ...macros, fiber_g: macros.fiber_g };
      });
    },
    get foodEntries() {
      return foodEntries;
    },
    get waterEntries() {
      return waterEntries;
    },
    get macroTargets() {
      return macroTargets;
    },
    get weightLog() {
      return weightLog;
    },
    get supplementEntries() {
      return supplementEntries;
    },
    get frequentSupplements() {
      return frequentSupplements;
    },
    get supplementStacks() {
      return supplementStacks;
    },
    get selectedDate() {
      return selectedDate;
    },

    get todaysTotals(): DailyNutrition {
      const food = foodEntries.filter((e) => e.date === selectedDate);
      const water = waterEntries.filter((e) => e.date === selectedDate);
      const times = food.map((e) => e.time).sort();
      return {
        calories: food.reduce((s, e) => s + e.calories, 0),
        protein_g: food.reduce((s, e) => s + e.protein_g, 0),
        carbs_g: food.reduce((s, e) => s + e.carbs_g, 0),
        fat_g: food.reduce((s, e) => s + e.fat_g, 0),
        fiber_g: food.reduce((s, e) => s + (e.fiber_g ?? 0), 0),
        water_ml:
          water.reduce((s, e) => s + e.amount_ml, 0) +
          food.reduce((s, e) => s + (e.water_ml ?? 0), 0),
        firstMealTime: times[0] ?? null,
        lastMealTime: times.length > 0 ? times[times.length - 1] : null,
      };
    },

    get glucoseReadings() {
      return glucoseReadings;
    },
    get glucoseModelParams() {
      return glucoseModelParams;
    },
    get fastBrokenAt() {
      return fastBrokenAt;
    },

    get feedingWindow(): {
      isOpen: boolean;
      opensAt: string | null;
      closesAt: string | null;
      minutesLeft: number | null;
    } {
      if (!fastBrokenAt)
        return {
          isOpen: false,
          opensAt: null,
          closesAt: null,
          minutesLeft: null,
        };

      const [h, m] = fastBrokenAt.split(":").map(Number);
      const closeH = h + 4;
      const closesAt = `${String(closeH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const closeMin = closeH * 60 + m;
      const isOpen = nowMin < closeMin;
      const minutesLeft = isOpen ? closeMin - nowMin : 0;

      return {
        isOpen,
        opensAt: fastBrokenAt,
        closesAt,
        minutesLeft: minutesLeft > 0 ? minutesLeft : null,
      };
    },

    addRecipe,
    updateRecipe,
    addRecipeWithIngredients,
    updateRecipeIngredients,
    removeRecipe,
    addFood,
    addFoodFromRecipe,
    updateFood,
    removeFood,
    addWater,
    removeWater,
    addSupplement,
    addSupplementStack,
    removeSupplement,
    setTargets,
    setSupplementStacks,
    addWeight,
    addGlucose,
    removeGlucose,
    setDate,
    hydrate,
    ensureHydrated,
    assessFastImpact,
    breakFast,
    inferFastBroken,

    predictGlucose(
      activities: import("$lib/types").StravaActivity[] = [],
      lastGymTimeMin: number | null = null,
      modelType: GlucoseModelType = "parametric",
    ): GlucosePoint[] | GPGlucosePoint[] {
      const todayFood = foodEntries.filter((e) => e.date === selectedDate);
      if (todayFood.length === 0) return [];
      const meals = aggregateMeals(todayFood.map(foodEntryToMealEvent));
      const exercises = activities.map(stravaToExerciseEvent);
      if (modelType === "gp") {
        const todayReadings = glucoseReadings.filter(
          (r) => r.date === selectedDate,
        );
        const result = predictGlucoseCurveGP(
          meals,
          exercises,
          lastGymTimeMin,
          glucoseModelParams,
          todayReadings,
        );
        return result.curve;
      }
      const result = predictGlucoseCurve(
        meals,
        exercises,
        lastGymTimeMin,
        glucoseModelParams,
      );
      return result.curve;
    },

    getGlucoseSchedule(nowMin: number): ScheduledReading[] {
      const todayFood = foodEntries.filter((e) => e.date === selectedDate);
      const todayReadings = glucoseReadings.filter(
        (r) => r.date === selectedDate,
      );
      return generateSchedule({
        meals: todayFood,
        existingReadings: todayReadings,
        fastBrokenAt,
        stripsRemaining,
        nowMin,
      });
    },

    getNextGlucoseReading(nowMin: number): ScheduledReading | null {
      const schedule = this.getGlucoseSchedule(nowMin);
      return nextDueReading(schedule, nowMin);
    },

    get modelLabel(): string {
      const n = glucoseModelParams.data_points_used;
      if (n === 0) return "Simulated";
      if (n < 30) return `Learning (${n})`;
      return "Personalized";
    },
  };
}

export const nutritionStore = createNutritionStore();
