// Card 8 item 5: the ambient loop from assets/audio/MANIFEST.json plays on /play, starts on the first click or key,
// and follows the mute key (the synth master gain goes to zero, so the loop goes silent with everything else).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createToasterSounds } from '../play/toaster-sounds.mjs';

const MANIFEST = JSON.parse(readFileSync(new URL('../assets/audio/MANIFEST.json', import.meta.url), 'utf8'));

function fakeCtx() {
  const sources = [];
  const gains = [];
  const ctx = {
    state: 'suspended', sampleRate: 22050, currentTime: 0, destination: {},
    resume() { this.state = 'running'; return Promise.resolve(); },
    decodeAudioData: async (bytes) => ({ bytes }),
    createGain() { const g = { gain: { value: 1 }, connect() {} }; gains.push(g); return g; },
    createBufferSource() { const s = { buffer: null, loop: false, started: 0, connect() {}, start() { this.started++; }, stop() {} }; sources.push(s); return s; },
    createOscillator() { return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; },
  };
  return { ctx, sources, gains };
}

const okFetch = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer });

test('the manifest names an ambient loop that loops', () => {
  const ev = MANIFEST.events.ambient_loop;
  assert.equal(ev.kind, 'ambient');
  assert.equal(ev.loop, true);
});

test('loadAmbient decodes the manifest loop; nothing plays until the first click or key', async () => {
  const { ctx, sources } = fakeCtx();
  const sounds = createToasterSounds({ ctx, volume: 0.6, muted: false });
  const ok = await sounds.loadAmbient(MANIFEST, okFetch, '../assets/audio/MANIFEST.json');
  assert.equal(ok, true);
  assert.equal(sources.length, 0, 'no source before unlock');
  sounds.unlock();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].loop, true);
  assert.equal(sources[0].started, 1);
});

test('unlock twice starts the loop once', async () => {
  const { ctx, sources } = fakeCtx();
  const sounds = createToasterSounds({ ctx, volume: 0.6, muted: false });
  await sounds.loadAmbient(MANIFEST, okFetch, '../assets/audio/MANIFEST.json');
  sounds.unlock();
  sounds.unlock();
  assert.equal(sources.length, 1);
});

test('mute silences the loop through the master gain, and unmute brings it back', async () => {
  const { ctx, gains } = fakeCtx();
  const sounds = createToasterSounds({ ctx, volume: 0.6, muted: false });
  await sounds.loadAmbient(MANIFEST, okFetch, '../assets/audio/MANIFEST.json');
  sounds.unlock();
  const master = gains[0];
  sounds.toggleMute();
  assert.equal(master.gain.value, 0);
  sounds.toggleMute();
  assert.ok(master.gain.value > 0);
});

test('a missing or undecodable loop is a quiet no-op, not an error', async () => {
  const { ctx, sources } = fakeCtx();
  const sounds = createToasterSounds({ ctx, volume: 0.6, muted: false });
  const bad = async () => ({ ok: false, status: 404 });
  assert.equal(await sounds.loadAmbient(MANIFEST, bad, '../assets/audio/MANIFEST.json'), false);
  sounds.unlock();
  assert.equal(sources.length, 0);
});

test('with no AudioContext every call is a no-op', async () => {
  const sounds = createToasterSounds({ ctx: null, volume: 0.6, muted: false });
  assert.equal(await sounds.loadAmbient(MANIFEST, okFetch, '../assets/audio/MANIFEST.json'), false);
  sounds.unlock();
});
