import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import { HandlePopoverProvider } from "@/components/handle/HandlePopoverContext";
import { HandleDialog } from "@/components/identity/HandleDialog";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: "400",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Receipts",
  description: "Tamper-evident proof of process for student coding work.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${jetBrainsMono.variable} min-h-screen font-sans antialiased`}
      >
        <HandlePopoverProvider>
          <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
              <Link href="/" className="text-sm font-semibold tracking-wide">
                Receipts
              </Link>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <Link href="/editor" className="hover:text-slate-950">
                  Editor
                </Link>
                <Link href="/dashboard" className="hover:text-slate-950">
                  Dashboard
                </Link>
                <Link href="/r/demo" className="hover:text-slate-950">
                  Sample
                </Link>
                <HandleDialog />
              </div>
            </nav>
          </header>
          {children}
        </HandlePopoverProvider>
      </body>
    </html>
  );
}
