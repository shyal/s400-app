<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import type { MacroTargets } from "$lib/types";
  import { localDateStr } from "$lib/utils/date";
  import {
    fetchFoodEntriesRange,
    fetchWaterEntriesRange,
  } from "$lib/services/nutritionData";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CalendarIcon from "@lucide/svelte/icons/calendar";

  interface Props {
    targets: MacroTargets;
    selectedDate: string;
    onSelectDate: (date: string) => void;
  }

  let { targets, selectedDate, onSelectDate }: Props = $props();

  interface DaySummary {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    water_ml: number;
  }

  let currentYear = $state(parseInt(selectedDate.slice(0, 4)));
  let currentMonth = $state(parseInt(selectedDate.slice(5, 7)) - 1);

  // Sync month view when selectedDate changes to a different month
  let lastSyncedDate = $state(selectedDate);
  $effect(() => {
    if (selectedDate !== lastSyncedDate) {
      const newYear = parseInt(selectedDate.slice(0, 4));
      const newMonth = parseInt(selectedDate.slice(5, 7)) - 1;
      if (newYear !== currentYear || newMonth !== currentMonth) {
        currentYear = newYear;
        currentMonth = newMonth;
      }
      lastSyncedDate = selectedDate;
    }
  });

  let dailyStats = $state(new SvelteMap<string, DaySummary>());

  const todayStr = localDateStr();

  const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const calendarGrid = $derived.by(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // getDay: 0=Sun, we want Mon=0
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];

    for (let i = 0; i < startDow; i++) week.push(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    return weeks;
  });

  function dateStr(day: number): string {
    const m = String(currentMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${currentYear}-${m}-${d}`;
  }

  function prevMonth() {
    if (currentMonth === 0) {
      currentMonth = 11;
      currentYear--;
    } else {
      currentMonth--;
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      currentMonth = 0;
      currentYear++;
    } else {
      currentMonth++;
    }
  }

  // Fetch data when month changes
  $effect(() => {
    const y = currentYear;
    const m = currentMonth;
    const startDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const endDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    Promise.all([
      fetchFoodEntriesRange(startDate, endDate),
      fetchWaterEntriesRange(startDate, endDate),
    ])
      .then(([food, water]) => {
        const map = new SvelteMap<string, DaySummary>();

        for (const e of food) {
          const existing = map.get(e.date) ?? {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            water_ml: 0,
          };
          existing.calories += e.calories;
          existing.protein_g += e.protein_g;
          existing.carbs_g += e.carbs_g;
          existing.fat_g += e.fat_g;
          existing.water_ml += e.water_ml ?? 0;
          map.set(e.date, existing);
        }

        for (const e of water) {
          const existing = map.get(e.date) ?? {
            calories: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
            water_ml: 0,
          };
          existing.water_ml += e.amount_ml;
          map.set(e.date, existing);
        }

        dailyStats = map;
      })
      .catch(() => {});
  });

  const MACROS: {
    key: keyof DaySummary;
    targetKey: keyof MacroTargets;
    color: string;
  }[] = [
    { key: "calories", targetKey: "calories", color: "bg-blue-500" },
    { key: "protein_g", targetKey: "protein_g", color: "bg-emerald-500" },
    { key: "carbs_g", targetKey: "carbs_g", color: "bg-amber-500" },
    { key: "fat_g", targetKey: "fat_g", color: "bg-purple-500" },
    { key: "water_ml", targetKey: "water_ml", color: "bg-cyan-500" },
  ];

  function barPct(
    stats: DaySummary | undefined,
    macro: (typeof MACROS)[0],
  ): number {
    if (!stats) return 0;
    const target = targets[macro.targetKey];
    if (target <= 0) return 0;
    return Math.min(100, Math.round((stats[macro.key] / target) * 100));
  }
</script>

<Card.Root>
  <Card.Header class="pb-2 pt-3 px-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <CalendarIcon class="h-4 w-4 text-muted-foreground" />
        <Card.Title class="text-sm font-semibold">Monthly Overview</Card.Title>
      </div>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-6 w-6"
          onclick={prevMonth}
        >
          <ChevronLeftIcon class="h-3.5 w-3.5" />
        </Button>
        <span class="text-xs font-medium min-w-[110px] text-center">
          {MONTH_NAMES[currentMonth]}
          {currentYear}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-6 w-6"
          onclick={nextMonth}
        >
          <ChevronRightIcon class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </Card.Header>
  <Card.Content class="px-4 pb-3">
    <!-- Day headers -->
    <div class="grid grid-cols-7 gap-0.5 mb-1">
      {#each DAY_LABELS as label (label)}
        <div class="text-[10px] text-muted-foreground text-center font-medium">
          {label}
        </div>
      {/each}
    </div>

    <!-- Calendar grid -->
    <div class="grid grid-cols-7 gap-0.5">
      {#each calendarGrid as week, wi (wi)}
        {#each week as day, di (di)}
          {#if day === null}
            <div class="h-12"></div>
          {:else}
            {@const ds = dateStr(day)}
            {@const isSelected = ds === selectedDate}
            {@const isToday = ds === todayStr}
            {@const stats = dailyStats.get(ds)}
            <button
              class="h-12 rounded-md flex flex-col items-center px-0.5 pt-1 pb-0.5 gap-[1px] transition-colors
								{isSelected ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-secondary/50'}
								{isToday && !isSelected ? 'bg-secondary/30' : ''}"
              onclick={() => onSelectDate(ds)}
            >
              <span
                class="text-[11px] leading-none tabular-nums mb-auto {isToday
                  ? 'font-bold'
                  : ''} {!stats && !isToday ? 'text-muted-foreground/50' : ''}"
              >
                {day}
              </span>
              {#if stats}
                <div class="w-full flex flex-col gap-[1px]">
                  {#each MACROS as macro (macro.key)}
                    <div
                      class="w-full h-[3px] rounded-full bg-secondary/60 overflow-hidden"
                    >
                      <div
                        class="h-full rounded-full {macro.color} {barPct(
                          stats,
                          macro,
                        ) >= 80
                          ? ''
                          : 'opacity-60'}"
                        style="width: {barPct(stats, macro)}%"
                      ></div>
                    </div>
                  {/each}
                </div>
              {/if}
            </button>
          {/if}
        {/each}
      {/each}
    </div>

    <!-- Legend -->
    <div
      class="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-border/50"
    >
      {#each [{ label: "Cal", color: "bg-blue-500" }, { label: "Pro", color: "bg-emerald-500" }, { label: "Carb", color: "bg-amber-500" }, { label: "Fat", color: "bg-purple-500" }, { label: "H₂O", color: "bg-cyan-500" }] as item (item.label)}
        <div class="flex items-center gap-1">
          <div class="w-3 h-[3px] rounded-full {item.color}"></div>
          <span class="text-[9px] text-muted-foreground">{item.label}</span>
        </div>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
