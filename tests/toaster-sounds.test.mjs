// Toaster sounds: fake WebAudio, no real audio (item 26, owner: sonnet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createToasterSounds, cuesFor, newMemo, RECIPES } from '../play/toaster-sounds.mjs';

function fakeCtx(state = 'running') {
  const log = { osc: [], gains: [] };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect() {}, ...extra });
  return {
    state, currentTime: 0, destination: {}, log,
    resume() { this.state = 'running'; },
    createGain() { const g = node({ gain: param() }); log.gains.push(g); return g; },
    createDynamicsCompressor: () => node(),
    createBiquadFilter: () => node({ frequency: param(), Q: param() }),
    createOscillator() { const o = node({ frequency: param(), start() {}, stop() {}, type: 'sine' }); log.osc.push(o); return o; },
  };
}

test('all eleven sounds exist and each plays voices', () => {
  const ctx = fakeCtx(); const s = createToasterSounds({ ctx, muted: false });
  assert.deepEqual(Object.keys(RECIPES).sort(), ['alarm', 'chirp', 'creak', 'ding', 'growl', 'jingle', 'ouch', 'pop', 'powerdown', 'snap', 'tick']);
  for (const name of Object.keys(RECIPES)) assert.equal(s.play(name), true, name);
  assert.ok(ctx.log.osc.length >= 14);
});

test('mute, zero volume, and a locked context make no sound', () => {
  const ctx = fakeCtx('suspended'); const s = createToasterSounds({ ctx, muted: false });
  assert.equal(s.play('pop'), false);
  s.unlock(); assert.equal(s.play('pop'), true);
  s.setMuted(true); assert.equal(s.play('pop'), false);
  assert.equal(s.toggleMute(), false);
  s.setVolume(0); assert.equal(s.play('pop'), false);
  s.setVolume(5); assert.equal(s.getVolume(), 1);
});

test('alarm is rate limited to once per 3 seconds', () => {
  const ctx = fakeCtx(); const s = createToasterSounds({ ctx, muted: false });
  assert.equal(s.play('alarm'), true); assert.equal(s.play('alarm'), false);
  ctx.currentTime = 3.1; assert.equal(s.play('alarm'), true);
});

test('a flood of shots still plays (oldest voices are stolen)', () => {
  const ctx = fakeCtx(); const s = createToasterSounds({ ctx, muted: false });
  for (let i = 0; i < 30; i++) assert.equal(s.play('pop'), true);
});

test('no ctx is a quiet no-op', () => {
  const s = createToasterSounds({ ctx: null, muted: false });
  assert.equal(s.play('pop'), false); s.unlock();
});

const state = {
  tick: 100,
  units: [{ id: 1, owner: 0, kind: 'grunt', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'grunt', x: 9, y: 5 }],
  structures: [{ id: 10, owner: 0, kind: 'core', x: 2, y: 2, hp: 100 }, { id: 11, owner: 0, kind: 'mill', x: 3, y: 3, hp: 50 }, { id: 12, owner: 0, kind: 'toaster', x: 4, y: 4, hp: 50 }],
};
const names = (cues) => cues.map((c) => c.name);
// a memo whose mill creak has just played, so the mill does not add its creak to the cue list under test
const quiet = () => { const m = newMemo(); m.millAt = state.tick; return m; };

test('events map to cues', () => {
  const memo = newMemo();
  assert.deepEqual(names(cuesFor([{ e: 'hit', id: 2, by: 1, dmg: 1, hp: 3 }], state, 0, memo)), ['pop', 'creak']);
  assert.ok(names(cuesFor([{ e: 'hit', id: 10, by: 2, dmg: 1, hp: 3 }], state, 0, memo)).includes('alarm'));
  assert.ok(!names(cuesFor([{ e: 'hit', id: 10, by: 2, dmg: 1, hp: 3 }], state, 1, newMemo())).includes('alarm'));
  assert.ok(names(cuesFor([{ e: 'cord-cut', id: 1 }], state, 0, memo)).includes('snap'));
  assert.ok(names(cuesFor([{ e: 'order', id: 1, order: { type: 'move' } }], state, 0, memo)).includes('chirp'));
  assert.ok(!names(cuesFor([{ e: 'order', id: 2, order: { type: 'move' } }], state, 0, memo)).includes('chirp'));
});

