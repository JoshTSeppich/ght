// A: does wheat rise with nothing built? Without the page's idle-Crumb hook (play/app.mjs:289) and with it.
import { step } from '../../env/sim.mjs';
import { createPlayableState, observeToaster } from '../../play/toaster-play.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { renderBar } from '../../play/hud-bar.mjs';

function run(withIdleHook, ticks = 24 * 120) {
  const s = createPlayableState(7);
  const idle = createIdleCrumbs({ side: 0 });
  const rows = [];
  const plans = new Map();
  const first = [];
  for (let i = 0; i < ticks; i++) {
    const cmds = withIdleHook ? idle.tick(observeToaster(s, 0), plans) : [];
    if (withIdleHook && i < 3 && cmds.length) first.push(...cmds.map((c) => JSON.stringify(c)));
    step(s, [cmds, []]);
    if (s.tick === 4 || s.tick === 96 || s.tick === 24 * 40 || s.tick === 24 * 46 || s.tick === 24 * 110) rows.push(`t=${(s.tick / 24).toFixed(1)}s wheat=${Math.floor(s.shards[0])}`);
  }
  return { s, rows, first };
}
for (const hook of [false, true]) {
  const { s, rows, first } = run(hook);
  console.log(`--- idle-crumb hook ${hook ? 'ON (what play/app.mjs does)' : 'OFF (bare sim)'}`);
  if (first.length) console.log('first commands:', first.slice(0, 3).join(' '));
  console.log(rows.join('  '));
  console.log('pantry', JSON.stringify(s.toast.pantry[0]), 'stack', s.toast.stack[0], 'energy report', JSON.stringify(s.energy.report[0]));
  const bar = renderBar(s, { side: 0 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log('HUD text:', bar);
}
