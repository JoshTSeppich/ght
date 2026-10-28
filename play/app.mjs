// GHT (default) / GHT Classic (?classic=1): the playable client (owner: sonnet, Playable Client).
// A human plays side 0 against a built-in bot (side 1) live in the browser. env/live.mjs runs the sim at a fixed
// 24 ticks per second and the bot; input becomes commands on the next tick (play/input.mjs); the viewer3d systems
// draw it through a "live world" that has the same frame() shape as viewer3d/world.mjs.
//
// Pure parts (createLiveWorld, createCameraRig) are exported so node tests can cover them without a DOM.
// Query: ?ai=builtin|sonnet|haiku|fable|sample  ?difficulty=easy|normal  ?seed=7  ?ticks=21600 (match length)  ?tps=24
//        ?mode=watch (the built-in AI plays both sides; a caster camera follows the action; next seed 10 s after the end)
//        ?quality=high|medium|low  ?mute=1  ?debug=1  ?side=0|1 (which side you play)

import { statFor } from '../viewer/replay.mjs';
import { observe } from '../env/state.mjs';
import { STATS, rowOf } from '../env/stats.mjs';
import { createLiveMatch, loadAi } from '../env/live.mjs';
import { isWatch, createCaster, createTopbar, glide, nextSeed, RESTART_SECONDS } from './watch.mjs';
import { frontFocus, createStallWatch } from './watch-front.mjs';
import { createInput, pickEntity, isStructure, installPointerControls, MUTE_KEY, INSPECT_KEY, pauseKeyFires, gameTakesKey } from './input.mjs';
import { tutorialOn, tutorialProgress, OBJECTIVE } from './tutorial.mjs';
import { mountTutorial } from './tutorial-card.mjs';
import { CAMERA, createCameraRig, cameraKeyAction, createCameraMarks } from './camera.mjs';
import { renderSelectionPanel } from './hud.mjs';
import { createFlowTracker } from './hud-bar.mjs';
import { badgesFor, drawBadges } from './hud-badges.mjs';
import { cancelCommand } from './hud-queue.mjs';
import { createIdleCrumbs, idleButtonHtml } from './idle-crumbs.mjs';
import { saturationLine } from './hud-saturation.mjs';
import { renderCard, cardSignature } from './command-card.mjs';
import { campMarks, drawCampsOverlay, drawCampsMinimap, drawPickups } from './camps.mjs';
import { cardWithRecall } from './items-ui.mjs';
import { createFeedback } from './feel.mjs';
import { createSoundPlayer } from './sound-player.mjs';
import { createToasterSounds, cuesFor, newMemo, mountSoundControls, resultStingers } from './toaster-sounds.mjs';
import { setArtProvider } from './icons.mjs';
import { toasterArt } from './toaster-art.mjs';
import { kindName } from './hud.mjs';
import { buildMinimapImage } from './wheatfield-terrain.mjs';
import { toasterBuildingLook } from './toaster-buildings.mjs';
import { createStationLayer } from './power-stations-3d.mjs';
import { createBreadLife } from './bread-life.mjs';
import { replaySeed, nextReplaySeed, replayPlayer, loadReplay } from './replay/replay-bot.mjs';
import { mountStartScreen, mountFlowMenu, replaySetupQuery, setupQuery, setupValues } from './start-screen.mjs';
import { saveReplay, loadReplay as loadStoredReplay } from './replay-storage.mjs';
import { stationCost } from './station-controls.mjs';
import { drawGhost, ghostFor, tileSet } from './placement-ghost.mjs';
import { opponentAiName, opponentLevel, mountOpponentChoice } from './opponent.mjs';
import { sandboxMode,idleOpponent, sandboxState, stepSpeed, cheatCommand, sandboxBadge, speedChip } from './sandbox.mjs';
import { wheatfieldMap, createReplayState, toasterOptions, createToasterState, toasterInputOptions, keyProfile, toasterTopBar, toasterPanel, observeToaster, PAGE_TITLE } from './toaster-play.mjs';
import { createMatchStats, resultsCardHtml, saveLastMatch, loadLastMatch, replayQuery, mountMatchMenu } from './results-card.mjs';
import { territoryOptions, territoryPanel, drawReachBorders, drawPowerOverlay } from './territory-wire.mjs';
import { reachViews, drawReachMinimap } from './reach-view.mjs';
import { kitchenSites, createPings, drawKitchenMinimap } from './minimap-kitchen.mjs';
import { mountKitchenPanel } from './kitchen-panel.mjs';

export const TICKS_PER_SECOND = 24;
export const DEFAULT_MATCH_TICKS = 24 * 60 * 15; // about 15 minutes of real time
const lerp = (a, b, t) => a + (b - a) * t;
const byIdMap = (list) => new Map(list.map((e) => [e.id, e]));

// ---------------------------------------------------------------------------------------------------------------
// Live world: the same frame() shape as viewer3d/world.mjs, fed one tick at a time instead of from a log.
//   push(snapshot, events)  after each sim step;  frame(alpha) -> { tick, alpha, prev, next, events, groups, units, structures, dying }
// ---------------------------------------------------------------------------------------------------------------
export function createLiveWorld(initial, stats) {
  let prev = initial, next = initial, rawEvents = [], enriched = [], alpha = 0, grouped = emptyGroups();
  const facing = new Map();
  const world = {
    ticks: 1e9, start: 0, end: 1e9, stats, players: ['You', 'Bot'], result: null,
    map: { width: initial.width, height: initial.height, rocks: initial.rocks, crystals: initial.crystals },
    stateAt: () => next,
    facingAt: (id, _tick, fallback = 0) => facing.get(id) ?? fallback,
    push(snapshot, events) {
      noteFacing(prev = next, snapshot, events);
      next = snapshot; rawEvents = events;
      enriched = enrich(events, prev, next);
      grouped = group(enriched);
    },
    setAlpha(a) { alpha = Math.max(0, Math.min(1, a)); },
    frame() {
      const dec = decorate(prev, next, alpha, enriched, stats, facing);
      return {
        tick: prev.tick, alpha, prev, next, events: enriched, groups: grouped,
        units: dec.units, structures: dec.structures, dying: [...dec.units, ...dec.structures].filter((e) => e.dying),
      };
    },
    get current() { return next; },
    get rawEvents() { return rawEvents; },
  };
  return world;

  function noteFacing(before, after, events) {
    const all = byIdMap([...before.units, ...before.structures]);
    for (const ev of events) {
      if (ev.e === 'move') {
        const u = all.get(ev.id);
        if (u && (ev.x !== u.x || ev.y !== u.y)) facing.set(ev.id, Math.atan2(ev.y - u.y, ev.x - u.x));
      } else if (ev.e === 'hit') {
        const a = all.get(ev.by), d = all.get(ev.id);
        if (a && d && (a.x !== d.x || a.y !== d.y)) facing.set(ev.by, Math.atan2(d.y - a.y, d.x - a.x));
      }
    }
  }
}

function emptyGroups() {
  return { hit: [], die: [], deliver: [], mine: [], spawn: [], buildStart: [], buildDone: [], progress: [], order: [], move: [], other: [] };
}
const pt = (e) => (e ? { id: e.id, owner: e.owner, kind: e.kind, x: e.x, y: e.y } : null);

