// 6 mirror seeds on the real rules, in parallel (owner: sonnet).  node scripts/toaster-sweep.mjs [seeds,comma,separated] [maxMin]
// Prints one line per seed and a summary: Strip kills, kill times, frozen boards, refused moves.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const seeds = (process.argv[2] ?? '3,5,90,308,422,971').split(',').map(Number);
const maxMin = process.argv[3] ?? '15';
const script = fileURLToPath(new URL('./toaster-measure.mjs', import.meta.url));
const run = (seed) => new Promise((resolve) => {
  const p = spawn(process.execPath, [script, String(seed), maxMin]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.on('close', () => { try { resolve(JSON.parse(out.trim().split('\n').pop())); } catch { resolve({ seed, error: out.slice(0, 200) }); } });
});
const rows = await Promise.all(seeds.map(run));
for (const r of rows.sort((a, b) => a.seed - b.seed)) console.log(JSON.stringify(r));
const kills = rows.filter((r) => r.reason === 'core');
console.log(JSON.stringify({
  seeds: rows.length, kills: kills.length, killMinutes: kills.map((r) => r.min), frozen: rows.filter((r) => r.frozen).length,
  maxFrozenSecs: Math.max(...rows.map((r) => r.frozenSecs ?? 0)), refusals: rows.map((r) => r.cordLimits), wins0: rows.filter((r) => r.winner === 0).length,
}));
