vi.mock("$lib/stores/nutrition.svelte", () => ({
  nutritionStore: {
    todaysTotals: {
      calories: 500,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 20,
      fiber_g: 5,
      water_ml: 1000,
    },
    macroTargets: {
      calories: 2000,
      protein_g: 100,
      carbs_g: 200,
      fat_g: 80,
      water_ml: 3000,
    },
    recipes: [],
    foodEntries: [],
    supplementEntries: [],
    selectedDate: "2025-01-15",
    feedingWindow: {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      minutesLeft: 0,
    },
    addRecipe: vi.fn((data: any) => ({ id: "new-id", ...data })),
    addRecipeWithIngredients: vi.fn((data: any) => ({ id: "new-id", ...data })),
    updateRecipe: vi.fn(),
    removeRecipe: vi.fn(),
    addFood: vi.fn((data: any) => ({ id: "food-1", ...data })),
    updateFood: vi.fn((_id: string, _updates: any) => ({
      id: _id,
      name: "Updated",
      calories: 300,
      protein_g: 30,
      carbs_g: 20,
      fiber_g: 2,
      fat_g: 10,
    })),
    removeFood: vi.fn(),
    addSupplement: vi.fn((data: any) => ({ id: "supp-1", ...data })),
    removeSupplement: vi.fn(),
  },
}));

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getApiKey,
  setApiKey,
  isUsdaProxyEnabled,
  setUsdaProxy,
  sendMessage,
  DEFAULT_CHAT_MODEL,
} from "$lib/services/anthropicChat";
import { nutritionStore } from "$lib/stores/nutrition.svelte";

// We test the pure localStorage functions, not the streaming/tool-call portions
// which require full nutritionStore and fetch mocking

beforeEach(() => {
  localStorage.clear();
});

describe("getApiKey / setApiKey", () => {
  it("returns null when no key is set", () => {
    expect(getApiKey()).toBeNull();
  });

  it("stores and retrieves API key", () => {
    setApiKey("sk-test-123");
    expect(getApiKey()).toBe("sk-test-123");
  });

  it("overwrites existing key", () => {
    setApiKey("sk-first");
    setApiKey("sk-second");
    expect(getApiKey()).toBe("sk-second");
  });
});

describe("isUsdaProxyEnabled / setUsdaProxy", () => {
  it("returns false by default", () => {
    expect(isUsdaProxyEnabled()).toBe(false);
  });

  it("enables proxy", () => {
    setUsdaProxy(true);
    expect(isUsdaProxyEnabled()).toBe(true);
  });

  it("disables proxy", () => {
    setUsdaProxy(true);
    setUsdaProxy(false);
    expect(isUsdaProxyEnabled()).toBe(false);
  });
});

describe("DEFAULT_CHAT_MODEL", () => {
  it("exports sonnet as default", () => {
    expect(DEFAULT_CHAT_MODEL).toBe("claude-sonnet-4-5-20250929");
  });
});

// ── Helpers ──

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const data = events.map((e) => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

function toolUseStream(
  toolId: string,
  toolName: string,
  inputJson: Record<string, unknown>,
) {
  return createSSEStream([
    JSON.stringify({
      type: "content_block_start",
      content_block: { type: "tool_use", id: toolId, name: toolName },
    }),
    JSON.stringify({
      type: "content_block_delta",
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify(inputJson),
      },
    }),
    JSON.stringify({
      type: "message_delta",
      delta: { stop_reason: "tool_use" },
    }),
  ]);
}

function textStream(text: string) {
  return createSSEStream([
    JSON.stringify({
      type: "content_block_start",
      content_block: { type: "text" },
    }),
    JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text },
    }),
    JSON.stringify({
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
    }),
  ]);
}

// ── sendMessage tests ──

