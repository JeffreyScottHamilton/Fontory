import CopyCssButton from "@/components/CopyCssButton";
import DetailSection from "@/components/detail/DetailSection";

interface UseOnWebProps {
  linkTag: string;
  importLine: string;
  fontFamilyLine: string;
}

const BLOCKS: { key: keyof UseOnWebProps; label: string }[] = [
  { key: "linkTag", label: "HTML link" },
  { key: "importLine", label: "CSS import" },
  { key: "fontFamilyLine", label: "CSS font-family" },
];

export default function UseOnWeb(props: UseOnWebProps) {
  return (
    <DetailSection id="web-heading" number="04" title="Use on the web">
      {BLOCKS.map(({ key, label }) => (
        <div key={key} className="flex min-w-0 flex-col gap-3">
          <p className="label-mono">{label}</p>
          <pre className="max-w-full overflow-x-auto border border-rule bg-ground p-4 font-mono text-sm leading-6 text-ink">
            <code>{props[key]}</code>
          </pre>
          <div>
            <CopyCssButton text={props[key]} />
          </div>
        </div>
      ))}
    </DetailSection>
  );
}
