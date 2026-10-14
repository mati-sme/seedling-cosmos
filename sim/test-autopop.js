#!/usr/bin/env node
/* Seedling Cosmos - auto-pop / hammer fairness tests. Run: node sim/test-autopop.js
 * Checks: (1) auto-pops and hammer hits build combo + score exactly like taps (one shared hit path),
 * (2) manual taps still work while auto-pop / hammer / gravity well are active and nothing is claimed ahead of a tap,
 * (3) no spores exist anywhere (spawning, data, source), (4) the Hammer branch is wired into the Garden map. */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/data.js');
const C = require('../js/core.js');
const { rngFrom } = require('./bot.js');

let pass = 0, fail = 0;
function ok(cond, name, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); } }
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// a quiet run: no random spawns, stats overridable, crits off so scores are comparable
function quiet(over, seed) {
  const S = C.newState();
  const run = C.createRun(S, 0, rngFrom(seed || 7), 1.45, true);
  run.st = Object.assign({}, run.st, { crit: 0, hmCrit: 0, hmDouble: 0, auto: 0, hmRate: 0 }, over || {});
  run.spawnAcc = -1e9;
  return run;
}
function put(run, kind, x, y, hp) {
  const t = { id: run.nid++, kind, r: D.BAL.RADIUS, x, y, vx: 0, vy: 0, age: 1, life: 9, max: 9, hp: hp || 1, hp0: hp || 1 };
  if (kind === 'pod') t.r *= 1.55;
  run.targets.push(t); return t;
}
const step = (run, secs) => { for (let i = 0; i < Math.round(secs * 60); i++) C.stepRun(run, 1 / 60); };
const hits = (run) => run.ev.filter((e) => e.type === 'hit');

console.log('1. auto-pop and hammer count exactly like a tap');
const tapRun = quiet(); put(tapRun, 'mote', 0.5, 0.5); C.tapRun(tapRun, 0.5, 0.5);
const autoRun = quiet({ auto: 200 }); put(autoRun, 'mote', 0.5, 0.5); step(autoRun, 0.05);
const hamRun = quiet({ hmRate: 200 }); put(hamRun, 'mote', 0.5, 0.5); step(hamRun, 0.4);
const magRun = quiet(); magRun.fx.magnet = 5; put(magRun, 'mote', 0.5, 0.5 * 1.45); step(magRun, 0.2);
[['sprite auto-pop', autoRun, 'sprite'], ['hammer', hamRun, 'hammer'], ['gravity well', magRun, 'magnet']].forEach(([n, r, via]) => {
  ok(hits(r).length === 1 && hits(r)[0].via === via, n + ' popped the target via ' + via);
  ok(r.combo === tapRun.combo && r.combo > 0, n + ' adds to combo (' + r.combo + ' == tap ' + tapRun.combo + ')');
  ok(near(r.earned, tapRun.earned) && r.earned > 0, n + ' scores the same as a tap (' + r.earned.toFixed(4) + ' vs ' + tapRun.earned.toFixed(4) + ')');
  ok(r.comboT > 0 && r.maxCombo === tapRun.maxCombo, n + ' refreshes the combo timer and best combo');
  ok(r.hits === 1 && r.pops === 1, n + ' counted as a hit');
});
// chained combo: the multiplier from auto/hammer hits feeds the next hit just like taps would
const chain = quiet({ auto: 200 }); for (let i = 0; i < 6; i++) put(chain, 'mote', 0.1 + i * 0.15, 0.3);
step(chain, 0.2);
ok(chain.combo === 6 && chain.targets.length === 0, 'six auto-pops build a combo of 6', 'combo=' + chain.combo);
const chainTap = quiet(); for (let i = 0; i < 6; i++) put(chainTap, 'mote', 0.1 + i * 0.15, 0.3); for (let i = 0; i < 6; i++) C.tapRun(chainTap, 0.1 + i * 0.15, 0.3);
ok(near(chain.earned, chainTap.earned), 'six auto-pops score the same as six taps (combo multiplier applies)');
// crits roll for auto and hammer hits too
const cr = quiet({ auto: 200, crit: 1 }); put(cr, 'mote', 0.5, 0.5); step(cr, 0.05);
ok(cr.crits === 1 && hits(cr)[0].crit, 'auto-pops can crit like taps');
// nova counts toward combo as well
const nv = quiet(); for (let i = 0; i < 4; i++) put(nv, 'gold', 0.2 + i * 0.2, 0.4); nv.st.ab = { nova: true }; nv.cd.nova = 0; C.useAbility(nv, 'nova');
ok(nv.combo === 8 && nv.hits === 4, 'nova pops build combo too', 'combo=' + nv.combo);

