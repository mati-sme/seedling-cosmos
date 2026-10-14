#!/usr/bin/env node
/* Seedling Cosmos v2 - pacing simulation.
 * Drives the REAL run engine (js/core.js) with a bot that taps like a reasonable human, plays N sessions per day,
 * spends everything greedily (cheapest affordable upgrade first) and prestiges with a sensible rule.
 *
 * Usage: node sim/pacing.js [--days=90] [--seed=1] [--quiet] [--quick] [--no-write]
 *        [--sessions=3] [--runs=4] [--taps=2.8] [--precision=0.88] [--set=KNOB=value ...]
 * Writes SIM_RESULTS.md at the repo root.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = require('../js/data.js');
const C = require('../js/core.js');

// ---------- args ----------
const args = {}; const sets = [];
process.argv.slice(2).forEach((a) => {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (!m) return;
  if (m[1] === 'set') sets.push(m[2]); else args[m[1]] = m[2] === undefined ? true : m[2];
});
sets.forEach((s) => { const [k, v] = s.split('='); if (!(k in D.BAL)) throw new Error('unknown knob ' + k); D.BAL[k] = JSON.parse(v); });
const DAYS = +args.days || 90;
const QUIET = !!args.quiet;

const { rngFrom, BASE_PLAYER_DEFAULTS, botRun, sessionTimes } = require('./bot.js');
const BASE_PLAYER = Object.assign({}, BASE_PLAYER_DEFAULTS, {
  sessions: +args.sessions || 3, runsPerSession: +args.runs || 4, tapsPerSec: +args.taps || BASE_PLAYER_DEFAULTS.tapsPerSec, precision: +args.precision || BASE_PLAYER_DEFAULTS.precision
});

// ---------- greedy shopping ----------
function shop(S, log, now) {
  let bought = 0, guard = 0;
  while (++guard < 400) {
    let best = null, bc = Infinity;
    for (const kind of ['mem', 'core', 'main']) {
      D.MAPS[kind].nodes.forEach((n) => {
        if (!C.canBuy(S, kind, n)) return;
        const key = (kind === 'main' ? 1 : 0) * 1e300 + C.nodeCost(S, kind, n); // prestige currencies can't be spent elsewhere
        if (key < bc) { bc = key; best = { kind, n }; }
      });
    }
    if (!best) break;
    const lvl = C.level(S, best.kind, best.n.id);
    C.buy(S, best.kind, best.n.id); bought++;
    log.purchases.push({ t: now, kind: best.kind, id: best.n.id, level: lvl + 1 });
  }
  return bought;
}

// ---------- prestige rules ----------
function maybePrestige(S, st, log, now) {
  if (args.noprestige) return false;
  const ng = C.novaGain(S);
  const coreDone = C.counts(S, 'core').maxed === D.CORE.nodes.length;
  if (ng >= 1 && !coreDone && now - st.lastNova > 2 * 86400) {
    const stalled = now - st.lastBuy > 4 * 86400;
    if (ng >= Math.max(2, 1.0 * S.cores) || stalled) {
      const seeds = S.seedsEra;
      C.supernova(S); log.novas.push({ t: now, gain: ng, seeds }); st.lastBuy = now; st.lastNova = now; st.lastPrestige = now; return true;
    }
  }
  const g = C.rebloomGain(S);
  if (g >= 1 && now - st.lastPrestige > 0.7 * 86400) {
    const stalled = now - st.lastBuy > 1.2 * 86400;
    const mainDone = C.counts(S, 'main').maxed === D.MAIN.nodes.length;
    const cheapest = D.MEM.nodes.reduce((m, n) => (C.nodeState(S, 'mem', n) === 'locked' || C.nodeState(S, 'mem', n) === 'maxed' ? m : Math.min(m, C.nodeCost(S, 'mem', n))), Infinity);
    const worthIt = cheapest === Infinity ? !coreDone : S.seeds + g >= cheapest; // never reset for Seeds that cannot buy anything (Seeds also feed Supernova)
    if (worthIt && (g >= Math.max(6, 1.0 * S.seedsEra) || stalled || mainDone)) {
      C.rebloom(S); log.reblooms.push({ t: now, gain: g, cycle: log.reblooms.length + 1 }); st.lastBuy = now; st.lastPrestige = now; return true;
    }
  }
  return false;
}

// ---------- the whole playthrough ----------
function simulate(p, seed) {
  const rng = rngFrom(seed);
  const S = C.newState();
  const log = { runs: [], purchases: [], reblooms: [], novas: [], days: [], complete: null, mainDone: null, p };
  const st = { lastBuy: 0, lastPrestige: -1e9, lastNova: 0 };
  const starts = sessionTimes(p.sessions);
  for (let day = 0; day < DAYS && !log.complete; day++) {
    let dayRuns = 0, dayEarn = 0; const dayBuys = log.purchases.length;
    for (const s0 of starts) {
      let now = day * 86400 + (s0 - starts[0]) + (day ? rng() * 600 : 0);
      for (let r = 0; r < p.runsPerSession; r++) {
        const sum = botRun(S, p, rng);
        now += sum.duration + p.overhead * 0.5;
        C.collectPending(S);
        const nb = shop(S, log, now);
        if (nb) st.lastBuy = now;
        log.runs.push({ n: S.runs, t: now, zone: sum.zone, dur: sum.duration, reward: sum.total, combo: sum.maxCombo, hits: sum.hits, misses: sum.misses, bought: nb });
        dayRuns++; dayEarn += sum.total;
        now += p.overhead * 0.5;
        if (maybePrestige(S, st, log, now)) { if (shop(S, log, now)) st.lastBuy = now; }
        if (!log.mainDone && C.counts(S, 'main').maxed === D.MAIN.nodes.length) log.mainDone = now;
        if (C.allMaxed(S)) { log.complete = now; break; }
      }
      if (log.complete) break;
    }
    const stt = C.stats(S);
    log.days.push({ day: day + 1, runs: dayRuns, zone: S.zone, time: stt.time, mainLv: C.counts(S, 'main').levels, buys: log.purchases.length - dayBuys, avgRun: dayEarn / Math.max(1, dayRuns), mem: C.counts(S, 'mem').levels, core: C.counts(S, 'core').levels, reblooms: log.reblooms.length, novas: log.novas.length });
  }
  log.S = S; log.daysPlayed = log.days.length;
  return log;
}

// ---------- analysis ----------
const dh = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + Math.floor((s % 3600) / 60) + 'm' : Math.floor(s / 60) + 'm ' + Math.floor(s % 60) + 's'; };
const sorted = (a) => a.slice().sort((x, y) => x - y);
const median = (a) => (a.length ? sorted(a)[Math.floor(a.length / 2)] : 0);
const pct = (a, q) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(a.length * q))] : 0);
const maxOf = (a) => a.reduce((m, x) => Math.max(m, x), 0);

function analyse(log) {
  const buys = log.purchases;
  const gaps = []; for (let i = 1; i < buys.length; i++) gaps.push(buys[i].t - buys[i - 1].t);
  const runGaps = []; let last = -1;
  log.runs.forEach((r, i) => { if (r.bought) { if (last >= 0) runGaps.push(i - last); last = i; } });
  const sessions = {}, withBuy = {};
  log.runs.forEach((r) => { const k = Math.floor(r.t / 3600 / 4); sessions[k] = 1; if (r.bought) withBuy[k] = 1; });
  const perWeek = [];
  for (let w = 0; w * 7 < log.daysPlayed; w++) {
    const a = w * 7 * 86400, b = a + 7 * 86400;
    perWeek.push({ w: w + 1, buys: buys.filter((x) => x.t >= a && x.t < b).length, runs: log.runs.filter((x) => x.t >= a && x.t < b).length });
  }
  return { gaps, runGaps, buys, perWeek, sessionRatio: Object.keys(withBuy).length / Math.max(1, Object.keys(sessions).length) };
}

// ---------- report ----------
function report(main, profiles) {
  const A = analyse(main), S = main.S, p = main.p, L = [];
  L.push('# Seedling Cosmos v5 - pacing simulation results', '');
  L.push('Generated by `node sim/pacing.js` (seed ' + (args.seed || 1) + '). The bot drives the real run engine in `js/core.js`; nothing here is an analytic estimate.', '');
  L.push('## Player model', '');
  L.push('- **' + p.sessions + ' sessions/day x ' + p.runsPerSession + ' runs** = ' + (p.sessions * p.runsPerSession) + ' runs/day (sessions start at ' + sessionTimes(p.sessions).map((s) => s / 3600 + ':00').join(', ') + ')');
  L.push('- Sustained tap rate ' + p.tapsPerSec + '/s, ' + Math.round(p.precision * 100) + '% of taps land, ' + p.react + 's reaction time, ' + Math.round(p.abilityUse * 100) + '% ability usage, ~' + p.overhead + 's of menus per run; the auto-Hammer and sprites act on their own through the same hit path');
  L.push('- Spends greedily (cheapest affordable upgrade first). Prestige at most once per ~17h (Rebloom) / 2 days (Supernova). Rebloom when the Seed gain is >= max(6, Seeds already earned this Supernova era), i.e. it would at least double them, or after 1.2 days without a purchase; Supernova when the gain is >= max(2, owned Cores), or after 4 days without a purchase. No more Supernovas once the Constellation is complete.', '');

  L.push('Tuning: base run ' + D.BAL.BASE_TIME + 's, target values x' + D.BAL.VAL_MUL + ' (first run pays single digits), calibrated costs start at ~1.5 runs of income and ease to ~0.7 (`node tools/calibrate.js --r0=1.5 --r1=0.7`), REB_REQ ' + D.BAL.REB_REQ + '.', '');
  L.push('## Headline', '');
  L.push('| Metric | Value | Target |', '|---|---|---|');
  L.push('| Full completion (all 3 maps maxed) | **' + (main.complete ? dh(main.complete) + ' (' + (main.complete / 86400 / 7).toFixed(1) + ' weeks)' : 'not reached in ' + DAYS + ' days') + '** | 3-6 weeks |');
  L.push('| Runs played to completion | ' + main.runs.length + ' | |');
  L.push('| Reblooms / Supernovas | ' + main.reblooms.length + ' / ' + main.novas.length + ' | |');
  L.push('| Upgrade levels bought | ' + A.buys.length + ' | |');
  L.push('| Median runs between purchases | ' + median(A.runGaps) + ' (90th pct ' + pct(A.runGaps, 0.9) + ', max ' + maxOf(A.runGaps) + ') | steady |');
  L.push('| Median / longest calendar gap between purchases | ' + dh(median(A.gaps)) + ' / ' + dh(maxOf(A.gaps)) + ' | |');
  L.push('| Play sessions (4h windows) with at least one purchase | ' + Math.round(A.sessionRatio * 100) + '% | |', '');

  L.push('## First runs', '');
  L.push('| Run | Elapsed | Zone | Length | Reward | Max combo | Upgrades bought after |', '|---|---|---|---|---|---|---|');
  main.runs.slice(0, 14).forEach((r) => L.push('| ' + r.n + ' | ' + dh(r.t) + ' | ' + r.zone + ' | ' + Math.round(r.dur) + 's | ' + C.fmt(r.reward) + ' | ' + r.combo + ' | ' + r.bought + ' |'));
  L.push('', 'First 15 purchases:', '', '| # | Time | Upgrade | Level | Gap since previous |', '|---|---|---|---|---|');
  A.buys.slice(0, 15).forEach((b, i) => L.push('| ' + (i + 1) + ' | ' + dh(b.t) + ' | ' + D.MAPS[b.kind].byId[b.id].name + ' | ' + b.level + ' | ' + (i ? dh(b.t - A.buys[i - 1].t) : '-') + ' |'));

  L.push('', '## Hammer branch timeline (first purchase of each level milestone)', '', '| Upgrade | Level | When | Cost |', '|---|---|---|---|');
  const hseen = {};
  main.purchases.forEach((b) => {
    if (b.kind !== 'main' || b.id[0] !== 'h' || !/^h\d$/.test(b.id)) return;
    const n = D.MAIN.byId[b.id], key = b.id + ':' + (b.level === 1 || b.level === n.max || b.level === 4 ? b.level : '');
    if ((b.level === 1 || b.level === 4 || b.level === n.max) && !hseen[key]) { hseen[key] = 1; L.push('| ' + n.name + ' | ' + b.level + '/' + n.max + ' | ' + dh(b.t) + ' | ' + C.fmt(D.baseCost(n, b.level - 1)) + ' |'); }
  });

  L.push('', '## Progress per week', '', '| Week | Runs | Purchases | Purchases per run |', '|---|---|---|---|');
  A.perWeek.forEach((w) => L.push('| ' + w.w + ' | ' + w.runs + ' | ' + w.buys + ' | ' + (w.buys / Math.max(1, w.runs)).toFixed(2) + ' |'));

  L.push('', '## Day by day', '', '| Day | Runs | Zone | Run length | Avg reward/run | Buys | Main lvls | Memory lvls | Core lvls | Reblooms | Novas |', '|---|---|---|---|---|---|---|---|---|---|---|');
  main.days.forEach((d) => { if (d.day <= 10 || d.day % 3 === 0 || d.day === main.days.length) L.push('| ' + d.day + ' | ' + d.runs + ' | ' + d.zone + ' | ' + d.time.toFixed(0) + 's | ' + C.fmt(d.avgRun) + ' | ' + d.buys + ' | ' + d.mainLv + ' | ' + d.mem + ' | ' + d.core + ' | ' + d.reblooms + ' | ' + d.novas + ' |'); });

  L.push('', '## Prestige timeline', '', '| Event | When | Gain |', '|---|---|---|');
  main.reblooms.slice(0, 40).forEach((r) => L.push('| Rebloom #' + r.cycle + ' | ' + dh(r.t) + ' | ' + r.gain + ' Seeds |'));
  if (main.reblooms.length > 40) L.push('| ... | ' + (main.reblooms.length - 40) + ' more Reblooms | |');
  main.novas.forEach((r, i) => L.push('| **Supernova #' + (i + 1) + '** | ' + dh(r.t) + ' | ' + r.gain + ' Star Cores |'));

  L.push('', '## First time in each zone', '', '| Zone | First played |', '|---|---|');
  const seen = {}; main.runs.forEach((r) => { if (!seen[r.zone]) { seen[r.zone] = 1; L.push('| ' + D.ZONES[r.zone].name + ' | ' + dh(r.t) + ' |'); } });

  L.push('', '## Completion time by player type', '', '| Profile | Runs/day | Tap rate | Precision | Completion |', '|---|---|---|---|---|');
  profiles.forEach((x) => L.push('| ' + x.name + ' | ' + (x.p.sessions * x.p.runsPerSession) + ' | ' + x.p.tapsPerSec + '/s | ' + Math.round(x.p.precision * 100) + '% | ' + (x.log.complete ? dh(x.log.complete) + ' (' + (x.log.complete / 86400 / 7).toFixed(1) + ' weeks)' : 'not within ' + DAYS + ' days') + ' |'));

  L.push('', '## Content size', '');
  ['main', 'mem', 'core'].forEach((k) => { const c = C.counts(S, k); L.push('- ' + { main: 'Garden map', mem: 'Memory map (Rebloom)', core: 'Constellation map (Supernova)' }[k] + ': ' + c.total + ' nodes, ' + c.maxLevels + ' levels'); });
  L.push('- Run length: base ' + D.BAL.BASE_TIME + 's, end state ' + C.stats(S).time.toFixed(0) + 's', '');
  return L.join('\n');
}

// ---------- main ----------
const seed = +args.seed || 1;
const standard = simulate(BASE_PLAYER, seed);
const profs = [{ name: 'Standard (this report)', p: BASE_PLAYER, log: standard }];
const variants = [
  ['Casual: 2 sessions x 3 runs', { sessions: 2, runsPerSession: 3 }],
  ['Regular: 4 sessions x 4 runs', { sessions: 4, runsPerSession: 4 }],
  ['Dedicated: 5 sessions x 6 runs', { sessions: 5, runsPerSession: 6 }],
  ['Standard, clumsy (2.0 taps/s, 75% precision)', { tapsPerSec: 2.0, precision: 0.75 }],
  ['Standard, expert (4.0 taps/s, 95% precision)', { tapsPerSec: 4.0, precision: 0.95 }]
];
if (!args.quick) variants.forEach(([name, o]) => { const p = Object.assign({}, BASE_PLAYER, o, { name }); profs.push({ name, p, log: simulate(p, seed) }); });

const md = report(standard, profs);
if (!args['no-write']) fs.writeFileSync(path.join(__dirname, '..', 'SIM_RESULTS.md'), md);
if (args.brief) {
  const A = analyse(standard), fz = (z) => { const r = standard.runs.find((x) => x.zone >= z); return r ? (r.t / 86400).toFixed(1) : '-'; };
  console.log('mainDone=' + (standard.mainDone ? (standard.mainDone / 86400).toFixed(1) + 'd' : 'NO') + ' done=' + (standard.complete ? (standard.complete / 86400).toFixed(1) + 'd' : 'NO') + ' runs=' + standard.runs.length + ' reb=' + standard.reblooms.length + ' nova=' + standard.novas.length + ' firstReb=' + (standard.reblooms[0] ? (standard.reblooms[0].t / 86400).toFixed(1) : '-') + 'd firstNova=' + (standard.novas[0] ? (standard.novas[0].t / 86400).toFixed(1) : '-') + 'd zones@' + [1, 2, 3, 4, 5, 6].map(fz).join('/') + ' runGapP90=' + pct(A.runGaps, 0.9) + ' maxRunGap=' + maxOf(A.runGaps));
} else if (!QUIET) {
  const A = analyse(standard);
  console.log('Standard player: completion ' + (standard.complete ? dh(standard.complete) + ' (' + (standard.complete / 86400 / 7).toFixed(1) + ' weeks)' : 'NOT reached in ' + DAYS + ' days'));
  console.log('runs ' + standard.runs.length + ', reblooms ' + standard.reblooms.length + ', novas ' + standard.novas.length + ', purchases ' + A.buys.length);
  console.log('first run reward ' + C.fmt(standard.runs[0].reward) + ', first purchase at ' + dh(A.buys[0] ? A.buys[0].t : 0) + '; median runs between buys ' + median(A.runGaps) + ', p90 ' + pct(A.runGaps, 0.9) + ', max ' + maxOf(A.runGaps) + ', max calendar gap ' + dh(maxOf(A.gaps)) + ', sessions with buy ' + Math.round(A.sessionRatio * 100) + '%');
  profs.slice(1).forEach((x) => console.log('  ' + x.name + ': ' + (x.log.complete ? (x.log.complete / 86400 / 7).toFixed(1) + ' weeks' : 'not done')));
}
