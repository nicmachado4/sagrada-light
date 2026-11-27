// The floating windows in three.js. One real-style Sagrada Familia window
// bay turning on a white ground. The light is fixed in the world: a beam
// at a fixed angle passes through the glass, and the colored pattern it
// throws on the floor shifts and skews as the pane turns.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { buildBay } from './bay.js';
import { makeRoseCanvas } from './glass.js';

export const WINDOWS_META = [
    { key: 'passion', name: 'Passion', kind: 'bay', palette: 'warm', seed: 21 },
    { key: 'nativity', name: 'Nativity', kind: 'bay', palette: 'cool', seed: 7 },
    { key: 'apse', name: 'Apse', kind: 'bay', palette: 'apse', seed: 33 },
    { key: 'whites', name: 'The sixteen whites', kind: 'bay', palette: 'whites', seed: 47 },
];

const LIFT = 0.16;
const LDIR = new THREE.Vector3(-0.3, -0.9, 0.42).normalize();

const GLASS_VS = `
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SWEEP_FN = `
uniform float uSweep;
vec3 sweepColor(vec3 c) {
  vec3 cool = vec3(c.b * 0.85, c.g * 0.95 + c.r * 0.08, c.r * 0.6 + c.b * 0.55 + 0.04);
  return mix(c, clamp(cool, 0.0, 1.0), uSweep);
}`;
const SW = { value: 0 };
const GLASS_FS = `
uniform sampler2D atlas; uniform vec3 L; uniform vec3 camPos; uniform vec3 uvm;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
${SWEEP_FN}
void main() {
  vec4 t = texture2D(atlas, vUv);
  if (t.a < 0.5) discard;
  vec3 N = normalize(vN);
  vec3 V = normalize(camPos - vW);
  float inc = abs(dot(N, L));
  vec3 c = sweepColor(t.rgb);
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  // Back-lit: glass glows more when the beam goes through square on.
  vec3 col = c * (0.95 + 0.35 * inc) + c * c * 0.3 * inc;
  col += vec3(1.0, 0.97, 0.9) * 0.10 * inc * smoothstep(0.35, 0.9, lum);
  // Glint where the pane catches the beam's direction.
  vec3 H = normalize(-L * sign(dot(N, V)) + V);
  float spec = pow(max(abs(dot(N, H)), 0.0), 90.0);
  col += vec3(1.0, 0.98, 0.92) * spec * 0.55;
  float fr = pow(1.0 - abs(dot(N, V)), 3.0);
  col = mix(col, vec3(1.0), fr * 0.12);
  gl_FragColor = vec4(col, 1.0);
}`;

const FLOOR_VS = `
varying vec3 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FLOOR_FS = `
uniform sampler2D atlas; uniform sampler2D mask;
${SWEEP_FN}
uniform vec3 L; uniform float yaw; uniform float lift; uniform vec3 uvm; uniform float amp;
varying vec3 vP;
vec2 toUv(vec3 X, float c, float s) {
  float xl = X.x * c - X.z * s;
  float yl = X.y - lift;
  return vec2(xl * uvm.x + 0.5, yl * uvm.z);
}
void main() {
  float c = cos(yaw), s = sin(yaw);
  vec3 nw = vec3(s, 0.0, c);
  float dn = dot(nw, L);
  vec3 col = vec3(1.0);
  if (abs(dn) > 0.0005) {
    float t = dot(nw, vP) / dn;
    if (t > 0.0) {
      vec3 X = vP - L * t;
      float inc = abs(dn);
      float soft = 0.008 + 0.022 * t;
      float ca = 0.012 * t;
      vec3 sum = vec3(0.0); float aSum = 0.0; float stone = 0.0;
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          vec2 o = vec2(float(i), float(j)) * soft;
          vec2 uv = toUv(X, c, s) + o;
          vec2 uvR = uv + vec2(ca, 0.0);
          vec2 uvB = uv - vec2(ca, 0.0);
          float inb = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
          vec4 g = texture2D(atlas, uv);
          vec4 gr = texture2D(atlas, uvR);
          vec4 gb = texture2D(atlas, uvB);
          float a = g.a * inb;
          sum += vec3(gr.r * gr.a, g.g * a, gb.b * gb.a) * inb;
          aSum += a;
          stone += texture2D(mask, uv).a * inb;
        }
      }
      aSum /= 9.0; stone /= 9.0;
      vec3 tint = sum / max(aSum * 9.0, 0.001);
      float m = dot(tint, vec3(0.333));
      tint = clamp(mix(vec3(m), tint, 1.4) * 1.15 + 0.06, 0.0, 1.0);
      float reach = exp(-t * 0.35) * pow(inc, 0.55);
            float k = smoothstep(0.0, 0.9, aSum) * reach * 1.0 * amp;
      tint = sweepColor(tint);
      col = mix(col, tint, k);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const BEAM_VS = `
