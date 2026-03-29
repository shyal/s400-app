import {
  initDb as supahubInit,
  getDb,
  run as supahubRun,
  queryAll,
  queryOne,
  save,
  exportBytes,
  importBytes,
  isInitialized,
  configureColumns,
  schedulePush,
  markDirty,
  pull,
  getSyncStatus,
} from "supahub";
import { base } from "$app/paths";
import { SCHEMA_SQL } from "./schema";

const JSON_COLS = [
  "exercises",
  "increments",
  "workout_schedule",
  "plateau_exercises",
  "stacks",
];

const BOOL_COLS = ["sound_enabled", "vibration_enabled", "is_favorite"];

/**
 * Wrapped `run()` that marks the DB as dirty when executing write statements.
 * This ensures we only push to GitHub when actual user changes occurred,
 * preventing stale browser data from overwriting remote changes (e.g. from
 * Python scripts).
 */
function run(sql: string, params?: unknown[]): void {
  supahubRun(sql, params);
  // Mark dirty for write operations (INSERT, UPDATE, DELETE, REPLACE, ALTER, DROP)
  const trimmed = sql.trimStart().toUpperCase();
  if (
    trimmed.startsWith("INSERT") ||
    trimmed.startsWith("UPDATE") ||
    trimmed.startsWith("DELETE") ||
    trimmed.startsWith("REPLACE") ||
    trimmed.startsWith("ALTER") ||
    trimmed.startsWith("DROP")
  ) {
    markDirty();
  }
}

export async function initDb(): Promise<void> {
  if (isInitialized()) return;

  configureColumns({ json: JSON_COLS, bool: BOOL_COLS });

  await supahubInit({
    wasmUrl: `${base}/sql-wasm.wasm`,
    filename: "stronglifts.sqlite",
    schema: SCHEMA_SQL,
    onSave: () => {
      try {
        schedulePush();
      } catch {
        // sync not configured yet
      }
    },
  });

  // Run migrations for columns added after initial schema
  applyMigrations();

  // Pull latest from GitHub on startup to incorporate changes from other
  // clients (e.g. Python scripts that backfill data). This runs BEFORE any
  // user interaction, so there's no local data to lose.
  try {
    if (getSyncStatus().configured) {
      const result = await pull();
      if (result.updated) {
        console.log("[stronglifts] Pulled latest data from GitHub on startup");
      }
    }
  } catch {
    // Network error or sync not configured — continue with local data
  }

  // Seed from exported Supabase data on first run
  const count = queryOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM workouts",
  );
  if (count && count.cnt === 0) {
    await loadSeed();
    await save();
  }
}

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

    const jsonSet = new Set(JSON_COLS);
    const boolSet = new Set(BOOL_COLS);

    for (const table of tables) {
      const rows = seed[table];
      if (!rows || rows.length === 0) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = keys.map((k) => {
          const v = row[k];
          if (jsonSet.has(k) && typeof v === "object" && v !== null)
            return JSON.stringify(v);
          if (boolSet.has(k)) return v ? 1 : 0;
          return v;
        });
        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT OR IGNORE INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders})`;
        run(sql, vals);
      }
    }

    console.log("Seed data loaded successfully");
  } catch (e) {
    console.warn("Failed to load seed data:", e);
  }
}

/**
 * Apply ALTER TABLE migrations for columns added after the initial schema.
 * Each migration is idempotent — it checks if the column exists first.
 */
function applyMigrations(): void {
  const migrations: { table: string; column: string; definition: string }[] = [
    {
      table: "user_settings",
      column: "moving_average_type",
      definition: "TEXT DEFAULT 'ema'",
    },
    {
      table: "user_settings",
      column: "goal_weight_kg",
      definition: "REAL DEFAULT 73",
    },
    {
      table: "user_settings",
      column: "goal_body_fat_pct",
      definition: "REAL DEFAULT 15",
    },
    {
      table: "user_settings",
      column: "goal_visceral_fat",
      definition: "REAL DEFAULT 8",
    },
    {
      table: "user_settings",
      column: "goal_mode",
      definition: "TEXT DEFAULT 'visceral_fat'",
    },
  ];

  for (const { table, column, definition } of migrations) {
    try {
      // PRAGMA table_info returns rows for each column; check if ours exists
      const cols = queryAll<{ name: string }>(`PRAGMA table_info("${table}")`);
      if (cols && !cols.some((c) => c.name === column)) {
        supahubRun(
          `ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`,
        );
        console.log(`[migration] Added ${table}.${column}`);
      }
    } catch (e) {
      console.warn(`[migration] Failed to add ${table}.${column}:`, e);
    }
  }
}

// Re-export for anything that imports from $lib/db/index
// Note: `run` is the wrapped version that tracks dirty state,
// not the raw supahub `run`.
export {
  getDb,
  run,
  queryAll,
  queryOne,
  save,
  exportBytes,
  importBytes,
  isInitialized,
};
