// Probe (c): at 167 wheat/min, how many Poppers (75) can be afforded by 8:00 and 12:00 with 5%/min upkeep, using the real STATS numbers.
// Plain arithmetic in 1-second steps; buys a Popper whenever the bank allows from the build-up point. Read-only.
import { STATS } from '../../env/stats.mjs';
const cost = STATS.units.grunt.cost, upk = 0.05;
const income = 167;
function run({ label, millDraw, startBuy, spentKitchen }) {
  let bank = 100, army = 0, spentUp = 0, spentMill = 0;
  const out = {};
  for (let t = 0; t <= 12 * 60; t++) {
    bank += income / 60;
    if (t >= 120) { bank -= millDraw / 60; spentMill += millDraw / 60; } // Mills eat wheat from 2:00
    if (t === 90) bank -= spentKitchen; // Mill+Well+Toaster+Assembly Line paid by 1:30
    const up = army * cost * upk / 60; bank -= up; spentUp += up; // 5% of army cost per minute
    while (t >= startBuy && bank >= cost && army < 40) { bank -= cost; army++; }
    if (t === 480) out.at8 = { army, bank: Math.round(bank), upkeepPaid: Math.round(spentUp), perMinUpkeep: +(army * cost * upk).toFixed(1) };
    if (t === 720) out.at12 = { army, bank: Math.round(bank), upkeepPaid: Math.round(spentUp), perMinUpkeep: +(army * cost * upk).toFixed(1) };
  }
  console.log(label, JSON.stringify(out));
}
run({ label: 'A. all wheat to Poppers from 2:30, kitchen 375 paid, no flour draw', millDraw: 0, startBuy: 150, spentKitchen: 375 });
run({ label: 'B. same, but 2 Mills feed toast (60 wheat/min from 2:00)', millDraw: 60, startBuy: 150, spentKitchen: 375 + 75 });
run({ label: 'C. same, 3 Mills (90 wheat/min), 3rd Mill 75', millDraw: 90, startBuy: 150, spentKitchen: 375 + 150 });
// Break-even: army size where upkeep eats the whole income
console.log('upkeep eats all 167/min at', Math.round(167 / (cost * upk)), 'Poppers (', Math.round(167 / (cost * upk) * cost), 'wheat of army ) ; with 2 Mills drawing 60:', Math.round((167 - 60) / (cost * upk)), 'Poppers');
console.log('toast per fighting Popper', (60 / 4.5 * 2.5).toFixed(1), 'wheat/min of slices (13.3 slices x 2.5); upkeep 3.75; total per fighting Popper', (13.3 * 2.5 + 3.75).toFixed(1), 'wheat/min ->', Math.floor(167 / (13.3 * 2.5 + 3.75)), 'Poppers fed in a continuous fight at 167/min');
