import { defaultSettings, gradeUniforms, type Settings } from "@/lib/codm";

/*
 * applyGrade from codm.ts, run as a WebGL fragment shader. Same maths per
 * pixel, so the preview updates every frame while a slider moves instead of
 * redoing ~half a million pixels on the main thread. The CPU version stays
 * as the fallback.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec4 uBands;
uniform vec3 uTint[4];
uniform vec3 uP[4];
uniform vec2 uSize;
uniform float uSplitX;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float smoothB(float a, float b, float x){
  float d = b - a; if (d == 0.0) d = 1e-6;
  float t = clamp((x - a) / d, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
vec3 zone(vec3 c, vec3 tint, vec3 p, float k){
  if (k <= 0.001) return c;
  float l = luma(c);
  float t = p.x * k;
  float cl = luma(tint); if (cl == 0.0) cl = 1.0;
  vec3 n = c + (l * (tint / cl) - c) * t;
  float sm = 1.0 + (p.y - 1.0) * k;
  float l2 = luma(n);
  n = vec3(l2) + (n - vec3(l2)) * sm;
  return n * (1.0 + (p.z - 1.0) * k);
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float col = floor(vUv.x * uSize.x);
  if (uSplitX > 0.0 && col >= uSplitX - 2.0 && col <= uSplitX) {
    gl_FragColor = vec4(1.0, 234.0 / 255.0, 59.0 / 255.0, 1.0);
    return;
  }
  if (col < uSplitX) { gl_FragColor = vec4(c, 1.0); return; }
  float l0 = luma(c);
  float ws = 1.0 - smoothB(uBands.x, uBands.y, l0);
  float wh = smoothB(uBands.z, uBands.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  c = zone(c, uTint[0], uP[0], ws);
  c = zone(c, uTint[1], uP[1], wm);
  c = zone(c, uTint[2], uP[2], wh);
  c = zone(c, uTint[3], uP[3], 1.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/*
 * The duel shader, a second program so a driver that rejects it only costs the
 * duel its GPU path: the single-grade preview above stays as it was.
 * WebGL1 cannot portably take array parameters, so both sides are indexed with
 * constants and picked by a bool.
 */
