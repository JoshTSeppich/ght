// ONE table of every economy number in Toaster Wars (PLAYABLE.md item 1). Owner: sonnet.
//
// buildEconomy(STATS) gathers the numbers the rules already use; it does not own or change them. Where a number lives
// in a module that itself imports stats.mjs (bakery, ammo, power, map) it is written once here under LITERALS and
// tests/economy-table.test.mjs pins it to the live module, so the two can never drift apart. env/stats.mjs re-exports
// ECONOMY, so `import { ECONOMY } from '../env/stats.mjs'` works. ECONOMY.md is generated from this object
// (node scripts/economy-doc.mjs); the HUD and tooltips must read their numbers from here.
// Browser-safe: no Node globals.

// Numbers owned by modules that import stats.mjs (so this file cannot import them without a cycle).
const LITERALS = {
  start: { crumbs: 6, stripStack: 8, powerStrips: 1 }, // map.workers per side; BAKERY.startStack
  wheat: { tileAmount: 1800, classicTileAmount: 400, richMultiplier: 2 }, // env/map.mjs WHEAT_AMOUNT, AMOUNT
  bakery: {
    wheatPerFlour: 10, millSeconds: 20, wellSeconds: 6, springEvery: 2, toasterSeconds: 5, slicesPerBake: 4, pantryCap: 6,
    wellReach: 4, wellCrowdRadius: 8, wellEnemyReach: 6, pantryPerToaster: 3, pilotSeconds: 20, pilotFloor: 4,
  },
  // slots = slices a body holds; slicesPerShot = what one shot spends (env/ammo.mjs ARMED). Bagel needs power, no slices.
  ammo: {
    slots: { grunt: 6, lancer: 6, brute: 8, spiker: 6, howler: 4, dart: 0, waffleWing: 6, crumpetBomber: 4 },
    slicesPerShot: { grunt: 1, lancer: 1, brute: 4, spiker: 1, howler: 1, dart: 0, waffleWing: 1, crumpetBomber: 1 },
    shotsPerSlice: { grunt: 3, lancer: 3, brute: 1, spiker: 3, howler: 3, dart: 1, waffleWing: 3, crumpetBomber: 3 }, // env/ammo.mjs ARMED
    crumbCarry: 2, reserve: 2,
  },
  power: {
    cord: { worker: 12, grunt: 12, lancer: 12, brute: 9 },
    stationCost: { extension: 30, pylon: 60, generator: 60 },
    stationReach: { strip: 14, outlet: 10, extension: 12, pylon: 8 },
  },
  // env/energy.mjs ENERGY: what makes and uses Energy (Toaster Wars, PLAYABLE.md item 20). energy.mjs imports power.mjs, which
  // imports stats.mjs, so this table cannot import it; tests/economy-curve.test.mjs pins these to ENERGY.
  energy: {
    make: { strip: 2, generator: 2, windmill: 3, dam: 6, milldam: 14 },
    use: { toaster: 2 },
    fenceTiles: 8,
    cost: { windmill: 40, dam: 90, milldam: 160 },
  },
};

const NAMES = {
  worker: "Crumb", grunt: "Popper", lancer: "Zapper", brute: "Four-Slice", howler: "Broiler", spiker: "Flak Popper", dart: "Bagel",
  croutonKite: "Crouton Kite", waffleWing: "Waffle Wing", crumpetBomber: "Crumpet Bomber", // Air Layer, DECISIONS.md 3
  forge: "Assembly Line", turret: "Heat Lamp", mill: "Mill", well: "Well", toaster: "Toaster", coolingRack: "Cooling Rack",
};

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export function deepFreezeTable(o) {
  for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreezeTable(v);
  return Object.freeze(o);
}

