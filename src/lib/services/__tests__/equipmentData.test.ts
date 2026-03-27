import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  fetchEquipment,
  addEquipment,
  updateEquipment,
  deleteEquipment,
  setFavoriteEquipment,
  fetchFavoriteGlucoseMeter,
} from "$lib/services/equipmentData";

beforeEach(() => {
  mockSb.__resetTableResults();
});

const sampleRow = {
  id: 1,
  type: "glucose_meter",
  maker: "Accu-Chek",
  model: "Guide",
  quantity: 1,
  expiry_date: null,
  notes: "Primary meter",
  is_favorite: false,
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-01-15T00:00:00Z",
};

const sampleStripsRow = {
  id: 2,
  type: "glucose_strips",
  maker: "Accu-Chek",
  model: "Guide",
  quantity: 50,
  expiry_date: "2025-12-31",
  notes: null,
  is_favorite: false,
  created_at: "2025-01-15T00:00:00Z",
  updated_at: "2025-01-15T00:00:00Z",
};

describe("fetchEquipment", () => {
  it("returns mapped equipment list", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [sampleRow, sampleStripsRow],
      error: null,
    });

    const result = await fetchEquipment();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].type).toBe("glucose_meter");
    expect(result[0].maker).toBe("Accu-Chek");
    expect(result[0].model).toBe("Guide");
    expect(result[0].quantity).toBe(1);
    expect(result[0].expiry_date).toBeNull();
    expect(result[0].notes).toBe("Primary meter");
    expect(result[1].quantity).toBe(50);
    expect(result[1].expiry_date).toBe("2025-12-31");
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchEquipment();
    expect(result).toEqual([]);
  });
});

describe("addEquipment", () => {
  it("returns the created equipment item", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: sampleRow,
      error: null,
    });

    const result = await addEquipment({
      type: "glucose_meter",
      maker: "Accu-Chek",
      model: "Guide",
      quantity: 1,
      expiry_date: null,
      notes: "Primary meter",
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.maker).toBe("Accu-Chek");
    expect(mockSb.from).toHaveBeenCalledWith("test_equipment");
  });

  it("handles null maker/model in equipmentToRow", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: { ...sampleRow, maker: null, model: null },
      error: null,
    });

    const result = await addEquipment({
      type: "glucose_meter",
      maker: null,
      model: null,
      quantity: 1,
      expiry_date: null,
      notes: null,
    });
    expect(result).not.toBeNull();
    expect(result?.maker).toBeNull();
    expect(result?.model).toBeNull();
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    const result = await addEquipment({
      type: "glucose_meter",
      maker: "Accu-Chek",
      model: "Guide",
      quantity: 1,
      expiry_date: null,
      notes: null,
    });
    expect(result).toBeNull();
  });
});

describe("updateEquipment", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await updateEquipment(1, { quantity: 49 });
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("test_equipment");
  });

  it("handles all updatable fields", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await updateEquipment(1, {
      type: "ketone_meter",
      maker: "Keto-Mojo",
      model: "GK+",
      quantity: 1,
      expiry_date: "2026-06-01",
      notes: "Updated",
    });
    expect(result).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    const result = await updateEquipment(1, { quantity: 49 });
    expect(result).toBe(false);
  });
});

describe("deleteEquipment", () => {
  it("returns true on success", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    expect(await deleteEquipment(1)).toBe(true);
  });

  it("returns false on error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    expect(await deleteEquipment(1)).toBe(false);
  });
});

describe("null-data coalesce", () => {
  it("fetchEquipment returns [] when data is null (no error)", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await fetchEquipment();
    expect(result).toEqual([]);
  });

  it("rowToEquipment defaults quantity to 1 when null", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleRow, quantity: null }],
      error: null,
    });
    const result = await fetchEquipment();
    expect(result[0].quantity).toBe(1);
  });
});

