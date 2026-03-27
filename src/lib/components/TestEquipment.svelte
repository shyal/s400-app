<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import DropletIcon from "@lucide/svelte/icons/droplet";
  import ActivityIcon from "@lucide/svelte/icons/activity";
  import XIcon from "@lucide/svelte/icons/x";
  import CheckIcon from "@lucide/svelte/icons/check";
  import LoaderIcon from "@lucide/svelte/icons/loader";
  import { onMount } from "svelte";
  import type { TestEquipment as TEquipment, EquipmentType } from "$lib/types";
  import {
    fetchEquipment,
    addEquipment,
    updateEquipment,
    deleteEquipment,
  } from "$lib/services/equipmentData";

  let items = $state<TEquipment[]>([]);
  let loading = $state(true);
  let showForm = $state(false);
  let editingId = $state<number | null>(null);

  // Form state
  let formType = $state<EquipmentType>("glucose_meter");
  let formMaker = $state("");
  let formModel = $state("");
  let formQuantity = $state(1);
  let formExpiry = $state("");
  let formNotes = $state("");
  let saving = $state(false);

  const typeLabels: Record<EquipmentType, string> = {
    glucose_meter: "Glucose Meter",
    ketone_meter: "Ketone Meter",
    dual_meter: "Dual Meter",
    glucose_strips: "Glucose Strips",
    ketone_strips: "Ketone Strips",
  };

  const isStrips = (t: EquipmentType) => t.endsWith("_strips");
  const isMeter = (t: EquipmentType) => t.endsWith("_meter");

  function isExpired(date: string | null): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  function isLowStock(qty: number): boolean {
    return qty <= 10;
  }

  const meters = $derived(items.filter((i) => isMeter(i.type)));
  const strips = $derived(items.filter((i) => isStrips(i.type)));

  async function load() {
    loading = true;
    items = await fetchEquipment();
    loading = false;
  }

  function resetForm() {
    formType = "glucose_meter";
    formMaker = "";
    formModel = "";
    formQuantity = 1;
    formExpiry = "";
    formNotes = "";
    editingId = null;
    showForm = false;
  }

  function startEdit(item: TEquipment) {
    editingId = item.id;
    formType = item.type;
    formMaker = item.maker ?? "";
    formModel = item.model ?? "";
    formQuantity = item.quantity;
    formExpiry = item.expiry_date ?? "";
    formNotes = item.notes ?? "";
    showForm = true;
  }

  async function handleSave() {
    saving = true;
    const payload = {
      type: formType,
      maker: formMaker || null,
      model: formModel || null,
      quantity: isStrips(formType) ? formQuantity : 1,
      expiry_date: formExpiry || null,
      notes: formNotes || null,
    };

    if (editingId !== null) {
      await updateEquipment(editingId, payload);
    } else {
      await addEquipment(payload);
    }

    await load();
    resetForm();
    saving = false;
  }

  async function handleDelete(id: number) {
    await deleteEquipment(id);
    items = items.filter((i) => i.id !== id);
  }

  async function adjustQuantity(item: TEquipment, delta: number) {
    const newQty = Math.max(0, item.quantity + delta);
    await updateEquipment(item.id, { quantity: newQty });
    item.quantity = newQty;
  }

  onMount(() => {
    load();
  });
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <DropletIcon class="h-4 w-4 text-blue-500" />
        <Card.Title class="text-sm font-semibold">Test Equipment</Card.Title>
      </div>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 w-7 p-0"
        onclick={() => {
          if (showForm) resetForm();
          else showForm = true;
        }}
      >
        {#if showForm}
          <XIcon class="h-4 w-4" />
        {:else}
          <PlusIcon class="h-4 w-4" />
        {/if}
      </Button>
    </div>
  </Card.Header>
  <Card.Content class="px-4 pb-3">
    {#if loading}
      <div class="flex items-center justify-center py-4">
        <LoaderIcon class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    {:else}
      {#if showForm}
        <div
          class="space-y-2 mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
        >
          <select
            bind:value={formType}
            class="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
          >
            {#each Object.entries(typeLabels) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>

          <div class="grid grid-cols-2 gap-2">
            <input
              bind:value={formMaker}
              placeholder="Maker (e.g. Accu-Chek)"
              class="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
            />
            <input
              bind:value={formModel}
              placeholder="Model (e.g. Guide)"
              class="px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
            />
          </div>

          {#if isStrips(formType)}
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label
                  for="eq-quantity"
                  class="text-xs text-slate-400 mb-1 block">Quantity</label
                >
                <input
                  id="eq-quantity"
                  type="number"
                  bind:value={formQuantity}
                  min="0"
                  class="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
                />
              </div>
              <div>
                <label for="eq-expiry" class="text-xs text-slate-400 mb-1 block"
                  >Expiry Date</label
                >
                <input
                  id="eq-expiry"
                  type="date"
                  bind:value={formExpiry}
                  class="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
                />
              </div>
            </div>
          {/if}

          <input
            bind:value={formNotes}
            placeholder="Notes (optional)"
            class="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm"
          />

          <Button
            size="sm"
            class="w-full h-8 text-xs"
            onclick={handleSave}
            disabled={saving}
          >
            {#if saving}
              <LoaderIcon class="h-3.5 w-3.5 mr-1 animate-spin" />
              Saving...
            {:else}
              <CheckIcon class="h-3.5 w-3.5 mr-1" />
              {editingId !== null ? "Update" : "Add"}
            {/if}
          </Button>
        </div>
      {/if}

      {#if meters.length > 0}
        <div class="mb-2">
          <h3
            class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5"
          >
            Meters
          </h3>
          <div class="space-y-1.5">
            {#each meters as item (item.id)}
              <div
                class="flex items-center justify-between p-2 rounded bg-slate-800/30"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <ActivityIcon class="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <div class="min-w-0">
                    <span class="text-sm truncate block"
                      >{typeLabels[item.type]}</span
                    >
                    {#if item.maker || item.model}
                      <span class="text-xs text-slate-400 truncate block">
                        {[item.maker, item.model].filter(Boolean).join(" ")}
                      </span>
                    {/if}
                    {#if item.notes}
                      <span class="text-xs text-slate-500 truncate block"
                        >{item.notes}</span
                      >
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0"
                    onclick={() => startEdit(item)}
                  >
                    <PencilIcon class="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    onclick={() => handleDelete(item.id)}
                  >
                    <Trash2Icon class="h-3 w-3" />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if strips.length > 0}
        <div>
          <h3
            class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5"
          >
            Strips
          </h3>
          <div class="space-y-1.5">
            {#each strips as item (item.id)}
              <div
                class="flex items-center justify-between p-2 rounded bg-slate-800/30"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <DropletIcon class="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm">{typeLabels[item.type]}</span>
                      {#if isExpired(item.expiry_date)}
                        <Badge
                          variant="destructive"
                          class="text-[9px] px-1 py-0 h-4">Expired</Badge
                        >
                      {:else if isLowStock(item.quantity)}
                        <Badge
                          variant="outline"
                          class="text-[9px] px-1 py-0 h-4 text-amber-400 border-amber-500/30"
                          >Low</Badge
                        >
                      {/if}
                    </div>
                    {#if item.maker || item.model}
                      <span class="text-xs text-slate-400 truncate block">
                        {[item.maker, item.model].filter(Boolean).join(" ")}
                      </span>
                    {/if}
                    {#if item.expiry_date}
                      <span class="text-xs text-slate-500"
                        >Exp: {item.expiry_date}</span
                      >
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0"
                    onclick={() => adjustQuantity(item, -1)}
                  >
                    <MinusIcon class="h-3 w-3" />
                  </Button>
                  <span class="text-sm font-mono w-8 text-center"
                    >{item.quantity}</span
                  >
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0"
                    onclick={() => adjustQuantity(item, 1)}
                  >
                    <PlusIcon class="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0"
                    onclick={() => startEdit(item)}
                  >
                    <PencilIcon class="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                    onclick={() => handleDelete(item.id)}
                  >
                    <Trash2Icon class="h-3 w-3" />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if items.length === 0 && !showForm}
        <p class="text-xs text-muted-foreground text-center py-3">
          No equipment added yet. Tap + to add a meter or strips.
        </p>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
