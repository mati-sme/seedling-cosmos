/* Seedling Cosmos v2 - pure game logic (UMD, Node-safe): state, stats, run engine, upgrades, prestige, save format. */
(function (root) {
  'use strict';
  const D = root.SC_DATA || require('./data.js');
  const B = D.BAL;
  const SAVE_VERSION = 2;
  const CUR = { main: 'stardust', mem: 'seeds', core: 'cores' };
  const FIELD = { main: 'nodes', mem: 'mem', core: 'core' };

  const C = { SAVE_VERSION, CUR, FIELD };

  // ---------- number formatting ----------
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  C.fmt = function (n, sci) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + C.fmt(-n, sci);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.floor(n));
    if (sci) { const e = Math.floor(Math.log10(n)); return (n / Math.pow(10, e)).toFixed(2) + 'e' + e; }
    const t = Math.min(SUF.length - 1, Math.floor(Math.log10(n) / 3));
    const v = n / Math.pow(1000, t);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + SUF[t];
  };
  C.fmtTime = function (s) {
    s = Math.max(0, Math.round(s));
    if (s < 90) return s + 's';
    const m = Math.floor(s / 60); if (m < 90) return m + 'm';
    const h = Math.floor(m / 60); if (h < 48) return h + 'h ' + (m % 60) + 'm';
    return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  };

  // ---------- state ----------
  C.newState = function () {
    return {
      v: SAVE_VERSION, stardust: 0, cycleEarned: 0, lifetime: 0, seeds: 0, seedsEra: 0, seedsTotal: 0, cores: 0,
      nodes: {}, mem: {}, core: {}, zone: 0, runs: 0, reblooms: 0, novas: 0, bestRun: 0, bestCombo: 0, totalHits: 0,
      pending: null, created: Date.now(), saved: 0, playSeconds: 0,
      settings: { fx: true, shake: true, sci: false, haptics: true }, seen: {}
    };
  };
  C.level = (S, kind, id) => (id === 'seed' ? 1 : S[FIELD[kind]][id] || 0);

  // ---------- stats ----------
  C.computeStats = function (S) {
    const acc = {}, ab = {};
    let zone = 0;
    Object.keys(D.STATS).forEach((k) => { acc[k] = D.STATS[k].kind === 'mul' ? 1 : 0; });
    ['main', 'mem', 'core'].forEach((kind) => {
      const lv = S[FIELD[kind]];
      D.MAPS[kind].nodes.forEach((n) => {
        const l = lv[n.id] || 0; if (!l) return;
        const f = n.fx;
        if (f.s === 'ab') ab[f.k] = true;
        else if (f.s === 'zone') zone = Math.max(zone, f.z);
        else if (f.m !== undefined) acc[f.s] *= Math.pow(f.m, l);
        else acc[f.s] += f.a * l;
      });
    });
    const st = acc;
    st.ab = ab; st.maxZone = zone;
    st.time = B.BASE_TIME + acc.time;
    st.comboWin = B.COMBO_WIN + acc.comboWin;
    st.comboStep = B.COMBO_STEP + acc.comboStep;
    st.comboCap = B.COMBO_CAP + acc.comboCap;
    st.missLoss = Math.max(0, B.MISS_LOSS + acc.missLoss);
    st.critMul = B.CRIT_MUL + acc.critMul;
    st.goldC = B.GOLD_CH + acc.goldC;
    st.orbT = B.ORB_TIME + acc.orbT;
    // auto-Hammer: inactive until its unlock node is bought
    st.hmOn = acc.hm > 0;
    st.hmRate = st.hmOn ? B.HM_RATE + acc.hmRate : 0;
    st.hmPow = B.HM_POW + acc.hmPow;
    st.hmRange = B.HM_RANGE + acc.hmRange;
    st.hmDouble = Math.min(0.75, acc.hmDouble);
    st.hmCrit = Math.min(0.75, acc.hmCrit);
    st.crit = Math.min(0.75, acc.crit);
    st.abCd = Math.max(0.15, acc.abCd);
    st.head = acc.head;
    return st;
  };
  C.stats = function (S) { return S._st || (S._st = C.computeStats(S)); };
  C.dirty = function (S) { S._st = null; };

  // ---------- upgrades ----------
  C.nodeCost = function (S, kind, n) {
    const l = C.level(S, kind, n.id);
    const base = D.baseCost(n, l);
    return kind === 'main' ? Math.max(1, Math.ceil(base * C.stats(S).cost)) : base;
  };
  // 'maxed' | 'owned' (purchased, can upgrade) | 'available' | 'locked'
  C.nodeState = function (S, kind, n) {
    const l = C.level(S, kind, n.id);
    if (l >= n.max) return 'maxed';
    if (l > 0) return 'owned';
    return n.parents.some((p) => C.level(S, kind, p) > 0) ? 'available' : 'locked';
  };
  C.canBuy = function (S, kind, n) {
    const st = C.nodeState(S, kind, n);
    return (st === 'owned' || st === 'available') && S[CUR[kind]] >= C.nodeCost(S, kind, n);
  };
  C.buy = function (S, kind, id) {
    const n = D.MAPS[kind].byId[id];
    if (!n || n.root || !C.canBuy(S, kind, n)) return false;
    S[CUR[kind]] -= C.nodeCost(S, kind, n);
    S[FIELD[kind]][id] = C.level(S, kind, id) + 1;
    C.dirty(S);
    if (n.fx.s === 'zone' && S.zone < n.fx.z) S.zone = n.fx.z;
    if (n.fx.s === 'head') C.applyHead(S);
    return true;
  };
  // "head start" prestige perks pre-buy the first N main-map nodes (by purchase order)
  C.applyHead = function (S) {
    const n = Math.round(C.stats(S).head) * B.HEAD_STEP;
    if (n > 0) D.MAIN.nodes.forEach((nd) => { if (nd.idx < n) S.nodes[nd.id] = nd.max; });
    C.dirty(S);
    if (!S.zonePicked || S.zone > C.stats(S).maxZone) S.zone = C.stats(S).maxZone;
  };
  C.counts = function (S, kind) {
    let lv = 0, maxLv = 0, maxed = 0;
    D.MAPS[kind].nodes.forEach((n) => { const l = C.level(S, kind, n.id); lv += l; maxLv += n.max; if (l >= n.max) maxed++; });
    return { levels: lv, maxLevels: maxLv, maxed, total: D.MAPS[kind].nodes.length };
  };
  C.allMaxed = (S) => ['main', 'mem', 'core'].every((k) => { const c = C.counts(S, k); return c.maxed === c.total; });

  // ---------- prestige ----------
  C.rebloomGain = function (S) {
    if (S.cycleEarned < B.REB_REQ) return 0;
    // scales with the order of magnitude reached this cycle, so Seeds stay bounded however strong the garden gets
    const depth = 1 + Math.log10(S.cycleEarned / B.REB_REQ);
    return Math.floor(B.REB_K * Math.pow(depth, B.REB_EXP) * C.stats(S).seedGain);
  };
  C.rebloom = function (S) {
    const g = C.rebloomGain(S); if (g < 1) return 0;
    S.seeds += g; S.seedsEra += g; S.seedsTotal += g; S.reblooms++;
    S.stardust = 0; S.cycleEarned = 0; S.nodes = {}; S.zone = 0; S.zonePicked = false;
    C.dirty(S); C.applyHead(S);
    return g;
  };
  C.novaGain = function (S) {
    if (S.seedsEra < B.NOVA_REQ) return 0;
    return Math.floor(B.NOVA_K * Math.pow(S.seedsEra / B.NOVA_REQ, B.NOVA_EXP));
  };
  C.supernova = function (S) {
    const g = C.novaGain(S); if (g < 1) return 0;
    const keep = Math.min(1, C.stats(S).memKeep);
    Object.keys(S.mem).forEach((id) => { const k = Math.floor(S.mem[id] * keep); if (k > 0) S.mem[id] = k; else delete S.mem[id]; });
    S.cores += g; S.novas++;
    S.seeds = 0; S.seedsEra = 0; S.stardust = 0; S.cycleEarned = 0; S.nodes = {}; S.zone = 0; S.zonePicked = false;
    C.dirty(S); C.applyHead(S);
    return g;
  };
  C.novaRevealed = (S) => S.novas > 0 || S.cores > 0 || S.seedsEra >= B.NOVA_REQ * 0.2;

  // ---------- run engine (headless; the UI renders its state, the sim drives it with a bot) ----------
  C.createRun = function (S, zoneIdx, rng, H, emit) {
    const st = C.stats(S), z = D.ZONES[zoneIdx];
    const run = {
      st, zone: zoneIdx, zc: z, zmul: B.ZONE_MUL[zoneIdx], rng, H: H || 1.45, emit: !!emit, ev: [],
      t: 0, dur: st.time, left: st.time, over: false, targets: [], nid: 1, spawnAcc: 0.6, autoAcc: 0, hmAcc: 0.5, swings: [], recent: [],
      combo: 0, comboT: 0, maxCombo: 0, bonusT: 0, earned: 0, hits: 0, misses: 0, pops: 0, crits: 0, hammerHits: 0, autoHits: 0,
      fx: { slow: 0, golden: 0, magnet: 0 }, cd: {}, used: {}
    };
    Object.keys(st.ab).forEach((k) => { run.cd[k] = 0; });
    return run;
  };
  const ev = (run, e) => { if (run.emit) run.ev.push(e); };
  C.comboMult = (run) => Math.min(run.st.comboCap, 1 + run.combo * run.st.comboStep);

  function spawn(run) {
    const st = run.st, z = run.zc, rng = run.rng, H = run.H;
    let kind = 'mote';
    const q = rng();
    if (q < st.cometC) kind = 'comet';
    else if (q < st.cometC + st.podC) kind = 'pod';
    else if (q < st.cometC + st.podC + st.orbC) kind = 'orb';
    else if (run.fx.golden > 0 || rng() < st.goldC) kind = 'gold';
    const spd = z.speed * (0.05 + rng() * 0.09), a = rng() * 6.283;
    const t = { id: run.nid++, kind, r: B.RADIUS, x: 0.12 + rng() * 0.76, y: 0.12 + rng() * (H - 0.24), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, age: 0, life: B.LIFE * st.life * z.life, hp: 1 };
    if (kind === 'comet') {
      const dir = rng() < 0.5 ? 1 : -1;
      t.x = dir > 0 ? -0.05 : 1.05; t.y = 0.15 + rng() * (H - 0.3); t.vx = dir * 0.42 * z.speed; t.vy = (rng() - 0.5) * 0.1;
      t.life = 3.4; t.r = B.RADIUS * 1.05;
    } else if (kind === 'pod') { t.r = B.RADIUS * 1.55; t.hp = 4; t.vx *= 0.5; t.vy *= 0.5; t.life *= 1.5; }
    else if (kind === 'orb') { t.r = B.RADIUS * 0.9; t.life *= 0.8; }
    t.max = t.life; t.hp0 = t.hp;
    run.targets.push(t);
    ev(run, { type: 'spawn', t });
  }

  // THE hit path. Every way of popping a target - tap, hammer, sprite auto-pop, gravity well, nova - goes through here,
  // so combo, combo timer, crits and score are identical whatever the source. `via` only tags the event for the juice.
  // dmg lets multi-hit pods take more than one point of damage per hit.
  function hit(run, t, dmg, via) {
    const st = run.st;
    if (run.targets.indexOf(t) < 0) return false;
    const left = t.hp - dmg;
    if (left > 0.001) {
      t.hp = left; run.combo += 1; run.comboT = st.comboWin; if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      run.hits++; run.pops++; if (via === 'hammer') run.hammerHits++; else if (via !== 'tap') run.autoHits++;
      ev(run, { type: 'podhit', x: t.x, y: t.y, hp: t.hp, combo: run.combo, via });
      return true;
    }
    const mult = C.comboMult(run);
    let crit = false;
    const cc = st.crit + (via === 'hammer' ? st.hmCrit : 0);
    if (via !== 'nova' && cc > 0 && run.rng() < Math.min(0.9, cc)) { crit = true; run.crits++; }
    let val = B.VAL[t.kind] * B.VAL_MUL * run.zmul * st.yield * mult * (crit ? st.critMul : 1);
    let addT = 0;
    if (t.kind === 'orb') { addT = Math.min(st.orbT, Math.max(0, run.dur * 0.3 - run.bonusT)); run.bonusT += addT; run.left += addT; }
    if (via === 'nova') val *= st.novaMul;
    run.earned += val; run.hits++; run.pops++;
    if (via === 'hammer') run.hammerHits++; else if (via !== 'tap') run.autoHits++;
    run.combo += t.kind === 'pod' ? 3 : t.kind === 'gold' || t.kind === 'comet' ? 2 : 1;
    run.comboT = st.comboWin;
    if (run.combo > run.maxCombo) run.maxCombo = run.combo;
    const i = run.targets.indexOf(t); if (i >= 0) run.targets.splice(i, 1);
    if (via !== 'tap') run.recent.push({ x: t.x, y: t.y, r: t.r, ttl: B.GRACE });
    ev(run, { type: 'hit', x: t.x, y: t.y, val, crit, kind: t.kind, combo: run.combo, via, mult, orbT: addT });
    return true;
  }
  C.hit = hit;

  // Tap at field coordinates (x in 0..1, y in 0..H). Returns the target touched or null.
  C.tapRun = function (run, x, y) {
    if (run.over) return null;
    const st = run.st, slop = 0.025, rm = st.hitR * (run.fx.magnet > 0 ? 1.3 : 1);
    let best = null, bd = 1e9;
    for (let i = 0; i < run.targets.length; i++) {
      const t = run.targets[i], d = Math.hypot(t.x - x, t.y - y) - t.r * rm;
      if (d < slop && d < bd) { bd = d; best = t; }
    }
    if (!best) {
      // fairness: a tap on a target that an auto-pop / hammer beat you to a split second ago is not a miss
      for (let i = 0; i < run.recent.length; i++) {
        const g = run.recent[i];
        if (Math.hypot(g.x - x, g.y - y) - g.r * rm < slop) { ev(run, { type: 'late', x, y }); return null; }
      }
      run.misses++;
      const lost = Math.floor(run.combo * st.missLoss);
      if (lost > 0) run.combo -= lost;
      ev(run, { type: 'miss', x, y, lost });
      return null;
    }
    hit(run, best, 1, 'tap');
    return best;
  };

  // ---------- auto-Hammer ----------
  // A swing aims at a target's predicted spot and lands HM_WIND seconds later on whatever is there. Nothing is claimed
  // while it is in the air, so a manual tap can still pop that target first (the swing then just lands on empty ground).
  function swing(run, x, y, double) {
    run.swings.push({ x, y, t: B.HM_WIND, double: !!double });
    ev(run, { type: 'swing', x, y, wind: B.HM_WIND, double: !!double });
  }
  function land(run, sw) {
    const st = run.st, rr = st.hmRange;
    const hits = run.targets.filter((t) => Math.hypot(t.x - sw.x, t.y - sw.y) <= rr + t.r * 0.9);
    ev(run, { type: 'slam', x: sw.x, y: sw.y, r: rr, n: hits.length, double: sw.double });
    hits.forEach((t) => hit(run, t, st.hmPow, 'hammer'));
    if (!sw.double && run.rng() < st.hmDouble) swing(run, sw.x, sw.y, true);
  }
  function hammerAim(run) {
    const pool = run.targets.filter((t) => t.age > 0.15);
    if (!pool.length) return;
    const t = pool[Math.floor(run.rng() * pool.length)];
    swing(run, t.x + t.vx * B.HM_WIND, t.y + t.vy * B.HM_WIND, false);
  }

  C.abilityReady = (run, k) => !!run.st.ab[k] && run.cd[k] <= 0 && !run.over && !(k === 'chrono' && run.used.chrono);
  C.useAbility = function (run, k) {
    if (!C.abilityReady(run, k)) return false;
    const st = run.st, A = D.ABILITIES[k];
    run.cd[k] = Math.max(3, A.cd * st.abCd);
    if (k === 'nova') {
      run.targets.slice().forEach((t) => { hit(run, t, 99, 'nova'); });
    } else if (k === 'chrono') { run.used.chrono = true; run.left += A.time * st.abPow; }
    else run.fx[k] = A.dur * st.abPow;
    ev(run, { type: 'ability', k });
    return true;
  };

  C.stepRun = function (run, dt) {
    if (run.over) return;
    const st = run.st, rng = run.rng, H = run.H, fx = run.fx;
    run.t += dt; run.left -= dt;
    if (run.left <= 0) { run.left = 0; run.over = true; ev(run, { type: 'end' }); return; }
    for (const k in run.cd) if (run.cd[k] > 0 && k !== 'chrono') run.cd[k] = Math.max(0, run.cd[k] - dt);
    for (const k in fx) if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);
    run.spawnAcc += B.SPAWN * st.spawn * (fx.golden > 0 ? 1.35 : 1) * dt;
    while (run.spawnAcc >= 1) { run.spawnAcc -= 1; if (run.targets.length < B.MAX_TARGETS) spawn(run); }
    const sp = fx.slow > 0 ? 0.35 : 1;
    for (let i = run.targets.length - 1; i >= 0; i--) {
      const t = run.targets[i];
      t.age += dt; t.life -= dt * (fx.slow > 0 ? 0.6 : 1);
      if (fx.magnet > 0 && t.kind !== 'comet') {
        const dx = 0.5 - t.x, dy = H / 2 - t.y, d = Math.hypot(dx, dy), n = d || 1;
        t.x += dx / n * 0.2 * dt; t.y += dy / n * 0.2 * dt;
        if (d < 0.1) { hit(run, t, 99, 'magnet'); continue; }
      }
      t.x += t.vx * dt * sp; t.y += t.vy * dt * sp;
      if (t.kind !== 'comet') {
        if (t.x < t.r || t.x > 1 - t.r) { t.vx = -t.vx; t.x = Math.min(1 - t.r, Math.max(t.r, t.x)); }
        if (t.y < t.r || t.y > H - t.r) { t.vy = -t.vy; t.y = Math.min(H - t.r, Math.max(t.r, t.y)); }
      }
      if (t.life <= 0 || t.x < -0.1 || t.x > 1.1) {
        run.targets.splice(i, 1);
        ev(run, { type: 'expire', x: t.x, y: t.y, kind: t.kind });
      }
    }
    if (st.auto > 0) {
      run.autoAcc += st.auto * dt;
      while (run.autoAcc >= 1) {
        run.autoAcc -= 1;
        if (run.targets.length) hit(run, run.targets[Math.floor(rng() * run.targets.length)], 1, 'sprite');
      }
    }
    if (st.hmRate > 0) {
      run.hmAcc += st.hmRate * dt;
      while (run.hmAcc >= 1) { run.hmAcc -= 1; hammerAim(run); }
    }
    for (let i = run.swings.length - 1; i >= 0; i--) {
      const sw = run.swings[i]; sw.t -= dt;
      if (sw.t <= 0) { run.swings.splice(i, 1); land(run, sw); }
    }
    for (let i = run.recent.length - 1; i >= 0; i--) { run.recent[i].ttl -= dt; if (run.recent[i].ttl <= 0) run.recent.splice(i, 1); }
    if (run.combo > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) { if (run.combo >= 10) ev(run, { type: 'combolost', combo: run.combo }); run.combo = 0; }
    }
  };

  // Totals at the end of a run. Stardust stays "pending" until the player collects it on the summary screen.
  C.finishRun = function (run) {
    const st = run.st;
    const acc = run.hits / Math.max(1, run.hits + run.misses);
    const steady = run.hits >= 5 && acc >= B.STEADY_ACC ? st.steady : 0;
    return {
      zone: run.zone, raw: run.earned, collectMul: st.collect, steady, total: Math.max(1, Math.round(run.earned * st.collect * (1 + steady))),
      hits: run.hits, misses: run.misses, maxCombo: run.maxCombo, crits: run.crits, hammerHits: run.hammerHits, autoHits: run.autoHits,
      duration: run.dur, accuracy: acc
    };
  };
  C.endRun = function (S, run) { S.pending = C.finishRun(run); return S.pending; };
  C.collectPending = function (S) {
    const p = S.pending; if (!p) return null;
    S.stardust += p.total; S.cycleEarned += p.total; S.lifetime += p.total; S.runs++;
    S.totalHits += p.hits; S.playSeconds += p.duration;
    if (p.total > S.bestRun) S.bestRun = p.total;
    if (p.maxCombo > S.bestCombo) S.bestCombo = p.maxCombo;
    S.pending = null;
    return p;
  };

  // ---------- save / load ----------
  C.serialize = function (S) {
    const o = Object.assign({}, S); delete o._st; o.saved = Date.now();
    return JSON.stringify(o);
  };
  C.exportString = function (S) {
    const j = C.serialize(S);
    const b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(j))) : Buffer.from(j, 'utf8').toString('base64');
    return 'SC2:' + b;
  };
  // Returns a validated v2 state or null (old/foreign/corrupt data). Never throws.
  C.parse = function (text) {
    try {
      if (!text) return null;
      let j = String(text).trim();
      if (j.indexOf('SC2:') === 0) {
        const b = j.slice(4);
        j = typeof atob === 'function' ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, 'base64').toString('utf8');
      }
      const o = JSON.parse(j);
      if (!o || o.v !== SAVE_VERSION) return null;
      const S = Object.assign(C.newState(), o);
      S.settings = Object.assign(C.newState().settings, o.settings || {});
      ['nodes', 'mem', 'core', 'seen'].forEach((k) => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
      ['stardust', 'cycleEarned', 'lifetime', 'seeds', 'seedsEra', 'seedsTotal', 'cores'].forEach((k) => { if (!isFinite(S[k]) || S[k] < 0) S[k] = 0; });
      C.dirty(S);
      if (S.zone > C.stats(S).maxZone) S.zone = C.stats(S).maxZone;
      return S;
    } catch (e) { return null; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.SC_CORE = C;
})(typeof self !== 'undefined' ? self : this);
