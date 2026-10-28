// Ghoster and Hoster model data v2 (play/faction-models.mjs): every model valid, at toaster fidelity, and shaped the way
// the art reads. "They're not all equal" (Joshua): every unit has a face, blinking eyes, a team mark and its own silhouette.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GHOSTERS, HOSTERS, GEO_TRIS, FACTION_COLORS, CUTENESS, kindOf, validate, trianglesOf } from '../play/faction-models.mjs';
import { TOASTERS } from '../play/toaster-models.mjs';

const all = [...Object.values(GHOSTERS), ...Object.values(HOSTERS)];

test('every model validates: geometry, budget (240, the toasters ceiling), team mark, eyes', () => {
  for (const m of all) assert.deepEqual(validate(m), [], m.id);
  for (const m of all) assert.ok(trianglesOf(m) <= 240, `${m.id} ${trianglesOf(m)}`);
});

test('parity with the toasters: basic units are Popper-sized, nobody is a 50-triangle placeholder', () => {
  const popper = TOASTERS.popper;
  for (const id of ['wisp', 'phantom', 'corkshot', 'confetti-bomber', 'dj', 'hype-captain', 'host']) {
    const m = GHOSTERS[id] ?? HOSTERS[id];
    assert.ok(m.top > popper.top * 0.8 && m.top < popper.top * 1.6, `${id} top ${m.top.toFixed(2)} vs popper ${popper.top.toFixed(2)}`);
  }
  for (const m of all) assert.ok(trianglesOf(m) >= 90, `${m.id} ${trianglesOf(m)}`);
});

test('every unit has its own silhouette: no two share the same set of part ids', () => {
  const sig = (m) => m.parts.map((x) => x.id).sort().join(',');
  for (const group of [GHOSTERS, HOSTERS]) {
    const seen = new Map();
    for (const m of Object.values(group)) { assert.ok(!seen.has(sig(m)), `${m.id} looks like ${seen.get(sig(m))}`); seen.set(sig(m), m.id); }
  }
});

test('ghosts float with a face, two eyes, tendrils hanging tip-down and one signature part', () => {
  const signature = { wisp: 'crest', shade: 'cowl', phantom: 'trail' };
  for (const [id, sigPart] of Object.entries(signature)) {
    const g = GHOSTERS[id];
    assert.ok(g.hover > 0, id);
    assert.ok(g.parts.some((x) => x.id === 'face') && g.parts.filter((x) => x.eye).length === 2, id);
    const tails = g.parts.filter((x) => x.pivot === 'tendrilL' || x.pivot === 'tendrilR');
    assert.equal(tails.length, 2, id);
    assert.ok(tails.every((x) => x.flipY), id);
    assert.ok(g.parts.some((x) => x.id === sigPart), `${id} has its ${sigPart}`);
  }
  assert.ok(GHOSTERS.phantom.height > GHOSTERS.wisp.height && GHOSTERS.shade.body.w > GHOSTERS.wisp.body.w, 'phantom tall, shade wide');
});

test('hosters stand with mirrored legs, two arms, a face, a team armband and their role gear', () => {
  for (const h of Object.values(HOSTERS)) {
    const l = h.parts.find((x) => x.id === 'leg-l'), r = h.parts.find((x) => x.id === 'leg-r');
    assert.equal(l.pos[0], -r.pos[0], h.id);
    assert.deepEqual([l.pos[1], l.pos[2]], [r.pos[1], r.pos[2]], h.id);
    assert.ok(Math.abs(l.pos[1] - l.size[1] / 2) < 1e-9, `${h.id}: feet on the ground`);
    const al = h.parts.find((x) => x.id === 'arm-l'), ar = h.parts.find((x) => x.id === 'arm-r');
    assert.ok(al.pivot === 'armL' && ar.pivot === 'armR' && al.pos[0] === -ar.pos[0], h.id);
    assert.ok(h.parts.some((x) => x.part === 'team' && x.pivot === 'armL'), `${h.id}: armband`);
    assert.ok(h.parts.some((x) => x.id === 'face') && h.parts.filter((x) => x.eye).length === 2, `${h.id}: face`);
    const gear = h.parts.filter((x) => x.part === 'prop' || x.part === 'prop-glow');
    assert.ok(gear.length >= 1, `${h.id}: gear`);
    if (h.id !== 'dj') assert.ok(gear.every((x) => x.pivot === 'armR' && x.hinge.join() === ar.hinge.join()), `${h.id}: gear swings with the right arm`);
  }
  assert.ok(HOSTERS.host.parts.some((x) => x.id === 'hat-crown'), 'the Host wears a top hat');
  assert.ok(HOSTERS.dj.parts.some((x) => x.id === 'speaker-pack' && x.pos[2] < 0), 'the DJ wears his speaker on his back');
  assert.ok(HOSTERS.bouncer.body.w > HOSTERS.corkshot.body.w * 1.3, 'the Bouncer is broad');
});

test('kindOf maps faction kinds, honours a faction hint and hands everything else back to the toasters', () => {
  assert.deepEqual(kindOf('Ghost_Phantom'), { faction: 'ghosters', id: 'phantom' });
  assert.deepEqual(kindOf('haunted_lantern'), { faction: 'ghosters', id: 'lantern' });
  assert.deepEqual(kindOf('hype_captain'), { faction: 'hosters', id: 'hype-captain' });
  assert.deepEqual(kindOf('party_guest'), { faction: 'hosters', id: 'corkshot' });
  assert.deepEqual(kindOf('mystery', 'hosters'), { faction: 'hosters', id: 'host' });
  assert.deepEqual(kindOf('popper'), { faction: 'toasters', id: 'crumb' });
  assert.deepEqual(kindOf(undefined), { faction: 'toasters', id: 'crumb' });
});

test('geometry kinds, cuteness rules and colours are all defined', () => {
  for (const m of all) for (const x of m.parts) assert.ok(Object.hasOwn(GEO_TRIS, x.geo), `${m.id}/${x.id}`);
  assert.ok(CUTENESS.ghosters.faceWidth > 0 && CUTENESS.hosters.faceWidth > 0);
  for (const c of [...Object.values(FACTION_COLORS.ghosters), ...Object.values(FACTION_COLORS.hosters), ...FACTION_COLORS.teamAccents])
    assert.match(c, /^#[0-9A-F]{6}$/i);
});
