import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockSupabase } from "../../../test/mocks/supabase";

vi.mock("$lib/supabase", async () => {
  const { createMockSupabase } = await import("../../../test/mocks/supabase");
  return { supabase: createMockSupabase() };
});

import { supabase } from "$lib/supabase";
const mockSb = supabase as unknown as MockSupabase;

import {
  getStravaAuthUrl,
  isStravaConnected,
  exchangeStravaCode,
  syncStravaActivities,
  fetchStravaActivities,
  disconnectStrava,
} from "$lib/services/stravaData";

beforeEach(() => {
  mockSb.__resetTableResults();
  mockSb.functions.invoke.mockReset();
  mockSb.functions.invoke.mockResolvedValue({ data: null, error: null });
});

describe("getStravaAuthUrl", () => {
  it("returns a valid Strava OAuth URL", () => {
    const url = getStravaAuthUrl();
    expect(url).toContain("https://www.strava.com/oauth/authorize");
    expect(url).toContain("client_id=");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("scope=activity%3Aread_all");
    expect(url).toContain("response_type=code");
  });
});

describe("isStravaConnected", () => {
  it("returns true when tokens exist", async () => {
    mockSb.__setTableResult("strava_tokens", {
      data: { user_id: "u1" },
      error: null,
    });
    const result = await isStravaConnected();
    expect(result).toBe(true);
    expect(mockSb.from).toHaveBeenCalledWith("strava_tokens");
  });

  it("returns false when no tokens", async () => {
    mockSb.__setTableResult("strava_tokens", { data: null, error: null });
    const result = await isStravaConnected();
    expect(result).toBe(false);
  });
});

describe("exchangeStravaCode", () => {
  it("calls edge function with code and returns true on success", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await exchangeStravaCode("test-code");
    expect(result).toBe(true);
    expect(mockSb.functions.invoke).toHaveBeenCalledWith("strava-auth", {
      body: { action: "exchange", code: "test-code" },
    });
  });

  it("returns false when invoke returns error", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });

    const result = await exchangeStravaCode("bad-code");
    expect(result).toBe(false);
  });
});

describe("syncStravaActivities", () => {
  it("calls sync endpoint and returns activities", async () => {
    const activities = [
      {
        id: 123,
        name: "Morning Ride",
        type: "Ride",
        start_date: "2025-06-15T08:00:00Z",
        elapsed_time_sec: 3600,
        moving_time_sec: 3000,
        distance_m: 15000,
        average_speed: 5.0,
        max_speed: 8.0,
        total_elevation_gain: 50,
        average_heartrate: 140,
        average_watts: null,
        kilojoules: 300,
      },
    ];

    mockSb.functions.invoke.mockResolvedValue({
      data: { synced: 1, activities },
      error: null,
    });

    const result = await syncStravaActivities("2025-06-14");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(123);
    expect(result[0].name).toBe("Morning Ride");
    expect(result[0].type).toBe("Ride");
    expect(mockSb.functions.invoke).toHaveBeenCalledWith("strava-auth", {
      body: { action: "sync", after: "2025-06-14" },
    });
  });

  it("syncs without afterDate", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: { synced: 0, activities: [] },
      error: null,
    });

    const result = await syncStravaActivities();
    expect(result).toEqual([]);
    expect(mockSb.functions.invoke).toHaveBeenCalledWith("strava-auth", {
      body: { action: "sync" },
    });
  });

  it("returns empty array on error", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });

    const result = await syncStravaActivities();
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    mockSb.functions.invoke.mockResolvedValue({ data: null, error: null });

    const result = await syncStravaActivities();
    expect(result).toEqual([]);
  });
});

