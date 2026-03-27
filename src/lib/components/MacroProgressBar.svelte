<script lang="ts">
  interface Props {
    label: string;
    current: number;
    target: number;
    unit?: string;
    color?: "blue" | "green" | "yellow" | "purple" | "cyan";
    icon?: import("svelte").Component;
    subtitle?: string;
  }

  let {
    label,
    current,
    target,
    unit = "g",
    color = "blue",
    icon,
    subtitle,
  }: Props = $props();

  const pct = $derived(
    target > 0 ? Math.min((current / target) * 100, 100) : 0,
  );
  const over = $derived(current > target && target > 0);
  const remaining = $derived(Math.max(0, target - current));

  const colorMap: Record<string, { bar: string; text: string; bg: string }> = {
    blue: { bar: "bg-blue-500", text: "text-blue-400", bg: "bg-blue-500/10" },
    green: {
      bar: "bg-emerald-500",
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    yellow: {
      bar: "bg-amber-500",
      text: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    purple: {
      bar: "bg-purple-500",
      text: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    cyan: { bar: "bg-cyan-500", text: "text-cyan-400", bg: "bg-cyan-500/10" },
  };

  const colors = $derived(
    over
      ? { bar: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10" }
      : (colorMap[color] ?? colorMap.blue),
  );
</script>

<div class="space-y-1.5">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-1.5">
      {#if icon}
        {@const Icon = icon}
        <Icon class="h-3.5 w-3.5 {colors.text}" />
      {/if}
      <span class="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
    <div class="flex items-baseline gap-1">
      <span class="text-sm font-bold tabular-nums {colors.text}"
        >{Math.round(current)}</span
      >
      <span class="text-xs text-muted-foreground tabular-nums"
        >/ {target}{unit}</span
      >
    </div>
  </div>
  <div class="h-2 rounded-full overflow-hidden bg-secondary">
    <div
      class="h-full rounded-full transition-all duration-500 ease-out {colors.bar}"
      style="width: {pct}%"
    ></div>
  </div>
  {#if subtitle}
    <p class="text-[10px] text-muted-foreground tabular-nums">{subtitle}</p>
  {:else if remaining > 0 && target > 0}
    <p class="text-[10px] text-muted-foreground tabular-nums">
      {Math.round(remaining)}{unit} remaining
    </p>
  {:else if over}
    <p class="text-[10px] text-red-400 tabular-nums">
      {Math.round(current - target)}{unit} over target
    </p>
  {/if}
</div>
