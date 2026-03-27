<script lang="ts">
  import type { FastingAssessment } from "$lib/stores/nutrition.svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Badge } from "$lib/components/ui/badge";

  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import FlameIcon from "@lucide/svelte/icons/flame";

  interface Props {
    open: boolean;
    assessment: FastingAssessment;
    foodName: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    open = $bindable(),
    assessment,
    foodName,
    onconfirm,
    oncancel,
  }: Props = $props();

  const breaksFast = $derived(assessment.impact === "BREAKS_FAST");
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <div class="flex items-center gap-3 mb-1">
        {#if breaksFast}
          <div class="rounded-full p-2 bg-red-500/15">
            <FlameIcon class="h-5 w-5 text-red-400" />
          </div>
          <AlertDialog.Title>This Breaks Your Fast</AlertDialog.Title>
        {:else}
          <div class="rounded-full p-2 bg-emerald-500/15">
            <ShieldCheckIcon class="h-5 w-5 text-emerald-400" />
          </div>
          <AlertDialog.Title>Fast Intact</AlertDialog.Title>
        {/if}
      </div>
      <AlertDialog.Description>
        {#if breaksFast}
          This will open your 4h feeding window.
        {:else}
          This won't break your fast.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>

    <div class="flex items-center gap-2 my-3 flex-wrap">
      <Badge variant="outline" class="text-xs tabular-nums">{foodName}</Badge>
      <Badge
        variant="outline"
        class="text-xs tabular-nums text-blue-400 border-blue-500/20"
        >{assessment.proposedCalories} cal</Badge
      >
      <Badge
        variant="outline"
        class="text-xs tabular-nums text-amber-400 border-amber-500/20"
        >insulin score: {Math.round(assessment.proposedScore)}</Badge
      >
      {#if assessment.rollingScore > 0}
        <Badge
          variant="outline"
          class="text-xs tabular-nums text-muted-foreground"
          >window total: {Math.round(
            assessment.rollingScore + assessment.proposedScore,
          )}</Badge
        >
      {/if}
    </div>

    <AlertDialog.Footer>
      {#if breaksFast}
        <AlertDialog.Cancel onclick={oncancel}>Cancel</AlertDialog.Cancel>
        <AlertDialog.Action
          class="bg-red-600 hover:bg-red-700"
          onclick={onconfirm}>Break Fast & Log</AlertDialog.Action
        >
      {:else}
        <AlertDialog.Action onclick={onconfirm}>Log Entry</AlertDialog.Action>
      {/if}
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
