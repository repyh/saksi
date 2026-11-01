"use client";

import { useEffect } from "react";

export default function PwaRuntime() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Pendaftaran service worker SAKSI gagal.", error);
      });
  }, []);

  return null;
}
