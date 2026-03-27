import type { Settings } from "$lib/types";
import { fetchSettings, upsertSettings } from "$lib/services/supabaseData";

const STORAGE_KEY = "stronglifts-settings";

const DEFAULT_INCREMENTS: Record<string, number> = {
  Squat: 2.5,
  "Bench Press": 2.5,
  "Barbell Row": 2.5,
  "Overhead Press": 2.5,
  Deadlift: 5,
};

const defaultSettings: Settings = {
  restTimerSeconds: 90,
  weightUnit: "kg",
  program: "stronglifts",
  soundEnabled: true,
  vibrationEnabled: true,
  increments: { ...DEFAULT_INCREMENTS },
  workoutSchedule: {
    frequencyDays: 2,
    consecutiveForExtraRest: 3,
    extraRestDays: 1,
  },
};

function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return defaultSettings;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    return defaultSettings;
  }
}

function createSettingsStore() {
  let settings = $state<Settings>(loadSettings());

  function save() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    upsertSettings(settings).catch(() => {});
  }

  async function hydrate() {
    try {
      const remote = await fetchSettings();
      if (remote) {
        settings = { ...defaultSettings, ...remote };
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        }
      }
    } catch (e) {
      console.error("Settings hydration error:", e);
    }
  }

  return {
    get value() {
      return settings;
    },
    update(newSettings: Partial<Settings>) {
      settings = { ...settings, ...newSettings };
      save();
    },
    reset() {
      settings = { ...defaultSettings };
      save();
    },
    hydrate,
  };
}

export const settingsStore = createSettingsStore();
