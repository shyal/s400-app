import { supabase } from "$lib/supabase";
import type {
  Recipe,
  RecipeIngredient,
  FoodEntry,
  WaterEntry,
  MacroTargets,
  WeightEntry,
  SupplementEntry,
  SupplementStacks,
} from "$lib/types";

// ── Recipes ──

export async function fetchRecipes(): Promise<Recipe[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("name");
  if (error) {
    console.error("fetchRecipes:", error);
    return [];
  }
  const recipes = (data ?? []).map(rowToRecipe);

  // Fetch all recipe_ingredients and attach
  const { data: riData } = await supabase
    .from("recipe_ingredients")
    .select("*");
  if (riData && riData.length > 0) {
    const byRecipe = new Map<string, RecipeIngredient[]>();
    for (const row of riData) {
      const ri: RecipeIngredient = {
        id: row.id,
        recipe_id: row.recipe_id,
        ingredient_id: row.ingredient_id,
        quantity: Number(row.quantity),
        quantity_unit: row.quantity_unit,
      };
      if (!byRecipe.has(ri.recipe_id)) byRecipe.set(ri.recipe_id, []);
      byRecipe.get(ri.recipe_id)!.push(ri);
    }
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    for (const recipe of recipes) {
      const ings = byRecipe.get(recipe.id);
      if (ings) {
        recipe.ingredients = ings.map((ri) => ({
          ...ri,
          ingredient: recipeMap.get(ri.ingredient_id),
        }));
      }
    }
  }
  return recipes;
}

export async function upsertRecipe(recipe: Recipe): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("recipes").upsert(recipeToRow(recipe));
  if (error) {
    console.error("upsertRecipe:", error);
    return false;
  }
  return true;
}

export async function deleteRecipe(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    console.error("deleteRecipe:", error);
    return false;
  }
  return true;
}

// ── Recipe Ingredients ──

export async function fetchRecipeIngredients(
  recipeId: string,
): Promise<RecipeIngredient[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipeId);
  if (error) {
    console.error("fetchRecipeIngredients:", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    recipe_id: row.recipe_id as string,
    ingredient_id: row.ingredient_id as string,
    quantity: Number(row.quantity),
    quantity_unit: row.quantity_unit as string,
  }));
}

export async function upsertRecipeIngredients(
  recipeId: string,
  ingredients: {
    ingredient_id: string;
    quantity: number;
    quantity_unit: string;
  }[],
): Promise<boolean> {
  if (!supabase) return false;
  // Delete existing, then insert new
  const { error: delErr } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId);
  if (delErr) {
    console.error("deleteRecipeIngredients:", delErr);
    return false;
  }
  if (ingredients.length === 0) return true;
  const rows = ingredients.map((i) => ({
    recipe_id: recipeId,
    ingredient_id: i.ingredient_id,
    quantity: i.quantity,
    quantity_unit: i.quantity_unit,
  }));
  const { error } = await supabase.from("recipe_ingredients").insert(rows);
  if (error) {
    console.error("upsertRecipeIngredients:", error);
    return false;
  }
  return true;
}

export function computeRecipeMacros(
  ingredients: {
    ingredient_id: string;
    quantity: number;
    quantity_unit: string;
  }[],
  allRecipes: Recipe[],
): {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
} {
  const recipeMap = new Map(allRecipes.map((r) => [r.id, r]));
  let calories = 0,
    protein_g = 0,
    carbs_g = 0,
    fat_g = 0,
    fiber_g = 0,
    water_ml = 0;
  for (const ing of ingredients) {
    const r = recipeMap.get(ing.ingredient_id);
    if (!r) continue;
    const scale =
      ing.quantity_unit === r.serving_unit
        ? ing.quantity / r.serving_size
        : ing.quantity;
    calories += r.calories * scale;
    protein_g += r.protein_g * scale;
    carbs_g += r.carbs_g * scale;
    fat_g += r.fat_g * scale;
    fiber_g += r.fiber_g * scale;
    water_ml += (r.water_ml ?? 0) * scale;
  }
  return {
    calories: Math.round(calories),
    protein_g: Math.round(protein_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    fiber_g: Math.round(fiber_g * 10) / 10,
    water_ml: Math.round(water_ml),
  };
}

// ── Food Entries ──

export async function fetchFoodEntries(date: string): Promise<FoodEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("date", date)
    .order("time");
  if (error) {
    console.error("fetchFoodEntries:", error);
    return [];
  }
  return (data ?? []).map(rowToFoodEntry);
}

