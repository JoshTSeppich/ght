// Driftfall — the Toaster-Wars kitchen (TERRITORY.md sections 17 and 18). Owner: sonnet. Pure and deterministic.
//
// Wheat (Shards, hauled by Crumbs) -> Mill -> flour; Well -> water; Toaster building: flour + water + power -> toast.
// Toast is the ammo (env/ammo.mjs): the toast stack IS the Power Strip's slice store. Three buildings, one chain, and
// every link is something the enemy can see and raid:
//   Mill      grinds wheatPerFlour Shards into one flour every millSeconds (while the pantry has room)
//   Well      draws one water every wellSeconds alone; it must stand within wellReach of water (the river), or the map has none.
//             Crowding (SYSTEMS-DESIGN.md section 1): every OTHER standing Well of ANY owner at Chebyshev distance d < wellCrowdRadius
//             adds (1 - d / R) to a sum, and the Well draws at base / (1 + sum), recomputed every beat. A spring Well draws
//             on every second beat on top. No Well may stand within wellEnemyReach of an enemy structure (wellPlaceReason).
//   Toaster   needs power (a lit network within reach of the building); every toasterSeconds it turns 1 flour + 1 water
//             into slicesPerBake slices of toast, but only while the army wants toast (wantsToast: stack under toastTarget,
//             and Flour above flourReserve unless the stack is under toastHungry)
//   Strip     the pilot light: while the stack is under pilotFloor it bakes one slice every pilotSeconds by itself, so a
//             side that lost its kitchen can always crawl back (no softlock, COMBAT.md section 2)
//
//   enableBakery(state)    creates state.bakery (idempotent); needs enableToast + enableAmmo first
//   stepBakery(state)      once a tick, after stepPower
//   pantryCapOf(state, side) -> the pantry cap: pantryCap plus pantryPerToaster for each complete Toaster of that side
//   observeBakery(state, side) -> { flour, water, toast, pantryCap, mills, wells: [{ id, crowd, rateTicks, ratePerMin, dry, spring }],
//                                   toasters, dry: [...], unpowered: [...] } | null
//   wellPlaceReason(state, owner, kind, x, y) -> null, or 'too-close-enemy' for a Well within wellEnemyReach of an enemy structure
//   BAKERY                 the numbers
import { STATS } from "./stats.mjs";
import { distance, emit } from "./state.mjs";
import { isToastOn } from "./toast.mjs";
import { addStock, stockOf, isAmmoOn } from "./ammo.mjs";

const tps = () => STATS.clock.ticksPerSecond;
const sec = (s) => Math.round(s * tps());

export const BAKERY = Object.freeze({
  wheatPerFlour: 10, // Shards ground into one flour
  millTicks: sec(20),
  wellTicks: sec(6), // one Well alone: 10 Water a minute; the crowd formula stretches its beat (refreshWells)
  toasterTicks: sec(5),
  slicesPerBake: 4, // one flour + one water makes four slices of toast (pacing: a 256-tile siege is toast-limited)
  pantryCap: 6, // flour or water waiting for a Toaster, per side, before any Toaster is built
  pantryPerToaster: 3, // each complete Toaster of that side adds this to the cap, so a bigger kitchen keeps its water
  wellReach: 4, // a Well must stand this close to a water tile or a map spring
  wellCrowdRadius: 8, // R: other Wells of any owner closer than this (Chebyshev) share the draw
  wellEnemyReach: 6, // a Well may not stand this close (Chebyshev, inclusive) to an enemy structure of any kind
  springEvery: 2, // a spring well draws every second beat
  pilotTicks: sec(20),
  pilotFloor: 4,
  startStack: 8, // slices in the Power Strip's stack at tick 0
  // Baking is army upkeep, so it is demand-driven (DECISIONS.md 6): a Toaster bakes only while the toast stack is under
  // toastTarget (four Poppers, six slices each), and below toastHungry only when the army is that short; above it a Toaster
  // leaves the last flourReserve Flour in the pantry for the Assembly Line and tier-2 and tier-3 orders.
  toastTarget: 24,
  toastHungry: 8,
  flourReserve: 2,
});

