import test from 'node:test';
import assert from 'node:assert/strict';
import { frameAt, totalDuration, stepFrame } from '../web/timeline.mjs';
test('variable frame durations, exact boundaries and loop wrap',()=>{
  const frames=[{duration_ms:50},{duration_ms:200},{duration_ms:100}];
  assert.equal(totalDuration(frames),350);
  assert.equal(frameAt(frames,49),0);assert.equal(frameAt(frames,50),1);
  assert.equal(frameAt(frames,249),1);assert.equal(frameAt(frames,250),2);
  assert.equal(frameAt(frames,350),0);assert.equal(frameAt(frames,-1),2);
});
test('stepping wraps both ways, including empty tracks',()=>{
  assert.equal(stepFrame(0,-1,8),7);assert.equal(stepFrame(7,1,8),0);assert.equal(stepFrame(0,1,0),0);
});
