import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// Self-hosted at build time. display swap keeps text visible while a face loads.
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
});
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const DESCRIPTION =
  "Discover, preview and download open-licensed fonts from the Google Fonts collection.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    template: "%s — Fontory",
    default: "Fontory — Find your type.",
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Fontory",
    title: "Fontory — Find your type.",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Fontory — Find your type.",
    description: DESCRIPTION,
  },
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
    <html lang="en" className={`${newsreader.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <SiteHeader />
        <main className="site-container flex-1 py-10 md:py-14">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