describe("sendMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends message and returns text response", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello!" },
        }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    const result = await sendMessage(
      [{ role: "user", content: "Hi" }],
      "test-key",
      onChunk,
    );

    expect(result.text).toBe("Hello!");
    expect(onChunk).toHaveBeenCalledWith("Hello!");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // default model
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe(DEFAULT_CHAT_MODEL);
  });

  it("uses custom model when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi" },
        }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "Hi" }],
      "key",
      vi.fn(),
      undefined,
      "claude-opus-4-6",
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("claude-opus-4-6");
  });

  it("throws on API error", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      sendMessage([{ role: "user", content: "Hi" }], "bad-key", vi.fn()),
    ).rejects.toThrow("API error 401");
  });

  it("handles tool use cycle", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "tool_use", id: "tool-1", name: "log_food" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json:
                '{"name":"chicken","servings":1,"calories":250,"protein_g":40,"carbs_g":0,"fat_g":8}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Logged it!" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onChunk = vi.fn();
    const onToolCall = vi.fn();
    const result = await sendMessage(
      [{ role: "user", content: "Log chicken" }],
      "test-key",
      onChunk,
      onToolCall,
    );

    expect(result.text).toBe("Logged it!");
    expect(onToolCall).toHaveBeenCalled();
    expect(result.toolResults.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles search_food_nutrition tool", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-1",
              name: "search_food_nutrition",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"query":"chicken breast"}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      // USDA API call
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                description: "Chicken breast",
                foodNutrients: [
                  { nutrientName: "Energy", value: 165 },
                  { nutrientName: "Protein", value: 31 },
                  { nutrientName: "Carbohydrate, by difference", value: 0 },
                  { nutrientName: "Total lipid (fat)", value: 3.6 },
                  { nutrientName: "Fiber, total dietary", value: 0 },
                ],
              },
            ],
          }),
      })
      // Second Anthropic call after tool result
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Found it" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "Search chicken" }],
      "test-key",
      vi.fn(),
      vi.fn(),
    );
    expect(result.text).toBe("Found it");
    // searchUSDA results should NOT be in toolResults (only non-search tools go there)
  });

  it("filters out tool messages from API messages", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "OK" },
        }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const messages = [
      { role: "user" as const, content: "Hi" },
      { role: "tool" as const, content: "tool result", toolName: "test" },
    ];
    await sendMessage(messages, "test-key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Tool messages should be filtered out
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
  });

  it("handles USDA API error gracefully", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-1",
              name: "search_food_nutrition",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"query":"xyz"}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      // USDA API returns error
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      // Follow-up Anthropic call
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Error" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );
    // The tool call should report the error
    expect(onToolCall).toHaveBeenCalled();
  });

  it("uses USDA proxy when enabled", async () => {
    localStorage.setItem("usda-proxy-enabled", "true");

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("tool-1", "search_food_nutrition", {
          query: "rice",
        }),
      })
      // Proxy call
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                description: "Rice",
                foodNutrients: [{ nutrientName: "Energy", value: 130 }],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Done"),
      });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    // Second call should be to the proxy URL (POST method)
    const proxyCall = mockFetch.mock.calls[1];
    expect(proxyCall[0]).toContain("supabase");
    expect(proxyCall[1].method).toBe("POST");
    expect(proxyCall[1].headers["Content-Type"]).toBe("application/json");
    const proxyBody = JSON.parse(proxyCall[1].body);
    expect(proxyBody.query).toBe("rice");
  });

  it("includes composites in system prompt when recipes have ingredients", async () => {
    // Temporarily add recipes with ingredients to the mock
    const originalRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "r1",
        name: "Oatmeal Bowl",
        calories: 300,
        protein_g: 10,
        carbs_g: 50,
        fat_g: 5,
        fiber_g: 8,
        serving_size: 1,
        serving_unit: "bowl",
        ingredients: [
          {
            id: "ri1",
            recipe_id: "r1",
            ingredient_id: "i1",
            quantity: 100,
            quantity_unit: "g",
            ingredient: { name: "Oats" },
          },
        ],
      },
    ];

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: textStream("OK"),
    });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    // Check that the system prompt includes the composite recipe and its ingredients
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Oatmeal Bowl");
    expect(body.system).toContain("Oats");

    // Restore
    (nutritionStore as any).recipes = originalRecipes;
  });

  it("handles tool use without preceding text block", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          // No text block - directly tool_use
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "tool_use", id: "tool-1", name: "log_food" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json:
                '{"name":"rice","servings":1,"calories":200,"protein_g":4,"carbs_g":45,"fat_g":1}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Done" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "log" }],
      "key",
      vi.fn(),
      vi.fn(),
    );
    expect(result.text).toBe("Done");
    expect(result.toolResults.length).toBeGreaterThan(0);
  });

  it("handles search_food_nutrition with missing query field", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-1",
              name: "search_food_nutrition",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "input_json_delta", partial_json: "{}" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      // USDA API call with empty query
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ foods: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "No results" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    const result = await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );
    expect(result.text).toBe("No results");
    // onToolCall should be called with empty string for query (|| '' fallback)
    expect(onToolCall).toHaveBeenCalledWith(
      "search_food_nutrition",
      "",
      expect.any(String),
    );
  });

  it("handles USDA no results", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-1",
              name: "search_food_nutrition",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"query":"nonexistent"}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ foods: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Not found" },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
          }),
        ]),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );
    expect(onToolCall).toHaveBeenCalled();
  });
});

// ── Tool handler tests via sendMessage ──

