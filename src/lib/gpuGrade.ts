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
uniform float uPin;
uniform vec4 uBandsB;
uniform vec3 uTintB[4];
uniform vec4 uPB[4];
uniform vec2 uSize;
uniform float uSplitX;
uniform vec3 uLuma;
uniform float uSmooth;
uniform float uGamma;
uniform float uWhite;
// Game path (PIXEL_TRANSFER + packed keys). The B set is the pinned grade.
uniform float uGame;
uniform vec4 uKey0;
uniform vec4 uKey1Delta;
uniform vec4 uKey2Delta;
uniform vec4 uRamp;
uniform vec4 uKey0B;
uniform vec4 uKey1DeltaB;
uniform vec4 uKey2DeltaB;
uniform vec4 uRampB;
uniform vec3 uLuma709;
uniform float uExposure;
uniform float uTransfer;
uniform vec4 uAces;
uniform float uAcesE;
uniform float uAcesFloor;
uniform float uAcesWhite;

float luma(vec3 c){ return dot(c, uLuma); }
float smoothB(float a, float b, float x){
  float d = b - a; if (d == 0.0) d = 1e-6;
  float t = clamp((x - a) / d, 0.0, 1.0);
  return uSmooth > 0.5 ? t * t * (3.0 - 2.0 * t) : t;
}
vec3 acesFwd(vec3 x){
  // Clamped from above only, as in codm.ts acesForward: negative lanes go through the curve.
  x = min(x, vec3(uAcesWhite));
  vec3 y = (x * (uAces.x * x + uAces.y)) / (x * (uAces.z * x + uAces.w) + uAcesE);
  return max(y, vec3(uAcesFloor));
}
float acesInv1(float y){
  if (y <= uAcesFloor) return 0.0;
  float cap = uAces.x / uAces.z;
  if (y >= cap) y = cap * (1.0 - 1e-6);
  float A = y * uAces.z - uAces.x;
  float B = y * uAces.w - uAces.y;
  float C = y * uAcesE;
  float disc = max(B * B - 4.0 * A * C, 0.0);
  float s = sqrt(disc);
  float r1 = (-B + s) / (2.0 * A);
  float r2 = (-B - s) / (2.0 * A);
  float x = r1 > 0.0 ? r1 : r2;
  return x > 0.0 ? x : 0.0;
}
vec3 acesInv(vec3 y){ return vec3(acesInv1(y.r), acesInv1(y.g), acesInv1(y.b)); }
vec3 toLinear(vec3 srgb){
  vec3 y = pow(clamp(srgb, 0.0, 1.0), vec3(uGamma));
  if (uTransfer > 0.5) {
    y = min(y, vec3(uWhite));
    return y / max(1.0 - y, vec3(1e-6));
  }
  return acesInv(y);
}
vec3 toEncoded(vec3 v){
  vec3 y = uTransfer > 0.5 ? max(v, 0.0) / (1.0 + max(v, 0.0)) : acesFwd(v);
  return pow(max(y, 0.0), vec3(1.0 / uGamma));
}
// Legacy fitted path, kept so USE_GAME_KEY_MODEL can be flipped.
vec3 zone(vec3 v, vec3 tint, vec4 p, float k){
  if (k <= 0.001) return v;
  float l = luma(v);
  v = max(vec3(l) + (v - vec3(l)) * (1.0 + (p.y - 1.0) * k), 0.0);
  return v * (1.0 + (tint - 1.0) * (p.x * k)) * (1.0 + (p.z - 1.0) * k) * (1.0 + (p.w - 1.0) * k);
}
vec3 gradeLegacy(vec3 c, vec4 bands, vec3 tint[4], vec4 p[4]){
  float l0 = luma(c);
  float ws = 1.0 - smoothB(bands.x, bands.y, l0);
  float wh = smoothB(bands.z, bands.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  vec3 v = toLinear(c);
  v = zone(v, tint[0], p[0], ws);
  v = zone(v, tint[1], p[1], wm);
  v = zone(v, tint[2], p[2], wh);
  v = zone(v, tint[3], p[3], 1.0);
  return toEncoded(v);
}
vec3 gradeGame(vec3 c, vec4 k0, vec4 d1, vec4 d2, vec4 ramp){
  vec3 v = toLinear(c);
  float L = dot(v, uLuma709);
  float w1 = clamp(L * ramp.x + ramp.y, 0.0, 1.0);
  float w2 = clamp(L * ramp.z + ramp.w, 0.0, 1.0);
  vec4 key = k0 + d1 * w1 + d2 * w2;
  v = mix(vec3(L), v, key.w) * key.rgb;
  v *= max(uExposure, 0.0);
  return toEncoded(v);
}
vec3 grade(vec3 c, bool pin){
  if (uGame > 0.5) {
    return pin
      ? gradeGame(c, uKey0B, uKey1DeltaB, uKey2DeltaB, uRampB)
      : gradeGame(c, uKey0, uKey1Delta, uKey2Delta, uRamp);
  }
  return pin ? gradeLegacy(c, uBandsB, uTintB, uPB) : gradeLegacy(c, uBands, uTint, uP);
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float col = floor(vUv.x * uSize.x);
  if (uSplitX > 0.0 && col >= uSplitX - 2.0 && col <= uSplitX) {
    gl_FragColor = vec4(1.0, 234.0 / 255.0, 59.0 / 255.0, 1.0);
    return;
  }
  if (col < uSplitX) {
    gl_FragColor = vec4(uPin > 0.5 ? grade(c, true) : c, 1.0);
    return;
  }
  gl_FragColor = vec4(grade(c, false), 1.0);
}
`;

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
    uWhite = u("uWhite"),
    uGame = u("uGame"),
    uKey0 = u("uKey0"),
    uKey1Delta = u("uKey1Delta"),
    uKey2Delta = u("uKey2Delta"),
    uRamp = u("uRamp"),
    uKey0B = u("uKey0B"),
    uKey1DeltaB = u("uKey1DeltaB"),
    uKey2DeltaB = u("uKey2DeltaB"),
    uRampB = u("uRampB"),
    uLuma709 = u("uLuma709"),
    uExposure = u("uExposure"),
    uTransfer = u("uTransfer"),
    uAces = u("uAces"),
    uAcesE = u("uAcesE"),
    uAcesFloor = u("uAcesFloor"),
    uAcesWhite = u("uAcesWhite");
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
      gl.uniform1f(uGame, g.useGameModel);
      gl.uniform4fv(uKey0, g.key0);
      gl.uniform4fv(uKey1Delta, g.key1Delta);
      gl.uniform4fv(uKey2Delta, g.key2Delta);
      gl.uniform4fv(uRamp, g.ramp);
      gl.uniform3fv(uLuma709, g.luma709);
      gl.uniform1f(uExposure, g.exposure);
      gl.uniform1f(uTransfer, g.pixelTransfer);
      gl.uniform4fv(uAces, g.aces);
      gl.uniform1f(uAcesE, g.acesE);
      gl.uniform1f(uAcesFloor, g.acesFloor);
      gl.uniform1f(uAcesWhite, g.acesWhite);
      gl.uniform1f(uPin, pin ? 1 : 0);
      if (pin) {
        const b = gradeUniforms(pin);
        gl.uniform4fv(uBandsB, b.bands);
        gl.uniform3fv(uTintB, b.tint);
        gl.uniform4fv(uPB, b.params);
        gl.uniform4fv(uKey0B, b.key0);
        gl.uniform4fv(uKey1DeltaB, b.key1Delta);
        gl.uniform4fv(uKey2DeltaB, b.key2Delta);
        gl.uniform4fv(uRampB, b.ramp);
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
