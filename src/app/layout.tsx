import type { Metadata, Viewport } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s — Fontory",
    default: "Fontory — Find your type.",
  },
  description:
    "Discover, preview and download open-licensed fonts from the Google Fonts collection.",
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
        <footer className="border-t border-rule">
          <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted">
            Fonts from the Google Fonts collection (
            <Link
              href="https://github.com/google/fonts"
              className="underline underline-offset-2 hover:text-ink"
            >
              github.com/google/fonts
            </Link>
            ). Each family keeps its original license.
          </p>
        </footer>
      </body>
    </html>
  );
}
