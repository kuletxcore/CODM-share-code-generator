import { defaultSettings, gradeUniforms, type Settings } from "@/lib/codm";

/*
 * applyGrade from codm.ts, run as a WebGL fragment shader. Same maths per
 * pixel, so the preview updates every frame while a slider moves instead of
 * redoing ~half a million pixels on the main thread. The CPU version stays
 * as the fallback.
 *
 * The shader only ever draws the fully graded image: the before/after wipe is
 * a clipped copy of the original layered over it on the page, so comparison
 * can never be confused with grading. On first use the pipeline is proved to
 * actually change pixels before it is trusted, so a driver that links the
 * program but draws nothing falls back to the CPU instead of showing a
 * preview that silently never loads the filter.
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

export type GradeGpu = {
  setSource: (src: HTMLCanvasElement) => void;
  render: (s: Settings) => void;
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
    uP = u("uP");
  let w = 1,
    h = 1;

  return {
    setSource(src) {
      w = canvas.width = src.width;
      h = canvas.height = src.height;
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    render(s) {
      const g = gradeUniforms(s);
      gl.uniform4fv(uBands, g.bands);
      gl.uniform3fv(uTint, g.tint);
      gl.uniform3fv(uP, g.params);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    },
  };
}

/**
 * Runs the real pipeline once on a mid grey and reads the pixel back. A driver
 * that compiles and links but draws nothing leaves the buffer at the clear
 * colour, so this is the difference between a preview that grades and one that
 * quietly shows the untouched image.
 */
function selfTest(): boolean {
  const probe = document.createElement("canvas");
  probe.width = 8;
  probe.height = 8;
  const g = init(probe);
  if (!g) return false;
  try {
    const grey = document.createElement("canvas");
    grey.width = 8;
    grey.height = 8;
    const ctx = grey.getContext("2d");
    if (!ctx) return false;
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 8, 8);

    // global (whole-image) group set to double brightness: 0x80 must come back bright
    const s = defaultSettings();
    s.zones.global = { hue: 0, tint: 0, sat: 50, bri: 100 };
    g.setSource(grey);
    g.render(s);

    const gl = probe.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return false;
    const px = new Uint8Array(4);
    gl.readPixels(3, 3, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px[3] > 0 && px[0] > 180;
  } catch {
    return false;
  } finally {
    g.dispose();
    (probe.getContext("webgl") as WebGLRenderingContext | null)
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  }
}

let gpuOk: boolean | null = null;

/** Builds the GPU grader on `canvas`, or returns null (canvas untouched) if WebGL can't run the grade. */
export function createGradeGpu(canvas: HTMLCanvasElement): GradeGpu | null {
  // probe on throwaway canvases: once a canvas has a WebGL context it can't fall back to 2D
  if (gpuOk === null) gpuOk = selfTest();
  return gpuOk ? init(canvas) : null;
}
