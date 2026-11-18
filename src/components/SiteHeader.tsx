"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFavorites } from "@/lib/favorites";

const NAV_LINKS = [
  { href: "/", label: "Browse" },
  { href: "/compare", label: "Compare" },
  { href: "/favorites", label: "Favorites" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const favoriteCount = useFavorites().length;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ground">
      <div className="site-container flex h-16 items-center justify-between gap-4 md:gap-6">
        <Link
          href="/"
          className="font-display text-[22px] leading-none font-semibold tracking-[-0.02em] text-ink md:text-[26px]"
        >
          Font<em className="font-normal italic">ory</em>
        </Link>
        <nav aria-label="Primary">
          <ul className="flex items-center gap-4 text-sm md:gap-6">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "inline-flex min-h-11 items-center text-ink underline decoration-1 underline-offset-[6px]"
                        : "inline-flex min-h-11 items-center text-muted transition-colors duration-150 hover:text-ink"
                    }
                  >
                    {link.label}
                    {link.href === "/favorites" && favoriteCount > 0 && (
                      <span className="ml-1.5 font-mono text-[11px] tabular-nums text-muted">
                        {favoriteCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