describe("tool handlers via sendMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(nutritionStore.addRecipe).mockClear();
    vi.mocked(nutritionStore.addRecipeWithIngredients).mockClear();
    vi.mocked(nutritionStore.updateRecipe).mockClear();
    vi.mocked(nutritionStore.removeRecipe).mockClear();
    vi.mocked(nutritionStore.addFood).mockClear();
    vi.mocked(nutritionStore.updateFood).mockClear();
    vi.mocked(nutritionStore.removeFood).mockClear();
    vi.mocked(nutritionStore.addSupplement).mockClear();
    vi.mocked(nutritionStore.removeSupplement).mockClear();
  });

  describe("create_ingredient", () => {
    it("calls addRecipe with ingredient data", async () => {
      const input = {
        name: "Milk",
        calories: 60,
        protein_g: 3,
        carbs_g: 5,
        fat_g: 3,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "ml",
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "create_ingredient", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Created!") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "create milk" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.addRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Milk",
          calories: 60,
          protein_g: 3,
          carbs_g: 5,
          fat_g: 3,
          fiber_g: 0,
          serving_size: 100,
          serving_unit: "ml",
        }),
      );
      expect(onToolCall).toHaveBeenCalledWith(
        "create_ingredient",
        expect.any(String),
        expect.stringContaining("Milk"),
      );
    });
  });

  describe("edit_ingredient", () => {
    it("returns not found when ingredient does not exist", async () => {
      const input = { id: "nonexistent", calories: 100 };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "edit_ingredient", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Not found") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "edit ingredient" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(onToolCall).toHaveBeenCalledWith(
        "edit_ingredient",
        expect.any(String),
        expect.stringContaining("not found"),
      );
    });

    it("updates ingredient when found", async () => {
      // Temporarily add a recipe to the mock store
      const originalRecipes = nutritionStore.recipes;
      (nutritionStore as any).recipes = [
        {
          id: "ing-1",
          name: "Egg",
          calories: 70,
          protein_g: 6,
          carbs_g: 1,
          fat_g: 5,
          fiber_g: 0,
          serving_size: 1,
          serving_unit: "piece",
        },
      ];

      const input = { id: "ing-1", calories: 80, protein_g: 7 };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "edit_ingredient", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Updated") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "edit egg" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "ing-1",
          calories: 80,
          protein_g: 7,
        }),
      );
      expect(onToolCall).toHaveBeenCalledWith(
        "edit_ingredient",
        expect.any(String),
        expect.stringContaining("Updated"),
      );

      // Restore
      (nutritionStore as any).recipes = originalRecipes;
    });
  });

  describe("remove_ingredient", () => {
    it("calls removeRecipe with the given id", async () => {
      const input = { id: "ing-1", name: "Egg" };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "remove_ingredient", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Removed") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "remove egg" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.removeRecipe).toHaveBeenCalledWith("ing-1");
      expect(onToolCall).toHaveBeenCalledWith(
        "remove_ingredient",
        expect.any(String),
        expect.stringContaining("Removed"),
      );
    });
  });

  describe("create_recipe", () => {
    it("calls addRecipeWithIngredients", async () => {
      const input = {
        name: "Protein Shake",
        serving_size: 1,
        serving_unit: "shake",
        ingredients: [
          { ingredient_id: "ing-1", quantity: 200, quantity_unit: "ml" },
          { ingredient_id: "ing-2", quantity: 1, quantity_unit: "scoop" },
        ],
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "create_recipe", input),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: textStream("Recipe created"),
        });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "create shake recipe" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.addRecipeWithIngredients).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Protein Shake",
          serving_size: 1,
          serving_unit: "shake",
        }),
        expect.arrayContaining([
          expect.objectContaining({
            ingredient_id: "ing-1",
            quantity: 200,
            quantity_unit: "ml",
          }),
        ]),
      );
      expect(onToolCall).toHaveBeenCalledWith(
        "create_recipe",
        expect.any(String),
        expect.stringContaining("Protein Shake"),
      );
    });
  });

  describe("remove_recipe", () => {
    it("calls removeRecipe with the recipe id", async () => {
      const input = { id: "rec-1", name: "Shake" };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "remove_recipe", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Removed") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "remove shake" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.removeRecipe).toHaveBeenCalledWith("rec-1");
      expect(onToolCall).toHaveBeenCalledWith(
        "remove_recipe",
        expect.any(String),
        expect.stringContaining("Removed"),
      );
    });
  });

  describe("edit_food", () => {
    it("calls updateFood with the given updates", async () => {
      const input = { id: "food-1", calories: 300, protein_g: 30 };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "edit_food", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Updated") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "edit food" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.updateFood).toHaveBeenCalledWith(
        "food-1",
        expect.objectContaining({
          calories: 300,
          protein_g: 30,
        }),
      );
      expect(onToolCall).toHaveBeenCalledWith(
        "edit_food",
        expect.any(String),
        expect.stringContaining("Updated"),
      );
    });

    it("handles food not found", async () => {
      vi.mocked(nutritionStore.updateFood).mockReturnValueOnce(null as any);

      const input = { id: "missing", calories: 100 };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "edit_food", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Not found") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "edit food" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(onToolCall).toHaveBeenCalledWith(
        "edit_food",
        expect.any(String),
        expect.stringContaining("not found"),
      );
    });
  });

  describe("log_supplement", () => {
    it("calls addSupplement with the data", async () => {
      const input = { name: "Vitamin D", dose: "5000IU", notes: "morning" };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "log_supplement", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Logged") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "log vitamin d" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.addSupplement).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Vitamin D",
          dose: "5000IU",
          notes: "morning",
        }),
      );
      expect(onToolCall).toHaveBeenCalledWith(
        "log_supplement",
        expect.any(String),
        expect.stringContaining("Vitamin D"),
      );
    });
  });

  describe("remove_food", () => {
    it("calls removeFood with the given id", async () => {
      const input = { id: "food-1", name: "Chicken" };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "remove_food", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Removed") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "remove chicken" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.removeFood).toHaveBeenCalledWith("food-1");
      expect(onToolCall).toHaveBeenCalledWith(
        "remove_food",
        expect.any(String),
        expect.stringContaining("Removed"),
      );
    });
  });

  describe("remove_supplement", () => {
    it("calls removeSupplement with the given id", async () => {
      const input = { id: "supp-1", name: "Vitamin D" };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: toolUseStream("t1", "remove_supplement", input),
        })
        .mockResolvedValueOnce({ ok: true, body: textStream("Removed") });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "remove supplement" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(nutritionStore.removeSupplement).toHaveBeenCalledWith("supp-1");
      expect(onToolCall).toHaveBeenCalledWith(
        "remove_supplement",
        expect.any(String),
        expect.stringContaining("Removed"),
      );
    });
  });

  describe("unknown tool", () => {
    it("returns unknown tool message", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            JSON.stringify({
              type: "content_block_start",
              content_block: {
                type: "tool_use",
                id: "t1",
                name: "nonexistent_tool",
              },
            }),
            JSON.stringify({
              type: "content_block_delta",
              delta: { type: "input_json_delta", partial_json: "{}" },
            }),
            JSON.stringify({
              type: "message_delta",
              delta: { stop_reason: "tool_use" },
            }),
          ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          body: textStream("I do not know that tool"),
        });
      vi.stubGlobal("fetch", mockFetch);

      const onToolCall = vi.fn();
      await sendMessage(
        [{ role: "user", content: "do something" }],
        "key",
        vi.fn(),
        onToolCall,
      );

      expect(onToolCall).toHaveBeenCalledWith(
        "nonexistent_tool",
        expect.any(String),
        expect.stringContaining("Unknown tool"),
      );
    });
  });
});

