import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch for GitHub API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("authStore", () => {
  let authStore: typeof import("$lib/stores/auth.svelte").authStore;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    const mod = await import("$lib/stores/auth.svelte");
    authStore = mod.authStore;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with no user and loading true", () => {
    expect(authStore.user).toBeNull();
    expect(authStore.loading).toBe(true);
    expect(authStore.isAuthenticated).toBe(false);
  });

  it("init with no stored token sets loading false", async () => {
    await authStore.init();
    expect(authStore.loading).toBe(false);
    expect(authStore.user).toBeNull();
    expect(authStore.isAuthenticated).toBe(false);
  });

  it("init with valid stored token authenticates", async () => {
    localStorage.setItem("github-token", "ghp_valid");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 123, login: "testuser" }),
    });

    await authStore.init();
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.user).toEqual({ id: "123", login: "testuser" });
    expect(authStore.loading).toBe(false);
  });

  it("init with invalid stored token clears it", async () => {
    localStorage.setItem("github-token", "ghp_expired");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await authStore.init();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.user).toBeNull();
    expect(localStorage.getItem("github-token")).toBeNull();
  });

  it("login with valid token stores it and authenticates", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 456, login: "myuser" }),
    });

    const result = await authStore.login("ghp_new");
    expect(result).toBe(true);
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.token).toBe("ghp_new");
    expect(localStorage.getItem("github-token")).toBe("ghp_new");
  });

  it("login with invalid token returns false", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await authStore.login("ghp_bad");
    expect(result).toBe(false);
    expect(authStore.isAuthenticated).toBe(false);
    expect(localStorage.getItem("github-token")).toBeNull();
  });

  it("login sends correct Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, login: "user" }),
    });

    await authStore.login("ghp_test123");
    expect(mockFetch).toHaveBeenCalledWith("https://api.github.com/user", {
      headers: { Authorization: "Bearer ghp_test123" },
    });
  });

  it("logout clears user and token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, login: "user" }),
    });
    await authStore.login("ghp_tok");
    expect(authStore.isAuthenticated).toBe(true);

    authStore.logout();
    expect(authStore.user).toBeNull();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.token).toBeNull();
    expect(localStorage.getItem("github-token")).toBeNull();
  });

  it("signOut is an alias for logout", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, login: "user" }),
    });
    await authStore.login("ghp_tok");

    await authStore.signOut();
    expect(authStore.isAuthenticated).toBe(false);
  });

  it("signUp rejects with token auth message", async () => {
    await expect(authStore.signUp("a@b.com", "pass")).rejects.toThrow(
      "Use GitHub token authentication",
    );
  });

  it("signIn rejects with token auth message", async () => {
    await expect(authStore.signIn("a@b.com", "pass")).rejects.toThrow(
      "Use GitHub token authentication",
    );
  });
});
