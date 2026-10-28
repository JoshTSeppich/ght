// Sandbox cheats as ordinary commands: { type: 'debug', op: 'wheat'|'toast'|'reveal'|'spawn', ... }. The sim stays deterministic
// (a cheat is just a command in the log). A match is a sandbox only when state.sandbox is set; anywhere else the referee
// path rejects every debug command with 'no-sandbox'. No Node-only globals: env runs in the browser.
import { STATS } from "./stats.mjs";
import { emit, allocId, isPassable, isFree } from "./state.mjs";
import { addStock } from "./ammo.mjs";

export const DEBUG = Object.freeze({ wheat: 500, toast: 20, squad: 4, maxSquad: 8, maxAmount: 5000 });

/** Marks a match as a sandbox: cheats allowed, the page shows the badge. */
export function enableSandbox(state) {
  state.sandbox = { revealed: false };
  return state;
}

/** Applies one debug command. Returns null when applied, else the reason it was refused. */
export function doDebug(state, player, c) {
  if (!state.sandbox) return "no-sandbox";
  if (player !== 0 && player !== 1) return "bad-command";
  switch (c.op) {
    case "wheat": {
      const n = c.amount === undefined ? DEBUG.wheat : c.amount;
      if (!Number.isInteger(n) || n <= 0 || n > DEBUG.maxAmount) return "bad-command";
      state.shards[player] += n;
      emit(state, { e: "debug", player, op: "wheat", amount: n });
      return null;
    }
    case "toast": {
      const n = c.amount === undefined ? DEBUG.toast : c.amount;
      if (!Number.isInteger(n) || n <= 0 || n > DEBUG.maxAmount) return "bad-command";
      if (!addStock(state, player, n)) return "bad-command";
      emit(state, { e: "debug", player, op: "toast", amount: n });
      return null;
    }
    case "reveal":
      state.sandbox.revealed = true;
      emit(state, { e: "debug", player, op: "reveal" });
      return null;
    case "spawn":
      return spawnSquad(state, player, c);
    default:
      return "bad-command";
  }
}

function spawnSquad(state, player, c) {
  const kind = c.kind;
  if (typeof kind !== "string" || !STATS.units[kind]) return "wrong-kind";
  if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) return "bad-command";
  if (c.x < 0 || c.y < 0 || c.x >= state.width || c.y >= state.height) return "off-map";
  const count = c.count === undefined ? DEBUG.squad : c.count;
  if (!Number.isInteger(count) || count < 1 || count > DEBUG.maxSquad) return "bad-command";
  const core = state.structures.find((s) => s.kind === "core" && s.owner === player && s.hp > 0);
  const spots = [];
  for (let d = 0; spots.length < count && d < 8; d++) {
    for (let y = c.y - d; y <= c.y + d; y++) {
      for (let x = c.x - d; x <= c.x + d; x++) {
        if (spots.length >= count) break;
        if (Math.max(Math.abs(x - c.x), Math.abs(y - c.y)) !== d) continue;
        if (isPassable(state, x, y) && isFree(state, x, y) && !spots.some((s) => s.x === x && s.y === y)) spots.push({ x, y });
      }
    }
  }
  if (!spots.length) return "tile-taken";
  for (const s of spots) {
    const unit = { id: allocId(state), owner: player, kind, x: s.x, y: s.y, hp: STATS.units[kind].hp, carrying: 0, order: null };
    if (state.power && core) unit.power = { state: "plugged", anchor: core.id, battery: 0 };
    state.units.push(unit);
    emit(state, { e: "spawn", unit: { ...unit } });
  }
  state.units.sort((a, b) => a.id - b.id);
  return null;
}
