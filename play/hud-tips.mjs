// Button tooltips in toaster voice (PLAYABLE.md item 6). Owner: sonnet (HUD). Pure helpers, no DOM.
// Every card button gets: name (HOTKEY), cost, one line of what it does, one line of numbers. All numbers come from
// numbersOf(), the single place that reads the tables (STATS, BAKERY, STATION, ammo slots); when the ECONOMY table lands in
// env/stats.mjs, switch numbersOf() to it and nothing else changes.
import { STATS, toasterName, rowOf } from '../env/stats.mjs';
import { BAKERY } from '../env/bakery.mjs';
import { STATION } from '../env/power.mjs';
import { ammoOf } from '../env/ammo.mjs';
import { BUDGET } from '../env/budget.mjs';
import { keyFor } from './key-text.mjs';

// The Toaster Wars rows (rowOf reads the overlay when the state has ammo), so every number here is the one the sim plays by.
const TW = { ammo: {} };
const tps = () => STATS.clock.ticksPerSecond;
const secs = (ticks) => Math.round((ticks / tps()) * 10) / 10;
const perMin = (everyTicks) => Math.round((60 * tps()) / everyTicks * 10) / 10;

/** The numbers the tips quote, read once from the tables. */
export function numbersOf() {
  return {
    mill: { wheat: BAKERY.wheatPerFlour, everySeconds: secs(BAKERY.millTicks), flourPerMin: perMin(BAKERY.millTicks) },
    well: { everySeconds: secs(BAKERY.wellTicks), perMinute: perMin(BAKERY.wellTicks), reach: BAKERY.wellReach, crowdReach: BAKERY.wellCrowdRadius },
    toaster: { everySeconds: secs(BAKERY.toasterTicks), slices: BAKERY.slicesPerBake },
    pantry: BAKERY.pantryCap,
    pantryPerToaster: BAKERY.pantryPerToaster,
    pilot: { everySeconds: secs(BAKERY.pilotTicks), floor: BAKERY.pilotFloor },
    station: { extension: STATION.extension.link, pylon: STATION.pylon.link },
    // The rate the Toaster Wars sim charges (toaster.upkeepPercent, 5); the classic budget default (10) only without it.
    upkeepPercent: STATS.toaster?.upkeepPercent ?? BUDGET.upkeepPercentPerMinute,
  };
}

const ACTION_TIPS = Object.freeze({
  amove: 'Attack-move: walk there and pop anything in the way. Then click the ground.',
  stop: 'Stop. Drop everything and stand still.',
  hold: 'Hold. Stand your ground and only fire at what walks into range.',
  move: 'Move. Walk there and ignore the fight. Then click the ground.',
  rally: 'Rally. New Toasties walk to the spot you click.',
  idle: 'Jump to the next Crumb with nothing to do.',
  recall: 'Bring a fallen veteran back with its rank and items.',
});

// One toaster-voice sentence plus a numbers line, per kind.
function kindTip(kind, n) {
  const u = STATS.units[kind] ? rowOf(TW, kind) : null;
  const slots = u && u.ammo !== false ? ammoOf(kind)?.slots : null;
  const fighter = u ? `${u.hp} HP, ${u.shot?.damage ?? u.damage} damage, reach ${u.range}${slots ? `, holds ${slots} slices` : ', runs on power, no slices'}.` : '';
  const upkeep = u ? ` Eats ${Math.round(u.cost * n.upkeepPercent) / 100} wheat a minute.` : '';
  const lines = {
    worker: ['Hauls wheat, builds, and re-plugs cut cords. Your whole economy walks on these.', `${fighter}`],
    grunt: ['The Popper: a plain Toastie that fires one slice every three shots. Cheap, and it needs feeding.', fighter + upkeep],
    lancer: ['The Zapper: a hot coil that bites close and fast. Keep it near a Popper.', fighter + upkeep],
    brute: ['The Four-Slice: slow, tough, and fires four slices at once. Good against walls.', fighter + upkeep],
    howler: ['The Broiler: lobs bread shells from far away; the splash hits Toasties beside the target.', fighter + upkeep],
    spiker: ['The Flak Popper: crouton flak that bursts on swarms and hits the Toasties beside its target.', fighter + upkeep],
    dart: ['The Bagel: rolls into things. Needs power but no slices.', fighter + upkeep],
    forge: ['The Assembly Line: where fighting Toasties come off the belt. Select it to queue them.', `Up to ${STATS.match.queueMax} in the queue; click a queued icon to cancel.`],
    turret: ['The Heat Lamp: sits there and warms up anyone who comes close.', `${STATS.structures.turret.damage} damage, reach ${STATS.structures.turret.range}.`],
    mill: ['Grinds wheat into flour. A busy Mill eats wheat, so feed it Crumbs.', `${n.mill.wheat} wheat makes 1 flour every ${n.mill.everySeconds} s (${n.mill.flourPerMin} flour a minute). Pantry holds ${n.pantry}, plus ${n.pantryPerToaster} per Toaster.`],
    well: [`Draws water by the river; a spring is slow. ${n.well.perMinute} Water a minute alone; Wells within ${n.well.crowdReach} tiles share.`, `1 water every ${n.well.everySeconds} s within ${n.well.reach} tiles of water. Pantry holds ${n.pantry}, plus ${n.pantryPerToaster} per Toaster.`],
    toaster: ['Flour + water + power makes toast, and toast is ammo. Keep it plugged in.', `1 flour + 1 water makes ${n.toaster.slices} slices every ${n.toaster.everySeconds} s.`],
    extension: [`Extension Box: pushes your power out so your Toasties can walk further. Link two and press ${keyFor('fence')} to fence the line.`, `Links up to ${n.station.extension} tiles.`],
    pylon: ['Relay Pylon: a tall pole whose line hops over rivers and cliffs, and never blocks a path.', `Links up to ${n.station.pylon} tiles.`],
    core: ['Your Power Strip: home. It takes wheat, trains Crumbs and keeps a pilot light.', `Bakes 1 emergency slice every ${n.pilot.everySeconds} s while toast is under ${n.pilot.floor}.`],
  };
  return lines[kind] ?? null;
}

/**
 * The tooltip for one card entry { action, kind, key, label, cost }: "Name (KEY), N Wheat. Sentence. Numbers."
 * Returns null when it knows nothing about the entry (the caller falls back to the generic text).
 */
export function tipFor(entry, { numbers = numbersOf() } = {}) {
  const key = String(entry.key ?? '').toUpperCase();
  const keyPart = key ? ` (${key})` : '';
  if (entry.kind && (entry.action === 'build' || entry.action === 'train')) {
    const k = kindTip(entry.kind, numbers);
    if (!k) return null;
    const name = toasterName(entry.kind);
    const verb = entry.action === 'build' ? 'Build' : 'Train';
    const price = entry.cost !== undefined ? `, ${entry.cost} Wheat` : '';
    const how = entry.action === 'build' ? ' Then click a free spot.' : '';
    const ticks = entry.action === 'build' ? STATS.structures[entry.kind]?.buildTicks : STATS.units[entry.kind]?.trainTicks;
    const time = ticks ? ` Takes ${secs(ticks)} s to ${entry.action === 'build' ? 'build' : 'bake'}.` : '';
    return `${verb} ${name}${keyPart}${price}. ${k[0]}${k[1] ? ` ${k[1]}` : ''}${how}${time}`;
  }
  const line = ACTION_TIPS[entry.action];
  if (!line) return null;
  return `${String(entry.label ?? entry.action).replace(/^./, (c) => c.toUpperCase())}${keyPart}. ${line}`;
}
