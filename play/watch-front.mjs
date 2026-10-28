// Where the TV camera looks when no fight is hot (owner: sonnet). Pure helpers, no DOM.
//   frontFocus(state) -> { x, y, why: 'front' }   the closest pair of enemies (fighter v fighter, or fighter v enemy structure = a siege);
//                        with no fighters out, the middle of the two box-chain tips; with nothing, the middle of the two Strips
//   createStallWatch({ graceMs }) -> { check(tick, nowMs) }   true once when the match clock stood still for graceMs
// state needs units, structures and power.points. Never returns a map corner.

export function frontFocus(state) {
  const units = state.units ?? [], structures = state.structures ?? [];
  const fighters = units.filter((x) => x.kind !== 'worker');
  let best = null;
  const consider = (a, b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (!best || d < best.d) best = { d, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  for (const a of fighters) {
    for (const b of fighters) if (b.owner > a.owner) consider(a, b);
    for (const s of structures) if (s.owner !== a.owner) consider(a, s);
  }
  if (best) return { x: best.x, y: best.y, why: 'front' };
  if (fighters.length) {
    const n = fighters.length;
    return { x: fighters.reduce((t, f) => t + f.x, 0) / n, y: fighters.reduce((t, f) => t + f.y, 0) / n, why: 'front' };
  }
  const cores = [0, 1].map((o) => structures.find((s) => s.kind === 'core' && s.owner === o));
  const tips = [];
  for (const o of [0, 1]) {
    const foe = cores[1 - o];
    const mine = (state.power?.points ?? []).filter((p) => p.owner === o);
    if (!foe || !mine.length) continue;
    const away = (p) => Math.hypot(p.x - foe.x, p.y - foe.y);
    tips.push(mine.reduce((a, b) => (away(b) < away(a) ? b : a)));
  }
  if (tips.length) return { x: tips.reduce((t, p) => t + p.x, 0) / tips.length, y: tips.reduce((t, p) => t + p.y, 0) / tips.length, why: 'front' };
  const cs = cores.filter(Boolean);
  if (cs.length) return { x: cs.reduce((t, c) => t + c.x, 0) / cs.length, y: cs.reduce((t, c) => t + c.y, 0) / cs.length, why: 'front' };
  return { x: (state.width ?? 128) / 2, y: (state.height ?? 128) / 2, why: 'front' };
}

export function createStallWatch({ graceMs = 8000 } = {}) {
  let lastTick = null, since = 0, fired = false;
  return {
    check(tick, nowMs) {
      if (tick !== lastTick) { lastTick = tick; since = nowMs; return false; }
      if (!fired && nowMs - since >= graceMs) { fired = true; return true; }
      return false;
    },
  };
}