// ── SSR environment tests ──

describe("SSR environment (localStorage undefined)", () => {
  it("getApiKey returns null when localStorage is undefined", async () => {
    const origLS = globalThis.localStorage;
    // @ts-ignore
    delete globalThis.localStorage;
    vi.resetModules();
    const { getApiKey } = await import("$lib/services/anthropicChat");
    expect(getApiKey()).toBeNull();
    globalThis.localStorage = origLS;
  });

  it("isUsdaProxyEnabled returns false when localStorage is undefined", async () => {
    const origLS = globalThis.localStorage;
    // @ts-ignore
    delete globalThis.localStorage;
    vi.resetModules();
    const { isUsdaProxyEnabled } = await import("$lib/services/anthropicChat");
    expect(isUsdaProxyEnabled()).toBe(false);
    globalThis.localStorage = origLS;
  });
});

// ── searchUSDA edge cases ──

describe("searchUSDA edge cases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns no results message when foods array is empty", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "search_food_nutrition", {
          query: "nonexistent_food_xyz",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ foods: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("No results"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "search_food_nutrition",
      "nonexistent_food_xyz",
      expect.stringContaining("No results found"),
    );
  });

  it("returns no results when foods property is missing entirely", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "search_food_nutrition", {
          query: "missing_foods",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Nothing"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "search_food_nutrition",
      "missing_foods",
      expect.stringContaining("No results found"),
    );
  });

  it("uses ? fallback when nutrients are missing from USDA response", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "search_food_nutrition", {
          query: "mystery food",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                description: "Mystery Food",
                foodNutrients: [], // No nutrients at all
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Here it is"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    // All nutrients should show '?' fallback
    const resultStr = onToolCall.mock.calls[0][2];
    expect(resultStr).toContain("? kcal");
    expect(resultStr).toContain("?g protein");
    expect(resultStr).toContain("?g carbs");
    expect(resultStr).toContain("?g fiber");
    expect(resultStr).toContain("?g fat");
  });

  it("uses ? fallback for only missing nutrients (partial nutrients)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "search_food_nutrition", {
          query: "partial food",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                description: "Partial Food",
                foodNutrients: [
                  { nutrientName: "Energy", value: 100 },
                  { nutrientName: "Protein", value: 10 },
                  // Missing: carbs, fat, fiber
                ],
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Partial result"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    const resultStr = onToolCall.mock.calls[0][2];
    expect(resultStr).toContain("100 kcal");
    expect(resultStr).toContain("10g protein");
    expect(resultStr).toContain("?g carbs");
    expect(resultStr).toContain("?g fiber");
    expect(resultStr).toContain("?g fat");
  });

  it("handles food with no foodNutrients property", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "search_food_nutrition", {
          query: "weird food",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            foods: [
              {
                description: "Weird Food",
                // No foodNutrients property at all
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Weird"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "search" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    const resultStr = onToolCall.mock.calls[0][2];
    expect(resultStr).toContain("Weird Food");
    expect(resultStr).toContain("? kcal");
  });
});

