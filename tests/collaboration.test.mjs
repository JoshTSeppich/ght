// Bridge contracts stay in the existing npm test / CI path. Python uses only stdlib.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../tools/collaboration/tests/timeline.test.mjs';
test('local collaboration transport, isolation, binary integrity and revision contracts',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const r=spawnSync('python3',['-m','unittest','discover','-s','tools/collaboration/tests','-v'],{cwd:root,encoding:'utf8'});
  assert.equal(r.status,0,r.error?.message || r.stdout+'\n'+r.stderr);
});
