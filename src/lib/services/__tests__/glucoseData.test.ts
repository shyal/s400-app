import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  toMgDl,
  toMmolL,
  fetchGlucoseReadings,
  addGlucoseReading,
  deleteGlucoseReading,
  decrementMatchingStrips,
  fetchGlucoseReadingsRange,
  fetchGlucoseModelParams,
  upsertGlucoseModelParams,
} from "$lib/services/glucoseData";

beforeEach(() => {
  mockSb.__resetTableResults();
});

const sampleRow = {
  id: "abc-123",
  date: "2025-01-15",
  time: "13:00",
  value: 5.5,
  unit: "mmol/L",
  equipment_id: null,
  notes: null,
  reading_type: "random",
  created_at: "2025-01-15T13:00:00Z",
};

// ── Unit Conversion ──

describe("toMgDl", () => {
  it("converts mmol/L to mg/dL", () => {
    expect(toMgDl(5.5, "mmol/L")).toBeCloseTo(99.1, 0);
  });

  it("returns mg/dL unchanged", () => {
    expect(toMgDl(100, "mg/dL")).toBe(100);
  });
});

describe("toMmolL", () => {
  it("converts mg/dL to mmol/L", () => {
    expect(toMmolL(100, "mg/dL")).toBeCloseTo(5.6, 0);
  });

  it("returns mmol/L unchanged", () => {
    expect(toMmolL(5.5, "mmol/L")).toBe(5.5);
  });
});

// ── fetchGlucoseReadings ──

describe("fetchGlucoseReadings", () => {
  it("returns mapped readings list ordered by time", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [
        sampleRow,
        { ...sampleRow, id: "def-456", time: "14:00", value: 6.2 },
      ],
      error: null,
    });

    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("abc-123");
    expect(result[0].value).toBe(5.5);
    expect(result[0].unit).toBe("mmol/L");
    expect(result[0].equipment_id).toBeNull();
    expect(result[0].notes).toBeNull();
    expect(result[1].value).toBe(6.2);
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null (no error)", async () => {
    mockSb.__setTableResult("glucose_readings", { data: null, error: null });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result).toEqual([]);
  });
});

// ── addGlucoseReading ──

describe("addGlucoseReading", () => {
  it("returns the created reading", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: sampleRow,
      error: null,
    });

    const result = await addGlucoseReading({
      date: "2025-01-15",
      time: "13:00",
      value: 5.5,
      unit: "mmol/L",
      equipment_id: null,
      notes: null,
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe("abc-123");
    expect(result?.value).toBe(5.5);
    expect(mockSb.from).toHaveBeenCalledWith("glucose_readings");
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: null,
      error: { message: "err" },
    });
    const result = await addGlucoseReading({
      date: "2025-01-15",
      time: "13:00",
      value: 5.5,
      unit: "mmol/L",
      equipment_id: null,
      notes: null,
    });
    expect(result).toBeNull();
  });

  it("handles equipment_id and notes", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: { ...sampleRow, equipment_id: 42, notes: "post meal" },
      error: null,
    });

    const result = await addGlucoseReading({
      date: "2025-01-15",
      time: "13:00",
      value: 7.2,
      unit: "mmol/L",
      equipment_id: 42,
      notes: "post meal",
    });
    expect(result?.equipment_id).toBe(42);
    expect(result?.notes).toBe("post meal");
  });
});

// ── deleteGlucoseReading ──

describe("deleteGlucoseReading", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("glucose_readings", { data: null, error: null });
    expect(await deleteGlucoseReading("abc-123")).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: null,
      error: { message: "err" },
    });
    expect(await deleteGlucoseReading("abc-123")).toBe(false);
  });
});

// ── decrementMatchingStrips ──

