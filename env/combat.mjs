// Combat phase (spec section 7). Step 5 of a tick, after movement.
// Every attack in a tick is decided from positions and hp at the start of the phase, damage is summed per target,
// then applied together. Only after that are hits reported and dead entities removed.
import { UNIT_KINDS, STRUCTURE_KINDS, PACING, rowOf } from "./stats.mjs";
import { distance, emit } from "./state.mjs";
import { canFire, canMove, spendShot } from "./ammo.mjs";
import { heightAt, isSeen, visionOf } from "./vision.mjs";
import { upgradeLevel } from "./research.mjs";
import { unitMods, awardKill } from "./items.mjs";

// High ground (SYSTEMS-DESIGN.md section 3): a ranged shot (range 2 or more) from a high tile to a lower tile reaches 1 farther.
export const HIGH_REACH = 1;

// Damage per hit (DECISIONS.md 1): max(0.5, base + tag bonus + attack level - (armor + armor level)). `base` already holds the
// structure multiplier when the target is a building; `mul` is the attacker's rank/item damage multiplier (1 without items).
export const MIN_DAMAGE = 0.5;
export function damagePerHit({ base, bonus = {}, tags = [], armor = 0, attackBonus = 0, armorBonus = 0, mul = 1 }) {
  const extra = tags.reduce((sum, tag) => sum + (bonus[tag] ?? 0), 0);
  return Math.max(MIN_DAMAGE, (base + extra + attackBonus) * mul - armor - armorBonus);
}

// Idle units that fight on their own (spec section 7). Workers (Crumbs) only fight when ordered. The Crouton Kite
// carries no `damage` field (DECISIONS.md 3: a true scout), so it never attacks and stays out of this list.
const AUTO_KINDS = ["grunt", "lancer", "brute", "howler", "spiker", "dart", "waffleWing", "crumpetBomber"];

const isUnit = (e) => UNIT_KINDS.includes(e.kind);
const isStructure = (e) => e.kind === "core" || STRUCTURE_KINDS.includes(e.kind);
const byId = (a, b) => a.id - b.id;

// Stats row for a unit or buildable structure. The Core has no row with damage, so it never attacks.
// With hunger on (state.ammo) this is the GHT overlay row: toaster ranges and shots.
function statsOf(entity, state) {
  return rowOf(state, entity.kind);
}

// Every unit and structure (sites included), lowest id first.
function everything(state) {
  return [...state.units, ...state.structures].sort(byId);
}

// Can this entity attack at all this tick? Units need an attack order, or no order and an auto-fighting kind.
// Turrets need to be complete and powered (the Heat Lamp fires only while powered, like a unit).
// With hunger on a shot also needs power and slices (fed) and waits out the unit's cadence (its `shot.every`).
function canAttack(entity, state) {
  const row = statsOf(entity, state);
  if (!row || row.damage === undefined) return false;
  if (state.ammo) {
    if (state.tick < (entity.nextShot ?? 0)) return false;
    if (isUnit(entity) && !canFire(state, entity)) return false;
  }
  // canMove is the power check (true with hunger off); a turret has no slices to spend.
  if (entity.kind === "turret" && !canMove(state, entity)) return false;
  if (isUnit(entity)) {
    if (!entity.order) return AUTO_KINDS.includes(entity.kind);
    return entity.order.type === "attack";
  }
  return entity.complete === true;
}

// Which layer an entity fights and is hit on: "air" only for unit rows that say so; buildings are always ground.
const layerOf = (e, state) => (isUnit(e) && statsOf(e, state)?.layer === "air" ? "air" : "ground");
const tagsOf = (e, state) => {
  const tags = statsOf(e, state)?.tags ?? [];
  return isStructure(e) && !tags.includes("Structure") ? [...tags, "Structure"] : tags;
};
// Upgrade tracks (env/research.mjs; level 0 until research lands): attacker's weapons, target's armor.
// setUpgradeLevelHook(fn | null) swaps the level source (tests stub a level; null restores research.mjs).
let levelOf = upgradeLevel;
export function setUpgradeLevelHook(fn) {
  levelOf = fn ?? upgradeLevel;
}
const weaponLevel = (state, a) => levelOf(state, a.owner, `${layerOf(a, state)}-weapons`) | 0;
const armorLevel = (state, t) =>
  levelOf(state, t.owner, isStructure(t) ? "structure-armor" : `${layerOf(t, state)}-armor`) | 0;