attribute vec3 col; attribute float endv;
uniform float yaw; uniform float lift; uniform vec3 L;
varying vec3 vC; varying float vE;
void main() {
  float c = cos(yaw), s = sin(yaw);
  vec3 p0 = vec3(position.x * c, position.y + lift, -position.x * s);
  float t = p0.y / max(-L.y, 0.05);
  vec3 p1 = p0 + L * t;
  vec3 p = mix(p0, p1, endv);
  vC = col; vE = endv;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;
const BEAM_FS = `
uniform float amp; uniform float yaw; uniform vec3 L;
varying vec3 vC; varying float vE;
${SWEEP_FN}
void main() {
  vec3 nw = vec3(sin(yaw), 0.0, cos(yaw));
  float inc = pow(abs(dot(nw, L)), 0.7);
  float a = 0.07 * (1.0 - 0.75 * vE) * inc * amp;
  gl_FragColor = vec4(sweepColor(vC), a);
}`;

function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export function startScene(canvas, opts = {}) {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) { return null; }
    const onIndex = opts.onIndex || (() => {});
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const qs = new URLSearchParams(location.search);

    renderer.setClearColor(0xffffff, 1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xf2eee6, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e6, 0.9);
    sun.position.set(0.5, 1.0, 1.2);
    scene.add(sun);

    // Floor that shows the projected light.
    const floorMat = new THREE.ShaderMaterial({
        vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
        uniforms: {
            atlas: { value: null }, mask: { value: null },
            L: { value: LDIR.clone() }, yaw: { value: 0 }, lift: { value: LIFT },
            uvm: { value: new THREE.Vector3(1, 0.5, 1) }, amp: { value: 1 }, uSweep: SW,
        },
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const group = new THREE.Group();
    group.position.y = LIFT;
    scene.add(group);

    const beamMat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VS, fragmentShader: BEAM_FS,
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { yaw: { value: 0 }, lift: { value: LIFT }, L: { value: LDIR.clone() }, amp: { value: 1 }, uSweep: SW },
    });
    const beam = new THREE.Mesh(new THREE.BufferGeometry(), beamMat);
    beam.frustumCulled = false;
    beam.renderOrder = 2;
    scene.add(beam);

    const glassMat = new THREE.ShaderMaterial({
        vertexShader: GLASS_VS, fragmentShader: GLASS_FS, side: THREE.DoubleSide,
        uniforms: { atlas: { value: null }, L: { value: LDIR.clone() }, camPos: { value: camera.position }, uvm: { value: new THREE.Vector3(1, 0.5, 1) }, uSweep: SW },
    });
    const capMat = new THREE.MeshBasicMaterial({ visible: false });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0x1a1612 });

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const wins = WINDOWS_META.map((meta) => {
        const bay = buildBay(meta, makeRoseCanvas);
        const atlasTex = new THREE.CanvasTexture(bay.atlas);
        atlasTex.anisotropy = maxAniso;
        atlasTex.generateMipmaps = true;
        atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
        atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;
        const maskTex = new THREE.CanvasTexture(bay.mask);
        const blurTex = new THREE.CanvasTexture(bay.blur);
        blurTex.wrapS = blurTex.wrapT = THREE.ClampToEdgeWrapping;
        maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;
        const sx = 1 / (bay.hw * 2);
        const sy = 1 / bay.top;
        const uvm = new THREE.Vector3(sx, 0.5, sy);

        const toShape = (pts) => new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
        const outerShape = toShape(bay.outer);
        const glassGeo = new THREE.ShapeGeometry(outerShape, 1);
        const pos = glassGeo.attributes.position;
        const uv = glassGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * sx + 0.5, pos.getY(i) * sy);

        // Beam shaft: a ribbon along each opening's outline.
        const P = [], C = [], E = [];
        bay.holes.forEach((h, k) => {
            const col = bay.openings[k].color || [1, 0.7, 0.3];
            let cx = 0, cy = 0;
            for (const p of h) { cx += p[0]; cy += p[1]; }
            cx /= h.length; cy /= h.length;
            for (const sc of [1, 0.55]) {
                for (let i = 0; i < h.length; i++) {
                    const a = h[i], b = h[(i + 1) % h.length];
                    const A = [cx + (a[0] - cx) * sc, cy + (a[1] - cy) * sc];
                    const B = [cx + (b[0] - cx) * sc, cy + (b[1] - cy) * sc];
                    const v = [[A, 0], [B, 0], [B, 1], [A, 0], [B, 1], [A, 1]];
                    for (const [pt, e] of v) { P.push(pt[0], pt[1], 0); C.push(col[0], col[1], col[2]); E.push(e); }
                }
            }
        });
        const bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        bg.setAttribute('col', new THREE.Float32BufferAttribute(C, 3));
        bg.setAttribute('endv', new THREE.Float32BufferAttribute(E, 1));

        // No wall: only a thin dark lead rim around each opening.
        const stone = new THREE.Group();
        // Soft colored halo on both faces: the glass glowing into the air.
        const haloTex = new THREE.CanvasTexture(bay.halo);
        const hm = new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
        const hg = new THREE.PlaneGeometry(bay.hw * 2 * bay.pad, bay.top * bay.pad);
        for (const z of [-0.012]) {
            const hp = new THREE.Mesh(hg, hm);
            hp.position.set(0, bay.top / 2, z);
            hp.renderOrder = 1;
            stone.add(hp);
        }
        const glass = new THREE.Mesh(glassGeo, glassMat.clone());
        glass.material.uniforms.atlas = { value: atlasTex };
        glass.material.uniforms.uvm = { value: uvm };
        glass.material.uniforms.camPos = glassMat.uniforms.camPos;
        glass.material.uniforms.L = glassMat.uniforms.L;
        const g = new THREE.Group();
        g.add(stone, glass);
        g.visible = false;
        group.add(g);
        return { meta, bay, g, atlasTex, blurTex, maskTex, uvm, beamGeo: bg };
    });

    let index = 0;
    function show(i) {
        wins.forEach((w, k) => { w.g.visible = k === i; });
        const w = wins[i];
        floorMat.uniforms.atlas.value = w.blurTex;
        floorMat.uniforms.mask.value = w.maskTex;
        floorMat.uniforms.uvm.value = w.uvm;
        beam.geometry = w.beamGeo;
    }
    show(0);

    // View state.
    let yaw = qs.has('yaw') ? parseFloat(qs.get('yaw')) : 0.6;
    let pitch = qs.has('pitch') ? parseFloat(qs.get('pitch')) : 0.32;
    let vyaw = 0, vpitch = 0;
    let sway = qs.has('yaw') ? 0 : 1;
    let drag = null;
    let trans = null;
    let lastTouch = -1e9;
    let spin = 0;
    const born = performance.now();
    let lastT = born;
    let raf = 0;
    let W = 1, H = 1;

    function layout() {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderer.setPixelRatio(dpr);
        W = Math.max(1, Math.round(r.width));
        H = Math.max(1, Math.round(r.height));
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        const phone = coarse || W < 700;
        if (!drag) {
            if (phone && !reduceMotion && !qs.has('yaw') && now - lastTouch > 2200) {
                const k = Math.min(1, (now - lastTouch - 2200) / 1500);
                yaw += 0.2 * dt * k;
            }
            yaw += vyaw * dt;
            pitch += vpitch * dt;
            const k = Math.pow(0.04, dt);
            vyaw *= k; vpitch *= k;
            if (Math.abs(vyaw) < 0.002) vyaw = 0;
            if (Math.abs(vpitch) < 0.002) vpitch = 0;
        }
        pitch = Math.max(0.04, Math.min(0.8, pitch));
        const sw = reduceMotion ? 0 : Math.sin((now - born) * 0.00035) * 0.16 * sway;
        let amp = 1, extra = 0, scl = 1;
        if (trans) {
            const p = Math.min(1, (now - trans.t0) / 900);
            const e = ease(p);
            if (p >= 0.5 && !trans.swapped) { trans.swapped = true; index = trans.to; show(index); onIndex(index); }
            scl = Math.abs(1 - 2 * e) * 0.6 + 0.4 * (p > 0.5 ? 1 : 1);
            scl = Math.max(0.001, Math.abs(1 - 2 * e));
            amp = scl * scl;
            extra = (p < 0.5 ? -1 : 1) * (1 - Math.abs(1 - 2 * e)) * 0 + trans.dir * e * Math.PI * 0.8;
            if (p >= 1) { trans = null; yaw += extra; extra = 0; scl = 1; amp = 1; }
        }
        const Y = yaw + sw + extra;
        // Warm to cool follows the turn angle only, nothing else.
        SW.value = 0.5 - 0.5 * Math.cos(0.9 * Y);
        group.rotation.y = Y;
        group.scale.setScalar(scl);
        group.position.y = LIFT + (1 - scl) * 0.5;
        floorMat.uniforms.yaw.value = Y;
        floorMat.uniforms.amp.value = amp;
        beamMat.uniforms.yaw.value = Y;
        beamMat.uniforms.amp.value = amp;

        // Camera fits the window and its pool, on any shape of screen.
        const aspect = W / H;
        const d = Math.max(2.4 / 0.497, 1.0 / (0.497 * aspect));
        const target = new THREE.Vector3(-0.02, 0.62, 0.15);
        camera.position.set(target.x, target.y + Math.sin(pitch) * d, target.z + Math.cos(pitch) * d);
        camera.lookAt(target);
        renderer.render(scene, camera);
    }

    // Input: drag spins the pane, with inertia.
    function down(e) {
        drag = { x: e.clientX, y: e.clientY, t: performance.now() };
        lastTouch = performance.now();
        vyaw = 0; vpitch = 0; sway = 0;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    function move(e) {
        if (!drag) return;
        const now = performance.now();
        const dt = Math.max(0.008, (now - drag.t) / 1000);
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
        const dyaw = dx * 0.0085, dpitch = dy * 0.005;
        yaw += dyaw; pitch += dpitch;
        vyaw = 0.7 * vyaw + 0.3 * (dyaw / dt);
        vpitch = 0.7 * vpitch + 0.3 * (dpitch / dt);
    }
    function up() {
        if (!drag) return;
        if (performance.now() - drag.t > 90) { vyaw = 0; vpitch = 0; }
        drag = null;
        lastTouch = performance.now();
    }
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.style.touchAction = 'none';
    const onKey = (e) => {
        if (e.key === 'ArrowRight') go(index + 1, 1);
        else if (e.key === 'ArrowLeft') go(index - 1, -1);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', layout);

    function go(i, dir) {
        const n = wins.length;
        i = ((i % n) + n) % n;
        if (trans || i === index) return;
        trans = { to: i, dir: dir || 1, t0: performance.now(), swapped: false };
    }

    layout();
    raf = requestAnimationFrame(frame);

    return {
        goTo: (i) => go(i, i > index ? 1 : -1),
        next: () => go(index + 1, 1),
        count: wins.length,
        names: WINDOWS_META.map((w) => w.name),
        get index() { return index; },
        destroy() {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', layout);
            window.removeEventListener('keydown', onKey);
        },
    };
}
