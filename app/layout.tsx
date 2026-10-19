import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

// Self-hosted (app/fonts, SIL OFL licences alongside): builds never fetch
// from Google Fonts, so they work offline, in CI, and behind proxies.
const youngSerif = localFont({
  src: "./fonts/young-serif-latin-400-normal.woff2",
  weight: "400",
  variable: "--font-young-serif",
});

const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "TreatmentTrack — Recover quoted treatment your practice already earned",
  description:
    "TreatmentTrack follows up quoted-but-declined dental treatment plans by SMS, WhatsApp and email until patients book or opt out — built for UK PECR/GDPR consent rules and Dentally, SOE and CareStack practices.",
  applicationName: "TreatmentTrack",
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
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
