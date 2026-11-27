// A real Sagrada Familia window bay, after Joan Vila-Grau's nave windows:
// a stone tracery wall with three tall pointed lancets above, a row of
// round oculi (two tiny ones between), and three lancets below. The glass in
// each opening is leaded in large angular shards with long streaks of light
// glass running through darker color, as in the photographs.
// Pure canvas + geometry data; the 3D scene lives in scene3.js.

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function clipPoly(poly, a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const side = (p) => (p.x - mx) * dx + (p.y - my) * dy;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const sp = side(p), sq = side(q);
        if (sp <= 0) out.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
            const t = sp / (sp - sq);
            out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
    }
    return out;
}

function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function css(c, f = 1) {
    return `rgb(${Math.max(0, Math.min(255, Math.round(c[0] * f)))},${Math.max(0, Math.min(255, Math.round(c[1] * f)))},${Math.max(0, Math.min(255, Math.round(c[2] * f)))})`;
}

const PALETTES = {
    // Passion side: whites and yellows streaking through orange, red and pink.
    warm: {
        streak: ['#fff7dc', '#fff1b0', '#ffe676', '#fffbe9'],
        mid: ['#ffc93c', '#ffab22', '#ff9420', '#ffd24f'],
        far: ['#ff5a1f', '#e8341f', '#d4202c', '#f4506a', '#ff7b3a', '#e9442a'],
        accent: ['#2fb3c9', '#3a72d8', '#6cc47a'],
    },
    // Nativity side: pale cyan streaks through turquoise, blue and green.
    cool: {
        streak: ['#f4fcff', '#cdf3ff', '#aef2e6', '#e6fbff'],
        mid: ['#53d9e8', '#2cbad9', '#38d6a8', '#6fe0d0'],
        far: ['#1d6fe0', '#1a50c6', '#2b8d5b', '#19a98b', '#2040aa', '#47c26a'],
        accent: ['#ffd44c', '#ff8b2b'],
    },
    // Apse: gold into leaf green.
    apse: {
        streak: ['#fff9df', '#fff3b3', '#fffbe8'],
        mid: ['#ffd23a', '#f4c232', '#ffe35a'],
        far: ['#74bb3b', '#34a058', '#ea9b20', '#9ccb45', '#2a9576'],
        accent: ['#d4412a', '#3a78d4'],
    },
    // The clear windows: many whites, a rare tint.
    whites: {
        streak: ['#ffffff', '#f7f6ef', '#fbfaf3'],
        mid: ['#eef1ec', '#e8eee9', '#f3f0e4'],
        far: ['#dfe7ea', '#e9e4d3', '#d8e3de', '#e4e8e2'],
        accent: ['#cfe3f2', '#f0dfae'],
    },
};

function pick(arr, rnd) { return hex(arr[Math.floor(rnd() * arr.length)]); }

