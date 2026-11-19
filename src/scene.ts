import * as THREE from 'three';

/**
 * "Virtuelle Probefahrt": eine LiDAR-Punktwolken-Landschaft, ein Fahrzeug aus Linien,
 * ein Radar-Fächer nach vorne und Ultraschall-Wellen nach hinten.
 * Alles läuft clientseitig mit eigenen GLSL-Shadern, ohne externe Assets.
 */

export interface SceneApi {
  setProgress(p: number): void;
  setPointer(x: number, y: number): void;
  onHud(cb: (hud: { angle: number; points: number; speed: number }) => void): void;
  dispose(): void;
}

const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i+vec2(1.,0.)), c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
    vec2 u = f*f*(3.-2.*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
  }
  float fbm(vec2 p){ float v = 0.; float a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p *= 2.03; a *= .5; } return v; }
`;

// Kamera-Stationen je Abschnitt (Hero, Profil, Erfahrung, Kompetenzen, Projekte, Engagement, Kontakt)
const CAM_POS: [number, number, number][] = [
  [0, 3.4, 11.5],
  [7.5, 2.4, 5.5],
  [-4.5, 1.3, 7.0],
  [0.01, 26, 6],
  [3, 2.2, -9],
  [-10, 6, -2],
  [0, 11, 22],
];
const CAM_TARGET: [number, number, number][] = [
  [0, 0.6, -10],
  [0, 0.8, -4],
  [0, 1.0, -14],
  [0, 0, -10],
  [0, 0.9, 2],
  [0, 0.5, -6],
  [0, 0, -30],
];

export function createScene(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; mobile: boolean }): SceneApi | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.mobile, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const dpr = Math.min(window.devicePixelRatio || 1, opts.mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020617, 0.018);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

  const camCurve = new THREE.CatmullRomCurve3(CAM_POS.map((v) => new THREE.Vector3(...v)), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(CAM_TARGET.map((v) => new THREE.Vector3(...v)), false, 'centripetal');

  // ---------- LiDAR-Landschaft ----------
  const cols = opts.mobile ? 110 : 190;
  const rows = opts.mobile ? 150 : 250;
  const span = 200; // Länge der Strecke in z
  const width = 128;
  const terrainCount = cols * rows;
  const laneCount = Math.floor(span / 1.0) * 3;
  const total = terrainCount + laneCount;

  const pos = new Float32Array(total * 3);
  const rnd = new Float32Array(total);
  const type = new Float32Array(total);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (Math.random() - 0.5) * 0.6;
      const jz = (Math.random() - 0.5) * 0.6;
      // Dichter nahe der Straße: quadratische Verteilung in x
      const u = (c / (cols - 1)) * 2 - 1;
      const x = Math.sign(u) * Math.pow(Math.abs(u), 1.6) * (width / 2) + jx;
      pos[k * 3] = x;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = -(r / rows) * span + 40 + jz;
      rnd[k] = Math.random();
      type[k] = 0;
      k++;
    }
  }
  for (let i = 0; i < span; i++) {
    const z = -i + 40;
    // Mittellinie gestrichelt, Fahrbahnränder durchgehend
    const lanes: [number, number][] = [
      [0, i % 4 < 2 ? 1 : -1],
      [-3.6, 2],
      [3.6, 2],
    ];
    for (const [x, t] of lanes) {
      pos[k * 3] = x;
      pos[k * 3 + 1] = 0.02;
      pos[k * 3 + 2] = z;
      rnd[k] = Math.random();
      type[k] = t;
      k++;
    }
  }

  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  terrainGeo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  terrainGeo.setAttribute('aType', new THREE.BufferAttribute(type, 1));

  const terrainMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOffset: { value: 0 },
      uScan: { value: 0 },
      uSweep: { value: 0 },
      uPixelRatio: { value: dpr },
      uSize: { value: opts.mobile ? 70 : 64 },
    },
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uOffset, uScan, uSweep, uPixelRatio, uSize;
      attribute float aRand; attribute float aType;
      varying float vAlpha; varying vec3 vColor;
      void main(){
        vec3 p = position;
        p.z = mod(p.z + uOffset - 40. + 200., 200.) - 160.;
        float worldZ = p.z - uOffset; // feste Bodenkoordinate, damit Hügel mitfahren
        float ax = abs(p.x);
        float hill = smoothstep(5., 26., ax);
        float h = fbm(vec2(p.x*.045, worldZ*.045)) * 14. * hill + fbm(vec2(p.x*.2, worldZ*.2)) * .8 * hill;
        if (aType < 0.5) p.y = h - .05;
        float d = length(p.xz);
        // LiDAR-Ring
        float ring = exp(-abs(d - uScan) * .55);
        // Radar-Sweep im Fächer vor dem Fahrzeug
        float ang = atan(p.x, -p.z);
        float inCone = step(p.z, -1.) * smoothstep(.9, .7, abs(ang)) * smoothstep(70., 10., d);
        float sweep = exp(-abs(ang - uSweep) * 10.) * inCone;
        vec3 deep = vec3(.06, .22, .75);
        vec3 ice = vec3(.49, .77, 1.);
        vec3 col = mix(deep, ice, clamp(h/9., 0., 1.) * .75 + aRand*.2) * 1.25;
        col += ice * ring * 1.4 + vec3(.35,.6,1.) * sweep * 1.6;
        float a = (.55 + aRand*.45) * (.8 + hill*.7);
        float s = uSize * (.55 + aRand*.6);
        if (aType > .5) {
          // Fahrbahnmarkierung
          float dash = aType < 1.5 ? 1. : .55;
          col = mix(vec3(.75,.88,1.), ice, .3) * dash;
          a = aType < 1.5 ? .95 : .55;
          s = uSize * (aType < 1.5 ? 1.1 : .8);
        }
        if (aType < -.5) { a = 0.; }
        a += ring * .6 + sweep * .8;
        a *= smoothstep(160., 40., d) * smoothstep(-.5, 3., -p.z + 40.);
        a *= .85 + .15*sin(uTime*2. + aRand*30.);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = s * uPixelRatio * (1. + ring*.8) / -mv.z;
        vAlpha = a; vColor = col;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha; varying vec3 vColor;
      void main(){
        vec2 c = gl_PointCoord - .5;
        float d = length(c);
        float m = smoothstep(.5, .0, d);
        m = m*m;
        if (m < .01) discard;
        gl_FragColor = vec4(vColor, vAlpha * m);
      }
    `,
  });
  const terrain = new THREE.Points(terrainGeo, terrainMat);
  terrain.frustumCulled = false;
  scene.add(terrain);

  // ---------- Sternenhimmel ----------
  const starCount = opts.mobile ? 500 : 1100;
  const starPos = new Float32Array(starCount * 3);
  const starRnd = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.42;
    const r = 180;
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 10;
    starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 40;
    starRnd[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aRand', new THREE.BufferAttribute(starRnd, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: dpr } },
    vertexShader: /* glsl */ `
      uniform float uTime, uPixelRatio; attribute float aRand; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1. + aRand*2.2) * uPixelRatio;
        vA = (.25 + aRand*.6) * (.6 + .4*sin(uTime*(.5+aRand*2.) + aRand*50.));
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor = vec4(.75,.87,1., vA*(1.-d*2.)); }`,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  // ---------- Fahrzeug aus Linien ----------
  const car = new THREE.Group();
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.95 });
  const faintMat = new THREE.LineBasicMaterial({ color: 0x2f6bff, transparent: true, opacity: 0.55 });
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x0a1a3f, transparent: true, opacity: 0.55, depthWrite: false });
  const addBox = (w: number, h: number, d: number, x: number, y: number, z: number, mat = lineMat) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const fill = new THREE.Mesh(g, glassMat);
    fill.position.set(x, y, z);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), mat);
    edges.position.set(x, y, z);
    car.add(fill, edges);
    return edges;
  };
  // Karosserie mit abgeschrägter Kabine
  addBox(1.9, 0.55, 4.4, 0, 0.62, 0);
  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-1.2, 0);
  cabinShape.lineTo(-0.55, 0.55);
  cabinShape.lineTo(0.9, 0.55);
  cabinShape.lineTo(1.5, 0);
  cabinShape.lineTo(-1.2, 0);
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.62, bevelEnabled: false });
  cabinGeo.translate(0, 0, -0.81);
  cabinGeo.rotateY(Math.PI / 2);
  const cabin = new THREE.LineSegments(new THREE.EdgesGeometry(cabinGeo), lineMat);
  const cabinFill = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.y = cabinFill.position.y = 0.895;
  car.add(cabinFill, cabin);
  const wheels: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.95, -1.35], [0.95, -1.35], [-0.95, 1.4], [0.95, 1.4]] as const) {
    const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
    wg.rotateZ(Math.PI / 2);
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(wg, 1), faintMat);
    w.position.set(x, 0.38, z);
    wheels.push(w);
    car.add(w);
  }
  // Scheinwerfer und Sensorpunkte
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.65, 0.68, -2.22, 0.65, 0.68, -2.22, 0, 0.75, -2.22, -0.7, 0.7, 2.22, 0.7, 0.7, 2.22, 0, 1.47, 0.1], 3),
  );
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelRatio: { value: dpr }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `uniform float uPixelRatio, uTime; varying float vI;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
      vI = float(gl_VertexID);
      gl_PointSize = 260. * uPixelRatio / -mv.z * (vI > 4.5 ? .6 + .4*sin(uTime*6.) : 1.); }`,
    fragmentShader: /* glsl */ `varying float vI;
      void main(){ float d = length(gl_PointCoord-.5); float m = pow(smoothstep(.5,0.,d), 2.2);
      vec3 c = vI > 2.5 && vI < 4.5 ? vec3(1.,.25,.35) : vec3(.6,.82,1.);
      gl_FragColor = vec4(c, m); }`,
  });
  car.add(new THREE.Points(glowGeo, glowMat));
  scene.add(car);

  // ---------- Radar-Fächer & Ultraschall ----------
  const fanMat = (front: boolean) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSweep: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: front
        ? /* glsl */ `uniform float uTime, uSweep; varying vec2 vP;
          void main(){
            float r = length(vP); float a = atan(vP.x, vP.y);
            float edge = smoothstep(.0, .06, .78 - abs(a));
            float fade = smoothstep(46., 2., r);
            float beam = exp(-abs(a - uSweep)*14.);
            float grid = smoothstep(.92, 1., fract(r/4. - uTime*.6)) * .5;
            float al = (.05 + beam*.55 + grid*.25) * fade * edge;
            gl_FragColor = vec4(mix(vec3(.18,.42,1.), vec3(.6,.85,1.), beam), al);
          }`
        : /* glsl */ `uniform float uTime; varying vec2 vP;
          void main(){
            float r = length(vP);
            float w = smoothstep(.85, 1., fract(r*1.1 - uTime*1.4));
            float fade = smoothstep(3.6, .2, r);
            gl_FragColor = vec4(.49,.77,1., w*fade*.7);
          }`,
    });
  const radarMat = fanMat(true);
  const radar = new THREE.Mesh(new THREE.CircleGeometry(46, 64, -0.8, 1.6), radarMat);
  radar.rotation.x = -Math.PI / 2;
  radar.rotation.z = Math.PI; // Fächer zeigt nach -z
  radar.position.set(0, 0.06, -2.2);
  scene.add(radar);
  const usMat = fanMat(false);
  const ultra = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40, -1.1, 2.2), usMat);
  ultra.rotation.x = -Math.PI / 2;
  ultra.position.set(0, 0.07, 2.2);
  scene.add(ultra);

  // ---------- Steuerung ----------
  let progress = 0;
  let smoothProgress = 0;
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  let hudCb: ((hud: { angle: number; points: number; speed: number }) => void) | null = null;
  const clock = new THREE.Clock();
  let elapsed = 0;
  let offset = 0;
  let raf = 0;
  let running = false;
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const motion = opts.reducedMotion ? 0 : 1;

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 68 : 55;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let hudTimer = 0;
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt * (motion || 0.0);
    smoothProgress += (progress - smoothProgress) * Math.min(1, dt * 4 + (motion ? 0 : 1));
    pointerSmooth.lerp(pointer, Math.min(1, dt * 3));

    // Geschwindigkeit: im Hero zügig, beim Lesen ruhiger
    const speed = motion * (14 - smoothProgress * 6);
    offset += speed * dt;

    const sweep = Math.sin(elapsed * 1.6) * 0.72;
    const scan = (elapsed * 26) % 90;

    terrainMat.uniforms.uTime.value = elapsed;
    terrainMat.uniforms.uOffset.value = offset;
    terrainMat.uniforms.uScan.value = motion ? scan : 30;
    terrainMat.uniforms.uSweep.value = sweep;
    starMat.uniforms.uTime.value = elapsed;
    glowMat.uniforms.uTime.value = elapsed;
    radarMat.uniforms.uTime.value = elapsed;
    radarMat.uniforms.uSweep.value = -sweep;
    usMat.uniforms.uTime.value = elapsed;
    for (const w of wheels) w.rotation.x -= speed * dt / 0.38;
    car.position.y = Math.sin(elapsed * 9) * 0.012 * motion;

    const t = THREE.MathUtils.clamp(smoothProgress, 0, 1);
    camCurve.getPoint(t, camPos);
    tgtCurve.getPoint(t, camTgt);
    camPos.x += pointerSmooth.x * 1.2;
    camPos.y += pointerSmooth.y * 0.6;
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // Auf breiten Bildschirmen steht das Fahrzeug im Hero rechts neben dem Text
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shift = w / h > 1.15 ? THREE.MathUtils.smoothstep(1 - t * 7, 0, 1) * 0.24 : 0;
    if (shift > 0.001) camera.setViewOffset(w, h, -w * shift, 0, w, h);
    else if (camera.view?.enabled) camera.clearViewOffset();

    renderer.render(scene, camera);

    hudTimer += dt;
    if (hudCb && hudTimer > 0.1) {
      hudTimer = 0;
      hudCb({ angle: Math.round(THREE.MathUtils.radToDeg(sweep) + 360) % 360, points: total, speed: Math.round(speed * 3.6 * 3.2) });
    }
    if (running) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);
  start();

  return {
    setProgress(p) {
      progress = p;
    },
    setPointer(x, y) {
      if (!opts.reducedMotion) pointer.set(x, y);
    },
    onHud(cb) {
      hudCb = cb;
    },
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    },
  };
}
