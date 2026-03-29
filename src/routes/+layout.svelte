<script lang="ts">
  import "../app.css";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { authStore } from "$lib/stores/auth.svelte";
  import { workoutStore } from "$lib/stores/workout.svelte";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import { initDb } from "$lib/db/index";
  import {
    initSync,
    setupAutoSync,
    pull as syncPull,
    getSyncStatus,
  } from "$lib/db/github-sync";
  import { Toaster } from "$lib/components/ui/sonner";
  import BackgroundWaves from "$lib/components/BackgroundWaves.svelte";
  import WaterReminder from "$lib/components/WaterReminder.svelte";

  import HomeIcon from "@lucide/svelte/icons/house";
  import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
  import ChartNoAxesCombinedIcon from "@lucide/svelte/icons/chart-no-axes-combined";
  import UtensilsIcon from "@lucide/svelte/icons/utensils";
  import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
  import SettingsIcon from "@lucide/svelte/icons/settings";

  interface Props {
    children: import("svelte").Snippet;
  }

  let { children }: Props = $props();
  let initialized = $state(false);

  const navItems = [
    { href: `${base}/`, label: "Home", icon: HomeIcon },
    { href: `${base}/workout`, label: "Workout", icon: DumbbellIcon },
    {
      href: `${base}/history`,
      label: "History",
      icon: ChartNoAxesCombinedIcon,
    },
    { href: `${base}/food`, label: "Food", icon: UtensilsIcon },
    { href: `${base}/biomarkers`, label: "Labs", icon: FlaskConicalIcon },
    { href: `${base}/settings`, label: "Settings", icon: SettingsIcon },
  ];

  async function init() {
    await authStore.init();

    if (authStore.isAuthenticated) {
      await initDb();
      initSync();

      // Pull latest from GitHub if configured
      const syncStatus = getSyncStatus();
      if (syncStatus.configured) {
        await syncPull();
      }

      workoutStore.hydrate();
      settingsStore.hydrate();
      setupAutoSync();
    }

    initialized = true;
  }

  init();

  // Auth guard
  $effect(() => {
    if (
      initialized &&
      !authStore.isAuthenticated &&
      $page.url.pathname !== `${base}/login`
    ) {
      goto(`${base}/login`);
    }
  });
</script>

{#if !initialized}
  <div class="min-h-screen flex items-center justify-center bg-background">
    <p class="text-muted-foreground">Loading...</p>
  </div>
{:else if !authStore.isAuthenticated && $page.url.pathname !== `${base}/login`}
  <div class="min-h-screen flex items-center justify-center bg-background">
    <p class="text-muted-foreground">Redirecting...</p>
  </div>
{:else}
  <div class="min-h-screen flex flex-col bg-background relative">
    <BackgroundWaves />
    <main class="flex-1 overflow-y-auto pb-20 relative" style="z-index: 1;">
      {@render children()}
    </main>

    {#if $page.url.pathname !== `${base}/login`}
      <nav
        class="fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-pb"
        style="z-index: 10;"
      >
        <div class="flex justify-around py-2">
          {#each navItems as item}
            {@const Icon = item.icon}
            <a
              href={item.href}
              class="flex flex-col items-center px-2 py-2 rounded-lg transition-colors"
              class:text-primary={item.href === "/"
                ? $page.url.pathname === "/"
                : $page.url.pathname.startsWith(item.href)}
              class:text-muted-foreground={item.href === "/"
                ? $page.url.pathname !== "/"
                : !$page.url.pathname.startsWith(item.href)}
            >
              <Icon class="h-5 w-5" />
              <span class="text-xs mt-1">{item.label}</span>
            </a>
          {/each}
        </div>
      </nav>
    {/if}
  </div>
{/if}

<Toaster position="top-center" richColors />
{#if initialized && authStore.isAuthenticated}
  <WaterReminder />
{/if}

<style>
  .safe-area-pb {
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
</style>
