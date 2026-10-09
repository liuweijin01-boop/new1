'use strict';
// 《光年之外》 procedural renderer. renderFrame(t) draws one frame at time t (seconds).
const W = 1920, H = 1080, BAR = 138, CW = 1920, CH = 804;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const FZH = '"WenQuanYi Zen Hei", sans-serif';
const FMONO = '"DejaVu Sans Mono", monospace';
const C = {
  steel: '#8fa1b0', text: '#c6d1da', dim: 'rgba(143,161,176,0.5)', faint: 'rgba(143,161,176,0.16)',
  red: '#c9483d', green: '#62d69c', cold: '#cfe3f0', sil: '#030507',
};
let TL = null;

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const eo = t => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
function glowDot(g, x, y, r, col, a) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// ---------- value noise ----------
const PERM = new Uint8Array(512);
{ const r = mulberry32(7); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
function h3(x, y, z) { return PERM[(PERM[(PERM[x & 255] + y) & 255] + z) & 255] / 255; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), h = h3(xi + 1, yi + 1, zi + 1);
  const x0 = a + (b - a) * u, x1 = c + (d - c) * u, x2 = e + (f - e) * u, x3 = g + (h - g) * u;
  const y0 = x0 + (x1 - x0) * v, y1 = x2 + (x3 - x2) * v;
  return y0 + (y1 - y0) * w;
}
function fbm(x, y, z, o = 5) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; f *= 2.03; a *= 0.5; } return s / n; }

// ---------- planets ----------
function surface(type, x, y, z, seed) {
  const o = seed * 7.13;
  switch (type) {
    case 'rock': { const n = fbm(x * 2.2 + o, y * 2.2, z * 2.2, 5); const c = fbm(x * 7 + o, y * 7, z * 7, 3); let v = 70 + n * 150; if (c > 0.6) v *= 0.82; return [v * 0.95, v * 0.97, v]; }
    case 'hot': { const n = fbm(x * 2 + o, y * 2, z * 2, 5); let r = 100 + n * 110, g = 75 + n * 60, b = 62 + n * 40; const k = Math.abs(fbm(x * 4 + o, y * 4, z * 4, 4) - 0.5); if (k < 0.03) { r = 205; g = 120; b = 72; } return [r, g, b]; }
    case 'gas': { const n = fbm(x * 1.5 + o, y * 1.5, z * 1.5, 4); const v = 0.5 + 0.5 * Math.sin(y * 15 + n * 6 + seed); return [120 + v * 60, 112 + v * 48, 100 + v * 36]; }
    case 'ice': { const n = fbm(x * 3 + o, y * 3, z * 3, 5); const v = 130 + n * 100; const k = Math.abs(fbm(x * 5 + o, y * 5, z * 5, 3) - 0.5) < 0.02 ? 0.78 : 1; return [v * 0.88 * k, v * 0.96 * k, v * k]; }
    case 'red': { const n = fbm(x * 2.5 + o, y * 2.5, z * 2.5, 5); return [110 + n * 90, 70 + n * 50, 60 + n * 36]; }
    case 'stripped': { const n = fbm(x * 2 + o, y * 2, z * 2, 5); return n > 0.55 ? [110 + n * 50, 106 + n * 40, 96 + n * 30] : [52 + n * 30, 84 + n * 30, 98 + n * 30]; }
    case 'earth': {
      const n = fbm(x * 1.35 + 3.1, y * 1.35 + 1.7, z * 1.35 + 5.3, 6);
      let col;
      if (n > 0.53) { const m = fbm(x * 3 + 9, y * 3, z * 3, 4); const dry = clamp((m - 0.42) * 3); col = [lerp(62, 120, dry), lerp(84, 108, dry), lerp(64, 84, dry)]; }
      else { const d = clamp((0.53 - n) * 7); col = [lerp(36, 10, d), lerp(80, 28, d), lerp(112, 60, d)]; }
      if (Math.abs(y) > 0.95 - fbm(x * 3, y * 3, z * 3, 4) * 0.22) col = [214, 222, 230];
      const cl = fbm(x * 2.2 + 20, y * 3.4 + 4, z * 2.2 + 7, 5); const ca = ss(0.52, 0.74, cl) * 0.8;
      return [lerp(col[0], 222, ca), lerp(col[1], 228, ca), lerp(col[2], 236, ca)];
    }
  }
  return [128, 128, 128];
}
const PLANET_CACHE = new Map();
function renderPlanet(type, R, rot, opt = {}) {
  const S = Math.ceil(R * 2) + 2;
  const key = opt.cacheKey;
  let cv = key && PLANET_CACHE.get(key);
  if (cv) return cv;
  cv = mk(S, S); const g = cv.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  const L = norm(opt.light || [-0.6, -0.35, 0.72]);
  const amb = opt.ambient ?? 0.03, seed = opt.seed || 0;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const nx = (px + 0.5 - S / 2) / R, ny = (py + 0.5 - S / 2) / R; const rr = nx * nx + ny * ny; if (rr > 1) continue;
    const nz = Math.sqrt(1 - rr);
    const sx = nx * cr + nz * sr, sz = -nx * sr + nz * cr;
    const col = surface(type, sx, ny, sz, seed);
    const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    let sh = amb + (1 - amb) * Math.pow(diff, 0.85);
    sh *= 0.6 + 0.4 * Math.pow(nz, 0.35);
    const i = (py * S + px) * 4;
    d[i] = col[0] * sh; d[i + 1] = col[1] * sh; d[i + 2] = col[2] * sh;
    d[i + 3] = 255 * clamp((1 - Math.sqrt(rr)) * R);
  }
  g.putImageData(img, 0, 0);
  if (key) PLANET_CACHE.set(key, cv);
  return cv;
}
function drawPlanetImg(g, cv, x, y, R) { g.drawImage(cv, x - R - 1, y - R - 1, 2 * R + 2, 2 * R + 2); }

// ---------- shared assets ----------
const TYPES = ['rock', 'hot', 'gas', 'ice', 'red', 'stripped'];
let THUMBS = [], STARMAP, FIELD, SKY, GRAIN = [], PROFILE, BACKHEAD, SHE12, BOKEH4 = [], DUST = [], WIN_BLUR;
let STAMP_CELLS1 = [], STAMP_CELLS2 = [];

