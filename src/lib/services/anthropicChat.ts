import { nutritionStore } from "$lib/stores/nutrition.svelte";
import type { Recipe } from "$lib/types";

const API_KEY_STORAGE = "anthropic-api-key";

export function getApiKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(API_KEY_STORAGE);
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolQuery?: string;
  toolResult?: string;
}

const USDA_API_KEY = "YE2tfUyd991OkBkWHs9zWy8fxpk6aZUco0N2K43J";
const USDA_PROXY_URL =
  "https://xfkgbyczaufejklwjrfz.supabase.co/functions/v1/usda-proxy";
const USDA_PROXY_KEY = "usda-proxy-enabled";

export function isUsdaProxyEnabled(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(USDA_PROXY_KEY) === "true";
}

export function setUsdaProxy(enabled: boolean) {
  localStorage.setItem(USDA_PROXY_KEY, String(enabled));
}

async function searchUSDA(query: string): Promise<string> {
  let res: Response;
  if (isUsdaProxyEnabled()) {
    res = await fetch(USDA_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
  } else {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=5&dataType=Survey%20(FNDDS),SR%20Legacy`;
    res = await fetch(url);
  }
  if (!res.ok) return `USDA API error: ${res.status}`;
  const data = await res.json();
  if (!data.foods?.length) return `No results found for "${query}".`;

  return data.foods
    .map((f: any) => {
      const nutrients: Record<string, number> = {};
      for (const n of f.foodNutrients || []) {
        if (n.nutrientName === "Energy") nutrients.calories = n.value;
        if (n.nutrientName === "Protein") nutrients.protein_g = n.value;
        if (n.nutrientName === "Carbohydrate, by difference")
          nutrients.carbs_g = n.value;
        if (n.nutrientName === "Total lipid (fat)") nutrients.fat_g = n.value;
        if (n.nutrientName === "Fiber, total dietary")
          nutrients.fiber_g = n.value;
      }
      return `${f.description} (per 100g): ${nutrients.calories ?? "?"} kcal, ${nutrients.protein_g ?? "?"}g protein, ${nutrients.carbs_g ?? "?"}g carbs (${nutrients.fiber_g ?? "?"}g fiber), ${nutrients.fat_g ?? "?"}g fat`;
    })
    .join("\n");
}

const tools = [
  {
    name: "search_food_nutrition",
    description:
      "Search the USDA FoodData Central database for accurate nutritional values of a food. Always use this before creating recipes or logging food to get accurate data. Returns per-100g values.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            'Food name to search for (e.g. "greek yogurt", "chicken breast", "white rice")',
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_ingredient",
    description:
      "Create an atomic ingredient with nutritional info per serving. Use this for individual foods like milk, eggs, protein powder, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Ingredient name" },
        calories: { type: "number", description: "Calories per serving" },
        protein_g: { type: "number", description: "Protein grams per serving" },
        carbs_g: { type: "number", description: "Carbs grams per serving" },
        fat_g: { type: "number", description: "Fat grams per serving" },
        fiber_g: {
          type: "number",
          description: "Fiber grams per serving (optional, defaults to 0)",
        },
        serving_size: { type: "number", description: "Serving size amount" },
        serving_unit: {
          type: "string",
          description: "Serving unit (g, ml, piece, etc)",
        },
        notes: { type: "string", description: "Optional notes" },
      },
      required: [
        "name",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "serving_size",
        "serving_unit",
      ],
    },
  },
  {
    name: "edit_ingredient",
    description:
      "Edit an existing ingredient. Use the IDs from the ingredients list in the system context. Only provide the fields you want to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The ingredient ID to edit" },
        name: { type: "string", description: "New name (optional)" },
        calories: {
          type: "number",
          description: "New calories per serving (optional)",
        },
        protein_g: {
          type: "number",
          description: "New protein grams per serving (optional)",
        },
        carbs_g: {
          type: "number",
          description: "New carbs grams per serving (optional)",
        },
        fat_g: {
          type: "number",
          description: "New fat grams per serving (optional)",
        },
        fiber_g: {
          type: "number",
          description: "New fiber grams per serving (optional)",
        },
        serving_size: {
          type: "number",
          description: "New serving size (optional)",
        },
        serving_unit: {
          type: "string",
          description: "New serving unit (optional)",
        },
        notes: { type: "string", description: "New notes (optional)" },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_ingredient",
    description: "Remove an ingredient by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The ingredient ID to remove" },
        name: {
          type: "string",
          description: "The ingredient name (for confirmation message)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_recipe",
    description:
      "Create a composite recipe from existing ingredients. Macros are auto-computed from the ingredients. You must reference ingredient IDs from the ingredients list.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Recipe name" },
        serving_size: { type: "number", description: "Serving size amount" },
        serving_unit: {
          type: "string",
          description: "Serving unit (serving, bowl, shake, etc)",
        },
        notes: { type: "string", description: "Optional notes" },
        ingredients: {
          type: "array",
          description:
            "List of ingredients with quantities. Macros are auto-computed from these.",
          items: {
            type: "object",
            properties: {
              ingredient_id: {
                type: "string",
                description: "Ingredient ID from the ingredients list",
              },
              quantity: { type: "number", description: "Amount of ingredient" },
              quantity_unit: {
                type: "string",
                description: "Unit (g, ml, piece, serving, etc)",
              },
            },
            required: ["ingredient_id", "quantity", "quantity_unit"],
          },
        },
      },
      required: ["name", "serving_size", "serving_unit", "ingredients"],
    },
  },
  {
    name: "remove_recipe",
    description: "Remove a composite recipe by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The recipe ID to remove" },
        name: {
          type: "string",
          description: "The recipe name (for confirmation message)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "log_food",
    description:
      'Log a food entry. Use this when the user wants to log something they ate. If the user mentions a specific time (e.g. "last night", "this morning", "at 9pm"), set the date and time fields accordingly.',
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Food name" },
        servings: { type: "number", description: "Number of servings" },
        calories: { type: "number", description: "Total calories" },
        protein_g: { type: "number", description: "Total protein grams" },
        carbs_g: { type: "number", description: "Total carbs grams" },
        fat_g: { type: "number", description: "Total fat grams" },
        fiber_g: {
          type: "number",
          description: "Total fiber grams (optional, defaults to 0)",
        },
        water_ml: {
          type: "number",
          description:
            "Water content in ml (for beverages like tea, coffee, shakes)",
        },
        date: {
          type: "string",
          description:
            'Date in YYYY-MM-DD format. Only set if the user specifies a different date (e.g. "last night" → yesterday\'s date). Defaults to today.',
        },
        time: {
          type: "string",
          description:
            'Time in HH:MM format (24h). Only set if the user specifies a time (e.g. "at 9pm" → "21:00", "last night" → "21:00"). Defaults to now.',
        },
      },
      required: [
        "name",
        "servings",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
      ],
    },
  },
  {
    name: "edit_food",
    description:
      "Edit an existing food entry. Use the IDs from the food log in the system context. Only provide the fields you want to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The food entry ID to edit" },
        name: { type: "string", description: "New food name (optional)" },
        servings: {
          type: "number",
          description: "New number of servings (optional)",
        },
        calories: {
          type: "number",
          description: "New total calories (optional)",
        },
        protein_g: {
          type: "number",
          description: "New total protein grams (optional)",
        },
        carbs_g: {
          type: "number",
          description: "New total carbs grams (optional)",
        },
        fat_g: {
          type: "number",
          description: "New total fat grams (optional)",
        },
        fiber_g: {
          type: "number",
          description: "New total fiber grams (optional)",
        },
        water_ml: {
          type: "number",
          description: "New water content in ml (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "log_supplement",
    description: "Log a supplement intake.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Supplement name" },
        dose: {
          type: "string",
          description: 'Dosage (e.g. "500mg", "1 capsule")',
        },
        notes: { type: "string", description: "Optional notes" },
      },
      required: ["name"],
    },
  },
  {
    name: "remove_food",
    description:
      "Remove a food entry by its ID. Use the IDs from the food log in the system context.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The food entry ID to remove" },
        name: {
          type: "string",
          description: "The food name (for confirmation message)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "remove_supplement",
    description: "Remove a supplement entry by its ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The supplement entry ID to remove",
        },
        name: {
          type: "string",
          description: "The supplement name (for confirmation message)",
        },
      },
      required: ["id"],
    },
  },
];

function buildSystemPrompt(): string {
  const totals = nutritionStore.todaysTotals;
  const targets = nutritionStore.macroTargets;
  const allRecipes = nutritionStore.recipes;
  const ingredients = allRecipes.filter((r) => !r.ingredients?.length);
  const composites = allRecipes.filter((r) => r.ingredients?.length);
  const todayFood = nutritionStore.foodEntries.filter(
    (e) => e.date === nutritionStore.selectedDate,
  );
  const todaySupps = nutritionStore.supplementEntries.filter(
    (e) => e.date === nutritionStore.selectedDate,
  );
  const window = nutritionStore.feedingWindow;

  return `You are a nutrition assistant. Today is ${nutritionStore.selectedDate}.

The user is on a 20:4 intermittent fasting schedule with a goal of 72kg by June 1st.

Macro targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g net carbs, ${targets.fat_g}g fat, ${targets.water_ml}ml water.

Today's intake so far: ${totals.calories} kcal, ${totals.protein_g}g protein, ${totals.carbs_g}g carbs (${totals.fiber_g}g fiber, ${Math.round(totals.carbs_g - totals.fiber_g)}g net), ${totals.fat_g}g fat, ${totals.water_ml}ml water.

Feeding window: ${window.isOpen ? `Open (closes at ${window.closesAt}, ${window.minutesLeft} min left)` : window.closesAt ? `Closed (was ${window.opensAt}-${window.closesAt})` : "Not started yet"}

Today's food log:
${todayFood.length > 0 ? todayFood.map((e) => `- [id:${e.id}] ${e.name}: ${e.calories} kcal, P${e.protein_g}g C${e.carbs_g}g${e.fiber_g ? ` Fi${e.fiber_g}g` : ""} F${e.fat_g}g${e.water_ml ? ` 💧${e.water_ml}ml` : ""}`).join("\n") : "(empty)"}

Today's supplements:
${todaySupps.length > 0 ? todaySupps.map((e) => `- [id:${e.id}] ${e.name}${e.dose ? ` (${e.dose})` : ""}`).join("\n") : "(none)"}

Available ingredients (atomic foods with nutritional info):
${ingredients.length > 0 ? ingredients.map((r) => `- [id:${r.id}] ${r.name}: ${r.calories} kcal, ${r.protein_g}g P, ${r.carbs_g}g C${r.fiber_g ? ` (${r.fiber_g}g fiber)` : ""}, ${r.fat_g}g F per ${r.serving_size}${r.serving_unit}`).join("\n") : "(none)"}

Recipes (composites made from ingredients):
${
  composites.length > 0
    ? composites
        .map((r) => {
          const ings = r
            .ingredients!.map(
              (i) =>
                `${i.quantity}${i.quantity_unit} ${i.ingredient?.name ?? i.ingredient_id}`,
            )
            .join(" + ");
          return `- [id:${r.id}] ${r.name}: ${r.calories} kcal, ${r.protein_g}g P, ${r.carbs_g}g C${r.fiber_g ? ` (${r.fiber_g}g fiber)` : ""}, ${r.fat_g}g F per ${r.serving_size}${r.serving_unit} (${ings})`;
        })
        .join("\n")
    : "(none)"
}

Ingredients are atomic nutritional building blocks (e.g. milk, eggs). Recipes are composites that reference ingredients by ID — macros are auto-computed. Use create_ingredient for individual foods, create_recipe for combinations.

We track fiber separately. Net carbs = total carbs - fiber. When creating ingredients, always include fiber_g if the food has fiber. USDA search results now include fiber data.

When logging beverages (tea, coffee, shakes, etc.), estimate the water content in ml and include it as water_ml so it counts toward the daily hydration target.

When the user provides nutritional values directly (e.g. from a product label), use those values as-is — do NOT override them with USDA data. Only use the search_food_nutrition tool when the user does NOT provide nutritional info and you need to look it up. USDA data is per 100g — scale to the user's actual serving size.

The current time is ${new Date().toTimeString().slice(0, 5)}. When the user refers to a time like "last night", "this morning", "yesterday", etc., calculate the correct date and time and pass them to the log_food tool. For example, if today is 2025-01-15 and the user says "last night", use date "2025-01-14" and an estimated evening time like "21:00".

Use the USDA database as a reference, but also apply common sense. Real-world portions and home-cooked meals don't always match USDA entries exactly. If the user says "a plate of rice" or "a chicken breast", estimate reasonable real-world portions rather than blindly trusting the first USDA result. Prefer practical accuracy over false precision — round to sensible numbers. Be concise.`;
}

async function handleToolCall(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "search_food_nutrition": {
      return await searchUSDA(input.query as string);
    }
    case "create_ingredient": {
      const ingredient = nutritionStore.addRecipe({
        name: input.name as string,
        calories: input.calories as number,
        protein_g: input.protein_g as number,
        carbs_g: input.carbs_g as number,
        fat_g: input.fat_g as number,
        fiber_g: (input.fiber_g as number) || 0,
        serving_size: input.serving_size as number,
        serving_unit: input.serving_unit as string,
        notes: (input.notes as string) || undefined,
      });
      return `Ingredient "${ingredient.name}" created (${ingredient.calories} kcal, ${ingredient.protein_g}g P, ${ingredient.fiber_g}g fiber per ${ingredient.serving_size}${ingredient.serving_unit}).`;
    }
    case "edit_ingredient": {
      const existing = nutritionStore.recipes.find((r) => r.id === input.id);
      if (!existing) return `Ingredient not found with ID "${input.id}".`;
      const updated = { ...existing };
      if (input.name !== undefined) updated.name = input.name as string;
      if (input.calories !== undefined)
        updated.calories = input.calories as number;
      if (input.protein_g !== undefined)
        updated.protein_g = input.protein_g as number;
      if (input.carbs_g !== undefined)
        updated.carbs_g = input.carbs_g as number;
      if (input.fat_g !== undefined) updated.fat_g = input.fat_g as number;
      if (input.fiber_g !== undefined)
        updated.fiber_g = input.fiber_g as number;
      if (input.serving_size !== undefined)
        updated.serving_size = input.serving_size as number;
      if (input.serving_unit !== undefined)
        updated.serving_unit = input.serving_unit as string;
      if (input.notes !== undefined) updated.notes = input.notes as string;
      nutritionStore.updateRecipe(updated);
      return `Updated ingredient "${updated.name}" (${updated.calories} kcal, ${updated.protein_g}g P, ${updated.carbs_g}g C, ${updated.fiber_g}g fiber, ${updated.fat_g}g F).`;
    }
    case "remove_ingredient": {
      nutritionStore.removeRecipe(input.id as string);
      return `Removed ingredient "${input.name || input.id}".`;
    }
    case "create_recipe": {
      const ingredients = input.ingredients as {
        ingredient_id: string;
        quantity: number;
        quantity_unit: string;
      }[];
      const recipe = nutritionStore.addRecipeWithIngredients(
        {
          name: input.name as string,
          calories: 0,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          serving_size: input.serving_size as number,
          serving_unit: input.serving_unit as string,
          notes: (input.notes as string) || undefined,
        },
        ingredients,
      );
      return `Recipe "${recipe.name}" created (${recipe.calories} kcal, ${recipe.protein_g}g P, ${recipe.carbs_g}g C, ${recipe.fat_g}g F) from ${ingredients.length} ingredients.`;
    }
    case "log_food": {
      const entry = nutritionStore.addFood({
        name: input.name as string,
        servings: input.servings as number,
        calories: input.calories as number,
        protein_g: input.protein_g as number,
        carbs_g: input.carbs_g as number,
        fat_g: input.fat_g as number,
        fiber_g: (input.fiber_g as number) || 0,
        water_ml: (input.water_ml as number) || 0,
        ...(input.date ? { date: input.date as string } : {}),
        ...(input.time ? { time: input.time as string } : {}),
      });
      return `Logged "${entry.name}" (${entry.calories} kcal) at ${entry.time} on ${entry.date}.`;
    }
    case "edit_food": {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.servings !== undefined) updates.servings = input.servings;
      if (input.calories !== undefined) updates.calories = input.calories;
      if (input.protein_g !== undefined) updates.protein_g = input.protein_g;
      if (input.carbs_g !== undefined) updates.carbs_g = input.carbs_g;
      if (input.fat_g !== undefined) updates.fat_g = input.fat_g;
      if (input.fiber_g !== undefined) updates.fiber_g = input.fiber_g;
      if (input.water_ml !== undefined) updates.water_ml = input.water_ml;
      const entry = nutritionStore.updateFood(input.id as string, updates);
      if (!entry) return `Food entry not found with ID "${input.id}".`;
      return `Updated "${entry.name}" (${entry.calories} kcal, ${entry.protein_g}g P, ${entry.carbs_g}g C, ${entry.fiber_g}g fiber, ${entry.fat_g}g F).`;
    }
    case "log_supplement": {
      const entry = nutritionStore.addSupplement({
        name: input.name as string,
        dose: (input.dose as string) || null,
        notes: (input.notes as string) || null,
      });
      return `Logged supplement "${entry.name}".`;
    }
    case "remove_food": {
      nutritionStore.removeFood(input.id as string);
      return `Removed food entry "${input.name || input.id}".`;
    }
    case "remove_supplement": {
      nutritionStore.removeSupplement(input.id as string);
      return `Removed supplement "${input.name || input.id}".`;
    }
    case "remove_recipe": {
      nutritionStore.removeRecipe(input.id as string);
      return `Removed recipe "${input.name || input.id}".`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export const DEFAULT_CHAT_MODEL = "claude-sonnet-4-5-20250929";

export async function sendMessage(
  messages: ChatMessage[],
  apiKey: string,
  onChunk: (text: string) => void,
  onToolCall?: (toolName: string, query: string, result: string) => void,
  model?: string,
): Promise<{ text: string; toolResults: string[] }> {
  const apiMessages = messages
    .filter((m) => m.role !== "tool")
    .map((m) => ({ role: m.role, content: m.content }));
  const toolResults: string[] = [];
  let fullText = "";

  // Loop to handle tool use -> tool result cycles (max 10 rounds)
  let done = false;
  let rounds = 0;
  const MAX_ROUNDS = 10;
  while (!done && rounds < MAX_ROUNDS) {
    rounds++;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: model || DEFAULT_CHAT_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        tools,
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error ${res.status}: ${err}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let pendingTools: { id: string; name: string; input: string }[] = [];
    let currentToolIdx = -1;
    let contentBlocks: any[] = [];
    let stopReason = "";

    while (true) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "content_block_start") {
            if (event.content_block?.type === "tool_use") {
              currentToolIdx = pendingTools.length;
              pendingTools.push({
                id: event.content_block.id,
                name: event.content_block.name,
                input: "",
              });
            } else if (event.content_block?.type === "text") {
              currentToolIdx = -1;
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta") {
              fullText += event.delta.text;
              onChunk(event.delta.text);
            } else if (
              event.delta?.type === "input_json_delta" &&
              currentToolIdx >= 0
            ) {
              pendingTools[currentToolIdx].input += event.delta.partial_json;
            }
          } else if (event.type === "message_delta") {
            stopReason = event.delta?.stop_reason || "";
          }
        } catch {}
      }
    }

    if (pendingTools.length > 0 && stopReason === "tool_use") {
      // Build assistant content blocks
      const assistantContent: any[] = [];
      if (fullText) assistantContent.push({ type: "text", text: fullText });
      for (const tool of pendingTools) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tool.input);
        } catch {}
        assistantContent.push({
          type: "tool_use",
          id: tool.id,
          name: tool.name,
          input: parsed,
        });
      }
      apiMessages.push({ role: "assistant", content: assistantContent });

      // Execute all tools and send results
      const toolResultBlocks: any[] = [];
      for (const tool of pendingTools) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tool.input);
        } catch {}
        const result = await handleToolCall(tool.name, parsed);
        const queryStr =
          tool.name === "search_food_nutrition"
            ? (parsed.query as string) || ""
            : JSON.stringify(parsed, null, 2);
        onToolCall?.(tool.name, queryStr, result);
        if (tool.name !== "search_food_nutrition") toolResults.push(result);
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: result,
        });
      }
      apiMessages.push({ role: "user", content: toolResultBlocks });
    } else {
      done = true;
    }
  }

  return { text: fullText, toolResults };
}
