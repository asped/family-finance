import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rodinný Finančný Analyzátor (PoC)",
  description: "Konsolidácia a analýza transakcií (manual import + Enable Banking).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen">
          <header className="border-b bg-background">
            <div className="container mx-auto flex max-w-5xl items-center justify-between py-4">
              <Link href="/" className="font-semibold">
                Family Finance (PoC)
              </Link>
              <nav className="flex gap-4 text-sm">
                <Link className="text-muted-foreground hover:text-foreground" href="/transactions">
                  Transakcie
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/import">
                  Import
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/accounts">
                  Účty
                </Link>
                <Link className="text-muted-foreground hover:text-foreground" href="/connections">
                  Prepojenia
                </Link>
              </nav>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
