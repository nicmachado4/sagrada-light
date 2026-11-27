// The floating windows: one stained-glass window on a white ground, its
// light pooling below and its reflection fading under it. Swipe to change
// windows. No room, no clock, no chrome.

import { makeGlassCanvas, makeRoseCanvas, makeBlurredCanvas, averageColor, edgeColors } from './glass.js';

export const WINDOWS_META = [
    { key: 'nativity', name: 'Nativity', kind: 'arch', palette: 'cool', seed: 7 },
    { key: 'passion', name: 'Passion', kind: 'arch', palette: 'warm', seed: 21 },
    { key: 'apse', name: 'Apse', kind: 'arch', palette: 'apse', seed: 33 },
    { key: 'rose', name: 'Resurrection rose', kind: 'rose', seed: 51 },
    { key: 'whites', name: 'The sixteen whites', kind: 'arch', palette: 'whites', seed: 47, prism: true },
];

const TAU = Math.PI * 2;

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerp3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function rgba(c, a) {
    return `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;
}
// Push a color toward full saturation and brightness, for light made of it.
function vivid(c, sat = 1.5, lift = 1.12) {
    const m = (c[0] + c[1] + c[2]) / 3;
    return [
        Math.min(1, (m + (c[0] - m) * sat) * lift),
        Math.min(1, (m + (c[1] - m) * sat) * lift),
        Math.min(1, (m + (c[2] - m) * sat) * lift),
    ];
}

export function buildWindow(meta) {
    let tex;
    let aspect;
    if (meta.kind === 'rose') {
        tex = makeRoseCanvas(640, meta.seed);
        aspect = 1;
    } else {
        tex = makeGlassCanvas(512, 1024, meta.seed, meta.palette);
        aspect = 0.5;
    }
    const blur = makeBlurredCanvas(tex, meta.kind === 'rose' ? 80 : 72, meta.kind === 'rose' ? 80 : 144);
    const avg = averageColor(tex);
    const edges = edgeColors(tex);
    const bottom = vivid(edges[0], meta.prism ? 1.1 : 1.6, meta.prism ? 1.0 : 1.15);
    const glow = vivid(avg, meta.prism ? 1.05 : 1.35, 1.2);

    // Pre-lit glass: a backlight gradient screened onto the shards, clipped
    // to the glass shape, so the window reads lit from behind on white.
    const lit = document.createElement('canvas');
    lit.width = tex.width;
    lit.height = tex.height;
    const lctx = lit.getContext('2d');
    lctx.drawImage(tex, 0, 0);
    lctx.globalCompositeOperation = 'source-atop';
    const back = lctx.createRadialGradient(
        lit.width / 2, lit.height * 0.62, lit.width * 0.05,
        lit.width / 2, lit.height * 0.62, lit.height * 0.62,
    );
    back.addColorStop(0, 'rgba(255,246,224,0.34)');
    back.addColorStop(0.5, 'rgba(255,244,222,0.12)');
    back.addColorStop(1, 'rgba(255,244,222,0)');
    lctx.fillStyle = back;
    lctx.fillRect(0, 0, lit.width, lit.height);
    lctx.globalCompositeOperation = 'source-over';

    // Reflection sprite: flipped, squashed, blurred, fading out.
    const reflH = Math.round(tex.height * 0.5);
    const refl = document.createElement('canvas');
    refl.width = tex.width;
    refl.height = reflH;
    const rctx = refl.getContext('2d');
    rctx.save();
    rctx.translate(0, reflH);
    rctx.scale(1, -reflH / tex.height);
    rctx.drawImage(blur, 0, 0, tex.width, tex.height);
    rctx.restore();
    rctx.globalCompositeOperation = 'destination-in';
    const fade = rctx.createLinearGradient(0, 0, 0, reflH);
    fade.addColorStop(0, 'rgba(0,0,0,0.55)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = fade;
    rctx.fillRect(0, 0, refl.width, refl.height);

    return { meta, tex, lit, blur, refl, aspect, avg, bottom, glow };
}

export function startFloating(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const onIndex = opts.onIndex || (() => {});
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const windows = WINDOWS_META.map(buildWindow);
    let W = 0;
    let H = 0;
    let dpr = 1;

    let index = 0;
    // Transition state: -1 idle, else 0..1 progress.
    let trans = null; // { from, to, dir, t0, dur }
    let drag = null; // { x0, dx, t0, lastX, lastT, v }
    let snapBack = null; // { from, t0, dur }
    const born = performance.now();

    // Dust motes, positioned in the cone under the window each frame.
    const motes = [];
    {
        let s = 11;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < 34; i++) {
            motes.push({
                u: rnd(), v: rnd(),
                r: 0.7 + rnd() * 1.5,
                ph: rnd() * TAU,
                sp: 0.3 + rnd() * 0.7,
                drift: (rnd() - 0.5) * 0.4,
            });
        }
    }

    function layout() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(2, window.devicePixelRatio || 1);
        W = Math.max(1, Math.round(rect.width * dpr));
        H = Math.max(1, Math.round(rect.height * dpr));
        if (canvas.width !== W || canvas.height !== H) {
            canvas.width = W;
            canvas.height = H;
        }
    }

    function windowRect(win) {
        // The window floats centered, a touch above the middle. In a framed
        // host (the File viewer's header eats the top), raise and shrink it.
        const compact = !!opts.compact;
        const wide = W / H > 1.15; // desktop-shaped viewport: let the window breathe
        let h;
        if (win.meta.kind === 'rose') {
            h = Math.min(H * (compact ? 0.40 : wide ? 0.58 : 0.52), W * 0.86);
        } else {
            h = Math.min(H * (compact ? 0.48 : wide ? 0.68 : 0.60), W * 1.7);
        }
        const w = h * win.aspect;
        const x = (W - w) / 2;
        const phone = !wide && W / dpr <= 600;
        const y = H * (compact ? 0.42 : wide ? 0.45 : phone ? 0.45 : 0.5) - h * 0.56;
        return { x, y, w, h };
    }

    function drawPool(win, cx, floorY, spreadW, alpha, poolColor, t) {
        const poolH = Math.min(H * 0.17, spreadW * 0.34);
        const cy = floorY + poolH * 0.62;
        const shimmer = reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(t * 0.00055);
        const c = poolColor;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, poolH / (spreadW * 0.5));
        const layers = [
            { r: 1.15, a: 0.10 },
            { r: 0.85, a: 0.16 },
            { r: 0.55, a: 0.22 },
        ];
        for (const L of layers) {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, spreadW * 0.5 * L.r);
            g.addColorStop(0, rgba(c, L.a * alpha * shimmer));
            g.addColorStop(0.7, rgba(c, L.a * 0.5 * alpha * shimmer));
            g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, spreadW * 0.5 * L.r, 0, TAU);
            ctx.fill();
        }
        ctx.restore();

        if (win.meta.prism) {
            // The clear windows split the sun: a faint spectrum in the pool.
            const g = ctx.createLinearGradient(cx - spreadW * 0.5, 0, cx + spreadW * 0.5, 0);
            const cols = ['255,80,60', '255,190,40', '90,200,90', '60,120,235', '150,90,220'];
            cols.forEach((col, i) => {
                g.addColorStop(i / (cols.length - 1), `rgba(${col},${0.14 * alpha * shimmer})`);
            });
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(1, poolH / (spreadW * 0.5));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, spreadW * 0.42, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
    }

    function drawBeams(rect, color, alpha) {
        // Two soft shafts from the window's lower corners into the pool.
        const spread = rect.w * 1.7;
        const floorY = rect.y + rect.h;
        for (const side of [-1, 1]) {
            const x0 = rect.x + rect.w / 2 + side * rect.w * 0.28;
            const x1 = rect.x + rect.w / 2 + side * spread * 0.52;
            const g = ctx.createLinearGradient(0, rect.y + rect.h * 0.35, 0, floorY + rect.h * 0.28);
            g.addColorStop(0, rgba(color, 0));
            g.addColorStop(0.55, rgba(color, 0.05 * alpha));
            g.addColorStop(1, rgba(color, 0.09 * alpha));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(x0 - rect.w * 0.1, rect.y + rect.h * 0.3);
            ctx.lineTo(x0 + rect.w * 0.1, rect.y + rect.h * 0.3);
            ctx.lineTo(x1 + spread * 0.16, floorY + rect.h * 0.3);
            ctx.lineTo(x1 - spread * 0.16, floorY + rect.h * 0.3);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawWindow(win, rect, alpha, t, reveal) {
        if (alpha <= 0.002) return;
        const floatY = reduceMotion ? 0 : Math.sin(t * 0.0009) * H * 0.006;
        const breathe = reduceMotion ? 1 : 1 + 0.08 * Math.sin(t * 0.0012 + 1.7);
        const y = rect.y + floatY + (1 - reveal) * H * 0.04;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Halo: the glow the glass throws into the air around it.
        const glowPad = rect.w * 0.55;
        const g = ctx.createRadialGradient(
            rect.x + rect.w / 2, y + rect.h * 0.55, rect.w * 0.1,
            rect.x + rect.w / 2, y + rect.h * 0.55, rect.w * 1.05,
        );
        g.addColorStop(0, rgba(win.glow, 0.20 * breathe));
        g.addColorStop(0.55, rgba(win.glow, 0.08 * breathe));
        g.addColorStop(1, rgba(win.glow, 0));
        ctx.fillStyle = g;
        ctx.fillRect(rect.x - glowPad, y - glowPad, rect.w + glowPad * 2, rect.h + glowPad * 2);

        // Reflection under the glass.
        const reflH = rect.h * 0.42;
        ctx.globalAlpha = alpha * 0.5;
        ctx.drawImage(win.refl, rect.x, y + rect.h + H * 0.006, rect.w, reflH);
        ctx.globalAlpha = alpha;

        // The lit glass.
        ctx.drawImage(win.lit, rect.x, y, rect.w, rect.h);

        // A slow band of sun crossing the shards.
        if (!reduceMotion) {
            const sweep = ((t * 0.000045) % 1.6) - 0.3;
            const bx = rect.x + rect.w * (sweep * 2 - 0.5);
            ctx.save();
            ctx.beginPath();
            if (win.meta.kind === 'rose') {
                ctx.arc(rect.x + rect.w / 2, y + rect.h / 2, rect.w / 2, 0, TAU);
            } else {
                const archY = y + rect.h * 0.22;
                ctx.moveTo(rect.x, y + rect.h);
                ctx.lineTo(rect.x, archY);
                ctx.quadraticCurveTo(rect.x, y + rect.h * 0.026, rect.x + rect.w / 2, y);
                ctx.quadraticCurveTo(rect.x + rect.w, y + rect.h * 0.026, rect.x + rect.w, archY);
                ctx.lineTo(rect.x + rect.w, y + rect.h);
                ctx.closePath();
            }
            ctx.clip();
            const band = ctx.createLinearGradient(bx - rect.w * 0.35, 0, bx + rect.w * 0.35, 0);
            band.addColorStop(0, 'rgba(255,250,235,0)');
            band.addColorStop(0.5, 'rgba(255,250,235,0.13)');
            band.addColorStop(1, 'rgba(255,250,235,0)');
            ctx.fillStyle = band;
            ctx.fillRect(rect.x, y, rect.w, rect.h);
            ctx.restore();
        }
        ctx.restore();
    }

    let raf = 0;
    let destroyed = false;

    function frame(now) {
        if (destroyed) return;
        layout();
        const t = now;
        const reveal = easeOutQuart(Math.min(1, (now - born) / 1200));

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Resolve positions: idle, mid-transition, or mid-drag.
        let drawList; // [{win, dx, alpha}]
        let poolA = windows[index];
        let poolB = null;
        let poolMix = 0;

        if (trans) {
            const p = Math.min(1, (now - trans.t0) / trans.dur);
            const e = easeInOutCubic(p);
            const spacing = W * 0.9;
            drawList = [
                { win: windows[trans.from], dx: -trans.dir * e * spacing, alpha: 1 - e },
                { win: windows[trans.to], dx: trans.dir * (1 - e) * spacing, alpha: e },
            ];
            poolA = windows[trans.from];
            poolB = windows[trans.to];
            poolMix = e;
            if (p >= 1) {
                index = trans.to;
                trans = null;
                onIndex(index);
            }
        } else if (drag) {
            const dx = drag.dx;
            const dir = dx < 0 ? 1 : -1;
            const ni = (index + dir + windows.length) % windows.length;
            const f = Math.min(1, Math.abs(dx) / (W * 0.55));
            drawList = [
                { win: windows[index], dx, alpha: 1 },
                { win: windows[ni], dx: dx + dir * W * 0.9, alpha: Math.min(1, f * 1.4) },
            ];
            poolA = windows[index];
            poolB = windows[ni];
            poolMix = f * 0.7;
        } else if (snapBack) {
            const p = Math.min(1, (now - snapBack.t0) / snapBack.dur);
            const e = easeOutQuart(p);
            const dx = snapBack.from * (1 - e);
            drawList = [{ win: windows[index], dx, alpha: 1 }];
            if (p >= 1) snapBack = null;
        } else {
            drawList = [{ win: windows[index], dx: 0, alpha: 1 }];
        }

        // Light first, glass over it.
        for (const d of drawList) {
            const rect = windowRect(d.win);
            const r = { ...rect, x: rect.x + d.dx };
            const a = d.alpha * reveal;
            const floorY = rect.y + rect.h + H * 0.006;
            let color = d.win.bottom;
            if (poolB) {
                const own = d.win === poolA ? poolA : poolB;
                color = own.bottom;
            }
            drawBeams(r, color, a);
            drawPool(d.win, r.x + r.w / 2, floorY, Math.max(r.w * 1.5, W * 0.5), a, color, t);
        }
        for (const d of drawList) {
            const rect = windowRect(d.win);
            drawWindow(d.win, { ...rect, x: rect.x + d.dx }, d.alpha * reveal, t, reveal);
        }

        // Dust in the light.
        if (!reduceMotion) {
            const rect = windowRect(windows[index]);
            const cx = rect.x + rect.w / 2;
            const top = rect.y + rect.h * 0.25;
            const span = rect.h * 1.05;
            ctx.save();
            for (const m of motes) {
                const yy = top + ((m.v + t * 0.000008 * m.sp) % 1) * span;
                const widen = 0.35 + 0.65 * ((yy - top) / span);
                const xx = cx + (m.u - 0.5) * rect.w * 2.4 * widen + Math.sin(t * 0.0003 * m.sp + m.ph) * W * 0.008 * (1 + m.drift);
                const tw = 0.5 + 0.5 * Math.sin(t * 0.001 * m.sp + m.ph * 3);
                ctx.fillStyle = `rgba(196,172,120,${(0.10 + 0.22 * tw) * reveal})`;
                ctx.beginPath();
                ctx.arc(xx, yy, m.r * dpr, 0, TAU);
                ctx.fill();
            }
            ctx.restore();
        }

        raf = requestAnimationFrame(frame);
    }

    function go(to, dir) {
        if (trans) return;
        const target = ((to % windows.length) + windows.length) % windows.length;
        if (target === index) return;
        trans = { from: index, to: target, dir: dir || (target > index ? 1 : -1), t0: performance.now(), dur: reduceMotion ? 250 : 620 };
    }

    function onDown(e) {
        if (trans) return;
        const x = e.clientX;
        drag = { x0: x, dx: 0, lastX: x, lastT: performance.now(), v: 0, moved: false };
        snapBack = null;
    }
    function onMove(e) {
        if (!drag) return;
        const x = e.clientX;
        const nowT = performance.now();
        const dt = Math.max(1, nowT - drag.lastT);
        drag.v = 0.8 * drag.v + 0.2 * ((x - drag.lastX) / dt);
        drag.lastX = x;
        drag.lastT = nowT;
        drag.dx = x - drag.x0;
        if (Math.abs(drag.dx) > 6) drag.moved = true;
    }
    let suppressClick = false;
    function onUp() {
        if (!drag) return;
        const dx = drag.dx;
        const v = drag.v;
        suppressClick = drag.moved;
        const threshold = Math.min(140, (W / dpr) * 0.22);
        const dir = dx < 0 ? 1 : -1;
        if (Math.abs(dx) > threshold || Math.abs(v) > 0.55) {
            const ni = (index + dir + windows.length) % windows.length;
            // Fling: treat the release point as the start of the transition.
            drag = null;
            go(ni, dir);
        } else {
            snapBack = { from: dx, t0: performance.now(), dur: 380 };
            drag = null;
        }
    }
    function onKey(e) {
        if (e.key === 'ArrowRight') go(index + 1, 1);
        else if (e.key === 'ArrowLeft') go(index - 1, -1);
    }
    function onClick(e) {
        if (suppressClick) { suppressClick = false; return; }
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width * 0.18) go(index - 1, -1);
        else if (x > rect.width * 0.82) go(index + 1, 1);
    }

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    canvas.addEventListener('click', onClick);

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
            canvas.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('keydown', onKey);
            canvas.removeEventListener('click', onClick);
        },
    };
}
