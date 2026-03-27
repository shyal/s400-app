import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assessFastImpactPure,
  inferFastBrokenAtPure,
  insulinScore,
  FASTING_SAFE_SCORE,
  FASTING_CAUTION_SCORE,
  FASTING_BREAK_SINGLE_SCORE,
  FASTING_WINDOW_MINUTES,
} from "$lib/stores/nutrition.svelte";
import type { Macros } from "$lib/stores/nutrition.svelte";
import type { FoodEntry } from "$lib/types";

vi.mock("$lib/services/glucoseData", () => ({
  fetchGlucoseReadings: vi.fn(() => Promise.resolve([])),
  fetchGlucoseReadingsRange: vi.fn(() => Promise.resolve([])),
  addGlucoseReading: vi.fn((reading: Record<string, unknown>) =>
    Promise.resolve({ ...reading, id: "gl-1" }),
  ),
  deleteGlucoseReading: vi.fn(() => Promise.resolve(true)),
  fetchGlucoseModelParams: vi.fn(() => Promise.resolve(null)),
  upsertGlucoseModelParams: vi.fn(() => Promise.resolve(true)),
  toMgDl: vi.fn((val: number) => val),
}));

vi.mock("$lib/services/glucoseModelFitter", () => ({
  fitParams: vi.fn(
    (readings: any[], _meals: any[], _exercises: any[], params: any) => ({
      ...params,
      data_points_used: readings.length,
    }),
  ),
}));

vi.mock("$lib/services/glucoseModelGP", () => ({
  predictGlucoseCurveGP: vi.fn(
    (
      _meals: any[],
      _exercises: any[],
      _gym: any,
      _params: any,
      _readings: any[],
    ) => ({
      curve: [{ timeMin: 720, value: 110, upper: 125, lower: 95 }],
      peakValue: 110,
      peakTimeMin: 720,
    }),
  ),
}));

vi.mock("$lib/services/nutritionData", () => ({
  fetchRecipes: vi.fn(() => Promise.resolve([])),
  upsertRecipe: vi.fn(() => Promise.resolve(true)),
  deleteRecipe: vi.fn(() => Promise.resolve(true)),
  fetchFoodEntries: vi.fn(() => Promise.resolve([])),
  fetchFoodEntriesRange: vi.fn(() => Promise.resolve([])),
  fetchLatestFoodDate: vi.fn(() => Promise.resolve(null)),
  upsertFoodEntry: vi.fn(() => Promise.resolve(true)),
  deleteFoodEntry: vi.fn(() => Promise.resolve(true)),
  fetchWaterEntries: vi.fn(() => Promise.resolve([])),
  upsertWaterEntry: vi.fn(() => Promise.resolve(true)),
  deleteWaterEntry: vi.fn(() => Promise.resolve(true)),
  fetchSupplementEntries: vi.fn(() => Promise.resolve([])),
  upsertSupplementEntry: vi.fn(() => Promise.resolve(true)),
  deleteSupplementEntry: vi.fn(() => Promise.resolve(true)),
  fetchFrequentSupplements: vi.fn(() => Promise.resolve([])),
  fetchSupplementStacks: vi.fn(() => Promise.resolve(null)),
  upsertSupplementStacks: vi.fn(() => Promise.resolve(true)),
  fetchMacroTargets: vi.fn(() => Promise.resolve(null)),
  upsertMacroTargets: vi.fn(() => Promise.resolve(true)),
  fetchWeightLog: vi.fn(() => Promise.resolve([])),
  upsertWeightEntry: vi.fn(() => Promise.resolve(true)),
  upsertRecipeIngredients: vi.fn(() => Promise.resolve(true)),
  computeRecipeMacros: vi.fn(() => ({
    calories: 500,
    protein_g: 40,
    carbs_g: 30,
    fat_g: 15,
    fiber_g: 5,
    water_ml: 0,
  })),
}));