function enrich(raw, prev, next) {
  const find = (id) => {
    for (const s of [prev, next]) {
      const e = s.units.find((u) => u.id === id) ?? s.structures.find((u) => u.id === id);
      if (e) return e;
    }
    return null;
  };
  const out = [];
  for (const ev of raw) {
    const e = { ...ev, type: ev.e };
    switch (ev.e) {
      case 'hit': {
        const from = find(ev.by), to = find(ev.id);
        e.from = pt(from); e.to = pt(to);
        e.dist = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
        e.ranged = e.dist > 1.5;
        break;
      }
      case 'die': {
        const ent = prev.units.find((u) => u.id === ev.id) ?? prev.structures.find((s) => s.id === ev.id);
        e.entity = ent ? structuredClone(ent) : null;
        e.isStructure = !!ent && prev.structures.includes(ent);
        if (ent) Object.assign(e, { kind: ent.kind, owner: ent.owner, x: ent.x, y: ent.y });
        break;
      }
      case 'deliver': case 'mine': {
        const u = find(ev.id);
        e.at = pt(u); e.owner = u?.owner;
        break;
      }
      case 'spawn':
        e.entity = ev.unit ?? ev.structure ?? null;
        e.isStructure = !!ev.structure;
        e.type = ev.structure && !ev.structure.complete ? 'buildStart' : 'spawn';
        break;
      case 'done':
        e.type = 'buildDone';
        e.at = pt(find(ev.id));
        break;
      default: break;
    }
    out.push(e);
  }
  return out;
}

function group(events) {
  const g = emptyGroups();
  for (const e of events) (g[e.type] ?? g.other).push(e);
  return g;
}

function decorate(prev, next, alpha, events, stats, facing) {
  const attackers = new Set(), struck = new Map();
  for (const e of events) {
    if (e.type !== 'hit') continue;
    attackers.add(e.by);
    struck.set(e.id, (struck.get(e.id) ?? 0) + (e.dmg ?? 0));
  }
  const dyingIds = new Set(events.filter((e) => e.type === 'die').map((e) => e.id));
  const build = (listPrev, listNext, isStructureList) => {
    const pm = byIdMap(listPrev), nm = byIdMap(listNext), out = [];
    const make = (p, n) => {
      const base = n ?? p, a = p ?? n, b = n ?? p;
      const stat = statFor(stats, base.kind);
      const maxHp = stat?.hp ?? base.hp;
      const hp = lerp(a.hp ?? 0, b.hp ?? 0, alpha);
      out.push({
        ...b, x: lerp(a.x, b.x, alpha), y: lerp(a.y, b.y, alpha), fromX: a.x, fromY: a.y,
        hp, hpPrev: a.hp, maxHp, hpFrac: maxHp ? Math.max(0, Math.min(1, hp / maxHp)) : 1,
        facing: facing.get(base.id) ?? (isStructureList ? 0 : Math.PI / 2),
        moving: b.x !== a.x || b.y !== a.y, attacking: attackers.has(base.id),
        hurt: struck.has(base.id), damage: struck.get(base.id) ?? 0,
        born: !p, dying: !n || dyingIds.has(base.id), t: alpha, isStructure: isStructureList,
        progressFrac: isStructureList
          ? (base.complete ? 1 : Math.min(1, lerp(a.progress ?? 0, b.progress ?? 0, alpha) / (stat?.buildTicks || 1))) : undefined,
        buildDoneNow: isStructureList && !!b.complete && !!p && !p.complete,
      });
    };
    for (const n of listNext) make(pm.get(n.id), n);
    for (const p of listPrev) if (!nm.has(p.id)) make(p, null);
    return out;
  };
  return { units: build(prev.units, next.units, false), structures: build(prev.structures, next.structures, true) };
}

// ---------------------------------------------------------------------------------------------------------------
// Camera rig: a fixed tilted orthographic view. `center` is the tile the camera looks at; zoom is the visible height.
// ---------------------------------------------------------------------------------------------------------------
export { CAMERA, createCameraRig } from './camera.mjs'; // the rig itself lives in play/camera.mjs (edge scroll, pointer lock, drag pan)

