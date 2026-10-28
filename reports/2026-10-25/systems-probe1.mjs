// Probe: map facts + easy-vs-easy minute-by-minute (wheat, units, extension boxes, strip hp). Read-only.
import { makeMatch } from './lib.mjs';
import { STATS } from '../../env/stats.mjs';
const m = await makeMatch({ seed: Number(process.argv[2] || 7), difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const cores = s.structures.filter((x) => x.kind === 'core');
console.log('map', s.width, s.height, 'cores', cores.map((c) => `${c.owner}@${c.x},${c.y}`).join(' '), 'dist', Math.max(Math.abs(cores[0].x - cores[1].x), Math.abs(cores[0].y - cores[1].y)));
console.log('grunt range', STATS.units.grunt.range, 'core hp', cores[0].hp);
console.log('springs', JSON.stringify(s.springs.slice(0, 6)));
let last = -1;
await m.runTicks(21601, (tk) => {
  if (tk % 1440 === 0 && tk !== last) {
    last = tk;
    const ext = (o) => s.structures.filter((x) => x.owner === o && (x.kind === 'extension' || x.kind === 'outlet')).length;
    console.log(`min ${tk / 1440} wheat [${s.shards.map(Math.floor)}] units0 ${s.units.filter((u) => u.owner === 0).length} units1 ${s.units.filter((u) => u.owner === 1).length} ext1 ${ext(1)} ext0 ${ext(0)} coreHp [${cores.map((c) => c.hp)}]`);
  }
});
console.log('ended', JSON.stringify(m.ended));
m.stop();
