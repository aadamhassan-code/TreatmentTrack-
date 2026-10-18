import type { Metadata, Viewport } from "next";
import { Young_Serif, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  weight: "400",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TreatmentTrack — Recover quoted treatment your practice already earned",
  description:
    "TreatmentTrack follows up quoted-but-declined dental treatment plans by SMS, WhatsApp and email until patients book or opt out — built for UK PECR/GDPR consent rules and Dentally, SOE and CareStack practices.",
  applicationName: "TreatmentTrack",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TreatmentTrack",
  },
};

export const viewport: Viewport = {
  themeColor: "#12382e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${youngSerif.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans bg-cream-50 text-ink-900 antialiased">
        {children}
      </body>
    </html>
  );
}