console.log('2. hammer damage, range and double strike');
const pod = quiet({ hmRate: 200, hmPow: 4 }); put(pod, 'pod', 0.5, 0.5, 4); step(pod, 0.4);
ok(pod.targets.length === 0 && pod.combo === 3, 'power 4 breaks a 4-hit pod in one strike', 'left=' + pod.targets.length);
const pod1 = quiet({ hmPow: 1 }); put(pod1, 'pod', 0.5, 0.5, 4); run_swing(pod1, 0.5, 0.5); step(pod1, 0.2); const hp1 = pod1.targets[0] ? pod1.targets[0].hp : 0;
ok(hp1 > 0 && hp1 < 4 && pod1.combo >= 1, 'power 1 only chips a pod (and still builds combo)', 'hp=' + hp1);
const wide = quiet({ hmRate: 0, hmRange: 0.2 }); const a = put(wide, 'mote', 0.5, 0.5), b = put(wide, 'mote', 0.6, 0.5), c = put(wide, 'mote', 0.9, 0.9);
run_swing(wide, 0.5, 0.5); step(wide, 0.3);
ok(!wide.targets.includes(a) && !wide.targets.includes(b) && wide.targets.includes(c) && wide.hammerHits === 2, 'range splash hits neighbours only', 'left=' + wide.targets.length);
const dbl = quiet({ hmRate: 0, hmDouble: 1 }); const d1 = put(dbl, 'pod', 0.5, 0.5, 4); run_swing(dbl, 0.5, 0.5); step(dbl, 0.5);
ok(dbl.hammerHits === 2 && !dbl.targets.includes(d1) || (d1.hp <= 2 && dbl.hammerHits >= 2), 'double strike lands twice', 'hits=' + dbl.hammerHits);
const hc = quiet({ hmRate: 200, hmCrit: 1 }); put(hc, 'mote', 0.5, 0.5); step(hc, 0.4);
ok(hc.crits === 1, 'hammer crit chance applies');
function run_swing(run, x, y) { run.swings.push({ x, y, t: D.BAL.HM_WIND, double: false }); }

