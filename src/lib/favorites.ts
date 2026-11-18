import { useSyncExternalStore } from "react";

// Client-side favorites store over localStorage. Every storage access is
// guarded: if storage is missing, throws, or holds garbage, the store falls
// back to an in-session list (or an empty list) instead of failing.

export const FAVORITES_KEY = "fontory:favorites";

const EMPTY: string[] = [];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Subscribes to cross-tab storage notifications. Returns an unsubscribe fn. */
export interface StorageEvents {
  subscribe(listener: (key: string | null) => void): () => void;
}

/** Parses the raw stored value into a deduped list of slugs. Never throws. */
export function parseFavorites(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0 && !out.includes(item)) out.push(item);
  }
  return out;
}

export function createFavoritesStore(deps: {
  storage: () => StorageLike | null;
  key: string;
  events: StorageEvents | null;
}) {
  const { key } = deps;
  // Set once this tab has written; the source of truth until another tab changes storage.
  let memory: string[] | null = null;
  // Last raw string parsed from storage, so unchanged storage yields the same array reference.
  let cachedRaw: string | null | undefined = undefined;
  let cachedList: string[] = EMPTY;
  const listeners = new Set<() => void>();
  let detach: (() => void) | null = null;

  function notify() {
    for (const listener of listeners) listener();
  }

  function onStorage(changedKey: string | null) {
    if (changedKey !== null && changedKey !== key) return;
    memory = null;
    notify();
  }

  function safeStorage(): StorageLike | null {
    try {
      return deps.storage();
    } catch {
      return null;
    }
  }

  function get(): string[] {
    if (memory) return memory;
    const storage = safeStorage();
    if (!storage) return EMPTY;
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return EMPTY;
    }
    if (raw !== cachedRaw || cachedRaw === undefined) {
      cachedRaw = raw;
      cachedList = parseFavorites(raw);
    }
    return cachedList;
  }

  function write(next: string[]) {
    memory = next;
    const storage = safeStorage();
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        // Quota or private-mode failure: keep the in-session value.
      }
    }
    notify();
  }

  function add(slug: string) {
    const current = get();
    if (current.includes(slug)) return;
    write([...current, slug]);
  }

  function remove(slug: string) {
    const current = get();
    if (!current.includes(slug)) return;
    write(current.filter((s) => s !== slug));
  }

  function toggle(slug: string) {
    if (get().includes(slug)) remove(slug);
    else add(slug);
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (!detach && deps.events) detach = deps.events.subscribe(onStorage);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && detach) {
        detach();
        detach = null;
      }
    };
  }

  return {
    get,
    isFavorite: (slug: string) => get().includes(slug),
    add,
    remove,
    toggle,
    subscribe,
    getServerSnapshot: (): string[] => EMPTY,
  };
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

const browserEvents: StorageEvents | null =
  typeof window === "undefined"
    ? null
    : {
        subscribe(listener) {
          const handler = (event: StorageEvent) => listener(event.key);
          window.addEventListener("storage", handler);
          return () => window.removeEventListener("storage", handler);
        },
      };

const store = createFavoritesStore({
  storage: browserStorage,
  key: FAVORITES_KEY,
  events: browserEvents,
});

export const getFavorites = store.get;
export const isFavorite = store.isFavorite;
export const addFavorite = store.add;
export const removeFavorite = store.remove;
export const toggleFavorite = store.toggle;
export const subscribe = store.subscribe;

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, getFavorites, store.getServerSnapshot);
}
