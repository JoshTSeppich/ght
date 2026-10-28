// Original synthesized sounds for GHT (PLAYABLE item 26). Recipes follow research/SOUNDS.md: oscillators and
// envelopes only, no samples. Browser-safe (no Node globals). Sits beside play/sound-player.mjs and shares its mute key.
import { soundUrl } from '../viewer3d/audio.mjs';
const MUTE_KEY = 'ght.muted';
const AMBIENT_GAIN = 0.3; // the ambient loop sits under the effects (the viewer uses the same level)
const VOL_KEY = 'ght.volume';
const MAX_VOICES = 24;

// One oscillator voice: type, start/end pitch, start offset, attack, peak gain, decay end, stop (all seconds).
const N = (type, f0, f1, at, atk, peak, decay, stop, extra = {}) => ({ type, f0, f1, at, atk, peak, decay, stop, ...extra });
const CREAK = { mid: [0.13, 103], end: 0.27 };
export const RECIPES = {
  pop: [N('triangle', 440, 95, 0, 0.002, 0.18, 0.075, 0.08), N('square', 1320, null, 0, 0.001, 0.025, 0.012, 0.017)],
  ding: [N('sine', 1175, null, 0, 0.003, 0.12, 0.30, 0.305), N('sine', 1880, null, 0, 0.002, 0.035, 0.13, 0.135)],
  creak: [N('triangle', 137, 149, 0, 0.025, 0.045, 0.33, 0.335, CREAK), N('sawtooth', 137, 149, 0, 0.025, 0.008, 0.33, 0.335, { ...CREAK, lowpass: 480 })],
  chirp: [N('triangle', 690, 860, 0, 0.003, 0.065, 0.055, 0.06), N('triangle', 1040, 920, 0.075, 0.003, 0.065, 0.065, 0.07)],
  snap: [N('square', 980, 120, 0, 0.001, 0.075, 0.04, 0.045), N('triangle', 155, 62, 0, 0.002, 0.09, 0.12, 0.125)],
  alarm: [370, 495, 370].map((f, i) => N('triangle', f, null, i * 0.21, 0.008, 0.10, 0.13, 0.135)),
  jingle: [[523, 0, 0.12], [697, 0.14, 0.15], [784, 0.31, 0.18], [1046, 0.53, 0.42]].flatMap(([f, at, d], i) => {
    const out = [N('triangle', f, null, at, 0.008, 0.10, d, d)];
    if (i === 3) out.push(N('sine', 1569, null, at, 0.008, 0.025, d, d));
    return out;
  }),
  // a hungry fighter's stomach: two low saw growls falling in pitch behind a lowpass
  growl: [N('sawtooth', 96, 58, 0, 0.06, 0.09, 0.5, 0.52, { lowpass: 260 }), N('sawtooth', 97, 61, 0.12, 0.05, 0.07, 0.36, 0.38, { lowpass: 260 })],
  // our unit or building was hit: a short squeak that falls away
  ouch: [N('triangle', 620, 330, 0, 0.002, 0.09, 0.09, 0.095), N('square', 1400, 900, 0, 0.001, 0.02, 0.05, 0.055)],
  // a unit lost its plug: a boing that sags to nothing
  powerdown: [N('triangle', 520, 130, 0, 0.004, 0.10, 0.34, 0.345), N('square', 260, 90, 0.2, 0.002, 0.03, 0.12, 0.125)],
  // a Crumb delivered to us: a very quiet tick, so a busy economy does not nag
  tick: [N('square', 2400, null, 0, 0.001, 0.012, 0.012, 0.014), N('sine', 3200, null, 0, 0.001, 0.008, 0.02, 0.022)],
};
const LIMITS = { creak: 1.4, chirp: 0.25, alarm: 3, growl: 3, ouch: 0.15, powerdown: 1.5, tick: 0.12 }; // minimum seconds between plays of the same sound
const PRIORITY = { alarm: 3, jingle: 3, ding: 2, snap: 2, growl: 2, ouch: 2, powerdown: 2, chirp: 1, pop: 0, creak: 0, tick: 0 };

function store(key, v) { try { globalThis.localStorage?.setItem(key, String(v)); } catch { /* blocked storage */ } }
function read(key) { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } }

