import { supabase } from "$lib/supabase";
import type { TestEquipment } from "$lib/types";

export async function fetchEquipment(): Promise<TestEquipment[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("test_equipment")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchEquipment:", error);
    return [];
  }
  return (data ?? []).map(rowToEquipment);
}

export async function addEquipment(
  item: Omit<TestEquipment, "id">,
): Promise<TestEquipment | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("test_equipment")
    .insert(equipmentToRow(item))
    .select()
    .single();
  if (error) {
    console.error("addEquipment:", error);
    return null;
  }
  return rowToEquipment(data);
}

export async function updateEquipment(
  id: number,
  updates: Partial<TestEquipment>,
): Promise<boolean> {
  if (!supabase) return false;
  const row: Record<string, unknown> = {};
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.maker !== undefined) row.maker = updates.maker;
  if (updates.model !== undefined) row.model = updates.model;
  if (updates.quantity !== undefined) row.quantity = updates.quantity;
  if (updates.expiry_date !== undefined) row.expiry_date = updates.expiry_date;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.is_favorite !== undefined) row.is_favorite = updates.is_favorite;
  row.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("test_equipment")
    .update(row)
    .eq("id", id);
  if (error) {
    console.error("updateEquipment:", error);
    return false;
  }
  return true;
}

export async function deleteEquipment(id: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("test_equipment").delete().eq("id", id);
  if (error) {
    console.error("deleteEquipment:", error);
    return false;
  }
  return true;
}

// ── Row Mappers ──

export async function setFavoriteEquipment(id: number): Promise<boolean> {
  if (!supabase) return false;
  // Clear all favorites first
  const { error: clearError } = await supabase
    .from("test_equipment")
    .update({ is_favorite: false, updated_at: new Date().toISOString() })
    .eq("is_favorite", true);
  if (clearError) {
    console.error("setFavoriteEquipment (clear):", clearError);
    return false;
  }
  // Set the new favorite
  const { error } = await supabase
    .from("test_equipment")
    .update({ is_favorite: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("setFavoriteEquipment (set):", error);
    return false;
  }
  return true;
}

export async function fetchFavoriteGlucoseMeter(): Promise<TestEquipment | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("test_equipment")
    .select("*")
    .eq("is_favorite", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchFavoriteGlucoseMeter:", error);
    return null;
  }
  const meters = (data ?? []).filter(
    (r: Record<string, unknown>) =>
      r.type === "glucose_meter" || r.type === "dual_meter",
  );
  if (meters.length === 0) return null;
  return rowToEquipment(meters[0]);
}

// ── Row Mappers ──

function rowToEquipment(row: Record<string, unknown>): TestEquipment {
  return {
    id: row.id as number,
    type: row.type as TestEquipment["type"],
    maker: row.maker as string | null,
    model: row.model as string | null,
    quantity: (row.quantity as number) ?? 1,
    expiry_date: row.expiry_date as string | null,
    notes: row.notes as string | null,
    is_favorite: (row.is_favorite as boolean) ?? false,
  };
}

function equipmentToRow(
  item: Omit<TestEquipment, "id">,
): Record<string, unknown> {
  return {
    type: item.type,
    maker: item.maker ?? null,
    model: item.model ?? null,
    quantity: item.quantity,
    expiry_date: item.expiry_date ?? null,
    notes: item.notes ?? null,
    is_favorite: item.is_favorite ?? false,
  };
}
