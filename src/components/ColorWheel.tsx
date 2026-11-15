"use client";

import { useCallback, useRef } from "react";
import { SWATCH_NAMES, hueParts } from "@/lib/codm";

const SIZE = 164;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 64; // usable drag radius (Tint 0..100)

// Angle convention: 0 deg (Red) at top (-90 deg in standard math coords),
// moving clockwise through Orange (45), Lime (90), Green (135), Cyan (180),
// Blue (225), Purple (270), Magenta (315). Matches CSS conic-gradient(from 0deg).
function polarToXY(hueDeg: number, tintPct: number) {
  const rad = ((hueDeg - 90) * Math.PI) / 180;
  const dist = (Math.min(100, Math.max(0, tintPct)) / 100) * R;
  return { x: CX + Math.cos(rad) * dist, y: CY + Math.sin(rad) * dist };
}

function xyToPolar(x: number, y: number) {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.hypot(dx, dy);
  const tint = Math.round(Math.min(100, (dist / R) * 100));
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
  return { hue: Math.round(deg) % 360, tint };
}

export default function ColorWheel({
  hue,
  tint,
  preferSwatch,
  zoneLabel,
  onChange,
}: {
  hue: number;
  tint: number;
  preferSwatch?: number;
  zoneLabel: string;
  onChange: (next: { hue: number; tint: number; swatch: number }) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const hp = hueParts(hue, preferSwatch);
  const puck = polarToXY(hue, tint);
  const activeColor = tint < 2 ? "#7a8078" : `hsl(${Math.round(hue)} 95% 54%)`;

  const applyClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * SIZE;
      const y = ((clientY - rect.top) / rect.height) * SIZE;
      const { hue: h, tint: t } = xyToPolar(x, y);
      // Deadzone near exact center so resetting to 0 tint feels crisp
      const snappedTint = t <= 3 ? 0 : t;
      const nextParts = hueParts(h);
      onChange({ hue: h, tint: snappedTint, swatch: nextParts.swatch });
    },
    [onChange],
  );

  return (
    <div className="flex items-center gap-4 border border-line/80 bg-black/35 p-3">
      <div
        ref={boxRef}
        role="application"
        tabIndex={0}
        aria-label={`${zoneLabel} colour wheel: ${SWATCH_NAMES[hp.swatch]} ${Math.round(hp.pos)}, tint ${Math.round(tint)}%. Drag or use arrow keys.`}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          applyClientPoint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          applyClientPoint(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (dragging.current) {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onDoubleClick={() => onChange({ hue, tint: 0, swatch: hp.swatch })}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 2;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            const nh = (hue + step * 3) % 360;
            onChange({ hue: nh, tint, swatch: hueParts(nh).swatch });
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            const nh = (hue - step * 3 + 360) % 360;
            onChange({ hue: nh, tint, swatch: hueParts(nh).swatch });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange({ hue, tint: Math.min(100, tint + step), swatch: hp.swatch });
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange({ hue, tint: Math.max(0, tint - step), swatch: hp.swatch });
          }
        }}
        style={{ width: SIZE, height: SIZE }}
        className="relative shrink-0 cursor-crosshair select-none touch-none rounded-full focus-visible:outline-codm"
      >
        {/* Chromatic disc: conic hue ring blended with neutral radial core */}
        <div
          className="absolute rounded-full border border-white/15 shadow-inner"
          style={{
            left: CX - R,
            top: CY - R,
            width: R * 2,
            height: R * 2,
            background:
              "radial-gradient(circle, rgba(22,25,22,0.94) 0%, rgba(22,25,22,0.58) 38%, rgba(22,25,22,0.08) 100%), conic-gradient(from 0deg, hsl(0 95% 52%), hsl(45 95% 52%), hsl(90 95% 52%), hsl(135 95% 52%), hsl(180 95% 52%), hsl(225 95% 52%), hsl(270 95% 52%), hsl(315 95% 52%), hsl(360 95% 52%))",
          }}
        />

        {/* SVG tactical reticles, CODM 8-swatch outer detents, vector tether & puck */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="pointer-events-none absolute inset-0"
        >
          {/* Concentric tint guide rings (25%, 50%, 75%) */}
          {[0.25, 0.5, 0.75].map((f) => (
            <circle
              key={f}
              cx={CX}
              cy={CY}
              r={R * f}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeDasharray={f === 0.5 ? "2 2" : undefined}
            />
          ))}
          {/* Crosshair axes */}
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(255,255,255,0.12)" />
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(255,255,255,0.12)" />

          {/* 8 CODM swatch detent ticks on outer ring */}
          {SWATCH_NAMES.map((name, i) => {
            const deg = i * 45;
            const rad = ((deg - 90) * Math.PI) / 180;
            const x1 = CX + Math.cos(rad) * (R + 3);
            const y1 = CY + Math.sin(rad) * (R + 3);
            const x2 = CX + Math.cos(rad) * (R + 10);
            const y2 = CY + Math.sin(rad) * (R + 10);
            const isSel = hp.swatch === i;
            return (
              <g key={name}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={`hsl(${deg} 100% 54%)`}
                  strokeWidth={isSel ? 3.5 : 2}
                  strokeLinecap="square"
                />
              </g>
            );
          })}

          {/* Center neutral pip */}
          <circle cx={CX} cy={CY} r={3} fill="#0a0b0a" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />

          {/* Vector line from center to active colour point */}
          {tint > 0 && (
            <line
              x1={CX}
              y1={CY}
              x2={puck.x}
              y2={puck.y}
              stroke="#ffea3b"
              strokeWidth="1.5"
              strokeOpacity="0.85"
            />
          )}

          {/* Active colour puck */}
          <circle
            cx={puck.x}
            cy={puck.y}
            r={7.5}
            fill={activeColor}
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle
            cx={puck.x}
            cy={puck.y}
            r={9.5}
            fill="none"
            stroke="#0a0b0a"
            strokeWidth="1.2"
          />
        </svg>
      </div>

      {/* Live vector telemetry beside the wheel */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-4 w-4 shrink-0 rotate-45 border border-white/40"
            style={{ background: activeColor }}
          />
          <div className="min-w-0">
            <div className="font-display text-xs font-bold uppercase tracking-widest text-mute">
              In-Game Swatch
            </div>
            <div className="truncate font-display text-lg font-extrabold uppercase leading-tight text-text">
              {SWATCH_NAMES[hp.swatch]} <span className="font-mono text-sm text-codm">{Math.round(hp.pos)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-t border-line/70 pt-2 font-mono text-xs">
          <div>
            <span className="block font-display text-[10px] font-bold uppercase tracking-widest text-mute">
              Angle
            </span>
            <span className="tabular-nums text-text">{Math.round(hue)}°</span>
          </div>
          <div>
            <span className="block font-display text-[10px] font-bold uppercase tracking-widest text-mute">
              Tint Pull
            </span>
            <span className="tabular-nums text-codm">{Math.round(tint)}%</span>
          </div>
        </div>

        <p className="text-[11px] leading-snug text-mute">
          Drag anywhere for Hue + Tint. Double-click to neutralize.
        </p>
      </div>
    </div>
  );
}