// Can this attacker's weapon hit that target's layer, and is the target outside its dead zone (minRange)?
function canHit(state, attacker, target) {
  const row = statsOf(attacker, state);
  if (row.hits && row.hits[layerOf(target, state)] === false) return false;
  return !(row.minRange > 0 && distance(attacker, target) < row.minRange);
}

// One hit of `attacker` on `target`. A splash neighbour takes the half shot with no building multiplier and no tag bonus.
function hitDamage(state, attacker, target, base, splash = false) {
  const row = statsOf(attacker, state);
  // Classic matches (hunger off) keep the old flat numbers: armor, tags, bonus and upgrades are GHT rules.
  if (!state.ammo) return isStructure(target) ? base * (row.structureMultiplier ?? 1) : base;
  const trow = statsOf(target, state) ?? {};
  const mods = state.items ? unitMods(attacker, state) : null;
  const tmods = state.items && isUnit(target) ? unitMods(target, state) : null;
  return damagePerHit({
    base: !splash && isStructure(target) ? base * (row.structureMultiplier ?? 1) : base,
    bonus: splash ? {} : row.bonus,
    tags: tagsOf(target, state),
    armor: (trow.armor ?? 0) + (tmods ? tmods.armour : 0),
    attackBonus: weaponLevel(state, attacker) * (row.attackStep ?? 1),
    armorBonus: armorLevel(state, target),
    mul: mods ? mods.damageMul : 1,
  });
}

// How far this attacker's shot reaches at this target: its range, plus HIGH_REACH from high ground down to lower ground.
function reachOf(state, attacker, target) {
  const range = statsOf(attacker, state).range;
  const up = range >= 2 && heightAt(state, attacker.x, attacker.y) > heightAt(state, target.x, target.y);
  return up ? range + HIGH_REACH : range;
}

// Rows of tiles each side can see, built at most once per side for a phase (decisions use start-of-phase positions).
function visionMap(state) {
  const rows = new Map();
  return (owner) => {
    if (!rows.has(owner)) rows.set(owner, visionOf(state, owner));
    return rows.get(owner);
  };
}

// Auto-target priority (ROLE-CARDS Combat A3): armed units, then Crumbs, then buildings, then the Power Strip (the Core).
function priorityOf(e) {
  if (isUnit(e)) return e.kind === "worker" ? 1 : 0;
  return e.kind === "core" ? 3 : 2;
}

// The target this attacker hits this tick, or null (spec section 7).
// Only enemies on tiles the attacker's side can see are targets (fog), and an attack order only ever hits its ordered target,
// and only when that target is visible and in range.
// Otherwise a unit keeps its held target (`targetId`) while that target is still visible and in reach. When it is not, the
// nearest enemy in reach of the best priority class is chosen, lower id winning ties.
export function chooseTarget(state, attacker, seen = visionMap(state)) {
  if (!canAttack(attacker, state)) return null;
  const candidates = everything(state).filter((e) => e.owner !== attacker.owner && isSeen(seen(attacker.owner), e.x, e.y));
  const inReach = (e) => distance(attacker, e) <= reachOf(state, attacker, e) && canHit(state, attacker, e);
  if (isUnit(attacker) && attacker.order) {
    const target = candidates.find((e) => e.id === attacker.order.target);
    return target && inReach(target) ? target : null;
  }
  if (isUnit(attacker) && attacker.targetId != null) {
    const held = candidates.find((e) => e.id === attacker.targetId);
    if (held && inReach(held)) return held;
  }
  let best = null;
  for (const e of candidates) {
    if (!inReach(e)) continue;
    if (!best) best = e;
    else if (priorityOf(e) < priorityOf(best)) best = e;
    else if (priorityOf(e) === priorityOf(best) && distance(attacker, e) < distance(attacker, best)) best = e;
  }
  return best;
}

function removeFrom(list, entity) {
  const i = list.indexOf(entity);
  if (i >= 0) list.splice(i, 1);
}