describe("is_favorite in row mapper", () => {
  it("maps is_favorite from row", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleRow, is_favorite: true }],
      error: null,
    });
    const result = await fetchEquipment();
    expect(result[0].is_favorite).toBe(true);
  });

  it("defaults is_favorite to false when null", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleRow, is_favorite: null }],
      error: null,
    });
    const result = await fetchEquipment();
    expect(result[0].is_favorite).toBe(false);
  });

  it("updateEquipment handles is_favorite field", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await updateEquipment(1, { is_favorite: true });
    expect(result).toBe(true);
  });

  it("addEquipment includes is_favorite in row", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: { ...sampleRow, is_favorite: true },
      error: null,
    });
    const result = await addEquipment({
      type: "glucose_meter",
      maker: "Test",
      model: null,
      quantity: 1,
      expiry_date: null,
      notes: null,
      is_favorite: true,
    });
    expect(result).not.toBeNull();
    expect(result?.is_favorite).toBe(true);
  });
});

describe("setFavoriteEquipment", () => {
  it("clears existing favorites and sets new one", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await setFavoriteEquipment(1);
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("test_equipment");
  });

  it("returns false on clear error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    const result = await setFavoriteEquipment(1);
    expect(result).toBe(false);
  });

  it("returns false on set error (clear succeeds)", async () => {
    // First call (clear) succeeds, second call (set) fails
    let callCount = 0;
    const { createMockSupabase } = await import("../../../test/mocks/supabase");
    const successMock = createMockSupabase({ data: null, error: null });
    const errorMock = createMockSupabase({
      data: null,
      error: { message: "set err" },
    });
    mockSb.from.mockImplementation((table: string) => {
      callCount++;
      if (callCount === 1) return successMock.from(table);
      return errorMock.from(table);
    });
    const result = await setFavoriteEquipment(1);
    expect(result).toBe(false);
  });
});

describe("fetchFavoriteGlucoseMeter", () => {
  it("returns favorite glucose_meter", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleRow, is_favorite: true, type: "glucose_meter" }],
      error: null,
    });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.is_favorite).toBe(true);
  });

  it("returns favorite dual_meter", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleRow, is_favorite: true, type: "dual_meter" }],
      error: null,
    });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).not.toBeNull();
  });

  it("returns null when no meters found (strips only)", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: [{ ...sampleStripsRow, is_favorite: true }],
      error: null,
    });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).toBeNull();
  });

  it("returns null when data is empty", async () => {
    mockSb.__setTableResult("test_equipment", { data: [], error: null });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).toBeNull();
  });

  it("returns null when data is null", async () => {
    mockSb.__setTableResult("test_equipment", { data: null, error: null });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).toBeNull();
  });

  it("returns null on error", async () => {
    mockSb.__setTableResult("test_equipment", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchFavoriteGlucoseMeter();
    expect(result).toBeNull();
  });
});

describe("with null supabase", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
  });

  it("fetchEquipment returns []", async () => {
    const { fetchEquipment } = await import("$lib/services/equipmentData");
    expect(await fetchEquipment()).toEqual([]);
  });

  it("addEquipment returns null", async () => {
    const { addEquipment } = await import("$lib/services/equipmentData");
    expect(
      await addEquipment({
        type: "glucose_meter",
        maker: null,
        model: null,
        quantity: 1,
        expiry_date: null,
        notes: null,
        is_favorite: false,
      }),
    ).toBeNull();
  });

  it("updateEquipment returns false", async () => {
    const { updateEquipment } = await import("$lib/services/equipmentData");
    expect(await updateEquipment(1, { quantity: 1 })).toBe(false);
  });

  it("deleteEquipment returns false", async () => {
    const { deleteEquipment } = await import("$lib/services/equipmentData");
    expect(await deleteEquipment(1)).toBe(false);
  });

  it("setFavoriteEquipment returns false", async () => {
    const { setFavoriteEquipment } =
      await import("$lib/services/equipmentData");
    expect(await setFavoriteEquipment(1)).toBe(false);
  });

  it("fetchFavoriteGlucoseMeter returns null", async () => {
    const { fetchFavoriteGlucoseMeter } =
      await import("$lib/services/equipmentData");
    expect(await fetchFavoriteGlucoseMeter()).toBeNull();
  });
});
