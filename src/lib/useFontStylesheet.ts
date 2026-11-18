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

function ensureSheet(href: string): SheetEntry {
  const existing = sheets.get(href);
  if (existing) return existing;

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
  link.addEventListener("error", () => settle("error"));
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
  return sheets.get(href)?.status ?? "idle";
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
): FontReadyStatus {
  const href = enabled ? cssUrl(family, [{ weight, style }]) : null;
  const sheet = useFontStylesheet(href);
  const key = href ? `${family}|${weight}|${style}` : null;
  const [settled, setSettled] = useState<{ key: string; status: "ready" | "error" } | null>(null);

  useEffect(() => {
    if (!key || sheet !== "ready" || typeof document === "undefined" || !document.fonts) return;
    const spec = `${style} ${weight} 1em "${family}"`;
    let done = false;
    const finish = (status: "ready" | "error") => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setSettled({ key, status });
    };
    const timer = setTimeout(() => finish("error"), FONT_READY_TIMEOUT_MS);
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
      clearTimeout(timer);
    };
  }, [key, sheet, family, weight, style]);

  if (!key) return "loading";
  if (sheet === "error") return "error";
  if (settled?.key === key) return settled.status;
  return "loading";
}