// ── buildSystemPrompt conditional branches ──

describe("buildSystemPrompt conditional branches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders open feeding window text", async () => {
    const orig = { ...nutritionStore.feedingWindow };
    (nutritionStore as any).feedingWindow = {
      isOpen: true,
      opensAt: "12:00",
      closesAt: "16:00",
      minutesLeft: 120,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Open (closes at 16:00, 120 min left)");

    (nutritionStore as any).feedingWindow = orig;
  });

  it("renders closed feeding window text with times", async () => {
    const orig = { ...nutritionStore.feedingWindow };
    (nutritionStore as any).feedingWindow = {
      isOpen: false,
      opensAt: "12:00",
      closesAt: "16:00",
      minutesLeft: 0,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Closed (was 12:00-16:00)");

    (nutritionStore as any).feedingWindow = orig;
  });

  it("renders not started feeding window text", async () => {
    const orig = { ...nutritionStore.feedingWindow };
    (nutritionStore as any).feedingWindow = {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      minutesLeft: 0,
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Not started yet");

    (nutritionStore as any).feedingWindow = orig;
  });

  it("renders food entries with fiber and water", async () => {
    const origFood = nutritionStore.foodEntries;
    (nutritionStore as any).foodEntries = [
      {
        id: "f1",
        date: "2025-01-15",
        name: "Oatmeal",
        calories: 300,
        protein_g: 10,
        carbs_g: 50,
        fat_g: 5,
        fiber_g: 8,
        water_ml: 250,
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Fi8g");
    expect(body.system).toContain("250ml");

    (nutritionStore as any).foodEntries = origFood;
  });

  it("renders food entries without fiber and water", async () => {
    const origFood = nutritionStore.foodEntries;
    (nutritionStore as any).foodEntries = [
      {
        id: "f2",
        date: "2025-01-15",
        name: "Chicken",
        calories: 200,
        protein_g: 30,
        carbs_g: 0,
        fat_g: 5,
        fiber_g: 0,
        water_ml: 0,
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // The Chicken food line should not have Fi0g or water indicator
    const chickenLine = body.system
      .split("\n")
      .find((l: string) => l.includes("Chicken"));
    expect(chickenLine).toBeDefined();
    expect(chickenLine).not.toContain("Fi");
    expect(chickenLine).not.toMatch(/💧/);

    (nutritionStore as any).foodEntries = origFood;
  });

  it("renders supplements with and without dose", async () => {
    const origSupps = nutritionStore.supplementEntries;
    (nutritionStore as any).supplementEntries = [
      { id: "s1", date: "2025-01-15", name: "Vitamin D", dose: "5000IU" },
      { id: "s2", date: "2025-01-15", name: "Magnesium", dose: null },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Vitamin D (5000IU)");
    expect(body.system).toMatch(/Magnesium(?! \()/);

    (nutritionStore as any).supplementEntries = origSupps;
  });

  it("renders ingredients with fiber", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "i1",
        name: "Oats",
        calories: 380,
        protein_g: 13,
        carbs_g: 67,
        fat_g: 7,
        fiber_g: 10,
        serving_size: 100,
        serving_unit: "g",
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("(10g fiber)");

    (nutritionStore as any).recipes = origRecipes;
  });

  it("renders ingredients without fiber", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "i2",
        name: "Egg",
        calories: 70,
        protein_g: 6,
        carbs_g: 1,
        fat_g: 5,
        fiber_g: 0,
        serving_size: 1,
        serving_unit: "piece",
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Egg");
    expect(body.system).not.toContain("(0g fiber)");

    (nutritionStore as any).recipes = origRecipes;
  });

  it("renders composite recipes with fiber", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "r2",
        name: "Fiber Bowl",
        calories: 400,
        protein_g: 15,
        carbs_g: 60,
        fat_g: 10,
        fiber_g: 12,
        serving_size: 1,
        serving_unit: "bowl",
        ingredients: [
          {
            id: "ri1",
            recipe_id: "r2",
            ingredient_id: "i1",
            quantity: 100,
            quantity_unit: "g",
            ingredient: { name: "Oats" },
          },
        ],
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Fiber Bowl");
    expect(body.system).toContain("(12g fiber)");

    (nutritionStore as any).recipes = origRecipes;
  });

  it("renders composite recipes without fiber", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "r3",
        name: "Protein Shake",
        calories: 250,
        protein_g: 40,
        carbs_g: 10,
        fat_g: 5,
        fiber_g: 0,
        serving_size: 1,
        serving_unit: "shake",
        ingredients: [
          {
            id: "ri2",
            recipe_id: "r3",
            ingredient_id: "i2",
            quantity: 1,
            quantity_unit: "scoop",
            ingredient: { name: "Whey" },
          },
        ],
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("Protein Shake");
    expect(body.system).not.toContain("(0g fiber)");

    (nutritionStore as any).recipes = origRecipes;
  });

  it("renders empty state labels for food, supplements, ingredients, composites", async () => {
    // Explicitly reset to empty arrays to avoid leak from previous tests
    const origFood = nutritionStore.foodEntries;
    const origSupps = nutritionStore.supplementEntries;
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).foodEntries = [];
    (nutritionStore as any).supplementEntries = [];
    (nutritionStore as any).recipes = [];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toContain("(empty)");
    expect(body.system).toContain("(none)");

    (nutritionStore as any).foodEntries = origFood;
    (nutritionStore as any).supplementEntries = origSupps;
    (nutritionStore as any).recipes = origRecipes;
  });
});

// ── edit_ingredient partial field updates ──

describe("edit_ingredient partial field updates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(nutritionStore.updateRecipe).mockClear();
  });

  it("updates only name and calories (not protein, carbs, fat, fiber, serving)", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "ing-10",
        name: "OldName",
        calories: 100,
        protein_g: 10,
        carbs_g: 20,
        fat_g: 5,
        fiber_g: 3,
        serving_size: 100,
        serving_unit: "g",
        notes: "old",
      },
    ];

    const input = { id: "ing-10", name: "NewName", calories: 200 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-10",
        name: "NewName",
        calories: 200,
        protein_g: 10, // unchanged
        carbs_g: 20, // unchanged
        fat_g: 5, // unchanged
        fiber_g: 3, // unchanged
        serving_size: 100, // unchanged
        serving_unit: "g", // unchanged
        notes: "old", // unchanged
      }),
    );

    (nutritionStore as any).recipes = origRecipes;
  });

  it("updates only fiber_g and serving_size", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "ing-11",
        name: "Oats",
        calories: 380,
        protein_g: 13,
        carbs_g: 67,
        fat_g: 7,
        fiber_g: 10,
        serving_size: 100,
        serving_unit: "g",
      },
    ];

    const input = { id: "ing-11", fiber_g: 12, serving_size: 50 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-11",
        name: "Oats", // unchanged
        calories: 380, // unchanged
        fiber_g: 12, // changed
        serving_size: 50, // changed
      }),
    );

    (nutritionStore as any).recipes = origRecipes;
  });

  it("updates serving_unit and notes", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "ing-12",
        name: "Milk",
        calories: 60,
        protein_g: 3,
        carbs_g: 5,
        fat_g: 3,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "ml",
      },
    ];

    const input = { id: "ing-12", serving_unit: "cup", notes: "whole milk" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-12",
        serving_unit: "cup",
        notes: "whole milk",
      }),
    );

    (nutritionStore as any).recipes = origRecipes;
  });

  it("updates carbs_g and fat_g only", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "ing-13",
        name: "Rice",
        calories: 130,
        protein_g: 3,
        carbs_g: 28,
        fat_g: 0.3,
        fiber_g: 0.4,
        serving_size: 100,
        serving_unit: "g",
      },
    ];

    const input = { id: "ing-13", carbs_g: 30, fat_g: 0.5 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-13",
        carbs_g: 30,
        fat_g: 0.5,
        name: "Rice", // unchanged
        protein_g: 3, // unchanged
      }),
    );

    (nutritionStore as any).recipes = origRecipes;
  });

  it("updates protein_g only", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "ing-14",
        name: "Chicken",
        calories: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
        fiber_g: 0,
        serving_size: 100,
        serving_unit: "g",
      },
    ];

    const input = { id: "ing-14", protein_g: 33 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ing-14",
        protein_g: 33,
        calories: 165, // unchanged
      }),
    );

    (nutritionStore as any).recipes = origRecipes;
  });
});