export async function fetchLatestFoodDate(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("food_entries")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.date as string;
}

export async function upsertFoodEntry(entry: FoodEntry): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("food_entries")
    .upsert(foodEntryToRow(entry));
  if (error) {
    console.error("upsertFoodEntry:", error);
    return false;
  }
  return true;
}

export async function deleteFoodEntry(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("food_entries").delete().eq("id", id);
  if (error) {
    console.error("deleteFoodEntry:", error);
    return false;
  }
  return true;
}

// ── Food/Water Range Queries ──

export async function fetchFoodEntriesRange(
  startDate: string,
  endDate: string,
): Promise<FoodEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date")
    .order("time");
  if (error) {
    console.error("fetchFoodEntriesRange:", error);
    return [];
  }
  return (data ?? []).map(rowToFoodEntry);
}

export async function fetchWaterEntriesRange(
  startDate: string,
  endDate: string,
): Promise<WaterEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("water_entries")
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date")
    .order("time");
  if (error) {
    console.error("fetchWaterEntriesRange:", error);
    return [];
  }
  return (data ?? []).map(rowToWaterEntry);
}

// ── Water Entries ──

export async function fetchWaterEntries(date: string): Promise<WaterEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("water_entries")
    .select("*")
    .eq("date", date)
    .order("time");
  if (error) {
    console.error("fetchWaterEntries:", error);
    return [];
  }
  return (data ?? []).map(rowToWaterEntry);
}

export async function upsertWaterEntry(entry: WaterEntry): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("water_entries").upsert({
    id: entry.id,
    date: entry.date,
    time: entry.time,
    amount_ml: entry.amount_ml,
  });
  if (error) {
    console.error("upsertWaterEntry:", error);
    return false;
  }
  return true;
}

export async function deleteWaterEntry(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("water_entries").delete().eq("id", id);
  if (error) {
    console.error("deleteWaterEntry:", error);
    return false;
  }
  return true;
}

// ── Macro Targets ──

export async function fetchMacroTargets(): Promise<MacroTargets | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("macro_targets")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return {
    calories: Number(data.calories),
    protein_g: Number(data.protein_g),
    carbs_g: Number(data.carbs_g),
    fat_g: Number(data.fat_g),
    water_ml: data.water_ml,
  };
}

export async function upsertMacroTargets(
  targets: MacroTargets,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("macro_targets").upsert({
    calories: targets.calories,
    protein_g: targets.protein_g,
    carbs_g: targets.carbs_g,
    fat_g: targets.fat_g,
    water_ml: targets.water_ml,
  });
  if (error) {
    console.error("upsertMacroTargets:", error);
    return false;
  }
  return true;
}

// ── Weight Log ──

export async function fetchWeightLog(
  limit: number = 90,
): Promise<WeightEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("weight_log")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("fetchWeightLog:", error);
    return [];
  }
  return (data ?? []).map(rowToWeightEntry);
}

export async function upsertWeightEntry(entry: WeightEntry): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("weight_log").upsert({
    id: entry.id,
    date: entry.date,
    weight_kg: entry.weight_kg,
    body_fat_pct: entry.body_fat_pct ?? null,
    muscle_mass_kg: entry.muscle_mass_kg ?? null,
  });
  if (error) {
    console.error("upsertWeightEntry:", error);
    return false;
  }
  return true;
}

// ── Row mappers ──

