import type { Metadata } from "next";
import { Suspense } from "react";
import CompareView from "@/components/compare/CompareView";
import { getIndex } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare",
};

export default function ComparePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Compare</h1>
        <p className="text-sm text-muted">Set two fonts side by side with the same text.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <CompareView index={getIndex()} />
      </Suspense>
    </div>
  );
}
