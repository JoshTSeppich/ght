// Watch mode plays a recorded GHT match (play/replay/record.mjs) instead of two live AIs. Owner: sonnet.
//   replaySeed(query)         -> 3 | 5 | null    which recording the page plays (null: ?replay=off, run the live AIs)
//   replayUrl(seed, base)     -> URL of the recording (gzipped JSON)
//   replayPlayer(rec)         -> createPlayer(opts) giving { name, act(obs) } that answers with the recorded commands for obs.tick
//   nextReplaySeed(seed)      -> the other recording (the TV alternates)
//   parseReplay(bytes)        -> the recording from gzipped or plain JSON bytes
// The recording is seed + commands. The live page rebuilds the same state (createReplayState), so the same match unfolds.
export const REPLAY_SEEDS = Object.freeze([3, 5]);

export function replaySeed(q) {
  const r = q.get('replay');
  if (r === 'off' || q.get('ai') !== null) return null;
  const want = Number(r ?? q.get('seed'));
  return REPLAY_SEEDS.includes(want) ? want : REPLAY_SEEDS[0];
}
export const nextReplaySeed = (seed) => REPLAY_SEEDS[(REPLAY_SEEDS.indexOf(seed) + 1) % REPLAY_SEEDS.length];
export const replayUrl = (seed, base = import.meta.url) => new URL(`./toaster-seed-${seed}.json.gz`, base);

export function replayPlayer(rec) {
  return ({ side }) => ({
    name: 'replay',
    act: (obs) => rec.commands[obs.tick]?.[side] ?? [],
  });
}

/** Gzipped (magic 1f 8b) or plain JSON bytes -> the recording. A server that already unzipped it is fine too. */
export async function parseReplay(buffer) {
  let bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Fetch a recording. Returns null when it cannot be loaded (the page then runs the live AIs). */
export async function loadReplay(seed, fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(replayUrl(seed));
    if (res && res.ok === false) return null;
    const rec = await parseReplay(await res.arrayBuffer());
    return rec && rec.seed === seed && rec.commands ? rec : null;
  } catch {
    return null;
  }
}