// ── edit_food partial field updates ──

describe("edit_food partial field updates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(nutritionStore.updateFood).mockClear();
  });

  it("updates only name and servings (not calories, protein, carbs, fat, fiber, water)", async () => {
    const input = { id: "food-10", name: "Grilled Chicken", servings: 2 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_food", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit food" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateFood).toHaveBeenCalledWith("food-10", {
      name: "Grilled Chicken",
      servings: 2,
    });
  });

  it("updates only fiber_g and water_ml", async () => {
    const input = { id: "food-11", fiber_g: 5, water_ml: 300 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_food", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit food" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateFood).toHaveBeenCalledWith("food-11", {
      fiber_g: 5,
      water_ml: 300,
    });
  });

  it("updates only carbs_g and fat_g", async () => {
    const input = { id: "food-12", carbs_g: 50, fat_g: 15 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_food", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit food" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateFood).toHaveBeenCalledWith("food-12", {
      carbs_g: 50,
      fat_g: 15,
    });
  });

  it("updates only calories and protein_g", async () => {
    const input = { id: "food-13", calories: 500, protein_g: 40 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "edit_food", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "edit food" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    expect(nutritionStore.updateFood).toHaveBeenCalledWith("food-13", {
      calories: 500,
      protein_g: 40,
    });
  });
});