export function enableBakery(state, opts = {}) {
  if (!state.bakery) {
    state.bakery = { next: {}, wellAt: {}, pilotAt: [0, 0], water: state.waterSet || null, springs: state.springs || [] };
    if (isToastOn(state) && Number.isInteger(opts.startStack ?? BAKERY.startStack)) {
      state.toast.stack[0] = state.toast.stack[1] = opts.startStack ?? BAKERY.startStack;
    }
  }
  return state.bakery;
}

const pantryOf = (state, side) => state.toast.pantry[side];

// Where a Well stands decides its water (maps/WHEATFIELD.md): by the creek or river it is fast ('creek'), by a map spring
// tile (the home well) it is slow ('spring'), anywhere else it is dry (null). A map with no water at all lets a Well work
// anywhere, so the classic maps still play.
function waterAt(state, s) {
  const B = state.bakery;
  const hasWater = B.water && B.water.size > 0;
  const hasSprings = B.springs && B.springs.length > 0;
  if (!hasWater && !hasSprings) return "creek";
  const r = BAKERY.wellReach;
  if (hasWater) {
    for (let y = s.y - r; y <= s.y + r; y++) for (let x = s.x - r; x <= s.x + r; x++) if (B.water.has(`${x},${y}`)) return "creek";
  }
  if (hasSprings && B.springs.some(([x, y]) => Math.max(Math.abs(x - s.x), Math.abs(y - s.y)) <= r)) return "spring";
  return null;
}

// The pantry cap: pantryCap, plus pantryPerToaster for each complete Toaster of that side.
export function pantryCapOf(state, side) {
  const toasters = state.structures.filter((s) => s.owner === side && s.kind === "toaster" && s.complete && s.hp > 0).length;
  return BAKERY.pantryCap + BAKERY.pantryPerToaster * toasters;
}

// Each Well's water source, crowd and rate, from this tick's positions (SYSTEMS-DESIGN.md section 1). For a Well W, every
// OTHER standing Well of ANY owner at Chebyshev distance d < wellCrowdRadius adds (1 - d / R) to a sum, and W draws at
// base / (1 + sum): beatTicks is the gap between its beats, ratePerMin the rate. A spring Well draws on every second beat on top.
function refreshWells(state) {
  const R = BAKERY.wellCrowdRadius;
  const perMinute = (60 * tps()) / BAKERY.wellTicks; // 10 a minute for one Well
  const standing = state.structures.filter((s) => s.kind === "well" && s.complete && s.hp > 0);
  for (const s of state.structures) {
    if (s.kind !== "well") continue;
    let crowd = 0, sum = 0;
    for (const o of standing) {
      if (o === s) continue;
      const d = Math.max(Math.abs(o.x - s.x), Math.abs(o.y - s.y));
      if (d < R) { crowd += 1; sum += 1 - d / R; }
    }
    const source = waterAt(state, s);
    s.crowd = crowd;
    s.dry = !source;
    s.spring = source === "spring";
    s.beatTicks = Math.round(BAKERY.wellTicks * (1 + sum));
    s.rateTicks = s.beatTicks * (s.spring ? BAKERY.springEvery : 1);
    s.ratePerMin = s.dry ? 0 : perMinute / (1 + sum) / (s.spring ? BAKERY.springEvery : 1);
  }
}

// Where a Well may go, for the build command (env/commands.mjs doBuild): null when fine, else the reject reason. A Well may
// not stand within wellEnemyReach tiles (Chebyshev, inclusive) of an enemy structure of any kind: a site or a finished one.
export function wellPlaceReason(state, owner, kind, x, y) {
  if (kind !== "well") return null;
  const near = state.structures.some((s) => s.owner !== owner && s.hp > 0 && distance(s, { x, y }) <= BAKERY.wellEnemyReach);
  return near ? "too-close-enemy" : null;
}

// A building is powered when a lit power point of its owner covers it (the Strip, an Outlet, a box or a generator).
export function structurePowered(state, s) {
  const P = state.power;
  if (!P) return true;
  const view = P.view;
  if (!view) return true;
  if (state.energy && state.energy.shedToasters.has(s.id)) return false; // browned out (env/energy.mjs)
  return view.points.some((p) => p.owner === s.owner && distance(p, s) <= Math.max(p.range, 1) && (view.netOf.get(p.id)?.lit ?? false));
}

