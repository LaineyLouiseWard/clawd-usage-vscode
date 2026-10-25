// Clawd Usage for VS Code: Claude plan usage (5-hour and weekly limits) in a sidebar view where
// Clawd lives, and in the status bar. Data sources, as in clawd-usage-linux:
//   `claude -p /usage --output-format text`  limit percentages; no model is called, no tokens spent
//   ~/.claude/sessions/<pid>.json             running Claude Code sessions (busy / waiting)
'use strict';
const vscode = require('vscode');
const cp = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { themes } = require('./media/themes.js');

const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WIN = process.platform === 'win32';

// ------------------------------------------------------------------ parsing ----

// 'Oct 17, 5:19am (Europe/Moscow)' or 'Oct 21, 6am' -> ms since epoch, local time.
function parseReset(s) {
  const m = /([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)/.exec(s || '');
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1].toLowerCase());
  if (mon < 0) return null;
  const hour = (parseInt(m[3], 10) % 12) + (m[5] === 'pm' ? 12 : 0);
  const now = new Date();
  const dt = new Date(now.getFullYear(), mon, parseInt(m[2], 10), hour, parseInt(m[4] || '0', 10));
  // Around New Year the date may land in the past - then it is next year.
  if (dt.getTime() < now.getTime() - 30 * 86400000) dt.setFullYear(dt.getFullYear() + 1);
  return dt.getTime();
}

function parseUsage(text) {
  const u = {};
  for (const [key, rx] of [['session', 'Current session:'], ['week', 'Current week \\(all models\\):']]) {
    // No "resets" means the window hasn't started - that is 0%, not "no data".
    const m = new RegExp(rx + '\\s*(\\d+)%(?:[^\\r\\n]*?resets\\s*([^\\r\\n]+))?').exec(text);
    u[key] = m ? parseInt(m[1], 10) : null;
    u[key + 'Reset'] = m ? parseReset(m[2]) : null;
  }
  return u.session === null && u.week === null ? null : u;
}

// ----------------------------------------------------------------- sessions ----

function procStat(pid) {
  try {
    const data = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const rest = data.slice(data.lastIndexOf(')') + 2).split(' '); // fields 3.. ; comm may contain spaces
    return { ppid: parseInt(rest[1], 10), start: parseInt(rest[19], 10) };
  } catch { return null; }
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function getSessions(ownPids) {
  let files = [];
  try { files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')); } catch { return []; }
  const out = [];
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); } catch { continue; }
    const pid = j.pid;
    if (!Number.isInteger(pid) || ownPids.has(pid) || !alive(pid)) continue;
    // Files outlive their processes; a reused PID has a different start time (Linux only).
    const st = procStat(pid);
    if (st) {
      if (st.ppid === process.pid) continue; // our own `claude -p /usage` probe
      if (j.procStart !== undefined && Math.abs(parseInt(j.procStart, 10) - st.start) > 2) continue;
    }
    out.push({ name: j.name || path.basename(String(j.cwd || '')) || '?', busy: j.status === 'busy', waiting: j.status === 'waiting' });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// ------------------------------------------------------------- Claude Code ----

function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }

// The settings path, then the copy bundled with the Claude Code extension, then PATH and the usual places.
function findClaude() {
  const set = vscode.workspace.getConfiguration('clawdUsage').get('claudePath');
  if (set && isFile(set)) return set;
  const ext = vscode.extensions.getExtension('anthropic.claude-code');
  if (ext) {
    const p = path.join(ext.extensionPath, 'resources', 'native-binary', WIN ? 'claude.exe' : 'claude');
    if (isFile(p)) return p;
  }
  const names = WIN ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) for (const n of names) if (dir && isFile(path.join(dir, n))) return path.join(dir, n);
  for (const p of [path.join(os.homedir(), '.local', 'bin', 'claude'), path.join(os.homedir(), '.claude', 'local', 'claude'), '/usr/local/bin/claude', '/opt/homebrew/bin/claude']) {
    if (isFile(p)) return p;
  }
  return null;
}