// opts: { ctx, volume 0..1, muted }. play(name, {pan}) -> true if a voice started.
export function createToasterSounds({ ctx = defaultContext(), volume, muted } = {}) {
  const saved = read(VOL_KEY);
  let vol = volume ?? (saved !== null ? Number(saved) : 0.6);
  vol = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.6;
  let isMuted = muted ?? read(MUTE_KEY) === '1';
  let master = null; const last = {}; const voices = [];
  let ambientBuf = null, ambientSrc = null;
  const level = () => (isMuted ? 0 : vol * 0.5);

  function bus() {
    if (master) return master;
    master = ctx.createGain(); master.gain.value = level();
    const comp = ctx.createDynamicsCompressor?.();
    if (comp) { master.connect(comp); comp.connect(ctx.destination); } else master.connect(ctx.destination);
    return master;
  }
  let unlocked = false;
  function unlock() { unlocked = true; if (ctx && ctx.state !== 'running') ctx.resume?.(); startAmbient(); }

  // The ambient loop (MANIFEST ambient_loop). It runs through the same master gain, so mute and volume cover it.
  // Returns true when the loop is decoded and ready; a missing or broken file leaves the match quiet, not broken.
  async function loadAmbient(json, fetchFn = globalThis.fetch, manifestUrl = new URL('../assets/audio/MANIFEST.json', import.meta.url).href) {
    const entry = json?.events?.ambient_loop;
    if (!ctx || !entry?.file || typeof fetchFn !== 'function') return false;
    try {
      const res = await fetchFn(soundUrl(manifestUrl, entry.file));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ambientBuf = await ctx.decodeAudioData(await res.arrayBuffer());
      startAmbient();
      return true;
    } catch { return false; }
  }
  // Starts once the page has had a click or key (browsers block audio before that) and the loop is decoded.
  function startAmbient() {
    if (!ctx || !unlocked || !ambientBuf || ambientSrc) return;
    const out = bus();
    const g = ctx.createGain(); g.gain.value = AMBIENT_GAIN;
    ambientSrc = ctx.createBufferSource();
    ambientSrc.buffer = ambientBuf; ambientSrc.loop = true;
    ambientSrc.connect(g); g.connect(out);
    ambientSrc.start();
  }

  function voice(n, t0, out, name) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = n.type; const t = t0 + n.at;
    osc.frequency.setValueAtTime(n.f0, t);
    if (n.mid) { osc.frequency.exponentialRampToValueAtTime(n.mid[1], t + n.mid[0]); osc.frequency.exponentialRampToValueAtTime(n.f1, t + n.end); }
    else if (n.f1) osc.frequency.exponentialRampToValueAtTime(n.f1, t + n.decay);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(n.peak, t + n.atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + n.decay);
    g.gain.linearRampToValueAtTime(0, t + n.stop);
    let tail = osc;
    if (n.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = n.lowpass; f.Q.value = 0.7; osc.connect(f); tail = f; }
    tail.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + n.stop + 0.005);
    const v = { osc, g, name };
    voices.push(v);
    osc.onended = () => { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); };
  }

  function play(name, { pan = 0 } = {}) {
    const rec = RECIPES[name];
    if (!ctx || !rec || isMuted || vol <= 0 || ctx.state !== 'running') return false;
    const now = ctx.currentTime;
    if (LIMITS[name] && last[name] !== undefined && now - last[name] < LIMITS[name]) return false;
    last[name] = now;
    const m = bus(); let out = m;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.7, Math.min(0.7, pan)); p.connect(m); out = p; }
    while (voices.length + rec.length > MAX_VOICES && voices.length) { // steal the oldest lowest-priority voice
      let k = 0;
      for (let i = 1; i < voices.length; i++) if ((PRIORITY[voices[i].name] ?? 0) < (PRIORITY[voices[k].name] ?? 0)) k = i;
      const v = voices.splice(k, 1)[0];
      v.g.gain.cancelScheduledValues(now); v.g.gain.linearRampToValueAtTime(0, now + 0.005);
      try { v.osc.stop(now + 0.01); } catch { /* already stopped */ }
    }
    for (const n of rec) voice(n, now, out, name);
    return true;
  }
  function apply() { if (master) master.gain.value = level(); }
  return {
    play, unlock, loadAmbient,
    setVolume(v) { vol = Math.min(1, Math.max(0, Number(v) || 0)); store(VOL_KEY, vol); apply(); },
    getVolume: () => vol,
    setMuted(m) { isMuted = !!m; store(MUTE_KEY, isMuted ? '1' : '0'); apply(); },
    toggleMute() { isMuted = !isMuted; store(MUTE_KEY, isMuted ? '1' : '0'); apply(); return isMuted; },
    isMuted: () => isMuted,
  };
}

