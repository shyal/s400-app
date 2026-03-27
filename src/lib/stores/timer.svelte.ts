import type { TimerState } from "$lib/types";
import { settingsStore } from "./settings.svelte";

const TIMER_KEY = "stronglifts-timer";

interface PersistedTimer {
  endsAt: number;
  duration: number;
}

function saveTimer(endsAt: number, duration: number) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(TIMER_KEY, JSON.stringify({ endsAt, duration }));
  }
}

function clearTimer() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(TIMER_KEY);
  }
}

function loadTimer(): PersistedTimer | null {
  if (typeof sessionStorage === "undefined") return null;
  const stored = sessionStorage.getItem(TIMER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function createTimerStore() {
  let state = $state<TimerState>("idle");
  let secondsRemaining = $state(0);
  let endsAt = $state(0);
  let duration = $state(0);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function playSound() {
    if (!settingsStore.value.soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio not available
    }
  }

  function vibrate() {
    if (!settingsStore.value.vibrationEnabled) return;
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }

  function finish() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    secondsRemaining = 0;
    state = "finished";
    clearTimer();
    playSound();
    vibrate();
  }

  function tick() {
    const remaining = Math.ceil((endsAt - Date.now()) / 1000);
    if (remaining <= 0) {
      finish();
      return;
    }
    secondsRemaining = remaining;
  }

  function start(seconds?: number) {
    stop();
    duration = seconds ?? settingsStore.value.restTimerSeconds;
    endsAt = Date.now() + duration * 1000;
    secondsRemaining = duration;
    state = "running";
    saveTimer(endsAt, duration);
    intervalId = setInterval(tick, 1000);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    state = "idle";
    clearTimer();
  }

  function reset() {
    stop();
    secondsRemaining = 0;
  }

  function addTime(seconds: number) {
    if (state === "running") {
      endsAt += seconds * 1000;
      secondsRemaining = Math.ceil((endsAt - Date.now()) / 1000);
      saveTimer(endsAt, duration);
    } else if (state === "finished") {
      endsAt = Date.now() + seconds * 1000;
      secondsRemaining = seconds;
      state = "running";
      saveTimer(endsAt, duration);
      intervalId = setInterval(tick, 1000);
    }
  }

  // Restore timer from sessionStorage on load
  function restore() {
    const persisted = loadTimer();
    if (!persisted) return;
    const remaining = Math.ceil((persisted.endsAt - Date.now()) / 1000);
    if (remaining <= 0) {
      // Timer expired while we were away
      clearTimer();
      secondsRemaining = 0;
      state = "finished";
      playSound();
      vibrate();
    } else {
      endsAt = persisted.endsAt;
      duration = persisted.duration;
      secondsRemaining = remaining;
      state = "running";
      intervalId = setInterval(tick, 1000);
    }
  }

  // Recalculate when returning from background
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state === "running") {
        tick();
      }
    });
    restore();
  }

  return {
    get state() {
      return state;
    },
    get secondsRemaining() {
      return secondsRemaining;
    },
    get formattedTime() {
      const mins = Math.floor(secondsRemaining / 60);
      const secs = secondsRemaining % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
    start,
    stop,
    reset,
    addTime,
  };
}

export const timerStore = createTimerStore();