function rowToRecipe(row: Record<string, unknown>): Recipe {
  return {
    id: row.id as string,
    name: row.name as string,
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g) || 0,
    water_ml: Number(row.water_ml) || 0,
    serving_size: Number(row.serving_size),
    serving_unit: row.serving_unit as string,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string | undefined,
  };
}

function recipeToRow(r: Recipe) {
  return {
    id: r.id,
    name: r.name,
    calories: r.calories,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    fiber_g: r.fiber_g,
    water_ml: r.water_ml,
    serving_size: r.serving_size,
    serving_unit: r.serving_unit,
    notes: r.notes ?? null,
  };
}

function rowToFoodEntry(row: Record<string, unknown>): FoodEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    recipe_id: row.recipe_id as string | null,
    name: row.name as string,
    servings: Number(row.servings),
    calories: Number(row.calories),
    protein_g: Number(row.protein_g),
    carbs_g: Number(row.carbs_g),
    fat_g: Number(row.fat_g),
    fiber_g: Number(row.fiber_g) || 0,
    water_ml: Number(row.water_ml) || 0,
  };
}

function foodEntryToRow(e: FoodEntry) {
  return {
    id: e.id,
    date: e.date,
    time: e.time,
    recipe_id: e.recipe_id ?? null,
    name: e.name,
    servings: e.servings,
    calories: e.calories,
    protein_g: e.protein_g,
    carbs_g: e.carbs_g,
    fat_g: e.fat_g,
    fiber_g: e.fiber_g,
    water_ml: e.water_ml ?? 0,
  };
}

function rowToWaterEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    amount_ml: Number(row.amount_ml),
  };
}

// ── Supplement Entries ──

export async function fetchSupplementEntries(
  date: string,
): Promise<SupplementEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("supplement_entries")
    .select("*")
    .eq("date", date)
    .order("time");
  if (error) {
    console.error("fetchSupplementEntries:", error);
    return [];
  }
  return (data ?? []).map(rowToSupplementEntry);
}

export async function upsertSupplementEntry(
  entry: SupplementEntry,
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("supplement_entries").upsert({
    id: entry.id,
    date: entry.date,
    time: entry.time,
    name: entry.name,
    dose: entry.dose ?? null,
    notes: entry.notes ?? null,
  });
  if (error) {
    console.error("upsertSupplementEntry:", error);
    return false;
  }
  return true;
}

export async function deleteSupplementEntry(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("supplement_entries")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("deleteSupplementEntry:", error);
    return false;
  }
  return true;
}

// ── Supplement Stacks ──

export async function fetchSupplementStacks(): Promise<SupplementStacks | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("supplement_stacks")
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return data.stacks as SupplementStacks;
}

export async function upsertSupplementStacks(
  stacks: SupplementStacks,
): Promise<boolean> {
  if (!supabase) return false;
  // Fetch existing row to get id
  const { data: existing } = await supabase
    .from("supplement_stacks")
    .select("id")
    .maybeSingle();
  const row = existing
    ? { id: existing.id, stacks, updated_at: new Date().toISOString() }
    : { stacks };
  const { error } = await supabase.from("supplement_stacks").upsert(row);
  if (error) {
    console.error("upsertSupplementStacks:", error);
    return false;
  }
  return true;
}

export async function fetchFrequentSupplements(
  limit: number = 15,
): Promise<{ name: string; dose: string | null }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("frequent_supplements", {
    lim: limit,
  });
  if (error) {
    console.error("fetchFrequentSupplements:", error);
    return [];
  }
  return data ?? [];
}

function rowToSupplementEntry(row: Record<string, unknown>): SupplementEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    time: row.time as string,
    name: row.name as string,
    dose: row.dose as string | null,
    notes: row.notes as string | null,
  };
}

function rowToWeightEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    weight_kg: Number(row.weight_kg),
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
    muscle_mass_kg:
      row.muscle_mass_kg != null ? Number(row.muscle_mass_kg) : null,
    visceral_fat: row.visceral_fat != null ? Number(row.visceral_fat) : null,
    water_percent: row.water_percent != null ? Number(row.water_percent) : null,
  };
}
