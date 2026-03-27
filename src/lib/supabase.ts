import { createLocalClient, type SupabaseClient } from "$lib/db/query-builder";

// Drop-in replacement for @supabase/supabase-js client.
// Same chainable API, backed by local SQLite via sql.js.
export const supabase: SupabaseClient | null = createLocalClient();
