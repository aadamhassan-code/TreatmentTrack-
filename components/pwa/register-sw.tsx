"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes TreatmentTrack installable and
 * shows a friendly page when offline. Production only, so local dev and
 * tests never fight a cached worker.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Install-less browsing is fine; the app works without it.
    });
  }, []);
  return null;
}