// opts.map: a generated map (env/map.mjs generateMap); its side-0 worker list sets the starting Crumbs. Without one the
// table uses the Wheatfield count in LITERALS (ECONOMY in env/stats.mjs is built at import, so it cannot generate a map).
export function buildEconomy(STATS, opts = {}) {
  const tps = STATS.clock.ticksPerSecond;
  const L = LITERALS;
  const B = L.bakery;
  const upkeepRate = STATS.toaster.upkeepPercent / 100;

  const units = {};
  for (const [kind, base] of Object.entries(STATS.units)) {
    const row = { ...base, ...(STATS.toaster.units[kind] ?? {}) };
    const slices = L.ammo.slicesPerShot[kind] ?? 0;
    const everySec = row.shot ? row.shot.every / tps : null;
    units[kind] = {
      name: NAMES[kind], wheat: row.cost, hp: row.hp, trainSeconds: round(row.trainTicks / tps),
      upkeepWheatPerMinute: kind === "worker" ? 0 : round(row.cost * upkeepRate),
      slots: L.ammo.slots[kind] ?? 0, slicesPerShot: slices, shotsPerSlice: L.ammo.shotsPerSlice[kind] ?? 1,
      shotDamage: row.shot?.damage ?? null, shotEverySeconds: everySec === null ? null : round(everySec),
      slicesPerMinuteFighting: everySec && slices ? round(((60 / everySec) * slices) / (L.ammo.shotsPerSlice[kind] ?? 1), 1) : 0,
    };
  }

  const buildings = {};
  for (const [kind, base] of Object.entries(STATS.structures)) {
    const row = { ...base, ...(STATS.toaster.structures[kind] ?? {}) };
    buildings[kind] = { name: NAMES[kind], wheat: row.cost, hp: row.hp, buildSeconds: round(row.buildTicks / tps) };
  }

  const millFlourPerMin = 60 / B.millSeconds;
  const wheatPerSlice = B.wheatPerFlour / B.slicesPerBake;
  const popper = units.grunt;

  return {
    start: { wheat: STATS.match.startShards, ...L.start, crumbs: opts.map ? opts.map.workers[0].length : L.start.crumbs },
    wheat: {
      ...L.wheat, crumbCarryPerTrip: STATS.economy.hand.carry, classicCarryPerTrip: STATS.crystal.carry,
      mineSeconds: round(STATS.economy.hand.mineTicks / tps),
    },
    units, buildings,
    strip: { hp: STATS.toaster.coreHp, classicHp: STATS.core.hp },
    bakery: {
      ...B,
      wellWaterPerMinuteCreek: 60 / B.wellSeconds,
      wellWaterPerMinuteSpring: 60 / B.wellSeconds / B.springEvery,
    },
    power: {
      cordTiles: L.power.cord, stationWheat: L.power.stationCost, stationReachTiles: L.power.stationReach,
      energyMade: L.energy.make, energyUsed: L.energy.use, energyCost: L.energy.cost, fenceTilesPerEnergy: L.energy.fenceTiles,
    },
    ammo: { crumbCarrySlices: L.ammo.crumbCarry, stripReserveSlices: L.ammo.reserve },
    upkeep: { percentOfCostPerMinute: round(upkeepRate * 100), exempt: [...STATS.upkeep.exempt], supplyCap: STATS.upkeep.supplyCap },
    match: { unitCap: STATS.match.unitCap, queueMax: STATS.match.queueMax, ticksPerSecond: tps },
    perMinute: {
      wheatPerCrumb: units.worker.wheat,
      millWheatIn: (60 / B.millSeconds) * B.wheatPerFlour,
      millFlourOut: millFlourPerMin,
      millSlicesWorth: millFlourPerMin * B.slicesPerBake,
      toasterFlourIn: 60 / B.toasterSeconds,
      toasterWaterIn: 60 / B.toasterSeconds,
      toasterSlicesOut: (60 / B.toasterSeconds) * B.slicesPerBake,
      millsPerToaster: round(60 / B.toasterSeconds / millFlourPerMin),
      wheatPerSlice,
      popperSlicesWhileFighting: popper.slicesPerMinuteFighting,
      popperWheatWhileFighting: round(popper.slicesPerMinuteFighting * wheatPerSlice, 1),
      popperUpkeepWheat: popper.upkeepWheatPerMinute,
      millsToFeedOnePopper: round(popper.slicesPerMinuteFighting / (millFlourPerMin * B.slicesPerBake), 1),
    },
  };
}
