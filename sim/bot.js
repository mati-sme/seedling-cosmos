'use strict';
/* Shared bot player: a reasonable human-like tapper driving the real run engine. Used by sim/pacing.js and tools/calibrate.js. */
const C = require('../js/core.js');

// ---------- deterministic RNG ----------
function rngFrom(seed) {
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- player profiles ----------
const BASE_PLAYER_DEFAULTS = {
  name: 'Standard', sessions: 3, runsPerSession: 4,
  tapsPerSec: 2.8,      // sustained taps per second
  precision: 0.88,      // chance a tap lands on its target
  react: 0.3,                         // seconds before the player notices a new target
  abilityUse: 0.85,                   // chance each ability is actually used on a given run
  overhead: 25                        // seconds per run spent on menus/summary/shopping
};
function sessionTimes(n) {
  return { 1: [12], 2: [8, 20], 3: [8, 13, 20], 4: [7, 12, 17, 21], 5: [7, 10, 13, 17, 21] }[Math.min(5, n)].map((h) => h * 3600);
}

// ---------- the bot plays one run ----------
function botRun(S, p, rng) {
  const run = C.createRun(S, S.zone, rng, 1.45, false);
  const dt = 1 / 30, st = run.st;
  const use = {}; Object.keys(st.ab).forEach((k) => { use[k] = rng() < p.abilityUse; });
  let tapAcc = 0.4;
  while (!run.over) {
    C.stepRun(run, dt);
    if (run.over) break;
    if (use.chrono && run.left < 5) C.useAbility(run, 'chrono');
    if (run.t > 1.5) {
      if (use.nova && run.cd.nova <= 0 && run.targets.filter((t) => t.kind !== 'spore').length >= 5) C.useAbility(run, 'nova');
      if (use.golden && run.cd.golden <= 0) C.useAbility(run, 'golden');
      if (use.magnet && run.cd.magnet <= 0 && run.targets.length >= 3) C.useAbility(run, 'magnet');
      if (use.slow && run.cd.slow <= 0 && run.targets.length >= 6) C.useAbility(run, 'slow');
    }
    tapAcc = Math.min(1.5, tapAcc + p.tapsPerSec * dt);
    if (tapAcc < 1) continue;
    // pick the most urgent real target the player has noticed
    let best = null, bs = 1e9;
    for (let i = 0; i < run.targets.length; i++) {
      const t = run.targets[i];
      if (t.age < p.react || t.kind === 'spore') continue;
      const score = t.life - (t.kind === 'comet' ? 1.5 : 0) - (t.kind === 'orb' ? 1 : 0) - (t.kind === 'gold' ? 0.5 : 0);
      if (score < bs) { bs = score; best = t; }
    }
    if (!best) continue;
    tapAcc -= 1;
    if (rng() < p.precision) C.tapRun(run, best.x, best.y);
    else C.tapRun(run, Math.min(1, Math.max(0, best.x + (rng() < 0.5 ? -0.2 : 0.2))), Math.min(run.H, Math.max(0, best.y + 0.15)));
  }
  return C.endRun(S, run);
}

module.exports = { rngFrom, BASE_PLAYER_DEFAULTS, botRun, sessionTimes };
