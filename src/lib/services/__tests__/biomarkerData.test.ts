import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  fetchBiomarkerDefinitions,
  fetchBiomarkerMeasurements,
  fetchLatestMeasurements,
  upsertMeasurement,
  deleteMeasurement,
  fetchUserTargets,
  upsertUserTarget,
} from "$lib/services/biomarkerData";

beforeEach(() => {
  mockSb.__resetTableResults();
});

describe("fetchBiomarkerDefinitions", () => {
  it("returns mapped definitions", async () => {
    mockSb.__setTableResult("biomarker_definitions", {
      data: [
        {
          id: "b1",
          name: "LDL-C",
          category: "cardiovascular",
          unit: "mg/dL",
          unit_alt: null,
          optimal_min: null,
          optimal_max: 100,
          warning_min: null,
          warning_max: 130,
          test_frequency_days: 180,
          description: "LDL",
          display_order: 1,
        },
      ],
      error: null,
    });

    const result = await fetchBiomarkerDefinitions();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("LDL-C");
    expect(result[0].optimalMax).toBe(100);
    expect(result[0].warningMax).toBe(130);
    expect(result[0].testFrequencyDays).toBe(180);
  });

  it("returns empty on error", async () => {
    mockSb.__setTableResult("biomarker_definitions", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchBiomarkerDefinitions();
    expect(result).toEqual([]);
  });
});

describe("fetchBiomarkerMeasurements", () => {
  it("returns mapped measurements", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: [
        {
          id: "m1",
          user_id: "u1",
          biomarker_id: "b1",
          date: "2025-01-15",
          value: 90,
          unit: "mg/dL",
          notes: null,
          lab_name: null,
          created_at: "2025-01-15T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await fetchBiomarkerMeasurements();
    expect(result).toHaveLength(1);
    expect(result[0].biomarkerId).toBe("b1");
    expect(result[0].value).toBe(90);
  });

  it("filters by biomarkerId when provided", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: [
        {
          id: "m1",
          user_id: "u1",
          biomarker_id: "b1",
          date: "2025-01-15",
          value: 90,
          unit: "mg/dL",
          notes: null,
          lab_name: null,
          created_at: "2025-01-15T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
      ],
      error: null,
    });
    const result = await fetchBiomarkerMeasurements("b1");
    expect(result).toHaveLength(1);
  });

  it("applies limit when provided", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: [],
      error: null,
    });
    const result = await fetchBiomarkerMeasurements(undefined, 5);
    expect(result).toEqual([]);
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchBiomarkerMeasurements();
    expect(result).toEqual([]);
  });
});

describe("fetchLatestMeasurements", () => {
  it("returns map keyed by biomarkerId", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: [
        {
          id: "m1",
          user_id: "u1",
          biomarker_id: "b1",
          date: "2025-01-15",
          value: 90,
          unit: "mg/dL",
          notes: null,
          lab_name: null,
          created_at: "2025-01-15T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
        {
          id: "m2",
          user_id: "u1",
          biomarker_id: "b1",
          date: "2025-01-10",
          value: 95,
          unit: "mg/dL",
          notes: null,
          lab_name: null,
          created_at: "2025-01-10T00:00:00Z",
          updated_at: "2025-01-10T00:00:00Z",
        },
        {
          id: "m3",
          user_id: "u1",
          biomarker_id: "b2",
          date: "2025-01-15",
          value: 50,
          unit: "mg/dL",
          notes: null,
          lab_name: null,
          created_at: "2025-01-15T00:00:00Z",
          updated_at: "2025-01-15T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await fetchLatestMeasurements();
    expect(result.size).toBe(2);
    expect(result.get("b1")?.value).toBe(90); // first one wins (sorted desc)
    expect(result.get("b2")?.value).toBe(50);
  });
});

describe("fetchLatestMeasurements error", () => {
  it("returns empty map on error", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchLatestMeasurements();
    expect(result.size).toBe(0);
  });
});

describe("upsertMeasurement", () => {
  it("returns the created measurement", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: {
        id: "m-new",
        user_id: "u1",
        biomarker_id: "b1",
        date: "2025-01-15",
        value: 85,
        unit: "mg/dL",
        notes: null,
        lab_name: null,
        created_at: "2025-01-15T00:00:00Z",
        updated_at: "2025-01-15T00:00:00Z",
      },
      error: null,
    });

    const result = await upsertMeasurement({
      userId: "u1",
      biomarkerId: "b1",
      date: "2025-01-15",
      value: 85,
      unit: "mg/dL",
    });
    expect(result).not.toBeNull();
    expect(result?.value).toBe(85);
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertMeasurement({
      userId: "u1",
      biomarkerId: "b1",
      date: "2025-01-15",
      value: 85,
      unit: "mg/dL",
    });
    expect(result).toBeNull();
  });
});