// Runs the whole combat phase on the state in place.
export function stepCombat(state) {
  // 1. Decide every attack from the start-of-phase positions.
  const attacks = [];
  const all = everything(state);
  const seen = visionMap(state);
  for (const attacker of all.filter((e) => canAttack(e, state))) {
    const target = chooseTarget(state, attacker, seen);
    // Idle units hold their target until it is gone, out of sight or out of reach (ROLE-CARDS Combat A2).
    if (isUnit(attacker) && !attacker.order) attacker.targetId = target ? target.id : null;
    if (!target) continue;
    // Opening pace: a paced Core takes no damage until its 3:00 shield is down (env/stats.mjs PACING).
    if (state.pacing && target.kind === "core" && state.tick < PACING.coreShieldTicks) continue;
    const row = statsOf(attacker, state);
    const base = state.ammo && row.shot ? row.shot.damage : row.damage;
    const dmg = hitDamage(state, attacker, target, base);
    if (state.ammo) {
      if (isUnit(attacker)) spendShot(state, attacker, target.id);
      attacker.nextShot = state.tick + (row.shot ? row.shot.every : 1);
    }
    attacks.push({ attacker, target, dmg });
    // Broiler shell and Flak burst: enemy neighbours of the target take half the base shot (never the building multiplier).
    // A splash weapon never crosses a layer it could not otherwise hit (Air Layer, DECISIONS.md 3): a ground-only
    // shell beside a flyer, or an air-only burst beside a grounded unit, leaves that neighbour alone.
    if (state.ammo && row.splash) {
      for (const near of all) {
        if (near === target || near.owner === attacker.owner || distance(near, target) > row.splash) continue;
        if (row.hits && row.hits[layerOf(near, state)] === false) continue;
        attacks.push({ attacker, target: near, dmg: hitDamage(state, attacker, near, Math.max(1, Math.floor(base / 2)), true) });
      }
    }
  }

  // Building damage per side (read by the Match Rules tie-break): the hp each side removes from enemy buildings, in attack
  // order. Overkill is not counted, so a building never credits more than the hp it had left.
  const roomLeft = new Map();
  for (const a of attacks) {
    if (!isStructure(a.target)) continue;
    const room = roomLeft.get(a.target) ?? a.target.hp;
    const credit = Math.min(a.dmg, room);
    roomLeft.set(a.target, room - credit);
    if (credit <= 0) continue;
    state.buildingDamage ??= [0, 0];
    state.buildingDamage[a.attacker.owner] += credit;
  }

  // 2. Sum damage per target, then apply it all at once. Hp never goes below 0.
  const total = new Map();
  for (const a of attacks) total.set(a.target, (total.get(a.target) ?? 0) + a.dmg);
  for (const [target, dmg] of total) target.hp = Math.max(0, target.hp - dmg);

  // 3. One hit per attack, in attacker id order. Each shows the target's hp after all damage this tick.
  for (const a of attacks) {
    emit(state, { e: "hit", id: a.target.id, by: a.attacker.id, dmg: a.dmg, hp: a.target.hp });
  }

  // 4. Remove everything at 0 hp and report the deaths in id order, right after the hits.
  const dead = everything(state).filter((e) => e.hp <= 0);
  for (const e of dead) removeFrom(isUnit(e) ? state.units : state.structures, e);
  for (const e of dead) emit(state, { e: "die", id: e.id });
  // Ranks count in player fights (env/items.mjs): the lowest-id attacker that hit a dead unit this tick earns the kill.
  if (state.items) {
    for (const e of dead) {
      if (!isUnit(e)) continue;
      const killer = attacks.find((a) => a.target === e && isUnit(a.attacker) && state.units.includes(a.attacker));
      if (killer) awardKill(state, killer.attacker);
    }
  }

  // 5. Orders that pointed at a removed entity clear (attack target gone, or build site gone).
  const gone = new Set(dead.map((e) => e.id));
  for (const unit of [...state.units].sort(byId)) {
    const order = unit.order;
    if (!order) continue;
    const pointsAtGone =
      (order.type === "attack" && gone.has(order.target)) || (order.type === "build" && gone.has(order.site));
    if (!pointsAtGone) continue;
    unit.order = null;
    emit(state, { e: "order", id: unit.id, order: null });
  }
}
