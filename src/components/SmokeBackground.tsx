"use client";

import { useEffect, useRef } from "react";

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = vUv;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 2.2;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
  float n = fbm(p + 2.4 * q + vec2(t * 1.7, t * 0.4));
  vec3 base = vec3(0.035, 0.04, 0.035);
  vec3 smoke = mix(vec3(0.09, 0.1, 0.09), vec3(0.2, 0.19, 0.15), n);
  vec3 col = mix(base, smoke, smoothstep(0.35, 0.95, n) * 0.85);
  // faint warm glow from lower left, cool from upper right
  col += vec3(0.16, 0.12, 0.0) * smoothstep(0.9, 0.0, distance(uv, vec2(0.05, 0.0))) * 0.35;
  col += vec3(0.03, 0.06, 0.03) * smoothstep(1.0, 0.0, distance(uv, vec2(1.0, 1.0))) * 0.5;
  // vignette
  col *= smoothstep(1.25, 0.25, distance(uv, vec2(0.5)));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Slow-moving smoke behind the UI, drawn with three.js. */
export default function SmokeBackground() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    import("three").then((THREE) => {
      const el = host.current;
      if (disposed || !el) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      } catch {
        return; // no WebGL: the CSS background stays
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        fragmentShader: frag,
        vertexShader:
          "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }",
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      scene.add(mesh);

      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const resize = () => {
        const w = window.innerWidth,
          h = window.innerHeight;
        // blurry smoke needs few pixels: half res on desktop, a third on touch screens
        const div = coarse ? 3 : 2;
        renderer.setSize(w / div, h / div, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        uniforms.uRes.value.set(w, h);
      };
      resize();
      window.addEventListener("resize", resize);

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let raf = 0;
      let last = 0;
      let busy = false; // finger/mouse is down: leave the CPU and GPU to the preview
      const FRAME = 1000 / 24; // smoke drifts slowly, 24fps is indistinguishable
      let clock = 0; // animation time only advances while the smoke is actually drawn
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (busy || document.hidden || now - last < FRAME) return;
        clock += Math.min(now - last, 100) / 1000;
        last = now;
        uniforms.uTime.value = clock;
        renderer.render(scene, camera);
      };
      uniforms.uTime.value = 0;
      renderer.render(scene, camera);
      const down = () => (busy = true);
      const up = () => (busy = false);
      window.addEventListener("pointerdown", down, { passive: true });
      window.addEventListener("pointerup", up, { passive: true });
      window.addEventListener("pointercancel", up, { passive: true });
      if (!still) raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        mesh.geometry.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_20%_100%,#2a2410_0%,#0a0b0a_55%)]"
    />
  );
}
