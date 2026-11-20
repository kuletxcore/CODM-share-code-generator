// CPU grading fallback on a worker. Mirrors applyGrade() in src/lib/codm.ts so
// a browser without WebGL still keeps its preview responsive.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};
const hueToRgb = (h) => {
  const x = (((h % 360) + 360) % 360) / 60;
  const f = (n) => {
    const k = (n + x) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
};
self.onmessage = (e) => {
  try {
    const { id, buffer, settings: s } = e.data;
    const data = new Uint8ClampedArray(buffer);
    const s0 = clamp(s.shadowPos / 1000, 0, 1);
    const s1 = Math.max(clamp(s.shadowEdge / 1000, 0, 1.5), s0 + 0.02);
    const h1 = clamp(s.highlightPos / 1000, 0, 1);
    const h0 = h1 - Math.max((s.highlightEdge - s.highlightPos) / 1000, 0.02);
    const zs = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
    const tintRgb = zs.map((z) => hueToRgb(z.hue));
    const tintAmt = zs.map((z) => clamp(z.tint / 100, 0, 1));
    const satMul = zs.map((z) => clamp(z.sat / 50, 0, 2));
    const briMul = zs.map((z) => clamp(z.bri / 50, 0, 2));
    const w = [0, 0, 0, 1];
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const l0 = luma(r, g, b);
      const ws = 1 - smooth(s0, s1, l0);
      const wh = smooth(h0, h1, l0) * (1 - ws);
      w[0] = ws; w[1] = Math.max(0, 1 - ws - wh); w[2] = wh;
      for (let z = 0; z < 4; z++) {
        const k = w[z];
        if (k <= 0.001) continue;
        const l = luma(r, g, b), t = tintAmt[z] * k, c = tintRgb[z];
        const cl = luma(c[0], c[1], c[2]) || 1;
        let nr = r + (l * (c[0] / cl) - r) * t;
        let ng = g + (l * (c[1] / cl) - g) * t;
        let nb = b + (l * (c[2] / cl) - b) * t;
        const sm = 1 + (satMul[z] - 1) * k;
        const l2 = luma(nr, ng, nb);
        nr = l2 + (nr - l2) * sm;
        ng = l2 + (ng - l2) * sm;
        nb = l2 + (nb - l2) * sm;
        const bm = 1 + (briMul[z] - 1) * k;
        r = nr * bm; g = ng * bm; b = nb * bm;
      }
      data[i] = r * 255; data[i + 1] = g * 255; data[i + 2] = b * 255;
    }
    self.postMessage({ id, buffer: data.buffer }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id: e.data?.id ?? -1, error: String(err) });
  }
};
