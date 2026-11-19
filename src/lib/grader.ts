import { applyGrade, defaultSettings, gradeUniforms, type Settings } from "@/lib/codm";

/*
 * Paints a frame with the untouched original left of a split line and the
 * filter applied right of it. With WebGL this is applyGrade from codm.ts as a
 * fragment shader: same maths per pixel, so the frame keeps up with a dragged
 * slider instead of redoing ~a million pixels on the main thread. Without
 * WebGL the same grade runs on the CPU, once per change.
 */

export type GradeSource = HTMLImageElement | HTMLCanvasElement;

export type Grader = {
  /** True when the grade runs as a shader. */
  gpu: boolean;
  /** The frame to grade, with its pixel size. Resizes the canvas to match. */
  setSource: (src: GradeSource, w: number, h: number) => void;
  /** `split` is 0-1 across the frame: original to its left, graded to its right. */
  render: (s: Settings, split: number) => void;
  dispose: () => void;
};

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
  if (floor(vUv.x * uSize.x) < uSplitX) { gl_FragColor = vec4(c, 1.0); return; }
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

function gpuGrader(canvas: HTMLCanvasElement): Grader | null {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    premultipliedAlpha: false,
    // the frame is copied out with drawImage for the cross-fade between looks
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  // Everything that lives in the context, so it can be rebuilt after a context loss.
  const build = () => {
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT),
      fs = sh(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return null;
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
    return {
      prog,
      buf,
      tex,
      uBands: u("uBands"),
      uTint: u("uTint"),
      uP: u("uP"),
      uSize: u("uSize"),
      uSplitX: u("uSplitX"),
    };
  };

  let g = build();
  if (!g) return null;
  let source: { src: GradeSource; w: number; h: number } | null = null;
  let last: { s: Settings; split: number } | null = null;

  const upload = () => {
    if (!source) return;
    gl.viewport(0, 0, source.w, source.h);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.src);
  };
  const paint = () => {
    if (!g || !source || !last || gl.isContextLost()) return;
    const v = gradeUniforms(last.s);
    gl.uniform4fv(g.uBands, v.bands);
    gl.uniform3fv(g.uTint, v.tint);
    gl.uniform3fv(g.uP, v.params);
    gl.uniform2f(g.uSize, source.w, source.h);
    gl.uniform1f(g.uSplitX, Math.min(source.w, Math.round(source.w * last.split)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // Phones drop WebGL contexts in the background, e.g. while the visitor is in the game pasting a code.
  const lost = (e: Event) => e.preventDefault();
  const restored = () => {
    g = build();
    upload();
    paint();
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);

  return {
    gpu: true,
    setSource(src, w, h) {
      source = { src, w, h };
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      if (!gl.isContextLost()) upload();
    },
    render(s, split) {
      last = { s, split };
      paint();
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      if (!g) return;
      gl.deleteTexture(g.tex);
      gl.deleteBuffer(g.buf);
      gl.deleteProgram(g.prog);
      g = null;
    },
  };
}

/** Longest edge the CPU fallback grades at; keeps a slider drag usable without a GPU. */
const CPU_MAX_W = 960;

function cpuGrader(canvas: HTMLCanvasElement): Grader {
  const ctx = canvas.getContext("2d");
  let orig: HTMLCanvasElement | null = null;
  let graded: HTMLCanvasElement | null = null;
  let pixels: ImageData | null = null;
  let gradedFor: Settings | null = null;

  return {
    gpu: false,
    setSource(src, w, h) {
      const k = Math.min(1, CPU_MAX_W / w);
      const cw = Math.max(1, Math.round(w * k)),
        ch = Math.max(1, Math.round(h * k));
      canvas.width = cw;
      canvas.height = ch;
      orig = document.createElement("canvas");
      orig.width = cw;
      orig.height = ch;
      const o = orig.getContext("2d", { willReadFrequently: true });
      if (!o) return;
      o.drawImage(src, 0, 0, cw, ch);
      pixels = o.getImageData(0, 0, cw, ch);
      graded = document.createElement("canvas");
      graded.width = cw;
      graded.height = ch;
      gradedFor = null;
    },
    render(s, split) {
      if (!ctx || !orig || !graded || !pixels) return;
      // the filtered pixels only change with the settings, not with the split
      if (gradedFor !== s) {
        const data = new Uint8ClampedArray(pixels.data);
        applyGrade(data, s);
        graded.getContext("2d")?.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0);
        gradedFor = s;
      }
      ctx.drawImage(graded, 0, 0);
      const x = Math.min(pixels.width, Math.round(pixels.width * split));
      if (x > 0) ctx.drawImage(orig, 0, 0, x, pixels.height, 0, 0, x, pixels.height);
    },
    dispose() {
      orig = graded = pixels = gradedFor = null;
    },
  };
}

let webgl: boolean | null = null;

// Some drivers link the program and then draw nothing; grade a grey pixel red and read it back.
function drawsGrade(g: Grader, probe: HTMLCanvasElement): boolean {
  const src = document.createElement("canvas");
  src.width = src.height = 2;
  const ctx = src.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 2, 2);
  g.setSource(src, 2, 2);
  const s = defaultSettings();
  s.zones.global = { hue: 0, tint: 100, sat: 50, bri: 50 };
  g.render(s, 0);
  const gl = probe.getContext("webgl");
  if (!gl) return false;
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px[0] > px[2] + 40;
}

/** Builds a grader on `canvas`: the shader when WebGL can run it, the CPU otherwise. */
export function createGrader(canvas: HTMLCanvasElement): Grader {
  if (webgl === null) {
    // probe on a throwaway canvas: once a canvas has a WebGL context it can't fall back to 2D
    const probe = document.createElement("canvas");
    const g = gpuGrader(probe);
    webgl = !!g && drawsGrade(g, probe);
    g?.dispose();
    (probe.getContext("webgl") as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return (webgl ? gpuGrader(canvas) : null) ?? cpuGrader(canvas);
}
