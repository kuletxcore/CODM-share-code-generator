"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { getPrefs, K, readJson, setPref } from "@/lib/storage";

/** System preference plus an in-app override, applied to CSS and Motion. */
export default function MotionGate({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const pref = getPrefs().motion ?? "auto";
    const system = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const value = pref === "reduced" || system;
    setReduced(value);
    document.documentElement.dataset.motion = value ? "reduced" : "auto";
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      setPref("motion", v ? "reduced" : "auto");
      setReduced(v);
      document.documentElement.dataset.motion = v ? "reduced" : "auto";
    };
    window.addEventListener("codm:set-motion", on);
    return () => window.removeEventListener("codm:set-motion", on);
  }, []);

  return <MotionConfig reducedMotion={reduced ? "always" : "user"}>{children}</MotionConfig>;
}
