<script lang="ts">
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { workoutStore } from "$lib/stores/workout.svelte";
  import { exportData, importData } from "$lib/utils/storage";
  import { authStore } from "$lib/stores/auth.svelte";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import {
    upsertWorkout,
    upsertExerciseProgress,
  } from "$lib/services/supabaseData";
  import { uuid } from "$lib/uuid";
  import StravaConnect from "$lib/components/StravaConnect.svelte";
  import TestEquipmentCard from "$lib/components/TestEquipment.svelte";
  import {
    getSyncStatus,
    configure as configureSyncRepo,
    push as syncPush,
    pull as syncPull,
  } from "$lib/db/github-sync";

  let showExport = $state(false);
  let exportedData = $state("");
  let importInput = $state("");
  let showImport = $state(false);
  let importError = $state("");
  let showResetConfirm = $state(false);
  let importingHistory = $state(false);
  let historyImportStatus = $state("");
  let fileInput: HTMLInputElement;
  let syncRepo = $state(getSyncStatus().repo);
  let syncing = $state(false);
  let syncMessage = $state("");

  function triggerFileInput() {
    fileInput?.click();
  }

  async function handleCsvFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    importingHistory = true;
    historyImportStatus = "Parsing CSV...";

    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      const lines = text.trim().split("\n");
      if (lines.length < 2) throw new Error("Empty CSV");

      // Group rows by workout number (date + workout#)
      const workoutMap = new Map<
        string,
        {
          date: string;
          name: string;
          startTime: string;
          endTime: string;
          duration: number;
          exercises: {
            name: string;
            sets: {
              setNumber: number;
              reps: number;
              weight_kg: number;
              completed: boolean;
            }[];
            targetSets: number;
            targetReps: number;
            targetWeight_kg: number;
          }[];
        }
      >();

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 19) continue;

        const date = cols[0].replace(/\//g, "-"); // yyyy-mm-dd
        const workoutNum = cols[1];
        const workoutName = cols[2];
        const exerciseName = cols[5];
        const setsReps = cols[6]; // e.g. "5×5" or "1×5"
        const startTime = cols[14]; // h:mm AM/PM
        const endTime = cols[15];
        const durationHours = parseFloat(cols[13]) || 0;

        const key = `${date}-${workoutNum}`;

        if (!workoutMap.has(key)) {
          workoutMap.set(key, {
            date,
            name: workoutName,
            startTime: convertTo24h(startTime),
            endTime: convertTo24h(endTime),
            duration: Math.round(durationHours * 60),
            exercises: [],
          });
        }

        const workout = workoutMap.get(key)!;

        // Parse target sets x reps
        const [targetSetsStr, targetRepsStr] = (setsReps || "5×5").split("×");
        const targetSets = parseInt(targetSetsStr) || 5;
        const targetReps = parseInt(targetRepsStr) || 5;

        // Parse individual sets from columns 17+ (pairs of reps, kg)
        const sets: {
          setNumber: number;
          reps: number;
          weight_kg: number;
          completed: boolean;
        }[] = [];
        for (let s = 0; s < 5; s++) {
          const repsCol = 17 + s * 2;
          const kgCol = 18 + s * 2;
          if (repsCol < cols.length && cols[repsCol]) {
            const reps = parseInt(cols[repsCol]);
            const kg = parseFloat(cols[kgCol]) || 0;
            if (!isNaN(reps)) {
              sets.push({
                setNumber: s + 1,
                reps,
                weight_kg: kg,
                completed: reps >= targetReps,
              });
            }
          }
        }

        workout.exercises.push({
          name: exerciseName,
          targetSets,
          targetReps,
          targetWeight_kg:
            sets.length > 0 ? Math.max(...sets.map((s) => s.weight_kg)) : 0,
          sets,
        });
      }

      // Convert to Workout objects
      const workouts = [...workoutMap.entries()]
        .map(([_, w]) => {
          const workoutType = w.name.includes("Workout A")
            ? ("A" as const)
            : w.name.includes("Workout B")
              ? ("B" as const)
              : ("custom" as const);
          return {
            id: uuid(),
            date: w.date,
            time: w.startTime,
            type: "workout" as const,
            activity: w.name,
            workoutType,
            duration_min: w.duration,
            exercises: w.exercises,
            synced: false,
            startedAt: new Date(`${w.date}T${w.startTime}:00`).toISOString(),
            completedAt: new Date(`${w.date}T${w.endTime}:00`).toISOString(),
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));

      // Build exercise progress from last workout
      const exerciseProgress: Record<
        string,
        { name: string; weight_kg: number; failureCount: number }
      > = {};
      for (const w of workouts) {
        for (const ex of w.exercises) {
          if (!exerciseProgress[ex.name]) {
            exerciseProgress[ex.name] = {
              name: ex.name,
              weight_kg: ex.targetWeight_kg,
              failureCount: 0,
            };
          }
        }
      }

      const lastWorkout = workouts[0];
      const history = {
        workouts,
        exerciseProgress,
        lastWorkoutType:
          lastWorkout?.workoutType === "A" || lastWorkout?.workoutType === "B"
            ? lastWorkout.workoutType
            : null,
        lastWorkoutDate: lastWorkout?.date ?? null,
      };

      localStorage.setItem("stronglifts-history", JSON.stringify(history));

      // Save to database
      historyImportStatus = `Saving ${workouts.length} workouts...`;
      for (const w of workouts) {
        await upsertWorkout(w);
      }
      await upsertExerciseProgress(exerciseProgress);

      historyImportStatus = `Imported ${workouts.length} workouts!`;
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      historyImportStatus = `Error: ${e instanceof Error ? e.message : "Unknown error"}`;
    }
    importingHistory = false;
    input.value = "";
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  function convertTo24h(time: string): string {
    if (!time) return "00:00";
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return "00:00";
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m}`;
  }

  function handleExport() {
    exportedData = exportData();
    showExport = true;
  }

  function handleImport() {
    if (!importInput.trim()) {
      importError = "Please paste data to import";
      return;
    }
    const success = importData(importInput);
    if (success) {
      showImport = false;
      importInput = "";
      importError = "";
      window.location.reload();
    } else {
      importError = "Invalid data format";
    }
  }

  function handleReset() {
    localStorage.clear();
    window.location.reload();
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(exportedData);
  }
</script>

<svelte:head>
  <title>Settings - StrongLifts</title>
</svelte:head>

<div class="p-4 space-y-4">
  <header>
    <h1 class="text-2xl font-bold">Settings</h1>
  </header>

  <div class="card">
    <h2 class="font-bold mb-4">Timer</h2>

    <div class="space-y-4">
      <div>
        <label class="block text-sm text-slate-400 mb-2" for="rest-timer">
          Rest Timer Duration: {settingsStore.value.restTimerSeconds}s
        </label>
        <input
          id="rest-timer"
          type="range"
          min="30"
          max="300"
          step="15"
          value={settingsStore.value.restTimerSeconds}
          oninput={(e) =>
            settingsStore.update({
              restTimerSeconds: parseInt(e.currentTarget.value),
            })}
          class="w-full"
        />
        <div class="flex justify-between text-xs text-slate-500">
          <span>30s</span>
          <span>5min</span>
        </div>
      </div>

      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settingsStore.value.soundEnabled}
          onchange={(e) =>
            settingsStore.update({ soundEnabled: e.currentTarget.checked })}
          class="w-5 h-5 rounded"
        />
        <span>Sound notifications</span>
      </label>

      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settingsStore.value.vibrationEnabled}
          onchange={(e) =>
            settingsStore.update({ vibrationEnabled: e.currentTarget.checked })}
          class="w-5 h-5 rounded"
        />
        <span>Vibration</span>
      </label>
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Water Reminders</h2>

    <div class="space-y-4">
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settingsStore.value.waterReminderEnabled ?? true}
          onchange={(e) =>
            settingsStore.update({
              waterReminderEnabled: e.currentTarget.checked,
            })}
          class="w-5 h-5 rounded"
        />
        <span>Remind me to drink water</span>
      </label>

      {#if settingsStore.value.waterReminderEnabled ?? true}
        <div>
          <label class="block text-sm text-slate-400 mb-2" for="water-interval">
            Remind every <span class="text-white font-medium"
              >{settingsStore.value.waterReminderIntervalMin ?? 60} min</span
            >
          </label>
          <input
            id="water-interval"
            type="range"
            min="15"
            max="120"
            step="15"
            value={settingsStore.value.waterReminderIntervalMin ?? 60}
            oninput={(e) =>
              settingsStore.update({
                waterReminderIntervalMin: parseInt(e.currentTarget.value),
              })}
            class="w-full"
          />
          <div class="flex justify-between text-xs text-slate-500">
            <span>15min</span>
            <span>2hr</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Weight Chart</h2>

    <div class="space-y-4">
      <div>
        <label class="block text-sm text-slate-400 mb-2" for="ma-window">
          Moving Average: <span class="text-white font-medium"
            >{settingsStore.value.movingAverageWindow ?? 7} days</span
          >
        </label>
        <input
          id="ma-window"
          type="range"
          min="3"
          max="21"
          step="1"
          value={settingsStore.value.movingAverageWindow ?? 7}
          oninput={(e) =>
            settingsStore.update({
              movingAverageWindow: parseInt(e.currentTarget.value),
            })}
          class="w-full"
        />
        <div class="flex justify-between text-xs text-slate-500">
          <span>3 days</span>
          <span>21 days</span>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Units</h2>

    <div class="flex gap-2">
      <button
        class="flex-1 py-2 rounded-lg transition-colors"
        class:bg-blue-600={settingsStore.value.weightUnit === "kg"}
        class:bg-slate-700={settingsStore.value.weightUnit !== "kg"}
        onclick={() => settingsStore.update({ weightUnit: "kg" })}
      >
        Kilograms (kg)
      </button>
      <button
        class="flex-1 py-2 rounded-lg transition-colors"
        class:bg-blue-600={settingsStore.value.weightUnit === "lb"}
        class:bg-slate-700={settingsStore.value.weightUnit !== "lb"}
        onclick={() => settingsStore.update({ weightUnit: "lb" })}
      >
        Pounds (lb)
      </button>
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Program</h2>

    <div class="space-y-2">
      <button
        class="w-full p-3 rounded-lg text-left transition-colors"
        class:bg-blue-600={settingsStore.value.program === "stronglifts"}
        class:bg-slate-700={settingsStore.value.program !== "stronglifts"}
        onclick={() => settingsStore.update({ program: "stronglifts" })}
      >
        <div class="font-medium">StrongLifts 5×5</div>
        <div class="text-sm text-slate-400">
          Classic A/B alternating program
        </div>
      </button>
      <button
        class="w-full p-3 rounded-lg text-left transition-colors"
        class:bg-blue-600={settingsStore.value.program === "custom"}
        class:bg-slate-700={settingsStore.value.program !== "custom"}
        onclick={() => settingsStore.update({ program: "custom" })}
      >
        <div class="font-medium">Custom Split</div>
        <div class="text-sm text-slate-400">
          Upper/Lower with isolation work
        </div>
      </button>
      <button
        class="w-full p-3 rounded-lg text-left transition-colors"
        class:bg-blue-600={settingsStore.value.program === "recovery"}
        class:bg-slate-700={settingsStore.value.program !== "recovery"}
        onclick={() => settingsStore.update({ program: "recovery" })}
      >
        <div class="font-medium">Lower Back Recovery</div>
        <div class="text-sm text-slate-400">
          Back-friendly A/B — no deadlifts, squats, or barbell rows
        </div>
      </button>
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Weight Increments</h2>
    <p class="text-sm text-slate-400 mb-3">
      Auto-added after a successful workout (kg)
    </p>
    <div class="space-y-3">
      {#each Object.entries(settingsStore.value.increments ?? {}) as [name, value]}
        <div class="flex items-center justify-between gap-3">
          <label class="text-sm flex-1" for="inc-{name}">{name}</label>
          <input
            id="inc-{name}"
            type="number"
            step="0.5"
            min="0"
            max="20"
            {value}
            onchange={(e) => {
              const v = parseFloat(e.currentTarget.value);
              if (!isNaN(v))
                settingsStore.update({
                  increments: { ...settingsStore.value.increments, [name]: v },
                });
            }}
            class="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-right text-sm"
          />
        </div>
      {/each}
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Plateau Mode</h2>
    <p class="text-sm text-slate-400 mb-3">
      Hold weight steady — no auto-increment after success
    </p>
    <div class="space-y-3">
      {#each Object.keys(settingsStore.value.increments ?? {}) as name}
        <label
          class="flex items-center gap-3 cursor-pointer"
          for="plateau-{name}"
        >
          <input
            id="plateau-{name}"
            type="checkbox"
            checked={(settingsStore.value.plateauExercises ?? []).includes(
              name,
            )}
            onchange={(e) => {
              const current = settingsStore.value.plateauExercises ?? [];
              const updated = e.currentTarget.checked
                ? [...current, name]
                : current.filter((n: string) => n !== name);
              settingsStore.update({ plateauExercises: updated });
            }}
            class="w-5 h-5 rounded"
          />
          <span class="text-sm">{name}</span>
        </label>
      {/each}
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Workout Schedule</h2>

    <div class="space-y-4">
      <div>
        <label class="block text-sm text-slate-400 mb-2" for="freq-days">
          Train every <span class="text-white font-medium"
            >{settingsStore.value.workoutSchedule.frequencyDays} day{settingsStore
              .value.workoutSchedule.frequencyDays === 1
              ? ""
              : "s"}</span
          >
        </label>
        <input
          id="freq-days"
          type="range"
          min="1"
          max="4"
          step="1"
          value={settingsStore.value.workoutSchedule.frequencyDays}
          oninput={(e) =>
            settingsStore.update({
              workoutSchedule: {
                ...settingsStore.value.workoutSchedule,
                frequencyDays: parseInt(e.currentTarget.value),
              },
            })}
          class="w-full"
        />
        <div class="flex justify-between text-xs text-slate-500">
          <span>Every day</span>
          <span>Every 4 days</span>
        </div>
      </div>

      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={settingsStore.value.workoutSchedule.extraRestDays > 0}
          onchange={(e) =>
            settingsStore.update({
              workoutSchedule: {
                ...settingsStore.value.workoutSchedule,
                extraRestDays: e.currentTarget.checked ? 1 : 0,
              },
            })}
          class="w-5 h-5 rounded"
        />
        <span>Earn extra rest days</span>
      </label>

      {#if settingsStore.value.workoutSchedule.extraRestDays > 0}
        <div class="pl-8 space-y-3 border-l-2 border-slate-700">
          <p class="text-sm text-slate-400">
            After
            <select
              class="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white text-sm mx-1"
              value={settingsStore.value.workoutSchedule
                .consecutiveForExtraRest}
              onchange={(e) =>
                settingsStore.update({
                  workoutSchedule: {
                    ...settingsStore.value.workoutSchedule,
                    consecutiveForExtraRest: parseInt(e.currentTarget.value),
                  },
                })}
            >
              {#each [2, 3, 4, 5] as n}
                <option value={n}>{n}</option>
              {/each}
            </select>
            workouts on schedule, add
            <select
              class="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-white text-sm mx-1"
              value={settingsStore.value.workoutSchedule.extraRestDays}
              onchange={(e) =>
                settingsStore.update({
                  workoutSchedule: {
                    ...settingsStore.value.workoutSchedule,
                    extraRestDays: parseInt(e.currentTarget.value),
                  },
                })}
            >
              {#each [1, 2] as n}
                <option value={n}>{n}</option>
              {/each}
            </select>
            extra rest day{settingsStore.value.workoutSchedule.extraRestDays ===
            1
              ? ""
              : "s"}
          </p>
        </div>
      {/if}
    </div>
  </div>

  <div class="card">
    <h2 class="font-bold mb-4">Data</h2>

    <div class="space-y-2">
      <input
        bind:this={fileInput}
        type="file"
        accept=".csv"
        onchange={handleCsvFile}
        class="hidden"
      />
      <button
        class="btn btn-primary w-full"
        onclick={triggerFileInput}
        disabled={importingHistory}
      >
        {importingHistory ? "Importing..." : "Import StrongLifts CSV"}
      </button>
      {#if historyImportStatus}
        <p
          class="text-sm text-center"
          class:text-green-400={historyImportStatus.includes("Imported")}
          class:text-red-400={historyImportStatus.includes("Error")}
        >
          {historyImportStatus}
        </p>
      {/if}

      <button class="btn bg-slate-700 w-full" onclick={handleExport}>
        Export Data
      </button>

      {#if showExport}
        <div class="mt-2 space-y-2">
          <textarea
            readonly
            value={exportedData}
            class="w-full h-32 bg-slate-900 rounded p-2 text-xs font-mono"
          ></textarea>
          <button class="btn btn-primary w-full" onclick={copyToClipboard}>
            Copy to Clipboard
          </button>
          <button
            class="btn bg-slate-600 w-full"
            onclick={() => (showExport = false)}
          >
            Close
          </button>
        </div>
      {/if}

      <button
        class="btn bg-slate-700 w-full"
        onclick={() => (showImport = !showImport)}
      >
        Import Data
      </button>

      {#if showImport}
        <div class="mt-2 space-y-2">
          <textarea
            bind:value={importInput}
            placeholder="Paste exported data here..."
            class="w-full h-32 bg-slate-900 rounded p-2 text-xs font-mono"
          ></textarea>
          {#if importError}
            <p class="text-red-400 text-sm">{importError}</p>
          {/if}
          <button class="btn btn-primary w-full" onclick={handleImport}>
            Import
          </button>
          <button
            class="btn bg-slate-600 w-full"
            onclick={() => {
              showImport = false;
              importInput = "";
              importError = "";
            }}
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="card border border-red-900">
    <h2 class="font-bold mb-4 text-red-400">Danger Zone</h2>

    {#if showResetConfirm}
      <div class="space-y-2">
        <p class="text-sm text-slate-400">
          This will delete all workout history and settings. This cannot be
          undone.
        </p>
        <div class="flex gap-2">
          <button class="btn btn-danger flex-1" onclick={handleReset}>
            Yes, Reset Everything
          </button>
          <button
            class="btn bg-slate-600 flex-1"
            onclick={() => (showResetConfirm = false)}
          >
            Cancel
          </button>
        </div>
      </div>
    {:else}
      <button
        class="btn btn-danger w-full"
        onclick={() => (showResetConfirm = true)}
      >
        Reset All Data
      </button>
    {/if}
  </div>

  {#if authStore.isAuthenticated}
    <div class="card">
      <h2 class="font-bold mb-4">GitHub Sync</h2>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-slate-400 mb-1" for="sync-repo"
            >Repository (owner/repo)</label
          >
          <input
            id="sync-repo"
            type="text"
            bind:value={syncRepo}
            placeholder="username/my-fitness-data"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
            onblur={() => {
              if (syncRepo.trim()) configureSyncRepo(syncRepo.trim());
            }}
          />
        </div>

        <div class="flex gap-2">
          <button
            class="btn bg-slate-700 flex-1"
            disabled={syncing || !syncRepo.trim()}
            onclick={async () => {
              syncing = true;
              syncMessage = "";
              configureSyncRepo(syncRepo.trim());
              const result = await syncPush();
              syncMessage = result.success
                ? "Pushed successfully"
                : `Push failed: ${result.error}`;
              syncing = false;
            }}
          >
            {syncing ? "Syncing..." : "Push"}
          </button>
          <button
            class="btn bg-slate-700 flex-1"
            disabled={syncing || !syncRepo.trim()}
            onclick={async () => {
              syncing = true;
              syncMessage = "";
              configureSyncRepo(syncRepo.trim());
              const result = await syncPull();
              syncMessage = result.success
                ? result.updated
                  ? "Pulled & updated"
                  : "Already up to date"
                : `Pull failed: ${result.error}`;
              syncing = false;
            }}
          >
            Pull
          </button>
        </div>

        {#if syncMessage}
          <p
            class="text-sm text-center"
            class:text-green-400={!syncMessage.includes("failed")}
            class:text-red-400={syncMessage.includes("failed")}
          >
            {syncMessage}
          </p>
        {/if}

        {#if getSyncStatus().lastPushAt}
          <p class="text-xs text-slate-500">
            Last push: {new Date(getSyncStatus().lastPushAt!).toLocaleString()}
          </p>
        {/if}
      </div>
    </div>

    <div class="card">
      <h2 class="font-bold mb-4">Account</h2>
      <p class="text-sm text-slate-400 mb-3">
        {authStore.user?.login ?? "Authenticated"}
      </p>
      <button
        class="btn bg-slate-700 w-full"
        onclick={async () => {
          await authStore.signOut();
          goto(`${base}/login`);
        }}
      >
        Sign Out
      </button>
    </div>

    <StravaConnect />
    <TestEquipmentCard />
  {/if}

  <div class="text-center text-xs text-slate-500 py-4">
    StrongLifts Tracker v1.0.0
  </div>
</div>
