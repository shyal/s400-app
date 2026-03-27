import { describe, it, expect, vi, beforeEach } from "vitest";

describe("todosStore", () => {
  let todosStore: typeof import("$lib/stores/todos.svelte").todosStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("$lib/stores/todos.svelte");
    todosStore = mod.todosStore;
  });

  it("starts with empty items", () => {
    expect(todosStore.items).toEqual([]);
  });

  it("adds a todo", () => {
    todosStore.add("Buy protein");
    expect(todosStore.items).toHaveLength(1);
    expect(todosStore.items[0].text).toBe("Buy protein");
    expect(todosStore.items[0].completed).toBe(false);
  });

  it("ignores empty/whitespace-only adds", () => {
    todosStore.add("");
    todosStore.add("   ");
    expect(todosStore.items).toHaveLength(0);
  });

  it("trims whitespace", () => {
    todosStore.add("  test  ");
    expect(todosStore.items[0].text).toBe("test");
  });

  it("prepends new todos (newest first)", () => {
    todosStore.add("first");
    todosStore.add("second");
    expect(todosStore.items[0].text).toBe("second");
    expect(todosStore.items[1].text).toBe("first");
  });

  it("toggles a todo", () => {
    todosStore.add("task");
    const id = todosStore.items[0].id;
    todosStore.toggle(id);
    expect(todosStore.items[0].completed).toBe(true);

    todosStore.toggle(id);
    expect(todosStore.items[0].completed).toBe(false);
  });

  it("removes a todo", () => {
    todosStore.add("one");
    todosStore.add("two");
    const id = todosStore.items[0].id;
    todosStore.remove(id);
    expect(todosStore.items).toHaveLength(1);
  });

  it("returns pending todos", () => {
    todosStore.add("a");
    todosStore.add("b");
    todosStore.toggle(todosStore.items[0].id);
    expect(todosStore.pending).toHaveLength(1);
    expect(todosStore.completed).toHaveLength(1);
  });

  it("clears completed", () => {
    todosStore.add("a");
    todosStore.add("b");
    todosStore.toggle(todosStore.items[0].id);
    todosStore.clearCompleted();
    expect(todosStore.items).toHaveLength(1);
    expect(todosStore.items[0].completed).toBe(false);
  });

  it("persists to localStorage", () => {
    todosStore.add("persist me");
    const stored = localStorage.getItem("stronglifts-todos");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed[0].text).toBe("persist me");
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem("stronglifts-todos", "not valid json{{{");
    vi.resetModules();
    const mod = await import("$lib/stores/todos.svelte");
    expect(mod.todosStore.items).toEqual([]);
  });

  it("returns empty items when localStorage is undefined (SSR)", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    const mod = await import("$lib/stores/todos.svelte");
    expect(mod.todosStore.items).toEqual([]);

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });
});
