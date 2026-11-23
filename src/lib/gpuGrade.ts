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
uniform vec4 uP[4];
// the pinned grade, drawn left of the divider instead of the original
uniform float uPin;
uniform vec4 uBandsB;
uniform vec3 uTintB[4];
uniform vec4 uPB[4];
uniform vec2 uSize;
uniform float uSplitX;
uniform vec3 uLuma;
// 0 = linear ramps (game key model), 1 = smoothstep (earlier screenshot fit)
uniform float uSmooth;
uniform float uGamma;
uniform float uWhite;

float luma(vec3 c){ return dot(c, uLuma); }
float smoothB(float a, float b, float x){
  float d = b - a; if (d == 0.0) d = 1e-6;
  float t = clamp((x - a) / d, 0.0, 1.0);
  return uSmooth > 0.5 ? t * t * (3.0 - 2.0 * t) : t;
}
// Mirrors paintGrade in codm.ts: zones blend in linear HDR light, then the
// Reinhard-style tone map brings it back. That per-pixel path is still the
// screenshot fit; the keys (luma weights, ramps, tint, gain, sat) come from
// gradeUniforms so they stay in lockstep with USE_GAME_KEY_MODEL.
// tint is already in linear light and p is (tint weight, saturation gain,
// exposure gain, zone tint darkening).
// PIXEL_TRANSFER "reinhard-hdr" hook: gamma and the Reinhard white point
// come from gradeUniforms so a later shader finding can retune them here.
vec3 toLight(vec3 x){ vec3 l = pow(clamp(x, 0.0, uWhite), vec3(uGamma)); return l / (1.0 - l); }
vec3 toDisplay(vec3 v){ v = max(v, 0.0); return pow(v / (1.0 + v), vec3(1.0 / uGamma)); }
vec3 zone(vec3 v, vec3 tint, vec4 p, float k){
  if (k <= 0.001) return v;
  float l = luma(v);
  v = max(vec3(l) + (v - vec3(l)) * (1.0 + (p.y - 1.0) * k), 0.0);
  return v * (1.0 + (tint - 1.0) * (p.x * k)) * (1.0 + (p.z - 1.0) * k) * (1.0 + (p.w - 1.0) * k);
}
vec3 grade(vec3 c, vec4 bands, vec3 tint[4], vec4 p[4]){
  float l0 = luma(c);
  float ws = 1.0 - smoothB(bands.x, bands.y, l0);
  float wh = smoothB(bands.z, bands.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  vec3 v = toLight(c);
  v = zone(v, tint[0], p[0], ws);
  v = zone(v, tint[1], p[1], wm);
  v = zone(v, tint[2], p[2], wh);
  v = zone(v, tint[3], p[3], 1.0);
  return toDisplay(v);
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float col = floor(vUv.x * uSize.x);
  if (uSplitX > 0.0 && col >= uSplitX - 2.0 && col <= uSplitX) {
    gl_FragColor = vec4(1.0, 234.0 / 255.0, 59.0 / 255.0, 1.0);
    return;
  }
  if (col < uSplitX) {
    gl_FragColor = vec4(uPin > 0.5 ? grade(c, uBandsB, uTintB, uPB) : c, 1.0);
    return;
  }
  gl_FragColor = vec4(grade(c, uBands, uTint, uP), 1.0);
}`;

export type GradeGpu = {
  setSource: (src: HTMLCanvasElement) => void;
  /** Grades with `s`; left of `split` shows the original, or the `pin` grade when given. */
  render: (s: Settings, split: number, pin?: Settings | null) => void;
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
    uSplitX = u("uSplitX"),
    uPin = u("uPin"),
    uBandsB = u("uBandsB"),
    uTintB = u("uTintB"),
    uPB = u("uPB"),
    uLuma = u("uLuma"),
    uSmooth = u("uSmooth"),
    uGamma = u("uGamma"),
    uWhite = u("uWhite");
  let w = 1,
    h = 1;

  return {
    setSource(src) {
      w = canvas.width = src.width;
      h = canvas.height = src.height;
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    render(s, split, pin) {
      const g = gradeUniforms(s);
      gl.uniform4fv(uBands, g.bands);
      gl.uniform3fv(uTint, g.tint);
      gl.uniform4fv(uP, g.params);
      gl.uniform3fv(uLuma, g.luma);
      gl.uniform1f(uSmooth, g.smooth);
      gl.uniform1f(uGamma, g.displayGamma);
      gl.uniform1f(uWhite, g.reinhardWhite);
      gl.uniform1f(uPin, pin ? 1 : 0);
      if (pin) {
        const b = gradeUniforms(pin);
        gl.uniform4fv(uBandsB, b.bands);
        gl.uniform3fv(uTintB, b.tint);
        gl.uniform4fv(uPB, b.params);
      }
      gl.uniform2f(uSize, w, h);
      // same rounding as the CPU compositor: original left of round(w * split)
      gl.uniform1f(uSplitX, Math.min(w, Math.round(w * split)));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
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
