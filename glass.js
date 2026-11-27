// Procedural stained-glass textures for the floating windows of Sagrada
// Familia: Voronoi shards after Joan Vila-Grau's windows, plus the
// Resurrection rose. Plain JS, shared by the standalone site and the File.

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
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const side = (p) => (p.x - mx) * dx + (p.y - my) * dy;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const q = poly[(i + 1) % poly.length];
        const sp = side(p);
        const sq = side(q);
        if (sp <= 0) out.push(p);
        if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
            const t = sp / (sp - sq);
            out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
    }
    return out;
}

function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
    const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
    const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
    return `rgb(${r},${g},${b})`;
}

const PALETTES = {
    // Nativity side: deep jewel blues below, greens, a golden crown.
    cool: [
        [0.00, ['#e5a91e', '#efc22e', '#d99412', '#e8b424', '#f0cd45']],
        [0.15, ['#c2c22e', '#9fb834', '#86b03a', '#cfc338']],
        [0.36, ['#359552', '#268a66', '#1f7d5c', '#429b46', '#2a9576']],
        [0.62, ['#1f6fa6', '#1a5a9c', '#174a8e', '#2465ac', '#1b5e8e']],
        [0.85, ['#17296f', '#201a66', '#12215a', '#1c3580', '#241e72']],
    ],
    // Passion side: garnet and crimson below, oranges, a pale-gold crown.
    warm: [
        [0.00, ['#f2d54a', '#f7e06a', '#eec93e', '#f5dc58']],
        [0.15, ['#f0b32a', '#e89a1e', '#f5c132', '#eda41f']],
        [0.36, ['#e57a16', '#d96a12', '#ef8a1a', '#e06d1f', '#ee7d22']],
        [0.62, ['#c73a1a', '#b92e16', '#d04420', '#a82814', '#c53e1e']],
        [0.85, ['#8e1f14', '#7c1a12', '#9c2418', '#6e1610', '#93221a']],
    ],
    // Apse: bright gold low, fading into leaf greens above.
    apse: [
        [0.00, ['#f0c53a', '#e8b92e', '#f5d054', '#e5a92a', '#eec443']],
        [0.22, ['#d9c23a', '#c9c23e', '#e0be34', '#bfc24a']],
        [0.45, ['#86b03a', '#6fa43e', '#94b848', '#5f9e46']],
        [0.70, ['#359552', '#2a8a5e', '#42a04e', '#2e9052']],
        [0.88, ['#1f7d5c', '#2a9576', '#1e6e58', '#35a06a']],
    ],
    // The upper windows: many kinds of white glass, a rare pale tint.
    whites: [
        [0.00, ['#f4f2e8', '#eef0ea', '#e9ebe4', '#f6f3ea']],
        [0.25, ['#eceee6', '#e6eae2', '#f2f0e4', '#e8ece8']],
        [0.50, ['#e4e8e2', '#eef0e8', '#e8eae6', '#f0eee2']],
        [0.75, ['#e2e6e4', '#e8ebe6', '#edefe6', '#e6e9e0']],
    ],
};

function cellColor(t, rnd, palette) {
    if (palette === 'whites') {
        if (rnd() < 0.08) return ['#dfe8ea', '#efe9d8', '#e4e9df'][Math.floor(rnd() * 3)];
    } else if (rnd() < 0.05) {
        return ['#f2efe4', '#eef0ea', '#f5f2e8'][Math.floor(rnd() * 3)];
    }
    const bands = PALETTES[palette];
    let band = bands[bands.length - 1][1];
    for (const [start, colors] of bands) {
        if (t >= start) band = colors;
    }
    return band[Math.floor(rnd() * band.length)];
}

