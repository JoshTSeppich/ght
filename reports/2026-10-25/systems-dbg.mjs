// Debug probe: what does the power state look like on the page match? Read-only.
import { makeMatch } from './lib.mjs';
const m = await makeMatch({ seed: 7, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
console.log('wrap', s.power.wrap, 'points', s.power.points.length, 'keys', Object.keys(s.power).join(','));
await m.runTicks(24 * 150, null);
console.log('points at 150s', JSON.stringify(s.power.points.slice(0, 3)));
console.log('unit power sample', JSON.stringify(s.units.find((u) => u.owner === 0 && u.kind === 'worker').power));
console.log('cord grunt', JSON.stringify(s.power.cord || null));
m.stop();
