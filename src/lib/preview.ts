import { useSyncExternalStore } from "react";

// Client-side store for the shared preview text and size (localStorage).
// Empty text means cards show DEFAULT_SAMPLE. All storage access is guarded.

export const PREVIEW_KEY = "fontory:preview";
export const DEFAULT_SAMPLE = "The quick brown fox jumps over the lazy dog";
export const MIN_SIZE = 12;
export const MAX_SIZE = 160;
export const DEFAULT_SIZE = 48;

export interface PreviewState {
  text: string;
  size: number;
}

export const DEFAULT_PREVIEW: PreviewState = { text: "", size: DEFAULT_SIZE };

const EMPTY_STATE: PreviewState = DEFAULT_PREVIEW;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StorageEvents {
  subscribe(listener: (key: string | null) => void): () => void;
}

export function clampSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));
}

/** Parses the stored JSON into a valid state. Never throws. */
export function parsePreview(raw: string | null | undefined): PreviewState {
  if (!raw) return DEFAULT_PREVIEW;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return DEFAULT_PREVIEW;
    const obj = value as Record<string, unknown>;
    return {
      text: typeof obj.text === "string" ? obj.text : "",
      size: clampSize(obj.size ?? DEFAULT_SIZE),
    };
  } catch {
    return DEFAULT_PREVIEW;
  }
}

export function createPreviewStore(deps: {
  storage: () => StorageLike | null;
  key: string;
  events: StorageEvents | null;
}) {
  const { key } = deps;
  let memory: PreviewState | null = null;
  let cachedRaw: string | null | undefined = undefined;
  let cachedState: PreviewState = EMPTY_STATE;
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

  function get(): PreviewState {
    if (memory) return memory;
    const storage = safeStorage();
    if (!storage) return EMPTY_STATE;
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return EMPTY_STATE;
    }
    if (raw !== cachedRaw || cachedRaw === undefined) {
      cachedRaw = raw;
      cachedState = parsePreview(raw);
    }
    return cachedState;
  }

  function write(next: PreviewState) {
    memory = next;
    const storage = safeStorage();
    if (storage) {
      try {
        storage.setItem(key, JSON.stringify(next));
      } catch {
        // Keep the in-session value.
      }
    }
    notify();
  }

  function setText(text: string) {
    const current = get();
    if (current.text === text) return;
    write({ ...current, text });
  }

  function setSize(size: number) {
    const clamped = clampSize(size);
    const current = get();
    if (current.size === clamped) return;
    write({ ...current, size: clamped });
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
    setText,
    setSize,
    subscribe,
    getServerSnapshot: (): PreviewState => EMPTY_STATE,
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

const store = createPreviewStore({
  storage: browserStorage,
  key: PREVIEW_KEY,
  events: browserEvents,
});

export const getPreview = store.get;
export const setPreviewText = store.setText;
export const setPreviewSize = store.setSize;
export const subscribePreview = store.subscribe;

/** Returns [state, setText, setSize]. Setters are stable across renders. */
export function usePreview(): [PreviewState, (text: string) => void, (size: number) => void] {
  const state = useSyncExternalStore(subscribePreview, getPreview, store.getServerSnapshot);
  return [state, setPreviewText, setPreviewSize];
}