// Tall arched window of leaded shards: irregular, many sizes, translucent.
export function makeGlassCanvas(w = 512, h = 1024, seed = 7, palette = 'cool', opts = {}) {
    const rnd = mulberry(seed);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const K = w / 512;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const archY = h * 0.22;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, archY);
    ctx.quadraticCurveTo(0, archY * 0.12, w / 2, 0);
    ctx.quadraticCurveTo(w, archY * 0.12, w, archY);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();

    // Seeds with very different spacing: a few big shards, many small ones.
    const pts = [];
    for (let i = 0; i < 14000 && pts.length < 420; i++) {
        const x = (rnd() * 1.1 - 0.05) * w;
        const y = (rnd() * 1.1 - 0.05) * h;
        const r = (11 + 58 * Math.pow(rnd(), 2.3)) * K;
        let ok = true;
        for (const p of pts) {
            if (Math.hypot(p.x - x, p.y - y) < (p.r + r) * 0.6) { ok = false; break; }
        }
        if (ok) pts.push({ x, y, r });
    }

    const field = (x, y) => Math.sin(x * 0.013 + seed) * Math.sin(y * 0.0085 + seed * 2) * 0.16;
    for (let i = 0; i < pts.length; i++) {
        const s = pts[i];
        const R = s.r * 2.4 + 60 * K;
        let poly = [
            { x: s.x - R, y: s.y - R }, { x: s.x + R, y: s.y - R },
            { x: s.x + R, y: s.y + R }, { x: s.x - R, y: s.y + R },
        ];
        for (let j = 0; j < pts.length; j++) {
            if (j === i) continue;
            const o = pts[j];
            if (Math.abs(o.x - s.x) > R * 2 || Math.abs(o.y - s.y) > R * 2) continue;
            poly = clipPoly(poly, s, o);
            if (poly.length < 3) break;
        }
        if (poly.length < 3) continue;
        // Shards are angular: nudge corners a little, keep neighbors in step.
        const jit = (p) => {
            const hx = Math.sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453;
            const hy = Math.sin(p.x * 39.346 + p.y * 11.135) * 24634.6345;
            return { x: p.x + ((hx - Math.floor(hx)) - 0.5) * 2.2 * K, y: p.y + ((hy - Math.floor(hy)) - 0.5) * 2.2 * K };
        };
        const q = poly.map(jit);

        const cream = rnd() < (palette === 'whites' ? 0.0 : 0.12);
        let base;
        if (cream) base = ['#f7f1df', '#fbf6ea', '#f3ead3'][Math.floor(rnd() * 3)];
        else base = cellColor(Math.max(0, Math.min(1, s.y / h + field(s.x, s.y) + (rnd() - 0.5) * 0.12)), rnd, palette);
        const lum = cream ? 0.96 + rnd() * 0.08 : 0.86 + rnd() * 0.46;

        let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
        for (const p of q) { minx = Math.min(minx, p.x); miny = Math.min(miny, p.y); maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y); }
        ctx.beginPath();
        ctx.moveTo(q[0].x, q[0].y);
        for (let k = 1; k < q.length; k++) ctx.lineTo(q[k].x, q[k].y);
        ctx.closePath();
        ctx.fillStyle = base.startsWith('#') ? shade(base, lum) : base;
        ctx.fill();

        // Translucency: a bright side where light comes in, a deeper far side.
        const ang = rnd() * Math.PI * 2;
        const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
        const rr = Math.max(maxx - minx, maxy - miny) * 0.6 + 1;
        const lg = ctx.createLinearGradient(cx - Math.cos(ang) * rr, cy - Math.sin(ang) * rr, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
        lg.addColorStop(0, cream ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.26)');
        lg.addColorStop(0.55, 'rgba(255,255,255,0)');
        lg.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = lg;
        ctx.fill();

        // Glass edge: a bright bevel just inside the lead, then the lead itself.
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.30)';
        ctx.lineWidth = 4.2 * K;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(22,19,17,0.92)';
        ctx.lineWidth = 2.0 * K;
        ctx.stroke();
    }

    // Mullions: thinner than before.
    ctx.strokeStyle = 'rgba(14,13,14,0.92)';
    ctx.lineWidth = Math.max(3, w * 0.011);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h * 0.42); ctx.lineTo(w, h * 0.42);
    ctx.moveTo(0, h * 0.7); ctx.lineTo(w, h * 0.7);
    ctx.stroke();
    ctx.restore();

    // Outer lead rim.
    ctx.strokeStyle = '#0c0b0a';
    ctx.lineWidth = Math.max(5, w * 0.016);
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, archY);
    ctx.quadraticCurveTo(0, archY * 0.12, w / 2, 0);
    ctx.quadraticCurveTo(w, archY * 0.12, w, archY);
    ctx.lineTo(w, h);
    ctx.stroke();

    return canvas;
}