// ── JSON parsing catch blocks ──

describe("JSON parsing catch blocks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles malformed JSON in SSE data lines gracefully (line 479 catch)", async () => {
    // Create a stream with malformed JSON in a data line
    const encoder = new TextEncoder();
    const events = [
      "data: {not valid json at all",
      `data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "text" } })}`,
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } })}`,
      `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" } })}`,
    ]
      .map((e) => e + "\n\n")
      .join("");

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true, body: stream });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("Hello");
  });

  it("handles malformed JSON in tool input (line 489/498 catch)", async () => {
    // Tool with completely malformed input JSON
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "tool_use", id: "t1", name: "log_food" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: "{broken json!!!",
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Handled") });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    const result = await sendMessage(
      [{ role: "user", content: "log" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    // Should not throw; should gracefully continue with empty parsed object
    expect(result.text).toBe("Handled");
    expect(onToolCall).toHaveBeenCalled();
  });

  it("handles truncated JSON in tool input", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "t2",
              name: "create_ingredient",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"name":"test","calories":',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Handled truncated"),
      });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    const result = await sendMessage(
      [{ role: "user", content: "create" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(result.text).toBe("Handled truncated");
  });
});

// ── SSE stream edge cases ──

describe("SSE stream edge cases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles [DONE] SSE message gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hi" },
        }),
        "[DONE]",
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("Hi");
  });

  it("handles message_delta with missing stop_reason", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello" },
        }),
        JSON.stringify({ type: "message_delta", delta: {} }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("Hello");
  });

  it("handles message_delta with null stop_reason", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hey" },
        }),
        JSON.stringify({ type: "message_delta", delta: { stop_reason: null } }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("Hey");
  });

  it("handles message_delta with no delta property", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: createSSEStream([
        JSON.stringify({
          type: "content_block_start",
          content_block: { type: "text" },
        }),
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Test" },
        }),
        JSON.stringify({ type: "message_delta" }),
        JSON.stringify({
          type: "message_delta",
          delta: { stop_reason: "end_turn" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("Test");
  });

  it("tool use without fullText omits text block from assistant content", async () => {
    // Ensure only tool_use block, no text block, in assistant content sent back
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          // Only tool_use, no text block at all
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-x",
              name: "log_supplement",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"name":"Creatine"}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Logged"),
      });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "log creatine" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    // The second fetch call should contain the assistant message built from the tool call
    // with NO text block (since fullText was empty)
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const assistantMsg = secondCallBody.messages.find(
      (m: any) => m.role === "assistant" && Array.isArray(m.content),
    );
    expect(assistantMsg).toBeDefined();
    // Should not contain a text block since fullText was ''
    const textBlocks = assistantMsg.content.filter(
      (b: any) => b.type === "text",
    );
    expect(textBlocks).toHaveLength(0);
    // Should contain the tool_use block
    const toolBlocks = assistantMsg.content.filter(
      (b: any) => b.type === "tool_use",
    );
    expect(toolBlocks).toHaveLength(1);
    expect(toolBlocks[0].name).toBe("log_supplement");
  });

  it("handles non-data lines in SSE stream", async () => {
    const encoder = new TextEncoder();
    const events = [
      ": comment line",
      "event: ping",
      `data: ${JSON.stringify({ type: "content_block_start", content_block: { type: "text" } })}`,
      `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "OK" } })}`,
      `data: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" } })}`,
    ]
      .map((e) => e + "\n\n")
      .join("");

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(events));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true, body: stream });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage(
      [{ role: "user", content: "hi" }],
      "key",
      vi.fn(),
    );
    expect(result.text).toBe("OK");
  });
});

