// Sandbox mode (PLAYABLE.md item 13, owner: sonnet): debug commands are ordinary commands the sim refuses outside a sandbox.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';
import { enableSandbox } from '../env/debug.mjs';
import { createLiveMatch } from '../env/live.mjs';
import { sandboxMode, stepSpeed, cheatCommand, sandboxBadge, sandboxState, idleOpponent, SPEEDS } from '../play/sandbox.mjs';

const rejects = (state) => state.events.filter((e) => e.e === 'reject');
function run(state, cmds) { step(state, [cmds, []]); return state; }
const cmd = (op, extra = {}) => ({ type: 'debug', op, ...extra });

test('outside a sandbox every debug command is rejected with no-sandbox and changes nothing', () => {
  const s = createToasterState(7);
  const wheat = s.shards[0], stack = s.toast.stack[0], units = s.units.length;
  const state = run(s, [cmd('wheat'), cmd('toast'), cmd('reveal'), cmd('spawn', { kind: 'grunt', x: 10, y: 10 })]);
  const r = rejects(state).filter((e) => e.command.type === 'debug');
  assert.equal(r.length, 4);
  assert.ok(r.every((e) => e.reason === 'no-sandbox'));
  assert.equal(state.shards[0], wheat);
  assert.equal(state.toast.stack[0], stack);
  assert.equal(state.units.length, units);
  assert.equal(state.sandbox, undefined);
});

test('in a sandbox F5 and F6 add wheat and toast; F7 reveals', () => {
  const s = enableSandbox(createToasterState(7));
  const wheat = s.shards[0], stack = s.toast.stack[0];
  run(s, [cmd('wheat', { amount: 500 }), cmd('toast', { amount: 20 }), cmd('reveal')]);
  assert.equal(rejects(s).length, 0);
  assert.equal(s.shards[0], wheat + 500);
  assert.equal(s.toast.stack[0], stack + 20);
  assert.equal(s.sandbox.revealed, true);
});

test('spawn puts a squad of the chosen kind on free ground near the cursor', () => {
  const s = enableSandbox(createToasterState(7));
  const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
  const before = s.units.filter((u) => u.kind === 'grunt').length;
  run(s, [cmd('spawn', { kind: 'grunt', x: core.x + 3, y: core.y, count: 4 })]);
  assert.equal(rejects(s).length, 0);
  const fresh = s.units.filter((u) => u.kind === 'grunt');
  assert.equal(fresh.length - before, 4);
  const tiles = new Set(fresh.map((u) => `${u.x},${u.y}`));
  assert.equal(tiles.size, fresh.length, 'no two on one tile');
  assert.ok(fresh.every((u) => u.owner === 0));
});

test('bad debug input is refused, not a crash', () => {
  const s = enableSandbox(createToasterState(7));
  run(s, [cmd('wheat', { amount: -5 }), cmd('wheat', { amount: 1e9 }), cmd('spawn', { kind: 'dragon', x: 3, y: 3 }), cmd('spawn', { kind: 'grunt', x: -1, y: 3 }), cmd('spawn', { kind: 'grunt', x: 3, y: 3, count: 99 }), cmd('nope')]);
  assert.deepEqual(rejects(s).map((e) => e.reason), ['bad-command', 'bad-command', 'wrong-kind', 'off-map', 'bad-command', 'bad-command']);
});

test('cheats are deterministic: same seed and commands, same state', () => {
  const play = () => { const s = enableSandbox(createToasterState(9)); run(s, [cmd('wheat'), cmd('spawn', { kind: 'grunt', x: 12, y: 12 })]); for (let i = 0; i < 20; i++) step(s, [[], []]); return JSON.stringify([s.shards, s.units, s.toast]); };
  assert.equal(play(), play());
});

test('pure helpers: mode, speed steps, key mapping, badge', () => {
  assert.equal(sandboxMode(new URLSearchParams('mode=sandbox')), true);
  assert.equal(sandboxMode(new URLSearchParams('difficulty=none')), true);
  assert.equal(sandboxMode(new URLSearchParams('mode=watch')), false);
  assert.equal(sandboxMode(new URLSearchParams('')), false);
  assert.deepEqual(SPEEDS, [0.5, 1, 2, 4]);
  assert.equal(stepSpeed(1, 1), 2);
  assert.equal(stepSpeed(4, 1), 4);
  assert.equal(stepSpeed(1, -1), 0.5);
  assert.equal(stepSpeed(0.5, -1), 0.5);
  assert.equal(cheatCommand('F5').op, 'wheat');
  assert.equal(cheatCommand('F6').op, 'toast');
  assert.equal(cheatCommand('F7').op, 'reveal');
  assert.equal(cheatCommand('F8'), null);
  assert.equal(cheatCommand('F8', { selectedKind: 'grunt', cursor: { x: 4, y: 5 } }).kind, 'grunt');
  assert.equal(cheatCommand('F9'), null);
  assert.match(sandboxBadge(2), /Sandbox.*2x/s);
  assert.match(sandboxBadge(2, true), /PAUSED/);
  assert.deepEqual(idleOpponent.act({}), []);
  assert.equal(sandboxState(createToasterState)(3).sandbox.revealed, false);
});

test('the live driver speeds up: 4x ticks about four times faster', async () => {
  async function ticksIn(speed, ms) {
    let t = 0, seq = 0;
    const timers = new Map();
    const turns = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
    const d = createLiveMatch({ seed: 5, ai: idleOpponent, now: () => t, setTimer: (fn, w) => { timers.set(++seq, { at: t + Math.max(0, w), fn }); return seq; }, clearTimer: (id) => timers.delete(id) });
    await d.ready();
    d.setSpeed(speed);
    d.start();
    for (let step = 0; step < 4000 && t < ms; step++) {
      await turns();
      const due = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!due || due[1].at > ms) break;
      timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
    }
    await turns();
    const n = d.state.tick; d.stop(); return n;
  }
  const one = await ticksIn(1, 2000), four = await ticksIn(4, 2000);
  assert.ok(one >= 40 && one <= 50, '1x ' + one);
  assert.ok(four >= 3.6 * one && four <= 4.4 * one, '4x ' + four + ' vs 1x ' + one);
});
