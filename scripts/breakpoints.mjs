// Hits to kill for every attacker and target at Weapons and Armor levels 0 to 3, from rowOf (Toaster Wars overlay)
// and the real hit formula in env/combat.mjs (DECISIONS.md 1): max(0.5, base + tag bonus + attackLevel - (armor + armorLevel)).
// node scripts/breakpoints.mjs
// A level's attackLevel/armorLevel comes from one of env/research.mjs's five TRACKS, chosen by attacker/target layer,
// same as env/combat.mjs weaponLevel/armorLevel; this script applies the level as a number, so it reads the same whether a
// fight is on ground-weapons, air-weapons, ground-armor, air-armor or structure-armor.
// Flags a Weapons or Armor level that moves no attacker's hits-to-kill against the three common targets.
import { fileURLToPath } from 'node:url';
import { STATS, ECONOMY, UNIT_KINDS, STRUCTURE_KINDS, rowOf } from '../env/stats.mjs';
import { damagePerHit } from '../env/combat.mjs';

const TOASTER_STATE = { ammo: true }; // the Toaster Wars overlay: the hp, shot and range Joshua plays on /play

// Every shooter on /play with a shot: the seven ground fighters, the two flyers that attack, and the Heat Lamp turret.
// The Crouton Kite carries no `damage` field (DECISIONS.md 3: a true scout) and never attacks, so it is not an attacker.
export const ATTACKERS = Object.freeze(
  [...UNIT_KINDS, 'turret'].filter((k) => rowOf(TOASTER_STATE, k)?.damage !== undefined),
);
// Every unit and the Heat Lamp as the one structure stand-in: a full matrix of "every pair" (card A3 item 1).
export const TARGETS = Object.freeze([...UNIT_KINDS, 'turret']);
// The three targets the bots field most: Crumbs (workers), Poppers (grunt) and Zappers (lancer). Assumption, see the report.
export const COMMON_TARGETS = Object.freeze(['worker', 'grunt', 'lancer']);
export const LEVELS = Object.freeze([0, 1, 2, 3]);

const isStructureKind = (kind) => kind === 'core' || STRUCTURE_KINDS.includes(kind);
// A row's shot damage with the Toaster Wars overlay on, same selection as env/combat.mjs hitDamage's `base`.
const shotDamage = (row) => (row.shot ? row.shot.damage : row.damage);

// Can this attacker's weapon reach that target's layer at all (env/combat.mjs canHit, minus the minRange dead zone,
// which is a placement fact, not a breakpoint)?
export function canHit(attacker, target) {
  const arow = rowOf(TOASTER_STATE, attacker);
  const trow = rowOf(TOASTER_STATE, target);
  return arow.hits?.[trow.layer] !== false;
}

// Damage per hit, mirroring env/combat.mjs hitDamage/damagePerHit for a single target (no splash, no items, no mul).
export function effectiveDamage(attacker, target, weapons = 0, armorLevel = 0) {
  const arow = rowOf(TOASTER_STATE, attacker);
  const trow = rowOf(TOASTER_STATE, target);
  const tags = isStructureKind(target) && !trow.tags.includes('Structure') ? [...trow.tags, 'Structure'] : trow.tags;
  const base = isStructureKind(target) ? shotDamage(arow) * (arow.structureMultiplier ?? 1) : shotDamage(arow);
  return damagePerHit({
    base, bonus: arow.bonus ?? {}, tags, armor: trow.armor ?? 0,
    attackBonus: weapons * (arow.attackStep ?? 1), armorBonus: armorLevel,
  });
}

// hits = ceil(target hp / effective damage), or null when the attacker's weapon cannot reach that target's layer.
export function hitsToKill(attacker, target, weapons = 0, armorLevel = 0) {
  if (!canHit(attacker, target)) return null;
  return Math.ceil(rowOf(TOASTER_STATE, target).hp / effectiveDamage(attacker, target, weapons, armorLevel));
}

// One row per attacker and target: hits-to-kill at Weapons 0 to 3 (Armor 0) and at Armor 0 to 3 (Weapons 0).
export function breakpointTable() {
  const rows = [];
  for (const attacker of ATTACKERS) {
    for (const target of TARGETS) {
      rows.push({
        attacker,
        target,
        weapons: LEVELS.map((w) => hitsToKill(attacker, target, w, 0)),
        armor: LEVELS.map((a) => hitsToKill(attacker, target, 0, a)),
      });
    }
  }
  return rows;
}

// A level is flagged when, for every attacker against the common targets, its hits equal the level below.
export function flaggedLevels(rows) {
  const flags = [];
  for (const track of ['weapons', 'armor']) {
    for (const level of [1, 2, 3]) {
      const moved = rows
        .filter((r) => COMMON_TARGETS.includes(r.target))
        .some((r) => r[track][level] !== r[track][level - 1]);
      if (!moved) flags.push({ track, level, changes: 0 });
    }
  }
  return flags;
}

function printTable(rows) {
  const name = (kind) => ECONOMY.units[kind]?.name ?? ECONOMY.buildings?.[kind]?.name ?? kind;
  const head = (cols) => LEVELS.map((l) => `${cols}${l}`.padStart(5)).join('');
  const show = (n) => (n === null ? '  -' : String(n)).padStart(5);
  console.log(`${'attacker → target'.padEnd(34)}${head('W')}${head('A')}`);
  for (const r of rows) {
    const label = `${name(r.attacker)} → ${name(r.target)}`;
    console.log(`${label.padEnd(34)}${r.weapons.map(show).join('')}${r.armor.map(show).join('')}`);
  }
  const flags = flaggedLevels(rows);
  console.log('');
  if (flags.length === 0) console.log('every Weapons and Armor level moves some attacker against the common targets');
  for (const f of flags) console.log(`flag: ${f.track} ${f.level} changes nothing against ${COMMON_TARGETS.map(name).join(', ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) printTable(breakpointTable());
