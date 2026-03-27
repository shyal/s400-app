import { describe, it, expect, vi, afterEach } from "vitest";
import { localDateStr } from "$lib/utils/date";

describe("localDateStr", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns YYYY-MM-DD format", () => {
    const result = localDateStr(new Date(2025, 0, 15));
    expect(result).toBe("2025-01-15");
  });

  it("zero-pads single-digit months", () => {
    const result = localDateStr(new Date(2025, 2, 5)); // March 5
    expect(result).toBe("2025-03-05");
  });

  it("zero-pads single-digit days", () => {
    const result = localDateStr(new Date(2025, 11, 1)); // Dec 1
    expect(result).toBe("2025-12-01");
  });

  it("uses current date when no argument", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 10, 0, 0)); // June 15
    expect(localDateStr()).toBe("2025-06-15");
  });

  it("handles year boundary", () => {
    const result = localDateStr(new Date(2024, 11, 31)); // Dec 31
    expect(result).toBe("2024-12-31");
  });

  it("handles leap year", () => {
    const result = localDateStr(new Date(2024, 1, 29)); // Feb 29
    expect(result).toBe("2024-02-29");
  });
});
