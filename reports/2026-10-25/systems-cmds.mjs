// Probe: count each player's commands by type in a saved match log (node systems-cmds.mjs m7.json). Read-only.
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync(new URL(process.argv[2], import.meta.url)));
const c = {}, first = {}, last = {};
j.ticks.forEach((t) => {
  t.commands.forEach((list, p) => {
    for (const cm of list || []) {
      const k = p + ':' + cm.type + (cm.kind ? '/' + cm.kind : '');
      c[k] = (c[k] || 0) + 1;
      if (!(k in first)) first[k] = t.tick;
      last[k] = t.tick;
    }
  });
});
for (const k of Object.keys(c).sort()) console.log(k, c[k], 'first', (first[k] / 24).toFixed(0) + 's', 'last', (last[k] / 24).toFixed(0) + 's');
