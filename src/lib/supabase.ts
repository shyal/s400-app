import { createClient, queryAll } from "supahub";

// Drop-in replacement for @supabase/supabase-js client.
// Same chainable API, backed by local SQLite via supahub.
export const supabase = createClient({
  columns: {
    json: [
      "exercises",
      "increments",
      "workout_schedule",
      "plateau_exercises",
      "stacks",
    ],
    bool: ["sound_enabled", "vibration_enabled", "is_favorite"],
  },
  rpc: {
    frequent_supplements: (params) => {
      const limit = (params.lim as number) ?? 15;
      const results = queryAll(
        `SELECT name, dose FROM supplement_entries
         GROUP BY name, dose
         ORDER BY COUNT(*) DESC
         LIMIT ?`,
        [limit],
      );
      return { data: results, error: null };
    },
  },
});