function buildThumbs() {
  const r = mulberry32(42);
  for (let i = 0; i < 64; i++) {
    const ty = TYPES[Math.floor(r() * TYPES.length)];
    THUMBS.push({ cv: renderPlanet(ty, 78, r() * 6.28, { seed: i + 1, light: [-0.45 - r() * 0.3, -0.4, 0.75] }), code: 'KX-' + String(1000 + Math.floor(r() * 8999)) + ' ' + 'bcde'[Math.floor(r() * 4)] });
  }
}
function buildStarmap() {
  const S = 720, c = mk(S, S), g = c.getContext('2d'), r = mulberry32(3), cx = S / 2;
  const bg = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  bg.addColorStop(0, 'rgb(34,58,78)'); bg.addColorStop(0.55, 'rgb(14,25,35)'); bg.addColorStop(1, 'rgb(7,12,17)');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cx, cx, 0, 7); g.fill();
  g.strokeStyle = 'rgba(150,180,200,0.08)'; g.lineWidth = 1;
  for (let rr = 60; rr < cx; rr += 60) { g.beginPath(); g.arc(cx, cx, rr, 0, 7); g.stroke(); }
  for (let a = 0; a < 24; a++) { g.beginPath(); g.moveTo(cx, cx); g.lineTo(cx + Math.cos(a * Math.PI / 12) * cx, cx + Math.sin(a * Math.PI / 12) * cx); g.stroke(); }
  for (let i = 0; i < 3800; i++) {
    const arm = i % 2, rad = 14 + Math.pow(r(), 0.65) * 330;
    const th = rad * 0.017 + arm * Math.PI + (r() + r() + r() - 1.5) * 0.45;
    const x = cx + Math.cos(th) * rad, y = cx + Math.sin(th) * rad;
    const b = 0.25 + 0.75 * Math.exp(-rad / 160) + r() * 0.2;
    g.fillStyle = `rgba(${200 + r() * 40},${215 + r() * 30},235,${clamp(b * 0.8)})`;
    g.fillRect(x, y, r() < 0.1 ? 2 : 1.2, r() < 0.1 ? 2 : 1.2);
  }
  glowDot(g, cx, cx, 90, '210,225,240', 0.35);
  for (let i = 0; i < 34; i++) {
    const a = r() * 6.28, rad = 70 + r() * 270, x = cx + Math.cos(a) * rad, y = cx + Math.sin(a) * rad;
    g.strokeStyle = 'rgba(160,185,205,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 5, 0, 7); g.stroke();
    if (r() < 0.7) { g.strokeStyle = 'rgba(201,72,61,0.85)'; g.beginPath(); g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); g.stroke(); }
  }
  STARMAP = c;
}
function buildField() {
  const S = 720, c = mk(S, S), g = c.getContext('2d'), cx = S / 2;
  const bg = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  bg.addColorStop(0, 'rgb(16,26,34)'); bg.addColorStop(1, 'rgb(7,11,15)');
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cx, cx, 0, 7); g.fill();
  g.strokeStyle = 'rgba(150,180,200,0.06)';
  for (let rr = 60; rr < cx; rr += 60) { g.beginPath(); g.arc(cx, cx, rr, 0, 7); g.stroke(); }
  const k = 336 / Math.sqrt(1845), ga = Math.PI * (3 - Math.sqrt(5));
  for (let n = 1; n < 1845; n++) {
    const rad = k * Math.sqrt(n), a = n * ga, x = cx + Math.cos(a) * rad, y = cx + Math.sin(a) * rad;
    g.fillStyle = `rgba(201,72,61,${0.55 + 0.35 * (n % 7) / 7})`;
    g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill();
  }
  FIELD = c;
}
function buildSky() {
  // window interior 1240x720: night sky, milky way, mountains
  const Wd = 1240, Hd = 720, c = mk(Wd, Hd), g = c.getContext('2d');
  const img = g.createImageData(Wd, Hd), d = img.data, r = mulberry32(11);
  const ang = -0.52, ca = Math.cos(ang), sa = Math.sin(ang);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const u = x / Hd, v = y / Hd;
    const across = (u - 0.86) * sa + (v - 0.55) * ca, along = (u - 0.86) * ca - (v - 0.55) * sa;
    const band = Math.exp(-Math.pow(across / 0.17, 2));
    const cl = fbm(along * 5 + 2, across * 9, 1.3, 5);
    const lane = ss(0.48, 0.66, fbm(along * 7, across * 14 + 3, 4.1, 4)) * Math.exp(-Math.pow(across / 0.05, 2));
    const mw = band * (0.35 + cl * 0.9) * (1 - lane * 0.85);
    const air = ss(0.35, 1.0, v) * 0.5;
    const i = (y * Wd + x) * 4;
    d[i] = 3 + mw * 70 + air * 14; d[i + 1] = 6 + mw * 80 + air * 22; d[i + 2] = 13 + mw * 96 + air * 34; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 2600; i++) {
    const x = r() * Wd, y = r() * Hd, b = Math.pow(r(), 3);
    g.fillStyle = `rgba(${215 + r() * 40},${225 + r() * 30},255,${0.25 + b * 0.75})`;
    const s = b > 0.6 ? 1.8 : 1.0; g.fillRect(x, y, s, s);
  }
  // mountains + observatory dome
  g.fillStyle = '#010203'; g.beginPath(); g.moveTo(0, Hd);
  for (let x = 0; x <= Wd; x += 4) { const h = 600 + fbm(x * 0.004, 0.5, 0.2, 4) * 120 - 50 + (x > 820 && x < 1000 ? -18 : 0); g.lineTo(x, h); }
  g.lineTo(Wd, Hd); g.closePath(); g.fill();
  g.beginPath(); g.arc(905, 600, 22, Math.PI, 0); g.rect(883, 600, 44, 14); g.fill();
  SKY = c;
}
function buildGrain() {
  const r = mulberry32(99);
  for (let k = 0; k < 6; k++) {
    const c = mk(960, 402), g = c.getContext('2d'), img = g.createImageData(960, 402), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = r() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); GRAIN.push(c);
  }
}

