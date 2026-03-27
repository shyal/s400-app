import { supabase } from "$lib/supabase";
import type { StravaActivity } from "$lib/types";

const STRAVA_CLIENT_ID = "26365";
const REDIRECT_URI =
  "http://stronglifts-tracker-app.s3-website-ap-southeast-1.amazonaws.com/settings?strava_callback=1";

export function getStravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function isStravaConnected(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase
    .from("strava_tokens")
    .select("user_id")
    .maybeSingle();
  return !!data;
}

async function invokeEdge(
  action: string,
  body?: Record<string, unknown>,
): Promise<{ data: unknown; error: boolean }> {
  if (!supabase) return { data: null, error: true };
  const { data, error } = await supabase.functions.invoke("strava-auth", {
    body: { action, ...(body ?? {}) },
  });
  if (error) return { data: null, error: true };
  return { data, error: false };
}

export async function exchangeStravaCode(code: string): Promise<boolean> {
  const { error } = await invokeEdge("exchange", { code });
  return !error;
}

export async function syncStravaActivities(
  afterDate?: string,
): Promise<StravaActivity[]> {
  const body = afterDate ? { after: afterDate } : {};
  const { data, error } = await invokeEdge("sync", body);
  if (error || !data) return [];
  const result = data as { activities?: Record<string, unknown>[] };
  return (result.activities ?? []).map(rowToActivity);
}

export async function fetchStravaActivities(
  startDate: string,
  endDate: string,
): Promise<StravaActivity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("strava_activities")
    .select("*")
    .gte("start_date", startDate)
    .lte("start_date", endDate + "T23:59:59")
    .order("start_date");
  if (error) {
    console.error("fetchStravaActivities:", error);
    return [];
  }
  return (data ?? []).map(rowToActivity);
}

export async function disconnectStrava(): Promise<boolean> {
  const { error } = await invokeEdge("disconnect");
  return !error;
}

function rowToActivity(row: Record<string, unknown>): StravaActivity {
  return {
    id: Number(row.id),
    name: row.name as string,
    type: row.type as string,
    start_date: row.start_date as string,
    elapsed_time_sec: Number(row.elapsed_time_sec),
    moving_time_sec: Number(row.moving_time_sec),
    distance_m: Number(row.distance_m),
    average_speed: Number(row.average_speed),
    max_speed: row.max_speed != null ? Number(row.max_speed) : null,
    total_elevation_gain:
      row.total_elevation_gain != null
        ? Number(row.total_elevation_gain)
        : null,
    average_heartrate:
      row.average_heartrate != null ? Number(row.average_heartrate) : null,
    average_watts: row.average_watts != null ? Number(row.average_watts) : null,
    kilojoules: row.kilojoules != null ? Number(row.kilojoules) : null,
  };
}
