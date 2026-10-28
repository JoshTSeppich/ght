// Blinking "what is missing" icons over your Mill, Well and Toaster (PLAYABLE.md item 9). Owner: sonnet (HUD).
// badgesFor(state, side) is pure data; drawBadges(ctx, badges, project, tilePx, nowMs) paints them on the 2D overlay.
import { BAKERY, pantryCapOf, structurePowered } from '../env/bakery.mjs';

// Why a building is stalled, in reading order. 'wheat' = the Mill has no wheat to grind, 'flour' / 'water' = the Toaster's
// pantry lacks it (or the Well finds no water), 'power' = no lit cord reaches it, 'full' = the pantry is at its cap (pantryCapOf: 6, plus 3 per complete Toaster) so it idles.
export const BADGE_TIPS = Object.freeze({
  wheat: 'No wheat to grind.', flour: 'No flour.', water: 'No water.', power: 'No power.', full: 'Pantry full.',
});

/** [{ id, kind, x, y, icons: [...] }] for the side's finished Mills, Wells and Toasters that are stalled. */
export function badgesFor(state, side) {
  if (!state.bakery || !state.toast) return [];
  const pantry = state.toast.pantry[side];
  const cap = pantryCapOf(state, side);
  const out = [];
  for (const s of state.structures) {
    if (s.owner !== side || !s.complete || s.hp <= 0) continue;
    const icons = [];
    if (s.kind === 'mill') {
      if (pantry.flour >= cap) icons.push('full');
      else if (state.shards[side] < BAKERY.wheatPerFlour) icons.push('wheat');
    } else if (s.kind === 'well') {
      if (s.dry) icons.push('water');
      else if (pantry.water >= cap) icons.push('full');
    } else if (s.kind === 'toaster') {
      if (!structurePowered(state, s)) icons.push('power');
      if (!(pantry.flour >= 1)) icons.push('flour');
      if (!(pantry.water >= 1)) icons.push('water');
    }
    if (icons.length) out.push({ id: s.id, kind: s.kind, x: s.x, y: s.y, icons });
  }
  return out;
}

const GLYPH = {
  wheat: (c, x, y) => { c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y - 6); c.stroke(); for (const dy of [-5, -1, 3]) { c.beginPath(); c.moveTo(x, y + dy + 2); c.lineTo(x - 4, y + dy - 2); c.moveTo(x, y + dy + 2); c.lineTo(x + 4, y + dy - 2); c.stroke(); } },
  flour: (c, x, y) => { c.fillStyle = '#f4efe2'; c.fillRect(x - 5, y - 5, 10, 11); c.fillStyle = '#c9bfa4'; c.fillRect(x - 5, y - 5, 10, 3); },
  water: (c, x, y) => { c.fillStyle = '#4fb6ff'; c.beginPath(); c.moveTo(x, y - 7); c.quadraticCurveTo(x + 7, y + 2, x, y + 7); c.quadraticCurveTo(x - 7, y + 2, x, y - 7); c.fill(); },
  power: (c, x, y) => { c.fillStyle = '#ffe14d'; c.beginPath(); c.moveTo(x + 2, y - 7); c.lineTo(x - 4, y + 1); c.lineTo(x, y + 1); c.lineTo(x - 2, y + 7); c.lineTo(x + 4, y - 1); c.lineTo(x, y - 1); c.closePath(); c.fill(); },
  full: (c, x, y) => { c.fillStyle = '#ff6a5a'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FULL', x, y); },
};

/** Blink: on for 0.5 s, off for 0.3 s. */
export const badgeVisible = (nowMs) => nowMs % 800 < 500;

/** Paint the badges. project(x, y, h) -> { sx, sy } (the app's projector); one bubble per icon, side by side. */
export function drawBadges(ctx, badges, project, tilePx, nowMs = 0) {
  if (!badgeVisible(nowMs)) return;
  for (const b of badges) {
    const p = project(b.x, b.y, 1.6);
    const gap = Math.max(18, tilePx * 0.5);
    b.icons.forEach((icon, i) => {
      const x = p.sx + (i - (b.icons.length - 1) / 2) * gap, y = p.sy - tilePx * 0.6;
      ctx.save();
      ctx.fillStyle = 'rgba(20,16,36,0.82)'; ctx.strokeStyle = '#ff7a5a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      GLYPH[icon]?.(ctx, x, y);
      ctx.restore();
    });
  }
}
