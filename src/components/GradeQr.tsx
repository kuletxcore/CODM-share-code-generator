"use client";

import { useEffect, useRef } from "react";

/** QR for the current grade, for the desktop → phone hand-off. */
export default function GradeQr({ code, size = 96 }: { code: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    Promise.all([import("@/lib/share"), import("@/lib/shareUrl")]).then(async ([share, url]) => {
      const matrix = await share.qrMatrix(url.shareUrl(code));
      const c = ref.current;
      if (!live || !c) return;
      share.drawQr(c.getContext("2d")!, matrix, 0, 0, c.width);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return (
    <canvas
      ref={ref}
      width={240}
      height={240}
      style={{ width: size, height: size }}
      className="shrink-0 border-2 border-codm bg-[#e9ece6]"
      aria-label="QR code that opens this grade on a phone"
      role="img"
    />
  );
}
