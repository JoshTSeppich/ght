// Logs recorded before the GHT rename say format 'driftfall-log'. New logs are 'ght-log'; every reader takes both.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOG_FORMAT, LEGACY_LOG_FORMATS, isLogFormat, createLog, validateLog } from '../env/log.mjs';
import { problemWith } from '../viewer/live.mjs';

const SAMPLE = JSON.parse(fs.readFileSync(new URL('../matches/sample-7.json', import.meta.url), 'utf8'));
const formatProblem = (log) => validateLog(log).filter((p) => /format/.test(p));

test('new logs are written as ght-log', () => {
  assert.equal(LOG_FORMAT, 'ght-log');
  assert.equal(createLog({ seed: 1, players: ['a', 'b'], stats: {}, initial: {} }).format, 'ght-log');
});

test('ght-log and the legacy driftfall-log are both log formats, nothing else is', () => {
  assert.deepEqual(LEGACY_LOG_FORMATS, ['driftfall-log']);
  for (const f of ['ght-log', 'driftfall-log']) assert.ok(isLogFormat(f), f);
  for (const f of [undefined, null, '', 'log', 'GHT-log', 'toaster-log']) assert.ok(!isLogFormat(f), String(f));
});

test('a recorded legacy log (matches/sample-7.json) still passes the format checks', () => {
  assert.equal(SAMPLE.format, 'driftfall-log', 'the sample predates the rename');
  assert.deepEqual(formatProblem(SAMPLE), []);
  assert.equal(problemWith(SAMPLE), null, 'the TV match screen plays it');
  assert.deepEqual(formatProblem({ ...SAMPLE, format: 'other' }), ['The format must be "ght-log".']);
});