// ---------------------------------------------------------------------------------------------------------------
// The page. Everything below needs a DOM, WebGL and three.js.
// ---------------------------------------------------------------------------------------------------------------
export async function startGame({ THREE, createEngine, createPlaceholder, root, query = new URLSearchParams(), importer }) {
  const q = query;
  const watch = isWatch(q);
  if (toasterOptions(q).on && !watch && !sandboxMode(q) && q.get('play') !== '1') {
    mountStartScreen(root, { query: q });
    return { setup: true };
  }
  const side = q.get('side') === '1' ? 1 : 0;
  // The TV (watch mode on GHT) plays a recorded toaster-sonnet v toaster-sonnet match that ends in a siege.
  const wantReplay = watch && side === 0 && toasterOptions(q).on ? replaySeed(q) : null;
  const storedReplay = q.get('replay');
  const lastRec = watch && toasterOptions(q).on && (storedReplay === 'last' || /^\d$/.test(storedReplay ?? '')) ? (loadStoredReplay(storedReplay) ?? (storedReplay === 'last' ? loadLastMatch() : null)) : null; // Watch replay on the results card
  const replay = lastRec ?? (wantReplay ? await loadReplay(wantReplay) : null);
  const seed = replay ? replay.seed : Number(q.get('seed') ?? 7) || 7;
  const tps = Number(q.get('tps') ?? TICKS_PER_SECOND) || TICKS_PER_SECOND;
  const els = buildDom(root, toasterOptions(q).on);
  const imp = importer ?? ((f) => import(f));

  // The sim ----------------------------------------------------------------------------------------------------
  // env/live.mjs owns the 24 tps clock, the AI (under the referee rules) and the replayable log. Each tick event
  // gives us the new state; we hand the driver the commands for the next tick.
  // Default opponent: the built-in AI on its easy setting, so a first game survives the opening. The team
  // tournament bots are opt-in with ?ai=sonnet|haiku|fable|sample.
  const aiName = watch ? (q.get('ai') ?? 'builtin') : opponentAiName(q, toasterOptions(q).on); // GHT: ?difficulty=easy (default) | normal | none (play/opponent.mjs)
  const sandbox = !watch && !replay && sandboxMode(q); // ?mode=sandbox or 'Opponent: None': an idle enemy and cheat keys (play/sandbox.mjs)
  let aiModule = null;
  if (replay) aiModule = replayPlayer(replay);
  else if (sandbox) aiModule = idleOpponent;
  else try { aiModule = await imp(aiName === 'sample' ? '../players/sample-player.mjs' : aiName === 'builtin' ? '../players/builtin/ai.mjs' : `../players/${aiName}/bot.mjs`); }
  catch (err) { console.warn('[play] bot not loaded', err); toast(els, `Bot "${aiName}" failed to load`); }
  const toaster = toasterOptions(q); // GHT by default; ?classic=1 keeps the old GHT Classic page
  if (toaster.on && typeof document !== 'undefined') document.title = PAGE_TITLE;
  const terr = toaster.on ? toaster : territoryOptions(q); // ?territory=1: Reaches, tiers, the Drift and the flow panel (needs createState in env/live.mjs)
  const driver = createLiveMatch({
    seed, human: side, createState: replay ? (lastRec ? (lastRec.setup?.difficulty === 'none' || lastRec.setup?.mode === 'sandbox' ? sandboxState(terr.createState) : terr.createState) : createReplayState) : sandbox ? sandboxState(terr.createState) : terr.createState, tps, ai: aiModule ?? { name: 'idle', act: () => [] },
    ...(replay ? { aiStartTick: 0 } : {}), // a recording acts from tick 0
    maxTicks: replay ? replay.maxTicks : Number(q.get('ticks') ?? DEFAULT_MATCH_TICKS) || DEFAULT_MATCH_TICKS,
    difficulty: q.get('difficulty') ?? (watch ? 'normal' : 'easy'),
  });
  // Watch mode: a second built-in AI plays the "human" side, its commands queued like a player's.
  let watchAi = null;
  if (watch) {
    try { watchAi = await loadAi(aiModule ?? '../players/builtin/ai.mjs', { side, seed, difficulty: q.get('difficulty') ?? 'normal' }); }
    catch (err) { console.warn('[play] watch AI not loaded', err); }
  }
  if (replay) driver.queue(replay.commands[0]?.[side] ?? []); // the queue lands on tick 0, like the other side's reply
  const caster = watch ? createCaster() : null, topbar = watch ? createTopbar({ tps }) : null;
  const state = driver.state;
  const matchStats = createMatchStats(side); // wheat, slices, toasters lost for the results card
  // GHT teaching (play/tutorial.mjs): the five-step guide is on unless ?tutorial=0, and the objective line sits under the top bar.
  const tutorial = toaster.on && !watch && tutorialOn(q) ? mountTutorial(document) : null;
  const objective = toaster.on && !watch ? root.appendChild(Object.assign(document.createElement('div'), { id: 'objective', textContent: OBJECTIVE })) : null;
  const kitchen = toaster.on && !watch ? mountKitchenPanel(document) : null; // K: the Kitchen panel (play/kitchen-panel.mjs)
  if (objective) objective.style.cssText ='position:fixed;left:50%;top:36px;transform:translateX(-50%);z-index:4;font:13px/1.3 system-ui,sans-serif;color:#e8e4f4;text-shadow:0 1px 2px #000;pointer-events:none;white-space:nowrap';
  const interval = 1000 / tps;
  // Map facts the placement ghost needs (Well near water, enemy fenced land); built lazily, the water Set once.
  let waterSet = null;
  const placeContext = () => (toaster.on && wheat ? { waterSet: (waterSet ??= tileSet(wheat.water)), springs: wheat.wells, enemyFenced: state.power?.enclosure?.fenced?.[1 - side] } : null);
  // Key profile (SYSTEMS-DESIGN.md section 4): ?keys=grid|classic, else the stored setting, else grid. One setting, read at load.
  const keysProfile = keyProfile(q, (() => { try { return localStorage.getItem('keys'); } catch { return null; } })());
  const input = createInput({ side, stats: STATS, placeContext, rowOf, ...(toaster.on ? toasterInputOptions(keysProfile) : {}) });
  if (toaster.on) setArtProvider(toasterArt); // toaster portraits and card icons instead of the old snake art
  const look = toaster.on ? observeToaster : observe; // the toasters need each unit's power + cord corners to draw their cords
  const world = createLiveWorld(look(state, side), STATS);
  let gameSpeed = 1;
  let paused = false, inspectPower = false, mmBase = null, mmSites = null, mmPings = createPings(); // mmSites: windmill pads + dam (item 28); mmBase: the Wheatfield land as a canvas, drawn under the minimap dots
  const game ={ state, driver, input, world, over: false, lastTickAt: performance.now() };

  // Idle Crumbs (play/idle-crumbs.mjs): auto-gather after 3 s idle, a blinking count button, F1 cycles them.
  const idleCrumbs = toaster.on && !watch ? createIdleCrumbs({ side }) : null;
  const idleBtn = idleCrumbs ? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'idle-crumbs' })) : null;
  if (idleBtn) {
    idleBtn.style.cssText = 'position:fixed;left:10px;top:44px;z-index:30;font:12px sans-serif';
    document.head.append(Object.assign(document.createElement('style'), { textContent: '.idle-btn{font:inherit;font-weight:700;color:#0b0918;background:#ffd23f;border:1px solid #fff;border-radius:4px;padding:3px 9px;cursor:pointer}@keyframes idleblink{50%{opacity:.35}}.idle-blink{animation:idleblink 1s steps(2) infinite}' }));
    idleBtn.addEventListener('click', (e) => { if (e.target.closest('[data-idle]')) selectIdleCrumb(); });
  }
  function selectIdleCrumb() {
    const c = idleCrumbs?.cycle(snapNow(), input.ui.plans);
    if (!c) { toast(els, 'No idle Crumbs'); return; }
    input.ui.selection = [c.id]; input.ui.stationSel = [];
    rig.centerOn(c.x, c.y);
  }

  let feedback = null; // made once the camera exists (below), so the tick handler can run before that
  const flow = createFlowTracker(); // income per minute for the top bar hovers (play/hud-bar.mjs)
  const synth = createToasterSounds({ muted: q.get('mute') === '1' ? true : undefined }); const soundMemo = newMemo(); // item 26
  const synthUi = mountSoundControls(synth);
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => synth.unlock(), { passive: true });
  driver.on('tick', ({ events }) => {
    for (const c of cuesFor(events, state, side, soundMemo)) synth.play(c.name, c);
    flow.feed(events, state);
    matchStats.note(state.units, events);
    const snap = look(state, side);
    world.push(snap, events.filter((e) => e.e !== 'late'));
    input.noteEvents(snap, events);
    game.lastTickAt = performance.now();
    if (watch) {
      caster.note(state.tick, state, events); topbar.note(state);
      Promise.resolve(watchAi?.act(snap)).then((cmds) => { if (Array.isArray(cmds) && !game.over) driver.queue(cmds); }).catch(() => {});
      return;
    }
    const cmds = input.tick(snap);
    if (idleCrumbs) cmds.push(...idleCrumbs.tick(snap, input.ui.plans)); // item 3: idle Crumbs go back to wheat
    feedback?.tick({ events, snap, focus: rig, now: performance.now(), selection: input.ui.selection, commands: cmds });
    driver.queue(cmds);
  });
  // Sounds (play/sound-player.mjs). It replaces the old 'audio' system below. Browsers need a click or key first.
  const sounds = createSoundPlayer({ muted: q.get('mute') === '1' });
  fetch(new URL('../assets/audio/MANIFEST.json', import.meta.url)).then((r) => r.json()).then((json) => { sounds.load(json); synth.loadAmbient(json); }).catch(() => {});
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => sounds.unlock(), { passive: true });
  driver.on('end', (result) => {
    game.over = true;
    const stingers = resultStingers(result, side, toaster.on); // one stinger per result (play/toaster-sounds.mjs)
    if (stingers.synth) synth.play(stingers.synth);
    if (watch && lastRec) { els.result.hidden = false; els.result.innerHTML = '<h1>Replay over</h1><p><button id="restart">Play again</button></p>'; els.result.querySelector('#restart').onclick = () => { location.search = setupQuery(q, setupValues(q)); }; return; }
    if (watch) { showWatchEnd(els, result, seed, q, replay); return; }
    if (toaster.on) showResultsCard(els, result, side, matchStats.totals, tps, driver, q);
    else showResult(els, result, side, toaster.on);
    if (stingers.sample) sounds.play([{ name: stingers.sample }]);
  });

  // Engine and systems -----------------------------------------------------------------------------------------
  const [paletteMod, assetsMod] = await Promise.all([
    imp('../viewer3d/palette.mjs').catch(() => null), imp('../viewer3d/assets.mjs').catch(() => null)]);
  let palette;
  try { palette = paletteMod?.createPalette ? paletteMod.createPalette(THREE) : (paletteMod?.PALETTE ?? paletteMod?.palette); }
  catch (err) { console.warn('[play] createPalette failed', err); }
  const engine = createEngine(els.canvas, {
    width: state.width, height: state.height, tileSize: 1, palette, stats: STATS, ortho: true, orthoHeight: 24,
    quality: q.get('quality') ?? 'high', debug: q.get('debug') === '1', autoplay: false,
  });
  const ctx = engine.ctx;
  try { ctx.toy = (await imp('./toy-render.mjs')).installToy(ctx, engine, { query: q }); }   // premium toy look; ?toy=0 keeps the old one
  catch (err) { console.warn('[play] toy look', err); }
  if (assetsMod?.loadAssets) { try { ctx.assets = (await assetsMod.loadAssets(ctx)) ?? ctx.assets; } catch (err) { console.warn('[play] assets', err); } }
  ctx.log = { stats: STATS };
  ctx.hudRoot = els.hud;
  if (toaster.on) ctx.buildingLook = toasterBuildingLook; // Power Strip, Mill, Well and Toaster as blocky toys (play/toaster-buildings.mjs)
  ctx.tv = false;
  ctx.heightAt = () => 0;
  ctx.time.playing = false; // the engine clock is not used; the live world is driven by wall time below
  engine.setWorld({
    ticks: 1e9,
    frame() {
      world.setAlpha(paused || game.over ? 1 : (performance.now() - game.lastTickAt) / (interval / gameSpeed));
      return world.frame();
    },
  });
  ctx.world.map = world.map;

  const made = {};
  // GHT on Wheatfield Valley: the grid terrain and a land-coloured minimap (play/wheatfield-terrain.mjs).
  const wheat = toaster.on ? wheatfieldMap(seed, q) : null;
  if (wheat && state.width === wheat.width) mmBase = minimapCanvas(buildMinimapImage(wheat));
  if (wheat && state.width === wheat.width) mmSites = kitchenSites(wheat);
  const wanted = [
    wheat ? ['terrain', './wheatfield-terrain.mjs', 'createWheatfieldTerrain', () => ({ map: wheat })]
      : ['terrain', '../viewer3d/terrain.mjs', 'createTerrain', () => ({})],
    ['buildings', '../viewer3d/buildings.mjs', 'createBuildings', () => ({})],
    ['units', './units-instanced.mjs', 'createInstancedUnits', () => ({ stats: STATS, side })],
    ['vfx', '../viewer3d/vfx.mjs', 'createVfx', () => ({ stats: STATS, quality: q.get('quality') === 'low' ? 0.5 : 1 })],
  ];
  const missing = {};
  for (const [name, file, fn, makeOpts] of wanted) {
    const mod = await imp(file).catch((err) => { console.warn(`[play] ${file}`, err); return null; });
    const make = mod?.[fn] ?? mod?.default;
    if (typeof make !== 'function') { missing[name] = true; continue; }
    try {
      const sys = make(ctx, makeOpts());
      if (sys?.update) { sys.name ??= name; made[name] = sys; engine.add(sys); }
      if (name === 'terrain' && typeof sys?.heightAt === 'function') ctx.heightAt = sys.heightAt;
    } catch (err) { missing[name] = true; console.error(`[play] ${fn} threw`, err); }
  }
  if (toaster.on && state.power) { // Power Stations, fences, fenced land and cord pegs (play/power-stations-3d.mjs)
    try { made.stations = createStationLayer(ctx, { THREE, getState: () => state, side }); engine.add(made.stations); }
    catch (err) { console.warn('[play] power stations', err); }
  }
  if (toaster.on) { // the bread chain alive: sacks, sails, bucket, popping slices, toast stack (play/bread-life.mjs)
    try { made.breadLife = createBreadLife(ctx, { THREE, getState: () => state }); engine.add(made.breadLife); }
    catch (err) { console.warn('[play] bread life', err); }
  }
  if (missing.terrain || missing.units || missing.buildings) {
    engine.add(createPlaceholder(ctx, { parts: { terrain: !!missing.terrain, units: !!missing.units, structures: !!missing.buildings } }));
  }

  // Camera and picking -----------------------------------------------------------------------------------------
  const myCore = state.structures.find((s) => s.kind === 'core' && s.owner === side);
  const rig = createCameraRig(state.width, state.height, myCore ?? undefined);
  const cameraMarks = createCameraMarks(); // F5-F8 saved views (A2)
  if (watch) { const f = frontFocus(state); rig.centerOn(f.x, f.y); } // the TV opens on the middle of the board, not a corner
  const stall = watch ? createStallWatch({ graceMs: 10000 }) : null;
  feedback = createFeedback({ player: sounds, side });
  const cam = ctx.camera;
  const v3 = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const SHOW_H = 0.5;

  function applyCamera() {
    const sh = feedback ? feedback.shake(performance.now()) : { x: 0, y: 0 }; // a small shake on hits near the camera
    const target = ctx.gridToWorld(rig.x + sh.x, rig.y + sh.y, ctx.heightAt(Math.round(rig.x), Math.round(rig.y)) || 0);
    cam.position.set(target.x, target.y + Math.sin(CAMERA.pitch) * CAMERA.distance, target.z + Math.cos(CAMERA.pitch) * CAMERA.distance);
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    const aspect = ctx.size.width / ctx.size.height || 16 / 9;
    const h = rig.zoom;
    if (cam.top !== h / 2 || cam.right !== (h * aspect) / 2) {
      cam.top = h / 2; cam.bottom = -h / 2; cam.left = -h * aspect / 2; cam.right = h * aspect / 2;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld(true);
  }
  function cssSize() { return { width: els.canvas.clientWidth || 1280, height: els.canvas.clientHeight || 720 }; }
  function project(gx, gy, h = SHOW_H) {
    const sz = cssSize();
    ctx.gridToWorld(gx, gy, (ctx.heightAt(Math.round(gx), Math.round(gy)) || 0) + h, v3);
    v3.project(cam);
    return { sx: (v3.x * 0.5 + 0.5) * sz.width, sy: (-v3.y * 0.5 + 0.5) * sz.height };
  }
  function groundTile(sx, sy) {
    const sz = cssSize();
    raycaster.setFromCamera({ x: (sx / sz.width) * 2 - 1, y: -(sy / sz.height) * 2 + 1 }, cam);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let pt = new THREE.Vector3();
    for (let i = 0; i < 2; i++) {
      raycaster.ray.intersectPlane(plane, pt);
      const g = ctx.worldToGrid(pt);
      plane.constant = -(ctx.heightAt(Math.round(g.x), Math.round(g.y)) || 0);
    }
    const g = ctx.worldToGrid(pt);
    return { x: Math.max(0, Math.min(state.width - 1, Math.round(g.x))), y: Math.max(0, Math.min(state.height - 1, Math.round(g.y))) };
  }
  const screenProject = (x, y) => project(x, y);
  const snapNow = () => world.current;
  // The entity under the cursor, using the smoothed positions the player actually sees.
  function pickAt(sx, sy) {
    const f = world.frame();
    const shown = { units: f.units.filter((u) => !u.dying), structures: f.structures.filter((s) => !s.dying) };
    return pickEntity(shown, screenProject, sx, sy, { radius: 24, structureRadius: 36 });
  }
  function crystalNear(sx, sy) {
    let best = null, bd = 30;
    for (const c of snapNow().crystals) {
      if (!(c.amount > 0)) continue;
      const p = project(c.x, c.y);
      const d = Math.hypot(p.sx - sx, p.sy - sy);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Mouse ------------------------------------------------------------------------------------------------------
  const mouse = { x: 0, y: 0, down: null, ping: null, inside: false };
  // Pointer feel (play/input.mjs): click-in capture, in-game cursor, fullscreen, middle-drag; rel() is the virtual cursor while locked.
  const pointer = installPointerControls({ win: window, doc: document, overlay: els.overlay, rig, lock: !watch && q.get('lock') === 'on' /* mouse capture is opt-in (?lock=on): in a browser pane it trapped the cursor and kept edge-panning */ });
  const rel = (e) => pointer.rel(e);
  const targetAt = (sx, sy, entity) => {
    const crystal = entity ? null : crystalNear(sx, sy);
    const tile = crystal ? { x: crystal.x, y: crystal.y } : groundTile(sx, sy);
    return { ...tile, entity: entity ?? null };
  };
  els.overlay.addEventListener('contextmenu', (e) => e.preventDefault());
  els.overlay.addEventListener('mousedown', (e) => {
    const p = rel(e); mouse.x = p.x; mouse.y = p.y;
    if (e.button === 2) {
      if (input.ui.mode) { input.setMode(null); return; }
      const entity = pickAt(p.x, p.y);
      const snap = snapNow();
      const ownUnit = entity && entity.owner === side && snap.units.some((u) => u.id === entity.id); // B2: right-click a friendly unit follows it
      const target = targetAt(p.x, p.y, entity && (entity.owner !== side || ownUnit) ? entity : null);
      const r = input.rightClick(snap, target, { shift: e.shiftKey });
      mouse.ping = { x: target.x, y: target.y, kind: r.kind === 'attack' ? 'attack' : 'move', t: performance.now() };
      return;
    }
    if (e.button !== 0) return;
    if (input.ui.mode) {
      const entity = input.ui.mode.type === 'amove' ? pickAt(p.x, p.y) : null;
      const target = targetAt(p.x, p.y, entity);
      input.modeClick(snapNow(), target, { shift: e.shiftKey });
      mouse.ping = { x: target.x, y: target.y, kind: input.ui.mode?.type === 'amove' || entity ? 'attack' : 'move', t: performance.now() };
      return;
    }
    mouse.down = { x: p.x, y: p.y, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey };
  });
  window.addEventListener('mousemove', (e) => {
    const p = rel(e); mouse.x = p.x; mouse.y = p.y;
    mouse.inside = e.target === els.overlay;
    rig.mouse = mmDrag ? null : { x: p.x, y: p.y };
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !mouse.down) return;
    const d = mouse.down; mouse.down = null;
    const p = rel(e);
    const snap = snapNow();
    if (Math.hypot(p.x - d.x, p.y - d.y) < 5) {
      const entity = pickAt(p.x, p.y);
      if (!entity && toaster.on) { const t = groundTile(p.x, p.y); if (input.pickStation(snap, t.x, t.y, d.shift)) return; } // a Power Station under the click
      else if (entity && !d.shift) input.ui.stationSel = [];
      input.clickSelect(snap, screenProject, cssSize(), entity, { shift: d.shift, ctrl: d.ctrl, now: performance.now() }); // Ctrl+click: every unit of that type on screen (B2)
    } else {
      const f = world.frame();
      const shown = { ...snap, units: f.units.filter((u) => !u.dying) };
      input.boxSelect(shown, screenProject, { x0: d.x, y0: d.y, x1: p.x, y1: p.y }, { shift: d.shift });
    }
  });
  els.overlay.addEventListener('wheel', (e) => { e.preventDefault(); rig.zoomBy(Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016)); }, { passive: false });
  els.overlay.addEventListener('dblclick', (e) => e.preventDefault());

  // Keys -------------------------------------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key.startsWith('Arrow')) { rig.keys.add(e.key); e.preventDefault(); return; }
    if (game.over && e.key === 'Enter') { location.reload(); return; }
    if (e.key === MUTE_KEY) { // backtick mutes in both key profiles (play/input.mjs)
      synth.toggleMute(); sounds.setMuted(synth.isMuted()); synthUi?.paint(); toast(els, synth.isMuted() ? 'Sound off (`)' : 'Sound on (`)'); return;
    }
    if (pauseKeyFires(e.key, { paused, selected: input.ui.selection.length, mod: e.ctrlKey || e.metaKey })) { // P: pause with nothing picked (else Patrol, A4)
      paused = !paused;
      if (paused) driver.pause(); else driver.resume();
      toast(els, paused ? 'Paused (P)' : 'Resumed'); updateSandboxBadge();
      return;
    }
    if (sandbox && (e.key === '[' || e.key === ']')) {
      gameSpeed = stepSpeed(gameSpeed, e.key === ']' ? 1 : -1); driver.setSpeed(gameSpeed);
      toast(els, `Speed ${gameSpeed}x`); updateSandboxBadge(); return;
    }
    // F5-F8 (A2, SYSTEMS-DESIGN.md section 4): Ctrl saves the view to that key, the key recalls it, Shift is the sandbox cheat.
    // preventDefault always, so F5 never reloads the page and loses the match.
    const camera = cameraKeyAction(e.key, { ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, sandbox: Boolean(sandbox) });
    if (camera) {
      e.preventDefault();
      if (camera === 'save') { cameraMarks.save(e.key, rig); toast(els, `View saved to ${e.key}`); }
      else if (camera === 'recall') { if (!cameraMarks.recall(e.key, rig)) toast(els, `No view on ${e.key} yet (Ctrl+${e.key} saves one)`); }
      else {
        const sel = snapNow().units.find((u) => u.id === input.ui.selection[0] && u.owner === side);
        const cmd = cheatCommand(e.key, { selectedKind: sel?.kind ?? null, cursor: mouse.inside ? groundTile(mouse.x, mouse.y) : null });
        if (cmd) { driver.queue([cmd]); toast(els, { F5: '+500 wheat', F6: '+20 toast', F7: 'Map revealed', F8: 'Squad spawned' }[e.key]); }
        else toast(els, 'F8: select a toaster and point at the ground');
      }
      return;
    }
    if (e.key === 'F1' && idleCrumbs && e.ctrlKey) { // Ctrl+F1 (B2): every idle Crumb at once
      e.preventDefault();
      input.key(snapNow(), 'F1', { ctrl: true, idleIds: idleCrumbs.idle(snapNow(), input.ui.plans).map((u) => u.id) });
      return;
    }
    if (e.key === 'F1' && idleCrumbs) { e.preventDefault(); selectIdleCrumb(); return; }
    if (e.key === INSPECT_KEY && toaster.on) { e.preventDefault(); inspectPower = !inspectPower; toast(els, inspectPower ? 'Inspect power: on (F4)' : 'Inspect power: off'); return; }
    if (e.key === 'PageUp') { e.preventDefault(); rig.keys.add('PageUp'); return; }
    if (e.key === 'PageDown') { e.preventDefault(); rig.keys.add('PageDown'); return; }
    if (kitchen && !e.ctrlKey && !e.metaKey && /^(k|K|Escape)$/.test(e.key) && kitchen.handleKey(e.key, { trainable: input.commandCard(snapNow()).some((c) => c.key === 'k') })) { e.preventDefault(); return; } // K opens the kitchen unless a Flak Popper hotkey is due
    const mod = e.ctrlKey || e.metaKey; // with Ctrl or Cmd, +/- stay the browser's zoom
    if (!mod && (e.key === '+' || e.key === '=')) { rig.zoomBy(0.85); return; }
    if (!mod && e.key === '-') { rig.zoomBy(1 / 0.85); return; }
    // B1: Alt+number makes a group and takes those units out of the others. Option+digit types a symbol on a Mac, so the digit comes from the key code.
    const altDigit = e.altKey ? /^Digit([0-9])$/.exec(e.code ?? '') : null;
    if (e.altKey && !altDigit) return;
    const fx = input.key(snapNow(), altDigit ? altDigit[1] : e.key, { ctrl: mod, alt: Boolean(altDigit), shift: e.shiftKey && !altDigit, now: performance.now() });
    if (fx?.center) rig.centerOn(fx.center.x, fx.center.y);
    if (gameTakesKey(e.key, { mod, cardKeys: input.commandCard(snapNow()).map((c) => c.key) })) e.preventDefault(); // Ctrl+0 and Tab too; Ctrl+R stays the browser's
  });
  const badge = sandbox ? root.appendChild(document.createElement('div')) : null; // the Sandbox badge listing the keys
  if (badge) badge.style.cssText = 'position:absolute;left:8px;top:40px;padding:6px 9px;background:#000a;color:#ffd36a;font:12px/1.4 sans-serif;border:1px solid #ffd36a;border-radius:4px;pointer-events:none;z-index:5';
  const updateSandboxBadge = () => { if (badge) badge.innerHTML = sandboxBadge(gameSpeed, paused); };
  updateSandboxBadge();
  window.addEventListener('keyup', (e) => rig.keys.delete(e.key));
  window.addEventListener('blur', () => rig.keys.clear());

  // Minimap ----------------------------------------------------------------------------------------------------
  const mm = els.minimap, mmc = mm.getContext('2d');
  const toTile = (e) => { const r = mm.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * state.width - 0.5, y: ((e.clientY - r.top) / r.height) * state.height - 0.5 }; };
  let mmDrag = false;
  mm.addEventListener('contextmenu', (e) => e.preventDefault());
  mm.addEventListener('mousedown', (e) => {
    const t = toTile(e);
    if (e.button === 2 || input.ui.mode) { // B2: the minimap takes attack-move and move clicks (left, while armed) and Shift queues
      const snap = snapNow();
      // Enemies, and my own units (right-click follows one, B2); my buildings are not picked here.
      const near = [...snap.units, ...snap.structures].filter((u) => u.owner !== side || snap.units.includes(u)).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
      const entity = near && Math.hypot(near.x - t.x, near.y - t.y) < 2 ? near : null;
      const tile = { x: Math.round(t.x), y: Math.round(t.y), entity };
      if (e.button === 2) input.rightClick(snap, tile, { shift: e.shiftKey });
      else input.modeClick(snap, tile, { shift: e.shiftKey });
    } else { mmDrag = true; rig.centerOn(t.x, t.y); }
  });
  window.addEventListener('mousemove', (e) => { if (mmDrag) { const t = toTile(e); rig.centerOn(t.x, t.y); } });
  window.addEventListener('mouseup', () => { mmDrag = false; });

  // Command-card buttons
  els.card.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const fx = input.act(snapNow(), b.dataset.action, b.dataset.kind || undefined);
    if (fx?.center) rig.centerOn(fx.center.x, fx.center.y);
  });

  // Multi-select portraits: click one to select only that unit
  els.selection.addEventListener('click', (e) => {
    const x = e.target.closest('button[data-cancel]'); // a queued icon: cancel that unit (play/hud-queue.mjs)
    if (x) { const cmd = cancelCommand(x.dataset.cancel); if (cmd) input.ui.outbox.push(cmd); return; }
    const b = e.target.closest('button[data-pick]');
    if (b) input.ui.selection = [Number(b.dataset.pick)];
  });

  // Per-frame UI system ----------------------------------------------------------------------------------------
  const ov = els.overlay.getContext('2d');
  let hudAcc = 0;
  const ui = {
    name: 'play-ui',
    update(frame, dt) {
      rig.size = cssSize();
      if (watch) {
        glide(rig, caster.pick(state.tick) ?? frontFocus(state), dt);
        // A clock stuck at 0:00 is worse than a different match: fall back to the live AIs once.
        if (stall.check(state.tick, performance.now()) && replay) { const next = new URLSearchParams(q); next.set('replay', 'off'); location.search = next.toString(); }
      } else rig.update(dt);
      applyCamera();
      const w = cssSize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (els.overlay.width !== Math.round(w.width * dpr) || els.overlay.height !== Math.round(w.height * dpr)) {
        els.overlay.width = Math.round(w.width * dpr); els.overlay.height = Math.round(w.height * dpr);
      }
      ov.setTransform(dpr, 0, 0, dpr, 0, 0);
      ov.clearRect(0, 0, w.width, w.height);
      drawOverlay(frame);
      hudAcc += dt;
      if (hudAcc > 0.1) { hudAcc = 0; if (watch) els.top.innerHTML = watchBar(topbar.read(state), state.tick, tps, caster.pick(state.tick)); else updateHud(frame); }
      drawMinimap(frame);
      const msg = input.takeMessage();
      if (msg) toast(els, msg.text);
      els.overlay.style.cursor = input.ui.mode ? (input.ui.mode.type === 'place' ? 'copy' : 'crosshair') : 'default';
    },
  };
  engine.add(ui);

  function tilePx() { const a = project(8, 8, 0), b = project(9, 8, 0); return Math.abs(b.sx - a.sx) || 30; }
  function ellipse(x, y, rx, ry, stroke, fill) {
    ov.beginPath(); ov.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ov.fillStyle = fill; ov.fill(); }
    if (stroke) { ov.strokeStyle = stroke; ov.stroke(); }
  }
  function drawOverlay(frame) {
    const tp = tilePx();
    const sel = new Set(input.ui.selection);
    made.units?.setSelection?.(input.ui.selection); // the instanced units draw their own rings and health bars
    ov.lineWidth = 2;
    for (const e of [...frame.units, ...frame.structures]) {
      if (!sel.has(e.id) || e.dying) continue;
      const p = project(e.x, e.y, 0);
      const mineE = e.owner === side;
      const col = mineE ? '#5dff7a' : '#ff5d5d';
      const r = (e.isStructure ? 0.62 : 0.5) * tp;
      if (e.isStructure || !made.units?.setSelection) ellipse(p.sx, p.sy, r, r * 0.55, col, null);
      // Rally flag
      const rally = e.isStructure && mineE ? input.ui.rally.get(e.id) : null;
      if (rally) {
        const q2 = project(rally.x, rally.y, 0);
        ov.strokeStyle = rally.type === 'gather' ? '#3fe0ff' : '#ffe14a'; ov.setLineDash([4, 4]);
        ov.beginPath(); ov.moveTo(p.sx, p.sy); ov.lineTo(q2.sx, q2.sy); ov.stroke(); ov.setLineDash([]);
        ellipse(q2.sx, q2.sy, tp * 0.2, tp * 0.11, ov.strokeStyle, ov.strokeStyle);
      }
      // Hold / queue markers for own units
      const plan = input.ui.plans.get(e.id);
      if (plan?.hold) { ov.fillStyle = '#ffe14a'; ov.font = '11px system-ui'; ov.fillText('H', p.sx - 3, p.sy - tp * 0.75); }
    }
    // Waypoints of the selected units' queued orders
    for (const id of sel) {
      const plan = input.ui.plans.get(id);
      const u = frame.units.find((x) => x.id === id);
      if (!plan || !u || u.owner !== side) continue;
      let from = project(u.x, u.y, 0);
      ov.strokeStyle = 'rgba(93,255,122,.55)'; ov.lineWidth = 1;
      for (const o of [plan.cur, ...plan.queue]) {
        if (!o || o.x === undefined) continue;
        const to = project(o.x, o.y, 0);
        ov.beginPath(); ov.moveTo(from.sx, from.sy); ov.lineTo(to.sx, to.sy); ov.stroke();
        ellipse(to.sx, to.sy, 4, 2.5, null, o.type === 'amove' ? '#ff6a4a' : '#5dff7a');
        from = to;
      }
      ov.lineWidth = 2;
    }
    // Drag box
    if (mouse.down) {
      const d = mouse.down;
      if (Math.hypot(mouse.x - d.x, mouse.y - d.y) >= 5) {
        ov.strokeStyle = '#5dff7a'; ov.lineWidth = 1; ov.fillStyle = 'rgba(93,255,122,.08)';
        ov.fillRect(d.x, d.y, mouse.x - d.x, mouse.y - d.y); ov.strokeRect(d.x, d.y, mouse.x - d.x, mouse.y - d.y);
      }
    }
    // Selected Power Stations (click one, shift-click another, press F to fence the link)
    if (input.ui.stationSel?.length) {
      for (const p of snapNow().power?.view?.points ?? []) {
        if (!input.ui.stationSel.includes(p.id)) continue;
        const sp = project(p.x, p.y, 0);
        ellipse(sp.sx, sp.sy, 0.7 * tp, 0.4 * tp, '#5dff7a', null);
      }
    }
    // Placement footprint
    const mode = input.ui.mode;
    if (mode?.type === 'place' && mouse.inside) {
      const t = groundTile(mouse.x, mouse.y);
      const chk = input.placeCheck(snapNow(), mode.kind, t.x, t.y);
      drawGhost(ov, project, ghostFor(chk, mode.kind, t.x, t.y, { need: STATS.structures[mode.kind]?.cost ?? stationCost(mode.kind), label: kindName(mode.kind), ctx: placeContext() }), tp);
    }
    // Click ping
    if (mouse.ping) {
      const age = (performance.now() - mouse.ping.t) / 450;
      if (age >= 1) mouse.ping = null;
      else {
        const p = project(mouse.ping.x, mouse.ping.y, 0);
        ov.lineWidth = 2;
        ellipse(p.sx, p.sy, tp * (0.2 + 0.45 * age), tp * (0.11 + 0.25 * age), mouse.ping.kind === 'attack' ? `rgba(255,90,70,${1 - age})` : `rgba(93,255,122,${1 - age})`, null);
      }
    }
    // Hit flashes (play/feel.mjs): a white ring where something was hit or died
    for (const f of feedback ? feedback.flashes(performance.now()) : []) {
      const p = project(f.x, f.y, 0);
      const grow = (f.big ? 0.7 : 0.4) * (0.5 + f.age);
      ov.lineWidth = 2;
      ellipse(p.sx, p.sy, tp * grow, tp * grow * 0.55, `rgba(255,255,255,${1 - f.age})`, null);
    }
    // Neutral camps and glowing item pickups (play/camps.mjs). Nothing is drawn until the sim sends them.
    const neutralSnap = snapNow();
    drawCampsOverlay(ov, campMarks(neutralSnap.neutrals), project, tp);
    drawPickups(ov, neutralSnap.groundItems, project, tp, performance.now());
    drawReachBorders(ov, state.territory, side, state.tick, project);
    // GHT: the thick 3D cords are the cords; the thin lines only show as a faint 'inspect power' overlay (Tab).
    drawPowerOverlay(ov, state, side, input.ui.selection, project, state.tick, toaster.on ? { cords: inspectPower, faint: true } : {});
    if (toaster.on) drawBadges(ov, badgesFor(state, side), project, tp, performance.now()); // what each Mill, Well and Toaster is missing
    if (mode) {
      ov.fillStyle = 'rgba(0,0,0,.55)'; ov.fillRect(w2() / 2 - 150, 54, 300, 24);
      ov.fillStyle = '#ffe14a'; ov.font = '13px system-ui'; ov.textAlign = 'center';
      ov.fillText({ amove: 'Attack-move: click a target (Esc cancels)', move: 'Move: click a spot', rally: 'Rally: click a spot or a Shard', place: `Place ${kindName(mode.kind)}: click (Esc cancels)` }[mode.type], w2() / 2, 71);
      ov.textAlign = 'left';
    }
  }
  const w2 = () => cssSize().width;

  function drawMinimap() {
    const snap = snapNow();
    const W = mm.width, H = mm.height, sx = W / state.width, sy = H / state.height;
    if (mmBase) {
      // Wheatfield: the land (water, wheat, pads) is the base; only wheat that is gone is painted back as bare ground.
      mmc.imageSmoothingEnabled = false; mmc.drawImage(mmBase, 0, 0, W, H);
      mmc.fillStyle = '#52696b'; for (const c of snap.crystals) if (!(c.amount > 0)) mmc.fillRect(c.x * sx, c.y * sy, Math.ceil(sx), Math.ceil(sy));
    } else {
      mmc.fillStyle = '#10131d'; mmc.fillRect(0, 0, W, H);
      mmc.fillStyle = '#3a3f55'; for (const [x, y] of snap.rocks) mmc.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      mmc.fillStyle = '#35e0ff'; for (const c of snap.crystals) if (c.amount > 0) mmc.fillRect(c.x * sx, c.y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    const colour = (o) => (o === side ? '#4aa8ff' : '#ff8a3d');
    for (const s of snap.structures) { mmc.fillStyle = colour(s.owner); mmc.fillRect(s.x * sx - 1, s.y * sy - 1, sx * 1.6 + 2, sy * 1.6 + 2); }
    for (const u of snap.units) { mmc.fillStyle = colour(u.owner); mmc.fillRect(u.x * sx, u.y * sy, Math.max(2, sx), Math.max(2, sy)); }
    drawCampsMinimap(mmc, campMarks(snap.neutrals), sx, sy);
    if (mmSites) drawKitchenMinimap(mmc, { snap, side, sites: mmSites, pings: mmPings.update(snap, side, state.tick), tick: state.tick, sx, sy });
    if (state.territory) drawReachMinimap(mmc, reachViews(state.territory), { side, tick: state.tick, mapW: state.width, mapH: state.height, width: W, height: H });
    // Camera footprint
    const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => groundTile(u * cssSize().width, v * cssSize().height));
    mmc.strokeStyle = '#fff'; mmc.lineWidth = 1; mmc.beginPath();
    corners.forEach((c, i) => (i ? mmc.lineTo((c.x + 0.5) * sx, (c.y + 0.5) * sy) : mmc.moveTo((c.x + 0.5) * sx, (c.y + 0.5) * sy)));
    mmc.closePath(); mmc.stroke();
  }

  function updateHud(frame) {
    const snap = snapNow();
    const myUnits = snap.units.filter((u) => u.owner === side).length;
    const queued = snap.structures.filter((s) => s.owner === side).reduce((n, s) => n + s.queue.length, 0);
    if (toaster.on) {
      const currentAlert = input.ui.alertCycle < 0 ? input.ui.alert : input.ui.alertHistory[input.ui.alertCycle];
      const topHtml = toasterTopBar(state, { side, tps, alert: currentAlert, flow }) + (!watch ? speedChip(gameSpeed, paused) : '');
      if (topHtml !== els.top._html) { els.top._html = topHtml; els.top.innerHTML = topHtml; }
      tutorial?.update(tutorialProgress(snap, side, { wheatGathered: matchStats.totals.wheat }));
      kitchen?.update(state, side, { tps, flow });
    } else {
      els.shards.textContent = String(snap.shards[side]);
      els.supply.textContent = `${myUnits + queued}/${STATS.match.unitCap}`;
      const secs = Math.floor(snap.tick / tps);
      els.clock.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      const currentAlert = input.ui.alertCycle < 0 ? input.ui.alert : input.ui.alertHistory[input.ui.alertCycle];
      els.alert.textContent = currentAlert && snap.tick - currentAlert.tick < tps * 6 ? `${currentAlert.text} (Space)` : '';
    }
    // Selection panel (portraits) and command card (icons) come from hud.mjs / command-card.mjs
    if (idleBtn) { const h = idleButtonHtml(idleCrumbs.count(snap, input.ui.plans)); if (h !== idleBtn._html) { idleBtn._html = h; idleBtn.innerHTML = h; } }
    const picked = input.mine(snap);
    const selHtml = renderSelectionPanel(snap, picked, { side, live: state });
    if (selHtml !== els.selection._html) { els.selection._html = selHtml; els.selection.innerHTML = selHtml; }
    const tHtml = toaster.on ? toasterPanel(state, side) + saturationLine(state, side) : territoryPanel(state, side);
    if (tHtml !== els.territory._html) { els.territory._html = tHtml; els.territory.innerHTML = tHtml; els.territory.hidden = !tHtml; }
    const card = cardWithRecall(input.commandCard(snap), snap, side, picked);
    const cardOpts = { shards: snap.shards[side], mode: input.ui.mode, tips: toaster.on };
    const sig = cardSignature(card, cardOpts);
    if (sig !== els.card._sig) {
      els.card._sig = sig;
      els.card.innerHTML = renderCard(card, cardOpts);
    }
  }

  window.ghtPlay = { engine, ctx, game, input, rig, project, groundTile };
  engine.start();
  if (toaster.on && !watch) mountFlowMenu(root, {
    query: q, isPaused: () => paused,
    pause: () => { paused = true; driver.pause(); },
    resume: () => { paused = false; driver.resume(); },
    onSpeed: speed => { gameSpeed = speed; driver.setSpeed(speed); updateSandboxBadge(); },
    onSurrender: () => driver.resign(), onRestart: () => location.reload(), isOver: () => game.over,
  });
  driver.start();
  els.boot.hidden = true;
  if (watch) { root.classList.add('watch'); toast(els, `Watching the AIs, seed ${seed}`); }
  else toast(els, toaster.on ? 'Select your Crumbs and right-click wheat to haul it. Build a Mill, a Well and a Toaster: toast is your ammo.' : 'Select your Workers and right-click a Shard to mine. F builds a Forge.');
  return game;
}

