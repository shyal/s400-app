import { describe, it, expect, vi } from "vitest";
import { uuid } from "$lib/uuid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid", () => {
  it("returns a valid v4 UUID string", () => {
    expect(uuid()).toMatch(UUID_RE);
  });

  it("returns unique values on successive calls", () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });

  it("uses crypto.randomUUID when available", () => {
    const spy = vi.spyOn(crypto, "randomUUID");
    uuid();
    expect(spy).toHaveBeenCalled();
  });

  it("falls back when crypto.randomUUID is unavailable", () => {
    const original = crypto.randomUUID;
    try {
      // @ts-expect-error - removing for fallback test
      crypto.randomUUID = undefined;
      const result = uuid();
      expect(result).toMatch(UUID_RE);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
