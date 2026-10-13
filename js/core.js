/* Seedling Cosmos - pure game logic (no DOM). Usable in browser (window.SC_CORE) and Node. */
(function (root) {
  'use strict';
  const D = root.SC_DATA || require('./data.js');
  const T = D.T;
  const C = { D };
  const RES = D.RES_ORDER;
  const NONE = [];

  // ---------- number formatting ----------
  const LET = 'abcdefghijklmnopqrstuvwxyz';
  const SUF = ['', 'K', 'M', 'B', 'T'];
  C.fmt = function (n, sci) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (n < 0) return '-' + C.fmt(-n, sci);
    if (!isFinite(n)) return '∞';
    if (n < 1000) {
      if (n === Math.floor(n)) return String(n);
      return n < 10 ? n.toFixed(2) : n.toFixed(1);
    }
    let e = Math.floor(Math.log10(n));
    if (sci) {
      let mant = n / Math.pow(10, e);
      if (mant >= 9.995) { mant = 1; e++; }
      return mant.toFixed(2) + 'e' + e;
    }
    let g = Math.floor(e / 3);
    let txt = (n / Math.pow(10, g * 3)).toFixed(2);
    if (parseFloat(txt) >= 1000) { g++; txt = (n / Math.pow(10, g * 3)).toFixed(2); }
    const suf = g < SUF.length ? SUF[g] : LET[Math.floor((g - 5) / 26) % 26] + LET[(g - 5) % 26];
    return txt + suf;
  };
  C.fmtTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + s + 's';
    return s + 's';
  };

  // ---------- state ----------
  C.newState = function () {
    const now = Date.now();
    return {
      v: D.VERSION, created: now, last: now,
      res: { sd: 0, sap: 0, pol: 0, sl: 0 },
      run: { sd: 0, sap: 0, pol: 0, sl: 0, time: 0, taps: 0 },
      gens: {}, ups: {}, zone: 0,
      mem: 0, memAll: 0, memUp: {},
      cores: 0, coreUp: {},
      life: { sd: 0, taps: 0, crits: 0, time: 0, reblooms: 0, supernovas: 0, bestSps: 0, bestZone: 0, offl: 0, exp: 0, memAll: 0, coreAll: 0, upsb: 0 },
      ach: {}, ms: {},
      auto: { gens: true, ups: true, re: false, sn: false, pct: 50 },
      set: { sci: false, fx: true, buy: 1 }
    };
  };

  function cm(s) { return s._m || C.recalc(s); }

  C.recalc = function (s) {
    const m = {
      tap: 1, tapSps: 0, crit: 0, critMul: 5, autoTap: 0, all: 1, genAll: 1, gen: {}, res: { sap: 1, pol: 1, sl: 1 },
      costMul: 1, autoGens: 0, autoRes: 0, offEff: T.OFF_EFF, offCap: T.OFF_CAP, memGain: 1, coreGain: 1,
      startSD: 0, startMem: 0, startGens: 0, achMul: 1, autoUps: false, autoRe: false, autoSn: false
    };
    for (const id in s.ups) {
      const u = D.UPG_BY_ID[id];
      if (!u) continue;
      const f = u.fx;
      if (f.tap) m.tap *= f.tap;
      if (f.tapSps) m.tapSps += f.tapSps;
      if (f.crit) m.crit += f.crit;
      if (f.critMul) m.critMul += f.critMul;
      if (f.autoTap) m.autoTap += f.autoTap;
      if (f.all) m.all *= f.all;
      if (f.costMul) m.costMul *= f.costMul;
      if (f.autoGens) m.autoGens = Math.max(m.autoGens, f.autoGens);
      if (f.autoRes) m.autoRes = 1;
      if (f.offEff) m.offEff += f.offEff;
      if (f.offCap) m.offCap += f.offCap;
      if (f.g) m.gen[f.g] = (m.gen[f.g] || 1) * f.x;
      if (f.r) m.res[f.r] *= f.x;
    }
    D.MEM_TREE.forEach((n) => { const l = s.memUp[n.id]; if (l) n.fx(m, l); });
    D.CORE_TREE.forEach((n) => { const l = s.coreUp[n.id]; if (l) n.fx(m, l); });
    m.crit = Math.min(0.9, m.crit);
    m.offEff = Math.min(1, m.offEff);
    const achN = Object.keys(s.ach).length;
    m.staticMul = m.all * (1 + achN * T.ACH_BONUS * m.achMul) * (1 + T.MEM_BONUS * Math.pow(s.memAll, T.MEM_EXP)) * (1 + T.CORE_BONUS * Math.pow(s.life.coreAll, T.CORE_EXP));
    m.baseOut = { sd: 0, sap: 0, pol: 0, sl: 0 };
    D.GENS.forEach((g) => {
      const n = s.gens[g.id] || 0;
      if (!n) return;
      let out = g.out * n * (m.gen[g.id] || 1) * m.genAll;
      if (g.makes !== 'sd') out *= m.res[g.makes];
      m.baseOut[g.makes] += out;
    });
    m.autoUnlocked = m.autoGens > 0 || m.autoRes > 0 || m.autoUps || m.autoRe;
    s._m = m;
    return m;
  };

  C.dyn = function (s) {
    return Math.pow(1 + s.run.sap, T.SAP_EXP) * Math.pow(1 + s.run.pol, T.POL_EXP) * Math.pow(1 + s.run.sl, T.SL_EXP);
  };
  C.mulSD = function (s) { return cm(s).staticMul * C.dyn(s); };
  C.rates = function (s) {
    const m = cm(s);
    return { sd: m.baseOut.sd * m.staticMul * C.dyn(s), sap: m.baseOut.sap, pol: m.baseOut.pol, sl: m.baseOut.sl };
  };
  C.tapValue = function (s) {
    const m = cm(s);
    return T.TAP_BASE * m.tap * C.mulSD(s) + m.tapSps * C.rates(s).sd;
  };

  function give(s, r, amt) {
    if (!(amt > 0)) return;
    s.res[r] += amt; s.run[r] += amt;
    if (r === 'sd') s.life.sd += amt;
  }
  C.give = give;

  C.tap = function (s, n) {
    n = n || 1;
    const m = cm(s);
    const v = C.tapValue(s);
    let amt, crit = false;
    if (n === 1) {
      if (m.crit > 0 && Math.random() < m.crit) { crit = true; amt = v * m.critMul; s.life.crits++; } else amt = v;
    } else {
      amt = n * v * (1 + m.crit * (m.critMul - 1));
      s.life.crits += n * m.crit;
    }
    give(s, 'sd', amt);
    s.life.taps += n; s.run.taps += n;
    return { amt, crit };
  };

  // ---------- helpers (generators) ----------
  C.genVisible = function (s, g) { return (s.gens[g.id] || 0) > 0 || g.zone <= s.life.bestZone; };
  C.genCost = function (s, g, k) {
    const n = s.gens[g.id] || 0, c0 = g.base * cm(s).costMul * Math.pow(g.growth, n);
    return c0 * (Math.pow(g.growth, k) - 1) / (g.growth - 1);
  };
  // Max number of helpers purchasable with `budget` (defaults to the full stock of the cost resource).
  C.genMax = function (s, g, budget) {
    const n = s.gens[g.id] || 0, c0 = g.base * cm(s).costMul * Math.pow(g.growth, n);
    if (budget === undefined) budget = s.res[g.costRes];
    if (!(budget >= c0)) return 0;
    return Math.max(0, Math.floor(Math.log(1 + budget * (g.growth - 1) / c0) / Math.log(g.growth) + 1e-9));
  };
  // k: a number or 'max'. Returns the number actually bought (0 if unaffordable).
  C.buyGen = function (s, id, k, budget) {
    const g = D.GEN_BY_ID[id];
    if (!g || !C.genVisible(s, g)) return 0;
    const kmax = C.genMax(s, g, budget);
    if (k === 'max') k = kmax;
    else if (kmax < k) return 0;
    if (!(k >= 1)) return 0;
    const cost = C.genCost(s, g, k);
    if (!(s.res[g.costRes] >= cost) || !isFinite(cost)) return 0;
    s.res[g.costRes] -= cost;
    s.gens[id] = (s.gens[id] || 0) + k;
    C.recalc(s);
    return k;
  };
  C.totalGens = function (s) { let n = 0; for (const id in s.gens) n += s.gens[id]; return n; };

  // ---------- upgrades ----------
  C.upVisible = function (s, u) {
    if (s.ups[u.id]) return false;
    if (u.req && (s.gens[u.req.gen] || 0) < u.req.n) return false;
    return (s.run[u.res] || 0) >= u.cost * 0.3;
  };
  C.visibleUps = function (s) { return D.UPGRADES.filter((u) => C.upVisible(s, u)); };
  C.buyUp = function (s, id) {
    const u = D.UPG_BY_ID[id];
    if (!u || s.ups[id] || !(s.res[u.res] >= u.cost)) return false;
    s.res[u.res] -= u.cost;
    s.ups[id] = true; s.life.upsb++;
    C.recalc(s);
    return true;
  };

  // ---------- prestige ----------
  C.treeCost = function (n, l) { return Math.ceil(n.base * Math.pow(n.gr, l)); };
  C.buyMem = function (s, id) {
    const n = D.MEM_BY_ID[id], l = s.memUp[id] || 0;
    if (!n || l >= n.max) return false;
    const c = C.treeCost(n, l);
    if (s.mem < c) return false;
    s.mem -= c; s.memUp[id] = l + 1; C.recalc(s);
    return true;
  };
  C.buyCore = function (s, id) {
    const n = D.CORE_BY_ID[id], l = s.coreUp[id] || 0;
    if (!n || l >= n.max) return false;
    const c = C.treeCost(n, l);
    if (s.cores < c) return false;
    s.cores -= c; s.coreUp[id] = l + 1; C.recalc(s);
    return true;
  };
  C.rebloomGain = function (s) {
    if (s.run.sd < T.RE_REQ) return 0;
    return Math.floor(T.RE_K * Math.pow(s.run.sd / T.RE_REQ, T.RE_EXP) * cm(s).memGain);
  };
  C.snReq = function (s) { return T.SN_REQ * Math.pow(T.SN_SCALE, s.life.supernovas); };
  C.supernovaGain = function (s) {
    const req = C.snReq(s);
    if (s.memAll < req) return 0;
    return Math.floor(T.SN_K * Math.pow(s.memAll / req, T.SN_EXP) * cm(s).coreGain);
  };
  function resetRun(s) {
    const m = C.recalc(s);
    s.res = { sd: m.startSD, sap: 0, pol: 0, sl: 0 };
    s.run = { sd: 0, sap: 0, pol: 0, sl: 0, time: 0, taps: 0 };
    s.gens = {}; s.ups = {}; s.zone = 0;
    if (m.startGens) D.SD_GENS.slice(0, 4).forEach((g) => { s.gens[g.id] = m.startGens; });
    C.recalc(s);
  }
  C.rebloom = function (s) {
    const g = C.rebloomGain(s);
    if (g < 1) return null;
    s.mem += g; s.memAll += g; s.life.memAll += g; s.life.reblooms++;
    resetRun(s);
    return { gain: g };
  };
  C.supernova = function (s) {
    const g = C.supernovaGain(s);
    if (g < 1) return null;
    s.cores += g; s.life.coreAll += g; s.life.supernovas++;
    s.memUp = {}; s.memAll = 0; s.mem = 0;
    const m = C.recalc(s);
    s.mem = m.startMem;
    resetRun(s);
    return { gain: g };
  };

  // ---------- progression checks ----------
  C.stats = function (s) {
    const m = cm(s);
    return {
      taps: s.life.taps, sd: s.life.sd, gens: C.totalGens(s), upsb: s.life.upsb, zone: s.life.bestZone,
      reb: s.life.reblooms, sup: s.life.supernovas, mem: s.life.memAll, cores: s.life.coreAll, time: s.life.time,
      crits: s.life.crits, sps: s.life.bestSps, offl: s.life.offl, exp: s.life.exp, autoUnlocked: m.autoUnlocked
    };
  };
  C.zoneProgress = function (s) {
    const z = D.ZONES, i = s.zone;
    if (i >= z.length - 1) return 1;
    const lo = z[i].thr > 0 ? Math.log10(z[i].thr) : 0, hi = Math.log10(z[i + 1].thr);
    return Math.max(0, Math.min(1, (Math.log10(Math.max(1, s.run.sd)) - lo) / (hi - lo)));
  };
  C.check = function (s) {
    const ev = [];
    let z = s.zone;
    while (z + 1 < D.ZONES.length && s.run.sd >= D.ZONES[z + 1].thr) z++;
    s.zone = z;
    while (s.life.bestZone < z) { s.life.bestZone++; ev.push({ type: 'zone', z: s.life.bestZone }); }
    const sps = C.rates(s).sd;
    if (sps > s.life.bestSps) s.life.bestSps = sps;
    const st = C.stats(s);
    D.MILESTONES.forEach((ms) => { if (!s.ms[ms.id] && ms.test(st)) { s.ms[ms.id] = 1; ev.push({ type: 'ms', id: ms.id }); } });
    let newAch = false;
    D.ACH.forEach((a) => { if (!s.ach[a.id] && st[a.stat] >= a.min) { s.ach[a.id] = 1; newAch = true; ev.push({ type: 'ach', id: a.id }); } });
    if (newAch) C.recalc(s);
    return ev;
  };

  // ---------- automation ----------
  function autoBuy(s, ev) {
    const m = cm(s);
    if (s.auto.gens) {
      D.GENS.forEach((g) => {
        const idx = D.SD_GENS.indexOf(g);
        if (g.makes === 'sd' ? idx >= m.autoGens : !m.autoRes) return;
        if (!C.genVisible(s, g)) return;
        const budget = s.res[g.costRes] * 0.4;
        const k = C.genMax(s, g, budget);
        if (k >= 1) C.buyGen(s, g.id, k, budget);
      });
    }
    if (s.auto.ups && m.autoUps) {
      const list = C.visibleUps(s).filter((u) => s.res[u.res] * 0.5 >= u.cost).sort((a, b) => a.cost - b.cost);
      for (let i = 0; i < list.length && i < 6; i++) C.buyUp(s, list[i].id);
    }
    if (s.auto.re && m.autoRe) {
      const g = C.rebloomGain(s);
      if (g >= 1 && g >= Math.max(1, s.memAll * s.auto.pct / 100)) ev.push({ type: 'rebloom', gain: C.rebloom(s).gain, auto: true });
    }
    if (s.auto.sn && cm(s).autoSn) {
      const g = C.supernovaGain(s);
      if (g >= 1 && g >= Math.max(1, s.life.coreAll * s.auto.pct / 100)) ev.push({ type: 'supernova', gain: C.supernova(s).gain, auto: true });
    }
  }

  function produce(s, dt) {
    const r = C.rates(s);
    for (let i = 0; i < RES.length; i++) give(s, RES[i], r[RES[i]] * dt);
  }

  // Advance the simulation by dt seconds. Returns an array of events.
  C.tick = function (s, dt) {
    const m = cm(s);
    let ev = NONE;
    produce(s, dt);
    if (m.autoTap > 0) {
      s._at = (s._at || 0) + m.autoTap * dt;
      const n = Math.floor(s._at);
      if (n > 0) { s._at -= n; C.tap(s, n); }
    }
    s.life.time += dt; s.run.time += dt;
    s._ac = (s._ac || 0) + dt;
    if (s._ac >= 1) { s._ac = 0; ev = []; autoBuy(s, ev); }
    s._ck = (s._ck || 0) + dt;
    if (s._ck >= 0.5) { s._ck = 0; ev = ev === NONE ? C.check(s) : ev.concat(C.check(s)); }
    return ev;
  };

  // Offline progress: capped duration, reduced efficiency, no compounding.
  C.offline = function (s, secs) {
    const m = cm(s);
    const used = Math.min(secs, m.offCap);
    const before = { sd: s.run.sd, sap: s.run.sap, pol: s.run.pol, sl: s.run.sl };
    produce(s, used * m.offEff);
    s.life.time += secs; s.run.time += secs; s.life.offl++;
    const events = C.check(s);
    const gained = {};
    RES.forEach((r) => { gained[r] = s.run[r] - before[r]; });
    return { secs, used, eff: m.offEff, capped: secs > m.offCap, gained, events };
  };

  // ---------- save / load ----------
  C.serialize = function (s) { return JSON.stringify(s, (k, v) => (k[0] === '_' ? undefined : v)); };
  const MAPS = ['gens', 'ups', 'memUp', 'coreUp', 'ach', 'ms'];
  function merge(dst, src) {
    for (const k in dst) {
      if (src[k] === undefined || src[k] === null || MAPS.indexOf(k) >= 0) continue;
      const d = dst[k];
      if (d && typeof d === 'object') { if (typeof src[k] === 'object') merge(d, src[k]); }
      else if (typeof d === typeof src[k]) dst[k] = src[k];
    }
  }
  C.deserialize = function (str) {
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== 'object' || !obj.res) throw new Error('Not a Seedling Cosmos save');
    const s = C.newState();
    merge(s, obj);
    MAPS.forEach((k) => { if (obj[k] && typeof obj[k] === 'object') s[k] = obj[k]; });
    ['res', 'run', 'life'].forEach((k) => { for (const r in s[k]) if (!isFinite(s[k][r])) s[k][r] = 0; });
    ['mem', 'memAll', 'cores'].forEach((k) => { if (!isFinite(s[k])) s[k] = 0; });
    s.last = Date.now();
    C.recalc(s);
    return s;
  };
  function b64enc(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function b64dec(b) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b)));
    return Buffer.from(b, 'base64').toString('utf8');
  }
  C.exportSave = function (s) { return 'SC1:' + b64enc(C.serialize(s)); };
  C.importSave = function (txt) {
    txt = String(txt).trim();
    if (txt.indexOf('SC1:') !== 0) throw new Error('Unrecognised save format');
    return C.deserialize(b64dec(txt.slice(4)));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.SC_CORE = C;
})(typeof self !== 'undefined' ? self : this);
