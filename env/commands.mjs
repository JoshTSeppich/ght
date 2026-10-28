// Validates and applies one side's command list (spec section 10).
// A legal command takes effect at once. An illegal one changes nothing and logs a reject event with its reason.
// Malformed input is never a crash: it is rejected as bad-command. Side order is decided by sim.mjs, not here.
import { STATS, STRUCTURE_KINDS, kindStats } from "./stats.mjs";
import { findEntity, isFree, emit, allocId, distance } from "./state.mjs";
import { startPush } from "./rocks.mjs";
import { doDebug } from "./debug.mjs";
import { autoGatherTile, CONSTRUCTION, REPAIR, repairMaxHp } from "./economy.mjs";   // 'auto' gather pick; cancel-build and repair rates (card 11)
import { flourReason, chargeFlour, refundFlour } from "./research.mjs";   // Flour for tier 2 and 3 kinds (decision 2)
import { wellPlaceReason } from "./bakery.mjs";   // SYSTEMS-DESIGN.md section 1: no Well within wellEnemyReach of an enemy structure

export function applyCommands(state, player, commands) {
  if (!Array.isArray(commands)) return;
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const reason = i >= STATS.match.maxCommandsPerTick ? "too-many" : applyOne(state, player, command);
    if (reason) emit(state, { e: "reject", player, command, reason });
  }
}

// Returns null when the command was applied, or the reason it was refused.
function applyOne(state, player, command) {
  try {
    if (!isObject(command)) return "bad-command";
    switch (command.type) {
      case "move":
        return doMove(state, player, command);
      case "attack":
        return doAttack(state, player, command);
      case "gather":
        return doGather(state, player, command);
      case "build":
        return doBuild(state, player, command);
      case "train":
        return doTrain(state, player, command);
      case "cancel-train":
        return doCancelTrain(state, player, command);
      case "cancel-build":
        return doCancelBuild(state, player, command);
      case "repair":
        return doRepair(state, player, command);
      case "stop":
        return doStop(state, player, command);
      case "push":
        return startPush(state, player, command);
      case "debug":
        return doDebug(state, player, command); // sandbox cheats; 'no-sandbox' unless state.sandbox
      default:
        return "bad-command";
    }
  } catch {
    // Every check runs before anything changes, so a stray error leaves the state as it was.
    return "bad-command";
  }
}

function doMove(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  const bad = tileReason(state, c.x, c.y);
  if (bad) return bad;
  setOrder(state, found.unit, { type: "move", x: c.x, y: c.y });
  return null;
}

function doAttack(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  const target = findEntity(state, c.target);
  if (!target || target.owner === player || kindStats(target.kind) === null) return "bad-target";
  setOrder(state, found.unit, { type: "attack", target: target.id });
  return null;
}

function doGather(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  if (found.unit.kind !== "worker") return "wrong-kind";
  if (c.target === "auto") { // the least-loaded Wheat tile in cord reach (env/economy.mjs pickWheatTile)
    const tile = autoGatherTile(state, found.unit);
    if (!tile) return "bad-target";
    setOrder(state, found.unit, { type: "gather", x: tile.x, y: tile.y, phase: "toField", ticks: 0 });
    return null;
  }
  const bad = tileReason(state, c.x, c.y);
  if (bad) return bad;
  const crystal = state.crystals.find((k) => k.x === c.x && k.y === c.y);
  if (!crystal || !(crystal.amount > 0)) return "bad-target";
  setOrder(state, found.unit, { type: "gather", x: c.x, y: c.y, phase: "toField", ticks: 0 });
  return null;
}

function doBuild(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  if (found.unit.kind !== "worker") return "wrong-kind";
  if (!STRUCTURE_KINDS.includes(c.kind)) return "wrong-kind";
  const bad = tileReason(state, c.x, c.y);
  if (bad) return bad;
  if (!isFree(state, c.x, c.y)) return "tile-taken";
  const tooClose = wellPlaceReason(state, player, c.kind, c.x, c.y);
  if (tooClose) return tooClose;
  const cost = STATS.structures[c.kind].cost;
  if (state.shards[player] < cost) return "no-shards";
  const noFlour = flourReason(state, player, c.kind);
  if (noFlour) return noFlour;

  state.shards[player] -= cost;
  chargeFlour(state, player, c.kind);
  emit(state, { e: "spend", player, amount: cost, shards: state.shards[player] });
  const site = { id: allocId(state), owner: player, kind: c.kind, x: c.x, y: c.y, hp: 1, progress: 0, complete: false, queue: [] };
  state.structures.push(site);
  emit(state, { e: "spawn", structure: { ...site, queue: [] } });
  setOrder(state, found.unit, { type: "build", site: site.id });
  return null;
}