describe("nutritionStore", () => {
  let nutritionStore: typeof import("$lib/stores/nutrition.svelte").nutritionStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("$lib/stores/nutrition.svelte");
    nutritionStore = mod.nutritionStore;
  });

  it("has default macro targets", () => {
    expect(nutritionStore.macroTargets).toEqual({
      calories: 2000,
      protein_g: 100,
      carbs_g: 200,
      fat_g: 80,
      water_ml: 3000,
    });
  });

  it("starts with empty state before hydration", () => {
    expect(nutritionStore.recipes).toEqual([]);
    expect(nutritionStore.foodEntries).toEqual([]);
    expect(nutritionStore.waterEntries).toEqual([]);
    expect(nutritionStore.weightLog).toEqual([]);
    expect(nutritionStore.supplementEntries).toEqual([]);
    expect(nutritionStore.frequentSupplements).toEqual([]);
  });

  describe("addFood", () => {
    it("adds a food entry", () => {
      const entry = nutritionStore.addFood({
        name: "Chicken",
        servings: 1,
        calories: 250,
        protein_g: 40,
        carbs_g: 0,
        fat_g: 8,
        fiber_g: 0,
      });
      expect(entry.name).toBe("Chicken");
      expect(entry.id).toBeDefined();
      expect(nutritionStore.foodEntries).toHaveLength(1);
    });

    it("sets date and time automatically", () => {
      const entry = nutritionStore.addFood({
        name: "Rice",
        servings: 1,
        calories: 200,
        protein_g: 4,
        carbs_g: 44,
        fat_g: 0,
        fiber_g: 1,
      });
      expect(entry.date).toBeTruthy();
      expect(entry.time).toBeTruthy();
    });
  });

  describe("addFoodFromRecipe", () => {
    it("scales macros by servings", () => {
      const recipe = {
        id: "r1",
        name: "Shake",
        calories: 300,
        protein_g: 40,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 2,
        water_ml: 0,
        serving_size: 1,
        serving_unit: "serving",
      };
      const entry = nutritionStore.addFoodFromRecipe(recipe, 2);
      expect(entry.calories).toBe(600);
      expect(entry.protein_g).toBe(80);
      expect(entry.name).toBe("Shake");
      expect(entry.servings).toBe(2);
    });

    it("passes water_ml scaled by servings", () => {
      const recipe = {
        id: "r2",
        name: "Ginger Water",
        calories: 5,
        protein_g: 0,
        carbs_g: 1,
        fat_g: 0,
        fiber_g: 0,
        water_ml: 500,
        serving_size: 1,
        serving_unit: "serving",
      };
      const entry = nutritionStore.addFoodFromRecipe(recipe, 2);
      expect(entry.water_ml).toBe(1000);
    });

    it("handles recipe without water_ml gracefully", () => {
      const recipe = {
        id: "r3",
        name: "Dry Food",
        calories: 200,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 5,
        fiber_g: 2,
        serving_size: 1,
        serving_unit: "serving",
      } as any;
      const entry = nutritionStore.addFoodFromRecipe(recipe, 1);
      expect(entry.water_ml).toBe(0);
    });
  });

  describe("removeFood", () => {
    it("removes a food entry", () => {
      const entry = nutritionStore.addFood({
        name: "Test",
        servings: 1,
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
      });
      nutritionStore.removeFood(entry.id);
      expect(nutritionStore.foodEntries).toHaveLength(0);
    });
  });

  describe("updateFood", () => {
    it("updates specific fields", () => {
      const entry = nutritionStore.addFood({
        name: "Chicken",
        servings: 1,
        calories: 250,
        protein_g: 40,
        carbs_g: 0,
        fat_g: 8,
        fiber_g: 0,
      });
      const updated = nutritionStore.updateFood(entry.id, {
        calories: 300,
        protein_g: 45,
      });
      expect(updated?.calories).toBe(300);
      expect(updated?.protein_g).toBe(45);
      expect(updated?.name).toBe("Chicken"); // unchanged
    });

    it("returns null for nonexistent id", () => {
      expect(
        nutritionStore.updateFood("nonexistent", { calories: 100 }),
      ).toBeNull();
    });

    it("preserves other food entries when updating one", () => {
      const e1 = nutritionStore.addFood({
        name: "Chicken",
        servings: 1,
        calories: 250,
        protein_g: 40,
        carbs_g: 0,
        fat_g: 8,
        fiber_g: 0,
      });
      const e2 = nutritionStore.addFood({
        name: "Rice",
        servings: 1,
        calories: 200,
        protein_g: 4,
        carbs_g: 44,
        fat_g: 0,
        fiber_g: 1,
      });
      nutritionStore.updateFood(e1.id, { calories: 300 });
      // e2 should be preserved unchanged
      expect(
        nutritionStore.foodEntries.find((e) => e.id === e2.id)?.calories,
      ).toBe(200);
      expect(
        nutritionStore.foodEntries.find((e) => e.id === e1.id)?.calories,
      ).toBe(300);
    });
  });

  describe("addWater", () => {
    it("adds a water entry", () => {
      const entry = nutritionStore.addWater(500);
      expect(entry.amount_ml).toBe(500);
      expect(nutritionStore.waterEntries).toHaveLength(1);
    });
  });

  describe("supplements", () => {
    it("adds a supplement", () => {
      const entry = nutritionStore.addSupplement({
        name: "Creatine",
        dose: "5g",
        notes: null,
      });
      expect(entry.name).toBe("Creatine");
      expect(nutritionStore.supplementEntries).toHaveLength(1);
    });

    it("addSupplementStack deduplicates", () => {
      nutritionStore.addSupplement({
        name: "Creatine",
        dose: "5g",
        notes: null,
      });
      const added = nutritionStore.addSupplementStack([
        { name: "Creatine", dose: "5g" },
        { name: "Fish Oil", dose: "2g" },
      ]);
      // Creatine already taken, only Fish Oil added
      expect(added).toHaveLength(1);
      expect(added[0].name).toBe("Fish Oil");
      expect(nutritionStore.supplementEntries).toHaveLength(2);
    });

    it("addSupplementStack returns empty when all supplements already taken", () => {
      nutritionStore.addSupplement({
        name: "Creatine",
        dose: "5g",
        notes: null,
      });
      nutritionStore.addSupplement({
        name: "Fish Oil",
        dose: "2g",
        notes: null,
      });
      const added = nutritionStore.addSupplementStack([
        { name: "Creatine", dose: "5g" },
        { name: "Fish Oil", dose: "2g" },
      ]);
      // All supplements already taken, early return []
      expect(added).toHaveLength(0);
      expect(nutritionStore.supplementEntries).toHaveLength(2);
    });

    it("removeSupplement removes by id", () => {
      const entry = nutritionStore.addSupplement({
        name: "Creatine",
        dose: "5g",
        notes: null,
      });
      nutritionStore.removeSupplement(entry.id);
      expect(nutritionStore.supplementEntries).toHaveLength(0);
    });
  });

  describe("todaysTotals", () => {
    it("sums food entries for selected date", () => {
      nutritionStore.addFood({
        name: "A",
        servings: 1,
        calories: 200,
        protein_g: 20,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 2,
      });
      nutritionStore.addFood({
        name: "B",
        servings: 1,
        calories: 300,
        protein_g: 30,
        carbs_g: 20,
        fat_g: 10,
        fiber_g: 3,
      });
      const totals = nutritionStore.todaysTotals;
      expect(totals.calories).toBe(500);
      expect(totals.protein_g).toBe(50);
      expect(totals.carbs_g).toBe(30);
      expect(totals.fat_g).toBe(15);
      expect(totals.fiber_g).toBe(5);
    });

    it("returns null meal times when no food", () => {
      const totals = nutritionStore.todaysTotals;
      expect(totals.firstMealTime).toBeNull();
      expect(totals.lastMealTime).toBeNull();
    });

    it("handles food entries with missing fiber_g and water_ml", () => {
      nutritionStore.addFood({
        name: "Test",
        servings: 1,
        calories: 100,
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        // fiber_g and water_ml intentionally omitted
      } as any);
      const totals = nutritionStore.todaysTotals;
      expect(totals.fiber_g).toBeGreaterThanOrEqual(0);
      expect(totals.water_ml).toBeGreaterThanOrEqual(0);
    });

    it("includes water from water entries and food entries", () => {
      nutritionStore.addWater(500);
      nutritionStore.addFood({
        name: "Tea",
        servings: 1,
        calories: 5,
        protein_g: 0,
        carbs_g: 1,
        fat_g: 0,
        fiber_g: 0,
        water_ml: 250,
      });
      const totals = nutritionStore.todaysTotals;
      expect(totals.water_ml).toBe(750);
    });
  });

  describe("feedingWindow", () => {
    it("returns closed when no meals and fast not broken", () => {
      const fw = nutritionStore.feedingWindow;
      expect(fw.isOpen).toBe(false);
      expect(fw.opensAt).toBeNull();
      expect(fw.closesAt).toBeNull();
    });

    it("returns closed even when food entries exist but fast not broken", () => {
      // Low-cal food without breaking fast — window should stay closed
      nutritionStore.addFood({
        name: "Black Coffee",
        servings: 1,
        calories: 2,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
      });
      const fw = nutritionStore.feedingWindow;
      expect(fw.isOpen).toBe(false);
      expect(fw.opensAt).toBeNull();
    });

    it("calculates 4h window from breakFast time", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T10:00:00"));
      nutritionStore.addFood({
        name: "Meal",
        servings: 1,
        calories: 500,
        protein_g: 40,
        carbs_g: 30,
        fat_g: 15,
        fiber_g: 3,
      });
      nutritionStore.breakFast("10:00");
      const fw = nutritionStore.feedingWindow;
      expect(fw.opensAt).toBe("10:00");
      expect(fw.closesAt).toBe("14:00");
      vi.useRealTimers();
    });

    it("returns closed feeding window after 4h expires", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T10:00:00"));
      nutritionStore.addFood({
        name: "Breakfast",
        servings: 1,
        calories: 300,
        protein_g: 20,
        carbs_g: 30,
        fat_g: 10,
        fiber_g: 2,
      });
      nutritionStore.breakFast("10:00");

      // Advance time past the 4h window (to 14:30, window closes at 14:00)
      vi.setSystemTime(new Date("2025-01-15T14:30:00"));
      const fw = nutritionStore.feedingWindow;
      expect(fw.isOpen).toBe(false);
      expect(fw.opensAt).toBe("10:00");
      expect(fw.closesAt).toBe("14:00");
      expect(fw.minutesLeft).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("setDate", () => {
    it("changes selectedDate and fetches new data", async () => {
      const { fetchFoodEntries, fetchWaterEntries, fetchSupplementEntries } =
        await import("$lib/services/nutritionData");
      (fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (
        fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      await nutritionStore.setDate("2025-01-10");
      expect(nutritionStore.selectedDate).toBe("2025-01-10");
      expect(fetchFoodEntries).toHaveBeenCalledWith("2025-01-10");
    });
  });

  describe("recipes getter recomputes macros", () => {
    it("passes through simple recipes", () => {
      nutritionStore.addRecipe({
        name: "Chicken",
        calories: 250,
        protein_g: 40,
        carbs_g: 0,
        fat_g: 8,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "g",
      });
      const recipes = nutritionStore.recipes;
      expect(recipes).toHaveLength(1);
      expect(recipes[0].name).toBe("Chicken");
    });

    it("recomputes macros for composite recipes with ingredients", async () => {
      const { computeRecipeMacros } =
        await import("$lib/services/nutritionData");
      // Add a base ingredient first
      const base = nutritionStore.addRecipe({
        name: "Oats",
        calories: 150,
        protein_g: 5,
        carbs_g: 27,
        fat_g: 3,
        fiber_g: 4,
        serving_size: 40,
        serving_unit: "g",
      });
      // Add a composite recipe that references the base ingredient
      nutritionStore.addRecipeWithIngredients(
        {
          name: "Morning Bowl",
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          serving_size: 1,
          serving_unit: "serving",
        },
        [{ ingredient_id: base.id, quantity: 2, quantity_unit: "serving" }],
      );
      // Access the getter which triggers recomputation
      const recipes = nutritionStore.recipes;
      const composite = recipes.find((r) => r.name === "Morning Bowl");
      expect(composite).toBeDefined();
      // computeRecipeMacros is called for the composite recipe
      expect(computeRecipeMacros).toHaveBeenCalled();
    });
  });

  describe("addRecipe", () => {
    it("returns the created recipe with a generated id", async () => {
      const { upsertRecipe } = await import("$lib/services/nutritionData");
      const recipe = nutritionStore.addRecipe({
        name: "Eggs",
        calories: 155,
        protein_g: 13,
        carbs_g: 1,
        fat_g: 11,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "g",
      });
      expect(recipe.id).toBeDefined();
      expect(recipe.name).toBe("Eggs");
      expect(nutritionStore.recipes).toHaveLength(1);
      // Verify it calls the API
      expect(upsertRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Eggs" }),
      );
    });
  });

  describe("updateRecipe", () => {
    it("updates an existing recipe in place", async () => {
      const { upsertRecipe } = await import("$lib/services/nutritionData");
      const recipe = nutritionStore.addRecipe({
        name: "Oats",
        calories: 150,
        protein_g: 5,
        carbs_g: 27,
        fat_g: 3,
        fiber_g: 4,
        serving_size: 40,
        serving_unit: "g",
      });
      nutritionStore.updateRecipe({ ...recipe, calories: 160 });
      const updated = nutritionStore.recipes.find((r) => r.id === recipe.id);
      expect(updated?.calories).toBe(160);
      expect(upsertRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ calories: 160 }),
      );
    });

    it("preserves other recipes when updating one", async () => {
      const r1 = nutritionStore.addRecipe({
        name: "Oats",
        calories: 150,
        protein_g: 5,
        carbs_g: 27,
        fat_g: 3,
        fiber_g: 4,
        serving_size: 40,
        serving_unit: "g",
      });
      const r2 = nutritionStore.addRecipe({
        name: "Rice",
        calories: 200,
        protein_g: 4,
        carbs_g: 44,
        fat_g: 0,
        fiber_g: 1,
        serving_size: 100,
        serving_unit: "g",
      });
      nutritionStore.updateRecipe({ ...r1, calories: 160 });
      // r2 should be unchanged
      const recipes = nutritionStore.recipes;
      expect(recipes.find((r) => r.id === r2.id)?.calories).toBe(200);
      expect(recipes.find((r) => r.id === r1.id)?.calories).toBe(160);
    });
  });

  describe("removeRecipe", () => {
    it("removes a recipe by id", async () => {
      const { deleteRecipe } = await import("$lib/services/nutritionData");
      const recipe = nutritionStore.addRecipe({
        name: "Tofu",
        calories: 80,
        protein_g: 8,
        carbs_g: 2,
        fat_g: 4,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "g",
      });
      expect(nutritionStore.recipes).toHaveLength(1);
      nutritionStore.removeRecipe(recipe.id);
      expect(nutritionStore.recipes).toHaveLength(0);
      expect(deleteRecipe).toHaveBeenCalledWith(recipe.id);
    });
  });

  describe("removeWater", () => {
    it("removes a water entry by id", async () => {
      const { deleteWaterEntry } = await import("$lib/services/nutritionData");
      const entry = nutritionStore.addWater(500);
      expect(nutritionStore.waterEntries).toHaveLength(1);
      nutritionStore.removeWater(entry.id);
      expect(nutritionStore.waterEntries).toHaveLength(0);
      expect(deleteWaterEntry).toHaveBeenCalledWith(entry.id);
    });
  });

  describe("addWeight", () => {
    it("adds a weight entry with generated id", async () => {
      const { upsertWeightEntry } = await import("$lib/services/nutritionData");
      const entry = nutritionStore.addWeight({
        date: "2025-06-01",
        weight_kg: 75.5,
      });
      expect(entry.id).toBeDefined();
      expect(entry.weight_kg).toBe(75.5);
      expect(entry.date).toBe("2025-06-01");
      expect(nutritionStore.weightLog).toHaveLength(1);
      expect(upsertWeightEntry).toHaveBeenCalledWith(
        expect.objectContaining({ weight_kg: 75.5 }),
      );
    });

    it("prepends new entries to weightLog", () => {
      nutritionStore.addWeight({ date: "2025-06-01", weight_kg: 76 });
      nutritionStore.addWeight({ date: "2025-06-02", weight_kg: 75.5 });
      expect(nutritionStore.weightLog[0].date).toBe("2025-06-02");
      expect(nutritionStore.weightLog[1].date).toBe("2025-06-01");
    });

    it("supports optional body composition fields", () => {
      const entry = nutritionStore.addWeight({
        date: "2025-06-01",
        weight_kg: 75,
        body_fat_pct: 18.5,
        muscle_mass_kg: 32,
        visceral_fat: 8,
        water_percent: 55,
      });
      expect(entry.body_fat_pct).toBe(18.5);
      expect(entry.muscle_mass_kg).toBe(32);
      expect(entry.visceral_fat).toBe(8);
      expect(entry.water_percent).toBe(55);
    });
  });

  describe("setTargets", () => {
    it("updates macro targets", async () => {
      const { upsertMacroTargets } =
        await import("$lib/services/nutritionData");
      const newTargets = {
        calories: 1800,
        protein_g: 120,
        carbs_g: 150,
        fat_g: 70,
        water_ml: 3500,
      };
      nutritionStore.setTargets(newTargets);
      expect(nutritionStore.macroTargets).toEqual(newTargets);
      expect(upsertMacroTargets).toHaveBeenCalledWith(newTargets);
    });
  });

  describe("supplementStacks", () => {
    it("has default stacks", () => {
      const stacks = nutritionStore.supplementStacks;
      expect(stacks.morning).toHaveLength(5);
      expect(stacks.noon).toHaveLength(4);
      expect(stacks.evening).toHaveLength(2);
      expect(stacks.morning[0].name).toBe("Berocca");
    });

    it("setSupplementStacks updates and persists", async () => {
      const { upsertSupplementStacks } =
        await import("$lib/services/nutritionData");
      const newStacks = {
        morning: [{ name: "Vitamin D", dose: "2000IU" }],
        noon: [],
        evening: [{ name: "ZMA", dose: "1 cap" }],
      };
      nutritionStore.setSupplementStacks(newStacks);
      expect(nutritionStore.supplementStacks).toEqual(newStacks);
      expect(upsertSupplementStacks).toHaveBeenCalledWith(newStacks);
    });
  });

  describe("frequentSupplements", () => {
    it("starts empty and is populated after hydrate", async () => {
      expect(nutritionStore.frequentSupplements).toEqual([]);

      const svc = await import("$lib/services/nutritionData");
      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);
      (svc.fetchMacroTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (svc.fetchWeightLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementStacks as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);
      (
        svc.fetchFrequentSupplements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([
        { name: "Creatine", dose: "5g" },
        { name: "Fish Oil", dose: "2g" },
      ]);

      await nutritionStore.hydrate();

      // Wait for the fetchFrequentSupplements promise chain to resolve
      await vi.waitFor(() => {
        expect(nutritionStore.frequentSupplements).toHaveLength(2);
      });
      expect(nutritionStore.frequentSupplements[0].name).toBe("Creatine");
    });
  });

  describe("hydrate", () => {
    it("loads data from supabase and updates store", async () => {
      const svc = await import("$lib/services/nutritionData");
      const mockRecipes = [
        {
          id: "r1",
          name: "Chicken",
          calories: 250,
          protein_g: 40,
          carbs_g: 0,
          fat_g: 8,
          fiber_g: 0,
          serving_size: 100,
          serving_unit: "g",
        },
      ];
      const mockFood = [
        {
          id: "f1",
          date: "2025-01-15",
          time: "12:00",
          name: "Chicken",
          servings: 1,
          calories: 250,
          protein_g: 40,
          carbs_g: 0,
          fat_g: 8,
          fiber_g: 0,
        },
      ];
      const mockWater = [
        { id: "w1", date: "2025-01-15", time: "10:00", amount_ml: 500 },
      ];
      const mockSupps = [
        {
          id: "s1",
          date: "2025-01-15",
          time: "08:00",
          name: "Creatine",
          dose: "5g",
          notes: null,
        },
      ];
      const mockTargets = {
        calories: 1800,
        protein_g: 120,
        carbs_g: 150,
        fat_g: 70,
        water_ml: 3500,
      };
      const mockWeight = [{ id: "wl1", date: "2025-01-15", weight_kg: 76 }];

      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRecipes,
      );
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFood,
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockWater,
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(mockSupps);
      (svc.fetchMacroTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockTargets,
      );
      (svc.fetchWeightLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockWeight,
      );
      (
        svc.fetchSupplementStacks as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        morning: [{ name: "Custom AM", dose: "1x" }],
        noon: [],
        evening: [],
      });
      (
        svc.fetchFrequentSupplements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([{ name: "Creatine", dose: "5g" }]);

      await nutritionStore.hydrate();

      expect(nutritionStore.recipes).toHaveLength(1);
      expect(nutritionStore.recipes[0].name).toBe("Chicken");
      expect(nutritionStore.foodEntries).toEqual(mockFood);
      expect(nutritionStore.waterEntries).toEqual(mockWater);
      expect(nutritionStore.supplementEntries).toEqual(mockSupps);
      expect(nutritionStore.macroTargets).toEqual(mockTargets);
      expect(nutritionStore.weightLog).toEqual(mockWeight);
      expect(nutritionStore.supplementStacks.morning[0].name).toBe("Custom AM");
    });

    it("skips overwriting recipes when supabase returns empty", async () => {
      const svc = await import("$lib/services/nutritionData");
      // Add a local recipe first
      nutritionStore.addRecipe({
        name: "Local Recipe",
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 1,
        serving_size: 1,
        serving_unit: "serving",
      });

      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);
      (svc.fetchMacroTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (svc.fetchWeightLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementStacks as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);
      (
        svc.fetchFrequentSupplements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      await nutritionStore.hydrate();

      // Local recipe should still be there (empty array from server doesn't overwrite)
      expect(nutritionStore.recipes).toHaveLength(1);
      expect(nutritionStore.recipes[0].name).toBe("Local Recipe");
      // Null targets should not overwrite defaults
      expect(nutritionStore.macroTargets.calories).toBe(2000);
      // Null supplement stacks should not overwrite defaults
      expect(nutritionStore.supplementStacks.morning).toHaveLength(5);
    });

    it("handles hydration error gracefully", async () => {
      const svc = await import("$lib/services/nutritionData");
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error"),
      );

      await nutritionStore.hydrate();

      // Store should still work with defaults
      expect(nutritionStore.recipes).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Nutrition hydration error:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("ensureHydrated", () => {
    it("calls hydrate only once", async () => {
      const svc = await import("$lib/services/nutritionData");
      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (svc.fetchMacroTargets as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (svc.fetchWeightLog as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (svc.fetchSupplementStacks as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (
        svc.fetchFrequentSupplements as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      nutritionStore.ensureHydrated();
      nutritionStore.ensureHydrated();
      nutritionStore.ensureHydrated();

      // fetchRecipes should only have been called once despite three ensureHydrated calls
      expect(svc.fetchRecipes).toHaveBeenCalledTimes(1);
    });
  });

  describe("setDate error path", () => {
    it("clears entries when fetch fails", async () => {
      const svc = await import("$lib/services/nutritionData");
      // Add some existing entries first
      nutritionStore.addFood({
        name: "Existing",
        servings: 1,
        calories: 100,
        protein_g: 10,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
      });
      nutritionStore.addWater(500);
      expect(nutritionStore.foodEntries).toHaveLength(1);

      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("fail"),
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("fail"),
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("fail"));

      await nutritionStore.setDate("2025-03-01");

      expect(nutritionStore.selectedDate).toBe("2025-03-01");
      expect(nutritionStore.foodEntries).toHaveLength(0);
      expect(nutritionStore.waterEntries).toHaveLength(0);
      expect(nutritionStore.supplementEntries).toHaveLength(0);
    });
  });

  describe("addRecipeWithIngredients", () => {
    it("creates a composite recipe with ingredients linked", () => {
      const base = nutritionStore.addRecipe({
        name: "Whey Protein",
        calories: 120,
        protein_g: 24,
        carbs_g: 3,
        fat_g: 1,
        fiber_g: 0,
        serving_size: 30,
        serving_unit: "g",
      });

      const composite = nutritionStore.addRecipeWithIngredients(
        {
          name: "Post-Workout Shake",
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          serving_size: 1,
          serving_unit: "serving",
        },
        [{ ingredient_id: base.id, quantity: 2, quantity_unit: "serving" }],
      );

      expect(composite.id).toBeDefined();
      expect(composite.name).toBe("Post-Workout Shake");
      expect(composite.ingredients).toHaveLength(1);
      expect(composite.ingredients![0].ingredient_id).toBe(base.id);
      expect(composite.ingredients![0].recipe_id).toBe(composite.id);
      // Verify recipe was added to store
      expect(
        nutritionStore.recipes.find((r) => r.id === composite.id),
      ).toBeDefined();
    });
  });

  describe("updateRecipeIngredients", () => {
    it("updates ingredients and recomputes macros for an existing recipe", async () => {
      const svc = await import("$lib/services/nutritionData");
      const base = nutritionStore.addRecipe({
        name: "Oats",
        calories: 150,
        protein_g: 5,
        carbs_g: 27,
        fat_g: 3,
        fiber_g: 4,
        serving_size: 40,
        serving_unit: "g",
      });
      const composite = nutritionStore.addRecipeWithIngredients(
        {
          name: "Bowl",
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
          serving_size: 1,
          serving_unit: "serving",
        },
        [{ ingredient_id: base.id, quantity: 1, quantity_unit: "serving" }],
      );

      // Now update the ingredients to use quantity 3
      nutritionStore.updateRecipeIngredients(composite.id, [
        { ingredient_id: base.id, quantity: 3, quantity_unit: "serving" },
      ]);

      const updated = nutritionStore.recipes.find((r) => r.id === composite.id);
      expect(updated).toBeDefined();
      expect(updated!.ingredients).toHaveLength(1);
      expect(updated!.ingredients![0].quantity).toBe(3);
      // computeRecipeMacros is called synchronously during updateRecipeIngredients
      expect(svc.computeRecipeMacros).toHaveBeenCalled();
      // upsertRecipe is called (the chained upsertRecipeIngredients is async)
      expect(svc.upsertRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ id: composite.id }),
      );
      // Flush the promise chain so upsertRecipeIngredients resolves
      await vi.waitFor(() => {
        expect(svc.upsertRecipeIngredients).toHaveBeenCalledWith(
          composite.id,
          expect.any(Array),
        );
      });
    });
  });

  // ── Fasting threshold tests ──

  // Helper to create a Macros object from carbs (simulates pure-sugar items)
  const carbMacros = (carbs_g: number): Macros => ({
    calories: carbs_g * 4,
    protein_g: 0,
    carbs_g,
    fat_g: 0,
    fiber_g: 0,
  });
  // Helper for fat-only items
  const fatMacros = (fat_g: number): Macros => ({
    calories: fat_g * 9,
    protein_g: 0,
    carbs_g: 0,
    fat_g,
    fiber_g: 0,
  });
  // Helper for a typical meal
  const mealMacros = (p: number, c: number, f: number, fi = 0): Macros => ({
    calories: Math.round(p * 4 + c * 4 + f * 9),
    protein_g: p,
    carbs_g: c,
    fat_g: f,
    fiber_g: fi,
  });

  describe("fasting constants", () => {
    it("exports correct threshold values", () => {
      expect(FASTING_SAFE_SCORE).toBe(10);
      expect(FASTING_CAUTION_SCORE).toBe(50);
      expect(FASTING_BREAK_SINGLE_SCORE).toBe(100);
      expect(FASTING_WINDOW_MINUTES).toBe(30);
    });
  });

  describe("insulinScore", () => {
    it("scores pure carbs highest (4 per gram)", () => {
      // 10g net carbs → score 40
      expect(
        insulinScore({
          calories: 40,
          protein_g: 0,
          carbs_g: 10,
          fat_g: 0,
          fiber_g: 0,
        }),
      ).toBe(40);
    });

    it("scores protein at half carb rate (2 per gram)", () => {
      // 10g protein → score 20
      expect(
        insulinScore({
          calories: 40,
          protein_g: 10,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
        }),
      ).toBe(20);
    });

    it("scores fat minimally (0.9 per gram)", () => {
      // 10g fat → score 9
      expect(
        insulinScore({
          calories: 90,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 10,
          fiber_g: 0,
        }),
      ).toBe(9);
    });

    it("subtracts fiber from carbs", () => {
      // 10g carbs - 5g fiber = 5g net carbs → 5*4 = 20
      expect(
        insulinScore({
          calories: 40,
          protein_g: 0,
          carbs_g: 10,
          fat_g: 0,
          fiber_g: 5,
        }),
      ).toBe(20);
    });

    it("clamps net carbs at zero when fiber exceeds carbs", () => {
      expect(
        insulinScore({
          calories: 10,
          protein_g: 0,
          carbs_g: 2,
          fat_g: 0,
          fiber_g: 5,
        }),
      ).toBe(0);
    });

    it("tea with milk: ~6 score (fasting safe)", () => {
      // ~20ml milk: 0.7g protein, 1g carb (lactose), 0.7g fat
      const score = insulinScore({
        calories: 13,
        protein_g: 0.7,
        carbs_g: 1,
        fat_g: 0.7,
        fiber_g: 0,
      });
      // 1*4 + 0.7*2 + 0.7*0.9 = 4 + 1.4 + 0.63 = 6.03
      expect(score).toBeCloseTo(6.03, 1);
    });

    it("bulletproof coffee: low score despite high calories", () => {
      // 1 tbsp butter: 0g protein, 0g carbs, 12g fat = 108 cal
      const score = insulinScore({
        calories: 108,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 12,
        fiber_g: 0,
      });
      // 0 + 0 + 12*0.9 = 10.8
      expect(score).toBeCloseTo(10.8, 1);
    });

    it("real meal: high score", () => {
      // Typical lunch: 30g protein, 40g carbs, 15g fat, 5g fiber
      const score = insulinScore({
        calories: 415,
        protein_g: 30,
        carbs_g: 40,
        fat_g: 15,
        fiber_g: 5,
      });
      // (40-5)*4 + 30*2 + 15*0.9 = 140 + 60 + 13.5 = 213.5
      expect(score).toBeCloseTo(213.5, 1);
    });
  });

  describe("assessFastImpact (store method)", () => {
    it("returns SAFE when fast already broken", () => {
      nutritionStore.breakFast("08:00");
      const result = nutritionStore.assessFastImpact(mealMacros(40, 30, 15));
      expect(result.impact).toBe("SAFE");
    });

    it("returns BREAKS_FAST for a real meal", () => {
      // 30g protein, 40g carbs, 15g fat → score 213.5
      const result = nutritionStore.assessFastImpact(mealMacros(30, 40, 15));
      expect(result.impact).toBe("BREAKS_FAST");
    });

    it("returns SAFE for tea with milk", () => {
      // score ~6 → SAFE
      const result = nutritionStore.assessFastImpact({
        calories: 13,
        protein_g: 0.7,
        carbs_g: 1,
        fat_g: 0.7,
        fiber_g: 0,
      });
      expect(result.impact).toBe("SAFE");
    });
  });

  describe("assessFastImpactPure", () => {
    it("returns SAFE when fastBrokenAt is already set", () => {
      const result = assessFastImpactPure(mealMacros(40, 30, 15), [], "08:00");
      expect(result.impact).toBe("SAFE");
      expect(result.proposedCalories).toBe(mealMacros(40, 30, 15).calories);
    });

    it("returns BREAKS_FAST for high insulin score item", () => {
      // 25g carbs → score 100 → BREAKS_FAST
      const result = assessFastImpactPure(carbMacros(25), [], null);
      expect(result.impact).toBe("BREAKS_FAST");
    });

    it("returns SAFE for fat-only item despite high calories", () => {
      // 10g fat = 90 cal, but score only 9 → SAFE
      const result = assessFastImpactPure(fatMacros(10), [], null);
      expect(result.impact).toBe("SAFE");
      expect(result.proposedCalories).toBe(90);
    });

    it("returns SAFE for zero-macro item", () => {
      const result = assessFastImpactPure(
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        [],
        null,
      );
      expect(result.impact).toBe("SAFE");
      expect(result.rollingScore).toBe(0);
    });

    it("returns CAUTION for moderate insulin items", () => {
      // 5g protein → score 10, which hits CAUTION (>= 10 but < 50)
      const result = assessFastImpactPure(
        { calories: 20, protein_g: 5, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        [],
        null,
      );
      expect(result.impact).toBe("CAUTION");
    });

    it("accumulates rolling scores within 30-min window", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T10:15:00"));
      const today = "2025-01-15";
      const entries: FoodEntry[] = [
        // Tea with milk: score ~6
        {
          id: "1",
          date: today,
          time: "10:05",
          name: "Tea",
          servings: 1,
          calories: 13,
          protein_g: 0.7,
          carbs_g: 1,
          fat_g: 0.7,
          fiber_g: 0,
        },
      ];
      // Another tea: score ~6, rolling ~6 + ~6 = ~12 → CAUTION
      const result = assessFastImpactPure(
        { calories: 13, protein_g: 0.7, carbs_g: 1, fat_g: 0.7, fiber_g: 0 },
        entries,
        null,
      );
      expect(result.impact).toBe("CAUTION");
      expect(result.rollingScore).toBeGreaterThan(0);
      vi.useRealTimers();
    });

    it("returns BREAKS_FAST when rolling insulin score >= 50", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T10:15:00"));
      const today = "2025-01-15";
      const entries: FoodEntry[] = [
        // Bone broth: 5g protein, 1g carbs → score ~14
        {
          id: "1",
          date: today,
          time: "10:05",
          name: "Broth",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
      ];
      // Propose more protein: 10g protein, 5g carbs → score 40. Rolling 14 + 40 = 54 → BREAKS_FAST
      const result = assessFastImpactPure(
        { calories: 60, protein_g: 10, carbs_g: 5, fat_g: 0, fiber_g: 0 },
        entries,
        null,
      );
      expect(result.impact).toBe("BREAKS_FAST");
      vi.useRealTimers();
    });

    it("ignores entries outside the 30-min window", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T11:00:00"));
      const today = "2025-01-15";
      const entries: FoodEntry[] = [
        // High score entry but >30 min ago
        {
          id: "1",
          date: today,
          time: "10:00",
          name: "Old Broth",
          servings: 1,
          calories: 40,
          protein_g: 8,
          carbs_g: 2,
          fat_g: 0,
          fiber_g: 0,
        },
      ];
      // Propose small item, old entry excluded → SAFE
      const result = assessFastImpactPure(
        { calories: 5, protein_g: 0, carbs_g: 1, fat_g: 0, fiber_g: 0 },
        entries,
        null,
      );
      expect(result.impact).toBe("SAFE");
      expect(result.rollingScore).toBe(0);
      vi.useRealTimers();
    });

    it("ignores entries from different dates", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T10:15:00"));
      const entries: FoodEntry[] = [
        {
          id: "1",
          date: "2025-01-14",
          time: "10:05",
          name: "Yesterday",
          servings: 1,
          calories: 200,
          protein_g: 20,
          carbs_g: 20,
          fat_g: 5,
          fiber_g: 0,
        },
      ];
      const result = assessFastImpactPure(
        { calories: 5, protein_g: 0, carbs_g: 1, fat_g: 0, fiber_g: 0 },
        entries,
        null,
      );
      expect(result.impact).toBe("SAFE");
      vi.useRealTimers();
    });

    it("fiber reduces insulin impact", () => {
      // 12g carbs, 10g fiber → 2g net carbs → score 8 → SAFE
      const result = assessFastImpactPure(
        { calories: 48, protein_g: 0, carbs_g: 12, fat_g: 0, fiber_g: 10 },
        [],
        null,
      );
      expect(result.impact).toBe("SAFE");
    });

    it("score boundary: exactly 10 is CAUTION", () => {
      // 2.5g carbs → score 10
      const result = assessFastImpactPure(carbMacros(2.5), [], null);
      expect(result.impact).toBe("CAUTION");
    });

    it("score boundary: just under 10 is SAFE", () => {
      // 2g carbs → score 8
      const result = assessFastImpactPure(carbMacros(2), [], null);
      expect(result.impact).toBe("SAFE");
    });

    it("score boundary: exactly 50 is BREAKS_FAST", () => {
      // 12.5g carbs → score 50
      const result = assessFastImpactPure(carbMacros(12.5), [], null);
      expect(result.impact).toBe("BREAKS_FAST");
    });

    it("score boundary: just under 50 is CAUTION", () => {
      // 12g carbs → score 48
      const result = assessFastImpactPure(carbMacros(12), [], null);
      expect(result.impact).toBe("CAUTION");
    });
  });

  describe("inferFastBrokenAtPure", () => {
    it("returns null for empty entries", () => {
      expect(inferFastBrokenAtPure([])).toBeNull();
    });

    it("returns null when all entries are low insulin impact", () => {
      const entries: FoodEntry[] = [
        {
          id: "1",
          date: "2025-01-15",
          time: "08:00",
          name: "Black Coffee",
          servings: 1,
          calories: 2,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
        },
        {
          id: "2",
          date: "2025-01-15",
          time: "09:00",
          name: "Tea",
          servings: 1,
          calories: 13,
          protein_g: 0.7,
          carbs_g: 1,
          fat_g: 0.7,
          fiber_g: 0,
        },
      ];
      expect(inferFastBrokenAtPure(entries)).toBeNull();
    });

    it("detects single high-insulin-score item", () => {
      const entries: FoodEntry[] = [
        {
          id: "1",
          date: "2025-01-15",
          time: "08:00",
          name: "Tea",
          servings: 1,
          calories: 5,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
        },
        // Lunch: 40p + 30c + 15f - 3fi → score (27*4)+(40*2)+(15*0.9) = 108+80+13.5 = 201.5
        {
          id: "2",
          date: "2025-01-15",
          time: "12:00",
          name: "Lunch",
          servings: 1,
          calories: 500,
          protein_g: 40,
          carbs_g: 30,
          fat_g: 15,
          fiber_g: 3,
        },
      ];
      expect(inferFastBrokenAtPure(entries)).toBe("12:00");
    });

    it("does NOT break fast for high-cal fat-only item", () => {
      const entries: FoodEntry[] = [
        // Bulletproof coffee: 108 cal from fat → insulin score 10.8 (under single-item threshold of 100)
        {
          id: "1",
          date: "2025-01-15",
          time: "08:00",
          name: "Bulletproof Coffee",
          servings: 1,
          calories: 108,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 12,
          fiber_g: 0,
        },
      ];
      expect(inferFastBrokenAtPure(entries)).toBeNull();
    });

    it("detects cumulative insulin score >= 50 within 30-min window", () => {
      const entries: FoodEntry[] = [
        // Each has ~14 insulin score (5g protein, 1g carbs)
        {
          id: "1",
          date: "2025-01-15",
          time: "10:00",
          name: "Broth 1",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
        {
          id: "2",
          date: "2025-01-15",
          time: "10:10",
          name: "Broth 2",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
        {
          id: "3",
          date: "2025-01-15",
          time: "10:20",
          name: "Broth 3",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
        {
          id: "4",
          date: "2025-01-15",
          time: "10:25",
          name: "Broth 4",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
      ];
      // 4 × ~14.45 = ~57.8 → breaks at 10:25
      expect(inferFastBrokenAtPure(entries)).toBe("10:25");
    });

    it("does not count entries outside 30-min window", () => {
      const entries: FoodEntry[] = [
        {
          id: "1",
          date: "2025-01-15",
          time: "08:00",
          name: "Broth",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
        {
          id: "2",
          date: "2025-01-15",
          time: "09:00",
          name: "Broth 2",
          servings: 1,
          calories: 27,
          protein_g: 5,
          carbs_g: 1,
          fat_g: 0.5,
          fiber_g: 0,
        },
      ];
      // Each ~14.45 score, but 60 min apart — never hit 50 in window
      expect(inferFastBrokenAtPure(entries)).toBeNull();
    });

    it("sorts entries chronologically before processing", () => {
      const entries: FoodEntry[] = [
        {
          id: "2",
          date: "2025-01-15",
          time: "12:00",
          name: "Lunch",
          servings: 1,
          calories: 500,
          protein_g: 40,
          carbs_g: 30,
          fat_g: 15,
          fiber_g: 3,
        },
        {
          id: "1",
          date: "2025-01-15",
          time: "08:00",
          name: "Tea",
          servings: 1,
          calories: 5,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          fiber_g: 0,
        },
      ];
      expect(inferFastBrokenAtPure(entries)).toBe("12:00");
    });
  });

  describe("breakFast", () => {
    it("sets fastBrokenAt with explicit time", () => {
      expect(nutritionStore.fastBrokenAt).toBeNull();
      nutritionStore.breakFast("12:30");
      expect(nutritionStore.fastBrokenAt).toBe("12:30");
    });

    it("sets fastBrokenAt to current time when no argument", () => {
      nutritionStore.breakFast();
      expect(nutritionStore.fastBrokenAt).toBeTruthy();
      expect(nutritionStore.fastBrokenAt).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe("inferFastBroken (store method)", () => {
    it("infers from existing food entries", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T13:00:00"));
      // Add a high-cal food — this will get today's date
      nutritionStore.addFood({
        name: "Big Meal",
        servings: 1,
        calories: 500,
        protein_g: 40,
        carbs_g: 30,
        fat_g: 15,
        fiber_g: 3,
      });
      // Fast should not be broken just from addFood
      expect(nutritionStore.fastBrokenAt).toBeNull();

      // Now infer
      nutritionStore.inferFastBroken();
      expect(nutritionStore.fastBrokenAt).toBeTruthy();
      vi.useRealTimers();
    });

    it("does not break fast when entries are all low-cal", () => {
      nutritionStore.addFood({
        name: "Tea",
        servings: 1,
        calories: 3,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
      });
      nutritionStore.inferFastBroken();
      expect(nutritionStore.fastBrokenAt).toBeNull();
    });
  });

  describe("setDate resets fastBrokenAt", () => {
    it("resets fastBrokenAt on date change", async () => {
      const svc = await import("$lib/services/nutritionData");
      nutritionStore.breakFast("10:00");
      expect(nutritionStore.fastBrokenAt).toBe("10:00");

      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      await nutritionStore.setDate("2025-01-10");
      // Should be null since no entries for the new date
      expect(nutritionStore.fastBrokenAt).toBeNull();
    });

    it("re-infers fastBrokenAt from fetched entries", async () => {
      const svc = await import("$lib/services/nutritionData");

      const newDateFood: FoodEntry[] = [
        {
          id: "f1",
          date: "2025-01-10",
          time: "12:00",
          name: "Lunch",
          servings: 1,
          calories: 500,
          protein_g: 40,
          carbs_g: 30,
          fat_g: 15,
          fiber_g: 3,
        },
      ];
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        newDateFood,
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      await nutritionStore.setDate("2025-01-10");
      expect(nutritionStore.fastBrokenAt).toBe("12:00");
    });
  });

  describe("hydrate infers fastBrokenAt", () => {
    it("infers fasting state after hydration", async () => {
      const svc = await import("$lib/services/nutritionData");
      const today = nutritionStore.selectedDate;

      const mockFood: FoodEntry[] = [
        {
          id: "f1",
          date: today,
          time: "12:00",
          name: "Lunch",
          servings: 1,
          calories: 500,
          protein_g: 40,
          carbs_g: 30,
          fat_g: 15,
          fiber_g: 3,
        },
      ];

      (svc.fetchRecipes as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      (svc.fetchFoodEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockFood,
      );
      (svc.fetchWaterEntries as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementEntries as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);
      (svc.fetchMacroTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );
      (svc.fetchWeightLog as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );
      (
        svc.fetchSupplementStacks as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);
      (
        svc.fetchFrequentSupplements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      await nutritionStore.hydrate();
      expect(nutritionStore.fastBrokenAt).toBe("12:00");
    });
  });

  describe("glucose readings", () => {
    it("starts with empty glucose readings", () => {
      expect(nutritionStore.glucoseReadings).toEqual([]);
    });

    it("addGlucose adds a reading to the store", async () => {
      const reading = await nutritionStore.addGlucose({
        date: "2025-01-15",
        time: "13:00",
        value: 5.5,
        unit: "mmol/L",
        equipment_id: null,
        notes: null,
      });
      expect(reading).not.toBeNull();
      expect(nutritionStore.glucoseReadings).toHaveLength(1);
      expect(nutritionStore.glucoseReadings[0].value).toBe(5.5);
    });

    it("addGlucose does not add when API returns null", async () => {
      const glMod = await import("$lib/services/glucoseData");
      (
        glMod.addGlucoseReading as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);

      const reading = await nutritionStore.addGlucose({
        date: "2025-01-15",
        time: "13:00",
        value: 5.5,
        unit: "mmol/L",
        equipment_id: null,
        notes: null,
      });
      expect(reading).toBeNull();
      expect(nutritionStore.glucoseReadings).toHaveLength(0);
    });

    it("removeGlucose removes a reading from the store", async () => {
      const reading = await nutritionStore.addGlucose({
        date: "2025-01-15",
        time: "13:00",
        value: 5.5,
        unit: "mmol/L",
        equipment_id: null,
        notes: null,
      });
      expect(nutritionStore.glucoseReadings).toHaveLength(1);
      await nutritionStore.removeGlucose(reading!.id);
      expect(nutritionStore.glucoseReadings).toHaveLength(0);
    });

    it("addGlucose auto-classifies reading_type", async () => {
      // Add a food entry first to establish a meal time
      nutritionStore.addFood({
        name: "Lunch",
        servings: 1,
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
      });
      nutritionStore.breakFast("12:00");

      const reading = await nutritionStore.addGlucose({
        date: nutritionStore.selectedDate,
        time: "06:00",
        value: 90,
        unit: "mg/dL",
        equipment_id: null,
        notes: null,
      });
      // Before fast broken time → classified as fasting
      expect(reading?.reading_type).toBeDefined();
    });

    it("addGlucose reclassifies reading_type when set to random", async () => {
      nutritionStore.breakFast("12:00");
      const reading = await nutritionStore.addGlucose({
        date: nutritionStore.selectedDate,
        time: "06:00",
        value: 88,
        unit: "mg/dL",
        equipment_id: null,
        notes: null,
        reading_type: "random",
      });
      expect(reading?.reading_type).not.toBe("random");
    });

    it("addGlucose triggers model refit and saves params", async () => {
      const { fitParams } = await import("$lib/services/glucoseModelFitter");
      const { upsertGlucoseModelParams, fetchGlucoseReadingsRange } =
        await import("$lib/services/glucoseData");
      const { fetchFoodEntriesRange } =
        await import("$lib/services/nutritionData");
      (fitParams as ReturnType<typeof vi.fn>).mockClear();
      (upsertGlucoseModelParams as ReturnType<typeof vi.fn>).mockClear();

      // Mock range fetches to return data so refit actually runs
      const reading = {
        id: "gl-1",
        date: nutritionStore.selectedDate,
        time: "15:00",
        value: 77,
        unit: "mg/dL",
        equipment_id: null,
        notes: null,
      };
      (
        fetchGlucoseReadingsRange as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([reading]);
      (fetchFoodEntriesRange as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        [],
      );

      await nutritionStore.addGlucose({
        date: nutritionStore.selectedDate,
        time: "15:00",
        value: 77,
        unit: "mg/dL",
        equipment_id: null,
        notes: null,
      });

      // Wait for async refit to complete
      await vi.waitFor(() => {
        expect(fitParams).toHaveBeenCalledTimes(1);
      });
      expect(upsertGlucoseModelParams).toHaveBeenCalledTimes(1);
    });
  });

  describe("predictGlucose", () => {
    it("returns empty array when no food entries", () => {
      const result = nutritionStore.predictGlucose();
      expect(result).toEqual([]);
    });

    it("returns glucose curve when food entries exist", () => {
      nutritionStore.addFood({
        name: "Lunch",
        servings: 1,
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
      });
      const result = nutritionStore.predictGlucose();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("timeMin");
      expect(result[0]).toHaveProperty("value");
    });

    it("returns empty array for GP model when no food entries", () => {
      const result = nutritionStore.predictGlucose([], null, "gp");
      expect(result).toEqual([]);
    });

    it("dispatches to GP model when modelType is gp", async () => {
      const { predictGlucoseCurveGP } =
        await import("$lib/services/glucoseModelGP");
      nutritionStore.addFood({
        name: "Lunch",
        servings: 1,
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
      });
      const result = nutritionStore.predictGlucose([], null, "gp");
      expect(predictGlucoseCurveGP).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      // GP points have upper/lower
      expect(result[0]).toHaveProperty("upper");
      expect(result[0]).toHaveProperty("lower");
    });

    it("uses parametric model by default", async () => {
      const { predictGlucoseCurveGP } =
        await import("$lib/services/glucoseModelGP");
      (predictGlucoseCurveGP as ReturnType<typeof vi.fn>).mockClear();
      nutritionStore.addFood({
        name: "Lunch",
        servings: 1,
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
      });
      const result = nutritionStore.predictGlucose([], null, "parametric");
      expect(predictGlucoseCurveGP).not.toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
      // Parametric points do NOT have upper/lower
      expect(result[0]).not.toHaveProperty("upper");
    });
  });

  describe("getGlucoseSchedule", () => {
    it("returns schedule array", () => {
      const schedule = nutritionStore.getGlucoseSchedule(12 * 60);
      expect(Array.isArray(schedule)).toBe(true);
      // Should always have at least fasting + bedtime
      expect(schedule.length).toBeGreaterThanOrEqual(2);
    });

    it("includes post-meal readings when meals exist", () => {
      nutritionStore.addFood({
        name: "Lunch",
        servings: 1,
        calories: 500,
        protein_g: 30,
        carbs_g: 50,
        fat_g: 20,
        fiber_g: 5,
      });
      const schedule = nutritionStore.getGlucoseSchedule(12 * 60);
      const postMeal = schedule.filter((s) => s.type === "post_meal_30");
      expect(postMeal.length).toBeGreaterThan(0);
    });
  });

  describe("getNextGlucoseReading", () => {
    it("returns null when no readings are due", () => {
      const result = nutritionStore.getNextGlucoseReading(3 * 60); // 3am, nothing due
      expect(result).toBeNull();
    });
  });

  describe("modelLabel", () => {
    it("returns Simulated for 0 data points", () => {
      expect(nutritionStore.modelLabel).toBe("Simulated");
    });

    it("returns Learning (N) for 1-29 data points", async () => {
      const svc = await import("$lib/services/glucoseData");
      (
        svc.fetchGlucoseModelParams as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        fasting_baseline_mgdl: 90,
        carb_sensitivity: 4.0,
        protein_sensitivity: 0.7,
        fat_delay_factor: 1.0,
        exercise_reduction_pct: 30,
        gym_sensitivity_hours: 36,
        gym_sensitivity_pct: 15,
        circadian_evening_pct: 10,
        dawn_phenomenon_mgdl: 10,
        peak_time_min: 30,
        curve_shape_k: 2,
        data_points_used: 15,
        last_fit_at: null,
      });
      await nutritionStore.hydrate();
      expect(nutritionStore.modelLabel).toBe("Learning (15)");
    });

    it("returns Personalized for 30+ data points", async () => {
      const svc = await import("$lib/services/glucoseData");
      (
        svc.fetchGlucoseModelParams as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        fasting_baseline_mgdl: 88,
        carb_sensitivity: 3.8,
        protein_sensitivity: 0.6,
        fat_delay_factor: 1.1,
        exercise_reduction_pct: 35,
        gym_sensitivity_hours: 36,
        gym_sensitivity_pct: 15,
        circadian_evening_pct: 10,
        dawn_phenomenon_mgdl: 10,
        peak_time_min: 28,
        curve_shape_k: 2,
        data_points_used: 42,
        last_fit_at: "2026-01-01",
      });
      await nutritionStore.hydrate();
      expect(nutritionStore.modelLabel).toBe("Personalized");
    });
  });
});
