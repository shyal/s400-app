import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  fetchRecipes,
  upsertRecipe,
  deleteRecipe,
  fetchFoodEntries,
  upsertFoodEntry,
  deleteFoodEntry,
  fetchFoodEntriesRange,
  fetchWaterEntriesRange,
  fetchWaterEntries,
  upsertWaterEntry,
  deleteWaterEntry,
  fetchMacroTargets,
  upsertMacroTargets,
  fetchWeightLog,
  upsertWeightEntry,
  fetchSupplementEntries,
  upsertSupplementEntry,
  deleteSupplementEntry,
  computeRecipeMacros,
  fetchRecipeIngredients,
  upsertRecipeIngredients,
  fetchLatestFoodDate,
  fetchFrequentSupplements,
  fetchSupplementStacks,
  upsertSupplementStacks,
} from "$lib/services/nutritionData";
import {
  makeRecipe,
  makeFoodEntry,
  makeWaterEntry,
  makeWeightEntry,
  makeSupplementEntry,
} from "../../../test/fixtures";

beforeEach(() => {
  mockSb.__resetTableResults();
});

describe("computeRecipeMacros (pure)", () => {
  it("sums macros from ingredients scaled by serving", () => {
    const allRecipes = [
      makeRecipe({
        id: "milk",
        calories: 60,
        protein_g: 3,
        carbs_g: 5,
        fat_g: 3,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "ml",
      }),
      makeRecipe({
        id: "oats",
        calories: 380,
        protein_g: 13,
        carbs_g: 66,
        fat_g: 7,
        fiber_g: 10,
        serving_size: 100,
        serving_unit: "g",
      }),
    ];

    const ingredients = [
      { ingredient_id: "milk", quantity: 200, quantity_unit: "ml" },
      { ingredient_id: "oats", quantity: 50, quantity_unit: "g" },
    ];

    const result = computeRecipeMacros(ingredients, allRecipes);
    // milk: 200/100 = 2x scale; oats: 50/100 = 0.5x scale
    expect(result.calories).toBe(Math.round(60 * 2 + 380 * 0.5)); // 120 + 190 = 310
    expect(result.protein_g).toBeCloseTo(6 + 6.5, 0); // ~12.5 -> 12.5
    expect(result.fiber_g).toBeCloseTo(0 + 5, 0);
  });

  it("sums water_ml from ingredients", () => {
    const allRecipes = [
      makeRecipe({
        id: "ginger-water",
        calories: 5,
        protein_g: 0,
        carbs_g: 1,
        fat_g: 0,
        fiber_g: 0,
        water_ml: 250,
        serving_size: 1,
        serving_unit: "serving",
      }),
      makeRecipe({
        id: "dry-oats",
        calories: 380,
        protein_g: 13,
        carbs_g: 66,
        fat_g: 7,
        fiber_g: 10,
        water_ml: 0,
        serving_size: 100,
        serving_unit: "g",
      }),
    ];

    const ingredients = [
      { ingredient_id: "ginger-water", quantity: 2, quantity_unit: "serving" },
      { ingredient_id: "dry-oats", quantity: 50, quantity_unit: "g" },
    ];

    const result = computeRecipeMacros(ingredients, allRecipes);
    expect(result.water_ml).toBe(500); // 250 * 2 + 0
  });

  it("returns zeros for no ingredients", () => {
    const result = computeRecipeMacros([], []);
    expect(result.calories).toBe(0);
    expect(result.protein_g).toBe(0);
  });

  it("skips unknown ingredient IDs", () => {
    const result = computeRecipeMacros(
      [{ ingredient_id: "nonexistent", quantity: 100, quantity_unit: "g" }],
      [makeRecipe({ id: "other" })],
    );
    expect(result.calories).toBe(0);
  });

  it("uses raw quantity when unit mismatch", () => {
    const allRecipes = [
      makeRecipe({
        id: "egg",
        calories: 70,
        protein_g: 6,
        carbs_g: 1,
        fat_g: 5,
        fiber_g: 0,
        serving_size: 1,
        serving_unit: "piece",
      }),
    ];
    const ingredients = [
      { ingredient_id: "egg", quantity: 3, quantity_unit: "g" }, // unit mismatch
    ];
    const result = computeRecipeMacros(ingredients, allRecipes);
    // Mismatch: uses quantity directly as multiplier (3)
    expect(result.calories).toBe(Math.round(70 * 3));
  });

  it("handles ingredient with undefined water_ml (?? 0 fallback)", () => {
    const recipe = makeRecipe({
      id: "old",
      calories: 100,
      serving_size: 1,
      serving_unit: "serving",
    });
    delete (recipe as any).water_ml;
    const result = computeRecipeMacros(
      [{ ingredient_id: "old", quantity: 1, quantity_unit: "serving" }],
      [recipe],
    );
    expect(result.water_ml).toBe(0);
  });
});

