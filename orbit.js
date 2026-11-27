// Sagrada light, in 3D: one stained-glass window as a real thin pane with
// thickness, floating over a white ground. Drag to orbit it (with inertia):
// its colored light pools on the floor and its reflection moves with you.
// Plain WebGL, no dependencies. Returns null when WebGL is missing.

import { WINDOWS_META, buildWindow } from './floating.js';

const VS_PANE = `
attribute vec3 p; attribute vec3 n; attribute vec2 uv;
uniform mat4 vp; uniform float yawOff; uniform float bob; uniform float mirror;
varying vec2 vUV; varying vec3 vN; varying vec3 vW;
void main(){
  float c = cos(yawOff), s = sin(yawOff);
  vec3 q = vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
  vec3 m = vec3(c*n.x + s*n.z, n.y, -s*n.x + c*n.z);
  q.y += bob;
  if (mirror > 0.5) { q.y = -q.y; m.y = -m.y; }
  vW = q; vN = m; vUV = uv;
  gl_Position = vp * vec4(q, 1.0);
}`;
const FS_PANE = `
precision mediump float;
uniform sampler2D tex; uniform vec3 cam; uniform float alpha; uniform float mode; uniform float sweep;
varying vec2 vUV; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 V = normalize(cam - vW);
  vec3 N = normalize(vN);
  float facing = abs(dot(N, V));
  if (mode < 0.5) {
    vec4 c = texture2D(tex, vUV);
    if (c.a < 0.03) discard;
    vec3 col = c.rgb * (0.95 + 0.12 * facing);
    float band = exp(-pow((vUV.x - sweep) / 0.16, 2.0));
    col += vec3(1.0, 0.97, 0.9) * 0.10 * band;
    col = mix(col, vec3(1.0), 0.05);
    gl_FragColor = vec4(col, c.a * alpha);
  } else if (mode < 1.5) {
    float l = 0.78 + 0.22 * dot(N, normalize(vec3(0.3, 0.6, 0.7)));
    gl_FragColor = vec4(vec3(0.60, 0.60, 0.62) * l, alpha);
  } else {
    vec4 c = texture2D(tex, vUV);
    float fade = clamp(1.0 - (-vW.y) / 0.55, 0.0, 1.0);
    gl_FragColor = vec4(c.rgb, c.a * alpha * 0.34 * fade * fade);
  }
}`;
const VS_FLOOR = `
attribute vec3 p; uniform mat4 vp; varying vec3 vW;
void main(){ vW = p; gl_Position = vp * vec4(p, 1.0); }`;
const FS_POOL = `
precision mediump float;
uniform sampler2D tex; uniform float alpha; uniform float hwN; uniform float len; uniform float yawOff;
varying vec3 vW;
void main(){
  float c = cos(yawOff), s = sin(yawOff);
  vec3 w = vec3(c*vW.x - s*vW.z, vW.y, s*vW.x + c*vW.z);
  float t = w.z / len;
  if (t < 0.0 || t > 1.0) discard;
  float hw = hwN * (1.0 + t * 1.25);
  float u = w.x / (2.0 * hw) + 0.5;
  if (u < 0.0 || u > 1.0) discard;
  vec4 c4 = texture2D(tex, vec2(u, 1.0 - t));
  float m = dot(c4.rgb, vec3(0.333));
  vec3 col = clamp(mix(vec3(m), c4.rgb, 1.6), 0.0, 1.0);
  float sf = smoothstep(0.0, 0.16, u) * smoothstep(0.0, 0.16, 1.0 - u);
  float fz = smoothstep(0.0, 0.10, t) * (1.0 - smoothstep(0.55, 1.0, t));
  gl_FragColor = vec4(col, c4.a * alpha * 0.42 * sf * fz);
}`;
const VS_QUAD = `attribute vec2 p; varying vec2 vP; void main(){ vP = p; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS_GLOW = `
precision mediump float;
uniform vec2 ctr; uniform float r; uniform float asp; uniform vec3 col; uniform float a;
varying vec2 vP;
void main(){
  vec2 d = vP - ctr; d.x *= asp;
  float k = length(d) / r;
  float g = exp(-k * k * 1.6);
  gl_FragColor = vec4(col, a * g);
}`;

function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
}
function program(gl, vs, fs) {
    const pr = gl.createProgram();
    gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    const info = { pr, a: {}, u: {} };
    const na = gl.getProgramParameter(pr, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) { const x = gl.getActiveAttrib(pr, i); info.a[x.name] = gl.getAttribLocation(pr, x.name); }
    const nu = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const x = gl.getActiveUniform(pr, i); info.u[x.name] = gl.getUniformLocation(pr, x.name); }
    return info;
}

// --- tiny matrix helpers (column-major) ---
function perspective(fovy, asp, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function lookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}
function mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
}

// Outline of a window in (x, y), y from 0 (bottom) to 1 (top), counter-clockwise.
function outline(kind, aspect) {
    const pts = [];
    const hw = aspect / 2;
    if (kind === 'rose') {
        for (let i = 0; i < 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            pts.push([Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]);
        }
        return pts;
    }
    pts.push([-hw, 0], [hw, 0], [hw, 0.78]);
    const q = (p0, p1, p2, t) => [
        (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
        (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
    ];
    const N = 18;
    for (let i = 1; i <= N; i++) pts.push(q([hw, 0.78], [hw, 0.974], [0, 1], i / N));
    for (let i = 1; i < N; i++) pts.push(q([0, 1], [-hw, 0.974], [-hw, 0.78], i / N));
    pts.push([-hw, 0.78]);
    return pts;
}

function buildGeometry(gl, kind, aspect, depth) {
    const pts = outline(kind, aspect);
    const v = [];
    const push = (x, y, z, nx, ny, nz) => v.push(x, y, z, nx, ny, nz, x / aspect + 0.5, 1 - y);
    const cx = 0, cy = 0.5;
    const n = pts.length;
    const hd = depth / 2;
    // faces: front (z+) and back (z-)
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        push(cx, cy, hd, 0, 0, 1); push(a[0], a[1], hd, 0, 0, 1); push(b[0], b[1], hd, 0, 0, 1);
        push(cx, cy, -hd, 0, 0, -1); push(b[0], b[1], -hd, 0, 0, -1); push(a[0], a[1], -hd, 0, 0, -1);
    }
    const faceCount = v.length / 8;
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]);
        const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        push(a[0], a[1], hd, nx, ny, 0); push(b[0], b[1], hd, nx, ny, 0); push(b[0], b[1], -hd, nx, ny, 0);
        push(a[0], a[1], hd, nx, ny, 0); push(b[0], b[1], -hd, nx, ny, 0); push(a[0], a[1], -hd, nx, ny, 0);
    }
    const total = v.length / 8;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    return { buf, faceCount, total };
}

function makeTexture(gl, canvas) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
}

const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function startOrbit(canvas, opts = {}) {
    let gl;
    try {
        gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false })
            || canvas.getContext('experimental-webgl', { alpha: false, antialias: true });
    } catch (e) { gl = null; }
    if (!gl) return null;
    let progs;
    try {
        progs = {
            pane: program(gl, VS_PANE, FS_PANE),
            pool: program(gl, VS_FLOOR, FS_POOL),
            glow: program(gl, VS_QUAD, FS_GLOW),
        };
    } catch (e) { console.error(e); return null; }

    const onIndex = opts.onIndex || (() => {});
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const DEPTH = 0.05;

    const windows = WINDOWS_META.map((meta) => {
        const w = buildWindow(meta);
        w.texLit = makeTexture(gl, w.lit);
        w.texBlur = makeTexture(gl, w.blur);
        w.geo = buildGeometry(gl, meta.kind, w.aspect, DEPTH);
        return w;
    });
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    // Floor patch the light lands on (large enough to cover any yaw).
    const floorBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, floorBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-3, 0, -3, 3, 0, -3, -3, 0, 3, 3, 0, 3]), gl.STATIC_DRAW);

    // View state.
    const qs = new URLSearchParams(location.search);
    let yaw = qs.has('yaw') ? parseFloat(qs.get('yaw')) : 0.55;
    let pitch = qs.has('pitch') ? parseFloat(qs.get('pitch')) : 0.2;
    let vyaw = 0;
    let vpitch = 0;
    let sway = qs.has('yaw') ? 0 : 1; // idle sway fades once he touches it
    let drag = null;
    let index = 0;
    let trans = null;
    const born = performance.now();
    let W = 1;
    let H = 1;
    let dpr = 1;
    let raf = 0;
    let destroyed = false;
    let lastT = born;
    let lastTouch = -1e9;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    function layout() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = Math.max(1, Math.round(rect.width * dpr));
        H = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    }

    function bindAttrib(info, name, size, stride, offset) {
        const loc = info.a[name];
        if (loc === undefined) return;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    }
    function resetAttribs() { for (let i = 0; i < 4; i++) gl.disableVertexAttribArray(i); }

    function drawPane(win, mode, vp, camPos, alpha, yawOff, bob, t) {
        const P = progs.pane;
        gl.useProgram(P.pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, win.geo.buf);
        resetAttribs();
        bindAttrib(P, 'p', 3, 32, 0);
        bindAttrib(P, 'n', 3, 32, 12);
        bindAttrib(P, 'uv', 2, 32, 24);
        gl.uniformMatrix4fv(P.u.vp, false, new Float32Array(vp));
        gl.uniform3f(P.u.cam, camPos[0], camPos[1], camPos[2]);
        gl.uniform1f(P.u.alpha, alpha);
        gl.uniform1f(P.u.yawOff, yawOff);
        gl.uniform1f(P.u.bob, bob);
        gl.uniform1f(P.u.sweep, reduceMotion ? -1 : ((t * 0.000045) % 1.6) - 0.3);
        gl.activeTexture(gl.TEXTURE0);
        if (mode === 2) {
            gl.bindTexture(gl.TEXTURE_2D, win.texBlur);
            gl.uniform1f(P.u.mirror, 1);
            gl.uniform1f(P.u.mode, 2);
            gl.drawArrays(gl.TRIANGLES, 0, win.geo.faceCount);
        } else {
            gl.bindTexture(gl.TEXTURE_2D, win.texLit);
            gl.uniform1f(P.u.mirror, 0);
            gl.uniform1f(P.u.mode, 1);
            gl.drawArrays(gl.TRIANGLES, win.geo.faceCount, win.geo.total - win.geo.faceCount);
            gl.uniform1f(P.u.mode, 0);
            gl.drawArrays(gl.TRIANGLES, 0, win.geo.faceCount);
        }
    }

    function drawPool(win, vp, alpha, yawOff) {
        const P = progs.pool;
        gl.useProgram(P.pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, floorBuf);
        resetAttribs();
        bindAttrib(P, 'p', 3, 12, 0);
        gl.uniformMatrix4fv(P.u.vp, false, new Float32Array(vp));
        gl.uniform1f(P.u.alpha, alpha);
        gl.uniform1f(P.u.hwN, win.aspect * 0.5);
        gl.uniform1f(P.u.len, 1.25);
        gl.uniform1f(P.u.yawOff, yawOff);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, win.texBlur);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function drawGlow(win, ctr, r, asp, alpha) {
        const P = progs.glow;
        gl.useProgram(P.pr);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        resetAttribs();
        bindAttrib(P, 'p', 2, 8, 0);
        gl.uniform2f(P.u.ctr, ctr[0], ctr[1]);
        gl.uniform1f(P.u.r, r);
        gl.uniform1f(P.u.asp, asp);
        gl.uniform3f(P.u.col, win.glow[0], win.glow[1], win.glow[2]);
        gl.uniform1f(P.u.a, alpha);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
        if (destroyed) return;
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;
        layout();

        // Phone: a slow auto-spin that resumes shortly after he lets go.
        const phoneMode = coarse || W / dpr <= 600;
        if (phoneMode && !reduceMotion && !drag && !qs.has('yaw') && now - lastTouch > 2200) {
            const k = Math.min(1, (now - lastTouch - 2200) / 1500);
            yaw += 0.2 * dt * k;
            sway = 0;
        }
        if (!drag) {
            yaw += vyaw * dt;
            pitch += vpitch * dt;
            const k = Math.exp(-dt * 2.6);
            vyaw *= k;
            vpitch *= k;
            if (Math.abs(vyaw) < 0.002) vyaw = 0;
            if (Math.abs(vpitch) < 0.002) vpitch = 0;
        }
        pitch = Math.max(0.05, Math.min(0.75, pitch));
        const swayYaw = reduceMotion ? 0 : Math.sin((now - born) * 0.00035) * 0.16 * sway;
        const swayPitch = reduceMotion ? 0 : Math.sin((now - born) * 0.00027 + 1) * 0.03 * sway;

        const aspect = W / H;
        const fov = (32 * Math.PI) / 180;
        const wide = aspect > 1.15;
        let dist = (wide ? 1.46 : 1.62) / (2 * Math.tan(fov / 2));
        if (!wide) dist = Math.max(dist, 0.86 / (2 * Math.tan(fov / 2) * aspect));
        const target = [0, wide ? 0.45 : 0.42, 0.1];
        const yw = yaw + swayYaw, pt = pitch + swayPitch;
        const cam = [
            target[0] + dist * Math.sin(yw) * Math.cos(pt),
            target[1] + dist * Math.sin(pt),
            target[2] + dist * Math.cos(yw) * Math.cos(pt),
        ];
        const vp = mul(perspective(fov, aspect, 0.1, 30), lookAt(cam, target, [0, 1, 0]));

        const reveal = easeOutQuart(Math.min(1, (now - born) / 1300));
        const t = now;
        const bob = reduceMotion ? 0 : Math.sin(t * 0.0009) * 0.006;
        const breathe = reduceMotion ? 1 : 1 + 0.08 * Math.sin(t * 0.0012 + 1.7);

        // Which windows are on stage.
        let list;
        if (trans) {
            const p = Math.min(1, (now - trans.t0) / trans.dur);
            const e = easeInOutCubic(p);
            list = [
                { win: windows[trans.from], a: 1 - e, off: -trans.dir * e * 0.55 },
                { win: windows[trans.to], a: e, off: trans.dir * (1 - e) * 0.55 },
            ];
            if (p >= 1) { index = trans.to; trans = null; onIndex(index); }
        } else {
            list = [{ win: windows[index], a: 1, off: 0 }];
        }

        gl.viewport(0, 0, W, H);
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);

        // Halo behind the glass, in screen space.
        gl.disable(gl.DEPTH_TEST);
        const pc = [vp[0] * 0 + vp[4] * 0.5 + vp[12], vp[1] * 0 + vp[5] * 0.5 + vp[13], 0, vp[3] * 0 + vp[7] * 0.5 + vp[15]];
        const ctr = [pc[0] / pc[3], pc[1] / pc[3]];
        const rNdc = (1.05 / (dist * Math.tan(fov / 2))) * 0.62;
        for (const d of list) drawGlow(d.win, ctr, rNdc, aspect, 0.09 * breathe * d.a * reveal);

        // Reflection, then the light on the floor.
        for (const d of list) drawPane(d.win, 2, vp, cam, d.a * reveal, d.off, bob + 0.012, t);
        for (const d of list) drawPool(d.win, vp, d.a * reveal * breathe, d.off);

        // The glass itself.
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        for (const d of list) drawPane(d.win, 0, vp, cam, d.a * reveal, d.off, bob + 0.012, t);

        raf = requestAnimationFrame(frame);
    }

    function go(to, dir) {
        if (trans) return;
        const target = ((to % windows.length) + windows.length) % windows.length;
        if (target === index) return;
        trans = { from: index, to: target, dir: dir || (target > index ? 1 : -1), t0: performance.now(), dur: reduceMotion ? 250 : 700 };
    }

    function onDown(e) {
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
        vyaw = 0;
        vpitch = 0;
        lastTouch = performance.now();
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        // He is steering: bake the sway into the view and stop it.
        yaw += reduceMotion ? 0 : Math.sin((performance.now() - born) * 0.00035) * 0.16 * sway;
        sway = 0;
        canvas.classList.add('grabbing');
    }
    function onMove(e) {
        if (!drag || e.pointerId !== drag.id) return;
        const now = performance.now();
        const dt = Math.max(1, now - drag.t) / 1000;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        const dyaw = -dx * 0.0085, dpitch = dy * 0.005;
        yaw += dyaw;
        pitch += dpitch;
        vyaw = 0.7 * vyaw + 0.3 * (dyaw / dt);
        vpitch = 0.7 * vpitch + 0.3 * (dpitch / dt);
        drag.x = e.clientX;
        drag.y = e.clientY;
        drag.t = now;
    }
    function onUp(e) {
        if (!drag || (e && e.pointerId !== drag.id)) return;
        // A long pause before release means no fling.
        if (performance.now() - drag.t > 90) { vyaw = 0; vpitch = 0; }
        drag = null;
        lastTouch = performance.now();
        canvas.classList.remove('grabbing');
    }
    function onKey(e) {
        if (e.key === 'ArrowRight') go(index + 1, 1);
        else if (e.key === 'ArrowLeft') go(index - 1, -1);
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);

    raf = requestAnimationFrame(frame);

    return {
        next: () => go(index + 1, 1),
        prev: () => go(index - 1, -1),
        goTo: (i) => go(i, i > index ? 1 : -1),
        index: () => index,
        count: windows.length,
        names: WINDOWS_META.map((w) => w.name),
        destroy: () => {
            destroyed = true;
            cancelAnimationFrame(raf);
            window.removeEventListener('keydown', onKey);
        },
    };
}
