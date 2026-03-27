import type {
  BiomarkerDefinition,
  BiomarkerMeasurement,
  BiomarkerUserTarget,
  BiomarkerWithLatest,
  BiomarkerCategory,
  BiomarkerStatus,
  BiomarkerTrend,
} from "$lib/types";
import { uuid } from "$lib/uuid";
import {
  fetchBiomarkerDefinitions,
  fetchBiomarkerMeasurements,
  fetchLatestMeasurements,
  upsertMeasurement,
  deleteMeasurement,
  fetchUserTargets,
  upsertUserTarget,
} from "$lib/services/biomarkerData";

const DEFINITIONS_KEY = "biomarker-definitions";
const MEASUREMENTS_KEY = "biomarker-measurements";
const TARGETS_KEY = "biomarker-targets";

function loadJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

function calculateStatus(
  value: number | undefined,
  def: BiomarkerDefinition,
  userTarget?: BiomarkerUserTarget | null,
): BiomarkerStatus {
  if (value === undefined) return "unknown";

  // Use user targets if available, otherwise use definition defaults
  const optMin = userTarget?.optimalMin ?? def.optimalMin;
  const optMax = userTarget?.optimalMax ?? def.optimalMax;
  const warnMin = def.warningMin;
  const warnMax = def.warningMax;

  // Check optimal range
  const inOptimal =
    (optMin === null || optMin === undefined || value >= optMin) &&
    (optMax === null || optMax === undefined || value <= optMax);
  if (inOptimal) return "optimal";

  // Check warning range
  const inWarning =
    (warnMin === null || warnMin === undefined || value >= warnMin) &&
    (warnMax === null || warnMax === undefined || value <= warnMax);
  if (inWarning) return "warning";

  return "critical";
}

function calculateTrend(
  measurements: BiomarkerMeasurement[],
  def: BiomarkerDefinition,
): BiomarkerTrend {
  if (measurements.length < 2) return "unknown";

  // Get latest 2 measurements
  const sorted = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  const current = sorted[0].value;
  const previous = sorted[1].value;
  const change = current - previous;

  // Less than 5% change is considered stable
  const threshold = Math.abs(previous) * 0.05 || 1;
  if (Math.abs(change) < threshold) return "stable";

  // Determine if change is improving or worsening based on marker type
  // For most markers: lower is better (ApoB, LDL, HbA1c, hs-CRP, etc.)
  // For some markers: higher is better (HDL, VO2 Max, Grip Strength, eGFR)
  const higherIsBetter = [
    "HDL-C",
    "VO2 Max",
    "Grip Strength",
    "Gait Speed",
    "eGFR",
    "NAD+",
    "Telomere Length",
  ].includes(def.name);

  if (higherIsBetter) {
    return change > 0 ? "improving" : "worsening";
  } else {
    return change < 0 ? "improving" : "worsening";
  }
}

