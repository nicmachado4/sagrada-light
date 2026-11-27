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
        streak: ['#fff0a0', '#ffe874', '#fff7c8', '#ffdf5a'],
        mid: ['#ffb326', '#ff9a1c', '#ffc72e', '#ff8a1e'],
        far: ['#e8281c', '#d11524', '#ff5a1f', '#c40f2e', '#e8402a', '#b8123a', '#ff6a2a'],
        accent: ['#1fa8c9', '#2f62d6', '#8a2fb0'],
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

// Colors sampled from real Passion-side photos (Wikimedia Commons, Sagrada Familia
// stained glass, CC BY-SA): lancet color grids (10 x 32) and rose colors by radius.
const REAL = {"A":["d6a64e","d5a14e","d29950","cd8752","cd8752","cd8752","d07356","da745d","d36253","db6b57","d8aa4d","d8aa4d","d8aa4d","eda86a","eda86a","eda86a","e98b68","e47464","d36253","e2735a","d8aa4d","d8aa4d","d8aa4d","d19750","d1915b","d1915b","e37e57","ea845d","e87a56","f08561","d8aa4d","d8aa4d","d8aa4d","cc8a48","d77d4e","ce7154","e2795a","eb8d5e","e47d5b","e07256","df9447","df9447","df9447","c06944","e08a47","c97354","e27a51","ea8a5f","e37657","e37051","df9254","df9254","df9254","ce8849","e79042","df8250","f18565","d45f55","dc6552","e16751","cd974f","d09c51","d7aa57","ebd66a","d19948","b56837","ab5534","e06573","d54d47","ce4640","ba9748","ba9748","ba9748","c7904b","c58843","c1763c","ba6240","ce5049","da4f47","d34745","f1cf6d","f1cf6d","f1cf6d","c06f26","c56736","c46a3a","eb8b4f","e58753","e16942","d1473b","e0b15d","dcaa59","d1944d","ae552b","c86e2d","ca733b","bf6a44","d7744c","e1764c","d5514f","d39951","d39951","d39951","c4834e","be6d41","af533d","b85e48","cb5a4c","c54031","cd4940","efb947","efb947","efb947","eba74a","be714d","d46e51","d45e4e","eb7d59","a92a2f","a92a2f","ca8c40","ca8c40","ca8c40","f2ac3e","d2913e","a34231","d76f50","e06a4a","b23d45","b23d45","ac713a","ac713a","ac713a","c48743","eba95f","ab6338","af5243","e4624d","cd413e","cd413e","b1623c","b3673e","bb7544","d3a155","cf8d4d","b16245","b75530","d45147","d14542","d14542","b34e3c","b34e3c","b34e3c","a85a35","b4723d","a56f35","985632","c04b41","c43f41","c43f41","d86657","d25f51","c75145","b54e38","ab5737","a25f37","a35e25","c2563b","d33f33","d33f33","de6d5e","de6d5e","d34342","c4483d","9c5638","9c5638","a05a2e","cb4a3b","cf3e33","cf3e33","ca5749","d25545","d44e47","d44e47","bc523f","b2513b","d34f3e","cf4b43","cd4840","cd4840","c1594d","df6b5e","ca4b40","ca4b40","cd5142","c74d3e","d75339","d13a34","c93b34","c93b34","d45043","dd5c53","cd4e4e","bf413a","d35547","d05748","c24f49","d93a28","c64430","c64430","b8583f","ca5a49","a9332b","9c2119","a93b2b","c34c3e","b64235","d23b2e","d85d39","d85d39","b8583f","922a1c","922a1c","8f2519","8c3b22","92261f","8c1314","ca4a2f","d35e3b","d35e3b","a13e2f","8b231f","8b231f","a25340","9a3b2e","9f2428","8d131c","da5841","d25944","d25944","963027","8b231f","8b231f","a25340","a42f36","aa2d32","9e2022","9c2826","a52e2c","a52e2c","dae06d","8f2726","942a2c","9e323a","9e323a","a6222b","a71917","a32c34","a42d30","a42e2e","dae06d","cfa65c","bb3239","bb3239","bb3239","a72521","ac1d15","ac2f20","ac2f20","ac2f20","dae06d","dae06d","b7363e","b7363e","b7363e","a2282c","a52425","a72c24","a72c24","a72c24","dae06d","dae06d","dae06d","b7363e","b7363e","a2282c","a52425","a72c24","a72c24","a72c24","dae06d","dae06d","cdb651","c08c34","c45d34","b0502a","a52425","a72c24","a72c24","a72c24","dae06d","cdb651","c08c34","c08c34","d18529","bd7729","bd7729","b55e27","b35627","b25327","cdb651","c08c34","c08c34","c08c34","d18529","bd7729","bd7729","bd7729","bd7729","bd7729"],"B":["48a6d7","48a6d7","48a6d7","48a6d7","48a6d7","48a6d7","48a6d7","48a6d7","53a698","509f6a","3f9cdf","3f9cdf","3f9cdf","3f9cdf","3f9cdf","3f9cdf","3f9cdf","3f9cdf","4e9a59","4d993d","4495c4","4495c4","4495c4","4495c4","4495c4","4495c4","4495c4","4495c4","499436","5d9939","4495c3","4595c3","4595c2","4595c0","4596bc","4697b4","4999a5","4d9e85","55a747","98b140","907a8c","8f7c8c","8d7e8b","88818c","7a888f","4e9b9d","569f86","63a668","79ae4a","9db54e","dd5e55","dc6155","db6455","da6654","da6654","db694f","66a570","77ab5a","8bb14c","9db54e","de5b55","dd5f55","db6255","da6554","da6654","db694f","d26e4f","ca754f","ca754f","9db54e","df5856","de5b55","dd5f55","db6455","da6654","db694f","d36d4e","ca754f","ca754f","ca754f","e15456","e05756","de5b55","dc6155","da6654","db694f","d3694d","ca754f","ca754f","ca754f","e25256","e15356","e05656","de5b55","da6654","db694f","d55d47","c14a31","c1412e","c1412e","e25056","e25056","e25056","e25056","d5564c","cf4f49","d0523f","c15334","db4723","db4723","ca4f4b","ca4f4b","ca4f4b","ca4f4b","da5c54","d95c4d","c24b32","c25030","c03b26","c03b26","df6a4c","df6a4c","df6a4c","d2584d","c85b44","ba6e43","be5338","c25030","c03b26","c03b26","df6a4c","df6a4c","df6a4c","da6150","c34834","cb4b3d","bf3f32","c23b35","c23a31","c23a2f","de5f51","de5f51","de5f51","dc513f","dd4f41","d64532","d44131","c43837","c43837","c43837","cf3835","cf3835","cf3835","ce4541","c63734","d13f31","db4830","be3933","be3933","be3933","d23e39","d23e39","d23e39","c03738","bf272b","d14635","db4429","b92a1d","b92a1d","b92a1d","d7583c","d04a42","c32e4f","c22c31","a4201e","bd3531","c23129","a51d1b","a51d1b","a51d1b","de6636","de6636","c7325f","ae2630","a5231b","b92e22","d34a1d","d15731","d15731","d15731","de653b","de653b","c93e3d","b5231f","a11f1a","d24924","d54d25","9c201b","9c201b","9c201b","d2563f","d2563f","b9342a","ac1e1d","ca4c28","d55426","ad271c","a8211e","a8211e","a8211e","ca3f2d","ca3f2d","ad2822","b43a2e","bd4025","9d1c1a","a71d1d","a92417","a92417","a92417","d54230","d54230","bf3129","d54026","d64538","d14a3f","a92823","a9261d","a9251a","a92419","be392e","c2362a","c12c27","bf3124","cc473f","d04d46","c54641","c54641","c54641","c54641","ba3c33","bc3836","c13033","b62c2c","c13936","d04d46","c54641","c54641","c54641","c54641","c1311f","d43e35","dd4b46","e2514d","e2514d","d94f49","c54641","c54641","c54641","c54641","cf3c21","cf3a2c","dc4a49","d4514c","d4514c","d4514c","cc4c46","c94944","c74742","c64741","cf3c21","d4483d","da554e","d7534d","d5524d","e39144","e39144","e39144","e39144","e39144","d1341b","9e2422","b63835","b83a34","d6843f","e39144","e39144","e39144","e39144","e39144","d1341b","9e2422","911b1b","9b2419","ca773a","e39144","e39144","e39144","e39144","e39144","c12d1e","a92827","b62a25","a62d17","b25c31","ed9338","ed9338","ed9338","ed9338","ed9338","c8302a","dc3733","cf3529","9d2c1a","ba5c2c","e08b38","e08b38","e08b38","e08b38","e08b38"],"C":["dcbf56","d8ba57","d8ba57","d4b355","ceaa52","dab951","ebce51","edd04e","edcf4d","f2ba6a","dfc456","d8ba57","d8ba57","cfad53","c8a14f","d6b351","e9cd53","edd050","edcf4d","f2ba6a","e6ce55","d8ba57","d8ba57","c6a050","c1964c","d0ac50","e6ca56","ecd153","edcf4d","f2ba6a","f4e353","ecd955","ecd551","b58648","bb8c48","cba54f","dfc358","ebd259","edcf4d","f2ba6a","f1d95c","f4dd4b","ebd14c","b58648","c19147","c7a04c","d2b557","ead466","f4e04d","e6be48","dbbc49","f9db50","ebc444","e3b951","cc9c45","c49947","bb9549","d2ae4d","eac94f","d9b54a","d1a340","e2c04d","edb350","dea647","ddb156","ddb156","d4b852","eedb5d","f9e559","e6d058","b66e2a","ce782f","c38632","daab49","e6bf5c","da9541","da9b39","dfba50","fbea50","efe360","ef8c42","cd7429","cf9439","e3bf4e","edd64f","ce6b25","d67d23","dd993b","f7e55b","d6c953","bd612f","b56137","c7953c","cd974d","e3bb54","c9671e","d36f27","d3692f","cfab50","dbc759","933515","a44b26","c7953c","cd974d","e3bb54","c2641d","bb611d","be6024","fceb63","ece167","8a3a14","9a4f23","b57a37","cd974d","dc923e","d56928","d56928","c96817","f2d357","f0da58","9a4f23","aa6432","c08a47","d5ae58","cb803f","ca7c37","d26b1c","d16c1a","d19a37","e6c853","af5c37","a54a28","d5b15d","ead16a","cb8346","c38e52","cb6d2e","e27630","d18a37","d5a759","b96e46","a8591c","eed462","fef177","d4793a","f8c25f","ad622d","973f15","9d511d","f0cb61","b1562a","ba5d34","e9ce5e","e4bf5e","c57e44","eec452","f3b45a","973616","b66e2f","ecc357","bb6331","b45d24","cb933a","c78236","c37131","e9b046","eeb24c","b8662f","daac4f","feea6f","c36226","ca6d24","c86c25","be6628","c8752f","f6ce5e","e6b553","a34a2c","be7f3e","fee165","a64f29","b5603a","c56129","a95025","af5035","bb5a2f","b76431","994012","9a522a","f3cf62","a64b27","a64725","c25c23","bd4d31","db4d44","cf5245","a2422f","b5562f","a43c2d","e09651","e1b560","a84b2a","a9452c","ca5c54","cc3529","ad2918","b2562b","cf7432","e38148","e9ab51","e1b560","aa552c","d24636","da4a3a","d84732","d75032","bc562c","df8647","ed8c52","de914c","b24b23","d74d37","dc503a","d4532c","c85e35","d55f44","e17747","ec8d3e","eb9040","d08f46","d7653f","c14234","c65e36","f3ca5b","db8b43","d67939","e37649","e59049","ec8c4e","eba05f","e27537","dc533a","d87f32","efc446","df9d40","cf7940","e87949","ed924b","e38b45","eba75f","cb5b2b","df543e","d89148","d3a341","e19b3b","c26233","ce6d3c","df9147","d38d3d","e3a358","ba4433","c4483c","d77f45","e39f42","e65b43","e1544c","df5d44","cf8a3d","feed76","f6cb67","d75f3f","e05e3f","eba34b","efde42","e8bb4c","d26b42","d06137","c45a30","c77b3e","d5964c","e7624a","d1502e","e37e45","e4a946","efdc4e","f7ea60","fdf170","c8823f","922913","b56231","dd4426","d4492c","ec8353","d06e43","f8e165","f9e35c","daa150","ce9348","99341e","bc6b39","d74e34","b13c29","c14f37","e77b49","c96c31","d67b3a","e28b48","e8b953","d38b52","c87b45","a1210e","992615","93321b","b25c41","d66941","ef9652","f0a457","ecae55","d38b52","cd834c"],"rose":[["c1481b","a43600","ac561b","eb9b44","bc5311","b5440c","db6525","a04b12","b36d28","dd813e","b6491e","9f4304","c47731","bf5019","ae581b","d0551a"],["e28e46","c5501a","a46b14","b88f35","e3ae2e","9f3b19","d16910","ae4d00","c78a1f","b04d16","c2723d","b36e13","ef802f","dcb735","f8d241","f99331","da7e31","a25424","ad3900","eb7023","ed8129","ba6524","9f4010","fc8e41","b17117","ebb24b","c06425","be640c","c59c2a","b27234","ff944e","ad7d0f","a25e17","b15105","cd972d","ae6e17","e29b3f","ca7717","ff8e30","c07911","b06814","a64413","d58429","cb8e33","d59943","d3701d","c69024","a2590a","c36c29","d15d20"],["c35e26","a33c11","e3882f","d25f20","c04e10","d97a3a","a88430","a5591b","d38934","c39027","cc5a11","b25700","b24600","bd4207","cd7215","a65d34","b7662e","b78718","a84615","de6c2d"],["9f8113"],["d59726","d1bd3a","efc241","fbcd44","dd9b2d","f2bd39","f09c42","dc791e","b06d26","f5a14b","a88b2f","ab5000","b47226","a1520f","c2831a","b07734","d38837","b88915","ad6200","d29020","b78512","aa9134","ab5c17","cda32d","b65e1f","e2c448","f8c73c","b17f26","f3cb45","e4862f","c29b34","c5ab3c","cb853f","c79325"],["c56006","eab737","a02b08","bd6609","e54c2c","e19937","b16420","c69a2d","cc8932","a94500","b26632","ae7a2e","a5721f","b67205","fcc550","da840d","b47226","e98919","a35320","fdae45","e08d2f","dab42b","b18d2d","b55500","c37c2e","c2752f","a64d00","a04f22","d1982f","d3631b","bd7d1c","a78524","ffbd4e","b27a03","f4d346","ad3600","b7672c","a83100","d66914","b45005","e06218","d87115","d1c535","cf6108","dea33f","cf9420","f09b3e","d6701b","d6963e","a07516"],["b04d00","c1602b","b4682c","f0ce46","c19536","d5b642","e5c534","b76728","a5400a","f0a53f","d9682e","bb8e33","ab4c00","c65825","fcd64f","b25400","ba8b3b","f0bb4b","b74513","d77939","ecb443","e6c13f","a57624","ffe64d","f28f3e","cb6422","cf9e41","ca4e0e","ba6a2d","a06227","a34307","c89d2a","db8343","bc933b","ffd74f","ddc541","d0ab27","a96300","f0d03f","a07519","e0d140","dfc13f","b3450a","eecf40","c3652f","e6b93c","b4410b","b15224","fbd54e","ac8425"],["b07e1f","b35f21","ccb938","de7e28","a8280d","d26c2c","eec432","f89c35","d43607","c8a525","c44c27","cd3a19","cd971b","b74b1a","df8a30","cab536","c98e28","c06c14","ffb64f","daa73e","ab7424","9f622b","f1a13e","ab591f","c2973b","edba3d","d79a3f","dfc13b","b65e1e","e5c649","e49435","d37e3d","c6550f","b71d00","eab545","d69543","b6a32a","b93a00","b56a19","e7aa35","b16412","e2ac3f","aa4f00","f6cb48","df8139","f6c53a","bd7416","be5913","f2bd3b","c36c29"],["b27026","c27d2f","cda61d","cca01b","ffd94a","b4a41d","b0700c","cd9921","a85a1a","dfae2b","d2c040","bf9f30","b8a725","caa636","b78b2c","bd9b13","bd7334","a47a00","d09c39","edca3a","c3a215","cb6a26","bc9b3c","af6301","af8727","e19035","deca43","e17632","dea83b","e6b340","e6a53f","a75100","dfb52f","d68d3e","e5b23c","c3843d","a87824","df7c1f","af680e","a66d1c","e9d040","c39b39","d4a636","f5cb43","b18a2f","bd7c14","c3802f","f0bb4b","a28623","a38932"],["c7ad3e","c29c37","d3c240","a17311","a4661d","b29827","c59a29","c28123","e0bc42","e3ac45","d6893b","b98923","dcb939","b58902","ad8331","dabd3b","e8bf41","ce9e38","b69a13","fbc450","d09841","a1750c","cfb230","d2bb31","bd9e32","cc8a33","a4711e","bf8d38","d1a423","caaf3c","d7ad23","d3a93d","ec9b4a","dab531","e8943e","bf9d3b","a67d21","c79124","d9ae3e","c9b32a","e9b744","ebd148","dcac26","c9a83f","f9a13f","bd872f","a18522","e2c547","aa8132","a15c0f"]]};
function realGrid(k) { return REAL[k].map((h) => hex('#' + h)); }
function enhance(c) {
    const m = (c[0] + c[1] + c[2]) / 3;
    return c.map((v) => {
        let x = m + (v - m) * 1.3;
        x = Math.pow(Math.max(0, x) / 255, 1.25) * 255 * 1.12;
        return Math.max(0, Math.min(255, x));
    });
}
function gridAt(grid, u, v, rnd) {
    const GW = 10, GH = 32;
    const i = Math.max(0, Math.min(GW - 1, Math.floor(u * GW + (rnd() - 0.5) * 2.2)));
    const j = Math.max(0, Math.min(GH - 1, Math.floor(v * GH + (rnd() - 0.5) * 2.2)));
    return enhance(grid[j * GW + i]);
}
function roseAt(r, rnd) {
    let b = Math.max(0, Math.min(9, Math.floor(r * 10)));
    let k = 0;
    while (!REAL.rose[b].length || REAL.rose[b].length < 5) { b = (b + 1) % 10; if (++k > 10) break; }
    const arr = REAL.rose[b];
    return enhance(hex('#' + arr[Math.floor(rnd() * arr.length)]));
}

