// E: a full easy match where the player does nothing (variant: only the page's idle-Crumb auto-gather). How and when does it end?
import { makeMatch } from './lib.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { observeToaster } from '../../play/toaster-play.mjs';
const variant = process.argv[2] || 'nothing';
const seed = Number(process.argv[3] || 7);
const m = await makeMatch({ seed, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const idle = createIdleCrumbs({ side: 0 });
const mine = () => s.units.filter((u) => u.owner === 0).length, theirs = () => s.units.filter((u) => u.owner === 1).length;
const hp = (side) => s.structures.find((x) => x.kind === 'core' && x.owner === side)?.hp;
console.log('variant', variant, 'seed', seed, 'state.maxTicks', s.maxTicks);
await m.runTicks(21601, (tk) => {
  if (variant === 'idle-hook') m.d.queue(idle.tick(observeToaster(s, 0), new Map()));
  if (tk % (24 * 120) === 0) console.log(`min ${tk / 1440}: wheat [${s.shards.map(Math.floor)}] units [${mine()},${theirs()}] stripHP [${hp(0)},${hp(1)}] structures1 ${s.structures.filter((x) => x.owner === 1).map((x) => x.kind).join(',')}`);
});
console.log('ended', JSON.stringify(m.ended), 'final tick', s.tick, '=', (s.tick / 1440).toFixed(2), 'min');
m.stop();