// ---- opening outlines, in bay units (x centered, y from 0 up) ----
function lancetPts(x0, y0, w, h, n = 14) {
    const xc = x0 + w / 2;
    const arch = w * 0.95;
    const ys = y0 + h - arch;
    const pts = [[x0, y0], [x0 + w, y0], [x0 + w, ys]];
    const q = (p0, p1, p2, t) => [
        (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
        (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
    ];
    for (let i = 1; i <= n; i++) pts.push(q([x0 + w, ys], [x0 + w, ys + arch * 0.78], [xc, y0 + h], i / n));
    for (let i = 1; i < n; i++) pts.push(q([xc, y0 + h], [x0, ys + arch * 0.78], [x0, ys], i / n));
    pts.push([x0, ys]);
    return pts;
}
function circlePts(cx, cy, r, n = 36) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
}
function slabPts(hw, top, r, n = 8) {
    // Rounded-top slab, square at the foot, counter-clockwise.
    const pts = [[-hw, 0], [hw, 0], [hw, top - r]];
    for (let i = 1; i <= n; i++) {
        const a = (i / n) * Math.PI / 2;
        pts.push([hw - r + Math.cos(a) * r, top - r + Math.sin(a) * r]);
    }
    for (let i = 1; i <= n; i++) {
        const a = Math.PI / 2 + (i / n) * Math.PI / 2;
        pts.push([-hw + r + Math.cos(a) * r, top - r + Math.sin(a) * r]);
    }
    return pts;
}

// ---- shard painter ----
function paintOpening(ctx, toPx, pts, opts) {
    const { rnd, pal, stretch, shear, rmin, rmax, flow, lead } = opts;
    const px = pts.map((p) => toPx(p[0], p[1]));
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const p of px) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
    const bw = maxx - minx, bh = maxy - miny;
    const cxm = (minx + maxx) / 2, cym = (miny + maxy) / 2;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(px[0].x, px[0].y);
    for (let i = 1; i < px.length; i++) ctx.lineTo(px[i].x, px[i].y);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#1c1816';
    ctx.fillRect(minx - 4, miny - 4, bw + 8, bh + 8);

    // Seeds in a stretched space so shards run long in one direction.
    const seeds = [];
    const pad = rmax * 0.8;
    for (let i = 0; i < 9000 && seeds.length < 260; i++) {
        const x = minx - pad + rnd() * (bw + pad * 2);
        const y = (miny - pad + rnd() * (bh + pad * 2)) / stretch;
        const r = rmin + (rmax - rmin) * Math.pow(rnd(), 2.1);
        let ok = true;
        for (const s of seeds) {
            if (Math.hypot(s.x - x, s.y - y) < (s.r + r) * 0.6) { ok = false; break; }
        }
        if (ok) seeds.push({ x, y, r });
    }

    for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        const R = s.r * 2.4 + 20;
        let poly = [
            { x: s.x - R, y: s.y - R }, { x: s.x + R, y: s.y - R },
            { x: s.x + R, y: s.y + R }, { x: s.x - R, y: s.y + R },
        ];
        for (let j = 0; j < seeds.length; j++) {
            if (j === i) continue;
            const o = seeds[j];
            if (Math.abs(o.x - s.x) > R * 2 || Math.abs(o.y - s.y) > R * 2) continue;
            poly = clipPoly(poly, s, o);
            if (poly.length < 3) break;
        }
        if (poly.length < 3) continue;
        const q = poly.map((p) => {
            const y = p.y * stretch;
            return { x: p.x + (y - cym) * shear, y };
        });
        const sc = { x: s.x + (s.y * stretch - cym) * shear, y: s.y * stretch };

        // Which kind of glass: streak of light glass, mid, or deep color.
        const col = flow(sc.x, sc.y, cxm, cym, bw, bh, rnd, pal);
        const lum = 0.88 + rnd() * 0.38;
        let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
        for (const p of q) { mnx = Math.min(mnx, p.x); mny = Math.min(mny, p.y); mxx = Math.max(mxx, p.x); mxy = Math.max(mxy, p.y); }
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let k = 1; k < q.length; k++) ctx.lineTo(q[k].x, q[k].y);
        ctx.closePath();
        ctx.fillStyle = css(col, lum);
        ctx.fill();

        // Translucency: bright where light enters, deeper on the far side.
        const ang = rnd() * Math.PI * 2;
        const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
        const rr = Math.max(mxx - mnx, mxy - mny) * 0.6 + 1;
        const lg = ctx.createLinearGradient(cx - Math.cos(ang) * rr, cy - Math.sin(ang) * rr, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
        lg.addColorStop(0, 'rgba(255,255,255,0.16)');
        lg.addColorStop(0.55, 'rgba(255,255,255,0)');
        lg.addColorStop(1, 'rgba(0,0,0,0.20)');
        ctx.fillStyle = lg;
        ctx.fill();

        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = lead * 2.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(18,15,13,0.94)';
        ctx.lineWidth = lead;
        ctx.stroke();
    }

    // A couple of long armature bars across the opening.
    ctx.strokeStyle = 'rgba(16,14,12,0.9)';
    ctx.lineWidth = lead * 1.5;
    for (let i = 0; i < (opts.bars || 2); i++) {
        const y1 = miny + bh * (0.2 + rnd() * 0.6);
        const y2 = y1 + (rnd() - 0.5) * bh * 0.35;
        ctx.beginPath();
        ctx.moveTo(minx - 2, y1);
        ctx.lineTo(maxx + 2, y2);
        ctx.stroke();
    }
    ctx.restore();

    // Lead came around the opening.
    ctx.strokeStyle = '#100e0c';
    ctx.lineWidth = lead * 5;
    ctx.beginPath();
    ctx.moveTo(px[0].x, px[0].y);
    for (let i = 1; i < px.length; i++) ctx.lineTo(px[i].x, px[i].y);
    ctx.closePath();
    ctx.stroke();
}

function makeFlow(kind, rnd) {
    // Streak paths for a lancet; angular sectors for an oculus.
    const streaks = [];
    for (let i = 0; i < 2 + (rnd() < 0.5 ? 1 : 0); i++) streaks.push({ off: (rnd() - 0.5) * 0.6, amp: 0.12 + rnd() * 0.22, f: 0.6 + rnd() * 1.1, ph: rnd() * 6.28 });
    const ph = rnd() * 6.28;
    return (x, y, cx, cy, bw, bh, r, pal) => {
        let cls;
        if (kind === 'oculus') {
            const a = Math.atan2(y - cy, x - cx);
            const d = Math.sin(a * 2 + ph) * 0.5 + 0.5 + (r() - 0.5) * 0.5;
            cls = d > 0.78 ? 0 : d > 0.5 ? 1 : 2;
        } else {
            const t = (y - (cy - bh / 2)) / bh;
            let d = 9;
            for (const s of streaks) d = Math.min(d, Math.abs((x - cx) / bw - (s.off + s.amp * Math.sin(t * s.f * 6.28 + s.ph))));
            d += (r() - 0.5) * 0.14;
            cls = d < 0.065 ? 0 : d < 0.17 ? 1 : 2;
        }
        const u = r();
        if (u < 0.06) return pick(pal.accent, r);
        if (cls === 0) return pick(pal.streak, r);
        if (cls === 1) return pick(pal.mid, r);
        return pick(pal.far, r);
    };
}

