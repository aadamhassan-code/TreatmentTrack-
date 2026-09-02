import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TreatmentTrack — Recover quoted treatment your practice already earned",
  description:
    "TreatmentTrack follows up quoted-but-declined dental treatment plans by SMS, WhatsApp and email until patients book or opt out — built for UK PECR/GDPR consent rules and Dentally/SOE practices.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans bg-cream-50 text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