describe("fetchRecipes", () => {
  it("queries recipes table", async () => {
    mockSb.__setTableResult("recipes", {
      data: [
        {
          id: "r1",
          name: "Test",
          calories: 100,
          protein_g: 10,
          carbs_g: 20,
          fat_g: 5,
          fiber_g: 2,
          serving_size: 1,
          serving_unit: "serving",
          notes: null,
          created_at: null,
        },
      ],
      error: null,
    });
    mockSb.__setTableResult("recipe_ingredients", { data: [], error: null });

    const result = await fetchRecipes();
    expect(mockSb.from).toHaveBeenCalledWith("recipes");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test");
  });
});

describe("fetchFoodEntries", () => {
  it("queries food_entries by date", async () => {
    mockSb.__setTableResult("food_entries", {
      data: [
        {
          id: "f1",
          date: "2025-01-15",
          time: "12:00",
          recipe_id: null,
          name: "Chicken",
          servings: 1,
          calories: 250,
          protein_g: 40,
          carbs_g: 0,
          fat_g: 8,
          fiber_g: 0,
          water_ml: 0,
        },
      ],
      error: null,
    });

    const result = await fetchFoodEntries("2025-01-15");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Chicken");
  });
});

describe("fetchFoodEntriesRange", () => {
  it("uses gte/lte for range", async () => {
    mockSb.__setTableResult("food_entries", { data: [], error: null });
    await fetchFoodEntriesRange("2025-01-10", "2025-01-15");
    expect(mockSb.from).toHaveBeenCalledWith("food_entries");
  });
});

describe("fetchWaterEntriesRange", () => {
  it("uses gte/lte for range", async () => {
    mockSb.__setTableResult("water_entries", { data: [], error: null });
    await fetchWaterEntriesRange("2025-01-10", "2025-01-15");
    expect(mockSb.from).toHaveBeenCalledWith("water_entries");
  });
});

describe("fetchWaterEntries", () => {
  it("returns mapped water entries", async () => {
    mockSb.__setTableResult("water_entries", {
      data: [{ id: "w1", date: "2025-01-15", time: "10:00", amount_ml: 500 }],
      error: null,
    });
    const result = await fetchWaterEntries("2025-01-15");
    expect(result).toHaveLength(1);
    expect(result[0].amount_ml).toBe(500);
  });
});

