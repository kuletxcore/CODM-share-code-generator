"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/components/Toasts";

/** The tool keeps working offline; say so once, then stay quiet. */
export default function Connectivity() {
  const announced = useRef(false);
  useEffect(() => {
    const off = () => {
      if (announced.current) return;
      announced.current = true;
      notify({
        title: "You're offline",
        detail: "Looks, saved grades and the generator still work in this tab.",
        tone: "warn",
      });
    };
    const on = () => {
      if (!navigator.onLine) return;
      announced.current = false;
    };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    if (!navigator.onLine) off();
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  return null;
}
