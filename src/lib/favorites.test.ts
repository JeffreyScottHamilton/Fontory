import { describe, expect, it } from "vitest";
import {
  FAVORITES_KEY,
  createFavoritesStore,
  parseFavorites,
  type StorageLike,
} from "@/lib/favorites";

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  failReads = false;
  getItem(key: string): string | null {
    if (this.failReads) throw new Error("denied");
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota");
    this.data.set(key, value);
  }
}

class FakeEvents {
  listeners = new Set<(key: string | null) => void>();
  subscribe(listener: (key: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  fire(key: string | null) {
    for (const fn of this.listeners) fn(key);
  }
}

function makeStore(storage: StorageLike | null) {
  const events = new FakeEvents();
  const store = createFavoritesStore({
    storage: () => storage,
    key: FAVORITES_KEY,
    events,
  });
  return { store, events };
}

describe("parseFavorites", () => {
  it("returns [] for null, empty, invalid JSON, and non-array JSON", () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites("")).toEqual([]);
    expect(parseFavorites("{not json")).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('"inter"')).toEqual([]);
  });

  it("keeps only non-empty strings and dedupes, preserving first occurrence order", () => {
    expect(parseFavorites('["inter", 3, null, "", "lora", "inter", {"x":1}]')).toEqual(["inter", "lora"]);
  });
});

describe("favorites store", () => {
  it("starts empty when storage has nothing", () => {
    const { store } = makeStore(new FakeStorage());
    expect(store.get()).toEqual([]);
    expect(store.isFavorite("inter")).toBe(false);
  });

  it("toggle adds then removes a slug and persists JSON under the key", () => {
    const storage = new FakeStorage();
    const { store } = makeStore(storage);

    store.toggle("inter");
    expect(store.isFavorite("inter")).toBe(true);
    expect(storage.data.get(FAVORITES_KEY)).toBe('["inter"]');

    store.toggle("lora");
    expect(store.get()).toEqual(["inter", "lora"]);

    store.toggle("inter");
    expect(store.get()).toEqual(["lora"]);
    expect(storage.data.get(FAVORITES_KEY)).toBe('["lora"]');
  });

  it("add and remove are idempotent", () => {
    const storage = new FakeStorage();
    const { store } = makeStore(storage);
    store.add("inter");
    store.add("inter");
    expect(store.get()).toEqual(["inter"]);
    store.remove("missing");
    expect(store.get()).toEqual(["inter"]);
    store.remove("inter");
    store.remove("inter");
    expect(store.get()).toEqual([]);
  });

  it("reads existing favorites from storage", () => {
    const storage = new FakeStorage();
    storage.data.set(FAVORITES_KEY, '["lora","inter","lora"]');
    const { store } = makeStore(storage);
    expect(store.get()).toEqual(["lora", "inter"]);
  });

  it("returns a stable reference while storage is unchanged", () => {
    const storage = new FakeStorage();
    storage.data.set(FAVORITES_KEY, '["inter"]');
    const { store } = makeStore(storage);
    const first = store.get();
    expect(store.get()).toBe(first);
    store.toggle("lora");
    const second = store.get();
    expect(second).not.toBe(first);
    expect(store.get()).toBe(second);
  });

  it("notifies subscribers on change and stops after unsubscribe", () => {
    const { store } = makeStore(new FakeStorage());
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.toggle("inter");
    expect(calls).toBe(1);
    unsubscribe();
    store.toggle("inter");
    expect(calls).toBe(1);
  });

  it("syncs across tabs through storage events", () => {
    const storage = new FakeStorage();
    const { store, events } = makeStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    expect(store.get()).toEqual([]);

    // Another tab writes the key.
    storage.data.set(FAVORITES_KEY, '["compare-me"]');
    events.fire(FAVORITES_KEY);
    expect(calls).toBe(1);
    expect(store.get()).toEqual(["compare-me"]);
  });

  it("ignores storage events for other keys", () => {
    const storage = new FakeStorage();
    const { store, events } = makeStore(storage);
    let calls = 0;
    store.subscribe(() => calls++);
    events.fire("some-other-key");
    expect(calls).toBe(0);
  });

  it("treats storage.clear() (key null) as a change", () => {
    const storage = new FakeStorage();
    storage.data.set(FAVORITES_KEY, '["inter"]');
    const { store, events } = makeStore(storage);
    expect(store.get()).toEqual(["inter"]);
    storage.data.clear();
    events.fire(null);
    expect(store.get()).toEqual([]);
  });

  it("works for the session when storage is unavailable (null)", () => {
    const { store } = makeStore(null);
    store.toggle("inter");
    expect(store.get()).toEqual(["inter"]);
    store.toggle("inter");
    expect(store.get()).toEqual([]);
  });

  it("keeps the in-session value when writes fail", () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const { store } = makeStore(storage);
    store.toggle("inter");
    expect(store.get()).toEqual(["inter"]);
  });

  it("returns [] and does not throw when reads fail", () => {
    const storage = new FakeStorage();
    storage.failReads = true;
    const { store } = makeStore(storage);
    expect(store.get()).toEqual([]);
    expect(() => store.toggle("inter")).not.toThrow();
  });

  it("recovers from corrupt stored JSON", () => {
    const storage = new FakeStorage();
    storage.data.set(FAVORITES_KEY, "not-json");
    const { store } = makeStore(storage);
    expect(store.get()).toEqual([]);
    store.toggle("inter");
    expect(store.get()).toEqual(["inter"]);
  });

  it("server snapshot is an empty list", () => {
    const { store } = makeStore(new FakeStorage());
    expect(store.getServerSnapshot()).toEqual([]);
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
  });
});