function readUsage(exe, ownPids) {
  return new Promise((resolve) => {
    const env = Object.assign({}, process.env);
    delete env.CLAUDECODE; // a nested-session marker would stop the probe
    delete env.ANTHROPIC_API_KEY; // a key in the environment takes precedence over the plan login, and keys have no plan limits
    let out = '';
    let child;
    try {
      child = cp.spawn(exe, ['-p', '/usage', '--output-format', 'text', '--no-session-persistence'],
        { cwd: os.homedir(), env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true, shell: exe.endsWith('.cmd') });
    } catch { resolve({ ok: false }); return; }
    if (child.pid) ownPids.add(child.pid);
    const timer = setTimeout(() => child.kill(), 45000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); ownPids.delete(child.pid); resolve({ ok: false }); });
    child.on('close', (code) => { clearTimeout(timer); ownPids.delete(child.pid); resolve({ ok: code === 0, text: out }); });
  });
}

// ----------------------------------------------------------------- the view ----

class ClawdView {
  constructor(context) {
    this.context = context;
    this.view = null;
    this.state = { usage: null, sessions: [], note: 'loading...' };
  }

  resolveWebviewView(view) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    view.webview.html = this.html(view.webview, media);
    view.webview.onDidReceiveMessage((msg) => { if (msg.type === 'ready') this.post(true); });
    view.onDidDispose(() => { this.view = null; });
  }

  html(webview, media) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const src = (f) => webview.asWebviewUri(vscode.Uri.joinPath(media, f));
    const scripts = ['scenes.js', 'skins.js', 'mascot.js', 'themes.js', 'main.js']
      .map((f) => `<script nonce="${nonce}" src="${src(f)}"></script>`).join('\n');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${src('style.css')}"></head><body>
<div id="card">
  <div class="hdr"><span class="title">CLAUDE USAGE</span><span class="spacer"></span><canvas id="hearts" width="1" height="1"></canvas></div>
  <div class="row"><div class="pct"><span id="pct">--</span><span class="sign">%</span></div><div id="stage"><canvas id="scene"></canvas></div></div>
  <div class="bar"><div id="barS"></div></div>
  <div id="reset" class="line">loading...</div>
  <div class="lim"><span class="lbl">WEEK</span><span id="week" class="val"></span></div>
  <div class="bar thin"><div id="barW"></div></div>
  <div class="lim"><span class="lbl">SESSIONS</span><span id="sess" class="val"></span></div>
