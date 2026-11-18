import type { Metadata } from "next";
import { Suspense } from "react";
import CompareView from "@/components/compare/CompareView";
import { getIndex } from "@/lib/data";

export const metadata: Metadata = {
  title: "Compare",
};

export default function ComparePage() {
  return (
    <Suspense fallback={<p className="label-mono">Loading…</p>}>
      <CompareView index={getIndex()} />
    </Suspense>
  );
}