// Does this side's army want more toast? Under the target, and either hungry or with Flour to spare above the reserve.
export function wantsToast(state, side, flour) {
  const stack = stockOf(state, side);
  return stack < BAKERY.toastTarget && (stack < BAKERY.toastHungry || flour > BAKERY.flourReserve);
}

export function stepBakery(state) {
  const B = state.bakery;
  if (!B || !isToastOn(state) || !isAmmoOn(state)) return;
  const tick = state.tick;
  const due = (s, every) => {
    const at = B.next[s.id] ?? (B.next[s.id] = tick + every);
    if (tick < at) return false;
    B.next[s.id] = tick + every;
    return true;
  };
  // A Well's beat comes beatTicks after its last beat (refreshWells), so a Well placed or lost next door changes
  // the gap from the next beat on.
  const wellAt = (B.wellAt ??= {});
  const wellBeat = (s) => {
    const last = wellAt[s.id] ?? (wellAt[s.id] = tick);
    if (tick - last < s.beatTicks) return false;
    wellAt[s.id] = tick;
    return true;
  };
  refreshWells(state);
  const caps = [pantryCapOf(state, 0), pantryCapOf(state, 1)];
  for (const s of state.structures) {
    if (!s.complete || s.hp <= 0) continue;
    const pantry = pantryOf(state, s.owner);
    if (s.kind === "mill" && due(s, BAKERY.millTicks)) {
      if (pantry.flour < caps[s.owner] && state.shards[s.owner] >= BAKERY.wheatPerFlour) {
        state.shards[s.owner] -= BAKERY.wheatPerFlour;
        pantry.flour += 1;
        emit(state, { e: "mill", player: s.owner, id: s.id, wheat: BAKERY.wheatPerFlour, flour: pantry.flour });
      }
    } else if (s.kind === "well" && wellBeat(s)) {
      // A spring well is slow: it only draws on every second beat.
      s.beat = (s.beat || 0) + 1;
      if (!s.dry && (!s.spring || s.beat % BAKERY.springEvery === 0) && pantry.water < caps[s.owner]) {
        pantry.water += 1;
        emit(state, { e: "well", player: s.owner, id: s.id, water: pantry.water });
      }
    } else if (s.kind === "toaster" && due(s, BAKERY.toasterTicks)) {
      s.unpowered = !structurePowered(state, s);
      if (!s.unpowered && pantry.flour >= 1 && pantry.water >= 1 && wantsToast(state, s.owner, pantry.flour)) {
        pantry.flour -= 1;
        pantry.water -= 1;
        addStock(state, s.owner, BAKERY.slicesPerBake);
        emit(state, { e: "bake", player: s.owner, id: s.id, slices: BAKERY.slicesPerBake, stack: stockOf(state, s.owner) });
      }
    }
  }
  for (const side of [0, 1]) {
    const strip = state.structures.find((s) => s.kind === "core" && s.owner === side && s.hp > 0);
    if (!strip || tick < B.pilotAt[side]) continue;
    B.pilotAt[side] = tick + BAKERY.pilotTicks;
    if (stockOf(state, side) < BAKERY.pilotFloor) {
      addStock(state, side, 1);
      emit(state, { e: "bake", player: side, id: strip.id, slices: 1, stack: stockOf(state, side), pilot: true });
    }
  }
  for (const id of Object.keys(B.next)) if (!state.structures.some((s) => String(s.id) === id)) delete B.next[id];
  for (const id of Object.keys(wellAt)) if (!state.structures.some((s) => String(s.id) === id)) delete wellAt[id];
}

export function observeBakery(state, side) {
  if (!state.bakery || !isToastOn(state)) return null;
  const mine = (kind) => state.structures.filter((s) => s.owner === side && s.kind === kind && s.complete);
  const p = pantryOf(state, side);
  const wells = mine("well");
  return {
    flour: p.flour, water: p.water, toast: stockOf(state, side), pantryCap: pantryCapOf(state, side),
    mills: mine("mill").length, toasters: mine("toaster").length,
    wells: wells.map((s) => ({ id: s.id, crowd: s.crowd, rateTicks: s.rateTicks, ratePerMin: s.ratePerMin, dry: !!s.dry, spring: !!s.spring })),
    dry: wells.filter((s) => s.dry).map((s) => s.id),
    unpowered: mine("toaster").filter((s) => s.unpowered).map((s) => s.id),
  };
}
