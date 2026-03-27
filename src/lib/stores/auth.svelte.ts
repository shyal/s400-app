const GITHUB_USERNAME = import.meta.env.VITE_GITHUB_USERNAME || "";
const TOKEN_KEY = "github-token";

function createAuthStore() {
  let user = $state<{ id: string; login: string } | null>(null);
  let loading = $state(true);
  let token = $state<string | null>(null);

  async function init() {
    if (typeof localStorage === "undefined") {
      loading = false;
      return;
    }

    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const verified = await verifyToken(stored);
      if (verified) {
        token = stored;
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    loading = false;
  }

  async function verifyToken(t: string): Promise<boolean> {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (GITHUB_USERNAME && data.login !== GITHUB_USERNAME) return false;
      user = { id: data.id.toString(), login: data.login };
      return true;
    } catch {
      return false;
    }
  }

  async function login(t: string): Promise<boolean> {
    const ok = await verifyToken(t);
    if (ok) {
      token = t;
      localStorage.setItem(TOKEN_KEY, t);
    }
    return ok;
  }

  function logout() {
    user = null;
    token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  return {
    get user() {
      return user;
    },
    get session() {
      return token ? { user } : null;
    },
    get loading() {
      return loading;
    },
    get isAuthenticated() {
      return !!token;
    },
    get token() {
      return token;
    },
    init,
    login,
    logout,
    // Keep signUp/signIn/signOut for compatibility with any code that calls them
    signUp: () => Promise.reject(new Error("Use GitHub token authentication")),
    signIn: () => Promise.reject(new Error("Use GitHub token authentication")),
    signOut: () => {
      logout();
      return Promise.resolve();
    },
  };
}

export const authStore = createAuthStore();