function pick(arr, rnd) { return hex(arr[Math.floor(rnd() * arr.length)]); }

// Cheap blur that works everywhere: repeated halving with smoothing.
function soften(src, pad, targetW) {
    const w0 = Math.round(src.width * pad), h0 = Math.round(src.height * pad);
    let c = document.createElement('canvas');
    c.width = w0; c.height = h0;
    const x = c.getContext('2d');
    x.drawImage(src, (w0 - src.width) / 2, (h0 - src.height) / 2);
    while (c.width > targetW) {
        const n = document.createElement('canvas');
        n.width = Math.max(2, Math.round(c.width / 2)); n.height = Math.max(2, Math.round(c.height / 2));
        const nx = n.getContext('2d');
        nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = 'high';
        nx.drawImage(c, 0, 0, n.width, n.height);
        c = n;
    }
    return c;
}

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
    for (let i = 0; i < 20000 && seeds.length < (opts.maxSeeds || 260); i++) {
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
        const col = opts.colorAt ? opts.colorAt(sc.x, sc.y, minx, miny, bw, bh, rnd) : flow(sc.x, sc.y, cxm, cym, bw, bh, rnd, pal);
        const lum = opts.colorAt ? 0.86 + rnd() * 0.22 : 0.88 + rnd() * 0.38;
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
        lg.addColorStop(0, 'rgba(255,255,255,0.08)');
        lg.addColorStop(0.55, 'rgba(255,255,255,0)');
        lg.addColorStop(1, 'rgba(0,0,0,0.20)');
        ctx.fillStyle = lg;
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.lineWidth = Math.max(1, lead * 0.6);
        for (let n = 0; n < (opts.colorAt ? 0 : 4); n++) {
            const a0 = rnd() * 6.28, rr0 = rr * (0.2 + rnd() * 0.8);
            ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.10)';
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a0) * rr0, cy + Math.sin(a0) * rr0);
            ctx.quadraticCurveTo(cx + (rnd() - 0.5) * rr, cy + (rnd() - 0.5) * rr, cx - Math.cos(a0) * rr0, cy - Math.sin(a0) * rr0);
            ctx.stroke();
        }
        ctx.restore();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.lineWidth = lead * 2.4;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(18,15,13,0.94)';
        ctx.lineWidth = opts.colorAt ? lead * 1.3 : lead;
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
            d += (r() - 0.5) * 0.08;
            cls = d < 0.05 ? 0 : d < 0.15 ? 1 : 2;
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
        const k = 0.467 / 0.48;
        ac.drawImage(tex, size / 2 - size * k / 2, size / 2 - size * k / 2, size * k, size * k);
        ac.restore();
        const mask = document.createElement('canvas');
        mask.width = 256; mask.height = 256;
        const mc = mask.getContext('2d');
        mc.fillStyle = '#fff';
        mc.beginPath(); mc.arc(128, 128, 128, 0, Math.PI * 2); mc.fill();
        return {
            kind: 'rose', aspect: 1, hw: 0.5, atlas, mask, blur: soften(atlas, 1, 64), halo: soften(atlas, 1.4, 64), pad: 1.4,
            outer: circlePts(0, 0.5, 0.5, 64),
            holes: [circlePts(0, 0.5, 0.455, 64)],
            openings: [{ pts: circlePts(0, 0.5, 0.455, 48), color: [1, 0.62, 0.2] }],
            top: 1,
        };
    }

    // Composition: a rose floating above three lancets. No wall, no trim.
    const hw = 0.36;
    const TOP = 1.5;
    const HH = 1700;
    const W = Math.round(HH * hw * 2 / TOP);
    const atlas = document.createElement('canvas');
    atlas.width = W; atlas.height = HH;
    const ctx = atlas.getContext('2d');
    const S = HH / TOP;
    const toPx = (x, y) => ({ x: (x + hw) * S, y: (TOP - y) * S });
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

    // The rose: twelve petals around a pale heart.
    const RC = [0, 1.14], R = 0.33;
    const rcPx = toPx(RC[0], RC[1]);
    const petal = { stretch: 1.3, shear: 0, rmin: S * 0.02, rmax: S * 0.045, bars: 0, maxSeeds: 30,
        colorAt: (x, y, a, b2, c, d, r) => roseAt(Math.hypot(x - rcPx.x, y - rcPx.y) / (R * S), r) };
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.13;
        const pts = [];
        for (let n = 0; n < 28; n++) {
            const t = (n / 28) * Math.PI * 2;
            const lx = R * 0.63 + Math.cos(t) * R * 0.37;
            const ly = Math.sin(t) * R * 0.135;
            pts.push([RC[0] + lx * Math.cos(a) - ly * Math.sin(a), RC[1] + lx * Math.sin(a) + ly * Math.cos(a)]);
        }
        add(pts, 'lancet', petal);
    }
    add(circlePts(RC[0], RC[1], R * 0.25, 40), 'oculus', { stretch: 1, shear: 0, rmin: S * 0.012, rmax: S * 0.022, bars: 0, maxSeeds: 14,
        colorAt: (x, y, a, b2, c, d, r) => roseAt(Math.min(0.35, Math.hypot(x - rcPx.x, y - rcPx.y) / (R * S)), r) });
    // Three lancets below, fine leaded glass.
    const lw = 0.17, gap = 0.05, lh = 0.66;
    const startX = -(3 * lw + 2 * gap) / 2;
    const grids = [realGrid('A'), realGrid('B'), realGrid('C')];
    for (let i = 0; i < 3; i++) {
        const gr = grids[i];
        const lancet = { stretch: 1.6, shear: 0.15, rmin: S * 0.03, rmax: S * 0.075, bars: 0, maxSeeds: 70,
            colorAt: (x, y, x0, y0, w, h, r) => gridAt(gr, (x - x0) / w, (y - y0) / h, r) };
        add(lancetPts(startX + i * (lw + gap), 0.03, lw, lh), 'lancet', lancet);
    }

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
        for (let dy = -4; dy <= 4; dy += 4) for (let dx = -4; dx <= 4; dx += 4) {
            const i = (Math.round(c.y + dy) * W + Math.round(c.x + dx)) * 4;
            r += g[i]; gg += g[i + 1]; b += g[i + 2]; n++;
        }
        const m = (r + gg + b) / (3 * n);
        const sat = (v) => Math.max(0, Math.min(255, m + (v - m) * 1.5)) / 255;
        o.color = [sat(r / n), sat(gg / n), sat(b / n)];
    }

    return { kind: 'bay', aspect: hw * 2, hw, atlas, mask, blur: soften(atlas, 1, 40), halo: soften(atlas, 1.4, 48), pad: 1.4, outer, holes, openings, top: TOP };
}