describe("deleteMeasurement", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: null,
    });
    expect(await deleteMeasurement("m1")).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: { message: "err" },
    });
    expect(await deleteMeasurement("m1")).toBe(false);
  });
});

describe("fetchUserTargets", () => {
  it("returns map of user targets", async () => {
    mockSb.__setTableResult("biomarker_user_targets", {
      data: [
        {
          id: "t1",
          user_id: "u1",
          biomarker_id: "b1",
          optimal_min: 50,
          optimal_max: 80,
          target_value: 70,
          notes: null,
        },
      ],
      error: null,
    });

    const result = await fetchUserTargets();
    expect(result.size).toBe(1);
    expect(result.get("b1")?.optimalMax).toBe(80);
  });
});

describe("fetchUserTargets error", () => {
  it("returns empty map on error", async () => {
    mockSb.__setTableResult("biomarker_user_targets", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchUserTargets();
    expect(result.size).toBe(0);
  });
});

describe("upsertUserTarget", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("biomarker_user_targets", {
      data: null,
      error: null,
    });
    const result = await upsertUserTarget({
      userId: "u1",
      biomarkerId: "b1",
      optimalMin: 50,
      optimalMax: 80,
    });
    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("biomarker_user_targets", {
      data: null,
      error: { message: "err" },
    });
    const result = await upsertUserTarget({
      userId: "u1",
      biomarkerId: "b1",
    });
    expect(result).toBe(false);
  });
});

describe("null-data coalesce and row field defaults", () => {
  it("fetchBiomarkerDefinitions returns [] when data is null (no error)", async () => {
    mockSb.__setTableResult("biomarker_definitions", {
      data: null,
      error: null,
    });
    const result = await fetchBiomarkerDefinitions();
    expect(result).toEqual([]);
  });

  it("fetchBiomarkerDefinitions handles null test_frequency_days and display_order", async () => {
    mockSb.__setTableResult("biomarker_definitions", {
      data: [
        {
          id: "b1",
          name: "Test",
          category: "cardiovascular",
          unit: "mg/dL",
          unit_alt: null,
          optimal_min: null,
          optimal_max: null,
          warning_min: null,
          warning_max: null,
          test_frequency_days: null,
          description: null,
          display_order: null,
        },
      ],
      error: null,
    });
    const result = await fetchBiomarkerDefinitions();
    expect(result).toHaveLength(1);
    expect(result[0].testFrequencyDays).toBe(365);
    expect(result[0].displayOrder).toBe(0);
  });

  it("fetchBiomarkerMeasurements returns [] when data is null (no error)", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: null,
    });
    const result = await fetchBiomarkerMeasurements();
    expect(result).toEqual([]);
  });

  it("fetchLatestMeasurements returns empty map when data is null (no error)", async () => {
    mockSb.__setTableResult("biomarker_measurements", {
      data: null,
      error: null,
    });
    const result = await fetchLatestMeasurements();
    expect(result.size).toBe(0);
  });

  it("fetchUserTargets returns empty map when data is null (no error)", async () => {
    mockSb.__setTableResult("biomarker_user_targets", {
      data: null,
      error: null,
    });
    const result = await fetchUserTargets();
    expect(result.size).toBe(0);
  });
});

describe("with null supabase", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
  });

  it("fetchBiomarkerDefinitions returns []", async () => {
    const { fetchBiomarkerDefinitions } =
      await import("$lib/services/biomarkerData");
    expect(await fetchBiomarkerDefinitions()).toEqual([]);
  });

  it("fetchBiomarkerMeasurements returns []", async () => {
    const { fetchBiomarkerMeasurements } =
      await import("$lib/services/biomarkerData");
    expect(await fetchBiomarkerMeasurements()).toEqual([]);
  });

  it("fetchLatestMeasurements returns empty map", async () => {
    const { fetchLatestMeasurements } =
      await import("$lib/services/biomarkerData");
    expect((await fetchLatestMeasurements()).size).toBe(0);
  });

  it("upsertMeasurement returns null", async () => {
    const { upsertMeasurement } = await import("$lib/services/biomarkerData");
    expect(
      await upsertMeasurement({
        userId: "",
        biomarkerId: "",
        date: "",
        value: 0,
        unit: "",
      } as any),
    ).toBeNull();
  });

  it("deleteMeasurement returns false", async () => {
    const { deleteMeasurement } = await import("$lib/services/biomarkerData");
    expect(await deleteMeasurement("x")).toBe(false);
  });

  it("fetchUserTargets returns empty map", async () => {
    const { fetchUserTargets } = await import("$lib/services/biomarkerData");
    expect((await fetchUserTargets()).size).toBe(0);
  });

  it("upsertUserTarget returns false", async () => {
    const { upsertUserTarget } = await import("$lib/services/biomarkerData");
    expect(await upsertUserTarget({ userId: "", biomarkerId: "" } as any)).toBe(
      false,
    );
  });
});
