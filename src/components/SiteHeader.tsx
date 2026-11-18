import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/compare", label: "Compare" },
  { href: "/favorites", label: "Favorites" },
];

export default function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-6 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
          Fontory
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-baseline gap-5 text-sm text-muted">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
