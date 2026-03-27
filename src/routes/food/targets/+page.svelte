<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { goto } from "$app/navigation";

  let calories = $state(nutritionStore.macroTargets.calories);
  let protein_g = $state(nutritionStore.macroTargets.protein_g);
  let carbs_g = $state(nutritionStore.macroTargets.carbs_g);
  let fat_g = $state(nutritionStore.macroTargets.fat_g);
  let water_ml = $state(nutritionStore.macroTargets.water_ml);

  // Keto Calculator inputs
  let weight_kg = $state(83.7);
  let body_fat_pct = $state(25);
  let height_cm = $state(183);
  let age_years = $state(43);
  let sex = $state<"male" | "female">("male");
  let activity_level = $state<"sedentary" | "light" | "moderate" | "active">(
    "light",
  );
  let goal = $state<"maintain" | "slow" | "moderate" | "aggressive">(
    "moderate",
  );
  let keto_strictness = $state<"strict" | "standard" | "liberal">("standard");
  let protein_goal = $state<"maintain" | "build">("build");

  // Carb limits by strictness
  const carbLimits = { strict: 20, standard: 30, liberal: 50 };
  // Protein ratios: maintain muscle vs build muscle (g per kg LBM)
  const proteinRatios = { maintain: 1.6, build: 2.0 };

  const carb_limit = $derived(carbLimits[keto_strictness]);
  const protein_per_lbm = $derived(proteinRatios[protein_goal]);

  // Activity multipliers
  const activityMultipliers = {
    sedentary: 1.2, // desk job, no exercise
    light: 1.375, // light exercise 1-3 days/week
    moderate: 1.55, // moderate exercise 3-5 days/week
    active: 1.725, // hard exercise 6-7 days/week
  };

  // Deficit percentages
  const deficitPcts = {
    maintain: 0,
    slow: 0.15, // 15% deficit (~0.25-0.5 kg/week)
    moderate: 0.25, // 25% deficit (~0.5-0.75 kg/week)
    aggressive: 0.35, // 35% deficit (~0.75-1 kg/week)
  };

  // Calculated values
  const leanBodyMass = $derived(weight_kg * (1 - body_fat_pct / 100));

  // Mifflin-St Jeor BMR
  const bmr = $derived(
    sex === "male"
      ? 10 * weight_kg + 6.25 * height_cm - 5 * age_years + 5
      : 10 * weight_kg + 6.25 * height_cm - 5 * age_years - 161,
  );

  const tdee = $derived(Math.round(bmr * activityMultipliers[activity_level]));
  const deficit = $derived(Math.round(tdee * deficitPcts[goal]));
  const targetCalories = $derived(tdee - deficit);

  // Keto macros
  const calcProtein = $derived(Math.round(leanBodyMass * protein_per_lbm));
  const calcCarbs = $derived(carb_limit);
  const proteinCals = $derived(calcProtein * 4);
  const carbCals = $derived(calcCarbs * 4);
  const fatCals = $derived(
    Math.max(0, targetCalories - proteinCals - carbCals),
  );
  const calcFat = $derived(Math.round(fatCals / 9));

  // Weight loss projection
  const weeklyDeficit = $derived(deficit * 7);
  const weeklyLossKg = $derived(weeklyDeficit / 7700); // 7700 kcal per kg body fat

  function applyCalculated() {
    calories = targetCalories;
    protein_g = calcProtein;
    carbs_g = calcCarbs;
    fat_g = calcFat;
  }

  function save() {
    nutritionStore.setTargets({
      calories,
      protein_g,
      carbs_g,
      fat_g,
      water_ml,
    });
    goto("/food");
  }

  // Load latest weight from store if available
  $effect(() => {
    const latest = nutritionStore.weightLog[0];
    if (latest) {
      weight_kg = latest.weight_kg;
      if (latest.body_fat_pct) body_fat_pct = latest.body_fat_pct;
    }
  });
</script>

<svelte:head>
  <title>Macro Targets</title>
</svelte:head>

