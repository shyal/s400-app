import { describe, it, expect, vi } from "vitest";
import { idbGet, idbSet } from "$lib/services/idb";

// fake-indexeddb is loaded via setup.ts

describe("idb", () => {
  it("returns undefined for missing key", async () => {
    const result = await idbGet("nonexistent");
    expect(result).toBeUndefined();
  });

  it("roundtrips a string", async () => {
    await idbSet("test-str", "hello");
    const result = await idbGet<string>("test-str");
    expect(result).toBe("hello");
  });

  it("roundtrips an object", async () => {
    const data = { workouts: [{ id: "w1" }], count: 42 };
    await idbSet("test-obj", data);
    const result = await idbGet<typeof data>("test-obj");
    expect(result).toEqual(data);
  });

  it("overwrites existing keys", async () => {
    await idbSet("key", "first");
    await idbSet("key", "second");
    const result = await idbGet<string>("key");
    expect(result).toBe("second");
  });

  it("handles complex nested data", async () => {
    const history = {
      workouts: [
        {
          id: "w1",
          exercises: [{ name: "Squat", sets: [{ reps: 5, weight_kg: 60 }] }],
        },
      ],
      exerciseProgress: { Squat: { weight_kg: 60, failureCount: 0 } },
    };
    await idbSet("history", history);
    const result = await idbGet<typeof history>("history");
    expect(result?.workouts[0].exercises[0].sets[0].weight_kg).toBe(60);
  });
});

describe("error handling", () => {
  it("rejects when open fails", async () => {
    const origIDB = globalThis.indexedDB;
    const mockOpen = {
      result: null,
      error: new Error("open failed"),
      onupgradeneeded: null as any,
      onsuccess: null as any,
      onerror: null as any,
    };
    Object.defineProperty(globalThis, "indexedDB", {
      value: {
        open: () => {
          setTimeout(() => mockOpen.onerror?.(), 0);
          return mockOpen;
        },
      },
      configurable: true,
      writable: true,
    });

    await expect(idbGet("test")).rejects.toThrow();

    Object.defineProperty(globalThis, "indexedDB", {
      value: origIDB,
      configurable: true,
      writable: true,
    });
  });

  it("rejects when get transaction fails", async () => {
    const origIDB = globalThis.indexedDB;
    const mockReq = {
      result: null,
      error: new Error("get failed"),
      onsuccess: null as any,
      onerror: null as any,
    };
    const mockTx = {
      objectStore: () => ({
        get: () => {
          setTimeout(() => mockReq.onerror?.(), 0);
          return mockReq;
        },
      }),
      oncomplete: null as any,
      onerror: null as any,
    };
    const mockDb = {
      transaction: () => mockTx,
      close: vi.fn(),
    };
    const mockOpenReq = {
      result: mockDb,
      error: null,
      onupgradeneeded: null as any,
      onsuccess: null as any,
      onerror: null as any,
    };
    Object.defineProperty(globalThis, "indexedDB", {
      value: {
        open: () => {
          setTimeout(() => mockOpenReq.onsuccess?.(), 0);
          return mockOpenReq;
        },
      },
      configurable: true,
      writable: true,
    });

    await expect(idbGet("test")).rejects.toThrow();

    Object.defineProperty(globalThis, "indexedDB", {
      value: origIDB,
      configurable: true,
      writable: true,
    });
  });

  it("rejects when set transaction fails", async () => {
    const origIDB = globalThis.indexedDB;
    const mockTx = {
      objectStore: () => ({
        put: () => ({}),
      }),
      oncomplete: null as any,
      onerror: null as any,
      error: new Error("set failed"),
    };
    const mockDb = {
      transaction: () => mockTx,
      close: vi.fn(),
    };
    const mockOpenReq = {
      result: mockDb,
      error: null,
      onupgradeneeded: null as any,
      onsuccess: null as any,
      onerror: null as any,
    };
    Object.defineProperty(globalThis, "indexedDB", {
      value: {
        open: () => {
          setTimeout(() => mockOpenReq.onsuccess?.(), 0);
          return mockOpenReq;
        },
      },
      configurable: true,
      writable: true,
    });

    // Trigger the error after put
    setTimeout(() => mockTx.onerror?.(), 10);
    await expect(idbSet("test", "value")).rejects.toThrow();

    Object.defineProperty(globalThis, "indexedDB", {
      value: origIDB,
      configurable: true,
      writable: true,
    });
  });
});
