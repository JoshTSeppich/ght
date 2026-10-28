import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, loadMapV4, reachLayoutV4, isTerritoryMap } from '../env/map.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { enableEnergy, siteAt } from '../env/energy.mjs';
import { doPlaceCord, stepPower, POWER, stationsOf } from '../env/power.mjs';
import { step } from '../env/sim.mjs';
import { findEntity } from '../env/state.mjs';
import { rowOf, secondsToTicks } from '../env/stats.mjs';
import { startPush, stepRocks } from '../env/rocks.mjs';
import { LADDER, watchtowerSources } from './layout-ladder.mjs';

// Independent four-neighbour distances: rocks and wheat block movement, just as on /play.
function distances(m, from, cleared = []) {
  const solid = new Set([...m.rocks.map(p => p.join(',')), ...m.crystals.map(p => `${p.x},${p.y}`)]);
  for (const p of cleared) solid.delete(p.join(','));
  const d = new Int32Array(m.width * m.height).fill(-1), q = [from];
  d[from.y * m.width + from.x] = 0;
  for (let head = 0; head < q.length; head++) {
    const p = q[head];
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x = p.x + dx, y = p.y + dy, i = y * m.width + x;
      if (x < 0 || y < 0 || x >= m.width || y >= m.height || solid.has(`${x},${y}`) || d[i] >= 0) continue;
      d[i] = d[p.y * m.width + p.x] + 1; q.push({x,y});
    }
  }
  return d;
}

test('ladder loads through both public map APIs, starts a real match, and returns isolated copies', () => {
  assert.ok(isTerritoryMap('ladder'));
  const m = generateMap(42, {map:'ladder'});
  assert.equal(m.width, 132); assert.equal(m.height, 148);
  assert.equal(loadMapV4('ladder').size, 'ladder');
  const s = createTerritoryMatch(42, {map:'ladder'});
  assert.equal(s.structures.filter(p => p.kind === 'core').length, 2);
  assert.equal(s.territory.reaches.length, 9);
  m.rocks.push([20,18]); m.extras.bases[0].natural.x = -1;
  assert.ok(!generateMap(42,{map:'ladder'}).rocks.some(([x,y]) => x === 20 && y === 18));
  assert.ok(generateMap(42,{map:'ladder'}).extras.bases[0].natural.x > 0);
});

test('both sides have a reachable natural within 25 tiles, a third, and equal 35–45 second rush paths', () => {
  for (const seed of [1,7,42]) {
    const m = generateMap(seed,{map:'ladder'}), layout = reachLayoutV4('ladder');
    for (let side = 0; side < 2; side++) {
      const core = m.cores[side], d = distances(m,core);
      for (const role of ['main','natural','third']) assert.ok(layout.reaches.some(r => r.side === side && r.role === role));
      const n = layout.reaches.find(r => r.side === side && r.role === 'natural').claimSpot;
      assert.ok(Math.max(Math.abs(core.x-n.x),Math.abs(core.y-n.y)) <= 25);
      assert.ok(d[n.y*m.width+n.x] > 0);
      const enemy = m.cores[1-side];
      const seconds = (d[enemy.y*m.width+enemy.x]-1) * rowOf(createTerritoryMatch(seed,{map:'ladder'}),'grunt').speed / secondsToTicks(1);
      assert.ok(seconds >= 35 && seconds <= 45, `seed ${seed}, side ${side}: ${seconds}s`);
    }
    const rock = new Set(m.rocks.map(p => p.join(',')));
    for (const [x,y] of m.rocks) assert.ok(rock.has(`${131-x},${147-y}`));
    for (const c of m.crystals) assert.ok(m.crystals.some(q => q.x === 131-c.x && q.y === 147-c.y && q.amount === c.amount));
  }
});

test('all eight sockets are usable energy pads, with two neutral watchtowers and local water', () => {
  const m = generateMap(1,{map:'ladder'}), s = createTerritoryMatch(1,{map:'ladder'});
  enableEnergy(s);
  assert.equal(m.sockets.length,8); assert.equal(s.energy.sites.length,8);
  for (const [x,y] of m.sockets) {
    assert.ok(siteAt(s,'windmill',x,y));
    assert.ok(!s.rockSet.has(`${x},${y}`));
    assert.ok(!s.crystals.some(p => p.x === x && p.y === y));
  }
  assert.equal(m.watchtowers.length,2);
  for (const c of m.cores) assert.ok(m.water.some(([x,y]) => Math.max(Math.abs(c.x-x),Math.abs(c.y-y)) <= 12));
});

test('gold cannot be mined until its rock entrance is cleared, and the entrance can actually be pushed', () => {
  const m = generateMap(1,{map:'ladder'});
  for (const pocket of m.extras.gold) {
    const d = distances(m,m.cores[0]);
    assert.equal(d[pocket.mining.y*m.width+pocket.mining.x],-1);
    const open = distances(m,m.cores[0],[pocket.entrance]);
    assert.ok(open[pocket.mining.y*m.width+pocket.mining.x] > 0);
    const s = createTerritoryMatch(1,{map:'ladder'}), w = s.units[0];
    w.x = pocket.stand[0]; w.y = pocket.stand[1]; w.order = null;
    assert.equal(startPush(s,0,{unit:w.id,x:pocket.entrance[0],y:pocket.entrance[1]}),null);
    for (let i = 0; i < 40; i++) stepRocks(s);
    assert.ok(!s.rockSet.has(pocket.entrance.join(',')));
  }
});

