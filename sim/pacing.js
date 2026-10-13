#!/usr/bin/env node
/* Seedling Cosmos - pacing simulation.
 * Simulates a reasonable player and prints time-to-milestone.
 * Usage: node sim/pacing.js [--quiet] [--days=N]
 * Overrides for experiments: --set=KNOB=value  --zone=index:threshold
 *
 * Player model (wall-clock time):
 *   - first 2 hours: continuously active, tapping 4x/s and shopping every second
 *   - afterwards: four 12-minute sessions per day (offsets 6h, 12h, 17h, 21h from the start of each day-cycle),
 *     tapping 4x/s; in between the game is closed and only capped, reduced-efficiency offline progress applies
 *   - shopping: lowest payback-time purchase first (tap/helper/upgrade), cheap resource buys when affordable
 *   - prestige: Rebloom when the gain is >= max(1, 50% of Seeds earned this cycle); Supernova when gain >= max(1, 50% of Cores)
 *     and the prestige trees are spent cheapest-first following a sensible priority order
 */
'use strict';
const C = require('../js/core.js');
const D = C.D;

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const maxDays = +((argv.find((a) => a.startsWith('--days=')) || '--days=200').split('=')[1]);

// Experiment overrides: --set=SN_K=5 (balance knob), --zone=7:1e34 (zone threshold)
argv.forEach((a) => {
  if (a.startsWith('--set=')) { const [k, v] = a.slice(6).split('='); D.T[k] = +v; }
  if (a.startsWith('--zone=')) { const [i, v] = a.slice(7).split(':'); D.ZONES[+i].thr = +v; }
});

const TAPS = 4, DT = 0.5, INIT = 2 * 3600, DAY = 86400, SESS_LEN = 12 * 60;
const SESS = [6, 12, 17, 21].map((h) => h * 3600);

const s = C.newState();
let t = 0;
const R = { zones: {}, firstHelper: null, firstUpgrade: null, firstRebloom: null, firstSupernova: null, complete: null };
const unlocks = []; // times of "something new" events
const reblooms = [], supernovas = [];
const seenGen = {};

function fmtT(sec) {
  if (sec === null || sec === undefined) return 'never';
  sec = Math.round(sec);
  if (sec < 60) return sec + 's';
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  if (d) return d + 'd ' + h + 'h ' + m + 'm';
  if (h) return h + 'h ' + m + 'm';
  return m + 'm ' + (sec % 60) + 's';
}

function income() {
  const m = s._m;
  return C.rates(s).sd + (TAPS + m.autoTap) * C.tapValue(s) * (1 + m.crit * (m.critMul - 1));
}

function note(ev) {
  for (const e of ev) {
    if (e.type === 'zone') { R.zones[e.z] = t; unlocks.push(t); if (e.z === D.ZONES.length - 1) R.complete = t; }
    else if (e.type === 'ms' || e.type === 'ach') unlocks.push(t);
    else if (e.type === 'rebloom') reblooms.push(t);
    else if (e.type === 'supernova') supernovas.push(t);
  }
}

function afterBuy() {
  if (R.firstHelper === null && C.totalGens(s) > 0) { R.firstHelper = t; unlocks.push(t); }
  if (R.firstUpgrade === null && s.life.upsb > 0) R.firstUpgrade = t;
  for (const id in s.gens) if (!seenGen[id]) { seenGen[id] = 1; unlocks.push(t); }
}

