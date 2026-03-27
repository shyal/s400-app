<script lang="ts">
  import { nutritionStore } from "$lib/stores/nutrition.svelte";
  import { authStore } from "$lib/stores/auth.svelte";

  interface Props {
    children: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  if (authStore.isAuthenticated) {
    nutritionStore.ensureHydrated();
  }
</script>

{@render children()}