const FRAG_DUEL = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec4 uBands;
uniform vec3 uTint[4];
uniform vec3 uP[4];
uniform vec4 uBands2;
uniform vec3 uTint2[4];
uniform vec3 uP2[4];
uniform vec2 uSize;
uniform float uSplitX;

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float smoothB(float a, float b, float x){
  float d = b - a; if (d == 0.0) d = 1e-6;
  float t = clamp((x - a) / d, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
vec3 zone(vec3 c, vec3 tint, vec3 p, float k){
  if (k <= 0.001) return c;
  float l = luma(c);
  float t = p.x * k;
  float cl = luma(tint); if (cl == 0.0) cl = 1.0;
  vec3 n = c + (l * (tint / cl) - c) * t;
  float sm = 1.0 + (p.y - 1.0) * k;
  float l2 = luma(n);
  n = vec3(l2) + (n - vec3(l2)) * sm;
  return n * (1.0 + (p.z - 1.0) * k);
}
vec3 graded(vec3 c, bool alt){
  vec4 bands = alt ? uBands2 : uBands;
  float l0 = luma(c);
  float ws = 1.0 - smoothB(bands.x, bands.y, l0);
  float wh = smoothB(bands.z, bands.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  c = zone(c, alt ? uTint2[0] : uTint[0], alt ? uP2[0] : uP[0], ws);
  c = zone(c, alt ? uTint2[1] : uTint[1], alt ? uP2[1] : uP[1], wm);
  c = zone(c, alt ? uTint2[2] : uTint[2], alt ? uP2[2] : uP[2], wh);
  c = zone(c, alt ? uTint2[3] : uTint[3], alt ? uP2[3] : uP[3], 1.0);
  return clamp(c, 0.0, 1.0);
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float col = floor(vUv.x * uSize.x);
  if (col >= uSplitX - 2.0 && col <= uSplitX) {
    gl_FragColor = vec4(1.0, 234.0 / 255.0, 59.0 / 255.0, 1.0);
    return;
  }
  gl_FragColor = vec4(graded(c, col < uSplitX), 1.0);
}`;

export type GradeGpu = {
  setSource: (src: HTMLCanvasElement) => void;
  render: (s: Settings, split: number) => void;
  /** Left of `split` shows `left`, right of it `right`. False if WebGL can't duel. */
  renderDuel: (left: Settings, right: Settings, split: number) => boolean;
  dispose: () => void;
};

function init(canvas: HTMLCanvasElement): GradeGpu | null {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT),
    fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // The duel program is optional: if a driver rejects it, the caller falls back
  // to the CPU and the single-grade preview is untouched either way.
  const duel = (() => {
    const fs2 = sh(gl.FRAGMENT_SHADER, FRAG_DUEL);
    if (!fs2) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs2);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  })();
  const ud = (n: string) => (duel ? gl.getUniformLocation(duel, n) : null);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uBands = u("uBands"),
    uTint = u("uTint"),
    uP = u("uP"),
    uSize = u("uSize"),
    uSplitX = u("uSplitX");
  let w = 1,
    h = 1;

  return {
    setSource(src) {
      w = canvas.width = src.width;
      h = canvas.height = src.height;
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    render(s, split) {
      const g = gradeUniforms(s);
      gl.uniform4fv(uBands, g.bands);
      gl.uniform3fv(uTint, g.tint);
      gl.uniform3fv(uP, g.params);
      gl.uniform2f(uSize, w, h);
      // same rounding as the CPU compositor: original left of round(w * split)
      gl.uniform1f(uSplitX, Math.min(w, Math.round(w * split)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    renderDuel(left, right, split) {
      if (!duel) return false;
      gl.useProgram(duel);
      const gl2 = gradeUniforms(left);
      const gr = gradeUniforms(right);
      gl.uniform4fv(ud("uBands2"), gl2.bands);
      gl.uniform3fv(ud("uTint2"), gl2.tint);
      gl.uniform3fv(ud("uP2"), gl2.params);
      gl.uniform4fv(ud("uBands"), gr.bands);
      gl.uniform3fv(ud("uTint"), gr.tint);
      gl.uniform3fv(ud("uP"), gr.params);
      gl.uniform2f(ud("uSize"), w, h);
      gl.uniform1f(ud("uSplitX"), Math.min(w, Math.round(w * split)));
      // attribute arrays are per-program state, so point the duel program at the quad
      const loc2 = gl.getAttribLocation(duel, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc2);
      gl.vertexAttribPointer(loc2, 2, gl.FLOAT, false, 0, 0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      if (duel) gl.deleteProgram(duel);
    },
  };
}

let supported: boolean | null = null;

// Some drivers link the program and then draw nothing; grade a grey pixel red and read it back.
function drawsGrade(g: GradeGpu, probe: HTMLCanvasElement): boolean {
  const src = document.createElement("canvas");
  src.width = src.height = 2;
  const ctx = src.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 2, 2);
  g.setSource(src);
  const s = defaultSettings();
  s.zones.global = { hue: 0, tint: 100, sat: 50, bri: 50 };
  g.render(s, 0);
  const gl = probe.getContext("webgl");
  if (!gl) return false;
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px[0] > px[2] + 40;
}

/** Builds the GPU grader on `canvas`, or returns null (canvas untouched) if WebGL can't run it. */
export function createGradeGpu(canvas: HTMLCanvasElement): GradeGpu | null {
  if (supported === null) {
    // probe on a throwaway canvas: once a canvas has a WebGL context it can't fall back to 2D
    const probe = document.createElement("canvas");
    const g = init(probe);
    supported = !!g && drawsGrade(g, probe);
    g?.dispose();
    (probe.getContext("webgl") as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported ? init(canvas) : null;
}
