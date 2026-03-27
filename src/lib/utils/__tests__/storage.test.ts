import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getItem,
  setItem,
  removeItem,
  exportData,
  importData,
} from "$lib/utils/storage";

describe("getItem", () => {
  it("returns default when key missing", () => {
    expect(getItem("missing", 42)).toBe(42);
  });

  it("returns parsed JSON value", () => {
    localStorage.setItem("test-key", JSON.stringify({ a: 1 }));
    expect(getItem("test-key", {})).toEqual({ a: 1 });
  });

  it("returns default for invalid JSON", () => {
    localStorage.setItem("bad-json", "not json");
    expect(getItem("bad-json", "fallback")).toBe("fallback");
  });

  it("returns stored arrays", () => {
    localStorage.setItem("arr", JSON.stringify([1, 2, 3]));
    expect(getItem("arr", [])).toEqual([1, 2, 3]);
  });
});

describe("setItem", () => {
  it("stores JSON-serialized value", () => {
    setItem("key", { x: 1 });
    expect(localStorage.getItem("key")).toBe('{"x":1}');
  });

  it("stores primitive values", () => {
    setItem("num", 42);
    expect(JSON.parse(localStorage.getItem("num")!)).toBe(42);
  });
});

describe("removeItem", () => {
  it("removes the key", () => {
    localStorage.setItem("key", "value");
    removeItem("key");
    expect(localStorage.getItem("key")).toBeNull();
  });

  it("is a no-op for missing keys", () => {
    expect(() => removeItem("nonexistent")).not.toThrow();
  });
});

describe("exportData", () => {
  it("only exports keys starting with stronglifts-", () => {
    localStorage.setItem("stronglifts-settings", JSON.stringify({ a: 1 }));
    localStorage.setItem("other-key", "nope");

    const exported = JSON.parse(exportData());
    expect(exported).toHaveProperty("stronglifts-settings");
    expect(exported).not.toHaveProperty("other-key");
  });

  it("returns empty object when no matching keys", () => {
    localStorage.setItem("other", "nope");
    expect(exportData()).toBe("{}");
  });

  it("handles non-JSON values", () => {
    localStorage.setItem("stronglifts-raw", "plain text");
    const exported = JSON.parse(exportData());
    expect(exported["stronglifts-raw"]).toBe("plain text");
  });
});

describe("importData", () => {
  it("imports only stronglifts- prefixed keys", () => {
    const data = {
      "stronglifts-settings": { timer: 90 },
      "other-key": "ignored",
    };
    const result = importData(JSON.stringify(data));
    expect(result).toBe(true);
    expect(localStorage.getItem("stronglifts-settings")).toBe(
      JSON.stringify({ timer: 90 }),
    );
    expect(localStorage.getItem("other-key")).toBeNull();
  });

  it("returns false for invalid JSON", () => {
    expect(importData("not json")).toBe(false);
  });

  it("returns true for empty object", () => {
    expect(importData("{}")).toBe(true);
  });
});

describe("SSR environment (no localStorage)", () => {
  let origLS: PropertyDescriptor | undefined;

  beforeEach(() => {
    origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });

  it("getItem returns default", () => {
    expect(getItem("key", 42)).toBe(42);
  });

  it("setItem is a no-op", () => {
    expect(() => setItem("key", "val")).not.toThrow();
  });

  it("removeItem is a no-op", () => {
    expect(() => removeItem("key")).not.toThrow();
  });

  it("exportData returns empty object", () => {
    expect(exportData()).toBe("{}");
  });

  it("importData returns false", () => {
    expect(importData("{}")).toBe(false);
  });
});
