// Probe: event-type counts and first/last time in a saved match log (node systems-events.mjs s7.json). Read-only.
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync(new URL(process.argv[2], import.meta.url)));
const c = {}, first = {}, last = {};
const kills = [];
for (const t of j.ticks) {
  for (const e of t.events || []) {
    const k = e.e + (e.player !== undefined ? ':p' + e.player : '');
    c[k] = (c[k] || 0) + 1;
    if (!(k in first)) first[k] = t.tick;
    last[k] = t.tick;
    if (/dead|die|kill|destroy|lost/.test(e.e) && kills.length < 40) kills.push((t.tick / 24).toFixed(0) + 's ' + JSON.stringify(e).slice(0, 110));
  }
}
for (const k of Object.keys(c).sort()) console.log(k, c[k], 'first', (first[k] / 24).toFixed(0) + 's', 'last', (last[k] / 24).toFixed(0) + 's');
console.log(kills.join('\n'));