// The minimap base: a one-pixel-per-tile RGBA image (play/wheatfield-terrain.mjs) on an offscreen canvas.
function minimapCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------------------------------------------
function buildDom(root, toasterOn = false) {
  root.innerHTML = `
    <div id="stage"><canvas id="view"></canvas></div>
    <canvas id="overlay"></canvas>
    <div id="top"><span class="res">Shards <b id="shards">0</b></span><span class="res">Supply <b id="supply">0/0</b></span><span class="res"><b id="clock">0:00</b></span><span id="alert"></span></div>
    <div id="bottom">
      <canvas id="minimap" width="160" height="160"></canvas>
      <div id="selection"></div>
      <div id="card"></div>
    </div>
    <div id="territory" hidden></div>
    <div id="toast"></div>
    <div id="result" hidden></div>
    <div id="hud"></div>
    <div id="boot"><b>${toasterOn ? 'GHOSTIES, TOASTIES & BROSKIES' : 'GHT'}</b><br>loading…</div>`;
  const $ = (id) => root.querySelector('#' + id);
  return { canvas: $('view'), overlay: $('overlay'), minimap: $('minimap'), shards: $('shards'), supply: $('supply'), clock: $('clock'),
    top: $('top'), alert: $('alert'), selection: $('selection'), card: $('card'), toast: $('toast'), territory: $('territory'), result: $('result'), hud: $('hud'), boot: $('boot') };
}

