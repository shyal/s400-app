import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/services/biomarkerData", () => ({
  fetchBiomarkerDefinitions: vi.fn(() => Promise.resolve([])),
  fetchBiomarkerMeasurements: vi.fn(() => Promise.resolve([])),
  fetchLatestMeasurements: vi.fn(() => Promise.resolve(new Map())),
  upsertMeasurement: vi.fn(() => Promise.resolve(null)),
  deleteMeasurement: vi.fn(() => Promise.resolve(true)),
  fetchUserTargets: vi.fn(() => Promise.resolve(new Map())),
  upsertUserTarget: vi.fn(() => Promise.resolve(true)),
}));

import {
  makeBiomarkerDefinition,
  makeBiomarkerMeasurement,
  makeBiomarkerUserTarget,
} from "../../../test/fixtures";

describe("biomarkerStore", () => {
  let biomarkerStore: typeof import("$lib/stores/biomarker.svelte").biomarkerStore;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    const mod = await import("$lib/stores/biomarker.svelte");
    biomarkerStore = mod.biomarkerStore;
  });

  it("starts with empty data", () => {
    expect(biomarkerStore.definitions).toEqual([]);
    expect(biomarkerStore.measurements).toEqual([]);
  });

  it("handles corrupt JSON in localStorage gracefully", async () => {
    localStorage.setItem("biomarker-definitions", "{invalid json");
    localStorage.setItem("biomarker-measurements", "not-json");
    vi.resetModules();
    const mod = await import("$lib/stores/biomarker.svelte");
    // loadJson catch block returns the fallback
    expect(mod.biomarkerStore.definitions).toEqual([]);
    expect(mod.biomarkerStore.measurements).toEqual([]);
  });

  it("handles corrupt targets JSON in localStorage gracefully", async () => {
    localStorage.setItem("biomarker-targets", "{corrupt!!");
    vi.resetModules();
    const mod = await import("$lib/stores/biomarker.svelte");
    // loadJson catch block returns the fallback (empty array for targets)
    expect(mod.biomarkerStore.userTargets.size).toBe(0);
  });

  it("returns fallback when localStorage is undefined (SSR)", async () => {
    const origLS = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    vi.resetModules();
    vi.doMock("$lib/services/biomarkerData", () => ({
      fetchBiomarkerDefinitions: vi.fn(() => Promise.resolve([])),
      fetchBiomarkerMeasurements: vi.fn(() => Promise.resolve([])),
      fetchLatestMeasurements: vi.fn(() => Promise.resolve(new Map())),
      upsertMeasurement: vi.fn(() => Promise.resolve(null)),
      deleteMeasurement: vi.fn(() => Promise.resolve(true)),
      fetchUserTargets: vi.fn(() => Promise.resolve(new Map())),
      upsertUserTarget: vi.fn(() => Promise.resolve(true)),
    }));
    const mod = await import("$lib/stores/biomarker.svelte");
    expect(mod.biomarkerStore.definitions).toEqual([]);
    expect(mod.biomarkerStore.measurements).toEqual([]);

    if (origLS) Object.defineProperty(globalThis, "localStorage", origLS);
  });

  describe("calculateStatus (via biomarkersWithLatest)", () => {
    it("returns unknown with no measurement", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", optimalMax: 100 });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;
      const bwl = store.biomarkersWithLatest;
      expect(bwl[0]?.status).toBe("unknown");
    });

    it("returns optimal when value in range", async () => {
      const def = makeBiomarkerDefinition({
        id: "b1",
        optimalMin: 50,
        optimalMax: 100,
        warningMin: 30,
        warningMax: 130,
      });
      const m = makeBiomarkerMeasurement({ biomarkerId: "b1", value: 75 });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.status).toBe(
        "optimal",
      );
    });

    it("returns warning when outside optimal but inside warning range", async () => {
      const def = makeBiomarkerDefinition({
        id: "b1",
        optimalMin: 50,
        optimalMax: 100,
        warningMin: 30,
        warningMax: 130,
      });
      const m = makeBiomarkerMeasurement({ biomarkerId: "b1", value: 115 });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.status).toBe(
        "warning",
      );
    });

    it("returns critical when outside warning range", async () => {
      const def = makeBiomarkerDefinition({
        id: "b1",
        optimalMin: 50,
        optimalMax: 100,
        warningMin: 30,
        warningMax: 130,
      });
      const m = makeBiomarkerMeasurement({ biomarkerId: "b1", value: 150 });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.status).toBe(
        "critical",
      );
    });

    it("uses user target when available", async () => {
      const def = makeBiomarkerDefinition({
        id: "b1",
        optimalMin: 50,
        optimalMax: 100,
        warningMax: 130,
      });
      const m = makeBiomarkerMeasurement({ biomarkerId: "b1", value: 75 });
      const target = makeBiomarkerUserTarget({
        biomarkerId: "b1",
        optimalMin: 60,
        optimalMax: 70,
      });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      localStorage.setItem(
        "biomarker-targets",
        JSON.stringify([["b1", target]]),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      // 75 is outside user target optimal (60-70) but inside warning (null-130)
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.status).toBe(
        "warning",
      );
    });
  });

  describe("calculateTrend (via biomarkersWithLatest)", () => {
    it("returns unknown with < 2 measurements", async () => {
      const def = makeBiomarkerDefinition({ id: "b1" });
      const m = makeBiomarkerMeasurement({ biomarkerId: "b1", value: 90 });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe("unknown");
    });

    it("returns improving for decreasing values (lower is better)", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "LDL-C" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 110,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 90,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe(
        "improving",
      );
    });

    it("returns worsening for increasing values (lower is better)", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "LDL-C" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 90,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 120,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe(
        "worsening",
      );
    });

    it("returns improving for increasing HDL (higher is better)", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "HDL-C" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 45,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 55,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe(
        "improving",
      );
    });

    it("returns worsening for decreasing HDL (higher is better)", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "HDL-C" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 55,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 40,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe(
        "worsening",
      );
    });

    it("uses fallback threshold of 1 when previous value is zero", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "NAD+" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 0,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 0.5,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      // change=0.5, threshold= Math.abs(0)*0.05 || 1 = 1, |0.5| < 1, so stable
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe("stable");
    });

    it("returns stable for small change", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "LDL-C" });
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 100,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 101,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.biomarkersWithLatest[0]?.trend).toBe("stable");
    });
  });

  describe("attentionItems", () => {
    it("returns items with critical/warning status or worsening trend", async () => {
      const defs = [
        makeBiomarkerDefinition({
          id: "b1",
          name: "LDL-C",
          optimalMax: 100,
          warningMax: 130,
        }),
        makeBiomarkerDefinition({
          id: "b2",
          name: "HDL-C",
          optimalMin: 50,
          optimalMax: 90,
          warningMin: 40,
          warningMax: null,
        }),
      ];
      const measurements = [
        makeBiomarkerMeasurement({ biomarkerId: "b1", value: 150 }), // critical
        makeBiomarkerMeasurement({ biomarkerId: "b2", value: 55 }), // optimal
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const items = mod.biomarkerStore.attentionItems;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].name).toBe("LDL-C");
    });

    it("includes worsening-trend items with optimal status and sorts them after critical/warning", async () => {
      const defs = [
        makeBiomarkerDefinition({
          id: "b1",
          name: "ApoB",
          optimalMax: 80,
          warningMax: 100,
        }),
        makeBiomarkerDefinition({
          id: "b2",
          name: "LDL-C",
          optimalMin: 0,
          optimalMax: 200,
          warningMin: 0,
          warningMax: 300,
        }),
      ];
      const measurements = [
        makeBiomarkerMeasurement({ biomarkerId: "b1", value: 110 }), // critical
        // b2: value within optimal but worsening trend (lower is better, value went up)
        makeBiomarkerMeasurement({
          biomarkerId: "b2",
          value: 50,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b2",
          value: 80,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const items = mod.biomarkerStore.attentionItems;
      expect(items.length).toBe(2);
      // Critical (statusOrder 0) should sort before optimal (statusOrder 2)
      expect(items[0].status).toBe("critical");
      expect(items[1].status).toBe("optimal");
      expect(items[1].trend).toBe("worsening");
    });

    it("sorts critical before warning in attention items", async () => {
      const defs = [
        makeBiomarkerDefinition({
          id: "b1",
          name: "ApoB",
          optimalMax: 80,
          warningMax: 100,
        }),
        makeBiomarkerDefinition({
          id: "b2",
          name: "LDL-C",
          optimalMax: 100,
          warningMax: 130,
        }),
      ];
      const measurements = [
        makeBiomarkerMeasurement({ biomarkerId: "b1", value: 110 }), // critical (>100 warningMax)
        makeBiomarkerMeasurement({ biomarkerId: "b2", value: 115 }), // warning (>100 optimalMax but <130 warningMax)
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const items = mod.biomarkerStore.attentionItems;
      expect(items.length).toBe(2);
      // Critical should be sorted before warning
      expect(items[0].status).toBe("critical");
      expect(items[1].status).toBe("warning");
    });
  });

  describe("overdueTests", () => {
    it("includes never-tested biomarkers", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", testFrequencyDays: 180 }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.overdueTests).toHaveLength(1);
    });

    it("includes biomarkers tested beyond their frequency window", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", testFrequencyDays: 30 }),
      ];
      // Test was done 60 days ago — overdue for a 30-day frequency
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const dateStr = oldDate.toISOString().split("T")[0];
      const m = makeBiomarkerMeasurement({
        biomarkerId: "b1",
        value: 90,
        date: dateStr,
      });
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const overdue = mod.biomarkerStore.overdueTests;
      expect(overdue).toHaveLength(1);
      expect(overdue[0].daysSinceTest).toBeGreaterThan(30);
    });

    it("excludes biomarkers tested within their frequency window", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", testFrequencyDays: 180 }),
      ];
      // Test was done 10 days ago — well within the 180-day window
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const dateStr = recentDate.toISOString().split("T")[0];
      const m = makeBiomarkerMeasurement({
        biomarkerId: "b1",
        value: 90,
        date: dateStr,
      });
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.overdueTests).toHaveLength(0);
    });
  });

  describe("categoryStats", () => {
    it("aggregates by category", async () => {
      const defs = [
        makeBiomarkerDefinition({
          id: "b1",
          category: "cardiovascular",
          optimalMax: 100,
          warningMax: 130,
        }),
        makeBiomarkerDefinition({
          id: "b2",
          category: "metabolic",
          optimalMax: 100,
          warningMax: 130,
        }),
      ];
      const measurements = [
        makeBiomarkerMeasurement({ biomarkerId: "b1", value: 80 }), // optimal
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );
      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const stats = mod.biomarkerStore.categoryStats;
      expect(stats.all.total).toBe(2);
      expect(stats.cardiovascular.optimal).toBe(1);
      expect(stats.metabolic.unknown).toBe(1);
    });
  });

  describe("hydrate", () => {
    it("fetches definitions, measurements, and targets from supabase", async () => {
      vi.resetModules();
      localStorage.clear();

      const def = makeBiomarkerDefinition({ id: "b1", name: "ApoB" });
      const m = makeBiomarkerMeasurement({
        id: "m1",
        biomarkerId: "b1",
        value: 80,
      });
      const target = makeBiomarkerUserTarget({
        biomarkerId: "b1",
        optimalMax: 90,
      });
      const targetsMap = new Map([["b1", target]]);

      const {
        fetchBiomarkerDefinitions,
        fetchBiomarkerMeasurements,
        fetchLatestMeasurements,
        fetchUserTargets,
      } = await import("$lib/services/biomarkerData");

      (
        fetchBiomarkerDefinitions as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([def]);
      (
        fetchLatestMeasurements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(new Map([["b1", m]]));
      (fetchUserTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        targetsMap,
      );
      (
        fetchBiomarkerMeasurements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([m]);

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.hydrate();

      expect(store.definitions).toEqual([def]);
      expect(store.measurements).toEqual([m]);
      expect(store.userTargets.get("b1")).toEqual(target);
      // Verify localStorage was updated
      expect(
        JSON.parse(localStorage.getItem("biomarker-definitions")!),
      ).toEqual([def]);
      expect(
        JSON.parse(localStorage.getItem("biomarker-measurements")!),
      ).toEqual([m]);
    });

    it("keeps localStorage data when supabase returns empty", async () => {
      const def = makeBiomarkerDefinition({ id: "b1" });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      // Default mocks return empty arrays/maps
      await store.hydrate();

      // Definitions from localStorage should remain since supabase returned empty
      expect(store.definitions).toEqual([def]);
    });

    it("sets isLoading during hydration and clears it after", async () => {
      vi.resetModules();
      localStorage.clear();

      const {
        fetchBiomarkerDefinitions,
        fetchBiomarkerMeasurements,
        fetchLatestMeasurements,
        fetchUserTargets,
      } = await import("$lib/services/biomarkerData");

      let resolveDefinitions!: (v: unknown[]) => void;
      (
        fetchBiomarkerDefinitions as ReturnType<typeof vi.fn>
      ).mockReturnValueOnce(
        new Promise((r) => {
          resolveDefinitions = r;
        }),
      );
      (
        fetchLatestMeasurements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(new Map());
      (fetchUserTargets as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        new Map(),
      );
      (
        fetchBiomarkerMeasurements as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce([]);

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const hydratePromise = store.hydrate();
      expect(store.isLoading).toBe(true);

      resolveDefinitions([]);
      await hydratePromise;

      expect(store.isLoading).toBe(false);
    });

    it("handles hydration errors gracefully", async () => {
      vi.resetModules();
      localStorage.clear();

      const { fetchBiomarkerDefinitions } =
        await import("$lib/services/biomarkerData");
      (
        fetchBiomarkerDefinitions as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("network fail"));

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      await store.hydrate();
      consoleSpy.mockRestore();

      // Should not throw, isLoading should be false after error
      expect(store.isLoading).toBe(false);
    });
  });

  describe("ensureHydrated", () => {
    it("calls hydrate only once", async () => {
      vi.resetModules();
      localStorage.clear();

      const { fetchBiomarkerDefinitions } =
        await import("$lib/services/biomarkerData");

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      store.ensureHydrated();
      store.ensureHydrated();
      store.ensureHydrated();

      // fetchBiomarkerDefinitions called once (from the single hydrate call)
      expect(fetchBiomarkerDefinitions).toHaveBeenCalledTimes(1);
    });
  });

  describe("addMeasurement", () => {
    it("optimistically adds measurement and replaces with supabase result", async () => {
      const def = makeBiomarkerDefinition({ id: "b1" });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));

      vi.resetModules();

      const serverMeasurement = makeBiomarkerMeasurement({
        id: "server-id-1",
        biomarkerId: "b1",
        value: 95,
        date: "2025-02-01",
        unit: "mg/dL",
      });

      const { upsertMeasurement } = await import("$lib/services/biomarkerData");
      (upsertMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        serverMeasurement,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const result = await store.addMeasurement(
        "b1",
        95,
        "2025-02-01",
        "mg/dL",
        "test note",
        "LabCorp",
      );

      expect(result).toEqual(serverMeasurement);
      expect(store.measurements).toHaveLength(1);
      expect(store.measurements[0].id).toBe("server-id-1");
      expect(store.measurements[0].value).toBe(95);
      // Verify localStorage persisted
      const stored = JSON.parse(
        localStorage.getItem("biomarker-measurements")!,
      );
      expect(stored[0].id).toBe("server-id-1");
    });

    it("preserves existing measurements when replacing temp with server result", async () => {
      // Pre-populate with an existing measurement
      const existing = makeBiomarkerMeasurement({
        id: "existing-1",
        biomarkerId: "b1",
        value: 80,
        date: "2025-01-01",
      });
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify([existing]),
      );

      vi.resetModules();

      const serverMeasurement = makeBiomarkerMeasurement({
        id: "server-id-2",
        biomarkerId: "b1",
        value: 95,
        date: "2025-02-01",
        unit: "mg/dL",
      });

      const { upsertMeasurement } = await import("$lib/services/biomarkerData");
      (upsertMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        serverMeasurement,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      expect(store.measurements).toHaveLength(1);

      const result = await store.addMeasurement(
        "b1",
        95,
        "2025-02-01",
        "mg/dL",
      );

      expect(result).toEqual(serverMeasurement);
      expect(store.measurements).toHaveLength(2);
      // Existing measurement should be preserved unchanged
      expect(store.measurements.find((m) => m.id === "existing-1")).toEqual(
        existing,
      );
      // New measurement should be the server result
      expect(store.measurements.find((m) => m.id === "server-id-2")).toEqual(
        serverMeasurement,
      );
    });

    it("keeps temp measurement when supabase returns null", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertMeasurement } = await import("$lib/services/biomarkerData");
      (upsertMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const result = await store.addMeasurement(
        "b1",
        100,
        "2025-02-01",
        "mg/dL",
      );

      expect(result).not.toBeNull();
      expect(result!.value).toBe(100);
      expect(result!.biomarkerId).toBe("b1");
      expect(store.measurements).toHaveLength(1);
      // The temp measurement should stay with its temp id
      expect(store.measurements[0].value).toBe(100);
    });

    it("passes notes and labName to upsert", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertMeasurement } = await import("$lib/services/biomarkerData");
      (upsertMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.addMeasurement(
        "b1",
        100,
        "2025-02-01",
        "mg/dL",
        "fasting",
        "Quest",
      );

      expect(upsertMeasurement).toHaveBeenCalledWith(
        expect.objectContaining({
          biomarkerId: "b1",
          value: 100,
          date: "2025-02-01",
          unit: "mg/dL",
          notes: "fasting",
          labName: "Quest",
        }),
      );
    });

    it("defaults notes and labName to null when omitted", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertMeasurement } = await import("$lib/services/biomarkerData");
      (upsertMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        null,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.addMeasurement("b1", 100, "2025-02-01", "mg/dL");

      expect(upsertMeasurement).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: null,
          labName: null,
        }),
      );
    });
  });

  describe("removeMeasurement", () => {
    it("removes measurement and calls deleteMeasurement service", async () => {
      const m = makeBiomarkerMeasurement({
        id: "m1",
        biomarkerId: "b1",
        value: 90,
      });
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));

      vi.resetModules();

      const { deleteMeasurement } = await import("$lib/services/biomarkerData");
      (deleteMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        true,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      expect(store.measurements).toHaveLength(1);

      const success = await store.removeMeasurement("m1");

      expect(success).toBe(true);
      expect(store.measurements).toHaveLength(0);
      expect(deleteMeasurement).toHaveBeenCalledWith("m1");
    });

    it("rolls back when supabase delete fails", async () => {
      const m = makeBiomarkerMeasurement({
        id: "m1",
        biomarkerId: "b1",
        value: 90,
      });
      localStorage.setItem("biomarker-measurements", JSON.stringify([m]));

      vi.resetModules();

      const { deleteMeasurement } = await import("$lib/services/biomarkerData");
      (deleteMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        false,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const success = await store.removeMeasurement("m1");

      expect(success).toBe(false);
      // Measurement should be restored (rolled back)
      expect(store.measurements).toHaveLength(1);
      expect(store.measurements[0].id).toBe("m1");
    });

    it("does not rollback when deleting nonexistent id", async () => {
      vi.resetModules();
      localStorage.clear();

      const { deleteMeasurement } = await import("$lib/services/biomarkerData");
      (deleteMeasurement as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        false,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const success = await store.removeMeasurement("nonexistent");

      // No rollback since removed was undefined
      expect(success).toBe(false);
      expect(store.measurements).toHaveLength(0);
    });
  });

  describe("setUserTarget", () => {
    it("sets a user target optimistically and calls upsert", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertUserTarget } = await import("$lib/services/biomarkerData");
      (upsertUserTarget as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        true,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const success = await store.setUserTarget("b1", 50, 80, 65, "my target");

      expect(success).toBe(true);
      const target = store.userTargets.get("b1");
      expect(target).toBeDefined();
      expect(target!.biomarkerId).toBe("b1");
      expect(target!.optimalMin).toBe(50);
      expect(target!.optimalMax).toBe(80);
      expect(target!.targetValue).toBe(65);
      expect(target!.notes).toBe("my target");

      expect(upsertUserTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          biomarkerId: "b1",
          optimalMin: 50,
          optimalMax: 80,
          targetValue: 65,
          notes: "my target",
        }),
      );
    });

    it("defaults optional params to null", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertUserTarget } = await import("$lib/services/biomarkerData");
      (upsertUserTarget as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        true,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.setUserTarget("b1");

      expect(upsertUserTarget).toHaveBeenCalledWith(
        expect.objectContaining({
          biomarkerId: "b1",
          optimalMin: null,
          optimalMax: null,
          targetValue: null,
          notes: null,
        }),
      );
    });

    it("preserves existing target id when updating", async () => {
      const target = makeBiomarkerUserTarget({
        id: "existing-id",
        biomarkerId: "b1",
        optimalMax: 80,
      });
      localStorage.setItem(
        "biomarker-targets",
        JSON.stringify([["b1", target]]),
      );

      vi.resetModules();

      const { upsertUserTarget } = await import("$lib/services/biomarkerData");
      (upsertUserTarget as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        true,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.setUserTarget("b1", 60, 90);

      const updated = store.userTargets.get("b1");
      expect(updated!.id).toBe("existing-id");
      expect(updated!.optimalMin).toBe(60);
      expect(updated!.optimalMax).toBe(90);
    });

    it("persists targets to localStorage", async () => {
      vi.resetModules();
      localStorage.clear();

      const { upsertUserTarget } = await import("$lib/services/biomarkerData");
      (upsertUserTarget as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        true,
      );

      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      await store.setUserTarget("b1", 50, 80);

      const stored = JSON.parse(localStorage.getItem("biomarker-targets")!);
      expect(stored).toHaveLength(1);
      expect(stored[0][0]).toBe("b1");
      expect(stored[0][1].optimalMin).toBe(50);
    });
  });

  describe("getHistory", () => {
    it("returns measurements for a biomarker sorted by date desc", async () => {
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 90,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 85,
          date: "2025-01-20",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b2",
          value: 60,
          date: "2025-01-15",
        }),
      ];
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const history = store.getHistory("b1");
      expect(history).toHaveLength(2);
      expect(history[0].date).toBe("2025-01-20");
      expect(history[1].date).toBe("2025-01-10");
    });

    it("respects limit parameter", async () => {
      const measurements = [
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 90,
          date: "2025-01-10",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 85,
          date: "2025-01-20",
        }),
        makeBiomarkerMeasurement({
          biomarkerId: "b1",
          value: 80,
          date: "2025-01-30",
        }),
      ];
      localStorage.setItem(
        "biomarker-measurements",
        JSON.stringify(measurements),
      );

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      const history = store.getHistory("b1", 2);
      expect(history).toHaveLength(2);
      expect(history[0].date).toBe("2025-01-30");
    });

    it("returns empty array for unknown biomarker", async () => {
      vi.resetModules();
      localStorage.clear();
      const mod = await import("$lib/stores/biomarker.svelte");
      expect(mod.biomarkerStore.getHistory("nonexistent")).toEqual([]);
    });
  });

  describe("getDefinition", () => {
    it("returns definition by id", async () => {
      const def = makeBiomarkerDefinition({ id: "b1", name: "ApoB" });
      localStorage.setItem("biomarker-definitions", JSON.stringify([def]));

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");

      expect(mod.biomarkerStore.getDefinition("b1")).toEqual(def);
    });

    it("returns undefined for unknown id", async () => {
      vi.resetModules();
      localStorage.clear();
      const mod = await import("$lib/stores/biomarker.svelte");

      expect(mod.biomarkerStore.getDefinition("nonexistent")).toBeUndefined();
    });
  });

  describe("setCategory / filteredBiomarkers", () => {
    it("defaults to showing all biomarkers", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", category: "cardiovascular" }),
        makeBiomarkerDefinition({ id: "b2", category: "metabolic" }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      expect(store.selectedCategory).toBe("all");
      expect(store.filteredBiomarkers).toHaveLength(2);
    });

    it("filters biomarkers after setCategory", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", category: "cardiovascular" }),
        makeBiomarkerDefinition({ id: "b2", category: "metabolic" }),
        makeBiomarkerDefinition({ id: "b3", category: "cardiovascular" }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      store.setCategory("cardiovascular");
      expect(store.selectedCategory).toBe("cardiovascular");
      expect(store.filteredBiomarkers).toHaveLength(2);
      expect(
        store.filteredBiomarkers.every((b) => b.category === "cardiovascular"),
      ).toBe(true);
    });

    it("returns all when category set back to all", async () => {
      const defs = [
        makeBiomarkerDefinition({ id: "b1", category: "cardiovascular" }),
        makeBiomarkerDefinition({ id: "b2", category: "metabolic" }),
      ];
      localStorage.setItem("biomarker-definitions", JSON.stringify(defs));

      vi.resetModules();
      const mod = await import("$lib/stores/biomarker.svelte");
      const store = mod.biomarkerStore;

      store.setCategory("cardiovascular");
      expect(store.filteredBiomarkers).toHaveLength(1);

      store.setCategory("all");
      expect(store.filteredBiomarkers).toHaveLength(2);
    });
  });
});
