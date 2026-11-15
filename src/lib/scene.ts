/**
 * Procedural three.js tactical lighting environments used as the preview's
 * test scenes: real sky, directional sun/moon, atmospheric fog, cast shadows,
 * operator/weapon silhouettes and depth across 4 distinct CODM map archetypes.
 * Each scene is rendered once and cached as an offscreen canvas.
 */

export type SceneId = "woodland" | "desert" | "night" | "cqb";

export const SCENES: { id: SceneId; label: string; short: string; desc: string }[] = [
  { id: "woodland", label: "Woodland Day", short: "Woodland", desc: "Balanced daylight, sky & foliage" },
  { id: "desert", label: "Desert Sun", short: "Desert", desc: "Harsh golden sun, sand & dust" },
  { id: "night", label: "Night Ops", short: "Night", desc: "Moonlit fog, dark shadows & streetlamps" },
  { id: "cqb", label: "Urban CQB", short: "Urban CQB", desc: "Containers, overcast sky & dark corner target" },
];

const sceneCache = new Map<string, HTMLCanvasElement>();

function drawChips(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const chips = [
    "#e23b2e",
    "#f2a71b",
    "#8fd13f",
    "#27b36a",
    "#29b8d6",
    "#2f5fd0",
    "#7a3fd0",
    "#d93fa6",
    "#f2f2f2",
    "#8a8a8a",
    "#1e1e1e",
  ];
  // subtle dark framing bar for crisp chip legibility
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(w * 0.032, h * 0.848, w * (chips.length * 0.042 + 0.012), h * 0.104);
  chips.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(w * 0.04 + i * w * 0.042, h * 0.86, w * 0.036, h * 0.08);
  });
}

function cloneWithOptionalChips(base: HTMLCanvasElement, chips: boolean): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = base.width;
  out.height = base.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(base, 0, 0);
  if (chips) drawChips(ctx, out.width, out.height);
  return out;
}

