// Clawd's outfits, the props some of them hold, and those outfits' routines.
// Port of art/Skins.kt, art/Props.kt and the routines in art/Stage.kt from Pinch
// (https://github.com/YoussefAbdelkawy/Pinch, MIT, see LICENSE-pinch). Coordinates are in
// Clawd's 18 x 12 pixel grid; rows above his head are negative.
'use strict';
(function (CU) {
  const { c, withAlpha, kround } = CU.scenes;
  const GW = 18;
  const CLASSIC = { id: 'classic', name: 'None', body: '#D77757', eyes: '#141416', layers: [] };
  const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

  // '#AARRGGBB' (the outfit files' order) -> CSS colour.
  function css(hex) {
    const h = hex.replace('#', '');
    if (h.length === 6) return '#' + h;
    return `rgba(${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${parseInt(h.slice(6, 8), 16)},${parseInt(h.slice(0, 2), 16) / 255})`;
  }

  function parse(id, raw) {
    const mt = /^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/.exec(raw.replace(/^﻿/, ''));
    if (!mt) return null;
    let name = id, body = CLASSIC.body, eyes = CLASSIC.eyes, top = null;
    const colors = {};
    for (const line of mt[1].split(/\r?\n/)) {
      const kv = /^\s*(\w+)\s*:\s*(.*?)\s*$/.exec(line);
      if (!kv) continue;
      const [, k, v] = kv;
      const ok = HEX.test(v);
      if (k === 'name') name = v;
      else if (k === 'body' && ok) body = v;
      else if (k === 'eyes' && ok) eyes = v;
      else if (k === 'top') { const n = parseInt(v, 10); if (!isNaN(n)) top = n; }
      else if (k.length === 1 && ok) colors[k] = v;
    }
    const rows = mt[2].split(/\r?\n/).map((r) => r.replace(/\s+$/, ''));
    while (rows.length && !rows[rows.length - 1]) rows.pop();
    const start = top !== null ? top : -rows.length;
    const byColor = {};
    rows.forEach((row, y) => {
      for (let x = 0; x < Math.min(row.length, GW); x++) {
        const ch = row[x];
        if (colors[ch]) (byColor[ch] = byColor[ch] || []).push([x, start + y]);
      }
    });
    return { id, name, body: css(body), eyes: css(eyes), layers: Object.keys(byColor).map((ch) => [css(colors[ch]), byColor[ch]]) };
  }

  function loadAll(files) {
    const out = { classic: CLASSIC };
    for (const id of Object.keys(files).sort()) { const s = parse(id, files[id]); if (s) out[id] = s; }
    return out;
  }

  // ------------------------------------------------------------------ props ----
  const ROUTINES = ['chef', 'programmer', 'wizard', 'detective'];
  const TOSS = [2, 4, 6, 7, 8, 8, 7, 6, 4, 2, 1];
  const WAVE = [1, 2, 3, 4, 3, 2, 1, 2, 3];
  const CAST = 8;
  const WAND_ANGLE = [45, 0, 30, 70, 100];
  const LENS_EYE = 1, LENS_GROUND = 2;
  const PAN_RIM = c('#52525B'), PAN = c('#27272A'), HANDLE = c('#3F3F46');
  const PANCAKE = c('#F59E0B'), PANCAKE_TOP = c('#FCD34D'), PANCAKE_UNDER = c('#B45309'), STEAM = c('#E4E4E7');
  const LID = c('#1F1F23'), LID_EDGE = c('#3F3F46'), LOGO = c('#E5E7EB');
  const BASE = c('#71717A'), BASE_TOP = c('#A1A1AA'), SCREEN_GLOW = c('#60A5FA');
  const WAND = c('#5B3A29'), SPARK = c('#FDE047'), SPARK_HI = c('#FFFBEB'), MAGIC = c('#C4B5FD');
  const LENS_RIM = c('#27272A'), LENS = c('#B3E0F2FE'), GLINT = c('#FFFFFF'), LENS_HANDLE = c('#3F342D');
  const PIPE = c('#7C4A2D'), PIPE_STEM = c('#3F2A1D'), SMOKE = c('#D4D4D8'), PUPIL = c('#141416');
  const RING = ['.rrr.', 'r...r', 'r...r', 'r...r', '.rrr.'];
  const PLUS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  class Dots {
    constructor() { this.px = []; }
    set(x, y, argb) { if (argb >>> 24) this.px.push([x, y, argb]); }
    rect(x, y, w, h, argb) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, argb); }
    art(rows, colors, x, y) { rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (colors[row[rx]] !== undefined) this.set(x + rx, y + ry, colors[row[rx]]); }); }
  }

  // What the outfit holds, as [x, y, argb] pixels. x, y: Clawd's grid top-left as drawn; rest: the grid top when standing.
  function props(id, f, t, x, y, rest) {
    const p = new Dots();
    if (id === 'chef') chef(p, f, t, x, y);
    else if (id === 'programmer') programmer(p, f, t, x, rest);
    else if (id === 'wizard') wizard(p, f, t, x, y);
    else if (id === 'detective') detective(p, f, t, x, y);
    return p.px;
  }

  function chef(p, f, t, x, y) {
    const py = y - (f.arms === 'up' ? 1 : 0); // the pan comes up a row as he tosses
    p.set(x + 18, py + 5, HANDLE); p.set(x + 19, py + 5, HANDLE);
    p.rect(x + 20, py + 4, 7, 1, PAN_RIM); p.rect(x + 21, py + 5, 5, 1, PAN);
    const step = f.prop || 0;
    if (step <= 0 || step > TOSS.length) {
      p.rect(x + 21, py + 3, 5, 1, PANCAKE); p.rect(x + 22, py + 3, 3, 1, PANCAKE_TOP);
      for (const i of [0, 1]) {
        const s = (Math.floor(t / 4) + i * 4) % 8;
        p.set(x + 22 + i * 2 + Math.floor(s / 3) % 2, py + 2 - s, withAlpha(STEAM, 0.75 - s * 0.09));
      }
      if (Math.floor(t / 3) % 7 === 0) p.set(x + 26, py + 3, PANCAKE_TOP);
    } else {
      const cy = py + 3 - TOSS[step - 1], k = step % 4;
      if (k === 1 || k === 3) { p.set(x + 23, cy - 1, PANCAKE); p.set(x + 23, cy, PANCAKE_UNDER); }
      else if (k === 2) p.rect(x + 21, cy, 5, 1, PANCAKE_UNDER);
      else { p.rect(x + 21, cy, 5, 1, PANCAKE); p.rect(x + 22, cy, 3, 1, PANCAKE_TOP); }
    }
  }

  function programmer(p, f, t, x, rest) {
    const gy = rest + 9;
    p.rect(x + 12, gy, 12, 1, BASE); p.rect(x + 12, gy - 1, 6, 1, BASE_TOP);
    p.rect(x + 17, gy - 7, 7, 7, LID); p.rect(x + 17, gy - 7, 1, 7, LID_EDGE); p.rect(x + 17, gy - 7, 7, 1, LID_EDGE);
    p.set(x + 20, gy - 4, LOGO); p.set(x + 21, gy - 4, LOGO); p.set(x + 21, gy - 3, LOGO);
    if (f.arms === 'right') p.set(x + 13 + (t * 3) % 4, gy - 1, LOGO);
    const glow = 0.18 + 0.12 * (Math.floor(t / 3) % 3);
    for (let dy = 2; dy < 6; dy++) p.set(x + 15, rest + 4 + dy, withAlpha(SCREEN_GLOW, glow));
  }

  function wandTip(x, y, angle) {
    const a = angle * Math.PI / 180;
    return [kround(x + 17 + 4 * Math.sin(a)), kround(y + 5 - 4 * Math.cos(a))];
  }

  function wizard(p, f, t, x, y) {
    const prop = f.prop || 0;
    const waving = prop >= 1 && prop <= WAVE.length, casting = prop > WAVE.length;
    const angle = waving ? WAND_ANGLE[WAVE[prop - 1]] : casting ? WAND_ANGLE[3] : WAND_ANGLE[0];
    const a = angle * Math.PI / 180;
    for (let k = 1; k <= 3; k++) p.set(kround(x + 17 + k * Math.sin(a)), kround(y + 5 - k * Math.cos(a)), WAND);
    const [tx, ty] = wandTip(x, y, angle);
    p.set(tx, ty, SPARK_HI);
    if (waving) {
      for (let back = 1; back <= 3; back++) {
        const prev = prop - back;
        if (prev < 1) break;
        const [sx, sy] = wandTip(x, y, WAND_ANGLE[WAVE[prev - 1]]);
        p.set(sx, sy, withAlpha(back === 1 ? SPARK : MAGIC, 1 - back * 0.28));
      }
    } else if (casting) {
      const k = prop - WAVE.length, r = 1 + k, fade = 1 - k / (CAST + 1);
      for (let i = 0; i < 10; i++) {
        const ang = Math.PI * 2 * i / 10 + k * 0.2;
        const col = i % 3 === 0 ? MAGIC : i % 2 === 0 ? SPARK_HI : SPARK;
        p.set(tx + kround(r * Math.cos(ang)), ty + kround(r * 0.7 * Math.sin(ang)), withAlpha(col, fade));
      }
      if (k < 3) for (const [ax, ay] of PLUS) p.set(tx + ax, ty + ay, SPARK_HI);
    } else {
      if (Math.floor(t / 3) % 8 < 2) for (const [ax, ay] of PLUS) p.set(tx + ax, ty + ay, withAlpha(SPARK, 0.7));
      if (Math.floor(t / 5) % 6 === 0) p.set(tx + 1, ty - 2, MAGIC);
    }
  }

  function lens(p, lx, ly, t) {
    p.rect(lx + 1, ly + 1, 3, 3, LENS);
    p.art(RING, { r: LENS_RIM }, lx, ly);
    const g = Math.floor(t / 6) % 8;
    if (g < 3) p.set(lx + 1 + Math.floor(g / 2), ly + 1 + Math.floor(g / 2), GLINT);
  }

  function detective(p, f, t, x, y) {
    p.set(x + 6, y + 5, PIPE_STEM); p.set(x + 5, y + 6, PIPE_STEM);
    p.rect(x + 2, y + 6, 3, 2, PIPE); p.set(x + 2, y + 5, PIPE);
    for (let i = 0; i < 3; i++) {
      const s = (Math.floor(t / 4) + i * 5) % 14;
      const sx = x + 3 - Math.floor(s / 4) + (Math.floor(s / 2) % 2 === 0 ? 0 : 1);
      p.set(sx, y + 4 - s, withAlpha(SMOKE, Math.max(0, 0.7 - s * 0.05)));
    }
    const prop = f.prop || 0;
    if (prop === LENS_EYE) {
      const lx = x + 11, ly = y;
      p.set(x + 16, y + 5, LENS_HANDLE); p.set(x + 17, y + 6, LENS_HANDLE);
      lens(p, lx, ly, t);
      p.rect(lx + 1 + Math.floor(Math.max(0, Math.min(2, f.look + 1)) / 2), ly + 2, 2, 2, PUPIL);
    } else if (prop === LENS_GROUND) {
      p.set(x + 18, y + 6, LENS_HANDLE); p.set(x + 19, y + 6, LENS_HANDLE);
      lens(p, x + 20, y + 5, t);
    } else {
      p.set(x + 18, y + 6, LENS_HANDLE); p.set(x + 19, y + 5, LENS_HANDLE);
      lens(p, x + 19, y + 1, t);
    }
  }

  // --------------------------------------------------------------- routines ----
  const STRIDE = ['both', 'left', 'both', 'right']; // a lifted leg never stays up two frames
  const fr = (o) => Object.assign({ eyes: 'open', arms: 'down', feet: 'both', look: 0, off: 0, lift: 0, prop: 0 }, o);

  class Builder {
    constructor(start, maxX) { this.out = []; this.x = start; this.maxX = maxX; }
    hold(k, f) { for (let i = 0; i < k; i++) this.out.push([this.x, f]); }
    holdFn(k, fn) { for (let i = 0; i < k; i++) this.out.push([this.x, fn(this.out.length)]); }
    walk(dx, every, base) {
      const d = Math.sign(dx);
      for (let s = 0; s < Math.abs(dx) * every; s++) {
        if (s % every === every - 1) this.x += d;
        this.out.push([this.x, Object.assign({}, base(this.out.length), { look: d, feet: STRIDE[s % STRIDE.length] })]);
      }
    }
    fill(n, fn) { while (this.out.length < n) this.out.push([this.x, fn(this.out.length)]); }
    room(d) { return d > 0 ? this.maxX - this.x : this.x; }
    roomyDir() { return this.maxX - this.x >= this.x ? 1 : -1; }
  }

  // The outfit's own loop as a list of [grid x, frame]; it ends where and how it began. lift is in pixels.
  function routine(id, tired, start, maxX, n = 120) {
    const b = new Builder(start, maxX);
    const eyes = (e) => (tired && e === 'open' ? 'focus' : e);
    if (id === 'chef') {
      while (b.out.length + 40 <= n) {
        b.holdFn(8, () => fr({ eyes: eyes('open'), look: 1 }));
        b.hold(1, fr({ eyes: 'blink', look: 1 }));
        b.holdFn(9, () => fr({ eyes: eyes('open'), look: 1 }));
        b.hold(2, fr({ eyes: 'focus', look: 1 }));
        for (let step = 1; step <= TOSS.length; step++) {
          b.hold(1, fr({ eyes: step >= 4 && step <= 7 ? 'wide' : 'focus', look: 1, arms: step <= 2 ? 'up' : 'right', prop: step }));
        }
        b.hold(9, fr({ eyes: 'happy', arms: 'right' }));
      }
      b.fill(n, () => fr({ eyes: eyes('open'), look: 1 }));
    } else if (id === 'programmer') {
      for (let t = 0; t < n; t++) {
        const k = t % 60;
        let f;
        if (k >= 50 && k <= 55) f = fr({ arms: 'up', eyes: 'closed' });
        else if (k % 23 === 11) f = fr({ eyes: 'blink', look: 1 });
        else if (k >= 30 && k <= 35) f = fr({ eyes: eyes('open'), look: -1 });
        else f = fr({ eyes: tired ? 'focus' : 'happy', look: 1, arms: Math.floor(t / 2) % 2 === 0 ? 'down' : 'right' });
        f.feet = 'tucked'; f.lift = -2;
        b.hold(1, f);
      }
    } else if (id === 'wizard') {
      const dir = b.roomyDir(), d = Math.min(10, b.room(dir));
      const cast = () => {
        for (let step = 1; step <= WAVE.length; step++) b.hold(1, fr({ eyes: 'focus', arms: WAVE[step - 1] === 1 ? 'up' : 'right', prop: step }));
        for (let k = 1; k <= CAST; k++) b.hold(1, fr({ eyes: 'happy', arms: 'right', prop: WAVE.length + k }));
      };
      b.holdFn(8, () => fr({ eyes: eyes('open') }));
      cast();
      b.hold(4, fr({ look: dir }));
      b.walk(dir * d, 1, () => fr({}));
      b.hold(3, fr({ eyes: 'blink' }));
      cast();
      b.walk(-dir * d, 1, () => fr({}));
      b.fill(n, (t) => fr({ eyes: t % 13 === 6 ? 'blink' : eyes('open') }));
    } else if (id === 'detective') {
      const dir = b.roomyDir(), d = Math.min(8, b.room(dir));
      const pace = () => fr({ eyes: eyes('open') });
      b.holdFn(6, pace);
      b.walk(dir * d, 2, pace);
      b.hold(14, fr({ eyes: 'focus', look: dir, prop: LENS_GROUND }));
      b.hold(3, fr({ look: dir }));
      for (let k = 0; k < 18; k++) b.hold(1, fr({ look: k < 6 ? 0 : k < 12 ? -1 : 1, prop: LENS_EYE }));
      b.hold(3, fr({ eyes: 'wide' }));
      b.walk(-dir * d, 2, pace);
      b.fill(n, (t) => fr({ eyes: t % 17 === 8 ? 'blink' : eyes('open') }));
    }
    return b.out.slice(0, n);
  }

  CU.skins = { CLASSIC, GW, ROUTINES, loadAll, props, routine };
})(window.CU = window.CU || {});
