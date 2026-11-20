"use client";

import { useEffect } from "react";

/** Registers the offline shell after the page has settled. */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