// ----- shopping -----
function shop() {
  for (let guard = 0; guard < 60; guard++) {
    let bought = false;
    // non-stardust upgrades and resource helpers: buy whenever cheap relative to the stock
    const ups = C.visibleUps(s);
    for (const u of ups) {
      if (u.res !== 'sd' && s.res[u.res] >= u.cost) { C.buyUp(s, u.id); bought = true; unlocks.push(t); }
    }
    for (const g of D.GENS) {
      if (g.makes === 'sd' || !C.genVisible(s, g)) continue;
      const budget = s.res[g.costRes] * (g.costRes === 'sd' ? 0.05 : 0.4);
      if (C.genMax(s, g, budget) >= 1) { C.buyGen(s, g.id, 1); bought = true; }
    }
    // stardust purchases: best payback time (cost / income gained)
    const base = income();
    let best = null, bestPb = Infinity;
    for (const g of D.SD_GENS) {
      if (!C.genVisible(s, g)) continue;
      const cost = C.genCost(s, g, 1);
      s.gens[g.id] = (s.gens[g.id] || 0) + 1; C.recalc(s);
      const d = income() - base;
      s.gens[g.id]--; if (!s.gens[g.id]) delete s.gens[g.id];
      C.recalc(s);
      const pb = cost / Math.max(d, 1e-300);
      if (d > 0 && pb < bestPb) { bestPb = pb; best = { gen: g.id, cost }; }
    }
    for (const u of ups) {
      if (u.res !== 'sd') continue;
      s.ups[u.id] = true; C.recalc(s);
      const d = income() - base;
      delete s.ups[u.id]; C.recalc(s);
      const pb = u.cost / Math.max(d, 1e-300);
      if (d > 0 && pb < bestPb) { bestPb = pb; best = { up: u.id, cost: u.cost }; }
      else if (d <= 0 && (u.fx.autoGens || u.fx.autoRes || u.fx.offEff) && (!best || u.cost <= best.cost * 3)) {
        // automation / offline perks have no direct income: buy when roughly as cheap as the best income purchase
        best = { up: u.id, cost: u.cost }; bestPb = 0;
      }
    }
    if (best && s.res.sd >= best.cost) {
      if (best.gen) C.buyGen(s, best.gen, 1); else { C.buyUp(s, best.up); unlocks.push(t); }
      bought = true;
    }
    if (!bought) break;
  }
  afterBuy();
}

// ----- prestige -----
const MEM_PRI = ['mdust', 'mgen', 'mgain', 'mtap', 'mstart', 'mautoup', 'mauto', 'mcost', 'mres', 'moffc', 'moffe', 'mtapsps', 'mcrit', 'mautore'];
const CORE_PRI = ['cdust', 'cmem', 'cgen', 'cres', 'cstartmem', 'croots', 'cgainc', 'ctap', 'ccost', 'coff', 'coffe', 'cmuse', 'cautosn'];
function spend(byId, pri, curKey, buyFn, levels) {
  for (let guard = 0; guard < 500; guard++) {
    let pick = null, pc = Infinity;
    for (const id of pri) {
      const n = byId[id], l = levels[id] || 0;
      if (l >= n.max) continue;
      const c = C.treeCost(n, l);
      if (c <= s[curKey] && c < pc) { pc = c; pick = id; }
    }
    if (!pick || !buyFn(s, pick)) return;
  }
}
const byMem = {}, byCore = {};
D.MEM_TREE.forEach((n) => { byMem[n.id] = n; });
D.CORE_TREE.forEach((n) => { byCore[n.id] = n; });
function prestige() {
  const sg = C.supernovaGain(s);
  if (sg >= 1 && sg >= Math.max(1, 0.5 * s.life.coreAll)) {
    if (C.supernova(s)) { supernovas.push(t); if (R.firstSupernova === null) R.firstSupernova = t; unlocks.push(t); }
  } else {
    const g = C.rebloomGain(s);
    // keep pushing the current run while a brand-new zone is within reach (3 orders of magnitude)
    const nz = D.ZONES[s.life.bestZone + 1];
    const pushing = nz && s.run.sd * 1e3 >= nz.thr && s.run.time < 12 * 3600;
    if (g >= 1 && !pushing && g >= Math.max(1, 0.5 * s.memAll)) {
      if (C.rebloom(s)) { reblooms.push(t); if (R.firstRebloom === null) R.firstRebloom = t; unlocks.push(t); }
    }
  }
  spend(byCore, CORE_PRI, 'cores', C.buyCore, s.coreUp);
  spend(byMem, MEM_PRI, 'mem', C.buyMem, s.memUp);
}

// ----- schedule -----
function nextStart(tt) {
  if (tt < INIT) return tt;
  const base = Math.floor((tt - INIT) / DAY) * DAY + INIT;
  for (let d = 0; d < 3; d++) for (const o of SESS) { const st = base + d * DAY + o; if (st > tt) return st; }
  return tt;
}
function inWindow(tt) {
  if (tt < INIT) return true;
  const p = (tt - INIT) % DAY;
  return SESS.some((o) => p >= o && p < o + SESS_LEN);
}

