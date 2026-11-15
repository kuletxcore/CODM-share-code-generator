import { gradeUniforms, type Settings } from "@/lib/codm";

/*
 * applyGrade from codm.ts, run as a WebGL fragment shader. Same maths per
 * pixel, so the preview updates every frame while a slider moves instead of
 * redoing ~half a million pixels on the main thread. Also supports optional
 * false-colour tonal zone mask and dual-filter A/B split comparison.
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
uniform float uHasLeft;
uniform vec4 uBandsL;
uniform vec3 uTintL[4];
uniform vec3 uPL[4];
uniform vec2 uSize;
uniform float uSplitX;
uniform float uMask;

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
vec3 gradeRight(vec3 c){
  float l0 = luma(c);
  float ws = 1.0 - smoothB(uBands.x, uBands.y, l0);
  float wh = smoothB(uBands.z, uBands.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  c = zone(c, uTint[0], uP[0], ws);
  c = zone(c, uTint[1], uP[1], wm);
  c = zone(c, uTint[2], uP[2], wh);
  c = zone(c, uTint[3], uP[3], 1.0);
  return clamp(c, 0.0, 1.0);
}
vec3 gradeLeft(vec3 c){
  float l0 = luma(c);
  float ws = 1.0 - smoothB(uBandsL.x, uBandsL.y, l0);
  float wh = smoothB(uBandsL.z, uBandsL.w, l0) * (1.0 - ws);
  float wm = max(0.0, 1.0 - ws - wh);
  c = zone(c, uTintL[0], uPL[0], ws);
  c = zone(c, uTintL[1], uPL[1], wm);
  c = zone(c, uTintL[2], uPL[2], wh);
  c = zone(c, uTintL[3], uPL[3], 1.0);
  return clamp(c, 0.0, 1.0);
}
void main(){
  vec3 c = texture2D(uTex, vUv).rgb;
  float col = floor(vUv.x * uSize.x);
  if (uMask > 0.5) {
    float l0 = luma(c);
    float ws = 1.0 - smoothB(uBands.x, uBands.y, l0);
    float wh = smoothB(uBands.z, uBands.w, l0) * (1.0 - ws);
    float wm = max(0.0, 1.0 - ws - wh);
    vec3 falseCol = ws * vec3(0.16, 0.84, 1.0) + wm * vec3(l0 * 0.72 + 0.14) + wh * vec3(1.0, 0.92, 0.23);
    vec3 blended = mix(vec3(l0), falseCol, 0.78);
    gl_FragColor = vec4(clamp(blended, 0.0, 1.0), 1.0);
    return;
  }
  if (uSplitX > 0.0 && uSplitX < uSize.x && col >= uSplitX - 1.0 && col <= uSplitX) {
    gl_FragColor = vec4(1.0, 234.0 / 255.0, 59.0 / 255.0, 1.0);
    return;
  }
  if (col < uSplitX) {
    gl_FragColor = vec4(uHasLeft > 0.5 ? gradeLeft(c) : c, 1.0);
    return;
  }
  gl_FragColor = vec4(gradeRight(c), 1.0);
}`;

export type GradeGpu = {
  setSource: (src: HTMLCanvasElement) => void;
  render: (s: Settings, split: number, opts?: { mask?: boolean; left?: Settings | null }) => void;
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
    uHasLeft = u("uHasLeft"),
    uBandsL = u("uBandsL"),
    uTintL = u("uTintL"),
    uPL = u("uPL"),
    uSize = u("uSize"),
    uSplitX = u("uSplitX"),
    uMask = u("uMask");
  let w = 1,
    h = 1;

  return {
    setSource(src) {
      w = canvas.width = src.width;
      h = canvas.height = src.height;
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    render(s, split, opts) {
      const g = gradeUniforms(s);
      gl.uniform4fv(uBands, g.bands);
      gl.uniform3fv(uTint, g.tint);
      gl.uniform3fv(uP, g.params);
      if (opts?.left) {
        const glf = gradeUniforms(opts.left);
        gl.uniform1f(uHasLeft, 1.0);
        gl.uniform4fv(uBandsL, glf.bands);
        gl.uniform3fv(uTintL, glf.tint);
        gl.uniform3fv(uPL, glf.params);
      } else {
        gl.uniform1f(uHasLeft, 0.0);
      }
      gl.uniform2f(uSize, w, h);
      gl.uniform1f(uSplitX, Math.min(w, Math.round(w * split)));
      gl.uniform1f(uMask, opts?.mask ? 1.0 : 0.0);
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

/** Builds the GPU grader on `canvas`, or returns null (canvas untouched) if WebGL can't run it. */
export function createGradeGpu(canvas: HTMLCanvasElement): GradeGpu | null {
  if (supported === null) {
    // probe on a throwaway canvas: once a canvas has a WebGL context it can't fall back to 2D
    const probe = document.createElement("canvas");
    const g = init(probe);
    supported = !!g;
    g?.dispose();
    (probe.getContext("webgl") as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported ? init(canvas) : null;
}
