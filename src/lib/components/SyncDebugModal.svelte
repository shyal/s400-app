<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import {
    push as syncPush,
    pull as syncPull,
    getSyncStatus,
  } from "$lib/db/github-sync";
  import { isDirty, exportBytes, queryAll, queryOne } from "supahub";

  let open = $state(false);
  let logs = $state<{ time: string; level: string; msg: string }[]>([]);
  let pushing = $state(false);
  let pulling = $state(false);
  let dbStats = $state<Record<string, number>>({});
  let dbSizeKb = $state(0);
  let opfsStatus = $state("unknown");
  let localStorageKeys = $state<string[]>([]);
  let remoteSha = $state<string | null>(null);
  let remoteSize = $state<number | null>(null);
  let remoteUpdatedAt = $state<string | null>(null);
  let checkingRemote = $state(false);

  function log(level: string, msg: string) {
    const time = new Date().toLocaleTimeString("en-PH", { hour12: false });
    logs = [{ time, level, msg }, ...logs].slice(0, 100);
  }

  function getSyncMeta() {
    try {
      const raw = localStorage.getItem("supahub-sync-meta");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getAppSyncMeta() {
    try {
      const raw = localStorage.getItem("github-sync-meta");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function refreshStats() {
    log("info", "Refreshing stats...");

    // DB table row counts
    try {
      const tables = [
        "workouts",
        "exercise_progress",
        "food_entries",
        "water_entries",
        "weight_log",
        "user_settings",
        "supplement_entries",
        "biomarker_measurements",
        "glucose_readings",
        "strava_activities",
        "recipes",
        "macro_targets",
      ];
      const stats: Record<string, number> = {};
      for (const t of tables) {
        try {
          const r = queryOne<{ cnt: number }>(
            `SELECT COUNT(*) as cnt FROM "${t}"`,
          );
          stats[t] = r?.cnt ?? -1;
        } catch {
          stats[t] = -1;
        }
      }
      dbStats = stats;
    } catch (e) {
      log("error", `Failed to get table stats: ${e}`);
    }

    // DB size
    try {
      const bytes = exportBytes();
      dbSizeKb = Math.round(bytes.byteLength / 1024);
    } catch (e) {
      log("error", `Failed to export bytes: ${e}`);
    }

    // OPFS check
    try {
      if ("navigator" in globalThis && "storage" in navigator) {
        const root = await navigator.storage.getDirectory();
        try {
          const handle = await root.getFileHandle("stronglifts.sqlite");
          const file = await handle.getFile();
          opfsStatus = `OK (${Math.round(file.size / 1024)} KB, modified ${file.lastModified ? new Date(file.lastModified).toLocaleTimeString() : "?"})`;
        } catch {
          opfsStatus = "File not found in OPFS";
        }
      } else {
        opfsStatus = "OPFS not available";
      }
    } catch (e) {
      opfsStatus = `Error: ${e}`;
    }

    // localStorage keys
    try {
      localStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localStorageKeys.push(key);
      }
      localStorageKeys.sort();
    } catch {}

    log("info", "Stats refreshed");
  }

  async function checkRemote() {
    checkingRemote = true;
    log("info", "Checking remote...");
    const status = getSyncStatus();
    if (!status.configured) {
      log("warn", "Sync not configured");
      checkingRemote = false;
      return;
    }
    try {
      const token = localStorage.getItem("github-token");
      const meta = getSyncMeta();
      const res = await fetch(
        `https://api.github.com/repos/${meta?.repo || status.repo}/contents/${meta?.path || status.path}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        remoteSha = data.sha;
        remoteSize = data.size;
        remoteUpdatedAt = null;

        // Check if local SHA matches remote
        const localSha = meta?.lastSha;
        if (localSha === data.sha) {
          log("info", `Remote SHA matches local: ${data.sha.slice(0, 7)}`);
        } else {
          log(
            "warn",
            `SHA MISMATCH! Local: ${localSha?.slice(0, 7) ?? "none"} Remote: ${data.sha.slice(0, 7)}`,
          );
        }

        // Get last commit info
        const commitsRes = await fetch(
          `https://api.github.com/repos/${meta?.repo || status.repo}/commits?path=${meta?.path || status.path}&per_page=1`,
          {
            headers: {
              Authorization: `token ${token}`,
              Accept: "application/vnd.github+json",
            },
          },
        );
        if (commitsRes.ok) {
          const commits = await commitsRes.json();
          if (commits.length > 0) {
            remoteUpdatedAt = commits[0].commit.committer.date;
            log(
              "info",
              `Remote last commit: "${commits[0].commit.message}" at ${commits[0].commit.committer.date}`,
            );
          }
        }
      } else {
        log("error", `Remote check failed: ${res.status}`);
      }
    } catch (e) {
      log("error", `Remote check error: ${e}`);
    }
    checkingRemote = false;
  }

  async function forcePush() {
    pushing = true;
    log("info", "Force pushing...");
    try {
      const result = await syncPush();
      if (result.success) {
        log("info", "Push succeeded ✓");
      } else {
        log("error", `Push failed: ${result.error}`);
      }
    } catch (e) {
      log("error", `Push exception: ${e}`);
    }
    pushing = false;
    await checkRemote();
  }

  async function forcePull() {
    pulling = true;
    log("info", "Pulling...");
    try {
      const result = await syncPull();
      if (result.success) {
        log(
          "info",
          result.updated
            ? "Pull succeeded — data updated ✓"
            : "Pull succeeded — already up to date",
        );
      } else {
        log("error", `Pull failed: ${result.error}`);
      }
    } catch (e) {
      log("error", `Pull exception: ${e}`);
    }
    pulling = false;
    await refreshStats();
  }

  async function verifyRemoteData() {
    log("info", "Downloading remote DB to verify contents...");
    const token = localStorage.getItem("github-token");
    const meta = getSyncMeta();
    if (!meta?.repo) {
      log("error", "No repo configured");
      return;
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${meta.repo}/contents/${meta.path}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (!res.ok) {
        log("error", `Failed to fetch: ${res.status}`);
        return;
      }
      const data = await res.json();
      const rawRes = await fetch(data.download_url);
      const buffer = await rawRes.arrayBuffer();

      // Use sql.js to open remote DB in isolation
      const initSqlJs = (await import("sql.js")).default;
      const SQL = await initSqlJs({
        locateFile: () => "/s400-app/sql-wasm.wasm",
      });
      const remoteDb = new SQL.Database(new Uint8Array(buffer));

      const tables = ["food_entries", "weight_log", "water_entries"];
      const today = new Date().toISOString().slice(0, 10);

      for (const table of tables) {
        try {
          const stmt = remoteDb.prepare(
            `SELECT COUNT(*) as cnt FROM "${table}" WHERE date = ?`,
          );
          stmt.bind([today]);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            log("info", `Remote ${table} today: ${row.cnt} rows`);
          }
          stmt.free();
        } catch (e) {
          log("warn", `Remote ${table}: ${e}`);
        }
      }

      // Compare food_entries
      try {
        const stmt = remoteDb.prepare(
          `SELECT name, calories, time FROM food_entries WHERE date = ? ORDER BY time`,
        );
        stmt.bind([today]);
        const items: string[] = [];
        while (stmt.step()) {
          const r = stmt.getAsObject() as {
            name: string;
            calories: number;
            time: string;
          };
          items.push(`${r.time} ${r.name} (${r.calories} kcal)`);
        }
        stmt.free();
        if (items.length > 0) {
          log("info", `Remote food today:\n  ${items.join("\n  ")}`);
        } else {
          log("warn", "Remote has NO food entries for today!");
        }
      } catch (e) {
        log("warn", `Remote food query error: ${e}`);
      }

      // Compare with local
      try {
        const localCount = queryOne<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM food_entries WHERE date = '${today}'`,
        );
        log("info", `Local food entries today: ${localCount?.cnt ?? 0}`);
        if (localCount && localCount.cnt > 0) {
          const localItems = queryAll<{
            name: string;
            calories: number;
            time: string;
          }>(
            `SELECT name, calories, time FROM food_entries WHERE date = '${today}' ORDER BY time`,
          );
          log(
            "info",
            `Local food today:\n  ${localItems.map((r) => `${r.time} ${r.name} (${r.calories} kcal)`).join("\n  ")}`,
          );
        }
      } catch (e) {
        log("warn", `Local food query error: ${e}`);
      }

      remoteDb.close();
      log("info", "Remote verification complete");
    } catch (e) {
      log("error", `Verify error: ${e}`);
    }
  }

  $effect(() => {
    if (open) {
      refreshStats();
      checkRemote();
    }
  });
</script>

<button
  class="fixed bottom-20 right-3 z-50 bg-slate-800 border border-slate-600 rounded-full w-10 h-10 flex items-center justify-center text-xs font-mono opacity-60 hover:opacity-100 transition-opacity"
  onclick={() => (open = true)}
  title="Sync Debug"
>
  🔧
</button>

<Dialog.Root bind:open>
  <Dialog.Content
    class="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
  >
    <Dialog.Header>
      <Dialog.Title>Sync Debug Panel</Dialog.Title>
      <Dialog.Description>
        Internal state inspector for GitHub sync
      </Dialog.Description>
    </Dialog.Header>

    <div class="overflow-y-auto flex-1 space-y-4 text-sm">
      <!-- Sync State -->
      <section>
        <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">
          Sync State
        </h3>
        {#snippet syncState()}
          {@const status = getSyncStatus()}
          {@const meta = getSyncMeta()}
          <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1">
            <div>
              <span class="text-slate-500">configured:</span>
              <span
                class={status.configured ? "text-green-400" : "text-red-400"}
              >
                {status.configured}
              </span>
            </div>
            <div>
              <span class="text-slate-500">repo:</span>
              {status.repo || "—"}
            </div>
            <div>
              <span class="text-slate-500">path:</span>
              {status.path || "—"}
            </div>
            <div>
              <span class="text-slate-500">dirty:</span>
              <span class={isDirty() ? "text-yellow-400" : "text-green-400"}>
                {isDirty()}
              </span>
            </div>
            <div>
              <span class="text-slate-500">local SHA:</span>
              <span class="text-blue-400"
                >{meta?.lastSha?.slice(0, 12) ?? "none"}</span
              >
            </div>
            <div>
              <span class="text-slate-500">remote SHA:</span>
              <span
                class={remoteSha && meta?.lastSha && remoteSha !== meta.lastSha
                  ? "text-red-400"
                  : "text-blue-400"}
              >
                {remoteSha?.slice(0, 12) ?? "—"}
              </span>
              {#if remoteSha && meta?.lastSha && remoteSha !== meta.lastSha}
                <span class="text-red-400 font-bold ml-2">⚠ MISMATCH</span>
              {/if}
            </div>
            <div>
              <span class="text-slate-500">last push:</span>
              {meta?.lastPushAt
                ? new Date(meta.lastPushAt).toLocaleString()
                : "never"}
            </div>
            <div>
              <span class="text-slate-500">last pull:</span>
              {meta?.lastPullAt
                ? new Date(meta.lastPullAt).toLocaleString()
                : "never"}
            </div>
            <div>
              <span class="text-slate-500">remote updated:</span>
              {remoteUpdatedAt
                ? new Date(remoteUpdatedAt).toLocaleString()
                : "—"}
            </div>
            <div>
              <span class="text-slate-500">remote size:</span>
              {remoteSize ? `${Math.round(remoteSize / 1024)} KB` : "—"}
            </div>
          </div>
        {/snippet}
        {@render syncState()}
      </section>

      <!-- Storage -->
      <section>
        <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">Storage</h3>
        <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1">
          <div>
            <span class="text-slate-500">in-memory DB:</span>
            {dbSizeKb} KB
          </div>
          <div><span class="text-slate-500">OPFS:</span> {opfsStatus}</div>
          <div>
            <span class="text-slate-500">localStorage keys:</span>
            {localStorageKeys.length}
            <span class="text-slate-600 ml-1"
              >({localStorageKeys
                .filter(
                  (k) =>
                    k.includes("sync") ||
                    k.includes("github") ||
                    k.includes("supahub"),
                )
                .join(", ")})</span
            >
          </div>
        </div>
      </section>

      <!-- DB Stats -->
      <section>
        <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">
          Table Row Counts
        </h3>
        <div
          class="bg-slate-900 rounded p-3 font-mono text-xs grid grid-cols-2 gap-x-4 gap-y-0.5"
        >
          {#each Object.entries(dbStats) as [table, count]}
            <div class="flex justify-between">
              <span class="text-slate-500">{table}:</span>
              <span class={count > 0 ? "text-green-400" : "text-slate-600"}
                >{count}</span
              >
            </div>
          {/each}
        </div>
      </section>

      <!-- Actions -->
      <section>
        <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">Actions</h3>
        <div class="flex flex-wrap gap-2">
          <button
            class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-medium disabled:opacity-50"
            disabled={pushing}
            onclick={forcePush}
          >
            {pushing ? "Pushing..." : "⬆ Force Push"}
          </button>
          <button
            class="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs font-medium disabled:opacity-50"
            disabled={pulling}
            onclick={forcePull}
          >
            {pulling ? "Pulling..." : "⬇ Pull"}
          </button>
          <button
            class="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium disabled:opacity-50"
            disabled={checkingRemote}
            onclick={checkRemote}
          >
            {checkingRemote ? "Checking..." : "🔍 Check Remote"}
          </button>
          <button
            class="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium"
            onclick={verifyRemoteData}
          >
            🔬 Verify Remote Data
          </button>
          <button
            class="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-xs font-medium"
            onclick={refreshStats}
          >
            🔄 Refresh
          </button>
        </div>
      </section>

      <!-- Event Log -->
      <section>
        <h3 class="font-bold text-xs uppercase text-slate-400 mb-2">
          Event Log ({logs.length})
        </h3>
        <div
          class="bg-slate-950 rounded p-2 font-mono text-xs max-h-48 overflow-y-auto space-y-0.5"
        >
          {#each logs as entry}
            <div class="flex gap-2">
              <span class="text-slate-600 shrink-0">{entry.time}</span>
              <span
                class="shrink-0"
                class:text-blue-400={entry.level === "info"}
                class:text-yellow-400={entry.level === "warn"}
                class:text-red-400={entry.level === "error"}
              >
                [{entry.level}]
              </span>
              <span class="text-slate-300 whitespace-pre-wrap break-all"
                >{entry.msg}</span
              >
            </div>
          {/each}
          {#if logs.length === 0}
            <span class="text-slate-600">No events yet</span>
          {/if}
        </div>
      </section>
    </div>
  </Dialog.Content>
</Dialog.Root>
