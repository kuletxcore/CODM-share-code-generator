/**
 * A small lit three.js scene used as the preview's starting image: real sky,
 * sun, fog, shadows and depth, so a filter change reads the way it would in a
 * game. Rendered once into a 2D canvas, so the grade still runs on pixels.
 */
export async function renderScene(w: number, h: number): Promise<HTMLCanvasElement | null> {
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
    const fogColor = new THREE.Color(0xcbd8e2);
    scene.fog = new THREE.Fog(fogColor, 70, 340);

    // sky dome: gradient, sun glow and soft clouds
    const sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
    scene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(500, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          fog: false,
          uniforms: { sunDir: { value: sunDir } },
          vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `
            varying vec3 vDir; uniform vec3 sunDir;
            float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
              return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
            float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.05; a *= 0.5; } return v; }
            void main(){
              vec3 d = normalize(vDir);
              float t = clamp(d.y, 0.0, 1.0);
              vec3 col = mix(vec3(0.84, 0.89, 0.93), vec3(0.22, 0.45, 0.78), pow(t, 0.55));
              float s = max(dot(d, normalize(sunDir)), 0.0);
              col += vec3(1.0, 0.93, 0.78) * (pow(s, 900.0) * 4.0 + pow(s, 14.0) * 0.28);
              if (d.y > 0.02) {
                vec2 cp = d.xz / (d.y + 0.25) * 1.6;
                float c = smoothstep(0.5, 0.82, fbm(cp + 3.0));
                vec3 cc = mix(vec3(0.74, 0.78, 0.84), vec3(1.0), smoothstep(0.5, 0.95, fbm(cp * 1.7 + 9.0)));
                col = mix(col, cc, c * smoothstep(0.02, 0.2, d.y) * 0.92);
              }
              gl_FragColor = vec4(col, 1.0);
            }`,
        }),
      ),
    );

    // light
    scene.add(new THREE.HemisphereLight(0xd3e4ff, 0x8d7c5c, 1.0));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
    sun.position.copy(sunDir).multiplyScalar(120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 10, far: 320 });
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // deterministic noise so every visit renders the same picture
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    // ground with vertex colour variation
    const gGeo = new THREE.PlaneGeometry(700, 700, 90, 90);
    gGeo.rotateX(-Math.PI / 2);
    const gp = gGeo.attributes.position;
    const gc: number[] = [];
    const sand = new THREE.Color(0xb59f78),
      grass = new THREE.Color(0x6e7d4a);
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i),
        z = gp.getZ(i);
      gp.setY(i, Math.sin(x * 0.05) * Math.cos(z * 0.04) * 1.4 + Math.sin(x * 0.17 + z * 0.11) * 0.25);
      const m = Math.min(1, Math.max(0, 0.5 + Math.sin(x * 0.03 + 1) * Math.cos(z * 0.05) * 0.8 + (rnd() - 0.5) * 0.35));
      const c = sand.clone().lerp(grass, m);
      gc.push(c.r, c.g, c.b);
    }
    gGeo.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3));
    gGeo.computeVertexNormals();
    const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);

    // dirt road
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 500),
      new THREE.MeshStandardMaterial({ color: 0x8a7556, roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(1, 0.12, -120);
    road.receiveShadow = true;
    scene.add(road);

    // far hills, fogged by distance
    const hill = (x: number, z: number, r: number, hgt: number, col: number) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(r, hgt, 7),
        new THREE.MeshStandardMaterial({ color: col, roughness: 1, flatShading: true }),
      );
      m.position.set(x, hgt / 2 - 2, z);
      scene.add(m);
    };
    [[-170, -300, 120, 80, 0x7f8f9c], [-40, -330, 150, 70, 0x8c9aa6], [120, -310, 130, 95, 0x7a8a96], [260, -280, 110, 60, 0x71856f]].forEach(
      ([x, z, r, hh, c]) => hill(x, z, r, hh, c),
    );

    // buildings: box walls, pyramid roof, dark window boxes
    const wallMat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
    const winMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.4 });
    const house = (x: number, z: number, bw: number, bd: number, bh: number, wall: number, roof: number, ry = 0) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat(wall));
      body.position.y = bh / 2;
      g.add(body);
      const rf = new THREE.Mesh(
        new THREE.ConeGeometry(Math.hypot(bw, bd) * 0.62, bh * 0.38, 4),
        new THREE.MeshStandardMaterial({ color: roof, roughness: 0.8 }),
      );
      rf.rotation.y = Math.PI / 4 + Math.atan2(bd, bw) - Math.PI / 4;
      rf.position.y = bh + bh * 0.19;
      g.add(rf);
      const cols = Math.max(2, Math.round(bw / 3));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < Math.max(1, Math.round(bh / 4.5)); j++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.15), winMat);
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
    house(-22, -46, 15, 11, 10, 0x7d8fb0, 0x4a3a30, 0.12);
    house(6, -84, 12, 10, 8, 0xa4533f, 0x3b2f2a, -0.08);
    house(30, -60, 16, 12, 13, 0xc9c2b2, 0x6a3f35, 0.2);
    house(-52, -92, 14, 12, 9, 0x4d5a3c, 0x2f3a28, 0.05);
    house(56, -118, 18, 14, 11, 0x9a8f7c, 0x4d3b30, -0.15);
    house(-8, -150, 20, 13, 12, 0x8896a3, 0x3d3530, 0.1);

    // pines
    const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    const pine = (x: number, z: number, s: number) => {
      const g = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 3 * s, 6), trunk);
      t.position.y = 1.5 * s;
      g.add(t);
      for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry((3.4 - i * 0.65) * s, 4.6 * s, 7),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2b4326).offsetHSL(0, 0, rnd() * 0.04), roughness: 1, flatShading: true }),
        );
        cone.position.y = (3.2 + i * 2.5) * s;
        g.add(cone);
      }
      g.traverse((o) => {
        o.castShadow = true;
      });
      g.position.set(x, 0, z);
      scene.add(g);
    };
    for (let i = 0; i < 46; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      pine(side * (14 + rnd() * 95), -20 - rnd() * 240, 0.9 + rnd() * 0.9);
    }
    // rocks near the camera for foreground scale
    for (let i = 0; i < 14; i++) {
      const rock = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.5 + rnd() * 1.2, 0),
        new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1, flatShading: true }),
      );
      rock.position.set((rnd() - 0.5) * 50, 0.2, 4 - rnd() * 30);
      rock.castShadow = rock.receiveShadow = true;
      scene.add(rock);
    }

    const camera = new THREE.PerspectiveCamera(58, w / h, 0.1, 900);
    camera.position.set(0, 2.4, 30);
    camera.lookAt(3, 6.5, -40);
    scene.add(camera);

    // dark foreground silhouette (deep shadows, like a held weapon)
    const dark = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.55, metalness: 0.4 });
    const gun = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 2.4), dark);
    stock.position.set(0, 0, 0);
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

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(renderer.domElement, 0, 0, w, h);
    // colour chips, handy for reading hue shifts
    const chips = ["#e23b2e", "#f2a71b", "#8fd13f", "#27b36a", "#29b8d6", "#2f5fd0", "#7a3fd0", "#d93fa6", "#f2f2f2", "#8a8a8a", "#1e1e1e"];
    chips.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(w * 0.04 + i * w * 0.042, h * 0.86, w * 0.036, h * 0.08);
    });
    scene.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      m.geometry?.dispose?.();
    });
    return out;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