describe("fetchMacroTargets", () => {
  it("returns mapped targets", async () => {
    mockSb.__setTableResult("macro_targets", {
      data: {
        calories: 2000,
        protein_g: 100,
        carbs_g: 200,
        fat_g: 80,
        water_ml: 3000,
      },
      error: null,
    });
    const result = await fetchMacroTargets();
    expect(result).toEqual({
      calories: 2000,
      protein_g: 100,
      carbs_g: 200,
      fat_g: 80,
      water_ml: 3000,
    });
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("macro_targets", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchMacroTargets();
    expect(result).toBeNull();
  });
});

describe("fetchWeightLog", () => {
  it("maps weight entries with nullable fields", async () => {
    mockSb.__setTableResult("weight_log", {
      data: [
        {
          id: "wt1",
          date: "2025-01-15",
          weight_kg: 80,
          body_fat_pct: 15.2,
          muscle_mass_kg: null,
          visceral_fat: null,
          water_percent: null,
        },
      ],
      error: null,
    });
    const result = await fetchWeightLog();
    expect(result).toHaveLength(1);
    expect(result[0].weight_kg).toBe(80);
    expect(result[0].body_fat_pct).toBe(15.2);
    expect(result[0].muscle_mass_kg).toBeNull();
  });
});

describe("fetchSupplementEntries", () => {
  it("returns mapped supplement entries", async () => {
    mockSb.__setTableResult("supplement_entries", {
      data: [
        {
          id: "s1",
          date: "2025-01-15",
          time: "08:00",
          name: "Creatine",
          dose: "5g",
          notes: null,
        },
      ],
      error: null,
    });
    const result = await fetchSupplementEntries("2025-01-15");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Creatine");
    expect(result[0].dose).toBe("5g");
  });
});

describe("CRUD operations return false on error", () => {
  beforeEach(() => {
    // Set all tables to error
    for (const t of [
      "recipes",
      "food_entries",
      "water_entries",
      "supplement_entries",
      "macro_targets",
      "weight_log",
    ]) {
      mockSb.__setTableResult(t, { data: null, error: { message: "err" } });
    }
  });

  it("upsertRecipe returns false", async () => {
    expect(await upsertRecipe(makeRecipe())).toBe(false);
  });

  it("deleteRecipe returns false", async () => {
    expect(await deleteRecipe("x")).toBe(false);
  });

  it("upsertFoodEntry returns false", async () => {
    expect(await upsertFoodEntry(makeFoodEntry())).toBe(false);
  });

  it("deleteFoodEntry returns false", async () => {
    expect(await deleteFoodEntry("x")).toBe(false);
  });

  it("upsertWaterEntry returns false", async () => {
    const entry = {
      id: "w",
      date: "2025-01-15",
      time: "10:00",
      amount_ml: 500,
    };
    expect(await upsertWaterEntry(entry)).toBe(false);
  });

  it("deleteWaterEntry returns false", async () => {
    expect(await deleteWaterEntry("x")).toBe(false);
  });

  it("upsertSupplementEntry returns false", async () => {
    const entry = {
      id: "s",
      date: "2025-01-15",
      time: "08:00",
      name: "Creatine",
      dose: "5g",
      notes: null,
    };
    expect(await upsertSupplementEntry(entry)).toBe(false);
  });

  it("deleteSupplementEntry returns false", async () => {
    expect(await deleteSupplementEntry("x")).toBe(false);
  });

  it("upsertMacroTargets returns false", async () => {
    expect(
      await upsertMacroTargets({
        calories: 2000,
        protein_g: 100,
        carbs_g: 200,
        fat_g: 80,
        water_ml: 3000,
      }),
    ).toBe(false);
  });
});

describe("fetchRecipeIngredients", () => {
  it("returns mapped ingredients with correct types", async () => {
    mockSb.__setTableResult("recipe_ingredients", {
      data: [
        {
          id: "ri1",
          recipe_id: "r1",
          ingredient_id: "ing1",
          quantity: 200,
          quantity_unit: "ml",
        },
        {
          id: "ri2",
          recipe_id: "r1",
          ingredient_id: "ing2",
          quantity: 50,
          quantity_unit: "g",
        },
      ],
      error: null,
    });

    const result = await fetchRecipeIngredients("r1");
    expect(mockSb.from).toHaveBeenCalledWith("recipe_ingredients");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "ri1",
      recipe_id: "r1",
      ingredient_id: "ing1",
      quantity: 200,
      quantity_unit: "ml",
    });
    expect(result[1]).toEqual({
      id: "ri2",
      recipe_id: "r1",
      ingredient_id: "ing2",
      quantity: 50,
      quantity_unit: "g",
    });
    expect(typeof result[0].quantity).toBe("number");
    expect(typeof result[0].id).toBe("string");
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("recipe_ingredients", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchRecipeIngredients("r1");
    expect(result).toEqual([]);
  });
});

describe("upsertRecipeIngredients", () => {
  it("deletes existing and inserts new ingredients", async () => {
    mockSb.__setTableResult("recipe_ingredients", { data: null, error: null });

    const ingredients = [
      { ingredient_id: "ing1", quantity: 200, quantity_unit: "ml" },
      { ingredient_id: "ing2", quantity: 50, quantity_unit: "g" },
    ];

    const result = await upsertRecipeIngredients("r1", ingredients);
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("recipe_ingredients");
  });

  it("returns true without inserting when ingredients array is empty", async () => {
    mockSb.__setTableResult("recipe_ingredients", { data: null, error: null });

    const result = await upsertRecipeIngredients("r1", []);
    expect(result).toBe(true);
  });

  it("returns false on delete error", async () => {
    mockSb.__setTableResult("recipe_ingredients", {
      data: null,
      error: { message: "delete err" },
    });

    const result = await upsertRecipeIngredients("r1", [
      { ingredient_id: "ing1", quantity: 100, quantity_unit: "g" },
    ]);
    expect(result).toBe(false);
  });
});

describe("fetchLatestFoodDate", () => {
  it("returns the latest date string", async () => {
    mockSb.__setTableResult("food_entries", {
      data: { date: "2025-01-20" },
      error: null,
    });

    const result = await fetchLatestFoodDate();
    expect(result).toBe("2025-01-20");
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("food_entries", {
      data: null,
      error: { message: "err" },
    });

    const result = await fetchLatestFoodDate();
    expect(result).toBeNull();
  });
});