// Build one window: atlas (the glass, transparent over stone), stone mask,
// and the outlines the 3D scene needs.
export function buildBay(meta, makeRoseCanvas) {
    const rnd = mulberry(meta.seed * 7919 + 13);
    const H = 1400;

    if (meta.kind === 'rose') {
        const size = 1024;
        const tex = makeRoseCanvas(size, meta.seed);
        const atlas = document.createElement('canvas');
        atlas.width = size; atlas.height = size;
        const ac = atlas.getContext('2d');
        ac.save();
        ac.beginPath(); ac.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2); ac.clip();
        const k = 0.455 / 0.48;
        ac.drawImage(tex, size / 2 - size * k / 2, size / 2 - size * k / 2, size * k, size * k);
        ac.restore();
        const mask = document.createElement('canvas');
        mask.width = 256; mask.height = 256;
        const mc = mask.getContext('2d');
        mc.fillStyle = '#fff';
        mc.beginPath(); mc.arc(128, 128, 128, 0, Math.PI * 2); mc.fill();
        return {
            kind: 'rose', aspect: 1, hw: 0.5, atlas, mask,
            outer: circlePts(0, 0.5, 0.5, 64),
            holes: [circlePts(0, 0.5, 0.455, 64)],
            openings: [{ pts: circlePts(0, 0.5, 0.455, 48), color: [1, 0.62, 0.2] }],
            top: 1,
        };
    }

    const hw = 0.385;
    const TOP = 1.02;
    const W = Math.round(H * hw * 2 / TOP);
    const atlas = document.createElement('canvas');
    atlas.width = W; atlas.height = H;
    const ctx = atlas.getContext('2d');
    const S = H / TOP;
    const toPx = (x, y) => ({ x: (x + hw) * S, y: (TOP - y) * S });

    const lw = 0.205, gap = 0.035;
    const startX = -(3 * lw + 2 * gap) / 2;
    const openings = [];
    const holes = [];
    const pal = PALETTES[meta.palette];
    const lead = Math.max(2, S * 0.0018) * (meta.palette === 'whites' ? 1.3 : 1);

    const add = (pts, kind, extra) => {
        openings.push({ pts, kind });
        holes.push(pts);
        const flow = makeFlow(kind, rnd);
        paintOpening(ctx, toPx, pts, Object.assign({ rnd, pal, flow, lead }, extra));
    };

    // Upper lancets, oculi, tiny circles, lower lancets.
    const lancet = { stretch: 1.7, shear: 0.22, rmin: S * 0.018, rmax: S * 0.085, bars: 2 };
    for (let i = 0; i < 3; i++) add(lancetPts(startX + i * (lw + gap), 0.55, lw, 0.43), 'lancet', lancet);
    const oc = { stretch: 1.0, shear: 0, rmin: S * 0.012, rmax: S * 0.042, bars: 1 };
    for (let i = 0; i < 3; i++) add(circlePts(startX + lw / 2 + i * (lw + gap), 0.455, 0.082), 'oculus', oc);
    const tiny = { stretch: 1.0, shear: 0, rmin: S * 0.006, rmax: S * 0.012, bars: 0 };
    add(circlePts(startX + lw + gap / 2, 0.455, 0.017, 20), 'oculus', tiny);
    add(circlePts(startX + 2 * lw + gap * 1.5, 0.455, 0.017, 20), 'oculus', tiny);
    for (let i = 0; i < 3; i++) add(lancetPts(startX + i * (lw + gap), 0.04, lw, 0.33), 'lancet', lancet);

    const outer = slabPts(hw, TOP, 0.07);
    // Stone mask (for the shadow the stone throws).
    const mask = document.createElement('canvas');
    mask.width = 256; mask.height = Math.round(256 * TOP / (hw * 2));
    const mc = mask.getContext('2d');
    const ms = mask.height / TOP;
    mc.fillStyle = '#fff';
    mc.beginPath();
    outer.forEach((p, i) => { const x = (p[0] + hw) * ms, y = (TOP - p[1]) * ms; if (i) mc.lineTo(x, y); else mc.moveTo(x, y); });
    mc.closePath();
    mc.fill();

    // Average color of each opening, for the light shafts.
    const g = ctx.getImageData(0, 0, W, H).data;
    for (const o of openings) {
        let xs = 0, ys = 0;
        for (const p of o.pts) { xs += p[0]; ys += p[1]; }
        const c = toPx(xs / o.pts.length, ys / o.pts.length);
        let r = 0, gg = 0, b = 0, n = 0;
        for (let dy = -10; dy <= 10; dy += 5) for (let dx = -10; dx <= 10; dx += 5) {
            const i = (Math.round(c.y + dy) * W + Math.round(c.x + dx)) * 4;
            r += g[i]; gg += g[i + 1]; b += g[i + 2]; n++;
        }
        const m = (r + gg + b) / (3 * n);
        const sat = (v) => Math.max(0, Math.min(255, m + (v - m) * 1.5)) / 255;
        o.color = [sat(r / n), sat(gg / n), sat(b / n)];
    }

    return { kind: 'bay', aspect: hw * 2, hw, atlas, mask, outer, holes, openings, top: TOP };
}
