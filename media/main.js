// The Clawd Usage view: the card, the scene and Clawd drawn in his own pixel grid, and the
// messages from the extension (usage, sessions, settings).
'use strict';
(function (CU) {
  const vscode = acquireVsCodeApi();
  const { H, GROUND, LOOP, FRAME_MS, SceneCache, sand, HEART_S } = CU.scenes;
  const { PX, PY, GW, GH, MASCOT_W, Mascot, grid, HEART_ROWS, SOUL_ART } = CU.mascot;
  const N = 3;                         // CSS pixels per scene pixel
  const GROUND_Y = H - GROUND;         // first ground row: Clawd's feet stand on it
  const REST_TOP = GROUND_Y - 10;      // his grid top when standing (feet end at grid row 9)
  const COL = { ok: '#4ADE80', warn: '#FBBF24', crit: '#F87171', dead: '#6B7280', note: '#93C5FD', heartOff: '#3F3F46' };
  const GLYPH = {
    '?': ['.qq.', 'q..q', '..q.', '.q..', '....', '.q..'],
    '!': ['.q.', '.q.', '.q.', '.q.', '...', '.q.'],
    '♪': ['..qq', '..q.', '..q.', 'qqq.', 'qq..'],
  };
  const GLYPH_Z = ['qqq', '..q', '.q.', 'qqq'];

  const $ = (id) => document.getElementById(id);
  const scene = $('scene'), ctx = scene.getContext('2d');
  const hearts = $('hearts'), hctx = hearts.getContext('2d');
  const m = new Mascot();
  const cache = new SceneCache();
  let skins = { classic: CU.skins.CLASSIC }, patterns = {};
  let cfg = { theme: 'auto', outfit: 'auto', warnPercent: 60, critPercent: 85 };
  let usage = null, sessions = [], note = 'loading...', gpt = null;
  let theme = CU.themes.resolve('auto'), skin = CU.skins.CLASSIC;
  let wPx = 60, mouseX = null, hovered = false;

  // ---------------------------------------------------------------- layout ----
  function fit() {
    const w = Math.max(30, Math.floor($('stage').clientWidth / N));
    if (w !== wPx || scene.width !== w) {
      wPx = w;
      scene.width = w; scene.height = H;
      scene.style.width = `${w * N}px`; scene.style.height = `${H * N}px`;
    }
  }
  new ResizeObserver(fit).observe($('stage'));

  function applyLook() {
    theme = CU.themes.resolve(cfg.theme);
    const sid = cfg.outfit === 'auto' ? theme.skin : cfg.outfit;
    skin = skins[sid] || CU.skins.CLASSIC;
    m.skinId = skin.id;
    const card = $('card');
    card.style.backgroundColor = theme.bg;
    const pat = theme.pattern && patterns[theme.pattern];
    card.style.backgroundImage = pat ? `url("${pat.uri}")` : 'none';
    if (pat) card.style.backgroundSize = `${pat.size}px`;
  }

  // ------------------------------------------------------------- the numbers ----
  function level(p) { return p >= cfg.critPercent ? 'crit' : p >= cfg.warnPercent ? 'warn' : 'ok'; }

  function span(ms) {
    const secs = (ms - Date.now()) / 1000;
    if (!(secs > 0)) return null;
    const mins = Math.floor(secs / 60), h = Math.floor(mins / 60), mm = mins % 60;
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h >= 1) return `${h}h ${String(mm).padStart(2, '0')}m`;
    return `${mm}m`;
  }

  function renderText() {
    const u = usage;
    if (!u || u.session === null || u.session === undefined) {
      $('pct').textContent = '--'; $('pct').style.color = COL.dead;
      $('barS').style.width = '0';
      $('reset').textContent = note;
    } else {
      const lv = level(u.session);
      $('pct').textContent = String(u.session); $('pct').style.color = COL[lv];
      $('barS').style.width = `${Math.min(100, u.session)}%`; $('barS').style.background = COL[lv];
      const s = u.sessionReset ? span(u.sessionReset) : null;
      $('reset').textContent = s ? `resets in ${s}` : u.sessionReset ? 'window closed' : 'window not started';
    }
    weekLine(u, 'week', 'barW');
    $('hearts').title = m.heartsTooltip();
    renderGpt();
  }

  function weekLine(u, textId, barId) {
    const wk = u && u.week !== null && u.week !== undefined ? u.week : null;
    const ws = wk !== null && u.weekReset ? span(u.weekReset) : null;
    $(textId).textContent = wk === null ? '' : `${wk}%` + (ws ? `  ·  ${ws}` : '');
    $(barId).style.width = wk === null ? '0' : `${Math.min(100, wk)}%`;
  }

  // The OpenAI card keeps OpenAI's own black and white; only a filling 5-hour window takes colour.
  function renderGpt() {
    const g = gpt;
    $('gpt').hidden = !g;
    if (!g) return;
    $('gName').textContent = g.plan ? `CHATGPT ${g.plan.toUpperCase()}` : 'CHATGPT';
    if (g.session === null || g.session === undefined) {
      $('gPct').textContent = '--';
      $('gBarS').style.width = '0';
      $('gReset').textContent = g.note || '';
    } else {
      const lv = level(g.session);
      $('gPct').textContent = String(g.session);
      $('gPct').style.color = lv === 'ok' ? '' : COL[lv];
      $('gBarS').style.width = `${Math.min(100, g.session)}%`;
      $('gBarS').style.background = lv === 'ok' ? '' : COL[lv];
      const s = g.sessionReset ? span(g.sessionReset) : null;
      $('gReset').textContent = s ? `resets in ${s}` : '';
    }
    weekLine(g, 'gWeek', 'gBarW');
  }

  // ---------------------------------------------------------------- drawing ----
  function px(x, y, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
  function argbPx(x, y, argb) {
    ctx.globalAlpha = (argb >>> 24) / 255;
    ctx.fillStyle = `rgb(${(argb >>> 16) & 255},${(argb >>> 8) & 255},${argb & 255})`;
    ctx.fillRect(x, y, 1, 1);
  }
  function art(rows, x, y, color, alpha = 1) {
    rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') px(x + rx, y + ry, color, alpha); });
  }

  function draw(r) {
    const hour = new Date().getHours();
    const t = Math.floor(Date.now() / FRAME_MS) % LOOP;
    ctx.globalAlpha = 1;
    ctx.putImageData(cache.frame(theme.scene, wPx, hour, t), 0, 0);
    const f = r.f;
    const gx0 = Math.round(r.x / PX);
    const lift = Math.round(f.lift / PY);
    const top = REST_TOP - lift;
    const dig = f.dig | 0, dx = 2 * (f.x | 0), dy = 4 * (f.off | 0) + dig;
    const lim = dig > 0 ? GH - 2 : GH;

    // Body and eyes; on his back the rows are mirrored.
    const g = grid(f);
    for (let y = 0; y < GH; y++) {
      let sy = y;
      if (f.flip) { if (y >= GH - 2) continue; sy = GH - 3 - y; }
      const yy = sy + dy;
      if (yy < 0 || yy >= lim) continue;
      for (let x = 0; x < GW; x++) {
        const v = g[x][y], xx = x + dx;
        if (!v || xx < 0 || xx >= GW) continue;
        px(gx0 + xx, top + yy, v === 2 ? skin.eyes : skin.body);
      }
    }
    if (!f.flip) {
      // Outfit: what is above his head stays on while he turns; on his back it all comes off.
      for (const [color, pts] of skin.layers) {
        for (const [x, y] of pts) {
          const xx = x + dx, yy = y + dy;
          if ((y >= 0 && f.facing) || xx < 0 || xx >= GW || yy >= lim) continue;
          if (y < 0 ? dy < 0 : yy < 0) continue;
          px(gx0 + xx, top + yy, color);
        }
      }
      if (!dig && !f.facing) for (const [x, y, argb] of CU.skins.props(skin.id, f, m.tick, gx0 + dx, top + dy, REST_TOP)) argbPx(x, y, argb);
    }
    // Dust puffs at the sides while crouched, a shadow under a hop.
    if (f.poof && f.off > 0) for (const cx of [-1, GW - 1]) {
      if (f.poof === 'dot') px(gx0 + cx + 1, REST_TOP + 9, '#8B8B94');
      else { px(gx0 + cx, REST_TOP + 9, '#8B8B94'); px(gx0 + cx + 1, REST_TOP + 8, '#8B8B94'); px(gx0 + cx + 2, REST_TOP + 9, '#8B8B94'); }
    }
    if (f.shadow) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; f.shadow === 'wide' ? ctx.fillRect(gx0 + 6, GROUND_Y, 6, 1) : ctx.fillRect(gx0 + 8, GROUND_Y, 2, 1); }
    // The sand mound over the burrow, and grains flying from the legs.
    const sd = sand(theme.scene);
    ctx.globalAlpha = 1; ctx.fillStyle = sd;
    if (dig >= 1) ctx.fillRect(gx0 - 2, REST_TOP + GH - 3, GW + 4, 1);
    if (dig >= 2) ctx.fillRect(gx0 - 1, REST_TOP + GH - 4, GW + 2, 1);
    if (dig >= 3) { ctx.fillRect(gx0 - 1, REST_TOP + GH - 5, 2, 1); ctx.fillRect(gx0 + GW - 1, REST_TOP + GH - 5, 2, 1); }
    if (f.spray > 0) for (const k of [0, 1]) {
      const d = f.spray + 2 * k, sx = Math.trunc(1.5 + 0.9 * d), sy = Math.trunc((GH - 4) - 0.9 * d * (5 - d) / 2);
      px(gx0 - sx, REST_TOP + sy, sd); px(gx0 + GW + sx - 1, REST_TOP + sy, sd);
    }
    // Effects from the state machine, converted from units to pixels.
    if (r.sweat) {
      const x = gx0 + Math.round(r.sweat.left / PX), y = top + Math.round(r.sweat.top / PY);
      px(x, y, COL.note, r.sweat.opacity); px(x, y + 1, COL.note, r.sweat.opacity); px(x + 1, y + 1, COL.note, r.sweat.opacity);
    }
    for (const d of r.dust) px(Math.round(d.left / PX), GROUND_Y - 1 - Math.round(d.bottom / PY), '#8B8B94', d.opacity);
    for (const c of r.confetti) { ctx.globalAlpha = 1; ctx.fillStyle = c.color; ctx.fillRect(Math.round(c.left / PX), GROUND_Y - 1 - Math.round(c.bottom / PY), c.wide ? 2 : 1, 1); }
    if (r.zzz) art(GLYPH_Z, Math.round(r.zzz.left / PX), GROUND_Y - Math.round(r.zzz.bottom / PY) - 4, '#C4B5FD', r.zzz.opacity);
    if (r.love) art(HEART_S, Math.round(r.love.left / PX) + 1, GROUND_Y - Math.round(r.love.bottom / PY) - 3, COL.crit, r.love.opacity);
    if (r.bubble) {
      const color = r.bubble === '?' ? COL.warn : r.bubble === '!' ? COL.ok : COL.note;
      art(GLYPH[r.bubble], gx0 + GW + 1, top + dy - 7 + Math.round(Math.sin(m.tick / 3)), color);
    }
    if (r.soul) {
      const mouth = GROUND_Y - lift - 6, n = Math.round(r.soul.height / PY), sway = 2.5 * Math.sin(r.soul.t / 4);
      const op = 0.7 + 0.15 * Math.sin(r.soul.t / 1.7), cx = r.soul.left / PX;
      for (let i = 0; i < n; i++) {
        const k = i / Math.max(1, n);
        px(Math.round(cx + (sway * k + 1.2 * Math.sin(r.soul.t / 2 + i * 0.7) * Math.sin(k * Math.PI)) / PX), mouth - i - 1, '#F4F4F5', op);
      }
      art(SOUL_ART.map((s) => s.replace(/#/g, 'q')), Math.round(cx + sway / PX) - 6, mouth - n - SOUL_ART.length, '#F4F4F5', op);
    }
    ctx.globalAlpha = 1;
  }

  function drawHearts() {
    const show = m.showHalves;
    hearts.style.visibility = show === null ? 'hidden' : 'visible';
    if (show === null) return;
    const s = 2, cell = 7, gap = 2;
    hearts.width = (3 * cell + 2 * gap) * s; hearts.height = 6 * s;
    hctx.clearRect(0, 0, hearts.width, hearts.height);
    for (let i = 0; i < 3; i++) {
      const fill = Math.max(0, Math.min(2, show - 2 * i)); // 2 full, 1 half, 0 empty
      HEART_ROWS.forEach((row, y) => {
        for (let x = 0; x < 7; x++) {
          if (row[x] !== '#') continue;
          hctx.fillStyle = fill === 2 || (fill === 1 && x <= 3) ? COL.crit : COL.heartOff;
          hctx.fillRect((i * (cell + gap) + x) * s, y * s, s, s);
        }
      });
    }
  }

  // ------------------------------------------------------------------ loop ----
  let timer = null;
  function tick() {
    fit();
    const r = m.step(wPx * PX, mouseX, hovered);
    draw(r);
    drawHearts();
    timer = setTimeout(tick, document.hidden ? 1000 : r.interval);
  }

  $('stage').addEventListener('mousemove', (e) => { mouseX = (e.offsetX / N) * PX; });
  $('stage').addEventListener('mouseleave', () => { mouseX = null; });
  document.addEventListener('mouseenter', () => { hovered = true; });
  document.addEventListener('mouseleave', () => { hovered = false; });
  $('stage').addEventListener('click', (e) => {
    const r = m.r;
    if (!r) return;
    const x = e.offsetX / N, y = e.offsetY / N, gx0 = r.x / PX;
    if (x >= gx0 - 2 && x <= gx0 + GW + 2 && y >= REST_TOP - Math.round(r.f.lift / PY) - 4) m.click();
  });

  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg.type !== 'state') return;
    if (msg.skins) skins = CU.skins.loadAll(msg.skins);
    if (msg.patterns) patterns = msg.patterns;
    if (msg.config) cfg = Object.assign(cfg, msg.config);
    if ('usage' in msg) usage = msg.usage;
    if (msg.sessions) sessions = msg.sessions;
    if (msg.note) note = msg.note;
    if ('gpt' in msg) gpt = msg.gpt;
    applyLook();
    m.walkSpeed = 1.6;
    m.setState(sessions, usage, cfg.critPercent);
    renderText();
  });

  setInterval(() => { applyLook(); renderText(); }, 30000); // reset countdowns and the season
  applyLook();
  renderText();
  fit();
  tick();
  vscode.postMessage({ type: 'ready' });
})(window.CU = window.CU || {});