test('a Crumb connects the natural with a paid Outlet and one extension on either side', () => {
  for (const side of [0,1]) {
    const s = createTerritoryMatch(1,{map:'ladder'}), bases = generateMap(1,{map:'ladder'}).extras.bases;
    s.shards[side] = 500;
    const w = s.units.find(p => p.owner === side), route = bases[side].cord;
    for (const p of route) {
      w.x = p.x; w.y = p.y+1; stepPower(s);
      assert.equal(doPlaceCord(s,side,{unit:w.id,kind:p.kind,x:p.x,y:p.y}),null);
    }
    stepPower(s);
    const out = s.power.view.points.find(p => p.owner === side && p.kind === 'outlet');
    assert.deepEqual([out.x,out.y],[bases[side].natural.x,bases[side].natural.y]);
    assert.equal(s.shards[side],500-POWER.cost.extension-POWER.cost.outlet);
    assert.ok(s.power.view.netOf.get(out.id).lit);
    assert.equal(stationsOf(s).find(p => p.id === out.id).kind,'outlet');
  }
});

test('Outlet construction uses the live command path, trains Crumbs and accepts nearby Wheat', () => {
  const s = createTerritoryMatch(5,{map:'ladder'}), w = s.units.find(u => u.owner===0);
  s.noTiers=true; s.power.wrap=true; s.shards[0]=500;
  // Walk, rather than teleport, through the cord chain with all normal refusal checks on.
  for (const p of generateMap(5,{map:'ladder'}).extras.bases[0].cord) {
    let ev=step(s,[[{type:'move',unit:w.id,x:p.x,y:p.y+1}],[]]);
    assert.deepEqual(ev.filter(e=>e.e==='reject'),[]);
    for(let i=0;i<120 && w.order;i++) step(s,[[],[]]);
    assert.deepEqual([w.x,w.y],[p.x,p.y+1]);
    ev=step(s,[[{type:'place-power',unit:w.id,kind:p.kind,x:p.x,y:p.y}],[]]);
    assert.deepEqual(ev.filter(e=>e.e==='reject'),[]);
  }
  const base=s.structures.find(p=>p.powerKind==='outlet');
  assert.equal(findEntity(s,base.id),base); // It is attackable and counts as a real building.
  assert.equal(base.queue.length,0);
  const count=s.units.filter(p=>p.owner===0).length;
  const ev=step(s,[[{type:'train',building:base.id,kind:'worker'}],[]]);
  assert.deepEqual(ev.filter(e=>e.e==='reject'),[]);
  for(let i=0;i<150;i++) step(s,[[],[]]);
  assert.equal(s.units.filter(p=>p.owner===0).length,count+1);
  const crumb=s.units.find(p=>p.owner===0 && p.id>base.id);
  // Start beside this base carrying a mined load, using the normal gathering phase.
  crumb.x=base.x+1; crumb.y=base.y; crumb.carrying=5;
  crumb.order={type:'gather',phase:'toCore',x:44,y:22};
  const bank=s.shards[0];
  step(s,[[],[]]);
  assert.equal(crumb.carrying,0);
  assert.ok(s.shards[0]>=bank+5);
  base.hp=0; stepPower(s);
  assert.ok(!s.power.view.points.some(p=>p.id===base.id),'destroyed Outlet no longer anchors a cord');
});

test('an Outlet refuses poor, distant and enemy builders without charging Wheat', () => {
  const s=createTerritoryMatch(1,{map:'ladder'}), w=s.units[0];
  w.x=24; w.y=19; stepPower(s);
  const cmd={unit:w.id,kind:'outlet',x:24,y:18};
  s.shards[0]=POWER.cost.outlet-1;
  assert.equal(doPlaceCord(s,0,cmd),'no-shards');
  assert.equal(s.shards[0],POWER.cost.outlet-1);
  s.shards[0]=500;
  assert.equal(doPlaceCord(s,1,cmd),'not-yours');
  assert.equal(doPlaceCord(s,0,{...cmd,x:40}),'too-far');
  assert.equal(s.shards[0],500);
  assert.equal(doPlaceCord(s,0,cmd),null);
  const bank=s.shards[0];
  assert.equal(doPlaceCord(s,0,cmd),'bad-target');
  assert.equal(s.shards[0],bank);
});

test('watchtowers give sight only to a nearby uncontested ground occupant', () => {
  const m = generateMap(1,{map:'ladder'}), t = m.watchtowers[0];
  const s = { units:[], watchtowers:m.watchtowers };
  assert.deepEqual(watchtowerSources(s,0),[]);
  s.units = [{owner:0,kind:'worker',x:t.x,y:t.y,hp:10}];
  assert.equal(watchtowerSources(s,0)[0].sight,12);
  assert.deepEqual(watchtowerSources(s,1),[]);
  s.units.push({owner:1,kind:'grunt',x:t.x+1,y:t.y,hp:10});
  assert.deepEqual(watchtowerSources(s,0),[]);
  s.units[1].layer = 'air';
  assert.equal(watchtowerSources(s,0).length,1);
  assert.equal(LADDER.name,'ladder');
});
