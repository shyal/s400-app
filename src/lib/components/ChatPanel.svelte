<script lang="ts">
  import {
    getApiKey,
    setApiKey,
    sendMessage,
    isUsdaProxyEnabled,
    setUsdaProxy,
    DEFAULT_CHAT_MODEL,
    type ChatMessage,
  } from "$lib/services/anthropicChat";
  import { settingsStore } from "$lib/stores/settings.svelte";
  import type { ChatModel } from "$lib/types";
  import { marked } from "marked";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";

  import SendIcon from "@lucide/svelte/icons/send-horizontal";
  import BotIcon from "@lucide/svelte/icons/bot";
  import KeyIcon from "@lucide/svelte/icons/key-round";
  import CogIcon from "@lucide/svelte/icons/settings";
  import LoaderIcon from "@lucide/svelte/icons/loader";

  marked.setOptions({ breaks: true, gfm: true });

  function renderMd(text: string): string {
    return marked.parse(text) as string;
  }

  let messages = $state<ChatMessage[]>([]);
  let input = $state("");
  let loading = $state(false);
  let apiKey = $state(getApiKey() || "");
  let needsKey = $state(!getApiKey());
  let streamingText = $state("");
  let messagesEl: HTMLDivElement | undefined = $state();
  let expandedTools = $state<Set<number>>(new Set());
  let inputEl: HTMLInputElement | undefined = $state();
  let proxyEnabled = $state(isUsdaProxyEnabled());

  const modelOptions: { value: ChatModel; label: string }[] = [
    { value: "claude-sonnet-4-5-20250929", label: "Sonnet" },
    { value: "claude-opus-4-6", label: "Opus" },
    { value: "claude-haiku-4-5-20251001", label: "Haiku" },
  ];

  let selectedModel = $derived(
    settingsStore.value.chatModel ?? DEFAULT_CHAT_MODEL,
  );

  function onModelChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as ChatModel;
    settingsStore.update({ chatModel: value });
  }

  function scrollToBottom() {
    if (messagesEl) {
      requestAnimationFrame(() => {
        messagesEl!.scrollTop = messagesEl!.scrollHeight;
      });
    }
  }

  function toggleTool(idx: number) {
    const next = new Set(expandedTools);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    expandedTools = next;
  }

  function saveKey() {
    if (!apiKey.trim()) return;
    setApiKey(apiKey.trim());
    needsKey = false;
  }

  function toolLabel(name: string): string {
    switch (name) {
      case "search_food_nutrition":
        return "USDA Search";
      case "create_ingredient":
        return "Create Ingredient";
      case "edit_ingredient":
        return "Edit Ingredient";
      case "remove_ingredient":
        return "Remove Ingredient";
      case "create_recipe":
        return "Create Recipe";
      case "remove_recipe":
        return "Remove Recipe";
      case "log_food":
        return "Log Food";
      case "edit_food":
        return "Edit Food";
      case "log_supplement":
        return "Log Supplement";
      case "remove_food":
        return "Remove Food";
      case "remove_supplement":
        return "Remove Supplement";
      default:
        return name;
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    input = "";
    messages = [...messages, { role: "user", content: text }];
    loading = true;
    streamingText = "";
    scrollToBottom();

    try {
      const key = getApiKey()!;
      const { text: responseText } = await sendMessage(
        messages,
        key,
        (chunk) => {
          streamingText += chunk;
          scrollToBottom();
        },
        (toolName, query, result) => {
          messages = [
            ...messages,
            {
              role: "tool",
              content: "",
              toolName,
              toolQuery: query,
              toolResult: result,
            },
          ];
          scrollToBottom();
        },
        selectedModel,
      );

      if (responseText) {
        messages = [...messages, { role: "assistant", content: responseText }];
      }
      streamingText = "";
    } catch (e: any) {
      messages = [
        ...messages,
        { role: "assistant", content: `Error: ${e.message}` },
      ];
      streamingText = "";
    } finally {
      loading = false;
      scrollToBottom();
      requestAnimationFrame(() => inputEl?.focus());
    }
  }
</script>

<div
  class="flex flex-col h-[calc(100dvh-5rem)] sticky top-0 border-r border-border bg-background"
>
  <!-- Header -->
  <div
    class="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between"
  >
    <div class="flex items-center gap-1.5">
      <BotIcon class="h-4 w-4 text-primary" />
      <span class="text-sm font-bold">Nutrition Assistant</span>
    </div>
    <div class="flex items-center gap-2">
      <select
        class="h-6 text-[10px] bg-secondary border border-border rounded px-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
        value={selectedModel}
        onchange={onModelChange}
      >
        {#each modelOptions as opt (opt.value)}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <label
        class="flex items-center gap-1.5 cursor-pointer"
        title="Proxy USDA calls through edge function (use when VPN blocks API)"
      >
        <span class="text-[10px] text-muted-foreground">Proxy</span>
        <input
          type="checkbox"
          class="w-3.5 h-3.5 accent-primary"
          checked={proxyEnabled}
          onchange={() => {
            proxyEnabled = !proxyEnabled;
            setUsdaProxy(proxyEnabled);
          }}
        />
      </label>
    </div>
  </div>

  {#if needsKey}
    <div class="flex-1 flex flex-col items-center justify-center gap-3 px-4">
      <KeyIcon class="h-8 w-8 text-muted-foreground/30" />
      <p class="text-sm text-muted-foreground text-center">
        Enter your Anthropic API key.
      </p>
      <Input
        type="password"
        placeholder="sk-ant-..."
        bind:value={apiKey}
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter") saveKey();
        }}
      />
      <Button size="sm" onclick={saveKey}>
        <KeyIcon class="h-4 w-4 mr-1.5" />
        Save Key
      </Button>
    </div>
  {:else}
    <!-- Messages -->
    <div
      class="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      bind:this={messagesEl}
    >
      {#if messages.length === 0 && !streamingText}
        <div class="text-center mt-8">
          <BotIcon class="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p class="text-sm text-muted-foreground">
            Ask me about food, nutrition, or recipes.
          </p>
        </div>
      {/if}

      {#each messages as msg, idx (idx)}
        {#if msg.role === "tool"}
          <!-- Tool call bubble -->
          <div class="flex justify-start">
            <button
              class="max-w-[90%] w-full text-left px-3 py-1.5 rounded-lg text-xs bg-secondary/50 border border-border hover:border-muted-foreground/30 transition-colors"
              onclick={() => toggleTool(idx)}
            >
              <div class="flex items-center gap-2">
                <CogIcon class="h-3 w-3 text-amber-400 shrink-0" />
                <span class="text-muted-foreground font-medium"
                  >{toolLabel(msg.toolName || "")}</span
                >
                <span class="text-muted-foreground/60 truncate flex-1"
                  >{msg.toolQuery}</span
                >
                <span class="text-muted-foreground/40 shrink-0"
                  >{expandedTools.has(idx) ? "▾" : "▸"}</span
                >
              </div>
              {#if expandedTools.has(idx)}
                <div class="mt-2 space-y-1.5 text-[11px]">
                  <div>
                    <span class="text-muted-foreground/60">Query:</span>
                    <pre
                      class="text-muted-foreground whitespace-pre-wrap mt-0.5">{msg.toolQuery}</pre>
                  </div>
                  <div>
                    <span class="text-muted-foreground/60">Result:</span>
                    <pre
                      class="text-muted-foreground whitespace-pre-wrap mt-0.5 max-h-40 overflow-y-auto">{msg.toolResult}</pre>
                  </div>
                </div>
              {/if}
            </button>
          </div>
        {:else}
          <div
            class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}"
          >
            {#if msg.role === "user"}
              <div
                class="max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap bg-primary text-primary-foreground"
              >
                {msg.content}
              </div>
            {:else}
              <div
                class="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-card text-card-foreground border border-border prose-chat"
              >
                {@html renderMd(msg.content)}
              </div>
            {/if}
          </div>
        {/if}
      {/each}

      {#if streamingText}
        <div class="flex justify-start">
          <div
            class="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-card text-card-foreground border border-border prose-chat"
          >
            {@html renderMd(streamingText)}
          </div>
        </div>
      {/if}

      {#if loading && !streamingText}
        <div class="flex justify-start">
          <div
            class="px-3 py-2 rounded-lg text-sm bg-card text-muted-foreground border border-border flex items-center gap-2"
          >
            <LoaderIcon class="h-3.5 w-3.5 animate-spin" />
            Thinking...
          </div>
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="shrink-0 px-3 py-2 border-t border-border">
      <div class="flex gap-2">
        <input
          bind:this={inputEl}
          type="text"
          placeholder="Ask about nutrition..."
          bind:value={input}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="icon" onclick={send} disabled={loading || !input.trim()}>
          <SendIcon class="h-4 w-4" />
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.prose-chat) {
    line-height: 1.5;
  }
  :global(.prose-chat p) {
    margin: 0.25em 0;
  }
  :global(.prose-chat p:first-child) {
    margin-top: 0;
  }
  :global(.prose-chat p:last-child) {
    margin-bottom: 0;
  }
  :global(.prose-chat ul, .prose-chat ol) {
    margin: 0.25em 0;
    padding-left: 1.25em;
  }
  :global(.prose-chat li) {
    margin: 0.1em 0;
  }
  :global(.prose-chat strong) {
    font-weight: 600;
  }
  :global(.prose-chat code) {
    font-size: 0.85em;
    background: var(--secondary);
    padding: 0.15em 0.35em;
    border-radius: 0.25rem;
  }
  :global(.prose-chat pre) {
    background: var(--secondary);
    padding: 0.5em 0.75em;
    border-radius: 0.375rem;
    overflow-x: auto;
    margin: 0.35em 0;
  }
  :global(.prose-chat pre code) {
    background: none;
    padding: 0;
  }
  :global(.prose-chat h1, .prose-chat h2, .prose-chat h3) {
    font-weight: 600;
    margin: 0.5em 0 0.25em;
  }
  :global(.prose-chat h1) {
    font-size: 1.1em;
  }
  :global(.prose-chat h2) {
    font-size: 1.05em;
  }
  :global(.prose-chat h3) {
    font-size: 1em;
  }
  :global(.prose-chat hr) {
    border-color: var(--border);
    margin: 0.5em 0;
  }
  :global(.prose-chat table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
    margin: 0.35em 0;
  }
  :global(.prose-chat th, .prose-chat td) {
    border: 1px solid var(--border);
    padding: 0.25em 0.5em;
    text-align: left;
  }
  :global(.prose-chat th) {
    font-weight: 600;
    background: var(--secondary);
  }
</style>