// Pure: which stinger a finished match plays, so each result gets one. A GHT win has the synth jingle;
// every other win or loss has the sample stinger (MANIFEST victory/defeat); a draw plays nothing.
export function resultStingers(result, side, toasterOn) {
  const winner = result?.winner;
  const decided = winner === 0 || winner === 1;
  const won = decided && winner === side;
  return {
    synth: toasterOn && won ? 'jingle' : null,
    sample: decided && !(toasterOn && won) ? (won ? 'victory' : 'defeat') : null,
  };
}

// Pure: one tick of sim events -> [{name, pan?}] for the listener's `side`. `memo` carries state between ticks (queue
// lengths: a shrinking queue is "toast ready"; the last Mill creak tick). `view` ({x, halfW}) pans shots when given.
export function newMemo() { return { queues: new Map(), millAt: -1e9 }; }
export function cuesFor(events, state, side, memo = newMemo(), view = null) {
  const cues = []; const pops = []; let alarm = false, snap = false, chirp = false, ding = false, ouch = false, growl = false, down = false, tick = false;
  const find = (id) => state.units.find((u) => u.id === id) || state.structures?.find((s) => s.id === id);
  const pan = (o) => (view && o ? Math.max(-0.7, Math.min(0.7, (o.x - view.x) / (view.halfW || 20))) : 0);
  for (const ev of events) {
    if (ev.e === 'hit') {
      const t = find(ev.id);
      if (t && t.owner === side && (t.kind === 'core' || t.kind === 'strip')) alarm = true;
      if (t && t.owner === side) ouch = true;   // any of our units or buildings: the short hit sound
      if (pops.length < 4) pops.push({ name: 'pop', pan: pan(find(ev.by)) });
    } else if (ev.e === 'hungry') {
      const u = find(ev.id); if (u && u.owner === side) growl = true;
    } else if (ev.e === 'power-down' || ev.e === 'power-battery') {
      const u = find(ev.id); if (u && u.owner === side) down = true;
    } else if (ev.e === 'deliver') {
      const w = find(ev.id); if (w && w.owner === side) tick = true;
    } else if (ev.e === 'order' && ev.order) {
      const u = find(ev.id); if (u && u.owner === side) chirp = true;
    } else if (ev.e === 'cord-cut') snap = true;
    else if (ev.e === 'queue') {
      const b = find(ev.id), n = ev.queue.length, prev = memo.queues.get(ev.id) ?? n;
      memo.queues.set(ev.id, n);
      if (b && b.owner === side && n < prev) ding = true;
    }
  }
  if (alarm) cues.push({ name: 'alarm' });
  if (snap) cues.push({ name: 'snap' });
  if (ding) cues.push({ name: 'ding' });
  if (chirp) cues.push({ name: 'chirp' });
  if (growl) cues.push({ name: 'growl' });
  if (down) cues.push({ name: 'powerdown' });
  if (ouch) cues.push({ name: 'ouch' });
  if (tick) cues.push({ name: 'tick' });
  cues.push(...pops);
  const mills = (state.structures || []).some((s) => s.owner === side && s.kind === 'mill' && s.hp > 0);
  if (mills && state.tick - memo.millAt >= 34) { memo.millAt = state.tick; cues.push({ name: 'creak' }); }
  return cues;
}

// A small volume slider and mute label, bottom right. Returns { paint } so a hotkey can refresh the label.
export function mountSoundControls(sounds, doc = globalThis.document) {
  if (!doc?.body) return null;
  const box = doc.createElement('div');
  box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:20;background:#000a;color:#fff;font:12px sans-serif;padding:4px 8px;border-radius:6px;display:flex;gap:6px;align-items:center';
  const lab = doc.createElement('span'), rng = doc.createElement('input');
  rng.type = 'range'; rng.min = '0'; rng.max = '100'; rng.value = String(Math.round(sounds.getVolume() * 100)); rng.title = 'Volume';
  const paint = () => { lab.textContent = sounds.isMuted() ? 'Muted (`)' : 'Sound (`)'; }; // the backtick is MUTE_KEY (play/input.mjs)
  rng.oninput = () => { sounds.setVolume(rng.value / 100); if (sounds.isMuted() && rng.value > 0) sounds.setMuted(false); paint(); };
  lab.onclick = () => { sounds.toggleMute(); paint(); }; lab.style.cursor = 'pointer';
  paint(); box.append(lab, rng); doc.body.append(box);
  return { paint };
}

function defaultContext() {
  const C = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!C) return null;
  try { return new C(); } catch { return null; }
}
