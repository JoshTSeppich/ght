// A5: bounded, persistent match recordings. Never store snapshots or render data.
const KEY = 'toaster-replays';
const valid = r => r && Number.isInteger(r.seed) && r.commands && typeof r.commands === 'object';
const defaultStore = () => { try { return globalThis.localStorage; } catch { return null; } };
export function loadReplays(store = defaultStore()) {
  try {
    const list = JSON.parse(store?.getItem(KEY) ?? 'null');
    if (Array.isArray(list)) return list.filter(valid).slice(0, 10);
    const old = JSON.parse(store?.getItem('toaster-last-match') ?? 'null');
    return valid(old) ? [old] : [];
  } catch { return []; }
}
export function loadReplay(id = 'last', store = defaultStore()) {
  const index = id === 'last' ? 0 : /^\d$/.test(String(id)) ? Number(id) : -1;
  return loadReplays(store)[index] ?? null;
}
export function saveReplay(log, query = '', store = defaultStore()) {
  const commands = {};
  for (const t of log.ticks) if (t.commands && (t.commands[0]?.length || t.commands[1]?.length)) commands[t.tick] = t.commands;
  const q = new URLSearchParams(query);
  const setup = Object.fromEntries(['map','side','difficulty','keys','mode'].map(k => [k,q.get(k)]).filter(([,v])=>v!==null));
  const rec = {seed:log.seed,maxTicks:log.ticks.length+1,commands,setup,savedAt:Date.now()};
  try { if (!store) return false; store.setItem(KEY,JSON.stringify([rec,...loadReplays(store)].slice(0,10))); return true; } catch { return false; }
}
