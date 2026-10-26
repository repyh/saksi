"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function subscribeToStandaloneStatus(callback: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    displayMode.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneStatus() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && window.navigator.standalone === true)
  );
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function PwaControls() {
  const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus, () => true);
  const isIOS = useSyncExternalStore(() => () => {}, isIosDevice, () => false);
  const isStandalone = useSyncExternalStore(
    subscribeToStandaloneStatus,
    getStandaloneStatus,
    () => false,
  );
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!isOnline && (
        <p
          className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900"
          role="status"
          aria-live="polite"
        >
          Offline — saved drafts stay on this device
        </p>
      )}

      {!isStandalone && installPrompt && (
        <button
          className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          onClick={() => void installApp()}
          type="button"
        >
          Install RUAS
        </button>
      )}

      {!isStandalone && isIOS && (
        <details className="relative text-xs text-slate-600">
          <summary className="cursor-pointer list-none rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">
            Install RUAS
          </summary>
          <p className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
            In Safari, tap Share, then choose “Add to Home Screen.”
          </p>
        </details>
      )}
    </div>
  );
}