let toastTimer = 0;
function toast(els, text) {
  els.toast.textContent = text; els.toast.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { els.toast.style.opacity = '0'; }, 3200);
}

// GHT end card (play/results-card.mjs): the numbers, Restart and Watch replay.
function showResultsCard(els, result, side, totals, tps, driver, q) {
  saveLastMatch(driver.log);
  saveReplay(driver.log, q);
  els.result.hidden = false;
  els.result.innerHTML = resultsCardHtml(result, side, totals, { tps, query: q });
  els.result.querySelector('#restart').onclick = () => location.reload();
  els.result.querySelector('#replay').onclick = () => { location.search = replaySetupQuery(q, loadStoredReplay('last')); };
  const normal = els.result.querySelector('#again-normal');
  if (normal) normal.href = '?' + setupQuery(q, { ...setupValues(q), difficulty: 'normal' });
}

function showResult(els, result, side, toasterOn = false) {
  const won = result.winner === side, draw = result.winner === null;
  els.result.hidden = false;
  els.result.innerHTML = `<h1 class="${draw ? '' : won ? 'win' : 'lose'}">${draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}</h1><p>${result.reason === 'core' ? toasterOn ? 'A Power Strip fell.' : 'A Core fell.' : result.reason === 'timeout' ? 'Time ran out; the stronger side wins.' : toasterOn ? 'Both Power Strips fell.' : 'Both Cores fell.'}</p><p class="dim">Press Enter for a new game</p>`;
}