describe("fetchFrequentSupplements", () => {
  it("returns frequent supplements from RPC", async () => {
    mockSb.rpc.mockResolvedValueOnce({
      data: [{ name: "Creatine", dose: "5g" }],
      error: null,
    });

    const result = await fetchFrequentSupplements();
    expect(mockSb.rpc).toHaveBeenCalledWith("frequent_supplements", {
      lim: 15,
    });
    expect(result).toEqual([{ name: "Creatine", dose: "5g" }]);
  });

  it("passes custom limit to RPC", async () => {
    mockSb.rpc.mockResolvedValueOnce({
      data: [{ name: "Vitamin D", dose: "2000IU" }],
      error: null,
    });

    const result = await fetchFrequentSupplements(5);
    expect(mockSb.rpc).toHaveBeenCalledWith("frequent_supplements", { lim: 5 });
    expect(result).toHaveLength(1);
  });

  it("returns empty array on error", async () => {
    mockSb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc err" },
    });

    const result = await fetchFrequentSupplements();
    expect(result).toEqual([]);
  });
});

describe("fetchRecipes with ingredients", () => {
  it("attaches ingredients to recipes when recipe_ingredients has data", async () => {
    const recipeId = "r-main";
    const ingredientId = "r-ing";
    mockSb.__setTableResult("recipes", {
      data: [
        {
          id: recipeId,
          name: "Oatmeal Bowl",
          calories: 400,
          protein_g: 20,
          carbs_g: 60,
          fat_g: 10,
          fiber_g: 8,
          serving_size: 1,
          serving_unit: "serving",
          notes: null,
          created_at: null,
        },
        {
          id: ingredientId,
          name: "Oats",
          calories: 380,
          protein_g: 13,
          carbs_g: 66,
          fat_g: 7,
          fiber_g: 10,
          serving_size: 100,
          serving_unit: "g",
          notes: null,
          created_at: null,
        },
      ],
      error: null,
    });
    mockSb.__setTableResult("recipe_ingredients", {
      data: [
        {
          id: "ri1",
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          quantity: 80,
          quantity_unit: "g",
        },
      ],
      error: null,
    });

    const result = await fetchRecipes();
    expect(result).toHaveLength(2);
    const mainRecipe = result.find((r) => r.id === recipeId);
    expect(mainRecipe).toBeDefined();
    expect(mainRecipe!.ingredients).toHaveLength(1);
    expect(mainRecipe!.ingredients![0].ingredient_id).toBe(ingredientId);
    expect(mainRecipe!.ingredients![0].quantity).toBe(80);
    expect(mainRecipe!.ingredients![0].ingredient).toBeDefined();
    expect(mainRecipe!.ingredients![0].ingredient!.name).toBe("Oats");
  });
});

describe("fetchWeightLog with all fields populated", () => {
  it("maps weight entries with all fields populated", async () => {
    mockSb.__setTableResult("weight_log", {
      data: [
        {
          id: "wt2",
          date: "2025-01-15",
          weight_kg: 80,
          body_fat_pct: 15.2,
          muscle_mass_kg: 35.5,
          visceral_fat: 8,
          water_percent: 55.3,
        },
      ],
      error: null,
    });
    const result = await fetchWeightLog();
    expect(result[0].body_fat_pct).toBe(15.2);
    expect(result[0].muscle_mass_kg).toBe(35.5);
    expect(result[0].visceral_fat).toBe(8);
    expect(result[0].water_percent).toBe(55.3);
  });
});

