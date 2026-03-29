// Re-export supahub's GitHub sync with app-specific defaults
import {
  configureSync,
  push,
  pull,
  getSyncStatus,
  schedulePush,
  setupAutoSync,
} from "supahub";
import { authStore } from "$lib/stores/auth.svelte";

export { push, pull, getSyncStatus, schedulePush, setupAutoSync };

const SYNC_META_KEY = "github-sync-meta";

interface SyncMeta {
  repo: string;
  path: string;
}

function getLocalMeta(): SyncMeta {
  if (typeof localStorage === "undefined")
    return { repo: "", path: "stronglifts.sqlite" };
  try {
    const raw = localStorage.getItem(SYNC_META_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { repo: "", path: "stronglifts.sqlite" };
}

export function configure(repo: string, path?: string) {
  const meta = { repo, path: path ?? "stronglifts.sqlite" };
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  }
  if (authStore.token) {
    configureSync({
      token: authStore.token,
      repo: meta.repo,
      path: meta.path,
    });
  }
}

// Initialize sync from stored config + auth token
export function initSync() {
  const meta = getLocalMeta();
  if (meta.repo && authStore.token) {
    configureSync({
      token: authStore.token,
      repo: meta.repo,
      path: meta.path,
    });
  }
}
