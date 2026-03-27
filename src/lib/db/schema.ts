export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  workout_type TEXT NOT NULL,
  activity TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  exercises TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);

CREATE TABLE IF NOT EXISTS exercise_progress (
  name TEXT PRIMARY KEY,
  weight_kg REAL NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  rest_timer_seconds INTEGER DEFAULT 90,
  weight_unit TEXT DEFAULT 'kg',
  program TEXT DEFAULT 'stronglifts',
  sound_enabled INTEGER DEFAULT 1,
  vibration_enabled INTEGER DEFAULT 1,
  increments TEXT DEFAULT '{"Squat":2.5,"Bench Press":2.5,"Barbell Row":2.5,"Overhead Press":2.5,"Deadlift":5}',
  workout_schedule TEXT,
  plateau_exercises TEXT DEFAULT '[]',
  moving_average_window INTEGER DEFAULT 7
);

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  fiber_g REAL NOT NULL DEFAULT 0,
  water_ml REAL NOT NULL DEFAULT 0,
  serving_size REAL NOT NULL DEFAULT 1,
  serving_unit TEXT NOT NULL DEFAULT 'serving',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES recipes(id),
  quantity REAL NOT NULL DEFAULT 1,
  quantity_unit TEXT NOT NULL DEFAULT 'serving'
);
CREATE INDEX IF NOT EXISTS idx_ri_recipe ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS food_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  recipe_id TEXT,
  name TEXT NOT NULL,
  servings REAL NOT NULL DEFAULT 1,
  calories REAL NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carbs_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  fiber_g REAL NOT NULL DEFAULT 0,
  water_ml REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_food_date ON food_entries(date, time);

CREATE TABLE IF NOT EXISTS water_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  amount_ml REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_date ON water_entries(date, time);

CREATE TABLE IF NOT EXISTS macro_targets (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  calories REAL NOT NULL DEFAULT 2000,
  protein_g REAL NOT NULL DEFAULT 100,
  carbs_g REAL NOT NULL DEFAULT 200,
  fat_g REAL NOT NULL DEFAULT 80,
  water_ml REAL NOT NULL DEFAULT 3000
);

CREATE TABLE IF NOT EXISTS weight_log (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  body_fat_pct REAL,
  muscle_mass_kg REAL,
  visceral_fat REAL,
  water_percent REAL
);
CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_log(date DESC);

CREATE TABLE IF NOT EXISTS supplement_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  name TEXT NOT NULL,
  dose TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_supp_date ON supplement_entries(date, time);

CREATE TABLE IF NOT EXISTS supplement_stacks (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  stacks TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS biomarker_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  unit_alt TEXT,
  optimal_min REAL,
  optimal_max REAL,
  warning_min REAL,
  warning_max REAL,
  test_frequency_days INTEGER DEFAULT 365,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS biomarker_measurements (
  id TEXT PRIMARY KEY,
  biomarker_id TEXT NOT NULL REFERENCES biomarker_definitions(id),
  date TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  lab_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(biomarker_id, date)
);
CREATE INDEX IF NOT EXISTS idx_bm_date ON biomarker_measurements(date DESC);

CREATE TABLE IF NOT EXISTS biomarker_user_targets (
  id TEXT PRIMARY KEY,
  biomarker_id TEXT NOT NULL UNIQUE REFERENCES biomarker_definitions(id),
  optimal_min REAL,
  optimal_max REAL,
  target_value REAL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS glucose_readings (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT DEFAULT 'mmol/L',
  equipment_id INTEGER,
  notes TEXT,
  reading_type TEXT DEFAULT 'random'
);
CREATE INDEX IF NOT EXISTS idx_glucose_date ON glucose_readings(date, time);

CREATE TABLE IF NOT EXISTS glucose_model_params (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  fasting_baseline_mgdl REAL DEFAULT 90,
  carb_sensitivity REAL DEFAULT 4.0,
  protein_sensitivity REAL DEFAULT 0.7,
  fat_delay_factor REAL DEFAULT 1.0,
  exercise_reduction_pct REAL DEFAULT 30,
  gym_sensitivity_hours REAL DEFAULT 36,
  gym_sensitivity_pct REAL DEFAULT 15,
  circadian_evening_pct REAL DEFAULT 10,
  dawn_phenomenon_mgdl REAL DEFAULT 10,
  peak_time_min REAL DEFAULT 30,
  curve_shape_k REAL DEFAULT 2,
  data_points_used INTEGER DEFAULT 0,
  last_fit_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  maker TEXT,
  model TEXT,
  quantity INTEGER DEFAULT 1,
  expiry_date TEXT,
  notes TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strava_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  strava_athlete_id INTEGER,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strava_activities (
  id INTEGER PRIMARY KEY,
  name TEXT,
  type TEXT,
  start_date TEXT,
  elapsed_time_sec INTEGER,
  moving_time_sec INTEGER,
  distance_m REAL,
  average_speed REAL,
  max_speed REAL,
  total_elevation_gain REAL,
  average_heartrate REAL,
  average_watts REAL,
  kilojoules REAL,
  synced_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_strava_date ON strava_activities(start_date);

CREATE TABLE IF NOT EXISTS github_sync_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
  last_push_at TEXT,
  last_pull_at TEXT,
  last_sha TEXT,
  repo TEXT,
  path TEXT DEFAULT 'stronglifts.sqlite'
);
`;

export function runSchema(db: { run: (sql: string) => void }): void {
  db.run(SCHEMA_SQL);
  // Insert schema version if not present
  db.run(
    `INSERT OR IGNORE INTO schema_version (version) VALUES (${SCHEMA_VERSION})`,
  );
}
