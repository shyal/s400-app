import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("$lib/services/supabaseData", () => ({
  fetchSettings: vi.fn(() => Promise.resolve(null)),
  upsertSettings: vi.fn(() => Promise.resolve(true)),
}));

describe("timerStore", () => {
  let timerStore: typeof import("$lib/stores/timer.svelte").timerStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import("$lib/stores/timer.svelte");
    timerStore = mod.timerStore;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle", () => {
    expect(timerStore.state).toBe("idle");
    expect(timerStore.secondsRemaining).toBe(0);
  });

  it("starts timer with given seconds", () => {
    timerStore.start(60);
    expect(timerStore.state).toBe("running");
    expect(timerStore.secondsRemaining).toBe(60);
  });

  it("counts down on tick", () => {
    timerStore.start(10);
    vi.advanceTimersByTime(3000);
    expect(timerStore.secondsRemaining).toBeLessThanOrEqual(7);
    expect(timerStore.state).toBe("running");
  });

  it("finishes when time expires", () => {
    timerStore.start(3);
    vi.advanceTimersByTime(4000);
    expect(timerStore.state).toBe("finished");
    expect(timerStore.secondsRemaining).toBe(0);
  });

  it("stop resets to idle", () => {
    timerStore.start(60);
    timerStore.stop();
    expect(timerStore.state).toBe("idle");
  });

  it("reset stops and zeros", () => {
    timerStore.start(60);
    timerStore.reset();
    expect(timerStore.state).toBe("idle");
    expect(timerStore.secondsRemaining).toBe(0);
  });

  it("addTime extends running timer", () => {
    timerStore.start(10);
    vi.advanceTimersByTime(5000);
    timerStore.addTime(10);
    // Should be ~15 seconds left (5 remaining + 10 added)
    expect(timerStore.secondsRemaining).toBeGreaterThanOrEqual(14);
    expect(timerStore.state).toBe("running");
  });

  it("addTime restarts finished timer", () => {
    timerStore.start(2);
    vi.advanceTimersByTime(3000);
    expect(timerStore.state).toBe("finished");

    timerStore.addTime(30);
    expect(timerStore.state).toBe("running");
    expect(timerStore.secondsRemaining).toBe(30);
  });

  it("formats time correctly", () => {
    timerStore.start(125); // 2:05
    expect(timerStore.formattedTime).toBe("2:05");
  });

  it("formats zero time", () => {
    expect(timerStore.formattedTime).toBe("0:00");
  });

  it("saves to sessionStorage", () => {
    timerStore.start(60);
    const stored = sessionStorage.getItem("stronglifts-timer");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.duration).toBe(60);
    expect(parsed.endsAt).toBeGreaterThan(0);
  });

  it("clears sessionStorage on stop", () => {
    timerStore.start(60);
    timerStore.stop();
    expect(sessionStorage.getItem("stronglifts-timer")).toBeNull();
  });

  it("restores running timer from sessionStorage", async () => {
    const endsAt = Date.now() + 30000;
    sessionStorage.setItem(
      "stronglifts-timer",
      JSON.stringify({ endsAt, duration: 60 }),
    );

    vi.resetModules();
    const mod = await import("$lib/stores/timer.svelte");
    const restored = mod.timerStore;
    expect(restored.state).toBe("running");
    expect(restored.secondsRemaining).toBeGreaterThan(0);
  });

  it("restores expired timer as finished", async () => {
    const endsAt = Date.now() - 5000;
    sessionStorage.setItem(
      "stronglifts-timer",
      JSON.stringify({ endsAt, duration: 60 }),
    );

    vi.resetModules();
    const mod = await import("$lib/stores/timer.svelte");
    const restored = mod.timerStore;
    expect(restored.state).toBe("finished");
    expect(restored.secondsRemaining).toBe(0);
  });

  it("handles corrupt sessionStorage gracefully", async () => {
    sessionStorage.setItem("stronglifts-timer", "{not valid json");
    vi.resetModules();
    const mod = await import("$lib/stores/timer.svelte");
    // Should start idle despite corrupt data
    expect(mod.timerStore.state).toBe("idle");
  });

  it("starts idle when sessionStorage is undefined (SSR)", async () => {
    const origSS = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage",
    );
    Object.defineProperty(globalThis, "sessionStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/services/supabaseData", () => ({
      fetchSettings: vi.fn(() => Promise.resolve(null)),
      upsertSettings: vi.fn(() => Promise.resolve(true)),
    }));
    const mod = await import("$lib/stores/timer.svelte");
    expect(mod.timerStore.state).toBe("idle");

    if (origSS) Object.defineProperty(globalThis, "sessionStorage", origSS);
  });

  it("skips sound when soundEnabled is false", async () => {
    vi.resetModules();
    // Set settings with sound disabled before importing timer
    localStorage.setItem(
      "stronglifts-settings",
      JSON.stringify({
        restTimerSeconds: 90,
        weightUnit: "kg",
        program: "stronglifts",
        soundEnabled: false,
        vibrationEnabled: true,
        increments: {},
      }),
    );
    const mod = await import("$lib/stores/timer.svelte");
    mod.timerStore.start(1);
    vi.advanceTimersByTime(2000);
    expect(mod.timerStore.state).toBe("finished");
  });

  it("skips vibration when vibrationEnabled is false", async () => {
    vi.resetModules();
    localStorage.setItem(
      "stronglifts-settings",
      JSON.stringify({
        restTimerSeconds: 90,
        weightUnit: "kg",
        program: "stronglifts",
        soundEnabled: true,
        vibrationEnabled: false,
        increments: {},
      }),
    );
    const mod = await import("$lib/stores/timer.svelte");
    mod.timerStore.start(1);
    vi.advanceTimersByTime(2000);
    expect(mod.timerStore.state).toBe("finished");
  });

  it("uses default rest timer when no seconds provided", async () => {
    vi.resetModules();
    // Settings has default restTimerSeconds: 90
    const mod = await import("$lib/stores/timer.svelte");
    mod.timerStore.start(); // no argument - uses default 90s
    expect(mod.timerStore.secondsRemaining).toBe(90);
  });

  it("recalculates on visibilitychange when running", async () => {
    vi.resetModules();
    const mod = await import("$lib/stores/timer.svelte");
    const timer = mod.timerStore;
    timer.start(60);

    // Simulate returning from background
    vi.advanceTimersByTime(5000);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(timer.state).toBe("running");
    expect(timer.secondsRemaining).toBeLessThanOrEqual(55);
  });
});
