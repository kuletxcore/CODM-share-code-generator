"use client";

import { useEffect, useRef } from "react";

/**
 * QR that opens this page on a phone with the code already loaded (#c= restores
 * it). The encoder is imported on demand, so it stays off the critical path.
 */
export default function ShareQr({
  code,
  size = 120,
  className = "",
}: {
  code: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    Promise.all([import("@/lib/share"), import("@/lib/shareUrl")]).then(async ([share, url]) => {
      const qr = await share.qrMatrix(url.shareUrl(code));
      const c = ref.current;
      if (!live || !c) return;
      share.drawQr(c.getContext("2d")!, qr, 0, 0, c.width);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className={`shrink-0 ${className}`}
      aria-hidden
    />
  );
}
