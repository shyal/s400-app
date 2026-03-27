import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/services/supabaseData", () => ({
  fetchSettings: vi.fn(() => Promise.resolve(null)),
  upsertSettings: vi.fn(() => Promise.resolve(true)),
}));

describe("settingsStore", () => {
  let settingsStore: typeof import("$lib/stores/settings.svelte").settingsStore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("$lib/stores/settings.svelte");
    settingsStore = mod.settingsStore;
  });

  it("has correct defaults", () => {
    const v = settingsStore.value;
    expect(v.restTimerSeconds).toBe(90);
    expect(v.weightUnit).toBe("kg");
    expect(v.program).toBe("stronglifts");
    expect(v.soundEnabled).toBe(true);
    expect(v.vibrationEnabled).toBe(true);
    expect(v.increments["Squat"]).toBe(2.5);
    expect(v.increments["Deadlift"]).toBe(5);
    expect(v.workoutSchedule).toEqual({
      frequencyDays: 2,
      consecutiveForExtraRest: 3,
      extraRestDays: 1,
    });
  });

  it("partial update merges with existing", () => {
    settingsStore.update({ restTimerSeconds: 120 });
    expect(settingsStore.value.restTimerSeconds).toBe(120);
    expect(settingsStore.value.weightUnit).toBe("kg"); // unchanged
  });

  it("reset restores defaults", () => {
    settingsStore.update({ restTimerSeconds: 300, weightUnit: "lb" });
    settingsStore.reset();
    expect(settingsStore.value.restTimerSeconds).toBe(90);
    expect(settingsStore.value.weightUnit).toBe("kg");
  });

  it("hydrates from Supabase", async () => {
    const { fetchSettings } = await import("$lib/services/supabaseData");
    (fetchSettings as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      restTimerSeconds: 180,
      weightUnit: "lb",
      program: "custom",
    });

    await settingsStore.hydrate();
    expect(settingsStore.value.restTimerSeconds).toBe(180);
    expect(settingsStore.value.weightUnit).toBe("lb");
    expect(settingsStore.value.program).toBe("custom");
    // Defaults fill in missing fields
    expect(settingsStore.value.soundEnabled).toBe(true);
  });

  it("persists to localStorage on update", () => {
    settingsStore.update({ restTimerSeconds: 60 });
    const stored = JSON.parse(localStorage.getItem("stronglifts-settings")!);
    expect(stored.restTimerSeconds).toBe(60);
  });

  it("loads from localStorage on init", async () => {
    localStorage.setItem(
      "stronglifts-settings",
      JSON.stringify({
        restTimerSeconds: 200,
        weightUnit: "lb",
        program: "custom",
        soundEnabled: false,
        vibrationEnabled: false,
        increments: { Squat: 5 },
      }),
    );

    vi.resetModules();
    const mod = await import("$lib/stores/settings.svelte");
    expect(mod.settingsStore.value.restTimerSeconds).toBe(200);
    expect(mod.settingsStore.value.weightUnit).toBe("lb");
  });

  it("handles corrupt localStorage gracefully", async () => {
    localStorage.setItem("stronglifts-settings", "{{invalid json");
    vi.resetModules();
    const mod = await import("$lib/stores/settings.svelte");
    expect(mod.settingsStore.value.restTimerSeconds).toBe(90);
  });

  it("updates workoutSchedule and merges correctly", () => {
    settingsStore.update({
      workoutSchedule: {
        frequencyDays: 3,
        consecutiveForExtraRest: 4,
        extraRestDays: 2,
      },
    });
    expect(settingsStore.value.workoutSchedule.frequencyDays).toBe(3);
    expect(settingsStore.value.workoutSchedule.consecutiveForExtraRest).toBe(4);
    expect(settingsStore.value.workoutSchedule.extraRestDays).toBe(2);
    // Other settings unchanged
    expect(settingsStore.value.restTimerSeconds).toBe(90);
  });

  it("persists workoutSchedule to localStorage", () => {
    const schedule = {
      frequencyDays: 1,
      consecutiveForExtraRest: 5,
      extraRestDays: 2,
    };
    settingsStore.update({ workoutSchedule: schedule });
    const stored = JSON.parse(localStorage.getItem("stronglifts-settings")!);
    expect(stored.workoutSchedule).toEqual(schedule);
  });

  it("round-trips workoutSchedule through localStorage", async () => {
    const schedule = {
      frequencyDays: 3,
      consecutiveForExtraRest: 2,
      extraRestDays: 1,
    };
    settingsStore.update({ workoutSchedule: schedule });

    vi.resetModules();
    const mod = await import("$lib/stores/settings.svelte");
    expect(mod.settingsStore.value.workoutSchedule).toEqual(schedule);
  });

  it("handles hydration error gracefully", async () => {
    const { fetchSettings } = await import("$lib/services/supabaseData");
    (fetchSettings as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );
    await settingsStore.hydrate();
    expect(settingsStore.value.restTimerSeconds).toBe(90);
  });

  it("returns defaults when localStorage is undefined (SSR)", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/services/supabaseData", () => ({
      fetchSettings: vi.fn(() => Promise.resolve(null)),
      upsertSettings: vi.fn(() => Promise.resolve(true)),
    }));
    const mod = await import("$lib/stores/settings.svelte");
    expect(mod.settingsStore.value.restTimerSeconds).toBe(90);

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });
});
