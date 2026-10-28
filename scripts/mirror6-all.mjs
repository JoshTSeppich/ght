// Runs scripts/mirror6.mjs for seeds 1..N in parallel and prints one short line each. Owner: sonnet.
//   node scripts/mirror6-all.mjs [bot=sonnet] [seeds=6] [maxMin=20]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const bot = process.argv[2] ?? 'sonnet', n = Number(process.argv[3] ?? 6), maxMin = process.argv[4] ?? '20';
const out = await Promise.all(Array.from({ length: n }, (_, i) =>
  run('node', ['scripts/mirror6.mjs', String(i + 1), maxMin, bot], { cwd: new URL('..', import.meta.url).pathname }).then((r) => JSON.parse(r.stdout))));
for (const r of out) console.log(`seed ${r.seed} ${r.bot}: ${r.min} min, ${r.reason}, winner ${r.winner}, first shot ${r.firstShot}, windmills ${r.windmills}, dams ${r.dams}, dark ${r.darkSamples}, strips ${r.stripHp}`);
