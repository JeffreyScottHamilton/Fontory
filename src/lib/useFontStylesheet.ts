import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { cssUrl } from "@/lib/google-css";

export type StylesheetStatus = "idle" | "loading" | "ready" | "error";

interface SheetEntry {
  status: StylesheetStatus;
  listeners: Set<() => void>;
}

// One <link> per href, module-wide. Entries outlive components on purpose so
// a stylesheet is never injected twice.
const sheets = new Map<string, SheetEntry>();
// Hrefs whose load failed. Mounted hooks keep reporting "error" from here; a new
// mount clears the mark and injects the link again, so it can retry.
const failed = new Set<string>();

function ensureSheet(href: string): SheetEntry {
  const existing = sheets.get(href);
  if (existing) return existing;

  failed.delete(href);
  const entry: SheetEntry = { status: "loading", listeners: new Set() };
  sheets.set(href, entry);

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  const settle = (status: StylesheetStatus) => {
    entry.status = status;
    for (const listener of entry.listeners) listener();
  };
  link.addEventListener("load", () => settle("ready"));
  link.addEventListener("error", () => {
    link.remove();
    if (sheets.get(href) === entry) sheets.delete(href);
    failed.add(href);
    settle("error");
  });
  document.head.appendChild(link);
  return entry;
}

function subscribeSheet(href: string | null, listener: () => void): () => void {
  if (!href || typeof document === "undefined") return () => {};
  const entry = ensureSheet(href);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

function getSheetStatus(href: string | null): StylesheetStatus {
  if (!href) return "idle";
  const entry = sheets.get(href);
  if (entry) return entry.status;
  return failed.has(href) ? "error" : "idle";
}

/**
 * Injects a stylesheet <link> for href once (module-level Map) and reports its load state.
 * Pass null to do nothing.
 */
export function useFontStylesheet(href: string | null): StylesheetStatus {
  const subscribe = useCallback((listener: () => void) => subscribeSheet(href, listener), [href]);
  const getSnapshot = useCallback(() => getSheetStatus(href), [href]);
  return useSyncExternalStore(subscribe, getSnapshot, () => "idle" as StylesheetStatus);
}

export type FontReadyStatus = "loading" | "ready" | "error";

export const FONT_READY_TIMEOUT_MS = 15000;

export interface FontReadyOptions {
  /**
   * Status of a stylesheet the caller already loads (for example a combined css2 sheet
   * for every style). When set, no per-face <link> is injected and this status is used.
   */
  sheet?: StylesheetStatus;
}

/**
 * Reports whether the single family/weight/style face is usable.
 * - 'loading' while disabled, while the stylesheet loads, or while document.fonts.load runs
 * - 'ready' once document.fonts.load resolves with a face and document.fonts.check passes
 * - 'error' on stylesheet error, load rejection, no matching face, or after FONT_READY_TIMEOUT_MS
 */
export function useFontReady(
  family: string,
  weight: number,
  style: "normal" | "italic",
  enabled: boolean,
  options?: FontReadyOptions,
): FontReadyStatus {
  const external = options?.sheet !== undefined;
  const href = enabled && !external ? cssUrl(family, [{ weight, style }]) : null;
  const ownSheet = useFontStylesheet(href);
  const sheet = options?.sheet ?? ownSheet;
  const key = enabled ? `${family}|${weight}|${style}` : null;
  const [settled, setSettled] = useState<{ key: string; status: "ready" | "error" } | null>(null);

  // One timer per face, started on the first request. A stylesheet or font load that never settles
  // within FONT_READY_TIMEOUT_MS ends in 'error' instead of loading forever. A result that arrived
  // first is kept, because the updater leaves an existing settle for this key alone.
  useEffect(() => {
    if (!key || typeof document === "undefined") return;
    const timer = setTimeout(() => {
      setSettled((prev) => (prev?.key === key ? prev : { key, status: "error" }));
    }, FONT_READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [key]);

  useEffect(() => {
    if (!key || sheet !== "ready" || typeof document === "undefined" || !document.fonts) return;
    const spec = `${style} ${weight} 1em "${family}"`;
    let done = false;
    const finish = (status: "ready" | "error") => {
      if (done) return;
      done = true;
      setSettled({ key, status });
    };
    document.fonts.load(spec).then(
      (faces) => {
        let usable = false;
        try {
          usable = faces.length > 0 && document.fonts.check(spec);
        } catch {
          usable = false;
        }
        finish(usable ? "ready" : "error");
      },
      () => finish("error"),
    );
    return () => {
      done = true;
    };
  }, [key, sheet, family, weight, style]);

  if (!key) return "loading";
  if (sheet === "error") return "error";
  if (settled?.key === key) return settled.status;
  return "loading";
}