describe("CRUD operations return true on success", () => {
  beforeEach(() => {
    for (const t of [
      "recipes",
      "food_entries",
      "water_entries",
      "supplement_entries",
      "weight_log",
    ]) {
      mockSb.__setTableResult(t, { data: null, error: null });
    }
  });

  it("upsertRecipe returns true", async () => {
    expect(await upsertRecipe(makeRecipe())).toBe(true);
  });

  it("deleteRecipe returns true", async () => {
    expect(await deleteRecipe("x")).toBe(true);
  });

  it("upsertFoodEntry returns true", async () => {
    expect(await upsertFoodEntry(makeFoodEntry())).toBe(true);
  });

  it("deleteFoodEntry returns true", async () => {
    expect(await deleteFoodEntry("x")).toBe(true);
  });

  it("upsertWaterEntry returns true", async () => {
    expect(await upsertWaterEntry(makeWaterEntry())).toBe(true);
  });

  it("deleteWaterEntry returns true", async () => {
    expect(await deleteWaterEntry("x")).toBe(true);
  });

  it("upsertWeightEntry returns true", async () => {
    expect(await upsertWeightEntry(makeWeightEntry())).toBe(true);
  });

  it("upsertSupplementEntry returns true", async () => {
    expect(await upsertSupplementEntry(makeSupplementEntry())).toBe(true);
  });

  it("deleteSupplementEntry returns true", async () => {
    expect(await deleteSupplementEntry("x")).toBe(true);
  });

  it("upsertMacroTargets returns true on success", async () => {
    mockSb.__setTableResult("macro_targets", { data: null, error: null });
    const result = await upsertMacroTargets({
      calories: 2000,
      protein_g: 100,
      carbs_g: 200,
      fat_g: 80,
      water_ml: 3000,
    });
    expect(result).toBe(true);
  });
});

