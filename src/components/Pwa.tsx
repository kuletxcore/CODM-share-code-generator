"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell. Production only: in development the service
 * worker would serve yesterday's chunks over the dev server.
 */
export default function Pwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // after load, so the worker never competes with the first paint
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