// ----- daily log -----
const daily = [];
let nextLog = DAY, bestRun = 0;
function logDaily() {
  while (t >= nextLog) {
    daily.push(`day ${String(Math.round(nextLog / DAY)).padStart(3)}: zone ${s.life.bestZone} (${D.ZONES[s.life.bestZone].name}), reblooms ${s.life.reblooms}, seeds(cycle) ${C.fmt(s.memAll)}, supernovas ${s.life.supernovas}, cores ${C.fmt(s.life.coreAll)}, run zone ${s.zone}, sd/s ${C.fmt(C.rates(s).sd)}, best run sd ${C.fmt(bestRun)}`);
    nextLog += DAY;
  }
}

// ----- main loop -----
let tickN = 0;
const wall0 = Date.now();
const END = maxDays * DAY;
while (t < END && R.complete === null) {
  if (!inWindow(t)) {
    const tn = nextStart(t);
    const off = C.offline(s, tn - t);
    t = tn; note(off.events); afterBuy(); logDaily();
    continue;
  }
  C.tap(s, TAPS * DT);
  note(C.tick(s, DT));
  t += DT; tickN++;
  if (s.run.sd > bestRun) bestRun = s.run.sd;
  if (tickN % 2 === 0) { shop(); prestige(); }
  if (tickN % 2000 === 0) logDaily();
}
logDaily();

// ----- report -----
const out = [];
const P = (x) => out.push(x);
P('# Seedling Cosmos pacing simulation');
P('');
P('Simulated player: 2h continuous play, then 4 x 12 min sessions/day; offline cap/efficiency per in-game upgrades.');
P('Balance knobs: ' + JSON.stringify(D.T));
P('');
P('## Key milestones (simulated wall-clock time)');
P('- First helper bought:  ' + fmtT(R.firstHelper));
P('- First upgrade bought: ' + fmtT(R.firstUpgrade));
D.ZONES.forEach((z, i) => P('- Zone ' + i + ' ' + z.name.padEnd(15) + ' reached: ' + fmtT(i === 0 ? 0 : R.zones[i])));
P('- First Rebloom:        ' + fmtT(R.firstRebloom));
P('- First Supernova:      ' + fmtT(R.firstSupernova));
P('- Game completion (The Worldtree): ' + fmtT(R.complete) + (R.complete ? '  (' + (R.complete / DAY).toFixed(1) + ' days)' : ''));
P('');
P('Total reblooms: ' + reblooms.length + ', supernovas: ' + supernovas.length + ', achievements: ' + Object.keys(s.ach).length + '/' + D.ACH.length + ', upgrades bought (lifetime): ' + s.life.upsb);
P('First 10 reblooms at: ' + reblooms.slice(0, 10).map(fmtT).join(', '));
P('Supernovas at: ' + (supernovas.slice(0, 10).map(fmtT).join(', ') || 'none'));
// cadence of unlocks in first 30 min
const early = unlocks.filter((x) => x <= 1800).sort((a, b) => a - b);
let maxGap = 0, prev = 0;
early.forEach((x) => { maxGap = Math.max(maxGap, x - prev); prev = x; });
maxGap = Math.max(maxGap, 1800 - prev);
P('');
P('## First 30 minutes: ' + early.length + ' unlock events (zones, milestones, achievements, new helpers, upgrades); longest quiet gap ' + fmtT(maxGap));
const zoneTimes = Object.keys(R.zones).map((k) => R.zones[k]).filter((x) => x <= 1800).sort((a, b) => a - b);
P('Zone arrivals in first 30 min: ' + zoneTimes.map(fmtT).join(', '));
P('');
P('## Daily snapshots');
(QUIET ? daily.filter((_, i) => i % 3 === 0) : daily).forEach((l) => P(l));
P('');
P('(simulated ' + tickN + ' active ticks in ' + ((Date.now() - wall0) / 1000).toFixed(1) + 's of CPU time)');
console.log(out.join('\n'));
