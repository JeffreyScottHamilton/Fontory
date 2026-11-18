import CopyCssButton from "@/components/CopyCssButton";
import DetailSection from "@/components/detail/DetailSection";
import type { SnippetBlock } from "@/lib/preview-css";

interface UseOnWebProps {
  blocks: SnippetBlock[];
}

export default function UseOnWeb({ blocks }: UseOnWebProps) {
  return (
    <DetailSection id="web-heading" number="04" title="Use on the web">
      {blocks.map(({ label, code }) => (
        <div key={label} className="flex min-w-0 flex-col gap-3">
          <p className="label-mono">{label}</p>
          <pre className="max-w-full overflow-x-auto border border-rule bg-ground p-4 font-mono text-sm leading-6 text-ink">
            <code>{code}</code>
          </pre>
          <div>
            <CopyCssButton text={code} />
          </div>
        </div>
      ))}
    </DetailSection>
  );
}