</div>
${scripts}
</body></html>`;
  }

  post(full) {
    if (!this.view) return;
    const msg = Object.assign({ type: 'state', config: config() }, this.state);
    if (full) {
      msg.skins = readSkins(this.context);
      msg.patterns = readPatterns(this.context, this.view.webview);
    }
    this.view.webview.postMessage(msg);
  }
}

function config() {
  const c = vscode.workspace.getConfiguration('clawdUsage');
  return { theme: c.get('theme'), outfit: c.get('outfit'), warnPercent: c.get('warnPercent'), critPercent: c.get('critPercent') };
}

function readSkins(context) {
  const dir = path.join(context.extensionPath, 'media', 'skins');
  const out = {};
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.txt')) out[f.slice(0, -4)] = fs.readFileSync(path.join(dir, f), 'utf8');
  return out;
}

// Pinch's pattern tiles use 6 px per pattern pixel; show them at 2 CSS px.
function readPatterns(context, webview) {
  const dir = vscode.Uri.joinPath(context.extensionUri, 'media', 'patterns');
  const out = {};
  for (const f of fs.readdirSync(dir.fsPath)) {
    if (!f.endsWith('.png')) continue;
    const width = fs.readFileSync(path.join(dir.fsPath, f)).readUInt32BE(16); // PNG header: width at byte 16
    out[f.slice(0, -4)] = { uri: String(webview.asWebviewUri(vscode.Uri.joinPath(dir, f))), size: Math.max(1, Math.round(width / 3)) };
  }
  return out;
}

function outfitNames(context) {
  const dir = path.join(context.extensionPath, 'media', 'skins');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => {
    const m = /^\s*name\s*:\s*(.+?)\s*$/m.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { id: f.slice(0, -4), name: m ? m[1] : f.slice(0, -4) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function spanText(ms) {
  const mins = Math.floor((ms - Date.now()) / 60000);
  if (!(mins > 0)) return null;
  const h = Math.floor(mins / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h >= 1 ? `${h}h ${String(mins % 60).padStart(2, '0')}m` : `${mins}m`;
}

// ------------------------------------------------------------------ activate ----

function activate(context) {
  const view = new ClawdView(context);
  const ownPids = new Set();
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.command = 'clawdUsage.view.focus';
  let probing = false;

  function updateBar() {
    const show = vscode.workspace.getConfiguration('clawdUsage').get('showStatusBar');
    const u = view.state.usage;
    if (!show) { bar.hide(); return; }
    if (u && u.session !== null) {
      bar.text = `$(pulse) ${u.session}%` + (u.week !== null ? ` · wk ${u.week}%` : '');
      const s = u.sessionReset ? spanText(u.sessionReset) : null, w = u.weekReset ? spanText(u.weekReset) : null;
      bar.tooltip = `Claude usage\n5-hour window: ${u.session}%` + (s ? `, resets in ${s}` : '') +
        (u.week !== null ? `\nWeek: ${u.week}%` + (w ? `, resets in ${w}` : '') : '') + '\nClick to open Clawd';
    } else { bar.text = '$(pulse) --%'; bar.tooltip = `Claude usage: ${view.state.note}`; }
    bar.show();
  }

  async function refreshUsage() {
    if (probing) return;
    probing = true;
    const exe = findClaude();
    if (!exe) view.state.note = 'Claude Code not found: set clawdUsage.claudePath';
    else {
      const res = await readUsage(exe, ownPids);
      const u = res.ok ? parseUsage(res.text) : null;
      if (u) { view.state.usage = u; view.state.note = ''; }
      else view.state.note = res.ok ? 'no plan limits in /usage (signed in with an API key?)' : 'no data: claude -p /usage failed';
    }
    probing = false;
    updateBar();
    view.post(false);
  }

  let lastSessions = '';
  function refreshSessions() {
    const s = getSessions(ownPids);
    const key = JSON.stringify(s);
    if (key === lastSessions) return;
    lastSessions = key;
    view.state.sessions = s;
    view.post(false);
  }

  let usageTimer = null;
  function schedule() {
    clearInterval(usageTimer);
    const secs = Math.max(30, vscode.workspace.getConfiguration('clawdUsage').get('refreshSeconds') || 60);
    usageTimer = setInterval(refreshUsage, secs * 1000);
  }

  async function pick(key, items) {
    const cur = vscode.workspace.getConfiguration('clawdUsage').get(key);
    const chosen = await vscode.window.showQuickPick(items.map((i) => ({ label: i.label, description: i.id === cur ? 'current' : '', id: i.id })),
      { placeHolder: key === 'theme' ? 'Theme' : 'Outfit' });
    if (chosen) await vscode.workspace.getConfiguration('clawdUsage').update(key, chosen.id, vscode.ConfigurationTarget.Global);
  }

  context.subscriptions.push(
    bar,
    vscode.window.registerWebviewViewProvider('clawdUsage.view', view, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('clawdUsage.refresh', refreshUsage),
    vscode.commands.registerCommand('clawdUsage.pickTheme', () => pick('theme', [
      { id: 'auto', label: `Follow the season (now ${themes.resolve('auto').name})` },
      ...themes.ALL.map((t) => ({ id: t.id, label: t.name }))])),
    vscode.commands.registerCommand('clawdUsage.pickOutfit', () => pick('outfit', [
      { id: 'auto', label: "The theme's own" }, { id: 'classic', label: 'None' },
      ...outfitNames(context).map((o) => ({ id: o.id, label: o.name }))])),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('clawdUsage')) return;
      if (e.affectsConfiguration('clawdUsage.refreshSeconds')) schedule();
      if (e.affectsConfiguration('clawdUsage.claudePath')) refreshUsage();
      updateBar();
      view.post(false);
    }),
  );
  const sessTimer = setInterval(refreshSessions, 2000);
  const barTimer = setInterval(updateBar, 30000);
  context.subscriptions.push({ dispose: () => { clearInterval(usageTimer); clearInterval(sessTimer); clearInterval(barTimer); } });
  schedule();
  updateBar();
  refreshSessions();
  refreshUsage();
}

function deactivate() {}

module.exports = { activate, deactivate, parseUsage, parseReset };
