// Themed scenes Clawd walks on: a static backdrop plus a 12-second loop of moving things.
// Logical pixels; the ground is the last GROUND rows. Port of art/Pix.kt and art/Scenes.kt from
// Pinch (https://github.com/YoussefAbdelkawy/Pinch, MIT, see LICENSE-pinch).
'use strict';
(function (CU) {
  const H = 30, GROUND = 3, LOOP = 120, FRAME_MS = 100;

  const c = (h) => {
    h = h.replace('#', '');
    return h.length === 6 ? (0xFF000000 | parseInt(h, 16)) >>> 0 : parseInt(h, 16) >>> 0;
  };
  const m = (o) => { const r = {}; for (const k in o) r[k] = c(o[k]); return r; };
  const withAlpha = (argb, a) => ((Math.max(0, Math.min(255, Math.trunc(255 * a))) << 24) | (argb & 0xFFFFFF)) >>> 0;
  const kround = (x) => Math.floor(x + 0.5);
  const ti = Math.trunc;

  function mix(a, b, t) {
    let out = 0;
    for (const sh of [24, 16, 8, 0]) out = (out | (ti(((a >>> sh) & 0xFF) * (1 - t) + ((b >>> sh) & 0xFF) * t) << sh)) >>> 0;
    return out;
  }

  function blend(dst, src) {
    const sa = (src >>> 24) / 255, da = (dst >>> 24) / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) return 0;
    let out = (ti(oa * 255) << 24) >>> 0;
    for (const sh of [16, 8, 0]) {
      const s = (src >>> sh) & 0xFF, d = (dst >>> sh) & 0xFF;
      out = (out | (Math.max(0, Math.min(255, ti((s * sa + d * da * (1 - sa)) / oa))) << sh)) >>> 0;
    }
    return out;
  }

  // Pinch's cheap deterministic noise, in 32-bit integer arithmetic.
  function noise(a, b) {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) & 0x7FFFFFFF;
  }

  // A small seeded generator (mulberry32), so a scene's stars stay put from frame to frame.
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return { random: next, int: (n) => Math.floor(next() * n), bool: () => next() < 0.5 };
  }
  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.px = new Uint32Array(w * h); }
    set(x, y, argb) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const a = argb >>> 24;
      if (a === 0) return;
      const i = y * this.w + x;
      this.px[i] = a === 255 ? argb : blend(this.px[i], argb);
    }
    rect(x, y, rw, rh, argb) { for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) this.set(xx, yy, argb); }
    fill(argb) { this.px.fill(argb); }
    vgradient(y0, y1, top, bottom) {
      const n = Math.max(1, y1 - y0);
      for (let y = y0; y < y1; y++) { const col = mix(top, bottom, (y - y0) / n); for (let x = 0; x < this.w; x++) this.set(x, y, col); }
    }
    art(rows, colors, x, y, flipX) {
      rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const col = colors[row[rx]];
          if (col === undefined) continue;
          this.set(x + (flipX ? row.length - 1 - rx : rx), y + ry, col);
        }
      });
    }
    glow(cx, cy, r, argb) {
      const a0 = argb >>> 24;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        this.set(x, y, ((ti(a0 * (1 - d) * (1 - d)) << 24) | (argb & 0xFFFFFF)) >>> 0);
      }
    }
    copy() { const p = new Pix(this.w, this.h); p.px.set(this.px); return p; }
    drawInto(dst) { for (let i = 0; i < this.px.length; i++) if (this.px[i]) dst.set(i % this.w, Math.floor(i / this.w), this.px[i]); }
    toImageData() {
      const img = new ImageData(this.w, this.h);
      const d = img.data;
      for (let i = 0; i < this.px.length; i++) {
        const v = this.px[i];
        d[i * 4] = (v >>> 16) & 0xFF; d[i * 4 + 1] = (v >>> 8) & 0xFF; d[i * 4 + 2] = v & 0xFF; d[i * 4 + 3] = v >>> 24;
      }
      return img;
    }
  }

  // ---------------------------------------------------------------- sprites ----
  const MOON = ['...mmmmm...', '..mmmmmmm..', '.mmmmmmcmm.', 'mmccmmmmmmm', 'mmccmmmmmmm',
    'mmmmmmmmccm', 'mmmmmmmmccm', '.mmmcmmmmm.', '..mmmmmmm..', '...mmmmm...'];
  const SUN = ['..ssss..', '.ssssss.', 'ssssssss', 'ssssssss', 'ssssssss', 'ssssssss', '.ssssss.', '..ssss..'];
  const TREE_DEAD = ['.t.....t....', '..t...t..t..', 't..t.t..t...', '.t..tt.t....', '..t.tttt....',
    '...ttt......', '....tt......', '....tt......', '....tt......', '...tttt.....'];
  const TOMB = ['..sss..', '.sssss.', 'sssdsss', 'ssdddss', 'sssdsss', 'sssdsss', 'sssssss', 'sssssss'];
  const CROSS = ['..c..', 'ccccc', '..c..', '..c..', '..c..', '..c..'];
  const PUMPKIN = ['....g....', '.ooogooo.', 'oyyoooyyo', 'ooyoooyoo', 'ooooooooo', 'oyoyyyoyo', '.oyyyyyo.'];
  const BAT_UP = ['b.........b', 'bb..b.b..bb', '.bbbrbrbbb.', '....bbb....'];
  const BAT_DOWN = ['....b.b....', '..bbrbrbb..', '.bbbbbbbbb.', 'bb.......bb'];
  const GHOST = ['..www..', '.wwwww.', 'wkwwkww', 'wwwwwww', 'wwwwwww', 'w.w.w.w'];
  const XMAS_TREE = ['....y....', '...ggg...', '..ggggg..', '...ggg...', '..ggggg..', '.ggggggg.',
    '..ggggg..', '.ggggggg.', 'ggggggggg', '....b....', '....b....'];
  const SNOWMAN = ['..kkk..', '..kkk..', '.kkkkk.', '..www..', '..wkw..', '..wow..', '.wwwww.',
    'wwwkwww', 'wwwwwww', 'wwwkwww', '.wwwww.'];
  const PRESENT = ['..r.r..', '...r...', 'ggrrrgg', 'ggrrrgg', 'rrrrrrr', 'ggrrrgg', 'ggrrrgg'];
  const HEART = ['.hh.hh.', 'hhhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...'];
  const HEART_S = ['h.h', 'hhh', '.h.'];
  const TULIP = ['p.p.p', 'ppppp', '.ppp.', '..g..', 'g.g..', '.gg..', '..g..'];
  const DAISY = ['.w.', 'wyw', '.w.', '.g.', '.g.'];
  const BFLY_A = ['pp.pp', 'ppkpp', '.pkp.', 'pp.pp'];
  const BFLY_B = ['.....', 'ppkpp', 'ppkpp', '.....'];
  const PALM = ['..gg.gg..', '.g..g..g.', 'g..ggg..g', '....t....', '....t....', '...t.....',
    '...t.....', '...t.....', '..t......', '..t......', '..tt.....'];
  const GULL_A = ['w...w', '.w.w.', '..w..'];
  const GULL_B = ['.....', 'ww.ww', '..w..'];
  const PLANET = ['......pppp......', '....pppppppp....', 'rr.pppppqqpppp.r', '.rrrrrrrrrrrrrr.',
    '...pppppppppp...', '....pppppppp....', '......pppp......'];
  const CORAL = ['p.p.p', 'p.p.p', '.ppp.', '..p..', '..p..'];
  const FISH = ['.oo.o', 'ooooo', '.oo.o'];
  const SKYLINE = [
    '......bbb.............bbbb...........bbb......',
    '......bbb....bbbbb....bbbb...bbb.....bbb......',
    '..bb..bbb....bbbbb....bbbb...bbb..bb.bbb..bb..',
    '..bb..bbbbb..bbbbb.bbbbbbb...bbbbbbb.bbbbbbb..',
    'bbbbbbbbbbb..bbbbbbbbbbbbbbb.bbbbbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ];
  const CLOUD = ['..www....', '.wwwwww..', 'wwwwwwwww'];

  const SAND = { christmas: '#E2E8F0', halloween: '#3F2F52', space: '#6B7280', cyberpunk: '#334155',
    spring: '#65A30D', oled: '#27272A', midnight: '#1E3A5F', valentine: '#DB2777' };
  const sand = (scene) => SAND[scene] || '#D6B98C';

  function stars(p, r, maxY, color, density = 0.03) {
    const n = ti(p.w * maxY * density / 3);
    for (let i = 0; i < n; i++) { const x = r.int(p.w), y = r.int(Math.max(1, maxY)); p.set(x, y, withAlpha(color, 0.35 + r.random() * 0.5)); }
  }

  function ground(p, r, base, speck, top = 0) {
    const gy = H - GROUND + top;
    p.rect(0, gy, p.w, H - gy, base);
    for (let x = 0; x < p.w; x++) {
      if (r.int(4) === 0) p.set(x, gy + 1 + r.int(GROUND - 1 - top), speck);
      if (top === 0 && r.int(6) === 0) p.set(x, gy, speck);
    }
  }

  // --------------------------------------------------------------- backdrop ----
  function background(scene, w, hour) {
    const p = new Pix(w, H);
    const r = rng(strHash(scene));
    const night = hour < 7 || hour >= 19;
    const gy = H - GROUND;
    switch (scene) {
      case 'halloween':
        p.vgradient(0, gy, c('#120B1C'), c('#2A1D38'));
        stars(p, r, gy - 8, c('#C4B5FD'));
        p.glow(w - 22, 8, 12, c('#80FDBA74'));
        p.art(MOON, m({ m: '#FDE68A', c: '#F5C66B' }), w - 28, 3);
        p.art(TREE_DEAD, m({ t: '#5B4A66' }), ti(w * 0.08), gy - 10);
        p.art(TOMB, m({ s: '#6B6478', d: '#453E52' }), ti(w * 0.31), gy - 8);
        p.art(CROSS, m({ c: '#6B6478' }), ti(w * 0.40), gy - 6);
        p.art(['.sssss.', 'sssssss', 'sdsdsds', 'sssssss', 'sssssss'], m({ s: '#6B6478', d: '#453E52' }), ti(w * 0.66), gy - 5);
        for (const fx of [0.22, 0.56, 0.86]) {
          const x = ti(w * fx);
          p.glow(x + 4, gy - 4, 8, c('#70FB923C'));
          p.art(PUMPKIN, m({ o: '#EA580C', g: '#4D7C0F', y: '#7C2D12' }), x, gy - 7);
        }
        ground(p, r, c('#2E1F3D'), c('#3F2F52'));
        break;
      case 'christmas':
        p.vgradient(0, gy, c('#081226'), c('#1E3A5F'));
        stars(p, r, gy - 10, c('#E0F2FE'));
        p.glow(w - 20, 7, 9, c('#60E0F2FE'));
        p.art(MOON, m({ m: '#F1F5F9', c: '#CBD5E1' }), w - 26, 2);
        p.art(XMAS_TREE, m({ g: '#15803D', y: '#FDE047', b: '#78350F' }), ti(w * 0.12), gy - 11);
        p.art(PRESENT, m({ r: '#DC2626', g: '#16A34A' }), ti(w * 0.12) + 9, gy - 7);
        p.art(SNOWMAN, m({ k: '#111827', w: '#F8FAFC', o: '#F97316' }), ti(w * 0.72), gy - 11);
        p.art(PRESENT, m({ r: '#2563EB', g: '#FBBF24' }), ti(w * 0.84), gy - 7);
        ground(p, r, c('#E2E8F0'), c('#CBD5E1'));
        break;
      case 'valentine':
        p.vgradient(0, gy, c('#2A0A1F'), c('#6B1D45'));
        stars(p, r, gy - 8, c('#FBCFE8'));
        p.glow(w - 20, 9, 11, c('#70F472B6'));
        p.art(HEART, m({ h: '#F43F5E' }), w - 24, 5);
        for (const fx of [0.1, 0.35, 0.62, 0.9]) p.art(DAISY, m({ w: '#FBCFE8', y: '#F43F5E', g: '#65A30D' }), ti(w * fx), gy - 5);
        ground(p, r, c('#9D174D'), c('#BE185D'));
        break;
      case 'spring':
        if (night) { p.vgradient(0, gy, c('#0F1B2D'), c('#1F3B4D')); stars(p, r, gy - 8, c('#E0F2FE')); }
        else { p.vgradient(0, gy, c('#3B6E99'), c('#9CC8E0')); p.glow(w - 18, 8, 10, c('#80FDE68A')); p.art(SUN, m({ s: '#FDE047' }), w - 22, 4); }
        for (const fx of [0.06, 0.24, 0.48, 0.7, 0.92]) p.art(TULIP, m({ p: ['#F472B6', '#FB7185', '#C084FC'][ti(fx * 10) % 3], g: '#16A34A' }), ti(w * fx), gy - 7);
        for (const fx of [0.15, 0.38, 0.6, 0.82]) p.art(DAISY, m({ w: '#F8FAFC', y: '#FDE047', g: '#16A34A' }), ti(w * fx), gy - 5);
        ground(p, r, c('#4D7C0F'), c('#65A30D'));
        break;
      case 'summer':
        if (night) {
          p.vgradient(0, gy - 5, c('#0B1530'), c('#3B2A55'));
          stars(p, r, gy - 12, c('#FEF3C7'));
          p.art(MOON, m({ m: '#FDE68A', c: '#F5C66B' }), w - 26, 3);
        } else {
          p.vgradient(0, gy - 5, c('#F59E0B'), c('#FDBA74'));
          p.glow(Math.floor(w / 2), gy - 6, 14, c('#90FDE047'));
          p.art(SUN, m({ s: '#FEF08A' }), Math.floor(w / 2) - 4, gy - 11);
        }
        p.rect(0, gy - 5, w, 5, c(night ? '#1E3A5F' : '#0E7490'));
        p.art(PALM, m({ g: '#15803D', t: '#92400E' }), ti(w * 0.08), gy - 11);
        p.art(PALM, m({ g: '#166534', t: '#78350F' }), ti(w * 0.82), gy - 11, true);
        ground(p, r, c('#E8C98E'), c('#D6B07A'));
        break;
      case 'space':
        p.vgradient(0, gy, c('#06030F'), c('#1C1436'));
        stars(p, r, gy - 2, c('#FFFFFF'), 0.06);
        p.art(PLANET, m({ p: '#A78BFA', q: '#C4B5FD', r: '#F9A8D4' }), w - 28, 4);
        ground(p, r, c('#4B5563'), c('#6B7280'));
        for (let i = 0; i < Math.floor(w / 18); i++) p.rect(r.int(w), H - GROUND, 3, 1, c('#374151'));
        break;
      case 'ocean':
        p.vgradient(0, gy, c('#0E4A6E'), c('#06263D'));
        for (let i = 0; i < w; i += 9) p.set(i + r.int(5), 1, c('#4022D3EE'));
        for (const fx of [0.17, 0.66, 0.93]) p.art(CORAL, m({ p: '#F472B6' }), ti(w * fx), gy - 5);
        ground(p, r, c('#C2A878'), c('#A88F63'));
        break;
      case 'cyberpunk': {
        p.vgradient(0, gy, c('#05040A'), c('#1A1033'));
        for (let x = 0; x < w; x += SKYLINE[0].length) p.art(SKYLINE, m({ b: '#141024' }), x, gy - SKYLINE.length);
        for (let i = 0; i < Math.floor(w / 3); i++) {
          const wx = r.int(w), wy = gy - 1 - r.int(5);
          if (wy >= gy - 5) p.set(wx, wy, r.bool() ? c('#FF00E5FF') : c('#FFF0ABFC'));
        }
        p.rect(0, gy, w, 1, c('#00E5FF'));
        ground(p, r, c('#0F172A'), c('#1E293B'), 1);
        break;
      }
      case 'oled':
        p.fill(c('#000000'));
        stars(p, r, gy - 4, c('#9CA3AF'), 0.012);
        p.art(['..mm', '.m..', 'm...', 'm...', 'm...', '.m..', '..mm'], m({ m: '#E5E7EB' }), w - 16, 4);
        p.rect(0, gy, w, 1, c('#27272A'));
        break;
      case 'midnight':
        p.vgradient(0, gy, c('#020617'), c('#172554'));
        stars(p, r, gy - 8, c('#BFDBFE'), 0.04);
        p.glow(w - 20, 7, 9, c('#50BFDBFE'));
        p.art(MOON, m({ m: '#E0E7FF', c: '#C7D2FE' }), w - 26, 2);
        for (let x = 0; x < w; x++) {
          const far = kround(8 + 3.5 * Math.sin(x / 9) + 2 * Math.sin(x / 4.3 + 1));
          for (let y = gy - far; y < gy; y++) p.set(x, y, c('#1E3A8A'));
          const near = kround(4 + 2 * Math.sin(x / 6.5 + 2) + 1.2 * Math.sin(x / 3.1));
          for (let y = gy - near; y < gy; y++) p.set(x, y, c('#0F1E4A'));
        }
        ground(p, r, c('#0B1530'), c('#1E3A5F'));
        break;
      default: { // 'beach': Clawd's home, sky by the time of day
        const [top, bottom] = hour >= 5 && hour <= 6 ? ['#2E2350', '#B4615A'] : hour >= 7 && hour <= 17 ? ['#1E3A5F', '#4B7AA8']
          : hour >= 18 && hour <= 19 ? ['#3B2A55', '#C2703D'] : ['#0B1222', '#1E293B'];
        p.vgradient(0, gy, c(top), c(bottom));
        if (night) { stars(p, r, gy - 6, c('#E0F2FE')); p.glow(w - 20, 8, 10, c('#60FDE68A')); p.art(MOON, m({ m: '#FDE68A', c: '#F5C66B' }), w - 26, 3); }
        else { p.glow(w - 18, 8, 11, c('#80FDE68A')); p.art(SUN, m({ s: '#FDE047' }), w - 22, 4); }
        p.rect(0, gy - 3, w, 3, c(night ? '#1E3A5F' : '#2B6CA3'));
        ground(p, r, c('#D6B98C'), c('#C2A170'));
      }
    }
    return p;
  }

  // -------------------------------------------------------------- animation ----
  // What moves at frame t of a loop of n frames. Everything is periodic in n, so the loop has no seam.
  function fx(scene, w, hour, t, n = LOOP) {
    const p = new Pix(w, H);
    const r = rng((Math.imul(strHash(scene), 31) + 7) >>> 0);
    const gy = H - GROUND;
    const night = hour < 7 || hour >= 19;
    const u = t / n;
    const across = (x0, span, laps) => (((x0 + u * span * laps) % span) + span) % span;
    const wave = (cycles, ph = 0) => Math.sin(2 * Math.PI * (u * cycles + ph));
    const flap = (period, offset = 0) => Math.floor((t + offset) / period) % 2 === 0;
    switch (scene) {
      case 'halloween': {
        const bat = m({ b: '#7353A0', r: '#F87171' });
        [[0.1, 4, 1], [0.55, 9, 1]].forEach(([x0, y0, laps], i) => {
          const x = ti(across(x0 * (w + 22), w + 22, laps)) - 11;
          const y = y0 + kround(2 * wave(2, i * 0.3));
          p.art(flap(3, i) ? BAT_UP : BAT_DOWN, bat, x, y);
        });
        const gx = (w + 8) - ti(across(0.3 * (w + 8), w + 16, 1));
        p.art(GHOST, m({ w: '#C8F5F3FF', k: '#1C1326' }), gx, 3 + kround(1.5 * wave(2)));
        [0.22, 0.56, 0.86].forEach((f, i) => {
          const dim = noise(Math.floor(t / 4), i) % 7 === 0;
          p.art(PUMPKIN, m({ y: dim ? '#FB923C' : '#FDE047' }), ti(w * f), gy - 7);
        });
        for (let i = 0; i < 4; i++) {
          const x = ti(w * (0.15 + 0.23 * i) + 6 * wave(1, i * 0.27));
          const y = ti(gy - 9 + 3 * wave(2, i * 0.41));
          const a = 0.35 + 0.35 * ((wave(2, i * 0.5) + 1) / 2);
          p.glow(x, y, 3, withAlpha(c('#4ADE80'), a * 0.6));
          p.set(x, y, withAlpha(c('#BBF7D0'), a + 0.2));
        }
        break;
      }
      case 'christmas': {
        for (let i = 0; i < Math.floor(w / 3); i++) {
          const y = ti(across(r.random() * gy, gy, 1));
          const x = ti(r.random() * w + 1.5 * wave(2, r.random()));
          p.set(x, y, c(i % 2 === 0 ? '#F8FAFC' : '#B0E2E8F0'));
        }
        const tx = ti(w * 0.12);
        const cols = ['#EF4444', '#FDE047', '#60A5FA', '#F472B6'];
        [[3, 2], [5, 4], [2, 5], [6, 7], [1, 8], [4, 7], [7, 8]].forEach(([lx, ly], i) =>
          p.set(tx + lx, gy - 11 + ly, c(cols[(i + Math.floor(t / 6)) % cols.length])));
        p.glow(tx + 4, gy - 11, 3, withAlpha(c('#FDE047'), 0.4 + 0.3 * wave(3)));
        break;
      }
      case 'valentine':
        for (let i = 0; i < 7; i++) {
          const y = gy - 3 - across(r.random() * gy, gy, 1);
          const x = ti(r.random() * w + 2 * wave(2, r.random()));
          const a = Math.max(0.15, Math.min(1, y / gy));
          p.art(HEART_S, { h: withAlpha(c(i % 2 === 0 ? '#F9A8D4' : '#FB7185'), a) }, x, ti(y));
        }
        break;
      case 'spring':
        for (let i = 0; i < 3; i++) {
          const x = ti(w * (0.2 + 0.3 * i) + 10 * wave(1, i * 0.33));
          const y = ti(8 + 3 * i + 3 * wave(2, i * 0.33));
          p.art(flap(3, i) ? BFLY_A : BFLY_B, m({ p: ['#F9A8D4', '#FDE047', '#C4B5FD'][i], k: '#1F2937' }), x, y);
        }
        for (let i = 0; i < 6; i++) {
          const x = ti(across(r.random() * w, w, 1)), y = ti(across(r.random() * gy, gy, 1));
          p.set(x, y, c('#D0FBCFE8'));
        }
        break;
      case 'summer':
        for (let x = 0; x < w; x++) if ((x + Math.floor(t / 2)) % 9 === 0) p.set(x, gy - 5 + Math.floor(x / 9) % 2, c(night ? '#6093C5FD' : '#C0E0F2FE'));
        if (!night) for (let i = 0; i < 2; i++) {
          const x = ti(across(i * 0.5 * (w + 10), w + 10, 1)) - 5;
          p.art(flap(4, i) ? GULL_A : GULL_B, m({ w: '#F8FAFC' }), x, 4 + i * 4 + kround(wave(2, i * 0.5)));
        }
        break;
      case 'space': {
        for (let i = 0; i < Math.floor(w / 7); i++) {
          const x = r.int(w), y = r.int(gy - 2);
          if (wave(1 + i % 3, r.random()) > 0.6) {
            p.set(x, y, c('#FFFFFFFF'));
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) p.set(x + dx, y + dy, c('#70FFFFFF'));
          }
        }
        const rx = ti(across(0.2 * (w + 10), w + 10, 1)) - 5, ry = 7 + kround(wave(2));
        p.art(['..w..', '.www.', 'wwbww', '.www.', 'r...r'], m({ w: '#E5E7EB', b: '#60A5FA', r: '#F97316' }), rx, ry);
        p.set(rx - 1, ry + 2, c(flap(2) ? '#FDE047' : '#F97316'));
        p.set(rx - 2, ry + 2, c('#80F97316'));
        const s = t - Math.floor(n / 3);
        if (s >= 0 && s <= 7) for (let k = 0; k < 4; k++) p.set(Math.floor(w / 2) + (s - k) * 3, 2 + (s - k), withAlpha(c('#FFFFFF'), 1 - k * 0.25));
        break;
      }
      case 'ocean':
        [0.05, 0.3, 0.55, 0.78].forEach((f, i) => {
          const bx = ti(w * f);
          for (let k = 0; k < 8; k++) p.set(bx + kround(1.2 * wave(2, i * 0.25 + k * 0.06) * k / 8) + (k % 2), gy - 1 - k, c('#15803D'));
        });
        for (let i = 0; i < 7; i++) {
          const y = gy - 2 - ti(across(r.random() * gy, gy, 1));
          const x = ti(r.random() * w + wave(2, r.random()));
          p.art(['.b.', 'b.b', '.b.'], m({ b: '#B0E0F2FE' }), x, y);
        }
        p.art(FISH, m({ o: '#FB923C' }), ti(across(0, w + 8, 1)) - 4, 8 + kround(wave(2)), true);
        p.art(FISH, m({ o: '#FDE047' }), w + 4 - ti(across(0.5 * w, w + 8, 1)), 14 + kround(wave(3, 0.5)));
        break;
      case 'cyberpunk': {
        for (let i = 0; i < Math.floor(w / 3); i++) {
          const x0 = r.random() * w;
          const y = ti(across(r.random() * gy, gy, 2));
          const x = ti((((x0 - y * 0.3) % w) + w) % w);
          p.set(x, y, c('#507DF9FF'));
          p.set(x, y + 1, c('#307DF9FF'));
        }
        const off = noise(Math.floor(t / 2), 9) % 11 === 0 || noise(Math.floor(t / 2), 3) % 13 === 0;
        if (!off) p.art(['.c..ccc', 'c.c..c.', 'ccc..c.', 'c.c..c.', 'c.c.ccc'], m({ c: '#F0ABFC' }), ti(w * 0.62), 3);
        p.art(['.cccc.', 'cyccyc', '.k..k.'], m({ c: '#334155', y: '#FDE047', k: '#00E5FF' }), ti(across(0, w + 12, 1)) - 6, 10);
        break;
      }
      case 'oled': {
        for (let i = 0; i < Math.floor(w / 14); i++) {
          const x = r.int(w), y = r.int(gy - 4);
          if (wave(1 + i % 3, r.random()) > 0.5) p.set(x, y, c('#FFFFFFFF'));
        }
        const s = t - Math.floor(n / 2);
        if (s >= 0 && s <= 6) for (let k = 0; k < 3; k++) p.set(Math.floor(w / 4) + (s - k) * 3, 2 + (s - k), withAlpha(c('#FFFFFF'), 1 - k * 0.3));
        break;
      }
      case 'midnight':
        for (let x = 0; x < w; x++) {
          const y = kround(5 + 2.5 * Math.sin(2 * Math.PI * (x / 40 + u)) + 1.5 * wave(1, x / 90));
          const a = 0.35 + 0.25 * Math.sin(2 * Math.PI * (x / 25 - u * 2));
          for (let k = 0; k < 4; k++) p.set(x, y + k, withAlpha(c(k < 2 ? '#34D399' : '#22D3EE'), a * (1 - k * 0.22)));
        }
        for (let i = 0; i < Math.floor(w / 10); i++) {
          const x = r.int(w), y = 10 + r.int(gy - 18);
          if (wave(1 + i % 3, r.random()) > 0.65) p.set(x, y, c('#FFFFFFFF'));
        }
        for (let i = 0; i < 3; i++) {
          const x = ti(w * (0.2 + 0.3 * i) + 8 * wave(1, i * 0.3));
          const y = ti(gy - 3 + 1.5 * wave(2, i * 0.4));
          p.set(x, y, withAlpha(c('#FDE047'), Math.max(0.15, 0.5 + 0.5 * wave(3, i * 0.2))));
        }
        break;
      default: // beach
        if (night) {
          for (let i = 0; i < Math.floor(w / 8); i++) {
            const x = r.int(w), y = r.int(gy - 6);
            if (wave(1 + i % 3, r.random()) > 0.7) { p.set(x, y, c('#FFFFFFFF')); p.set(x + 1, y, c('#80FFFFFF')); p.set(x - 1, y, c('#80FFFFFF')); }
          }
        } else {
          p.art(CLOUD, m({ w: '#C0F8FAFC' }), ti(across(0.15 * (w + 10), w + 10, 1)) - 9, 4);
          p.art(CLOUD, m({ w: '#90F8FAFC' }), ti(across(0.6 * (w + 40), w + 40, 1)) - 24, 9);
          p.art(flap(4) ? GULL_A : GULL_B, m({ w: '#F8FAFC' }), w - ti(across(0.4 * w, w + 10, 1)), 6 + kround(wave(2)));
        }
        for (let x = 0; x < w; x++) if ((x + Math.floor(t / 2)) % 7 === 0) p.set(x, gy - 3, c('#A0E0F2FE'));
    }
    return p;
  }

  // Finished frames (backdrop + moving things), rebuilt when the scene, width or hour changes.
  class SceneCache {
    constructor() { this.key = ''; this.bg = null; this.frames = new Map(); }
    frame(scene, w, hour, t) {
      const key = `${scene}|${w}|${hour}`;
      if (key !== this.key) { this.key = key; this.bg = background(scene, w, hour); this.frames.clear(); }
      let img = this.frames.get(t);
      if (!img) { const p = this.bg.copy(); fx(scene, w, hour, t).drawInto(p); img = p.toImageData(); this.frames.set(t, img); }
      return img;
    }
  }

  CU.scenes = { H, GROUND, LOOP, FRAME_MS, c, withAlpha, kround, sand, SceneCache, HEART_S };
})(window.CU = window.CU || {});