<div class="p-4 space-y-6">
  <div class="flex items-center gap-3">
    <button class="text-slate-400 text-2xl" onclick={() => goto("/food")}
      >‹</button
    >
    <h1 class="text-lg font-bold">Daily Targets</h1>
  </div>

  <!-- Keto Calculator -->
  <div class="card space-y-4">
    <h2 class="font-semibold text-slate-200 flex items-center gap-2">
      <span>🥑</span> Keto Calculator
    </h2>

    <div class="grid grid-cols-2 gap-3">
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Weight (kg)</span>
        <input
          type="number"
          step="0.1"
          bind:value={weight_kg}
          class="input w-full"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Body Fat (%)</span>
        <input
          type="number"
          step="0.1"
          bind:value={body_fat_pct}
          class="input w-full"
        />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Height (cm)</span>
        <input type="number" bind:value={height_cm} class="input w-full" />
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Age</span>
        <input type="number" bind:value={age_years} class="input w-full" />
      </label>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Sex</span>
        <select bind:value={sex} class="input w-full">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Activity</span>
        <select bind:value={activity_level} class="input w-full">
          <option value="sedentary">Sedentary</option>
          <option value="light">Light (1-3x/wk)</option>
          <option value="moderate">Moderate (3-5x/wk)</option>
          <option value="active">Active (6-7x/wk)</option>
        </select>
      </label>
    </div>

    <label class="block space-y-1">
      <span class="text-xs text-slate-400">Goal</span>
      <select bind:value={goal} class="input w-full">
        <option value="maintain">Maintain Weight</option>
        <option value="slow">Slow Loss (~0.25-0.5 kg/wk)</option>
        <option value="moderate">Moderate Loss (~0.5-0.75 kg/wk)</option>
        <option value="aggressive">Aggressive Loss (~0.75-1 kg/wk)</option>
      </select>
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Keto Strictness</span>
        <select bind:value={keto_strictness} class="input w-full">
          <option value="strict">Strict (20g carbs)</option>
          <option value="standard">Standard (30g carbs)</option>
          <option value="liberal">Liberal (50g carbs)</option>
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-xs text-slate-400">Protein Goal</span>
        <select bind:value={protein_goal} class="input w-full">
          <option value="maintain">Maintain (1.6g/kg)</option>
          <option value="build">Build Muscle (2.0g/kg)</option>
        </select>
      </label>
    </div>

    <!-- Results -->
    <div class="bg-slate-700/50 rounded-lg p-3 space-y-2">
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="text-slate-400">Lean Body Mass:</div>
        <div class="text-slate-200 font-mono">{leanBodyMass.toFixed(1)} kg</div>

        <div class="text-slate-400">BMR:</div>
        <div class="text-slate-200 font-mono">{Math.round(bmr)} kcal</div>

        <div class="text-slate-400">TDEE:</div>
        <div class="text-slate-200 font-mono">{tdee} kcal</div>

        <div class="text-slate-400">Deficit:</div>
        <div class="text-red-400 font-mono">-{deficit} kcal</div>
      </div>

      <div class="border-t border-slate-600 pt-2 mt-2">
        <div class="grid grid-cols-4 gap-2 text-center">
          <div>
            <div class="text-lg font-bold text-blue-400">{targetCalories}</div>
            <div class="text-xs text-slate-500">kcal</div>
          </div>
          <div>
            <div class="text-lg font-bold text-green-400">{calcProtein}g</div>
            <div class="text-xs text-slate-500">protein</div>
          </div>
          <div>
            <div class="text-lg font-bold text-yellow-400">{calcCarbs}g</div>
            <div class="text-xs text-slate-500">carbs</div>
          </div>
          <div>
            <div class="text-lg font-bold text-orange-400">{calcFat}g</div>
            <div class="text-xs text-slate-500">fat</div>
          </div>
        </div>
      </div>

      {#if goal !== "maintain"}
        <div class="text-xs text-slate-500 text-center pt-1">
          Est. loss: ~{weeklyLossKg.toFixed(2)} kg/week
        </div>
      {/if}
    </div>

    <button
      class="btn bg-slate-600 hover:bg-slate-500 w-full"
      onclick={applyCalculated}
    >
      Apply These Values ↓
    </button>
  </div>

  <!-- Current Targets -->
  <div class="card space-y-4">
    <h2 class="font-semibold text-slate-200">Current Targets</h2>

    <label class="block space-y-1">
      <span class="text-sm text-slate-400">Calories (kcal)</span>
      <input type="number" bind:value={calories} class="input w-full" />
    </label>
    <label class="block space-y-1">
      <span class="text-sm text-slate-400">Protein (g)</span>
      <input type="number" bind:value={protein_g} class="input w-full" />
    </label>
    <label class="block space-y-1">
      <span class="text-sm text-slate-400">Carbs (g)</span>
      <input type="number" bind:value={carbs_g} class="input w-full" />
    </label>
    <label class="block space-y-1">
      <span class="text-sm text-slate-400">Fat (g)</span>
      <input type="number" bind:value={fat_g} class="input w-full" />
    </label>
    <label class="block space-y-1">
      <span class="text-sm text-slate-400">Water (ml)</span>
      <input
        type="number"
        bind:value={water_ml}
        step="100"
        class="input w-full"
      />
    </label>

    <!-- Macro breakdown -->
    <div class="bg-slate-700/50 rounded-lg p-3 text-sm">
      <div class="flex justify-between text-slate-400">
        <span
          >Protein: {protein_g * 4} kcal ({Math.round(
            ((protein_g * 4) / calories) * 100,
          )}%)</span
        >
        <span
          >Carbs: {carbs_g * 4} kcal ({Math.round(
            ((carbs_g * 4) / calories) * 100,
          )}%)</span
        >
        <span
          >Fat: {fat_g * 9} kcal ({Math.round(
            ((fat_g * 9) / calories) * 100,
          )}%)</span
        >
      </div>
      <div class="text-xs text-slate-500 mt-1">
        Total: {protein_g * 4 + carbs_g * 4 + fat_g * 9} kcal
      </div>
    </div>

    <button class="btn btn-success w-full py-3" onclick={save}>
      Save Targets
    </button>
  </div>
</div>