test('toast ready fires only when an own queue shrinks', () => {
  const memo = newMemo(); memo.millAt = state.tick;
  const q = (queue) => names(cuesFor([{ e: 'queue', id: 12, queue }], state, 0, memo));
  assert.deepEqual(q(['a', 'b']), []);
  assert.deepEqual(q(['b']), ['ding']);
  assert.deepEqual(q(['b', 'c']), []);
});

test('shot bursts coalesce to four and mill creak waits 34 ticks', () => {
  const memo = newMemo();
  const many = Array.from({ length: 9 }, () => ({ e: 'hit', id: 2, by: 1, dmg: 1, hp: 1 }));
  assert.equal(names(cuesFor(many, state, 0, memo)).filter((n) => n === 'pop').length, 4);
  assert.equal(cuesFor([], { ...state, tick: 110 }, 0, memo).length, 0);
  assert.equal(cuesFor([], { ...state, tick: 134 }, 0, memo).length, 1);
});

test('a hit on one of our units or buildings makes the short ouch; theirs does not', () => {
  assert.ok(names(cuesFor([{ e: 'hit', id: 1, by: 2, dmg: 1, hp: 3 }], state, 0, quiet())).includes('ouch'), 'our grunt');
  assert.ok(names(cuesFor([{ e: 'hit', id: 11, by: 2, dmg: 1, hp: 3 }], state, 0, quiet())).includes('ouch'), 'our mill');
  assert.ok(!names(cuesFor([{ e: 'hit', id: 2, by: 1, dmg: 1, hp: 3 }], state, 0, quiet())).includes('ouch'), 'their grunt');
});

test('a hungry fighter of ours growls, theirs does not; the growl is rate limited', () => {
  assert.deepEqual(names(cuesFor([{ e: 'hungry', id: 1, player: 0, kind: 'grunt' }], state, 0, quiet())), ['growl']);
  assert.deepEqual(names(cuesFor([{ e: 'hungry', id: 2, player: 1, kind: 'grunt' }], state, 0, quiet())), []);
  const ctx = fakeCtx(); const s = createToasterSounds({ ctx, muted: false });
  assert.equal(s.play('growl'), true); assert.equal(s.play('growl'), false);
  ctx.currentTime = 3.1; assert.equal(s.play('growl'), true);
});

test('a unit of ours losing its plug (battery or down) makes the power-down cue; theirs does not', () => {
  assert.deepEqual(names(cuesFor([{ e: 'power-battery', id: 1 }], state, 0, quiet())), ['powerdown']);
  assert.deepEqual(names(cuesFor([{ e: 'power-down', id: 1 }], state, 0, quiet())), ['powerdown']);
  assert.deepEqual(names(cuesFor([{ e: 'power-down', id: 2 }], state, 0, quiet())), []);
});

test('a Crumb delivering for us makes the quiet collect tick; theirs stays silent', () => {
  assert.deepEqual(names(cuesFor([{ e: 'deliver', id: 1 }], state, 0, quiet())), ['tick']);
  assert.deepEqual(names(cuesFor([{ e: 'deliver', id: 2 }], state, 0, quiet())), []);
  const ctx = fakeCtx(); const s = createToasterSounds({ ctx, muted: false });
  assert.equal(s.play('tick'), true); assert.equal(s.play('tick'), false, 'a second tick inside 0.12 s is held back');
  const peak = RECIPES.tick.reduce((m, n) => Math.max(m, n.peak), 0);
  assert.ok(peak <= 0.02, `tick peak ${peak}`);
});

test('module has no Node-only globals', () => {
  assert.doesNotMatch(readFileSync(new URL('../play/toaster-sounds.mjs', import.meta.url), 'utf8'), /\b(Buffer|process|require)\b|from 'node:/);
});