describe("fetch error branches return [] or false", () => {
  it("fetchRecipes returns [] on error", async () => {
    mockSb.__setTableResult("recipes", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchRecipes();
    expect(result).toEqual([]);
  });

  it("fetchFoodEntries returns [] on error", async () => {
    mockSb.__setTableResult("food_entries", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchFoodEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("fetchFoodEntriesRange returns [] on error", async () => {
    mockSb.__setTableResult("food_entries", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchFoodEntriesRange("2025-01-01", "2025-01-31");
    expect(result).toEqual([]);
  });

  it("fetchWaterEntriesRange returns [] on error", async () => {
    mockSb.__setTableResult("water_entries", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchWaterEntriesRange("2025-01-01", "2025-01-31");
    expect(result).toEqual([]);
  });

  it("fetchWaterEntries returns [] on error", async () => {
    mockSb.__setTableResult("water_entries", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchWaterEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("fetchWeightLog returns [] on error", async () => {
    mockSb.__setTableResult("weight_log", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchWeightLog();
    expect(result).toEqual([]);
  });

  it("fetchSupplementEntries returns [] on error", async () => {
    mockSb.__setTableResult("supplement_entries", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchSupplementEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("upsertWeightEntry returns false on error", async () => {
    mockSb.__setTableResult("weight_log", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertWeightEntry(makeWeightEntry());
    expect(result).toBe(false);
  });
});

describe("null data coalescing branches (data ?? [])", () => {
  it("fetchRecipes handles null data from recipes query", async () => {
    // Set recipes to return null data (no error) - hits data ?? [] on line 13
    mockSb.__setTableResult("recipes", { data: null, error: null });
    mockSb.__setTableResult("recipe_ingredients", { data: [], error: null });
    const result = await fetchRecipes();
    expect(result).toEqual([]);
  });

  it("fetchRecipeIngredients handles null data", async () => {
    mockSb.__setTableResult("recipe_ingredients", { data: null, error: null });
    const result = await fetchRecipeIngredients("r1");
    expect(result).toEqual([]);
  });

  it("fetchFoodEntries handles null data", async () => {
    mockSb.__setTableResult("food_entries", { data: null, error: null });
    const result = await fetchFoodEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("fetchFoodEntriesRange handles null data", async () => {
    mockSb.__setTableResult("food_entries", { data: null, error: null });
    const result = await fetchFoodEntriesRange("2025-01-01", "2025-01-31");
    expect(result).toEqual([]);
  });

  it("fetchWaterEntriesRange handles null data", async () => {
    mockSb.__setTableResult("water_entries", { data: null, error: null });
    const result = await fetchWaterEntriesRange("2025-01-01", "2025-01-31");
    expect(result).toEqual([]);
  });

  it("fetchWaterEntries handles null data", async () => {
    mockSb.__setTableResult("water_entries", { data: null, error: null });
    const result = await fetchWaterEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("fetchWeightLog handles null data", async () => {
    mockSb.__setTableResult("weight_log", { data: null, error: null });
    const result = await fetchWeightLog();
    expect(result).toEqual([]);
  });

  it("fetchSupplementEntries handles null data", async () => {
    mockSb.__setTableResult("supplement_entries", { data: null, error: null });
    const result = await fetchSupplementEntries("2025-01-15");
    expect(result).toEqual([]);
  });

  it("fetchFrequentSupplements handles null data from RPC", async () => {
    mockSb.rpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchFrequentSupplements();
    expect(result).toEqual([]);
  });
});

describe("upsertRecipeIngredients insert error branch", () => {
  it("returns false when insert fails after successful delete", async () => {
    // We need the delete to succeed but the insert to fail.
    // The mock returns the same result for all calls on a table.
    // We can use mockImplementation to alternate results.
    const { createMockSupabase } = await import("../../../test/mocks/supabase");
    let callCount = 0;
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "recipe_ingredients") {
        if (callCount === 1) {
          // delete call - succeeds
          return createMockSupabase({ data: null, error: null }).from("x");
        } else {
          // insert call - fails
          return createMockSupabase({
            data: null,
            error: { message: "insert err" },
          }).from("x");
        }
      }
      return createMockSupabase({ data: null, error: null }).from(table);
    });

    const result = await upsertRecipeIngredients("r1", [
      { ingredient_id: "ing1", quantity: 100, quantity_unit: "g" },
    ]);
    expect(result).toBe(false);
  });
});

describe("row mapper edge cases", () => {
  it("rowToRecipe handles falsy fiber_g (|| 0 fallback in recipe mapper)", async () => {
    mockSb.__setTableResult("recipes", {
      data: [
        {
          id: "r-nofib",
          name: "No Fiber",
          calories: 100,
          protein_g: 10,
          carbs_g: 20,
          fat_g: 5,
          fiber_g: null,
          water_ml: null,
          serving_size: 1,
          serving_unit: "serving",
          notes: null,
          created_at: null,
        },
      ],
      error: null,
    });
    mockSb.__setTableResult("recipe_ingredients", { data: [], error: null });
    const result = await fetchRecipes();
    expect(result[0].fiber_g).toBe(0);
    expect(result[0].water_ml).toBe(0);
  });

  it("rowToFoodEntry handles falsy fiber_g (|| 0 fallback branch)", async () => {
    mockSb.__setTableResult("food_entries", {
      data: [
        {
          id: "f1",
          date: "2025-01-15",
          time: "12:00",
          recipe_id: null,
          name: "Food",
          servings: 1,
          calories: 100,
          protein_g: 10,
          carbs_g: 5,
          fat_g: 3,
          fiber_g: null,
          water_ml: 200,
        },
      ],
      error: null,
    });
    const result = await fetchFoodEntries("2025-01-15");
    expect(result[0].fiber_g).toBe(0);
  });

  it("rowToFoodEntry handles truthy fiber_g (|| 0 short-circuit branch)", async () => {
    mockSb.__setTableResult("food_entries", {
      data: [
        {
          id: "f2",
          date: "2025-01-15",
          time: "12:00",
          recipe_id: null,
          name: "Oatmeal",
          servings: 1,
          calories: 300,
          protein_g: 10,
          carbs_g: 50,
          fat_g: 5,
          fiber_g: 8,
          water_ml: 0,
        },
      ],
      error: null,
    });
    const result = await fetchFoodEntries("2025-01-15");
    expect(result[0].fiber_g).toBe(8);
  });

  it("rowToFoodEntry handles falsy water_ml (|| 0 branch)", async () => {
    mockSb.__setTableResult("food_entries", {
      data: [
        {
          id: "f1",
          date: "2025-01-15",
          time: "12:00",
          recipe_id: null,
          name: "Food",
          servings: 1,
          calories: 100,
          protein_g: 10,
          carbs_g: 5,
          fat_g: 3,
          fiber_g: 2,
          water_ml: null,
        },
      ],
      error: null,
    });
    const result = await fetchFoodEntries("2025-01-15");
    expect(result[0].water_ml).toBe(0);
  });

  it("foodEntryToRow handles undefined water_ml (water_ml ?? 0 branch)", async () => {
    mockSb.__setTableResult("food_entries", { data: null, error: null });
    // Pass entry without water_ml to trigger ?? 0
    const entry = makeFoodEntry();
    delete (entry as any).water_ml;
    const result = await upsertFoodEntry(entry);
    expect(result).toBe(true);
  });

  it("upsertSupplementEntry handles undefined dose and notes (?? null branches)", async () => {
    mockSb.__setTableResult("supplement_entries", { data: null, error: null });
    const entry = makeSupplementEntry();
    delete (entry as any).dose;
    delete (entry as any).notes;
    const result = await upsertSupplementEntry(entry);
    expect(result).toBe(true);
  });

  it("rowToWeightEntry handles null body_fat_pct path (ternary null)", async () => {
    // This is for the line 417 branch: row.body_fat_pct != null check
    // We already test with null values but we need to explicitly ensure the
    // undefined/null body_fat_pct path is taken
    mockSb.__setTableResult("weight_log", {
      data: [
        {
          id: "wt3",
          date: "2025-01-15",
          weight_kg: 80,
          body_fat_pct: undefined,
          muscle_mass_kg: undefined,
          visceral_fat: undefined,
          water_percent: undefined,
        },
      ],
      error: null,
    });
    const result = await fetchWeightLog();
    expect(result[0].body_fat_pct).toBeNull();
    expect(result[0].muscle_mass_kg).toBeNull();
    expect(result[0].visceral_fat).toBeNull();
    expect(result[0].water_percent).toBeNull();
  });
});

describe("fetchSupplementStacks", () => {
  it("returns stacks from supplement_stacks table", async () => {
    const stacks = {
      morning: [{ name: "Berocca", dose: "1 tablet" }],
      noon: [{ name: "Omega 3", dose: "1400mg" }],
      evening: [{ name: "Ashwagandha", dose: "450mg" }],
    };
    mockSb.__setTableResult("supplement_stacks", {
      data: { id: "ss1", stacks },
      error: null,
    });
    const result = await fetchSupplementStacks();
    expect(result).toEqual(stacks);
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("supplement_stacks", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchSupplementStacks();
    expect(result).toBeNull();
  });

  it("returns null when no data", async () => {
    mockSb.__setTableResult("supplement_stacks", { data: null, error: null });
    const result = await fetchSupplementStacks();
    expect(result).toBeNull();
  });
});

describe("upsertSupplementStacks", () => {
  it("upserts with existing row id", async () => {
    const stacks = {
      morning: [{ name: "Berocca", dose: "1 tablet" }],
      noon: [],
      evening: [],
    };
    // First call (select id) returns existing row, second call (upsert) succeeds
    const { createMockSupabase: createMock } =
      await import("../../../test/mocks/supabase");
    let callCount = 0;
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "supplement_stacks") {
        if (callCount === 1) {
          // select id - returns existing row
          return createMock({ data: { id: "existing-id" }, error: null }).from(
            "x",
          );
        } else {
          // upsert - succeeds
          return createMock({ data: null, error: null }).from("x");
        }
      }
      return createMock({ data: null, error: null }).from(table);
    });

    const result = await upsertSupplementStacks(stacks);
    expect(result).toBe(true);
  });

  it("upserts without existing row", async () => {
    const stacks = {
      morning: [],
      noon: [],
      evening: [{ name: "Magnesium", dose: "400mg" }],
    };
    const { createMockSupabase: createMock } =
      await import("../../../test/mocks/supabase");
    let callCount = 0;
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "supplement_stacks") {
        if (callCount === 1) {
          // select id - no existing row
          return createMock({ data: null, error: null }).from("x");
        } else {
          // upsert - succeeds
          return createMock({ data: null, error: null }).from("x");
        }
      }
      return createMock({ data: null, error: null }).from(table);
    });

    const result = await upsertSupplementStacks(stacks);
    expect(result).toBe(true);
  });

  it("returns false on upsert error", async () => {
    const stacks = { morning: [], noon: [], evening: [] };
    const { createMockSupabase: createMock } =
      await import("../../../test/mocks/supabase");
    let callCount = 0;
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (table === "supplement_stacks") {
        if (callCount === 1) {
          return createMock({ data: { id: "existing-id" }, error: null }).from(
            "x",
          );
        } else {
          return createMock({
            data: null,
            error: { message: "upsert err" },
          }).from("x");
        }
      }
      return createMock({ data: null, error: null }).from(table);
    });

    const result = await upsertSupplementStacks(stacks);
    expect(result).toBe(false);
  });
});

describe("with null supabase", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
  });

  it("fetchRecipes returns []", async () => {
    const { fetchRecipes } = await import("$lib/services/nutritionData");
    expect(await fetchRecipes()).toEqual([]);
  });

  it("upsertRecipe returns false", async () => {
    const { upsertRecipe } = await import("$lib/services/nutritionData");
    expect(await upsertRecipe({} as any)).toBe(false);
  });

  it("deleteRecipe returns false", async () => {
    const { deleteRecipe } = await import("$lib/services/nutritionData");
    expect(await deleteRecipe("x")).toBe(false);
  });

  it("fetchRecipeIngredients returns []", async () => {
    const { fetchRecipeIngredients } =
      await import("$lib/services/nutritionData");
    expect(await fetchRecipeIngredients("x")).toEqual([]);
  });

  it("upsertRecipeIngredients returns false", async () => {
    const { upsertRecipeIngredients } =
      await import("$lib/services/nutritionData");
    expect(await upsertRecipeIngredients("x", [])).toBe(false);
  });

  it("fetchFoodEntries returns []", async () => {
    const { fetchFoodEntries } = await import("$lib/services/nutritionData");
    expect(await fetchFoodEntries("2025-01-15")).toEqual([]);
  });

  it("fetchLatestFoodDate returns null", async () => {
    const { fetchLatestFoodDate } = await import("$lib/services/nutritionData");
    expect(await fetchLatestFoodDate()).toBeNull();
  });

  it("upsertFoodEntry returns false", async () => {
    const { upsertFoodEntry } = await import("$lib/services/nutritionData");
    expect(await upsertFoodEntry({} as any)).toBe(false);
  });

  it("deleteFoodEntry returns false", async () => {
    const { deleteFoodEntry } = await import("$lib/services/nutritionData");
    expect(await deleteFoodEntry("x")).toBe(false);
  });

  it("fetchFoodEntriesRange returns []", async () => {
    const { fetchFoodEntriesRange } =
      await import("$lib/services/nutritionData");
    expect(await fetchFoodEntriesRange("2025-01-01", "2025-01-31")).toEqual([]);
  });

  it("fetchWaterEntriesRange returns []", async () => {
    const { fetchWaterEntriesRange } =
      await import("$lib/services/nutritionData");
    expect(await fetchWaterEntriesRange("2025-01-01", "2025-01-31")).toEqual(
      [],
    );
  });

  it("fetchWaterEntries returns []", async () => {
    const { fetchWaterEntries } = await import("$lib/services/nutritionData");
    expect(await fetchWaterEntries("2025-01-15")).toEqual([]);
  });

  it("upsertWaterEntry returns false", async () => {
    const { upsertWaterEntry } = await import("$lib/services/nutritionData");
    expect(await upsertWaterEntry({} as any)).toBe(false);
  });

  it("deleteWaterEntry returns false", async () => {
    const { deleteWaterEntry } = await import("$lib/services/nutritionData");
    expect(await deleteWaterEntry("x")).toBe(false);
  });

  it("fetchMacroTargets returns null", async () => {
    const { fetchMacroTargets } = await import("$lib/services/nutritionData");
    expect(await fetchMacroTargets()).toBeNull();
  });

  it("upsertMacroTargets returns false", async () => {
    const { upsertMacroTargets } = await import("$lib/services/nutritionData");
    expect(await upsertMacroTargets({} as any)).toBe(false);
  });

  it("fetchWeightLog returns []", async () => {
    const { fetchWeightLog } = await import("$lib/services/nutritionData");
    expect(await fetchWeightLog()).toEqual([]);
  });

  it("upsertWeightEntry returns false", async () => {
    const { upsertWeightEntry } = await import("$lib/services/nutritionData");
    expect(await upsertWeightEntry({} as any)).toBe(false);
  });

  it("fetchSupplementEntries returns []", async () => {
    const { fetchSupplementEntries } =
      await import("$lib/services/nutritionData");
    expect(await fetchSupplementEntries("2025-01-15")).toEqual([]);
  });

  it("upsertSupplementEntry returns false", async () => {
    const { upsertSupplementEntry } =
      await import("$lib/services/nutritionData");
    expect(await upsertSupplementEntry({} as any)).toBe(false);
  });

  it("deleteSupplementEntry returns false", async () => {
    const { deleteSupplementEntry } =
      await import("$lib/services/nutritionData");
    expect(await deleteSupplementEntry("x")).toBe(false);
  });

  it("fetchFrequentSupplements returns []", async () => {
    const { fetchFrequentSupplements } =
      await import("$lib/services/nutritionData");
    expect(await fetchFrequentSupplements()).toEqual([]);
  });

  it("fetchSupplementStacks returns null", async () => {
    const { fetchSupplementStacks } =
      await import("$lib/services/nutritionData");
    expect(await fetchSupplementStacks()).toBeNull();
  });

  it("upsertSupplementStacks returns false", async () => {
    const { upsertSupplementStacks } =
      await import("$lib/services/nutritionData");
    expect(
      await upsertSupplementStacks({ morning: [], noon: [], evening: [] }),
    ).toBe(false);
  });
});
