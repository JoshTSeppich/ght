// Power Strip saturation readout (card 8 item 6). Owner: HUD. Reads Economy's fieldSaturation (env/economy.mjs), so the
// number here is the number the sim uses. Pure, no DOM: app.mjs puts the line in the Toaster Wars panel.
import { fieldSaturation } from '../env/economy.mjs';

/** One HTML line: Crumbs on wheat, Crumbs per field, and how full the open tiles beside the wheat are. '' when empty. */
export function saturationLine(state, side) {
  const f = fieldSaturation(state, side);
  if (!f.workers && !f.fields) return '';
  const pct = Math.round(f.saturation * 100);
  const per = f.workersPerField.toFixed(1);
  return `<div class="sat" title="Crumbs mine one wheat tile each; a field is full when every open tile beside it has a Crumb.">`
    + `${f.workers} Crumbs on ${f.fields} wheat fields, ${per} per field. ${pct}% of ${f.capacity} open tiles.</div>`;
}
