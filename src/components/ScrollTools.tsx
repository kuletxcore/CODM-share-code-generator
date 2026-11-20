"use client";

import { useEffect, useState } from "react";

/** Quiet orientation on a long page: where you are, and the way back up. */
export default function ScrollTools() {
  const [progress, setProgress] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    let queued = false;
    const update = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
        setShow(window.scrollY > 600);
        queued = false;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 bg-codm/80 origin-left"
        style={{ transform: `scaleX(${progress})` }}
      />
      <button
        aria-label="Back to top"
        title="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`cut-sm fixed bottom-56 right-4 z-30 grid h-12 w-12 place-items-center border border-codm bg-ink/90 font-display text-xl text-codm shadow-lg backdrop-blur transition-opacity lg:bottom-28 ${
          show ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        ↑
      </button>
    </>
  );
}
