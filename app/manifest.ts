import type { MetadataRoute } from "next";

/**
 * Web app manifest: lets practices install TreatmentTrack on a phone or
 * desktop like a native app (PWA). Served at /manifest.webmanifest and
 * linked automatically.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TreatmentTrack",
    short_name: "TreatmentTrack",
    description:
      "Follow up quoted dental treatment until the patient books or opts out, and track booked cases to completion.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf9f3",
    theme_color: "#12382e",
    categories: ["business", "medical", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
