import initSqlJs, { type Database } from "sql.js";
import { base } from "$app/paths";
import { runSchema } from "./schema";
import { readDatabase, writeDatabase } from "./opfs";

let db: Database | null = null;
let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file: string) => `${base}/${file}`,
    });
  }
  return sqlPromise;
}

export async function initDb(): Promise<void> {
  if (db) return;

  const SQL = await getSql();
  const existing = await readDatabase();

  if (existing) {
    db = new SQL.Database(existing);
  } else {
    db = new SQL.Database();
  }

  runSchema(db);

  // Seed from exported Supabase data on first run
  if (!existing) {
    await loadSeed();
  }

  await save();
}

// JSON column names that need JSON.stringify when inserting
const JSON_COLS = new Set([
  "exercises",
  "increments",
  "workout_schedule",
  "plateau_exercises",
  "stacks",
]);

const BOOL_COLS = new Set([
  "sound_enabled",
  "vibration_enabled",
  "is_favorite",
]);

async function loadSeed(): Promise<void> {
  try {
    const res = await fetch(`${base}/seed.json`);
    if (!res.ok) return;
    const seed = await res.json();

    const tables = [
      "workouts",
      "exercise_progress",
      "user_settings",
      "recipes",
      "recipe_ingredients",
      "food_entries",
      "water_entries",
      "macro_targets",
      "weight_log",
      "supplement_entries",
      "supplement_stacks",
      "biomarker_definitions",
      "biomarker_measurements",
      "biomarker_user_targets",
      "glucose_readings",
      "glucose_model_params",
      "test_equipment",
      "strava_activities",
    ];

    for (const table of tables) {
      const rows = seed[table];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = keys.map((k) => {
          const v = row[k];
          if (JSON_COLS.has(k) && typeof v === "object" && v !== null)
            return JSON.stringify(v);
          if (BOOL_COLS.has(k)) return v ? 1 : 0;
          return v;
        });
        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT OR IGNORE INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders})`;
        getDb().run(sql, vals as never);
      }
    }

    console.log("Seed data loaded successfully");
  } catch (e) {
    console.warn("Failed to load seed data:", e);
  }
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function run(sql: string, params?: unknown[]): void {
  getDb().run(sql, params as never);
}

export function queryAll<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): T[] {
  const stmt = getDb().prepare(sql);
  if (params) stmt.bind(params as never);

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): T | null {
  const results = queryAll<T>(sql, params);
  return results[0] ?? null;
}

export async function save(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await writeDatabase(data);

  // Trigger debounced GitHub sync after every write
  try {
    const { schedulePush } = await import("./github-sync");
    schedulePush();
  } catch {
    // github-sync may not be loaded yet during init
  }
}

export function exportBytes(): Uint8Array {
  return getDb().export();
}

export async function importBytes(data: Uint8Array): Promise<void> {
  const SQL = await getSql();
  if (db) db.close();
  db = new SQL.Database(data);
  runSchema(db);
  await save();
}

export function isInitialized(): boolean {
  return db !== null;
}
