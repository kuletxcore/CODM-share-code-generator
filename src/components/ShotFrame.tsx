"use client";

import { useEffect, useRef } from "react";
import { shotBase, shotGraded } from "@/lib/screenPreview";
import { useScreenTest } from "@/components/ScreenTest";

/*
 * One graded frame of the visitor's own screenshot.
 *
 * `split` (0 to 1) wipes the ungraded frame in from the left, so holding a
 * button compares the look against the visitor's plain screen, the same idea
 * as the generator's preview wipe, on their own picture.
 */

export default function ShotFrame({
  code,
  w,
  h,
  className,
  split = 0,
  alt,
}: {
  code: string;
  w: number;
  h: number;
  className?: string;
  split?: number;
  alt?: string;
}) {
  const { shot, version } = useScreenTest();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!shot || !c) return;
    let live = true;
    Promise.all([shotGraded(shot, code, w, h), split > 0 ? shotBase(shot, w, h) : null]).then(
      ([graded, base]) => {
        if (!live || !graded || !ref.current) return;
        c.width = w;
        c.height = h;
        const out = new ImageData(new Uint8ClampedArray(graded.data), w, h);
        const x = Math.min(w, Math.round(w * split));
        if (base && x > 0) {
          for (let y = 0; y < h; y++) {
            const row = y * w * 4;
            out.data.set(base.data.subarray(row, row + x * 4), row);
            for (let dx = Math.max(0, x - 2); dx < Math.min(w, x + 1); dx++) {
              const i = row + dx * 4;
              out.data[i] = 255;
              out.data[i + 1] = 234;
              out.data[i + 2] = 59;
              out.data[i + 3] = 255;
            }
          }
        }
        c.getContext("2d")?.putImageData(out, 0, 0);
      },
      // no 2D canvas or a failed read: keep whatever is painted
      () => {},
    );
    return () => {
      live = false;
    };
    // `version` re-runs the paint when the shot is replaced by one with the
    // same id sequence (e.g. a re-upload of the same file)
  }, [shot, version, code, w, h, split]);

  if (!shot) return null;
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      role="img"
      aria-label={alt ?? "Your screenshot with this look applied"}
      className={className}
    />
  );
}