describe("decrementMatchingStrips", () => {
  it("decrements strip quantity for matching maker", async () => {
    // First call: fetch strips
    mockSb.__setTableResult("test_equipment", {
      data: [
        { id: 10, type: "glucose_strips", maker: "Sinocare", quantity: 50 },
      ],
      error: null,
    });

    const result = await decrementMatchingStrips("Sinocare");
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("test_equipment");
  });

  it("returns false when maker is null", async () => {
    expect(await decrementMatchingStrips(null)).toBe(false);
  });

  it("returns false when no strips found (empty data)", async () => {
    mockSb.__setTableResult("test_equipment", { data: [], error: null });
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });

  it("returns false when fetch errors", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });

  it("returns false when strip quantity is 0", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [
        { id: 10, type: "glucose_strips", maker: "Sinocare", quantity: 0 },
      ],
      error: null,
    });
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });

  it("returns false when update fails", async () => {
    // First call (select) returns strips, second call (update) fails
    let callCount = 0;
    const { createMockSupabase } = await import("../../../test/mocks/supabase");
    const selectMock = createMockSupabase({
      data: [
        { id: 10, type: "glucose_strips", maker: "Sinocare", quantity: 50 },
      ],
      error: null,
    });
    const updateMock = createMockSupabase({
      data: null,
      error: { message: "update err" },
    });
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (callCount === 1) return selectMock.from(table);
      return updateMock.from(table);
    });
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });

  it("returns false when data is null (no error)", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });
});

// ── fetchGlucoseReadingsRange ──

describe("fetchGlucoseReadingsRange", () => {
  it("returns readings within date range", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [sampleRow, { ...sampleRow, id: "def-456", date: "2025-01-16" }],
      error: null,
    });
    const result = await fetchGlucoseReadingsRange("2025-01-15", "2025-01-16");
    expect(result).toHaveLength(2);
  });

  it("returns empty on error", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: null,
      error: { message: "err" },
    });
    expect(await fetchGlucoseReadingsRange("2025-01-15", "2025-01-16")).toEqual(
      [],
    );
  });

  it("returns empty for null data", async () => {
    mockSb.__setTableResult("glucose_readings", { data: null, error: null });
    expect(await fetchGlucoseReadingsRange("2025-01-15", "2025-01-16")).toEqual(
      [],
    );
  });
});

// ── fetchGlucoseModelParams ──

describe("fetchGlucoseModelParams", () => {
  it("returns mapped model params", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: {
        fasting_baseline_mgdl: 92,
        carb_sensitivity: 3.5,
        protein_sensitivity: 0.8,
        fat_delay_factor: 1.2,
        exercise_reduction_pct: 25,
        gym_sensitivity_hours: 36,
        gym_sensitivity_pct: 15,
        circadian_evening_pct: 10,
        dawn_phenomenon_mgdl: 8,
        peak_time_min: 28,
        curve_shape_k: 2,
        data_points_used: 12,
        last_fit_at: "2025-01-15T00:00:00Z",
      },
      error: null,
    });
    const result = await fetchGlucoseModelParams();
    expect(result).not.toBeNull();
    expect(result?.fasting_baseline_mgdl).toBe(92);
    expect(result?.carb_sensitivity).toBe(3.5);
    expect(result?.data_points_used).toBe(12);
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: null,
      error: { message: "err" },
    });
    expect(await fetchGlucoseModelParams()).toBeNull();
  });

  it("returns null when no data", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: null,
      error: null,
    });
    expect(await fetchGlucoseModelParams()).toBeNull();
  });

  it("handles null last_fit_at", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: {
        fasting_baseline_mgdl: 90,
        carb_sensitivity: 4.0,
        protein_sensitivity: 0.7,
        fat_delay_factor: 1.0,
        exercise_reduction_pct: 30,
        gym_sensitivity_hours: 36,
        gym_sensitivity_pct: 15,
        circadian_evening_pct: 10,
        dawn_phenomenon_mgdl: 10,
        peak_time_min: 30,
        curve_shape_k: 2,
        data_points_used: 0,
        last_fit_at: null,
      },
      error: null,
    });
    const result = await fetchGlucoseModelParams();
    expect(result?.last_fit_at).toBeNull();
  });
});

// ── upsertGlucoseModelParams ──

