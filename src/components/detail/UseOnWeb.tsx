import CopyCssButton from "@/components/CopyCssButton";

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
    <div className="flex flex-col gap-6">
      {BLOCKS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-2">
          <p className="text-sm text-muted">{label}</p>
          <pre className="max-w-full overflow-x-auto border border-rule bg-ground p-3 font-mono text-sm text-ink">
            <code>{props[key]}</code>
          </pre>
          <CopyCssButton text={props[key]} />
        </div>
      ))}
    </div>
  );
}
