<script lang="ts">
  import type { BiomarkerDefinition, BiomarkerMeasurement } from "$lib/types";

  interface Props {
    definition: BiomarkerDefinition;
    measurements: BiomarkerMeasurement[];
  }

  let { definition, measurements }: Props = $props();

  const pad = { top: 12, right: 12, bottom: 24, left: 48 };
  const chartW = 600;
  const chartH = 256;

  const sorted = $derived(
    [...measurements].sort((a, b) => a.date.localeCompare(b.date)),
  );

  const yDomain = $derived.by(() => {
    if (sorted.length === 0) return { min: 0, max: 100 };
    const vals = sorted.map((e) => e.value);
    if (definition.optimalMin != null) vals.push(definition.optimalMin);
    if (definition.optimalMax != null) vals.push(definition.optimalMax);
    if (definition.warningMax != null) vals.push(definition.warningMax);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const margin = Math.max((hi - lo) * 0.15, 1);
    return { min: Math.floor(lo - margin), max: Math.ceil(hi + margin) };
  });

  function scaleX(i: number): number {
    if (sorted.length <= 1) return pad.left;
    return (
      pad.left + (i / (sorted.length - 1)) * (chartW - pad.left - pad.right)
    );
  }

  function scaleY(v: number): number {
    const range = yDomain.max - yDomain.min || 1;
    return (
      pad.top +
      (1 - (v - yDomain.min) / range) * (chartH - pad.top - pad.bottom)
    );
  }

  const polyline = $derived(
    sorted.map((e, i) => `${scaleX(i)},${scaleY(e.value)}`).join(" "),
  );
  const areaPath = $derived.by(() => {
    if (sorted.length < 2) return "";
    const bottom = chartH - pad.bottom;
    const pts = sorted.map((e, i) => `${scaleX(i)},${scaleY(e.value)}`);
    return `M${scaleX(0)},${bottom} L${pts.join(" L")} L${scaleX(sorted.length - 1)},${bottom} Z`;
  });

  const yTicks = $derived.by(() => {
    const range = yDomain.max - yDomain.min;
    const step = range <= 10 ? 1 : range <= 30 ? 5 : range <= 100 ? 10 : 20;
    const ticks: number[] = [];
    for (let v = yDomain.min; v <= yDomain.max; v += step) ticks.push(v);
    return ticks;
  });

  const xLabels = $derived.by(() => {
    if (sorted.length <= 1) return [];
    const maxLabels = 6;
    const step = Math.max(1, Math.floor(sorted.length / maxLabels));
    const labels: { x: number; label: string }[] = [];
    for (let i = 0; i < sorted.length; i += step) {
      const d = new Date(sorted[i].date);
      labels.push({
        x: scaleX(i),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
      });
    }
    return labels;
  });

  const optMinY = $derived(
    definition.optimalMin != null ? scaleY(definition.optimalMin) : null,
  );
  const optMaxY = $derived(
    definition.optimalMax != null ? scaleY(definition.optimalMax) : null,
  );
  const warnMaxY = $derived(
    definition.warningMax != null ? scaleY(definition.warningMax) : null,
  );
</script>

<div class="card">
  <h3 class="font-bold text-sm text-slate-300 mb-3">{definition.name} Trend</h3>
  {#if sorted.length === 0}
    <div class="h-64 flex items-center justify-center text-slate-500">
      No measurements yet
    </div>
  {:else}
    <svg viewBox="0 0 {chartW} {chartH}" class="w-full h-64">
      <!-- Grid -->
      {#each yTicks as tick (tick)}
        <line
          x1={pad.left}
          y1={scaleY(tick)}
          x2={chartW - pad.right}
          y2={scaleY(tick)}
          stroke="#334155"
          stroke-width="0.5"
        />
        <text
          x={pad.left - 4}
          y={scaleY(tick) + 3}
          text-anchor="end"
          fill="#64748b"
          font-size="10">{tick}</text
        >
      {/each}

      <!-- X labels -->
      {#each xLabels as { x, label } (x)}
        <text
          {x}
          y={chartH - 4}
          text-anchor="middle"
          fill="#64748b"
          font-size="10">{label}</text
        >
      {/each}

      <!-- Optimal range band -->
      {#if optMinY != null && optMaxY != null}
        <rect
          x={pad.left}
          y={optMaxY}
          width={chartW - pad.left - pad.right}
          height={optMinY - optMaxY}
          fill="#22c55e"
          opacity="0.08"
        />
        <line
          x1={pad.left}
          y1={optMaxY}
          x2={chartW - pad.right}
          y2={optMaxY}
          stroke="#22c55e"
          stroke-width="0.5"
          opacity="0.5"
        />
        <line
          x1={pad.left}
          y1={optMinY}
          x2={chartW - pad.right}
          y2={optMinY}
          stroke="#22c55e"
          stroke-width="0.5"
          opacity="0.5"
        />
      {:else if optMaxY != null}
        <line
          x1={pad.left}
          y1={optMaxY}
          x2={chartW - pad.right}
          y2={optMaxY}
          stroke="#22c55e"
          stroke-width="1"
          stroke-dasharray="5,5"
        />
      {:else if optMinY != null}
        <line
          x1={pad.left}
          y1={optMinY}
          x2={chartW - pad.right}
          y2={optMinY}
          stroke="#22c55e"
          stroke-width="1"
          stroke-dasharray="5,5"
        />
      {/if}

      <!-- Warning max line -->
      {#if warnMaxY != null}
        <line
          x1={pad.left}
          y1={warnMaxY}
          x2={chartW - pad.right}
          y2={warnMaxY}
          stroke="#ef4444"
          stroke-width="1"
          stroke-dasharray="2,2"
        />
      {/if}

      <!-- Fill -->
      <path d={areaPath} fill="#3b82f6" opacity="0.1" />

      <!-- Line -->
      <polyline
        points={polyline}
        fill="none"
        stroke="#3b82f6"
        stroke-width="2"
        stroke-linejoin="round"
      />

      <!-- Points -->
      {#each sorted as entry, i (entry.id)}
        <circle
          cx={scaleX(i)}
          cy={scaleY(entry.value)}
          r="3.5"
          fill="#3b82f6"
        />
      {/each}
    </svg>
  {/if}
</div>
