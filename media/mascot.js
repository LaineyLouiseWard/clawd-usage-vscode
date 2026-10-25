// Clawd, the crab from the Claude Code welcome screen: his poses, Claude Code's click animations
// and his state machine. Port of mascot.py from clawd-usage-linux (MIT), itself a port of
// lib/mascot.ps1, lib/mascot-step.ps1 and lib/hearts.ps1 from clawd-usage-winwidget (MIT).
// He is 9 cells by 3 rows of terminal block glyphs; each cell is 2 x 4 pixels. Positions and
// lifts are in "units" (PX per pixel across, PY down), as in the originals.
'use strict';
(function (CU) {
  const COLS = 9, ROWS = 3, PX = 2.0, PY = 2.2;
  const GW = 2 * COLS, GH = 4 * ROWS;
  const MASCOT_W = GW * PX;
  const FRAME_MS = 60, STEP_MS = 90, BURROW_DIG = 4;

  const QUAD = { ' ': 0, '█': 15, '▀': 3, '▄': 12, '▌': 5, '▐': 10, '▘': 1, '▝': 2, '▖': 4, '▗': 8, '▛': 7, '▜': 11, '▙': 13, '▟': 14 };
  const ARMS = {
    down: { r1L: ' ▐', r1R: '', r2L: '▝▜', r2R: '█▀' },
    up: { r1L: '▗▟', r1R: '▄', r2L: ' ▜', r2R: '█▘' },
    right: { r1L: ' ▐', r1R: '▄', r2L: '▝▜', r2R: '█▘' },
    left: { r1L: '▗▟', r1R: '', r2L: ' ▜', r2R: '█▀' },
  };
  const FEET = { both: ' ▝▝   ▝▝ ', left: ' ▝▝      ', right: '      ▝▝ ', tucked: '         ' };
  const FACING = {
    'right-12': [[' ▐█▜██▛█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
    'right-30': [['  █▛██▛▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
    'right-55': [['  ▐█▛█▜  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
    'right-75': [['   ██▛▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
    edge: [['   ▐██   ', 4, 6], ['   ▐██   ', 4, 6], ['   ▝ ▝   ', 0, 0]],
    'back-105': [['   ███▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
    'back-125': [['  ▐████  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
    'back-150': [['  █████▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
    back: [[' ▐██████ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
    'left-75': [['   ▛██▌  ', 3, 6], ['   ███▌  ', 3, 6], ['   ▘  ▘  ', 0, 0]],
    'left-55': [['  ▐▜▛██  ', 3, 7], ['  ▐████  ', 3, 7], ['  ▝▝ ▝▝  ', 0, 0]],
    'left-30': [['  ▛██▛█▌ ', 2, 7], [' ▝█████▛ ', 2, 7], ['  ▘▘  ▘▘ ', 0, 0]],
    'left-12': [[' ▐▛███▜█ ', 2, 8], ['▝▜██████▀', 2, 7], [' ▝▝   ▝▝ ', 0, 0]],
  };
  const EYES = {
    open: '1,2 1,3', left: '0,0 0,1', right: '2,0 2,1', closed: '0,3 1,3', blink: '0,3 1,3',
    wink: '1,2 1,3;0,3 1,3', happy: '0,3 1,2 2,3', focus: '1,3', wide: '0,1 1,1 0,2 1,2 0,3 1,3',
    x: '0,1 2,1 1,2 0,3 2,3', yawn: '0,3 1,3', gasp: '0,1 2,1 1,2 0,3 2,3',
  };
  const POSES = { default: 'open/down/both', 'arms-up': 'open/up/both', 'look-left': 'left/down/both', 'look-right': 'right/down/both' };

  function F(pose, n = 1, off = 0, x = 0, poof = '', shadow = '') {
    const fr = { off, x, poof, shadow, facing: '' };
    if (pose.startsWith('face:')) Object.assign(fr, { facing: pose.slice(5), eyes: 'open', arms: 'down', feet: 'both' });
    else { const [e, a, ft] = (POSES[pose] || pose).split('/'); Object.assign(fr, { eyes: e, arms: a, feet: ft }); }
    return Array.from({ length: n }, () => Object.assign({}, fr));
  }
  const turn = (names, shadow = '') => names.flatMap((p) => F('face:' + p, 1, 0, 0, '', shadow));

  const cr = [...F('default', 1, 1, 0, 'dot'), ...F('default', 1, 1, 0, 'wave')];
  const bo = F('default');
  const ts = [...F('closed/down/both'), ...bo];
  const jump = [...cr, ...F('arms-up', 3), ...bo, ...cr, ...F('arms-up', 3), ...bo];
  let waddle = F('look-right', 1, 0, -9);
  for (let u = -6; u < 0; u++) waddle = waddle.concat(F('right/down/' + (u % 2 === 0 ? 'left' : 'right'), 2, 0, u));

  const SEQS = {
    jump,
    look: [...F('look-right', 5), ...F('look-left', 5), ...bo],
    celebrate: [...jump, ...F('default', 3, 1)],
    skip: [...F('default', 1, 1, -9), ...F('arms-up', 2, 0, -6), ...F('default', 1, 0, -6), ...F('default', 1, 1, -6),
      ...F('arms-up', 2, 0, -3), ...F('default', 1, 0, -3), ...F('default', 1, 1, -3), ...F('arms-up', 2), ...cr, ...bo],
    spin: [...F('look-left', 2), ...F('look-right', 2), ...F('look-left', 2), ...F('arms-up', 3), ...bo],
    peekaboo: [...F('default', 1, 3), ...F('default', 3, 2), ...F('look-right', 3, 2), ...F('look-left', 3, 2),
      ...F('default', 2, 2), ...F('default', 1, 1), ...F('arms-up', 4), ...F('default', 2), ...ts],
    drop: [...F('arms-up', 1, -3), ...F('arms-up', 2, -2), ...F('arms-up', 2, -1), ...F('arms-up', 1), ...cr, ...F('default', 3), ...ts],
    waddle: [...waddle, ...F('look-right', 2), ...F('default', 2), ...ts],
    peek: [...F('look-right', 1, 0, -9), ...F('look-right', 5, 0, -6), ...F('look-right', 3, 0, -9), ...F('look-right', 4, 0, -5),
      ...F('arms-up', 2, 0, -3), ...F('arms-up', 2), ...cr, ...bo],
    wink: [...F('wink/down/both', 5), ...bo],
    boop: [...F('closed/down/both', 1, 1, 0, 'dot'), ...F('closed/down/both', 2, 1, 0, 'wave'), ...F('look-left', 4), ...F('default', 2), ...ts],
    tap: [...F('open/down/left', 2), ...F('open/down/right', 2), ...F('open/down/left', 2), ...F('open/down/right', 2),
      ...F('open/down/left', 1), ...F('open/down/right', 1), ...F('arms-up', 3), ...bo],
    sneeze: [...F('closed/up/both', 4), ...F('closed/down/both', 2, 1, 0, 'wave'), ...F('closed/down/both', 2), ...F('default', 2), ...ts],
    turn: [...turn(['right-12', 'right-30', 'right-55', 'right-75', 'edge']), ...turn(['back-105', 'back-125', 'back-150', 'back', 'back']),
      ...turn(['back-150', 'back-125', 'back-105', 'edge']), ...turn(['left-75', 'left-55', 'left-30', 'left-12']), ...bo],
    'coin-hop': [...F('default', 2, 1), ...F('arms-up', 1, 0, 0, '', 'wide'), ...turn(['right-55', 'edge', 'back-125', 'back'], 'narrow'),
      ...turn(['back-125', 'edge', 'left-55'], 'narrow'), ...F('arms-up', 1, 0, 0, '', 'wide'), ...cr, ...bo],
  };
  const CLICK_ACTS = Object.keys(SEQS).filter((k) => SEQS[k][0].x === 0 && k !== 'celebrate');
  const ENTRANCE_ACTS = Object.keys(SEQS).filter((k) => k !== 'celebrate');
  const ACT_LEN = {};
  for (const k in SEQS) ACT_LEN[k] = SEQS[k].length;
  Object.assign(ACT_LEN, { wave: 24, stretch: 22, yawn: 22, stumble: 20, soul: 66, burrow: 30, unburrow: 28, stir: 22 });

  const HEALTH = {
    6: { speed: 1.25, hop: 300 }, 5: { speed: 1.0 }, 4: { speed: 0.9, yawn: 350 },
    3: { speed: 0.75, yawn: 200, eyes: 'focus' }, 2: { speed: 0.55, yawn: 160, eyes: 'focus', sweat: true },
    1: { speed: 0.35, eyes: 'blink', sweat: true, stagger: true, stumble: 220 }, 0: { speed: 0.0 },
  };
  const HEALTH_NAMES = { 6: 'full of energy', 5: 'fine', 4: 'a bit tired', 3: 'tired', 2: 'exhausted', 1: 'barely alive', 0: 'out of strength' };
  const HEART_ROWS = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const SOUL_UP = 26, SOUL_BACK = 48, SOUL_TOP = 20.0;
  const SOUL_ART = ['..########..', '..#.####.#..', '############', '..########..', '...######...', '....####....', '.....##.....'];
  const CONFETTI_COLORS = ['#F87171', '#FBBF24', '#4ADE80', '#60A5FA', '#A78BFA', '#D77757'];

  // Frame -> 18 x 12 grid, g[x][y]: 0 empty, 1 body, 2 eyes. The frame's x/off/dig shift is applied by the painter.
  const gridCache = new Map();
  function grid(f) {
    const key = [f.eyes, f.arms, f.feet, f.look, f.facing].join('|');
    const hit = gridCache.get(key);
    if (hit) return hit;
    const g = Array.from({ length: GW }, () => new Array(GH).fill(0));
    const paint = (glyphs, col, row, mode) => {
      const fg = mode === 'lid' ? 2 : 1, bg = mode === 'eyes' ? 2 : mode === 'lid' ? 1 : 0;
      [...glyphs].forEach((ch, i) => {
        for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 2; sx++) {
          const on = ch === '▂' ? sy === 3 : Boolean((QUAD[ch] || 0) & ((sy < 2 ? 1 : 4) * (sx ? 2 : 1)));
          const v = on ? fg : bg;
          const gx = 2 * (col + i) + sx;
          if (v && gx < GW) g[gx][4 * row + sy] = v;
        }
      });
    };
    if (f.facing) {
      FACING[f.facing].forEach(([s, a, b], r) => {
        const cs = [...s];
        paint(cs.slice(0, a).join(''), 0, r, '');
        paint(cs.slice(a, b).join(''), a, r, 'eyes');
        paint(cs.slice(b).join(''), b, r, '');
      });
    } else {
      const a = ARMS[f.arms];
      paint(a.r1L, 0, 0, ''); paint('██████', 2, 0, 'eyes'); paint(a.r1R, 8, 0, '');
      paint(a.r2L, 0, 1, ''); paint('█████', 2, 1, 'eyes'); paint(a.r2R, 7, 1, '');
      paint(FEET[f.feet], 0, 2, '');
      let eyes = f.eyes, shift = 0;
      const look = f.look | 0;
      if (eyes === 'open' && look < 0) eyes = 'left';
      else if (eyes === 'open' && look > 0) eyes = 'right';
      else if (!['open', 'left', 'right', 'wink'].includes(eyes)) shift = look;
      const sides = EYES[eyes].split(';');
      [4, 12].forEach((ex, k) => {
        for (const pt of sides[Math.min(k, sides.length - 1)].split(' ')) {
          const [dx, dy] = pt.split(',').map(Number);
          const x = ex + dx + shift;
          if (x >= 0 && x < GW) g[x][dy] = 2;
        }
      });
      if (eyes === 'yawn' || eyes === 'gasp') for (let x = 8; x < 11; x++) { g[x][4] = 2; g[x][5] = 2; }
    }
    gridCache.set(key, g);
    return g;
  }

  class Mascot {
    constructor() {
      this.x = -1; this.dir = 1; this.target = null; this.look = 0; this.tick = 0; this.blinkAt = 30;
      this.mood = 'idle'; this.cur = 'idle'; this.crit = false; this.idleSince = performance.now();
      this.act = null; this.actT = 0; this.pct = null; this.halves = null; this.lostT = -1; this.lostFrom = 0;
      this.showHalves = null; this.loveT = -1; this.noteT = -1; this.confT = -1; this.busy = -1; this.waiting = 0;
      this.lastReset = null; this.lastPct = null; this.buried = false; this.walkSpeed = 1.6;
      this.skinId = 'classic'; this.rt = null; this.rtI = 0; this.rtKey = '';
      this.confetti = Array.from({ length: 12 }, (_, i) => ({ x: 0, y: 0, v: 0, d: 0, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }));
      this.r = null;
      this.startAct(pick(ENTRANCE_ACTS));
    }

    startAct(name) { this.act = name; this.actT = 0; if (name === 'celebrate') this.startConfetti(); }

    click() {
      if (this.mood === 'dead' || this.cur === 'dead') { if (!this.act) this.startAct('soul'); return; }
      this.loveT = 0;
      if (this.buried && this.cur === 'sleep') { if (!this.act) this.startAct('stir'); return; }
      if (this.act) return;
      this.startAct(pick(CLICK_ACTS));
    }

    startConfetti() {
      for (const c of this.confetti) {
        c.x = this.x - 12 + Math.random() * (MASCOT_W + 24); c.y = 34 + Math.random() * 12;
        c.v = 0.9 + Math.random() * 1.2; c.d = (Math.random() - 0.5) * 0.8;
      }
      this.confT = 0;
    }

    // sessions: [{busy, waiting}]; usage: {session, sessionReset (ms)} or null.
    setState(sessions, usage, critLevel) {
      const busy = sessions.filter((s) => s.busy).length, waiting = sessions.filter((s) => s.waiting).length;
      const pct = usage ? usage.session : null;
      let mood = pct !== null && pct !== undefined && pct >= 100 ? 'dead' : waiting ? 'wait' : busy ? 'work' : sessions.length ? 'idle' : 'sleep';
      if (mood !== this.mood) this.idleSince = performance.now();
      this.mood = mood;
      // A session finished its reply (rather than stopping to wait for us) - jump.
      if (this.busy > 0 && busy < this.busy && waiting <= this.waiting && !this.act) this.startAct('jump');
      this.busy = busy; this.waiting = waiting;
      this.crit = pct !== null && pct !== undefined && pct >= critLevel;
      this.pct = pct === undefined ? null : pct;
      // The 5-hour window reset: reset time moved forward, percent dropped - celebrate.
      const reset = usage ? usage.sessionReset : null;
      if (reset) {
        if (this.lastReset && reset > this.lastReset + 60000 && this.lastPct !== null && pct !== null && pct < this.lastPct) this.startAct('celebrate');
        this.lastReset = reset; this.lastPct = pct;
      }
    }

    getHalves() {
      if (this.pct === null) return null;
      return Math.min(6, Math.max(0, Math.ceil(Math.max(0, 100 - this.pct) * 6 / 100)));
    }

    stepAct(f) {
      const t = this.actT, a = this.act;
      let bubble = '';
      if (SEQS[a]) {
        const fr = SEQS[a][t];
        for (const k of ['eyes', 'arms', 'feet', 'off', 'x', 'facing', 'poof', 'shadow']) f[k] = fr[k];
        f.look = 0;
        if (a === 'celebrate') bubble = '!';
      } else if (a === 'wave') { f.look = 0; f.eyes = 'happy'; f.arms = Math.floor(t / 4) % 2 ? 'down' : 'right'; }
      else if (a === 'stretch') { if (t >= 4 && t < 18) { f.arms = 'up'; f.eyes = 'closed'; f.lift = 1.5; } }
      else if (a === 'yawn') { f.look = 0; f.eyes = t >= 3 && t < 17 ? 'yawn' : 'closed'; }
      else if (a === 'stumble') { if (t < 12) { f.off = 1; f.eyes = 'closed'; } else f.eyes = 'wide'; f.look = 0; }
      else if (a === 'soul') {
        f.flip = true; f.look = 0;
        if (t < 6) { f.eyes = 'x'; f.feet = t % 2 ? 'left' : 'right'; }
        else if (t < SOUL_BACK + 6) {
          f.eyes = 'gasp'; f.soulT = t;
          if (t < SOUL_UP) { const k = (t - 6) / (SOUL_UP - 6); f.soul = SOUL_TOP * (1 - (1 - k) * (1 - k)); }
          else if (t < SOUL_BACK) f.soul = SOUL_TOP + 1.5 * Math.sin((t - SOUL_UP) / 2.5);
          else { const k = (t - SOUL_BACK) / 6; f.soul = SOUL_TOP * (1 - k * k); }
        } else if (t < SOUL_BACK + 9) { f.eyes = 'wide'; f.lift = 2.5; }
        else f.eyes = 'x';
      } else if (a === 'burrow') {
        if (t < 4) f.look = t < 2 ? -1 : 1;
        else if (t < 24) {
          f.look = 0; f.eyes = 'focus'; f.dig = Math.min(BURROW_DIG, Math.floor((t - 4) / 3.5));
          f.feet = Math.floor(t / 2) % 2 ? 'left' : 'right'; f.arms = Math.floor(t / 2) % 2 ? 'up' : 'down'; f.spray = (t % 3) + 1;
        } else { f.look = 0; f.dig = BURROW_DIG; f.eyes = t < 27 ? 'blink' : 'closed'; }
      } else if (a === 'unburrow') {
        f.look = 0;
        if (t < 3) { f.dig = BURROW_DIG; f.eyes = 'wide'; }
        else if (t < 9) { f.dig = Math.max(0, BURROW_DIG - (t - 3)); f.eyes = 'wide'; f.arms = 'up'; f.spray = (t % 3) + 1; if (t === 8) f.lift = 2; }
        else if (t < 21) { f.eyes = 'closed'; f.look = Math.floor(t / 2) % 2 ? -1 : 1; f.feet = Math.floor(t / 2) % 2 ? 'left' : 'right'; if (t < 15) f.spray = (t % 3) + 1; }
        else if (t < 23) f.eyes = 'blink';
      } else if (a === 'stir') {
        f.dig = t < 15 ? BURROW_DIG - 1 : BURROW_DIG;
        if (t < 3) { f.eyes = 'wide'; f.look = 0; }
        else if (t < 13) f.look = t < 8 ? -1 : 1;
        else if (t < 17) { f.eyes = 'blink'; f.look = 0; }
        else { f.eyes = 'closed'; f.look = 0; }
      }
      this.actT++;
      if (this.actT >= ACT_LEN[a]) this.act = null;
      return bubble;
    }

    stepRoutine(f, areaW) {
      // Keep room on his right for what he holds (pan, laptop, lens).
      const maxX = Math.max(0, Math.floor((areaW - (GW + 9) * PX) / PX));
      const key = `${this.skinId}|${this.crit}|${maxX}`;
      if (!this.rt || this.rtKey !== key || this.rtI >= this.rt.length) {
        const start = Math.max(0, Math.min(maxX, Math.round(this.x / PX)));
        this.rt = CU.skins.routine(this.skinId, this.crit, start, maxX); this.rtI = 0; this.rtKey = key;
      }
      const [gx, rf] = this.rt[this.rtI++];
      this.x = gx * PX; this.target = null; this.look = rf.look;
      for (const k of ['eyes', 'arms', 'feet', 'look', 'off', 'prop']) f[k] = rf[k];
      f.lift = rf.lift * PY;
    }

    // areaW: area width in units; mouseX: cursor x in area units or null; hovered: cursor over the view.
    step(areaW, mouseX, hovered) {
      this.tick++;
      const span = Math.max(0, areaW - MASCOT_W);
      if (this.x < 0) this.x = span / 2;
      if (this.x > span) this.x = span;
      const mouseLook = () => {
        if (mouseX === null) return null;
        const cx = this.x + MASCOT_W / 2;
        return mouseX > cx + 10 ? 1 : mouseX < cx - 10 ? -1 : 0;
      };
      let mood = this.mood;
      const halves = this.getHalves();
      const tier = HEALTH[halves === null ? 5 : halves];
      const perky = tier.speed >= 0.9;
      const now = performance.now();
      if (hovered) this.idleSince = now;
      if (mood === 'idle' && now - this.idleSince >= 600000) mood = 'doze';
      if (mood === 'sleep') { if (!this.buried && !this.act) { this.buried = true; this.startAct('burrow'); } }
      else if (this.buried) { this.buried = false; this.startAct('unburrow'); }

      const f = { feet: 'both', look: this.look, eyes: 'open', arms: 'down', flip: false, lift: 0, off: 0, x: 0, facing: '',
        poof: '', shadow: '', soul: 0, soulT: 0, dig: 0, spray: 0, prop: 0 };
      this.cur = mood;
      let bubble = '', zzz = false, canBlink = true, dust = false;

      if (this.act) { bubble = this.stepAct(f); canBlink = false; }
      else if (mood === 'sleep') { Object.assign(f, { dig: BURROW_DIG, eyes: 'closed', look: 0 }); zzz = true; }
      else if (mood === 'doze') {
        f.look = 0;
        const p = this.tick % 70;
        if (p < 6) { f.eyes = 'wide'; if (p < 2) f.lift = 1.5; } else { f.eyes = 'blink'; zzz = true; }
      } else if (mood === 'dead') {
        Object.assign(f, { flip: true, eyes: 'x', look: 0 });
        const p = this.tick % 50;
        if (p < 6) f.feet = p % 2 ? 'left' : 'right';
      } else if (mood === 'wait') {
        bubble = '?'; f.eyes = 'wide';
        const ml = mouseLook(); f.look = ml !== null ? ml : 0;
        const p = this.tick % 40;
        if (p < 8) { const k = p / 7; f.lift = 12 * k * (1 - k); f.arms = 'right'; }
      } else if (CU.skins.ROUTINES.includes(this.skinId) && (mood === 'idle' || mood === 'work')) {
        this.stepRoutine(f, areaW);
      } else {
        let speed;
        if (mood === 'work') {
          speed = 1.6 * tier.speed * this.walkSpeed;
          if (this.target === null) this.target = this.dir > 0 ? span : 0;
        } else {
          speed = 0.6 * tier.speed * this.walkSpeed;
          if (this.target === null) {
            if (rand(70) === 0) this.target = Math.random() * span;
            else if (rand(45) === 0) this.look = rand(3) - 1;
            else if (rand(400) === 0) this.startAct(pick(['wave', 'stretch', 'look']));
          }
        }
        let walking = false;
        if (this.target !== null) {
          const d = this.target - this.x;
          if (Math.abs(d) <= speed) { this.x = this.target; this.target = null; if (mood === 'work') this.dir = -this.dir; }
          else { this.dir = d > 0 ? 1 : -1; this.x += speed * this.dir; this.look = this.dir; walking = true; }
        }
        if (walking) {
          let step = mood === 'work' ? 2 : 3;
          if (tier.speed < 0.8) step++;
          if (tier.speed < 0.5) step++;
          f.feet = Math.floor(this.tick / step) % 2 ? 'left' : 'right';
          dust = true;
          if (mood === 'work') {
            if (f.feet === 'left' && perky) f.lift = 1;
            if (perky && rand(150) === 0) this.startAct('jump');
          } else if (perky && this.noteT < 0 && rand(80) === 0) this.noteT = 0;
          if (tier.stumble && rand(tier.stumble) === 0) this.startAct('stumble');
        } else if (this.crit) this.look = Math.floor(this.tick / 5) % 2 ? -1 : 1;
        else { const ml = mouseLook(); if (ml !== null) this.look = ml; }
        f.look = this.look;
        if (mood === 'work') f.eyes = 'focus';
        if (!this.act) {
          if (tier.hop && rand(tier.hop) === 0) this.startAct('jump');
          if (tier.yawn && rand(tier.yawn) === 0) this.startAct('yawn');
        }
      }

      if (tier.eyes && !this.act && (f.eyes === 'open' || f.eyes === 'focus')) f.eyes = tier.eyes;
      if (this.loveT >= 0 && !this.act && f.eyes === 'open') f.eyes = 'happy';
      if (this.noteT >= 0) { if (!bubble && mood === 'idle') bubble = '♪'; if (++this.noteT >= 30) this.noteT = -1; }
      if (canBlink && f.eyes === 'open' && this.tick >= this.blinkAt) {
        f.eyes = 'blink';
        if (this.tick >= this.blinkAt + 1) this.blinkAt = this.tick + 25 + rand(45);
      }
      let rx = this.x;
      if (tier.stagger && mood !== 'sleep' && mood !== 'dead') rx += 1.5 * Math.sin(this.tick / 3);

      const r = { f, x: Math.round(rx), bubble, interval: this.act && SEQS[this.act] ? FRAME_MS : STEP_MS,
        zzz: null, sweat: null, dust: [], confetti: [], love: null, soul: null };
      if (zzz) { const p = (this.tick % 30) / 30; r.zzz = { opacity: 1 - p, left: this.x + 28 + 3 * Math.sin(p * 2 * Math.PI), bottom: (f.dig > 0 ? 9 : f.off > 0 ? 12 : 19) + 14 * p }; }
      if ((this.crit || tier.sweat) && mood !== 'sleep' && mood !== 'dead') {
        const p = (this.tick % 20) / 20;
        r.sweat = { opacity: 1 - p, left: f.look < 0 ? 31 : 2, top: -2 + 6 * p - f.lift };
      }
      this.stepHearts();
      if (dust) for (let i = 0; i < 3; i++) {
        const p = ((this.tick + i * 3) % 9) / 9;
        const dx = this.dir > 0 ? 4 - 8 * p - 2 * i : MASCOT_W - 6 + 8 * p + 2 * i;
        r.dust.push({ left: this.x + dx, bottom: 4 * p, opacity: 0.7 * (1 - p) });
      }
      if (this.confT >= 0) {
        this.confetti.forEach((c, i) => { c.y -= c.v; c.x += c.d; if (c.y > 0) r.confetti.push({ left: c.x, bottom: c.y, color: c.color, wide: Math.floor((this.tick + i) / 2) % 2 === 1 }); });
        if (++this.confT >= 45) this.confT = -1;
      }
      if (this.loveT >= 0) {
        const k = this.loveT / 20;
        r.love = { opacity: 1 - k, left: this.x + MASCOT_W / 2 - 5 + 2 * Math.sin(k * 6), bottom: 23 + f.lift + 14 * k };
        if (++this.loveT >= 20) this.loveT = -1;
      }
      if (f.soul > 0.5) r.soul = { height: f.soul, t: f.soulT, left: this.x + 9.5 * PX };
      this.r = r;
      return r;
    }

    stepHearts() {
      const halves = this.getHalves();
      if (halves === null) { this.halves = null; this.showHalves = null; return; }
      if (this.halves !== null && halves < this.halves) { this.lostT = 0; this.lostFrom = this.halves; }
      this.halves = halves;
      let show = halves;
      if (this.lostT >= 0) { if (this.lostT % 4 < 2) show = this.lostFrom; if (++this.lostT >= 16) this.lostT = -1; }
      this.showHalves = show;
    }

    heartsTooltip() {
      const h = this.getHalves();
      return h === null ? '' : `${HEALTH_NAMES[h]} · ${100 - this.pct}% of the session limit left`;
    }
  }

  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(list) { return list[rand(list.length)]; }

  CU.mascot = { PX, PY, GW, GH, MASCOT_W, Mascot, grid, HEART_ROWS, SOUL_ART };
})(window.CU = window.CU || {});