function doTrain(state, player, c) {
  const building = typeof c.building === "number" ? state.structures.find((s) => s.id === c.building) : undefined;
  if (!building) return "bad-target";
  if (building.owner !== player) return "not-yours";
  const trains = kindStats(building.kind)?.trains;
  if (!Array.isArray(trains) || !trains.includes(c.kind)) return "wrong-kind";
  if (!building.complete) return "not-complete";
  if (building.queue.length >= STATS.match.queueMax) return "queue-full";
  const cost = STATS.units[c.kind].cost;
  if (state.shards[player] < cost) return "no-shards";
  if (sideUnitCount(state, player) + 1 > STATS.match.unitCap) return "unit-cap";
  const noFlour = flourReason(state, player, c.kind);
  if (noFlour) return noFlour;

  state.shards[player] -= cost;
  chargeFlour(state, player, c.kind);
  emit(state, { e: "spend", player, amount: cost, shards: state.shards[player] });
  building.queue.push(c.kind);
  emit(state, { e: "queue", id: building.id, queue: [...building.queue] });
  return null;
}

// cancel-train {building, index}: drop one queued unit. Without the budget the cost comes back in full; with the budget the
// cost is drawn as it trains, so cancelling the head forfeits what was drawn and a waiting item costs nothing.
function doCancelTrain(state, player, c) {
  const building = typeof c.building === "number" ? state.structures.find((s) => s.id === c.building) : undefined;
  if (!building) return "bad-target";
  if (building.owner !== player) return "not-yours";
  if (!Number.isInteger(c.index) || c.index < 0 || c.index >= building.queue.length) return "bad-command";
  const [kind] = building.queue.splice(c.index, 1);
  refundFlour(state, player, kind); // Flour is paid up front, so it always comes back
  if (c.index === 0) {
    building.training = null;
    if (state.budget?.drawn) delete state.budget.drawn[building.id];
  }
  if (!state.budget) {
    state.shards[player] += STATS.units[kind].cost;
    emit(state, { e: "refund", player, amount: STATS.units[kind].cost, shards: state.shards[player] });
  }
  emit(state, { e: "queue", id: building.id, queue: [...building.queue] });
  return null;
}

// cancel-build {building}: a site of yours still under construction is removed and CONSTRUCTION.cancelRefund of its cost
// comes back. Its builders go idle. A finished building is refused (it can be lost, not cancelled).
function doCancelBuild(state, player, c) {
  const site = typeof c.building === "number" ? state.structures.find((s) => s.id === c.building) : undefined;
  if (!site || !STATS.structures[site.kind]) return "bad-target";
  if (site.owner !== player) return "not-yours";
  if (site.complete) return "not-a-site";
  const refund = Math.floor(STATS.structures[site.kind].cost * CONSTRUCTION.cancelRefund);
  state.structures.splice(state.structures.indexOf(site), 1);
  for (const u of state.units) if (u.order && u.order.type === "build" && u.order.site === site.id) setOrder(state, u, null);
  state.shards[player] += refund;
  emit(state, { e: "refund", player, amount: refund, shards: state.shards[player] });
  emit(state, { e: "die", id: site.id });
  return null;
}

// repair {unit, target}: a Crumb beside a damaged building of its side starts repairing it (env/economy.mjs stepRepair). The
// Crumb must already stand beside it: the order does not walk the Crumb there.
function doRepair(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  if (found.unit.kind !== "worker") return "wrong-kind";
  const target = typeof c.target === "number" ? state.structures.find((s) => s.id === c.target) : undefined;
  if (!target || !(target.hp > 0)) return "bad-target";
  if (target.owner !== player) return "not-yours";
  if (!target.complete) return "not-complete";
  if (target.hp >= repairMaxHp(state, target.kind)) return "full-hp";
  if (distance(found.unit, target) > 1) return "not-adjacent";
  if (state.shards[player] < REPAIR.wheatPerTick) return "no-wheat";
  setOrder(state, found.unit, { type: "repair", target: target.id });
  return null;
}

function doStop(state, player, c) {
  const found = ownUnit(state, player, c.unit);
  if (found.reason) return found.reason;
  if (found.unit.order !== null) setOrder(state, found.unit, null);
  return null;
}

// Living units plus queued units for one side. Both count toward the unit cap.
function sideUnitCount(state, player) {
  let count = state.units.filter((u) => u.owner === player).length;
  for (const s of state.structures) if (s.owner === player) count += s.queue.length;
  return count;
}

// Returns { unit } for a living unit the player owns, or { reason } explaining why not.
function ownUnit(state, player, id) {
  const unit = typeof id === "number" ? state.units.find((u) => u.id === id) : undefined;
  if (!unit) return { reason: "no-such-unit" };
  if (unit.owner !== player) return { reason: "not-yours" };
  return { unit };
}

// Null when (x, y) is a whole number inside the map, otherwise the reason it is not.
function tileReason(state, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return "bad-command";
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return "off-map";
  return null;
}

function setOrder(state, unit, order) {
  unit.order = order;
  emit(state, { e: "order", id: unit.id, order: order && { ...order } });
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