// The Resurrection rose: a circular fireball, white-hot at the center,
// cooling through gold and amber to a deep orange rim.
export function makeRoseCanvas(size = 512, seed = 51) {
    const rnd = mulberry(seed);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.48;

    const band = (t) => {
        if (t < 0.12) return ['#fff6e0', '#fff2d2', '#ffedc0'];
        if (t < 0.30) return ['#ffe9a0', '#f9dc7e', '#ffdf8e'];
        if (t < 0.50) return ['#f7c64a', '#f0b83a', '#f9ce58'];
        if (t < 0.70) return ['#e89a24', '#e08a1c', '#efa830'];
        if (t < 0.88) return ['#d06a16', '#c75c12', '#da781a'];
        return ['#a83e12', '#b84814', '#963710'];
    };

    const rings = [0.0, 0.12, 0.26, 0.42, 0.60, 0.78, 1.0];
    for (let ri = 0; ri < rings.length - 1; ri++) {
        const r0 = rings[ri] * R;
        const r1 = rings[ri + 1] * R;
        const cells = ri === 0 ? 6 : 8 + ri * 4;
        const twist = ri * 0.35;
        for (let ci = 0; ci < cells; ci++) {
            const a0 = twist + (ci / cells) * Math.PI * 2 + (rnd() - 0.5) * 0.06;
            const a1 = twist + ((ci + 1) / cells) * Math.PI * 2 + (rnd() - 0.5) * 0.06;
            const t = (rings[ri] + rings[ri + 1]) / 2;
            const colors = band(t);
            const base = colors[Math.floor(rnd() * colors.length)];
            const lum = 0.78 + rnd() * 0.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r1, a0, a1);
            ctx.arc(cx, cy, Math.max(0.5, r0), a1, a0, true);
            ctx.closePath();
            ctx.fillStyle = shade(base, lum);
            ctx.fill();
        }
    }

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.34);
    core.addColorStop(0, 'rgba(255,252,240,0.9)');
    core.addColorStop(0.5, 'rgba(255,240,200,0.35)');
    core.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15,14,13,0.92)';
    ctx.lineWidth = Math.max(3, size * 0.011);
    for (let ri = 1; ri < rings.length; ri++) {
        ctx.beginPath();
        ctx.arc(cx, cy, rings[ri] * R, 0, Math.PI * 2);
        ctx.stroke();
    }
    const spokes = 16;
    for (let si = 0; si < spokes; si++) {
        const a = (si / spokes) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.1, cy + Math.sin(a) * R * 0.1);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
    }

    ctx.strokeStyle = '#0c0b0a';
    ctx.lineWidth = Math.max(6, size * 0.022);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    return canvas;
}

// Heavily downscaled copy: reads as a defocused version when upscaled.
export function makeBlurredCanvas(source, w = 96, h = 192) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    return canvas;
}

export function averageColor(source) {
    const ctx = source.getContext('2d');
    const { width, height } = source;
    const data = ctx.getImageData(0, 0, width, height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 16 * 4) {
        if (data[i + 3] < 40) continue;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return [0.5, 0.5, 0.5];
    return [r / n / 255, g / n / 255, b / n / 255];
}

// Average colors of the texture's four edges: bottom, right, top, left.
export function edgeColors(source) {
    const ctx = source.getContext('2d');
    const w = source.width;
    const h = source.height;
    const strip = (x, y, sw, sh) => {
        const data = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh))).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 40) continue;
            if (data[i] + data[i + 1] + data[i + 2] < 45) continue; // skip lead
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        if (!n) return [0.5, 0.5, 0.5];
        return [r / n / 255, g / n / 255, b / n / 255];
    };
    return [
        strip(0, h * 0.88, w, h * 0.12),
        strip(w * 0.88, 0, w * 0.12, h),
        strip(0, 0, w, h * 0.14),
        strip(0, 0, w * 0.12, h),
    ];
}
