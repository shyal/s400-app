<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import BikeIcon from "@lucide/svelte/icons/bike";
  import LinkIcon from "@lucide/svelte/icons/link";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import CheckCircleIcon from "@lucide/svelte/icons/circle-check";
  import LoaderIcon from "@lucide/svelte/icons/loader";
  import {
    isStravaConnected,
    getStravaAuthUrl,
    exchangeStravaCode,
    syncStravaActivities,
    disconnectStrava,
  } from "$lib/services/stravaData";
  import { authStore } from "$lib/stores/auth.svelte";

  let connected = $state(false);
  let loading = $state(true);
  let syncing = $state(false);
  let syncResult = $state("");
  let error = $state("");

  async function checkConnection() {
    loading = true;
    connected = await isStravaConnected();
    loading = false;
  }

  /** Wait for auth session to be restored before calling edge functions */
  async function waitForAuth(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (authStore.loading && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return authStore.isAuthenticated;
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("strava_callback") !== "1") return;

    const code = params.get("code");
    if (!code) return;

    // Clean up URL
    const url = new URL(window.location.href);
    url.searchParams.delete("strava_callback");
    url.searchParams.delete("code");
    url.searchParams.delete("scope");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());

    loading = true;

    // Wait for Supabase auth session to restore before calling edge function
    const authed = await waitForAuth();
    if (!authed) {
      error = "Not logged in. Please sign in and try again.";
      loading = false;
      return;
    }

    const success = await exchangeStravaCode(code);
    if (success) {
      connected = true;
      syncResult = "Connected! Syncing activities...";
      await handleSync();
    } else {
      error = "Failed to connect Strava. Please try again.";
    }
    loading = false;
  }

  async function handleSync() {
    syncing = true;
    syncResult = "";
    error = "";
    const activities = await syncStravaActivities();
    if (activities.length > 0) {
      const rides = activities.filter((a) => a.type === "Ride");
      syncResult = `Synced ${activities.length} activities${rides.length ? ` (${rides.length} rides)` : ""}`;
    } else {
      syncResult = "No new activities found";
    }
    syncing = false;
  }

  async function handleDisconnect() {
    loading = true;
    error = "";
    syncResult = "";
    const success = await disconnectStrava();
    if (success) {
      connected = false;
    } else {
      error = "Failed to disconnect";
    }
    loading = false;
  }

  function handleConnect() {
    window.location.href = getStravaAuthUrl();
  }

  $effect(() => {
    handleOAuthCallback().then(() => checkConnection());
  });
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <BikeIcon class="h-4 w-4 text-orange-500" />
        <Card.Title class="text-sm font-semibold">Strava</Card.Title>
      </div>
      {#if connected}
        <Badge
          variant="outline"
          class="text-[10px] gap-1 text-emerald-400 border-emerald-500/30"
        >
          <CheckCircleIcon class="h-3 w-3" />
          Connected
        </Badge>
      {/if}
    </div>
  </Card.Header>
  <Card.Content class="px-4 pb-3">
    {#if loading}
      <div class="flex items-center justify-center py-4">
        <LoaderIcon class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    {:else if connected}
      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">
          Ride activities are synced and shown on the insulin chart.
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            class="flex-1 h-8 text-xs"
            onclick={handleSync}
            disabled={syncing}
          >
            {#if syncing}
              <LoaderIcon class="h-3.5 w-3.5 mr-1 animate-spin" />
              Syncing...
            {:else}
              <RefreshCwIcon class="h-3.5 w-3.5 mr-1" />
              Sync Activities
            {/if}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onclick={handleDisconnect}
          >
            <UnlinkIcon class="h-3.5 w-3.5 mr-1" />
            Disconnect
          </Button>
        </div>
      </div>
    {:else}
      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">
          Connect Strava to automatically track post-meal bike rides and overlay
          them on the insulin chart.
        </p>
        <Button
          class="w-full h-9 text-sm font-medium bg-[#FC4C02] hover:bg-[#e04400] text-white"
          onclick={handleConnect}
        >
          <LinkIcon class="h-4 w-4 mr-1.5" />
          Connect Strava
        </Button>
      </div>
    {/if}

    {#if syncResult}
      <p class="text-xs text-emerald-400 mt-2">{syncResult}</p>
    {/if}
    {#if error}
      <p class="text-xs text-red-400 mt-2">{error}</p>
    {/if}
  </Card.Content>
</Card.Root>
