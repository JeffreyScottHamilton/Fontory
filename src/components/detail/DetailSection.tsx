// Numbered editorial section: mono label column on md+, content column beside it.
// The number is aria-hidden so the heading's accessible name is the plain title.
interface DetailSectionProps {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}

export default function DetailSection({ id, number, title, children }: DetailSectionProps) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t border-ink pt-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-x-10 md:pt-6"
    >
      <h2 id={id} className="label-mono flex items-baseline gap-3 text-ink">
        <span aria-hidden="true" className="text-muted tabular-nums">
          {number}
        </span>
        <span>{title}</span>
      </h2>
      <div className="flex min-w-0 flex-col gap-8">{children}</div>
    </section>
  );
}
