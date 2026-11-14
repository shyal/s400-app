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

export const SYNC_REPO = "shyal/s400-data";
export const SYNC_PATH = "stronglifts.sqlite";

// Point sync at the (hardcoded) data repo using the current auth token
export function initSync() {
  if (authStore.token) {
    configureSync({
      token: authStore.token,
      repo: SYNC_REPO,
      path: SYNC_PATH,
    });
  }
}
