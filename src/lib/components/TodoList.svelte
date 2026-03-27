<script lang="ts">
  import { todosStore } from "$lib/stores/todos.svelte";

  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Badge } from "$lib/components/ui/badge";
  import { Checkbox } from "$lib/components/ui/checkbox";

  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import XIcon from "@lucide/svelte/icons/x";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";

  let newTodo = $state("");

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!newTodo.trim()) return;
    todosStore.add(newTodo);
    newTodo = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  }

  const pendingCount = $derived(todosStore.pending.length);
</script>

<Card.Root>
  <Card.Header>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"
        >
          <ListTodoIcon class="h-5 w-5 text-primary" />
        </div>
        <div class="flex items-center gap-2">
          <Card.Title>Tasks</Card.Title>
          {#if pendingCount > 0}
            <Badge variant="default" class="text-xs">{pendingCount}</Badge>
          {/if}
        </div>
      </div>
      {#if todosStore.completed.length > 0}
        <Button
          variant="ghost"
          size="sm"
          class="text-xs text-muted-foreground h-7"
          onclick={() => todosStore.clearCompleted()}
        >
          <Trash2Icon class="h-3 w-3 mr-1" />
          Clear done
        </Button>
      {/if}
    </div>
  </Card.Header>

  <Card.Content class="space-y-3">
    <form onsubmit={handleSubmit}>
      <Input
        type="text"
        bind:value={newTodo}
        onkeydown={handleKeydown}
        placeholder="Add task..."
        class="h-11"
      />
    </form>

    {#if todosStore.items.length === 0}
      <p class="text-muted-foreground text-center py-4 text-sm">No tasks yet</p>
    {:else}
      <div class="space-y-1">
        {#each todosStore.pending as todo (todo.id)}
          <div
            class="flex items-center gap-3 group rounded-lg p-2.5 hover:bg-secondary/50 transition-colors"
          >
            <Checkbox
              checked={false}
              onCheckedChange={() => todosStore.toggle(todo.id)}
            />
            <span class="flex-1 text-sm">{todo.text}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity h-7 w-7"
              onclick={() => todosStore.remove(todo.id)}
            >
              <XIcon class="h-3.5 w-3.5" />
            </Button>
          </div>
        {/each}
        {#each todosStore.completed as todo (todo.id)}
          <div
            class="flex items-center gap-3 group rounded-lg p-2.5 opacity-50"
          >
            <Checkbox
              checked={true}
              onCheckedChange={() => todosStore.toggle(todo.id)}
            />
            <span class="flex-1 text-sm line-through text-muted-foreground"
              >{todo.text}</span
            >
            <Button
              variant="ghost"
              size="icon-sm"
              class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity h-7 w-7"
              onclick={() => todosStore.remove(todo.id)}
            >
              <XIcon class="h-3.5 w-3.5" />
            </Button>
          </div>
        {/each}
      </div>
    {/if}
  </Card.Content>
</Card.Root>
