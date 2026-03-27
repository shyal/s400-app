export function getItem<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === "undefined") return defaultValue;

  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key);
}

export function exportData(): string {
  if (typeof localStorage === "undefined") return "{}";

  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("stronglifts-")) {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
  }
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString: string): boolean {
  if (typeof localStorage === "undefined") return false;

  try {
    const data = JSON.parse(jsonString);
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("stronglifts-")) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    }
    return true;
  } catch {
    return false;
  }
}