// ---------- silhouette with rim light ----------
function makeLitSilhouette(drawMask, Wd, Hd, dx, dy, blur) {
  const mask = mk(Wd, Hd); const mg = mask.getContext('2d'); mg.fillStyle = '#fff'; drawMask(mg);
  const rim = mk(Wd, Hd); const rg = rim.getContext('2d');
  rg.drawImage(mask, 0, 0); rg.globalCompositeOperation = 'destination-out'; rg.filter = `blur(${blur}px)`; rg.drawImage(mask, dx, dy); rg.filter = 'none';
  const glow = mk(Wd, Hd); const gg = glow.getContext('2d'); gg.filter = 'blur(14px)'; gg.drawImage(rim, 0, 0);
  return { mask, rim, glow, w: Wd, h: Hd };
}
const SCR = new Map();
function tinted(img, color) {
  const k = img.width + 'x' + img.height; let s = SCR.get(k);
  if (!s) { s = mk(img.width, img.height); SCR.set(k, s); }
  const g = s.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, s.width, s.height);
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, s.width, s.height);
  g.globalCompositeOperation = 'source-over'; return s;
}
function drawLit(g, P, color, rimA, base = C.sil) {
  g.drawImage(tinted(P.mask, base), 0, 0);
  g.globalAlpha = rimA; g.drawImage(tinted(P.rim, color), 0, 0);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = rimA * 0.55; g.drawImage(tinted(P.glow, color), 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

// profile (facing right), authored in a 1000x1000 box
function profilePath(g) {
  g.beginPath();
  g.moveTo(80, 1000);
  g.bezierCurveTo(140, 900, 250, 840, 345, 800);
  g.bezierCurveTo(360, 740, 330, 640, 300, 560);
  g.bezierCurveTo(260, 450, 300, 300, 400, 250);
  g.bezierCurveTo(500, 200, 630, 215, 690, 330);
  g.bezierCurveTo(712, 375, 712, 410, 705, 432);
  g.bezierCurveTo(700, 448, 690, 458, 688, 468);
  g.bezierCurveTo(700, 500, 735, 540, 760, 572);
  g.bezierCurveTo(764, 580, 752, 592, 735, 592);
  g.bezierCurveTo(722, 592, 716, 600, 718, 612);
  g.bezierCurveTo(726, 628, 724, 640, 714, 648);
  g.bezierCurveTo(722, 656, 724, 668, 712, 682);
  g.bezierCurveTo(700, 692, 702, 705, 706, 722);
  g.bezierCurveTo(708, 752, 680, 772, 640, 774);
  g.bezierCurveTo(610, 776, 590, 790, 585, 830);
  g.bezierCurveTo(585, 880, 610, 930, 700, 1000);
  g.closePath();
}
function buildProfile() {
  const S = 1.2;
  PROFILE = makeLitSilhouette(g => {
    g.scale(S, S); profilePath(g); g.fill();
    g.beginPath(); g.arc(318, 392, 78, 0, 7); g.fill();
    g.lineWidth = 26; g.lineCap = 'round'; g.strokeStyle = '#fff';
    g.beginPath(); g.moveTo(452, 450); g.bezierCurveTo(442, 350, 446, 270, 466, 236); g.stroke();
    g.beginPath(); g.roundRect(398, 440, 112, 152, 46); g.fill();
  }, 1200, 1200, -16, 6, 5);
  PROFILE.scale = S;
}
function buildBackHead() {
  BACKHEAD = makeLitSilhouette(g => {
    g.beginPath(); g.ellipse(1600, 330, 172, 214, -0.12, 0, 7); g.fill();
    g.beginPath(); g.arc(1700, 205, 74, 0, 7); g.fill();
    g.beginPath(); g.moveTo(1330, 804); g.bezierCurveTo(1370, 660, 1470, 600, 1530, 520);
    g.lineTo(1700, 520); g.bezierCurveTo(1760, 560, 1880, 560, 1920, 570); g.lineTo(1920, 804); g.closePath(); g.fill();
  }, CW, CH, 12, 4, 6);
}
function buildShe12() {
  const mkShape = (fill, face) => {
    const c = mk(CW, CH), g = c.getContext('2d'); g.filter = 'blur(18px)';
    g.fillStyle = fill;
    g.beginPath(); g.moveTo(930, 804); g.bezierCurveTo(950, 520, 1040, 420, 1180, 410); g.bezierCurveTo(1320, 420, 1410, 520, 1430, 804); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(1180, 260, 74, 92, 0, 0, 7); g.fill();
    g.beginPath(); g.arc(1120, 190, 40, 0, 7); g.fill();
    g.fillRect(1150, 330, 60, 90);
    if (face) { g.fillStyle = face; g.beginPath(); g.ellipse(1188, 268, 52, 70, 0, 0, 7); g.fill(); }
    return c;
  };
  SHE12 = { lit: mkShape('#17222c', '#34475a'), dark: mkShape('#020305', null) };
  const w = mk(CW, CH), g = w.getContext('2d'); g.filter = 'blur(26px)';
  const gr = g.createLinearGradient(0, 40, 0, 560); gr.addColorStop(0, 'rgba(46,78,110,0.55)'); gr.addColorStop(1, 'rgba(26,46,66,0.5)');
  g.fillStyle = gr; g.fillRect(70, 30, 470, 520);
  g.fillStyle = 'rgba(4,6,9,0.9)'; g.fillRect(295, 30, 22, 520); g.fillRect(70, 220, 470, 18);
  g.filter = 'blur(3px)'; const r = mulberry32(5);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(220,232,250,${0.2 + r() * 0.4})`; g.beginPath(); g.arc(90 + r() * 430, 50 + r() * 300, 2 + r() * 4, 0, 7); g.fill(); }
  WIN_BLUR = w;
}
function buildBokeh() {
  const r = mulberry32(21);
  for (let i = 0; i < 46; i++) BOKEH4.push({ x: r() * 1100 - 100, y: r() * 804, r: 18 + r() * 60, red: r() < 0.22, a: 0.04 + r() * 0.09 });
  for (let i = 0; i < 170; i++) DUST.push({ x: r() * 1920, y: r() * 640, s: 0.6 + r() * 1.6, p: r() * 6.28, v: 2 + r() * 6 });
}

// ---------- shot helpers ----------
const clock = t => { const s = 2 * 3600 + 47 * 60 + 13 + Math.floor(t); const p = n => String(n).padStart(2, '0'); return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
function topBar(g, t, label, color) {
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = `22px ${FZH}`; g.fillStyle = color || C.steel; g.fillText(label, 64, 56);
  g.textAlign = 'right'; g.font = `20px ${FMONO}`; g.fillStyle = C.steel; g.fillText(clock(t), CW - 64, 56);
  g.strokeStyle = 'rgba(143,161,176,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(64, 78.5); g.lineTo(CW - 64, 78.5); g.stroke();
  g.textAlign = 'left';
}
function monitorBase(g) {
  g.fillStyle = '#060a0f'; g.fillRect(0, 0, CW, CH);
  g.strokeStyle = 'rgba(120,150,175,0.045)'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= CW; x += 64) { g.moveTo(x + .5, 0); g.lineTo(x + .5, CH); }
  for (let y = 0; y <= CH; y += 64) { g.moveTo(0, y + .5); g.lineTo(CW, y + .5); }
  g.stroke();
}
function drawX(g, x, y, s, lw, col) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'square';
  g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke();
}
function drawCheck(g, x, y, s, lw, col) {
  g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.3, y + s * 0.7); g.lineTo(x + s, y - s * 0.75); g.stroke();
}
function smallStamp(g, x, y, dt, s) {
  const p = clamp(dt / 0.14); const sc = lerp(1.7, 1, eo(p));
  g.globalAlpha = p; drawX(g, x, y, s * sc, s * 0.17, C.red); g.globalAlpha = 1;
  if (dt < 0.35) { g.strokeStyle = `rgba(201,72,61,${0.6 * (1 - dt / 0.35)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s * (1.2 + dt * 4), 0, 7); g.stroke(); }
}
function bigStamp(g, x, y, R, dt, heavy) {
  const p = clamp(dt / 0.16), sc = lerp(1.5, 1, eo(p));
  g.save(); g.globalAlpha = p * 0.92;
  drawX(g, x, y, R * 0.62 * sc, heavy ? 22 : 16, C.red);
  g.translate(x + R * 0.55, y + R * 0.78); g.rotate(-0.1); g.scale(sc, sc);
  g.strokeStyle = C.red; g.lineWidth = 4; g.strokeRect(-88, -32, 176, 64);
  g.fillStyle = C.red; g.font = `36px ${FZH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('不宜居', 0, 2);
  g.restore(); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (dt < 0.5) { g.strokeStyle = `rgba(201,72,61,${0.5 * (1 - dt / 0.5)})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, R * (1.0 + dt * 1.2), 0, 7); g.stroke(); }
}
function planetReticle(g, t, x, y, R) {
  g.strokeStyle = 'rgba(143,161,176,0.22)'; g.lineWidth = 1;
  g.beginPath(); g.arc(x, y, R + 46, 0, 7); g.stroke();
  for (let i = 0; i < 72; i++) { const a = i * Math.PI / 36 + t * 0.02, l = i % 6 ? 6 : 14; g.beginPath(); g.moveTo(x + Math.cos(a) * (R + 46), y + Math.sin(a) * (R + 46)); g.lineTo(x + Math.cos(a) * (R + 46 + l), y + Math.sin(a) * (R + 46 + l)); g.stroke(); }
  g.strokeStyle = 'rgba(143,161,176,0.35)';
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(x + dx * (R + 64), y + dy * (R + 64)); g.lineTo(x + dx * (R + 90), y + dy * (R + 90)); g.stroke(); }
}
function rowsPanel(g, t, rows) {
  rows.forEach((r, i) => {
    const y = 270 + i * 80; if (t < r.at) return;
    const a = ss(r.at, r.at + 0.3, t);
    g.globalAlpha = a;
    if (r.flag != null && t >= r.flag) { g.fillStyle = `rgba(201,72,61,${0.12 * ss(r.flag, r.flag + 0.2, t)})`; g.fillRect(990, y - 40, 880, 62); }
    if (r.okAt != null && t >= r.okAt) { g.fillStyle = `rgba(98,214,156,${0.10 * (1 - ss(r.okAt + 0.2, r.okAt + 1.0, t)) + 0.03})`; g.fillRect(990, y - 40, 880, 62); }
    g.strokeStyle = 'rgba(143,161,176,0.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(1010, y + 22.5); g.lineTo(1850, y + 22.5); g.stroke();
    g.font = `25px ${FZH}`; g.fillStyle = C.dim; g.fillText(r.label, 1010, y);
    const vt = r.valueAt ?? r.at;
    let val = '—';
    if (t >= vt) { const n = Math.ceil(r.value.length * clamp((t - vt) / 0.3)); val = r.value.slice(0, n); }
    let col = C.text;
    if (r.flag != null && t >= r.flag) col = C.red; else if (r.okAt != null && t >= r.okAt) col = C.green; else if (val === '—') col = C.faint;
    g.fillStyle = col; g.fillText(val, 1300, y);
    const st = r.status, sa = r.statusAt;
    if (sa != null && t >= sa) {
      const p = eo((t - sa) / 0.18), s = 13 * lerp(1.6, 1, p);
      g.globalAlpha = a * p;
      if (st === 'ok') drawCheck(g, 1836, y - 9, s, 4, C.green); else drawX(g, 1836, y - 9, s * 0.8, 4, C.red);
    } else { g.fillStyle = C.faint; g.fillRect(1824, y - 10, 24, 2); }
    g.globalAlpha = 1;
  });
}
function spectrum(g, t, seed, col) {
  g.strokeStyle = col || 'rgba(143,161,176,0.35)'; g.lineWidth = 1.2; g.beginPath();
  for (let x = 0; x <= 840; x += 6) { const v = vnoise(x * 0.02 + seed, t * 0.6, seed) * 40 + vnoise(x * 0.08, t * 1.5, 3) * 12; const y = 735 - v; x ? g.lineTo(1010 + x, y) : g.moveTo(1010 + x, y); }
  g.stroke();
  g.font = `16px ${FZH}`; g.fillStyle = C.faint; g.fillText('透射光谱', 1010, 772);
}
function stampTimes(shot) { return TL.stamps.filter(s => s.shot === shot).map(s => s.t); }