// Watch mode ------------------------------------------------------------------------------------------------------
const WATCH_WHY = { front: 'The front', fight: 'Battle', base: 'Base under attack', claim: 'Reach in play', drift: 'Drift' };
const WATCH_TEAM = ['#33e0ff', '#ff9a3b'];

function watchBar(v, tick, tps, look) {
  const side = (i) => {
    const t = v.sides[i];
    return `<span class="ws" style="color:${WATCH_TEAM[i]}"><b>${i === 0 ? 'Cyan' : 'Orange'}</b> income ${t.income}/min · army ${t.army}${v.total ? ` · Reaches ${t.reaches}/${v.total}` : ''}</span>`;
  };
  const secs = Math.floor(tick / tps);
  return `${side(0)}<span class="wc">${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}${look ? ` · ${WATCH_WHY[look.why] ?? ''}` : ''}</span>${side(1)}`;
}

// The next match starts RESTART_SECONDS after this one ends, on the next seed (a reload keeps every other query).
function showWatchEnd(els, result, seed, q, replay = null) {
  const next = new URLSearchParams(q);
  const upcoming = replay ? nextReplaySeed(seed) : nextSeed(seed);
  next.set('mode', 'watch'); next.set('seed', String(upcoming)); if (replay) next.delete('replay');
  const who = result.winner === null || result.winner === undefined ? 'Draw' : `${result.winner === 0 ? 'Cyan' : 'Orange'} wins`;
  let left = RESTART_SECONDS;
  const paint = () => { els.result.hidden = false; els.result.innerHTML = `<h1>${who}</h1><p class="dim">Next match (seed ${upcoming}) in ${left} s</p>`; };
  paint();
  const timer = setInterval(() => { left -= 1; if (left <= 0) { clearInterval(timer); location.search = next.toString(); } else paint(); }, 1000);
}