// ── remove tool fallbacks (name || id) ──

describe("remove tool name fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(nutritionStore.removeRecipe).mockClear();
    vi.mocked(nutritionStore.removeFood).mockClear();
    vi.mocked(nutritionStore.removeSupplement).mockClear();
  });

  it("remove_supplement falls back to id when name is not provided", async () => {
    const input = { id: "supp-99" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "remove_supplement", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "remove" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "remove_supplement",
      expect.any(String),
      expect.stringContaining("supp-99"),
    );
  });

  it("remove_recipe falls back to id when name is not provided", async () => {
    const input = { id: "rec-99" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "remove_recipe", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "remove" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "remove_recipe",
      expect.any(String),
      expect.stringContaining("rec-99"),
    );
  });

  it("remove_food falls back to id when name is not provided", async () => {
    const input = { id: "food-99" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "remove_food", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "remove" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "remove_food",
      expect.any(String),
      expect.stringContaining("food-99"),
    );
  });

  it("remove_ingredient falls back to id when name is not provided", async () => {
    const input = { id: "ing-99" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: toolUseStream("t1", "remove_ingredient", input),
      })
      .mockResolvedValueOnce({ ok: true, body: textStream("Done") });
    vi.stubGlobal("fetch", mockFetch);

    const onToolCall = vi.fn();
    await sendMessage(
      [{ role: "user", content: "remove" }],
      "key",
      vi.fn(),
      onToolCall,
    );

    expect(onToolCall).toHaveBeenCalledWith(
      "remove_ingredient",
      expect.any(String),
      expect.stringContaining("ing-99"),
    );
  });
});

// ── Composite recipe ingredient name fallback ──

describe("composite recipe ingredient name fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to ingredient_id when ingredient object is missing", async () => {
    const origRecipes = nutritionStore.recipes;
    (nutritionStore as any).recipes = [
      {
        id: "r-fb",
        name: "Test Recipe",
        calories: 200,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 5,
        fiber_g: 0,
        serving_size: 1,
        serving_unit: "serving",
        ingredients: [
          {
            id: "ri1",
            recipe_id: "r-fb",
            ingredient_id: "missing-ing-id",
            quantity: 100,
            quantity_unit: "g",
            ingredient: null,
          },
          {
            id: "ri2",
            recipe_id: "r-fb",
            ingredient_id: "orphan-id",
            quantity: 50,
            quantity_unit: "ml",
          },
        ],
      },
    ];

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: textStream("OK") });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage([{ role: "user", content: "hi" }], "key", vi.fn());

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Should contain the ingredient_id as fallback since ingredient is null/undefined
    expect(body.system).toContain("missing-ing-id");
    expect(body.system).toContain("orphan-id");

    (nutritionStore as any).recipes = origRecipes;
  });
});

// ── Tool use with text preceding (fullText truthy at line 486) ──

describe("tool use with preceding text block", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes text block in assistant content when there is preceding text", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          // Text block first
          JSON.stringify({
            type: "content_block_start",
            content_block: { type: "text" },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Let me log that." },
          }),
          // Then tool_use
          JSON.stringify({
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool-y",
              name: "log_supplement",
            },
          }),
          JSON.stringify({
            type: "content_block_delta",
            delta: {
              type: "input_json_delta",
              partial_json: '{"name":"Fish Oil"}',
            },
          }),
          JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "tool_use" },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: textStream("Done"),
      });
    vi.stubGlobal("fetch", mockFetch);

    await sendMessage(
      [{ role: "user", content: "log fish oil" }],
      "key",
      vi.fn(),
      vi.fn(),
    );

    // Check the second API call includes both text and tool_use blocks
    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    const assistantMsg = secondCallBody.messages.find(
      (m: any) => m.role === "assistant" && Array.isArray(m.content),
    );
    expect(assistantMsg).toBeDefined();
    const textBlocks = assistantMsg.content.filter(
      (b: any) => b.type === "text",
    );
    expect(textBlocks).toHaveLength(1);
    expect(textBlocks[0].text).toBe("Let me log that.");
    const toolBlocks = assistantMsg.content.filter(
      (b: any) => b.type === "tool_use",
    );
    expect(toolBlocks).toHaveLength(1);
  });
});