describe("upsertGlucoseModelParams", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: null,
      error: null,
    });
    const params = {
      fasting_baseline_mgdl: 90,
      carb_sensitivity: 4.0,
      protein_sensitivity: 0.7,
      fat_delay_factor: 1.0,
      exercise_reduction_pct: 30,
      gym_sensitivity_hours: 36,
      gym_sensitivity_pct: 15,
      circadian_evening_pct: 10,
      dawn_phenomenon_mgdl: 10,
      peak_time_min: 30,
      curve_shape_k: 2,
      data_points_used: 0,
      last_fit_at: null,
    };
    expect(await upsertGlucoseModelParams(params)).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("glucose_model_params", {
      data: null,
      error: { message: "err" },
    });
    const params = {
      fasting_baseline_mgdl: 90,
      carb_sensitivity: 4.0,
      protein_sensitivity: 0.7,
      fat_delay_factor: 1.0,
      exercise_reduction_pct: 30,
      gym_sensitivity_hours: 36,
      gym_sensitivity_pct: 15,
      circadian_evening_pct: 10,
      dawn_phenomenon_mgdl: 10,
      peak_time_min: 30,
      curve_shape_k: 2,
      data_points_used: 0,
      last_fit_at: null,
    };
    expect(await upsertGlucoseModelParams(params)).toBe(false);
  });
});

// ── rowToReading null coalesce ──

describe("rowToReading null coalesce", () => {
  it("defaults unit to mmol/L when null", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [{ ...sampleRow, unit: null }],
      error: null,
    });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result[0].unit).toBe("mmol/L");
  });

  it("converts value to number", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [{ ...sampleRow, value: "5.5" }],
      error: null,
    });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result[0].value).toBe(5.5);
    expect(typeof result[0].value).toBe("number");
  });

  it("maps reading_type from row", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [{ ...sampleRow, reading_type: "fasting" }],
      error: null,
    });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result[0].reading_type).toBe("fasting");
  });

  it("defaults reading_type to random when null", async () => {
    mockSb.__setTableResult("glucose_readings", {
      data: [{ ...sampleRow, reading_type: null }],
      error: null,
    });
    const result = await fetchGlucoseReadings("2025-01-15");
    expect(result[0].reading_type).toBe("random");
  });
});

// ── With null supabase ──

describe("with null supabase", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
  });

  it("fetchGlucoseReadings returns []", async () => {
    const { fetchGlucoseReadings } = await import("$lib/services/glucoseData");
    expect(await fetchGlucoseReadings("2025-01-15")).toEqual([]);
  });

  it("addGlucoseReading returns null", async () => {
    const { addGlucoseReading } = await import("$lib/services/glucoseData");
    expect(
      await addGlucoseReading({
        date: "2025-01-15",
        time: "13:00",
        value: 5.5,
        unit: "mmol/L",
        equipment_id: null,
        notes: null,
      }),
    ).toBeNull();
  });

  it("deleteGlucoseReading returns false", async () => {
    const { deleteGlucoseReading } = await import("$lib/services/glucoseData");
    expect(await deleteGlucoseReading("abc")).toBe(false);
  });

  it("decrementMatchingStrips returns false", async () => {
    const { decrementMatchingStrips } =
      await import("$lib/services/glucoseData");
    expect(await decrementMatchingStrips("Sinocare")).toBe(false);
  });

  it("fetchGlucoseReadingsRange returns []", async () => {
    const { fetchGlucoseReadingsRange } =
      await import("$lib/services/glucoseData");
    expect(await fetchGlucoseReadingsRange("2025-01-15", "2025-01-16")).toEqual(
      [],
    );
  });

  it("fetchGlucoseModelParams returns null", async () => {
    const { fetchGlucoseModelParams } =
      await import("$lib/services/glucoseData");
    expect(await fetchGlucoseModelParams()).toBeNull();
  });

  it("upsertGlucoseModelParams returns false", async () => {
    const { upsertGlucoseModelParams } =
      await import("$lib/services/glucoseData");
    const params = {
      fasting_baseline_mgdl: 90,
      carb_sensitivity: 4.0,
      protein_sensitivity: 0.7,
      fat_delay_factor: 1.0,
      exercise_reduction_pct: 30,
      gym_sensitivity_hours: 36,
      gym_sensitivity_pct: 15,
      circadian_evening_pct: 10,
      dawn_phenomenon_mgdl: 10,
      peak_time_min: 30,
      curve_shape_k: 2,
      data_points_used: 0,
      last_fit_at: null,
    };
    expect(await upsertGlucoseModelParams(params)).toBe(false);
  });
});