function createBiomarkerStore() {
  let definitions = $state<BiomarkerDefinition[]>(
    loadJson(DEFINITIONS_KEY, []),
  );
  let measurements = $state<BiomarkerMeasurement[]>(
    loadJson(MEASUREMENTS_KEY, []),
  );
  let userTargets = $state<Map<string, BiomarkerUserTarget>>(new Map());
  let selectedCategory = $state<BiomarkerCategory | "all">("all");
  let isLoading = $state(false);

  function saveDefinitions() {
    saveJson(DEFINITIONS_KEY, definitions);
  }
  function saveMeasurements() {
    saveJson(MEASUREMENTS_KEY, measurements);
  }
  function saveTargets() {
    saveJson(TARGETS_KEY, Array.from(userTargets.entries()));
  }

  // Load targets from localStorage
  const storedTargets = loadJson<[string, BiomarkerUserTarget][]>(
    TARGETS_KEY,
    [],
  );
  userTargets = new Map(storedTargets);

  // ── Derived values ──

  function getBiomarkersWithLatest(): BiomarkerWithLatest[] {
    return definitions.map((def) => {
      const biomarkerMeasurements = measurements.filter(
        (m) => m.biomarkerId === def.id,
      );
      const sorted = [...biomarkerMeasurements].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      const latest = sorted[0] ?? null;
      const userTarget = userTargets.get(def.id) ?? null;

      let daysSinceTest: number | null = null;
      if (latest) {
        const testDate = new Date(latest.date);
        const today = new Date();
        daysSinceTest = Math.floor(
          (today.getTime() - testDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      return {
        ...def,
        latestMeasurement: latest,
        status: calculateStatus(latest?.value, def, userTarget),
        trend: calculateTrend(biomarkerMeasurements, def),
        daysSinceTest,
        userTarget,
      };
    });
  }

  function getFilteredBiomarkers(): BiomarkerWithLatest[] {
    const all = getBiomarkersWithLatest();
    if (selectedCategory === "all") return all;
    return all.filter((b) => b.category === selectedCategory);
  }

  function getCategoryStats(): Record<
    BiomarkerCategory | "all",
    {
      total: number;
      optimal: number;
      warning: number;
      critical: number;
      unknown: number;
    }
  > {
    const all = getBiomarkersWithLatest();
    const categories: (BiomarkerCategory | "all")[] = [
      "all",
      "cardiovascular",
      "metabolic",
      "inflammatory",
      "cellular_aging",
      "functional",
      "other",
    ];

    const stats: Record<
      string,
      {
        total: number;
        optimal: number;
        warning: number;
        critical: number;
        unknown: number;
      }
    > = {};

    for (const cat of categories) {
      const markers =
        cat === "all" ? all : all.filter((b) => b.category === cat);
      stats[cat] = {
        total: markers.length,
        optimal: markers.filter((m) => m.status === "optimal").length,
        warning: markers.filter((m) => m.status === "warning").length,
        critical: markers.filter((m) => m.status === "critical").length,
        unknown: markers.filter((m) => m.status === "unknown").length,
      };
    }

    return stats as Record<
      BiomarkerCategory | "all",
      {
        total: number;
        optimal: number;
        warning: number;
        critical: number;
        unknown: number;
      }
    >;
  }

  function getAttentionItems(): BiomarkerWithLatest[] {
    return getBiomarkersWithLatest()
      .filter(
        (b) =>
          b.status === "critical" ||
          b.status === "warning" ||
          b.trend === "worsening",
      )
      .sort((a, b) => {
        // Sort by severity: critical first, then warning, then worsening trends
        const statusOrder = { critical: 0, warning: 1, optimal: 2, unknown: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }

  function getOverdueTests(): BiomarkerWithLatest[] {
    return getBiomarkersWithLatest().filter((b) => {
      if (b.daysSinceTest === null || b.daysSinceTest === undefined)
        return true; // Never tested
      return b.daysSinceTest > b.testFrequencyDays;
    });
  }

  // ── Actions ──

  async function addMeasurement(
    biomarkerId: string,
    value: number,
    date: string,
    unit: string,
    notes?: string,
    labName?: string,
  ): Promise<BiomarkerMeasurement | null> {
    const m: Omit<BiomarkerMeasurement, "id" | "createdAt" | "updatedAt"> = {
      userId: "", // Will be set by RLS
      biomarkerId,
      date,
      value,
      unit,
      notes: notes ?? null,
      labName: labName ?? null,
    };

    // Optimistic update
    const tempId = uuid();
    const tempMeasurement: BiomarkerMeasurement = { ...m, id: tempId };
    measurements = [...measurements, tempMeasurement];
    saveMeasurements();

    // Sync to Supabase
    const result = await upsertMeasurement(m);
    if (result) {
      // Replace temp with real
      measurements = measurements.map((x) => (x.id === tempId ? result : x));
      saveMeasurements();
      return result;
    }
    return tempMeasurement;
  }

  async function removeMeasurement(id: string): Promise<boolean> {
    // Optimistic update
    const removed = measurements.find((m) => m.id === id);
    measurements = measurements.filter((m) => m.id !== id);
    saveMeasurements();

    const success = await deleteMeasurement(id);
    if (!success && removed) {
      // Rollback
      measurements = [...measurements, removed];
      saveMeasurements();
    }
    return success;
  }

  async function setUserTarget(
    biomarkerId: string,
    optimalMin?: number | null,
    optimalMax?: number | null,
    targetValue?: number | null,
    notes?: string | null,
  ): Promise<boolean> {
    const target: Omit<BiomarkerUserTarget, "id"> = {
      userId: "",
      biomarkerId,
      optimalMin: optimalMin ?? null,
      optimalMax: optimalMax ?? null,
      targetValue: targetValue ?? null,
      notes: notes ?? null,
    };

    // Optimistic update
    const existing = userTargets.get(biomarkerId);
    userTargets.set(biomarkerId, { ...target, id: existing?.id ?? uuid() });
    userTargets = new Map(userTargets);
    saveTargets();

    const success = await upsertUserTarget(target);
    return success;
  }

  function getHistory(
    biomarkerId: string,
    limit?: number,
  ): BiomarkerMeasurement[] {
    const history = measurements
      .filter((m) => m.biomarkerId === biomarkerId)
      .sort((a, b) => b.date.localeCompare(a.date));
    return limit ? history.slice(0, limit) : history;
  }

  function getDefinition(biomarkerId: string): BiomarkerDefinition | undefined {
    return definitions.find((d) => d.id === biomarkerId);
  }

  function setCategory(category: BiomarkerCategory | "all") {
    selectedCategory = category;
  }

  // ── Hydrate from Supabase ──

  let hydrated = false;

  async function hydrate() {
    isLoading = true;
    try {
      const [defs, latest, targets] = await Promise.all([
        fetchBiomarkerDefinitions(),
        fetchLatestMeasurements(),
        fetchUserTargets(),
      ]);

      if (defs.length > 0) {
        definitions = defs;
        saveDefinitions();
      }

      // Fetch all measurements for history
      const allMeasurements = await fetchBiomarkerMeasurements();
      if (allMeasurements.length > 0) {
        measurements = allMeasurements;
        saveMeasurements();
      }

      if (targets.size > 0) {
        userTargets = targets;
        saveTargets();
      }
    } catch (e) {
      console.error("Biomarker hydration error:", e);
    } finally {
      isLoading = false;
    }
  }

  function ensureHydrated() {
    if (hydrated) return;
    hydrated = true;
    hydrate();
  }

  return {
    get definitions() {
      return definitions;
    },
    get measurements() {
      return measurements;
    },
    get userTargets() {
      return userTargets;
    },
    get selectedCategory() {
      return selectedCategory;
    },
    get isLoading() {
      return isLoading;
    },

    get biomarkersWithLatest() {
      return getBiomarkersWithLatest();
    },
    get filteredBiomarkers() {
      return getFilteredBiomarkers();
    },
    get categoryStats() {
      return getCategoryStats();
    },
    get attentionItems() {
      return getAttentionItems();
    },
    get overdueTests() {
      return getOverdueTests();
    },

    addMeasurement,
    removeMeasurement,
    setUserTarget,
    getHistory,
    getDefinition,
    setCategory,
    hydrate,
    ensureHydrated,
  };
}

export const biomarkerStore = createBiomarkerStore();