describe("fetchStravaActivities", () => {
  it("queries activities from supabase for date range", async () => {
    mockSb.__setTableResult("strava_activities", {
      data: [
        {
          id: 456,
          name: "Evening Ride",
          type: "Ride",
          start_date: "2025-06-15T18:00:00Z",
          elapsed_time_sec: 1800,
          moving_time_sec: 1500,
          distance_m: 8000,
          average_speed: 5.3,
          max_speed: 7.5,
          total_elevation_gain: 20,
          average_heartrate: 130,
          average_watts: null,
          kilojoules: null,
        },
      ],
      error: null,
    });

    const result = await fetchStravaActivities("2025-06-15", "2025-06-15");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(456);
    expect(result[0].name).toBe("Evening Ride");
    expect(result[0].max_speed).toBe(7.5);
    expect(result[0].total_elevation_gain).toBe(20);
    expect(result[0].average_heartrate).toBe(130);
    expect(result[0].average_watts).toBeNull();
    expect(result[0].kilojoules).toBeNull();
    expect(mockSb.from).toHaveBeenCalledWith("strava_activities");
  });

  it("handles all nullable fields being present", async () => {
    mockSb.__setTableResult("strava_activities", {
      data: [
        {
          id: 789,
          name: "Full Data Ride",
          type: "Ride",
          start_date: "2025-06-15T18:00:00Z",
          elapsed_time_sec: 1800,
          moving_time_sec: 1500,
          distance_m: 8000,
          average_speed: 5.3,
          max_speed: 9.0,
          total_elevation_gain: 100,
          average_heartrate: 145,
          average_watts: 180,
          kilojoules: 500,
        },
      ],
      error: null,
    });

    const result = await fetchStravaActivities("2025-06-15", "2025-06-15");
    expect(result[0].max_speed).toBe(9.0);
    expect(result[0].total_elevation_gain).toBe(100);
    expect(result[0].average_heartrate).toBe(145);
    expect(result[0].average_watts).toBe(180);
    expect(result[0].kilojoules).toBe(500);
  });

  it("handles all nullable fields being null", async () => {
    mockSb.__setTableResult("strava_activities", {
      data: [
        {
          id: 101,
          name: "Minimal Ride",
          type: "Ride",
          start_date: "2025-06-15T18:00:00Z",
          elapsed_time_sec: 600,
          moving_time_sec: 500,
          distance_m: 3000,
          average_speed: 5.0,
          max_speed: null,
          total_elevation_gain: null,
          average_heartrate: null,
          average_watts: null,
          kilojoules: null,
        },
      ],
      error: null,
    });

    const result = await fetchStravaActivities("2025-06-15", "2025-06-15");
    expect(result[0].max_speed).toBeNull();
    expect(result[0].total_elevation_gain).toBeNull();
    expect(result[0].average_heartrate).toBeNull();
    expect(result[0].average_watts).toBeNull();
    expect(result[0].kilojoules).toBeNull();
  });

  it("returns empty array on error", async () => {
    mockSb.__setTableResult("strava_activities", {
      data: null,
      error: { message: "err" },
    });
    const result = await fetchStravaActivities("2025-06-15", "2025-06-15");
    expect(result).toEqual([]);
  });
});

describe("disconnectStrava", () => {
  it("calls disconnect endpoint and returns true", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const result = await disconnectStrava();
    expect(result).toBe(true);
    expect(mockSb.functions.invoke).toHaveBeenCalledWith("strava-auth", {
      body: { action: "disconnect" },
    });
  });

  it("returns false on error", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });

    const result = await disconnectStrava();
    expect(result).toBe(false);
  });
});

describe("syncStravaActivities edge cases", () => {
  it("returns empty array when data has no activities property", async () => {
    mockSb.functions.invoke.mockResolvedValue({
      data: { synced: 0 },
      error: null,
    });
    const result = await syncStravaActivities();
    expect(result).toEqual([]);
  });
});

describe("fetchStravaActivities edge cases", () => {
  it("returns empty array when data is null but no error", async () => {
    mockSb.__setTableResult("strava_activities", { data: null, error: null });
    const result = await fetchStravaActivities("2025-06-15", "2025-06-15");
    expect(result).toEqual([]);
  });
});

describe("when supabase is null", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("isStravaConnected returns false", async () => {
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
    const mod = await import("$lib/services/stravaData");
    expect(await mod.isStravaConnected()).toBe(false);
  });

  it("invokeEdge (via exchange) returns error when supabase is null", async () => {
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
    const mod = await import("$lib/services/stravaData");
    expect(await mod.exchangeStravaCode("test")).toBe(false);
  });

  it("fetchStravaActivities returns empty when supabase is null", async () => {
    vi.doMock("$lib/supabase", () => ({ supabase: null }));
    const mod = await import("$lib/services/stravaData");
    expect(await mod.fetchStravaActivities("2025-01-01", "2025-01-01")).toEqual(
      [],
    );
  });
});
