import { vi, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";

// ── localStorage / sessionStorage ──

const createStorage = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

Object.defineProperty(globalThis, "localStorage", {
  value: createStorage(),
  writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: createStorage(),
  writable: true,
});

// ── crypto.randomUUID ──

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      randomUUID: () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      },
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++)
          arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    },
    writable: true,
  });
}

// ── navigator.vibrate ──

Object.defineProperty(globalThis.navigator, "vibrate", {
  value: vi.fn(() => true),
  writable: true,
  configurable: true,
});

// ── AudioContext stub ──

class MockOscillator {
  frequency = { value: 0 };
  type = "sine";
  connect() {
    return this;
  }
  start() {}
  stop() {}
}

class MockGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect() {
    return this;
  }
}

globalThis.AudioContext = vi.fn().mockImplementation(() => ({
  currentTime: 0,
  destination: {},
  createOscillator: () => new MockOscillator(),
  createGain: () => new MockGain(),
})) as unknown as typeof AudioContext;

// ── Reset between tests ──

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