// ---------- SHOTS ----------
// 1: grid of candidates, first rejections
function shot1(g, t) {
  const cols = 14, rows = 6, cw = 128, chh = 124, x0 = (CW - cols * cw) / 2, y0 = 100;
  const u = t / 3, sc = 1 + 0.035 * u;
  g.fillStyle = '#05080c'; g.fillRect(0, 0, CW, CH);
  g.save(); g.translate(CW / 2, CH / 2); g.scale(sc, sc); g.translate(-CW / 2, -CH / 2);
  topBar(g, t, '宜居性筛查 · 候选样本 1,842');
  const st = stampTimes(1);
  const cellXY = i => [x0 + (i % cols) * cw + cw / 2, y0 + Math.floor(i / cols) * chh + chh / 2 - 8];
  for (let i = 0; i < cols * rows; i++) {
    const [x, y] = cellXY(i), th = THUMBS[i % THUMBS.length];
    drawPlanetImg(g, th.cv, x, y, 38);
    g.strokeStyle = 'rgba(143,161,176,0.2)'; g.lineWidth = 1;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(x + sx * 52, y + sy * 44); g.lineTo(x + sx * 44, y + sy * 44); g.moveTo(x + sx * 52, y + sy * 44); g.lineTo(x + sx * 52, y + sy * 36); g.stroke(); }
    g.font = `12px ${FMONO}`; g.fillStyle = 'rgba(143,161,176,0.4)'; g.textAlign = 'center'; g.fillText(th.code, x, y + 60); g.textAlign = 'left';
    const k = STAMP_CELLS1.indexOf(i);
    if (k >= 0 && t >= st[k]) { g.fillStyle = 'rgba(5,8,12,0.6)'; g.beginPath(); g.arc(x, y, 39, 0, 7); g.fill(); smallStamp(g, x, y, t - st[k], 26); }
  }
  reticleBetween(g, t, st, k => cellXY(STAMP_CELLS1[k]), 54);
  g.restore();
}
function reticleBetween(g, t, st, pos, s) {
  let k = st.findIndex(x => x > t); if (k < 0) k = st.length - 1;
  const t1 = st[k], t0 = k > 0 ? st[k - 1] : t1 - 0.6;
  const p = eio(clamp((t - t0) / Math.max(0.06, (t1 - t0) * 0.75)));
  const [ax, ay] = k > 0 ? pos(k - 1) : [CW / 2, CH / 2], [bx, by] = pos(k);
  const x = lerp(ax, bx, p), y = lerp(ay, by, p);
  g.strokeStyle = 'rgba(207,227,240,0.85)'; g.lineWidth = 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(x + sx * s, y + sy * (s - 14)); g.lineTo(x + sx * s, y + sy * s); g.lineTo(x + sx * (s - 14), y + sy * s); g.stroke(); }
}
// 2: closer grid, rejections accelerate
function shot2(g, t) {
  const cols = 11, rows = 4, cw = 210, chh = 178, y0 = 110;
  const pan = -lerp(0, 260, (t - 3) / 5);
  g.fillStyle = '#05080c'; g.fillRect(0, 0, CW, CH);
  topBar(g, t, '宜居性筛查 · 候选样本 1,842');
  const st = stampTimes(2);
  const cellXY = i => [60 + pan + (i % cols) * cw + cw / 2, y0 + Math.floor(i / cols) * chh + chh / 2];
  for (let i = 0; i < cols * rows; i++) {
    const [x, y] = cellXY(i); if (x < -120 || x > CW + 120) continue;
    const th = THUMBS[(i * 7 + 13) % THUMBS.length];
    drawPlanetImg(g, th.cv, x, y - 10, 62);
    g.font = `14px ${FMONO}`; g.fillStyle = 'rgba(143,161,176,0.45)'; g.textAlign = 'center'; g.fillText(th.code, x, y + 74); g.textAlign = 'left';
    const k = STAMP_CELLS2.indexOf(i);
    if (k >= 0 && t >= st[k]) { g.fillStyle = 'rgba(5,8,12,0.62)'; g.beginPath(); g.arc(x, y - 10, 63, 0, 7); g.fill(); smallStamp(g, x, y - 10, t - st[k], 42); }
  }
  reticleBetween(g, t, st, k => { const [x, y] = cellXY(STAMP_CELLS2[k]); return [x, y - 10]; }, 82);
  const done = st.filter(x => x <= t).length + 7;
  g.font = `20px ${FMONO}`; g.fillStyle = C.steel; g.textAlign = 'right'; g.fillText(`已排除 ${String(done).padStart(4, '0')}`, CW - 64, 790); g.textAlign = 'left';
}
// wide lab (shots 3 and 11)
const MON = { x: 1070, y: 584, w: 150, h: 62.8 };
function drawLab(g, t, mode, monitorDraw, glowK = 1) {
  g.fillStyle = '#04070a'; g.fillRect(-4000, -4000, 9000, 9000);
  const wg = g.createLinearGradient(0, 0, 0, 560); wg.addColorStop(0, '#030507'); wg.addColorStop(1, '#070b0f');
  g.fillStyle = wg; g.fillRect(-200, -200, 2320, 760);
  g.strokeStyle = 'rgba(140,165,185,0.035)'; g.lineWidth = 2;
  for (let x = -192; x < 2200; x += 96) { g.beginPath(); g.moveTo(x, -200); g.lineTo(x, 560); g.stroke(); }
  const WCx = 960, WCy = 190, R = 350;
  g.save(); g.globalCompositeOperation = 'lighter'; glowDot(g, WCx, WCy, R * 1.7, '70,110,140', 0.16); g.restore();
  g.save(); g.beginPath(); g.arc(WCx, WCy, R, 0, 7); g.clip();
  g.translate(WCx, WCy); g.rotate(mode === 'starmap' ? t * 0.006 : 0); g.drawImage(mode === 'starmap' ? STARMAP : FIELD, -360, -360, 720, 720 * 1); g.restore();
  g.strokeStyle = '#0e151b'; g.lineWidth = 14; g.beginPath(); g.arc(WCx, WCy, R + 10, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(160,190,210,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.arc(WCx, WCy, R + 18, 0, 7); g.stroke();
  if (mode === 'field') {
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
    g.save(); g.globalCompositeOperation = 'lighter'; glowDot(g, WCx, WCy, 40, '98,214,156', 0.55 * pulse); glowDot(g, WCx, WCy, 10, '200,255,225', 0.9); g.restore();
  }
  // floor & reflection
  const fg = g.createLinearGradient(0, 560, 0, 804); fg.addColorStop(0, '#080c10'); fg.addColorStop(1, '#020304');
  g.fillStyle = fg; g.fillRect(-200, 560, 2320, 600);
  g.save(); g.globalAlpha = 0.09; g.translate(0, 1120); g.scale(1, -1); g.beginPath(); g.arc(WCx, WCy, R, 0, 7); g.clip(); g.drawImage(mode === 'starmap' ? STARMAP : FIELD, WCx - 360, WCy - 360); g.restore();
  g.strokeStyle = 'rgba(140,165,185,0.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-200, 560.5); g.lineTo(2120, 560.5); g.stroke();
  // desk
  g.fillStyle = '#0a0e12'; g.fillRect(790, 650, 460, 10); g.fillStyle = '#05080a'; g.fillRect(810, 660, 10, 90); g.fillRect(1220, 660, 10, 90);
  // monitors
  const mons = [{ x: 830, y: 598, w: 110, h: 46 }, { x: 948, y: 598, w: 110, h: 46 }];
  for (const m of mons) {
    g.fillStyle = '#0a0f14'; g.fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6); g.fillStyle = '#16232e'; g.fillRect(m.x, m.y, m.w, m.h);
    g.fillStyle = 'rgba(160,195,215,0.35)'; for (let i = 0; i < 5; i++) g.fillRect(m.x + 8, m.y + 8 + i * 7, 30 + (i * 37 % 60), 2);
    g.fillStyle = '#05080a'; g.fillRect(m.x + m.w / 2 - 3, m.y + m.h, 6, 650 - m.y - m.h);
  }
  g.fillStyle = '#0a0f14'; g.fillRect(MON.x - 4, MON.y - 4, MON.w + 8, MON.h + 8);
  g.save(); g.translate(MON.x, MON.y); g.scale(MON.w / CW, MON.h / CH); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); monitorDraw(g); g.restore();
  g.fillStyle = '#05080a'; g.fillRect(MON.x + MON.w / 2 - 3, MON.y + MON.h + 4, 6, 650 - MON.y - MON.h - 4);
  g.save(); g.globalCompositeOperation = 'lighter';
  glowDot(g, MON.x + MON.w / 2, MON.y + MON.h / 2, 190, mode === 'field' ? '120,200,170' : '150,190,215', 0.16 * glowK);
  for (const m of mons) glowDot(g, m.x + m.w / 2, m.y + m.h / 2, 130, '150,190,215', 0.12);
  g.restore();
  // her (from behind), headphones on
  g.fillStyle = C.sil;
  g.beginPath(); g.moveTo(925, 712); g.bezierCurveTo(928, 650, 948, 628, 990, 626); g.bezierCurveTo(1032, 628, 1052, 650, 1055, 712); g.closePath(); g.fill();
  g.fillRect(982, 608, 16, 22);
  g.beginPath(); g.ellipse(990, 598, 17, 20, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(991, 579, 8, 0, 7); g.fill();
  g.strokeStyle = C.sil; g.lineWidth = 4; g.beginPath(); g.ellipse(990, 600, 21, 25, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.fillRect(966, 594, 7, 17); g.fillRect(1007, 594, 7, 17);
  g.fillStyle = '#020304'; g.beginPath(); g.roundRect(948, 662, 84, 80, 6); g.fill();
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(170,205,225,0.28)'; g.lineWidth = 1.2; g.shadowColor = 'rgba(170,205,225,0.6)'; g.shadowBlur = 6;
  g.beginPath(); g.ellipse(990, 598, 17, 20, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.beginPath(); g.moveTo(935, 650); g.bezierCurveTo(948, 630, 970, 626, 990, 626); g.bezierCurveTo(1010, 626, 1032, 630, 1045, 650); g.stroke();
  g.restore();
  // dust in the light
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const d of DUST) {
    const x = d.x + Math.sin(t * 0.3 + d.p) * 12, y = (d.y - t * d.v + 6400) % 640;
    const lit = Math.max(0, 1 - Math.hypot(x - WCx, y - WCy) / (R * 1.4)) + Math.max(0, 1 - Math.hypot(x - 1030, y - 610) / 260);
    if (lit * glowK <= 0.02) continue;
    g.fillStyle = `rgba(190,215,235,${clamp(lit) * 0.35 * glowK})`; g.beginPath(); g.arc(x, y, d.s, 0, 7); g.fill();
  }
  g.restore();
}
function miniGrid(g) {
  monitorBase(g);
  for (let i = 0; i < 84; i++) {
    const x = 120 + (i % 14) * 128, y = 140 + Math.floor(i / 14) * 110;
    g.fillStyle = 'rgba(150,170,185,0.55)'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill();
    if ((i * 37) % 5 < 3) drawX(g, x, y, 26, 10, C.red);
  }
}
function shot3(g, t, u) {
  const s = lerp(1.14, 1.0, eio(u)), dx = lerp(-40, 25, u);
  g.save(); g.translate(960, 402); g.scale(s, s); g.translate(-960 - dx, -402);
  drawLab(g, t, 'starmap', miniGrid);
  g.restore();
}
// 4 and 8: her profile, lit by the screen
function profileScene(g, t, sc, tilt, extraRed) {
  g.fillStyle = '#04070a'; g.fillRect(0, 0, CW, CH);
  g.save(); g.translate(1000, 400); g.scale(sc, sc); g.translate(-1000, -400);
  for (const b of BOKEH4) {
    const col = b.red ? '201,72,61' : '120,160,190';
    glowDot(g, b.x + (sc - 1) * -120, b.y, b.r, col, b.a * (b.red ? 1 + extraRed * 3 : 1));
  }
  g.save(); g.globalCompositeOperation = 'lighter'; glowDot(g, 2150, 380, 1400, '130,175,205', 0.2); g.restore();
  const flick = 1 + 0.05 * Math.sin(t * 23) + 0.04 * Math.sin(t * 7.3);
  const rimCol = extraRed > 0 ? `rgb(${Math.round(lerp(200, 225, extraRed))},${Math.round(lerp(225, 110, extraRed))},${Math.round(lerp(240, 100, extraRed))})` : 'rgb(200,225,240)';
  const breath = Math.sin(t * 1.3) * 3;
  g.save(); g.translate(300, -150 + breath); g.translate(600, 900); g.rotate(tilt); g.translate(-600, -900);
  g.scale(1.08 / PROFILE.scale, 1.08 / PROFILE.scale);
  drawLit(g, PROFILE, rimCol, 0.85 * flick);
  // glasses lens catching the monitor
  g.scale(PROFILE.scale, PROFILE.scale);
  g.save(); g.translate(714, 455); g.rotate(-0.08);
  g.strokeStyle = `rgba(200,225,240,${0.55 * flick})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, 9, 33, 0, 0, 7); g.stroke();
  g.globalCompositeOperation = 'lighter'; glowDot(g, 4, -8, 16, extraRed > 0 ? '225,120,110' : '200,230,245', 0.5 * flick);
  g.restore();
  g.strokeStyle = 'rgba(200,225,240,0.10)'; g.lineWidth = 2; g.beginPath(); g.roundRect(398, 440, 112, 152, 46); g.stroke();
  g.restore();
  g.restore();
}
function redPulse(t, times) { let v = 0; for (const s of times) if (t >= s) v = Math.max(v, 1 - (t - s) / 0.4); return clamp(v); }
function shot4(g, t, u) {
  profileScene(g, t, lerp(1.0, 1.1, eio(u)), 0, redPulse(t, [14.6, 16.3]));
}
function shot8(g, t, u) {
  profileScene(g, t, 1.11, lerp(0, -0.025, eio(u)), 0);
}
// 5: KX-1207 b — no atmosphere
function shot5(g, t, u) {
  monitorBase(g);
  topBar(g, t, '宜居性筛查 · 逐项核验');
  const [a, b, c, d] = TL.rows5, f = TL.flag5, st = TL.stamps.find(s => s.shot === 5).t;
  g.save(); g.translate(540, 440); g.scale(1 + 0.02 * u, 1 + 0.02 * u); g.translate(-540, -440);
  planetReticle(g, t, 540, 440, 250);
  drawPlanetImg(g, renderPlanet('rock', 250, 1.1, { cacheKey: 'p5', seed: 5, light: [-0.6, -0.3, 0.74] }), 540, 440, 250);
  if (t >= st) { g.fillStyle = `rgba(6,10,15,${0.55 * ss(st, st + 0.3, t)})`; g.beginPath(); g.arc(540, 440, 251, 0, 7); g.fill(); bigStamp(g, 540, 440, 250, t - st, false); }
  g.restore();
  g.font = `34px ${FZH}`; g.fillStyle = C.text; g.fillText('候选 #1207 · KX-1207 b', 1010, 160);
  g.font = `20px ${FZH}`; g.fillStyle = C.dim; g.fillText('类地岩质行星 · 1.3 倍地球半径', 1010, 198);
  rowsPanel(g, t, [
    { label: '恒星距离', value: '0.94 AU', at: a, status: 'ok', statusAt: a + 0.35 },
    { label: '轨道偏心率', value: '0.04', at: b, status: 'ok', statusAt: b + 0.35 },
    { label: '表面温度', value: '−18 °C', at: c, status: 'ok', statusAt: c + 0.35 },
    { label: '大气层', value: '缺失', at: d, status: 'bad', statusAt: f, flag: f },
  ]);
  spectrum(g, t, 1.7, 'rgba(143,161,176,0.3)');
}
// 6: eccentric orbit + remaining-candidates counter
function shot6(g, t) {
  monitorBase(g);
  topBar(g, t, '宜居性筛查 · 批量核验');
  const sx = 470, sy = 430, a = 260, e = 0.71, b = a * Math.sqrt(1 - e * e), st = TL.stamps.find(s => s.shot === 6).t;
  g.save(); g.globalCompositeOperation = 'lighter'; glowDot(g, sx, sy, 90, '230,215,190', 0.5); glowDot(g, sx, sy, 22, '255,245,230', 0.95); g.restore();
  g.strokeStyle = 'rgba(143,161,176,0.35)'; g.setLineDash([6, 8]); g.lineWidth = 1.2; g.beginPath(); g.ellipse(sx + a * e, sy, a, b, 0, 0, 7); g.stroke(); g.setLineDash([]);
  const M = (t - 23) * 1.25 + 2.2; let E = M; for (let i = 0; i < 8; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const px = sx - a * (Math.cos(E) - e), py = sy + b * Math.sin(E);
  const dist = Math.hypot(px - sx, py - sy), T = Math.round(lerp(420, -180, clamp((dist - a * (1 - e)) / (2 * a * e))));
  drawPlanetImg(g, renderPlanet('hot', 18, 0.4, { cacheKey: 'p6', seed: 6, light: [-0.6, -0.3, 0.74] }), px, py, 18);
  g.font = `20px ${FMONO}`; g.fillStyle = T > 100 ? '#d9a48a' : '#9fc0d8'; g.fillText(`${T > 0 ? '+' : ''}${T} °C`, px + 28, py - 18);
  g.font = `34px ${FZH}`; g.fillStyle = C.text; g.fillText('候选 #1843 · VX-0921 c', 120, 160);
  g.font = `24px ${FZH}`; g.fillStyle = t >= st ? C.red : C.dim; g.fillText('轨道偏心率 0.71 · 表面温差 600 °C', 120, 740);
  if (t >= st) { g.fillStyle = `rgba(6,10,15,${0.45 * ss(st, st + 0.3, t)})`; g.fillRect(100, 200, 860, 470); bigStamp(g, sx + a * e, sy, 210, t - st, false); }
  // counter
  const cf = TL.counter; const p = clamp((t - cf.start) / (cf.end - cf.start));
  const n = Math.round(lerp(cf.from, cf.to, 1 - Math.pow(1 - p, 4)));
  g.strokeStyle = 'rgba(143,161,176,0.18)'; g.beginPath(); g.moveTo(1060.5, 220); g.lineTo(1060.5, 700); g.stroke();
  g.font = `26px ${FZH}`; g.fillStyle = C.dim; g.fillText('剩余候选', 1130, 310);
  g.font = `150px ${FMONO}`; g.fillStyle = p >= 1 ? C.cold : C.text; g.fillText(n.toLocaleString('en-US'), 1120, 470);
  g.fillStyle = 'rgba(143,161,176,0.15)'; g.fillRect(1130, 520, 700, 6);
  g.fillStyle = C.steel; g.fillRect(1130, 520, Math.max(3, 700 * n / cf.from), 6);
  g.font = `20px ${FZH}`; g.fillStyle = C.faint; g.fillText('候选总数 1,842', 1130, 572);
}
// 7: TR-3318 d — atmosphere stripped by stellar wind
function shot7(g, t, u) {
  monitorBase(g);
  const st = TL.stamps.find(s => s.shot === 7).t;
  topBar(g, t, t < st + 0.6 ? '宜居性筛查 · 剩余候选 2' : '宜居性筛查 · 剩余候选 1');
  g.save(); g.translate(540, 440); g.scale(1 + 0.02 * u, 1 + 0.02 * u); g.translate(-540, -440);
  planetReticle(g, t, 540, 440, 250);
  // stellar wind
  const r = mulberry32(77);
  g.save(); g.beginPath(); g.rect(0, 90, 980, 700); g.clip(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 260; i++) {
    const y = 100 + r() * 680, sp = 500 + r() * 700, off = r() * 2000;
    let x = ((t * sp + off) % 1400) - 300;
    const dy = y - 440, inside = Math.abs(dy) < 262 && x > 540 - Math.sqrt(Math.max(0, 262 * 262 - dy * dy)) && x < 540 + Math.sqrt(Math.max(0, 262 * 262 - dy * dy));
    if (inside) continue;
    g.strokeStyle = `rgba(225,215,195,${0.06 + r() * 0.12})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 40 - r() * 60, y); g.stroke();
  }
  // atmosphere tail being torn away
  for (let i = 0; i < 70; i++) {
    const a0 = (r() - 0.5) * 2.2, rr = 252 + r() * 12, ph = (t * (0.35 + r() * 0.3) + r()) % 1;
    const x = 540 + Math.cos(a0) * rr + ph * 420, y = 440 + Math.sin(a0) * rr * 0.9 + (r() - 0.5) * 40 * ph;
    g.fillStyle = `rgba(120,190,200,${0.18 * (1 - ph)})`; g.beginPath(); g.arc(x, y, 2 + ph * 5, 0, 7); g.fill();
  }
  g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(120,190,205,0.22)'; g.lineWidth = 8; g.filter = 'blur(6px)'; g.beginPath(); g.arc(540, 440, 258, -1.2, 1.2); g.stroke(); g.restore();
  drawPlanetImg(g, renderPlanet('stripped', 250, 2.2, { cacheKey: 'p7', seed: 9, light: [-0.75, -0.25, 0.6] }), 540, 440, 250);
  if (t >= st) { g.fillStyle = `rgba(6,10,15,${0.6 * ss(st, st + 0.3, t)})`; g.beginPath(); g.arc(540, 440, 251, 0, 7); g.fill(); bigStamp(g, 540, 440, 250, t - st, true); }
  g.restore();
  g.font = `34px ${FZH}`; g.fillStyle = C.text; g.fillText('候选 #1844 · TR-3318 d', 1010, 160);
  g.font = `20px ${FZH}`; g.fillStyle = C.dim; g.fillText('红矮星宜居带 · 潮汐锁定', 1010, 198);
  const R7 = TL.rows7, f = TL.flag7;
  rowsPanel(g, t, [
    { label: '恒星距离', value: '0.03 AU', at: R7[0], status: 'ok', statusAt: R7[0] + 0.35 },
    { label: '表面温度', value: '12 °C', at: R7[1], status: 'ok', statusAt: R7[1] + 0.35 },
    { label: '液态水', value: '可能存在', at: R7[2], status: 'ok', statusAt: R7[2] + 0.35 },
    { label: '磁场强度', value: '0.02 G · 不足', at: R7[3], status: 'bad', statusAt: f, flag: f },
  ]);
  if (t >= f) { g.font = `22px ${FZH}`; g.fillStyle = C.red; g.globalAlpha = ss(f, f + 0.3, t); g.fillText('大气层正被恒星风剥离', 1010, 640); g.globalAlpha = 1; }
  spectrum(g, t, 4.2, 'rgba(143,161,176,0.3)');
}
// 9-11: the last candidate
function earthLight(t) {
  const ch = TL.checks, steps = [2.6, 1.95, 1.3, 0.7, 0.1, -0.62];
  let phi = steps[0];
  for (let i = 0; i < ch.length; i++) phi = lerp(phi, steps[i + 1], ss(ch[i], ch[i] + 0.55, t));
  return norm([Math.sin(phi), -0.28, Math.cos(phi)]);
}
let EARTH_FINAL = null;
function earthImg(t, R, live) {
  if (!live && EARTH_FINAL) return EARTH_FINAL;
  const L = earthLight(t);
  const cv = renderPlanet('earth', R, 0.6 + t * 0.05, { light: L, ambient: 0.015 });
  if (t >= 45 && !EARTH_FINAL) EARTH_FINAL = cv;
  return cv;
}
function lastCandidateUI(g, t, opt = {}) {
  monitorBase(g);
  const rv = TL.reveal_title, revealed = t >= rv;
  topBar(g, t, revealed ? '宜居性筛查 · 全部条件吻合 1 / 1,845' : '宜居性筛查 · 剩余候选 1 · 最后一项', revealed ? C.green : null);
  const ld = TL.loading;
  planetReticle(g, t, 540, 440, 250);
  if (t < ld.end + 0.4) {
    const p = clamp((t - ld.start) / (ld.end - ld.start));
    g.globalAlpha = 1 - ss(ld.end, ld.end + 0.4, t);
    g.strokeStyle = 'rgba(207,227,240,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(540, 440, 290, t * 2.4, t * 2.4 + 0.5 + p * 5.2); g.stroke();
    g.font = `36px ${FMONO}`; g.fillStyle = C.steel; g.textAlign = 'center'; g.fillText(`${Math.floor(p * 100)}%`, 540, 452); g.textAlign = 'left';
    g.globalAlpha = 1;
  }
  const ea = ss(40.0, 41.6, t);
  if (ea > 0) {
    const L = earthLight(t);
    g.save(); g.globalAlpha = ea;
    const lit = clamp(L[2] * 0.5 + 0.55);
    g.globalCompositeOperation = 'lighter';
    glowDot(g, 540 + L[0] * 60, 440 + L[1] * 60, 300, '110,170,230', 0.22 * lit + 0.05);
    g.globalCompositeOperation = 'source-over';
    drawPlanetImg(g, earthImg(t, 250, opt.live !== false), 540, 440, 250);
    g.strokeStyle = `rgba(140,195,240,${0.25 + 0.3 * lit})`; g.lineWidth = 3; g.filter = 'blur(2px)';
    g.beginPath(); g.arc(540, 440, 252, Math.atan2(L[1], L[0]) - 1.1 - lit, Math.atan2(L[1], L[0]) + 1.1 + lit); g.stroke(); g.filter = 'none';
    g.restore();
  }
  if (revealed) {
    const p = ss(rv, rv + 0.5, t);
    g.save(); g.globalAlpha = p; g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(98,214,156,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(540, 440, 296, 0, 7); g.stroke();
    glowDot(g, 540, 440 - 296, 16, '98,214,156', 0.9); g.restore();
  }
  g.font = `34px ${FZH}`; g.fillStyle = revealed ? C.green : C.text;
  g.fillText(revealed ? '候选 #1845 · 地球（基准对照组）' : '候选 #1845 · 载入中…', 1010, 160);
  g.font = `20px ${FZH}`; g.fillStyle = C.dim; g.fillText(revealed ? '太阳系 · 第三行星' : '数据载入中', 1010, 198);
  const ch = TL.checks, labelsAt = 38.4;
  const vals = [['恒星距离', '1.000 AU'], ['轨道偏心率', '0.017'], ['液态水', '稳定存在'], ['磁场强度', '0.25–0.65 G'], ['大气层', '氮 78% · 氧 21%']];
  rowsPanel(g, t, vals.map((v, i) => ({ label: v[0], value: v[1], at: labelsAt + i * 0.12, valueAt: ch[i], status: 'ok', statusAt: ch[i] + 0.22, okAt: ch[i] + 0.22 })));
  spectrum(g, t, 7.7, t >= ch[4] ? 'rgba(98,214,156,0.45)' : 'rgba(143,161,176,0.3)');
}
function shot9(g, t) { lastCandidateUI(g, t); }
function shot10(g, t) { lastCandidateUI(g, t); }
function shot11(g, t) {
  const s0 = CW / MON.w, P = [s0 * MON.x / (s0 - 1), s0 * MON.y / (s0 - 1)];
  const z = eio(clamp((t - 46.1) / 2.6));
  const s = Math.exp(lerp(Math.log(s0), Math.log(1), z)) * (1 - 0.015 * clamp((t - 48.7) / 0.3)) * (1 - 0.03 * (1 - clamp((t - 45) / 1.1)) * 0);
  g.save(); g.translate(P[0], P[1]); g.scale(s, s); g.translate(-P[0], -P[1]);
  drawLab(g, t, 'field', mg => lastCandidateUI(mg, t, { live: s > 3 }), clamp(1 - (s - 1) / 3));
  g.restore();
}
// 12: headphones set down; she rises toward the window
function shot12(g, t) {
  g.fillStyle = '#040609'; g.fillRect(0, 0, CW, CH);
  g.drawImage(WIN_BLUR, 0, 0);
  glowDot(g, 760, 120, 420, '60,95,120', 0.10);
  const rise = eio(clamp((t - 50.8) / 1.25));
  const dark = ss(51.1, 51.9, t);
  g.save(); g.translate(lerp(0, -820, rise), lerp(0, -60, rise));
  g.globalAlpha = 1 - dark; g.drawImage(SHE12.lit, 0, 0); g.globalAlpha = dark; g.drawImage(SHE12.dark, 0, 0); g.globalAlpha = 1;
  g.restore();
  // desk
  const dg = g.createLinearGradient(0, 480, 0, 804); dg.addColorStop(0, '#0d1318'); dg.addColorStop(1, '#040608');
  g.fillStyle = dg; g.fillRect(0, 480, CW, 330);
  g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(1100, 560, 0, 1100, 560, 700); rg.addColorStop(0, 'rgba(150,190,215,0.12)'); rg.addColorStop(1, 'rgba(150,190,215,0)'); g.fillStyle = rg; g.fillRect(0, 480, CW, 330); g.restore();
  g.strokeStyle = 'rgba(160,195,215,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 480.5); g.lineTo(CW, 480.5); g.stroke();
  g.fillStyle = '#07090c'; g.beginPath(); g.moveTo(140, 640); g.lineTo(820, 640); g.lineTo(860, 804); g.lineTo(90, 804); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(160,195,215,0.14)'; g.beginPath(); g.moveTo(140, 640.5); g.lineTo(820, 640.5); g.stroke();
  g.strokeStyle = 'rgba(160,195,215,0.05)'; for (let i = 1; i < 5; i++) { const y = 640 + i * 32; g.beginPath(); g.moveTo(140 - i * 10, y); g.lineTo(820 + i * 8, y); g.stroke(); }
  // headphones
  const td = TL.headphones_down, p = clamp((t - 49.5) / (td - 49.5));
  let hy = lerp(-330, 590, eio(p)); const rot = lerp(-0.2, 0, eo(p));
  if (t > td) hy -= 7 * Math.sin(Math.PI * clamp((t - td) / 0.3)) * (1 - clamp((t - td) / 0.3));
  const near = clamp((hy + 100) / 690);
  g.fillStyle = `rgba(0,0,0,${0.55 * near})`; g.beginPath(); g.ellipse(1250, 712, 230 * (0.6 + 0.4 * near), 16, 0, 0, 7); g.fill();
  g.save(); g.translate(1250, hy); g.rotate(rot);
  g.strokeStyle = '#0a0d10'; g.lineWidth = 22; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 170, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  g.strokeStyle = 'rgba(190,220,235,0.45)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 180, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
  for (const sx of [-1, 1]) {
    g.fillStyle = '#0b0e11'; g.beginPath(); g.roundRect(sx * 165 - 38, -20, 76, 122, 30); g.fill();
    g.strokeStyle = 'rgba(190,220,235,0.3)'; g.lineWidth = 2; g.beginPath(); g.roundRect(sx * 165 - 38, -20, 76, 122, 30); g.stroke();
  }
  g.restore();
}
// 13: over the shoulder, the real night sky
function shot13(g, t, u) {
  g.fillStyle = '#05070a'; g.fillRect(0, 0, CW, CH);
  const s = 1 + 0.02 * u;
  g.save(); g.translate(960, 402); g.scale(s, s); g.translate(-960, -402);
  g.drawImage(SKY, 260, 40);
  const r = mulberry32(31);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const x = 260 + r() * 1240, y = 40 + r() * 520, ph = r() * 6.28, sp = 1 + r() * 3;
    const tw = 0.55 + 0.45 * Math.sin(t * sp + ph);
    glowDot(g, x, y, 3 + r() * 5, '220,232,255', 0.5 * tw);
  }
  glowDot(g, 1230, 640, 20, '98,214,156', 0.22 + 0.06 * Math.sin(t * 3.2));
  g.restore();
  // window frame and wall
  g.fillStyle = '#06090c';
  g.fillRect(-100, -100, 360, 1000); g.fillRect(1500, -100, 600, 1000); g.fillRect(-100, -100, 2200, 140); g.fillRect(-100, 760, 2200, 200);
  g.fillStyle = '#020304'; g.fillRect(872, 40, 18, 720); g.fillRect(260, 292, 1240, 16);
  g.strokeStyle = 'rgba(150,185,210,0.22)'; g.lineWidth = 2; g.strokeRect(260, 40, 1240, 720);
  g.save(); g.globalCompositeOperation = 'lighter'; const wl = g.createLinearGradient(260, 0, 0, 0); wl.addColorStop(0, 'rgba(70,105,135,0.10)'); wl.addColorStop(1, 'rgba(70,105,135,0)'); g.fillStyle = wl; g.fillRect(0, 40, 260, 720); g.restore();
  g.restore();
  // her, out of focus in the foreground
  g.save(); g.filter = 'blur(3px)'; drawLit(g, BACKHEAD, 'rgb(170,200,225)', 0.6); g.filter = 'none'; g.restore();
}
// 14: the lens — the screen's green point and a real star become one
function shot14(g, t, u) {
  const s = 1 + 0.06 * u;
  g.fillStyle = '#07090b'; g.fillRect(0, 0, CW, CH);
  g.save(); g.translate(960, 402); g.scale(s, s); g.translate(-960, -402);
  const sk = g.createRadialGradient(980, 420, 50, 980, 420, 900); sk.addColorStop(0, '#12161a'); sk.addColorStop(1, '#050607');
  g.fillStyle = sk; g.fillRect(0, 0, CW, CH);
  g.fillStyle = '#1a1f24'; g.beginPath(); g.moveTo(640, 420); g.bezierCurveTo(780, 270, 1190, 260, 1340, 410); g.bezierCurveTo(1180, 560, 800, 570, 640, 420); g.fill();
  g.save(); g.beginPath(); g.moveTo(640, 420); g.bezierCurveTo(780, 270, 1190, 260, 1340, 410); g.bezierCurveTo(1180, 560, 800, 570, 640, 420); g.clip();
  const ir = g.createRadialGradient(990, 412, 30, 990, 412, 132); ir.addColorStop(0, '#05070a'); ir.addColorStop(0.45, '#0e161d'); ir.addColorStop(1, '#090c10');
  g.fillStyle = ir; g.beginPath(); g.arc(990, 412, 132, 0, 7); g.fill();
  g.strokeStyle = 'rgba(120,150,170,0.08)'; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.28; g.beginPath(); g.moveTo(990 + Math.cos(a) * 55, 412 + Math.sin(a) * 55); g.lineTo(990 + Math.cos(a) * 128, 412 + Math.sin(a) * 128); g.stroke(); }
  g.fillStyle = '#020203'; g.beginPath(); g.arc(990, 412, 52, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = '#030405'; g.lineWidth = 9; g.beginPath(); g.moveTo(630, 418); g.bezierCurveTo(780, 262, 1190, 252, 1350, 405); g.stroke();
  // lens
  const LC = [900, 420], LR = 560;
  g.save(); g.beginPath(); g.arc(LC[0], LC[1], LR, 0, 7); g.clip();
  const sh = g.createLinearGradient(400, 0, 1500, 800); sh.addColorStop(0, 'rgba(120,200,170,0.05)'); sh.addColorStop(0.5, 'rgba(200,220,240,0.025)'); sh.addColorStop(1, 'rgba(120,140,220,0.04)');
  g.fillStyle = sh; g.fillRect(0, 0, CW, CH);
  const m = TL.merge, p = eio(clamp((t - 57.2) / (m - 57.2)));
  const tx = 1026, ty = 384;
  const gx = lerp(560, tx, p), gy = lerp(250, ty, p), wx = lerp(1330, tx, p), wy = lerp(560, ty, p);
  g.globalCompositeOperation = 'lighter';
  if (t < m) {
    glowDot(g, gx, gy, 46, '98,214,156', 0.55); glowDot(g, gx, gy, 7, '210,255,230', 1);
    glowDot(g, wx, wy, 42, '210,225,255', 0.5); glowDot(g, wx, wy, 6, '255,255,255', 1);
  } else {
    const b = clamp((t - m) / 0.5), bloom = 1 - Math.pow(1 - b, 2);
    glowDot(g, tx, ty, 46 + 120 * bloom, '170,235,215', 0.6 * (1 - 0.3 * b));
    glowDot(g, tx, ty, 9 + 6 * bloom, '255,255,255', 1);
    g.strokeStyle = `rgba(220,245,240,${0.35 * (1 - b * 0.5)})`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(tx - 140 * bloom, ty); g.lineTo(tx + 140 * bloom, ty); g.moveTo(tx, ty - 90 * bloom); g.lineTo(tx, ty + 90 * bloom); g.stroke();
  }
  g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(200,225,240,0.5)'; g.lineWidth = 3; g.shadowColor = 'rgba(200,225,240,0.8)'; g.shadowBlur = 12;
  g.beginPath(); g.arc(LC[0], LC[1], LR, -1.05, 0.95); g.stroke(); g.restore();
  g.strokeStyle = '#020304'; g.lineWidth = 26; g.beginPath(); g.arc(LC[0], LC[1], LR + 16, -1.2, 1.1); g.stroke();
  g.restore();
}

