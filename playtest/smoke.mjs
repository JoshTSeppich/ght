// Playwright-free smoke for GHT (PLAYABLE.md item 32). Owner: haiku (QA playtester).
// Run: node playtest/smoke.mjs   (exit 0 = green, 1 = red; prints one line per check)
// What it does, headless in node, with no browser and no DOM:
//   1. boots the play modules (play/app.mjs, play/toaster-play.mjs) and checks the page title and the ?classic switch;
//   2. builds the default GHT match (createToasterState, the same state the page uses) and drives it with the
//      easy bot (players/toaster-easy) on the human side idle, for 2 minutes of match time (2880 ticks at 24 tps);
//   3. every 10 seconds it runs the play-side helpers the HUD uses (top bar, side panel, observeToaster) and fails on throw;
//   4. fails on any console.error / console.warn, any unhandled rejection, any referee error, or a reject of the human's side.
// The easy bot must not end the match in these 2 minutes (it never hurts a Strip before 10:00), so an early end is red.
// Playwright is not used on purpose: the Live Build Compiler runs this file as-is.
import * as easyBot from '../players/toaster-easy/bot.mjs';
import { createLiveMatch } from '../env/live.mjs';
import { createToasterState, toasterTopBar, toasterPanel, observeToaster, toasterMode, PAGE_TITLE } from '../play/toaster-play.mjs';
import * as app from '../play/app.mjs';

const TPS = 24;
const MATCH_SECONDS = 120;
const CHECK_EVERY = 10 * TPS;
const SEED = Number(process.env.SMOKE_SEED ?? 7);

const failures = [];
const log = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures.push(label);
};

// Capture anything the page would have printed as an error or warning during the run.
const consoleProblems = [];
for (const kind of ['error', 'warn']) {
  console[kind] = (...args) => {
    consoleProblems.push(`console.${kind}: ${args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ')}`);
  };
}
process.on('unhandledRejection', (err) => consoleProblems.push(`unhandled rejection: ${err?.message ?? err}`));

// 1. Boot -------------------------------------------------------------------------------------------------------------
log(typeof app.createLiveWorld === 'function' && typeof app.startGame === 'function', 'play/app.mjs imports in node');
log(PAGE_TITLE === 'GHT', 'page title is GHT');
log(toasterMode(new URLSearchParams('')) === true, 'default page is GHT');
log(toasterMode(new URLSearchParams('classic=1')) === false, '?classic=1 keeps the old page');

// 2. Match ------------------------------------------------------------------------------------------------------------
const maxTicks = MATCH_SECONDS * TPS;
const driver = createLiveMatch({
  seed: SEED, human: 0, ai: easyBot, createState: createToasterState, tps: TPS, maxTicks,
  difficulty: 'easy', aiStartTick: 0,
});
let humanRejects = 0;
let refereeErrors = 0;
let ended = null;
let helperFailure = null;
driver.on('tick', ({ events, tick }) => {
  for (const ev of events ?? []) {
    if (ev.e === 'reject' && ev.player === 0) humanRejects++;
  }
  if (tick % CHECK_EVERY === 0 && !helperFailure) {
    try {
      const state = driver.state;
      const top = toasterTopBar(state, {});
      if (typeof top !== 'string' || !top.includes('res')) throw new Error('top bar gave no resource row');
      toasterPanel(state, 0);
      observeToaster(state, 0);
      observeToaster(state, 1);
    } catch (err) {
      helperFailure = `tick ${tick}: ${err?.message ?? err}`;
    }
  }
});
driver.on('error', () => { refereeErrors++; });
driver.on('end', (result) => { ended = result ?? 'ended'; });

await driver.ready();
for (let i = 0; i < maxTicks && !driver.state.result; i++) await driver.tick();
const ticks = driver.clock.ticks;

log(ticks >= maxTicks - 1, `match ran ${MATCH_SECONDS} s (${ticks} of ${maxTicks} ticks)`);
const early = driver.state.result && driver.state.result.reason !== 'timeout';
log(!early, `match did not end early (result: ${driver.state.result ? driver.state.result.reason : 'none'})`);
log(!helperFailure, `play helpers ran every 10 s${helperFailure ? ' — ' + helperFailure : ''}`);
log(humanRejects === 0, `no rejected commands for the human side (${humanRejects})`);
log(refereeErrors === 0 && driver.clock.errors === 0, `no referee errors (${driver.clock.errors ?? 0} from the bot)`);
log(consoleProblems.length === 0, `no console errors or warnings${consoleProblems.length ? ': ' + consoleProblems.slice(0, 3).join(' | ') : ''}`);

driver.stop?.();
if (ended) console.log(`note: driver ended with ${JSON.stringify(ended).slice(0, 200)}`);

console.log(failures.length ? `\n${failures.length} check(s) red` : '\nall smoke checks green');
process.exit(failures.length ? 1 : 0);