console.log('3. manual taps are never blocked');
// a swing in the air does not claim its target: tapping first works, and the swing then whiffs without hurting the combo
const race = quiet({ hmRate: 0 }); const rt = put(race, 'mote', 0.5, 0.5); run_swing(race, 0.5, 0.5);
const got = C.tapRun(race, 0.5, 0.5);
ok(got === rt && race.combo === 1, 'tap pops a target the hammer is already aiming at');
step(race, 0.3);
ok(race.combo === 1 && race.misses === 0, 'the swing that lands on empty ground costs nothing', 'combo=' + race.combo + ' misses=' + race.misses);
// tapping where an auto-pop just removed a target is not a miss
const late = quiet({ auto: 200 }); put(late, 'mote', 0.5, 0.5); put(late, 'mote', 0.3, 0.3); step(late, 0.03); const left = late.targets.length;
const before = late.combo; late.ev.length = 0;
C.tapRun(late, 0.5, 0.5); C.tapRun(late, 0.3, 0.3);
ok(late.misses === 0 && late.combo === before, 'a tap just after an auto-pop is forgiven (no miss, no combo loss)', 'misses=' + late.misses);
// a real miss still hurts, once the grace is over
late.recent.length = 0; late.combo = 10; C.tapRun(late, 0.9, 1.3);
ok(late.misses === 1 && late.combo === 5, 'real misses still cost combo');
// full chaos: sprites + hammer + gravity well all running, a tapper hits every live target it sees
const chaos = C.createRun(C.newState(), 0, rngFrom(99), 1.45, true);
chaos.st = Object.assign({}, chaos.st, { auto: 0.4, hmRate: 1.5, hmRange: 0.08, hmPow: 2, hmDouble: 0.3, crit: 0.2, spawn: 6 }); chaos.fx.magnet = 1e9;
let tapped = 0, tapMisses = 0, aliveSeen = 0;
for (let i = 0; i < 60 * 40 && !chaos.over; i++) {
  C.stepRun(chaos, 1 / 60);
  if (i % 30 === 0 && chaos.targets.length) { // 2 taps/sec on a target that is alive right now
    const t = chaos.targets[0]; aliveSeen++;
    const before2 = chaos.misses; if (C.tapRun(chaos, t.x, t.y)) tapped++; else tapMisses += chaos.misses - before2;
  }
}
ok(aliveSeen > 10 && tapped === aliveSeen && tapMisses === 0, 'every tap on a live target lands while sprites + hammer + gravity well run (' + tapped + '/' + aliveSeen + ')');
ok(chaos.autoHits > 0 && chaos.hammerHits > 0 && chaos.maxCombo > 10, 'auto/hammer hits and taps share one combo (best combo ' + chaos.maxCombo + ')');
const total = chaos.ev.filter((e) => e.type === 'hit').length;
ok(chaos.ev.some((e) => e.type === 'hit' && e.via === 'tap') && chaos.ev.some((e) => e.type === 'hit' && e.via === 'hammer'), 'taps and hammer both pop targets in the same run (' + total + ' pops)');
// the engine never marks a target as claimed/disabled
ok(chaos.targets.every((t) => !('claimed' in t) && !('locked' in t)), 'no target is ever claimed or disabled');
// run-screen overlays: nothing but the canvas takes pointer input
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(/#run-banner[^}]*pointer-events:\s*none/.test(css), 'banner overlay ignores pointer input');
ok(!/id="run-(fx|overlay|auto|hammer)/.test(html), 'no extra full-screen run overlay in index.html');

console.log('4. no spores');
let kinds = {}; const sr = rngFrom(5);
for (let z = 0; z < D.ZONES.length; z++) {
  const S = C.newState(); S.nodes = {}; const run = C.createRun(S, z, sr, 1.45, false);
  run.st = Object.assign({}, run.st, { cometC: 0.1, podC: 0.1, orbC: 0.1 });
  for (let i = 0; i < 4000; i++) { run.targets.length = 0; run.spawnAcc = 1; run.left = 1e9; C.stepRun(run, 0.0001); run.targets.forEach((t) => { kinds[t.kind] = (kinds[t.kind] || 0) + 1; }); }
}
ok(Object.keys(kinds).length >= 4 && !('spore' in kinds), 'spawn kinds across all zones: ' + Object.keys(kinds).join(', '));
const files = ['js/core.js', 'js/data.js', 'js/game.js', 'js/ui.js', 'js/fx.js', 'js/map.js', 'index.html', 'style.css', 'README.md', 'sim/bot.js', 'tools/calibrate.js'];
const bad = files.filter((f) => /spore/i.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8')));
ok(bad.length === 0, 'no "spore" left in source/docs', bad.join(','));
ok(Object.keys(D.STATS).every((k) => !/spore/i.test(k)) && D.ZONES.every((z) => !('spore' in z)), 'no spore stats or zone fields');

console.log('5. hammer branch is connected and purchasable');
const hn = D.MAIN.nodes.filter((n) => n.branch === 'H');
ok(hn.length >= 6 && hn[0].fx.s === 'hm', 'Hammer branch has ' + hn.length + ' nodes starting with the unlock');
['main', 'mem', 'core'].forEach((k) => { // every node reachable from the seed
  const seen = { seed: 1 }; let grew = true;
  while (grew) { grew = false; D.MAPS[k].nodes.forEach((n) => { if (!seen[n.id] && n.parents.some((p) => seen[p])) { seen[n.id] = 1; grew = true; } }); }
  ok(D.MAPS[k].nodes.every((n) => seen[n.id]), k + ' map is fully connected');
});
const S = C.newState(); ok(C.stats(S).hmRate === 0, 'hammer is off before the unlock');
S.stardust = 1e12; ok(C.buy(S, 'main', 'h1') && C.stats(S).hmRate === D.BAL.HM_RATE, 'unlock gives the base rate ' + D.BAL.HM_RATE + '/s');
C.buy(S, 'main', 'h2'); C.buy(S, 'main', 'h3'); C.buy(S, 'main', 'h4'); C.buy(S, 'main', 'h5'); C.buy(S, 'main', 'h6');
const st = C.stats(S); ok(st.hmRate > D.BAL.HM_RATE && st.hmPow > 1 && st.hmRange > D.BAL.HM_RANGE && st.hmDouble > 0 && st.hmCrit > 0, 'speed/power/range/double/crit upgrades all apply');
const sv = C.parse(C.serialize(S)); ok(sv && sv.nodes.h1 === 1, 'hammer purchase survives save/load');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