const SHOTS = [[0, 3, shot1], [3, 8, shot2], [8, 13, shot3], [13, 18, shot4], [18, 23, shot5], [23, 28, shot6], [28, 33, shot7], [33, 38, shot8], [38, 42, shot9], [42, 45, shot10], [45, 49, shot11], [49, 52, shot12], [52, 57, shot13], [57, 60.01, shot14]];
const LAYER_A = mk(CW, CH), LAYER_B = mk(CW, CH);
function drawShotAt(layer, t, idxOverride) {
  const g = layer.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  const i = idxOverride ?? SHOTS.findIndex(([a, b]) => t >= a && t < b);
  const [a, b, fn] = SHOTS[i];
  fn(g, t, clamp((t - a) / (b - a)), t - a);
}
function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawShotAt(LAYER_A, t);
  ctx.drawImage(LAYER_A, 0, BAR);
  if (t >= 52 && t < 52.6) { drawShotAt(LAYER_B, t, 11); ctx.globalAlpha = 1 - ss(52, 52.6, t); ctx.drawImage(LAYER_B, 0, BAR); ctx.globalAlpha = 1; }
  // grade: vignette + grain
  const vg = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, BAR, W, CH);
  const fi = Math.round(t * 24), gr = GRAIN[fi % GRAIN.length];
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16; ctx.drawImage(gr, (fi * 37) % 7 - 7, BAR + (fi * 13) % 5 - 5, CW + 14, CH + 10);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.025; ctx.drawImage(gr, 0, BAR, CW, CH); ctx.globalAlpha = 1;
  const fade = Math.max(1 - ss(0, 0.6, t), ss(TL.fade_out[0], TL.fade_out[1], t));
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, BAR); ctx.fillRect(0, H - BAR, W, BAR);
}

function shuffleCells(n, count, seed) { const r = mulberry32(seed); const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, count); }
async function init(tl) {
  TL = tl;
  await document.fonts.load(`20px ${FZH}`); await document.fonts.load(`20px ${FMONO}`);
  buildThumbs(); buildStarmap(); buildField(); buildSky(); buildGrain(); buildProfile(); buildBackHead(); buildShe12(); buildBokeh();
  STAMP_CELLS1 = shuffleCells(84, stampTimes(1).length, 8);
  // shot 2 cells must be on screen when stamped
  const st2 = stampTimes(2), used = new Set(), r = mulberry32(12);
  for (const s of st2) {
    const pan = -lerp(0, 260, (s - 3) / 5); let c, tries = 0;
    do { c = Math.floor(r() * 44); const x = 60 + pan + (c % 11) * 210 + 105; if (x > 160 && x < CW - 160 && !used.has(c)) break; } while (++tries < 500);
    used.add(c); STAMP_CELLS2.push(c);
  }
  return true;
}
window.init = init; window.renderFrame = renderFrame;
