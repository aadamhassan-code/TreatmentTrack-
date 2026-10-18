import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geist.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans bg-cream-50 text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