export async function renderScene(
  w: number,
  h: number,
  opts: { chips?: boolean; sceneId?: SceneId } = {},
): Promise<HTMLCanvasElement | null> {
  const sceneId: SceneId = opts.sceneId ?? "woodland";
  const withChips = opts.chips !== false;
  const key = `${sceneId}:${w}x${h}`;

  const cached = sceneCache.get(key);
  if (cached) return cloneWithOptionalChips(cached, withChips);

  const THREE = await import("three");
  let renderer: InstanceType<typeof THREE.WebGLRenderer>;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }

  try {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();

    // deterministic PRNG so every map renders identically across visits
    let seed = sceneId === "woodland" ? 7 : sceneId === "desert" ? 23 : sceneId === "night" ? 41 : 73;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    // Atmosphere & lighting presets per environment
    const cfg = {
      woodland: {
        fog: 0xcbd8e2,
        fogNear: 70,
        fogFar: 340,
        skyHorizon: [0.84, 0.89, 0.93],
        skyZenith: [0.22, 0.45, 0.78],
        sunColor: [1.0, 0.93, 0.78],
        sunDir: [-0.55, 0.42, -0.72],
        hemiSky: 0xd3e4ff,
        hemiGround: 0x8d7c5c,
        hemiInt: 1.0,
        dirColor: 0xfff0d2,
        dirInt: 2.6,
        cloudTint: [0.74, 0.78, 0.84],
        cloudBright: [1.0, 1.0, 1.0],
        cloudOp: 0.92,
      },
      desert: {
        fog: 0xd9c29c,
        fogNear: 55,
        fogFar: 280,
        skyHorizon: [0.93, 0.82, 0.64],
        skyZenith: [0.34, 0.56, 0.79],
        sunColor: [1.0, 0.86, 0.58],
        sunDir: [-0.72, 0.34, -0.6],
        hemiSky: 0xffe4b8,
        hemiGround: 0xb68d5c,
        hemiInt: 1.15,
        dirColor: 0xffd79b,
        dirInt: 3.1,
        cloudTint: [0.85, 0.77, 0.66],
        cloudBright: [1.0, 0.96, 0.88],
        cloudOp: 0.45,
      },
      night: {
        fog: 0x162233,
        fogNear: 28,
        fogFar: 185,
        skyHorizon: [0.1, 0.16, 0.25],
        skyZenith: [0.02, 0.04, 0.1],
        sunColor: [0.78, 0.88, 1.0],
        sunDir: [0.42, 0.48, -0.77],
        hemiSky: 0x3b5882,
        hemiGround: 0x121821,
        hemiInt: 0.65,
        dirColor: 0x99bce8,
        dirInt: 1.15,
        cloudTint: [0.09, 0.14, 0.22],
        cloudBright: [0.24, 0.33, 0.46],
        cloudOp: 0.75,
      },
      cqb: {
        fog: 0x9ea7ad,
        fogNear: 40,
        fogFar: 210,
        skyHorizon: [0.76, 0.79, 0.82],
        skyZenith: [0.44, 0.51, 0.58],
        sunColor: [0.95, 0.96, 0.98],
        sunDir: [0.3, 0.75, -0.58],
        hemiSky: 0xdce4ea,
        hemiGround: 0x4b4e52,
        hemiInt: 1.05,
        dirColor: 0xf4f7fa,
        dirInt: 2.0,
        cloudTint: [0.64, 0.68, 0.72],
        cloudBright: [0.9, 0.92, 0.94],
        cloudOp: 0.95,
      },
    }[sceneId];

    scene.fog = new THREE.Fog(new THREE.Color(cfg.fog), cfg.fogNear, cfg.fogFar);

    const sunDir = new THREE.Vector3(cfg.sunDir[0], cfg.sunDir[1], cfg.sunDir[2]).normalize();
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(500, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          uniforms: {
            sunDir: { value: sunDir },
            uHorizon: { value: new THREE.Vector3(...cfg.skyHorizon) },
            uZenith: { value: new THREE.Vector3(...cfg.skyZenith) },
            uSunCol: { value: new THREE.Vector3(...cfg.sunColor) },
            uCloudDark: { value: new THREE.Vector3(...cfg.cloudTint) },
            uCloudLight: { value: new THREE.Vector3(...cfg.cloudBright) },
            uCloudOp: { value: cfg.cloudOp },
          },
          vertexShader:
            "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `
            varying vec3 vDir;
            uniform vec3 sunDir, uHorizon, uZenith, uSunCol, uCloudDark, uCloudLight;
            uniform float uCloudOp;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
              return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
            float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.05; a *= 0.5; } return v; }
            void main(){
              vec3 d = normalize(vDir);
              float t = clamp(d.y, 0.0, 1.0);
              vec3 col = mix(uHorizon, uZenith, pow(t, 0.55));
              float s = max(dot(d, normalize(sunDir)), 0.0);
              col += uSunCol * (pow(s, 750.0) * 3.5 + pow(s, 14.0) * 0.25);
              if (d.y > 0.02) {
                vec2 cp = d.xz / (d.y + 0.25) * 1.6;
                float c = smoothstep(0.48, 0.82, fbm(cp + 3.0));
                vec3 cc = mix(uCloudDark, uCloudLight, smoothstep(0.48, 0.95, fbm(cp * 1.7 + 9.0)));
                col = mix(col, cc, c * smoothstep(0.02, 0.2, d.y) * uCloudOp);
              }
              gl_FragColor = vec4(col, 1.0);
            }`,
        }),
      ),
    );

    scene.add(new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiInt));
    const sun = new THREE.DirectionalLight(cfg.dirColor, cfg.dirInt);
    sun.position.copy(sunDir).multiplyScalar(120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -100,
      right: 100,
      top: 100,
      bottom: -100,
      near: 10,
      far: 320,
    });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const wallMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const winMat = (emissive?: number) =>
      new THREE.MeshStandardMaterial({
        color: emissive ? 0x20252a : 0x14181d,
        emissive: emissive ?? 0x000000,
        emissiveIntensity: emissive ? 1.8 : 0,
        roughness: 0.35,
      });

    if (sceneId === "cqb") {
      // Flat concrete courtyard + perimeter walls + containers + dark alcove with operator silhouette
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(320, 320),
        new THREE.MeshStandardMaterial({ color: 0x6b6f72, roughness: 0.95 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      // Painted yard lane stripes
      for (const sx of [-12, 12]) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(0.45, 90),
          new THREE.MeshStandardMaterial({ color: 0xd8b848, roughness: 0.9 }),
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(sx, 0.03, -25);
        scene.add(stripe);
      }

      // Shipping containers (high saturation color anchors + strong shadows)
      const container = (x: number, y: number, z: number, bw: number, bh: number, bd: number, col: number, ry = 0) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.25 }),
        );
        m.position.set(x, y + bh / 2, z);
        m.rotation.y = ry;
        m.castShadow = m.receiveShadow = true;
        scene.add(m);
      };
      container(-15, 0, -18, 6, 6.2, 18, 0xb13d2e, 0.08);
      container(-15.5, 6.2, -19, 6, 6.2, 18, 0x3b6796, -0.04);
      container(16, 0, -24, 6, 6.2, 18, 0x4c6b42, -0.12);
      container(14, 0, -48, 16, 6.2, 6, 0xc28a36, 0.05);
      container(-22, 0, -52, 16, 6.2, 6, 0x7b838a, 0.0);

      // Warehouse hangar ahead with a deep shaded doorway & an operator silhouette standing inside!
      const hangar = new THREE.Group();
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(16, 15, 10), wallMat(0x8c9296));
      leftWall.position.set(-14, 7.5, -56);
      hangar.add(leftWall);
      const rightWall = new THREE.Mesh(new THREE.BoxGeometry(16, 15, 10), wallMat(0x8c9296));
      rightWall.position.set(14, 7.5, -56);
      hangar.add(rightWall);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 10), wallMat(0x757b80));
      lintel.position.set(0, 12, -56);
      hangar.add(lintel);
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 15, 1), wallMat(0x1a1d21));
      backWall.position.set(0, 7.5, -62);
      hangar.add(backWall);
      hangar.traverse((o) => {
        o.castShadow = o.receiveShadow = true;
      });
      scene.add(hangar);

      // Dark operator silhouette inside the shaded doorway (real enemy-visibility check!)
      const opMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.7 });
      const op = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.75), opMat);
      torso.position.y = 3.1;
      op.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), opMat);
      head.position.y = 4.65;
      op.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.65), opMat);
      legs.position.y = 1.0;
      op.add(legs);
      // subtle crimson shoulder glow / tactical patch like CODM enemy lights
      const shoulderL = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.35, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xe63a2e }),
      );
      shoulderL.position.set(-0.74, 3.8, 0.02);
      const shoulderR = shoulderL.clone();
      shoulderR.position.x = 0.74;
      op.add(shoulderL, shoulderR);
      op.position.set(-1.5, 0, -54);
      scene.add(op);

      // Concrete jersey barriers in midground
      for (const bx of [-6, 4.5]) {
        const barrier = new THREE.Mesh(new THREE.BoxGeometry(5.5, 1.8, 1.1), wallMat(0xa8adb0));
        barrier.position.set(bx, 0.9, -8);
        barrier.rotation.y = bx < 0 ? 0.14 : -0.1;
        barrier.castShadow = barrier.receiveShadow = true;
        scene.add(barrier);
      }

      // Distant city skyline silhouettes
      for (let i = 0; i < 12; i++) {
        const bh = 28 + rnd() * 55;
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(14 + rnd() * 14, bh, 14),
          wallMat(0x5b646d),
        );
        b.position.set(-120 + i * 22, bh / 2, -135 - rnd() * 35);
        scene.add(b);
      }
    } else {
      // Terrain ground for woodland / desert / night
      const gGeo = new THREE.PlaneGeometry(700, 700, 90, 90);
      gGeo.rotateX(-Math.PI / 2);
      const gp = gGeo.attributes.position;
      const gc: number[] = [];
      const colA = new THREE.Color(
        sceneId === "desert" ? 0xd3b07c : sceneId === "night" ? 0x26323a : 0xb59f78,
      );
      const colB = new THREE.Color(
        sceneId === "desert" ? 0xb18852 : sceneId === "night" ? 0x1a261f : 0x6e7d4a,
      );
      const duneScale = sceneId === "desert" ? 2.6 : 1.4;
      for (let i = 0; i < gp.count; i++) {
        const x = gp.getX(i),
          z = gp.getZ(i);
        gp.setY(
          i,
          Math.sin(x * 0.05) * Math.cos(z * 0.04) * duneScale +
            Math.sin(x * 0.17 + z * 0.11) * 0.25,
        );
        const m = Math.min(
          1,
          Math.max(0, 0.5 + Math.sin(x * 0.03 + 1) * Math.cos(z * 0.05) * 0.8 + (rnd() - 0.5) * 0.35),
        );
        const c = colA.clone().lerp(colB, m);
        gc.push(c.r, c.g, c.b);
      }
      gGeo.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3));
      gGeo.computeVertexNormals();
      const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      ground.receiveShadow = true;
      scene.add(ground);

      const roadColor = sceneId === "desert" ? 0x9c8462 : sceneId === "night" ? 0x232930 : 0x8a7556;
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 500),
        new THREE.MeshStandardMaterial({ color: roadColor, roughness: 1 }),
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(1, 0.16, -120);
      road.receiveShadow = true;
      scene.add(road);

      // Far mountains/dunes
      const hillPalette =
        sceneId === "desert"
          ? [0xc59f72, 0xb78f63, 0xa8825a, 0xc9a87c]
          : sceneId === "night"
            ? [0x1c2838, 0x182332, 0x15202e, 0x1a2833]
            : [0x7f8f9c, 0x8c9aa6, 0x7a8a96, 0x71856f];
      [
        [-170, -300, 120, 80, hillPalette[0]],
        [-40, -330, 150, 70, hillPalette[1]],
        [120, -310, 130, 95, hillPalette[2]],
        [260, -280, 110, 60, hillPalette[3]],
      ].forEach(([x, z, r, hh, c]) => {
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(r, hh, 7),
          new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }),
        );
        m.position.set(x, hh / 2 - 2, z);
        scene.add(m);
      });

      const house = (
        x: number,
        z: number,
        bw: number,
        bd: number,
        bh: number,
        wall: number,
        roof: number,
        ry = 0,
        flatRoof = false,
      ) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat(wall));
        body.position.y = bh / 2;
        g.add(body);
        if (!flatRoof) {
          const rf = new THREE.Mesh(
            new THREE.ConeGeometry(Math.hypot(bw, bd) * 0.62, bh * 0.38, 4),
            new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 }),
          );
          rf.rotation.y = Math.PI / 4 + Math.atan2(bd, bw) - Math.PI / 4;
          rf.position.y = bh + bh * 0.19;
          g.add(rf);
        } else {
          const parapet = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.5, 0.9, bd + 0.5), wallMat(roof));
          parapet.position.y = bh + 0.45;
          g.add(parapet);
        }
        const cols = Math.max(2, Math.round(bw / 3));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < Math.max(1, Math.round(bh / 4.5)); j++) {
            const lit = sceneId === "night" && rnd() > 0.45;
            const win = new THREE.Mesh(
              new THREE.BoxGeometry(1.1, 1.5, 0.15),
              winMat(lit ? (rnd() > 0.3 ? 0xffb85c : 0x56d4ff) : undefined),
            );
            win.position.set(-bw / 2 + (i + 0.5) * (bw / cols), 2.1 + j * 3.6, bd / 2 + 0.05);
            g.add(win);
          }
        }
        g.traverse((o) => {
          o.castShadow = true;
          o.receiveShadow = true;
        });
        g.position.set(x, 0, z);
        g.rotation.y = ry;
        scene.add(g);
      };

      if (sceneId === "desert") {
        house(-22, -46, 15, 11, 9, 0xd8c39f, 0xb89c72, 0.12, true);
        house(8, -82, 13, 10, 12, 0xcba97b, 0xa27e54, -0.08, true);
        house(30, -58, 16, 12, 11, 0xe0d1b8, 0xb9a07b, 0.2, true);
        house(-50, -90, 16, 12, 8, 0xbfa179, 0x927755, 0.05, true);
        house(52, -112, 18, 14, 15, 0xd1b993, 0xa88d67, -0.15, true);
        // communication tower silhouette
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 1.8, 36, 4),
          new THREE.MeshStandardMaterial({ color: 0x5c4f42, roughness: 0.8 }),
        );
        tower.position.set(-34, 18, -110);
        scene.add(tower);
      } else {
        house(-22, -46, 15, 11, 10, 0x7d8fb0, 0x4a3a30, 0.12);
        house(6, -84, 12, 10, 8, 0xa4533f, 0x3b2f2a, -0.08);
        house(30, -60, 16, 12, 13, 0xc9c2b2, 0x6a3f35, 0.2);
        house(-52, -92, 14, 12, 9, 0x4d5a3c, 0x2f3a28, 0.05);
        house(56, -118, 18, 14, 11, 0x9a8f7c, 0x4d3b30, -0.15);
        house(-8, -150, 20, 13, 12, 0x8896a3, 0x3d3530, 0.1);
      }

      // Warm tactical streetlamps & light pools in Night Ops
      if (sceneId === "night") {
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a313a, roughness: 0.7 });
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd180 });
        for (const [lx, lz] of [
          [-7, -24],
          [9, -44],
          [-6, -68],
        ]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 8, 6), poleMat);
          pole.position.set(lx, 4, lz);
          scene.add(pole);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), bulbMat);
          bulb.position.set(lx, 8.1, lz);
          scene.add(bulb);
          const pt = new THREE.PointLight(0xffb454, 42, 34, 1.5);
          pt.position.set(lx, 7.6, lz);
          scene.add(pt);
        }
      }

      // Trees / desert palms
      const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
      const foliageBase = sceneId === "desert" ? 0x566936 : sceneId === "night" ? 0x162620 : 0x2b4326;
      const treeCount = sceneId === "desert" ? 18 : 46;
      for (let i = 0; i < treeCount; i++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const x = side * (14 + rnd() * 95);
        const z = -20 - rnd() * 240;
        const s = 0.9 + rnd() * 0.9;
        const g = new THREE.Group();
        const t = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3 * s, 0.48 * s, (sceneId === "desert" ? 5.5 : 3) * s, 6),
          trunk,
        );
        t.position.y = (sceneId === "desert" ? 2.75 : 1.5) * s;
        g.add(t);
        const layers = sceneId === "desert" ? 2 : 4;
        for (let k = 0; k < layers; k++) {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry((3.4 - k * 0.65) * s, (sceneId === "desert" ? 2.2 : 4.6) * s, 7),
            new THREE.MeshStandardMaterial({
              color: new THREE.Color(foliageBase).offsetHSL(0, 0, rnd() * 0.04),
              roughness: 1,
              flatShading: true,
            }),
          );
          cone.position.y = (sceneId === "desert" ? 5.4 + k * 1.1 : 3.2 + k * 2.5) * s;
          g.add(cone);
        }
        g.traverse((o) => {
          o.castShadow = true;
        });
        g.position.set(x, 0, z);
        scene.add(g);
      }

      // Rocks near the camera for foreground scale
      const rockCol = sceneId === "desert" ? 0xa38764 : sceneId === "night" ? 0x2f3842 : 0x8a8578;
      for (let i = 0; i < 14; i++) {
        const rock = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.5 + rnd() * 1.2, 0),
          new THREE.MeshStandardMaterial({ color: rockCol, roughness: 1, flatShading: true }),
        );
        rock.position.set((rnd() - 0.5) * 50, 0.2, 4 - rnd() * 30);
        rock.castShadow = rock.receiveShadow = true;
        scene.add(rock);
      }
    }

    const camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 900);
    if (sceneId === "cqb") {
      camera.position.set(0, 2.3, 10);
      camera.lookAt(0, 3.6, -50);
    } else {
      camera.position.set(0, 2.4, 30);
      camera.lookAt(3, 6.5, -40);
    }
    scene.add(camera);

    // Dark foreground weapon silhouette (deep shadow anchor)
    const dark = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.55, metalness: 0.4 });
    const gun = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 2.4), dark);
    gun.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 10), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, -2.4);
    gun.add(barrel);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.4), dark);
    grip.position.set(0, -0.5, 0.2);
    grip.rotation.x = 0.25;
    gun.add(grip);
    gun.position.set(0.95, -0.72, -1.7);
    gun.rotation.set(0.04, 0.2, 0);
    camera.add(gun);

    renderer.render(scene, camera);

    const baseOut = document.createElement("canvas");
    baseOut.width = w;
    baseOut.height = h;
    baseOut.getContext("2d")!.drawImage(renderer.domElement, 0, 0, w, h);
    sceneCache.set(key, baseOut);

    scene.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      m.geometry?.dispose?.();
    });
    return cloneWithOptionalChips(baseOut, withChips);
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
