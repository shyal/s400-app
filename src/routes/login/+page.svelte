<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { authStore } from "$lib/stores/auth.svelte";

  let token = $state("");
  let error = $state("");
  let loading = $state(false);

  async function handleSubmit() {
    error = "";
    loading = true;
    const ok = await authStore.login(token.trim());
    if (ok) {
      goto(`${base}/`);
    } else {
      error = "Invalid token or unauthorized GitHub account.";
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>Login - StrongLifts</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-slate-900">
  <div class="w-full max-w-sm space-y-6">
    <div class="text-center">
      <h1 class="text-3xl font-bold">StrongLifts</h1>
      <p class="text-slate-400 mt-2">Paste your GitHub token to continue</p>
    </div>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="token" class="block text-sm text-slate-400 mb-1"
          >GitHub Personal Access Token</label
        >
        <input
          id="token"
          type="password"
          bind:value={token}
          required
          placeholder="ghp_..."
          class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      {#if error}
        <p class="text-sm text-red-400">{error}</p>
      {/if}

      <button type="submit" disabled={loading} class="btn btn-primary w-full">
        {loading ? "Verifying..." : "Verify & Login"}
      </button>
    </form>

    <p class="text-xs text-slate-500 text-center">
      Create a
      <a
        href="https://github.com/settings/tokens?type=beta"
        target="_blank"
        class="text-blue-400 hover:underline">fine-grained PAT</a
      >
      scoped to your sync repo with Contents read/write permission.
    </p>
  </div>
</div>
