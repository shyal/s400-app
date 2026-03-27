<script lang="ts">
  import { biomarkerStore } from "$lib/stores/biomarker.svelte";
  import { authStore } from "$lib/stores/auth.svelte";

  interface Props {
    children: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  if (authStore.isAuthenticated) {
    biomarkerStore.ensureHydrated();
  }
</script>

{@render children()}
