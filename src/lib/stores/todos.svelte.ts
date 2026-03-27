import { uuid } from "$lib/uuid";

const STORAGE_KEY = "stronglifts-todos";

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

function loadTodos(): Todo[] {
  if (typeof localStorage === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function createTodosStore() {
  let todos = $state<Todo[]>(loadTodos());

  function save() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }
  }

  return {
    get items() {
      return todos;
    },
    get pending() {
      return todos.filter((t) => !t.completed);
    },
    get completed() {
      return todos.filter((t) => t.completed);
    },
    add(text: string) {
      if (!text.trim()) return;
      todos = [
        {
          id: uuid(),
          text: text.trim(),
          completed: false,
          createdAt: new Date().toISOString(),
        },
        ...todos,
      ];
      save();
    },
    toggle(id: string) {
      todos = todos.map((t) =>
        t.id === id ? { ...t, completed: !t.completed } : t,
      );
      save();
    },
    remove(id: string) {
      todos = todos.filter((t) => t.id !== id);
      save();
    },
    clearCompleted() {
      todos = todos.filter((t) => !t.completed);
      save();
    },
  };
}

export const todosStore = createTodosStore();
