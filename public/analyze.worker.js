// Screenshot analysis off the main thread. Mirrors analyse() in src/lib/codm.ts
// for the four panel values; no image data leaves the browser.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
const weights = (l) => {
  const ws = 1 - smooth(0.03, 0.3, l);
  const wh = smooth(0.9, 1, l) * (1 - ws);
  return [ws, Math.max(0, 1 - ws - wh), wh];
};
function stats(data) {
  const acc = [0, 1, 2].map(() => ({ r: 0, g: 0, b: 0, l: 0, sat: 0, n: 0 }));
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const l = luma(r, g, b);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 0.02 ? (mx - mn) / mx : 0;
    const w = weights(l);
    for (let z = 0; z < 3; z++) {
      const a = acc[z];
      a.r += r * w[z]; a.g += g * w[z]; a.b += b * w[z];
      a.l += l * w[z]; a.sat += sat * w[z]; a.n += w[z];
    }
  }
  return acc.map((a) => {
    const n = a.n || 1;
    return { r: a.r / n, g: a.g / n, b: a.b / n, l: a.l / n, sat: a.sat / n };
  });
}
const castOf = (z) => {
  const l = z.l || 1e-3;
  const dr = (z.r - z.l) / l, dg = (z.g - z.l) / l, db = (z.b - z.l) / l;
  return { x: dr - 0.5 * dg - 0.5 * db, y: (Math.sqrt(3) / 2) * (dg - db) };
};
self.onmessage = (e) => {
  try {
    const { target, base, strength } = e.data;
    const t = stats(new Uint8ClampedArray(target));
    const b = base ? stats(new Uint8ClampedArray(base)) : null;
    const neutral = [{ l: 0.11, sat: 0.3 }, { l: 0.42, sat: 0.3 }, { l: 0.8, sat: 0.14 }];
    const zones = {};
    ['shadows', 'midtones', 'highlights'].forEach((k, i) => {
      const ct = castOf(t[i]), cb = b ? castOf(b[i]) : { x: 0, y: 0 };
      const mag = Math.hypot(ct.x - cb.x, ct.y - cb.y);
      const hue = ((Math.atan2(ct.y - cb.y, ct.x - cb.x) * 180) / Math.PI + 360) % 360;
      const tint = clamp(mag * (b ? 70 : 35), 0, 60);
      const refSat = b ? b[i].sat : neutral[i].sat;
      const refL = b ? b[i].l : neutral[i].l;
      const sat = clamp(50 * (t[i].sat / (refSat || 0.01)), 15, 85);
      const bri = clamp(50 * Math.pow(t[i].l / (refL || 0.01), 0.6), 25, 75);
      const mix = (x, y) => Math.round(x + (y - x) * strength);
      zones[k] = {
        hue: Math.round(hue),
        tint: Math.round(tint),
        sat: mix(50, b ? sat : 50 + (sat - 50) * 0.5),
        bri: mix(50, b ? bri : 50 + (bri - 50) * 0.5),
      };
    });
    self.postMessage({ ok: true, zones });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
