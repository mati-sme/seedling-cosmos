/* Seedling Cosmos v4 - UI wiring: tabs, home, upgrade maps, prestige, summary, settings, save/load, PWA registration. */
(function () {
  'use strict';
  const C = window.SC_CORE, D = window.SC_DATA, FX = window.SC_FX, MAP = window.SC_MAP, GAME = window.SC_GAME;
  const SAVE_KEY = 'seedling-cosmos-save-v2';
  const OLD_KEYS = ['seedling-cosmos-save-v1'];
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => C.fmt(n, S && S.settings.sci);
  const CURNAME = { main: 'Stardust', mem: 'Seeds', core: 'Star Cores' };
  const CURICON = { main: '✦', mem: '❀', core: '★' };

  let S, game, orb, stars, resetting = false, curTab = 'play', presKind = 'mem', sel = null, saveTimer = 0;
  const maps = {};

  // ---------- save / load ----------
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage blocked */ }
    let st = raw ? C.parse(raw) : null, oldFound = false;
    if (!st) {
      try { oldFound = OLD_KEYS.some((k) => localStorage.getItem(k) !== null); } catch (e) { /* ignore */ }
      if (raw) oldFound = true; // present but not a valid v2 save
      st = C.newState();
      if (oldFound) st.seen.oldReset = 1; // 1 = notice still to be shown
    }
    try { OLD_KEYS.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
    return st;
  }
  function save() {
    if (resetting) return;
    try { localStorage.setItem(SAVE_KEY, C.serialize(S)); } catch (e) { console.warn('Save failed', e); }
  }
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

  // ---------- small helpers ----------
  function toast(html, ms) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('toasts').appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }
  function modal(html, btns) {
    const box = $('modal-box'); box.innerHTML = html;
    if (btns && btns.length) {
      const row = document.createElement('div'); row.className = 'btns';
      btns.forEach((b) => { const el = document.createElement('button'); el.className = 'btn ' + (b.cls || ''); el.textContent = b.text; el.addEventListener('click', () => { if (!b.keep) closeModal(); if (b.fn) b.fn(); }); row.appendChild(el); });
      box.appendChild(row);
    }
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }
  function bigFlash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- top bar ----------
  const chips = {};
  function buildTop() {
    const res = $('res');
    [['main', 'Stardust', 'main'], ['mem', 'Seeds', 'seed'], ['core', 'Cores', 'core']].forEach(([k, label, cls]) => {
      const d = document.createElement('div'); d.className = 'chip ' + cls; d.innerHTML = '<b>0</b><small>' + label + '</small><i>' + CURICON[k] + '</i>'; res.appendChild(d);
      chips[k] = { el: d, b: d.firstChild, v: -1 };
    });
  }
  function renderTop() {
    const vals = { main: S.stardust, mem: S.seeds, core: S.cores };
    for (const k in chips) {
      const c = chips[k], v = vals[k];
      const show = k === 'main' || (k === 'mem' && (S.seeds > 0 || S.reblooms > 0)) || (k === 'core' && (S.cores > 0 || S.novas > 0));
      c.el.style.display = show ? '' : 'none';
      if (v !== c.v) { c.b.textContent = fmt(v); if (c.v >= 0 && v > c.v) { c.el.classList.add('pulse'); setTimeout(() => c.el.classList.remove('pulse'), 160); } c.v = v; }
    }
  }

  // ---------- nav / tabs ----------
  function switchTab(name) {
    curTab = name;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + name));
    $('main').classList.toggle('maps', name === 'garden' || name === 'prestige');
    $('main').scrollTop = 0;
    orb.visible = name === 'play';
    if (name !== 'garden' && name !== 'prestige') clearSel();
    if (name === 'play') renderHome();
    if (name === 'more') renderMore();
    if (name === 'garden') showMap('main');
    if (name === 'prestige') { renderPres(); showMap(presKind); }
    updateBadges();
  }
  function showMap(kind) {
    const v = maps[kind]; v.refresh(); v.show();
    if (!v.remembered) {
      // open on the frontier: the highest-order purchased node, or the seed
      const M = D.MAPS[kind]; let f = null;
      M.nodes.forEach((n) => { if (C.level(S, kind, n.id) > 0 && (!f || n.idx > f.idx)) f = n; });
      v.centerOn(f ? f.id : null, f ? 0.85 : 0.8, true);
    }
    if (kind === 'main' && !S.seen.firstGarden) {
      S.seen.firstGarden = 1;
      const first = cheapest('main');
      if (first) setTimeout(() => { select('main', first); }, 350);
    }
  }
  function cheapest(kind) {
    let best = null, bc = Infinity;
    D.MAPS[kind].nodes.forEach((n) => { const st = C.nodeState(S, kind, n); if (st === 'available' || st === 'owned') { const c = C.nodeCost(S, kind, n); if (c < bc) { bc = c; best = n; } } });
    return best;
  }
  function updateBadges() {
    const set = (tab, on) => { const u = document.querySelector('#nav button[data-tab="' + tab + '"] u'); if (u) u.classList.toggle('show', !!on && curTab !== tab); };
    let g = false; for (const n of D.MAIN.nodes) if (C.canBuy(S, 'main', n)) { g = true; break; }
    set('garden', g);
    let p = C.rebloomGain(S) >= 1 || C.novaGain(S) >= 1;
    if (!p) for (const k of ['mem', 'core']) { for (const n of D.MAPS[k].nodes) if (C.canBuy(S, k, n)) { p = true; break; } }
    set('prestige', p);
  }

  // ---------- home ----------
  function renderHome() {
    const st = C.stats(S);
    S.zone = Math.min(S.zone, st.maxZone);
    const z = D.ZONES[S.zone];
    $('zone-name').textContent = z.name; $('zone-blurb').textContent = z.blurb;
    $('zone-prev').disabled = S.zone <= 0; $('zone-next').disabled = S.zone >= st.maxZone;
    orb.setZone(S.zone, z.hue); stars.setHue(z.hue);
    $('zone-no').textContent = 'PLATE ' + (S.zone + 1) + ' / ' + (st.maxZone + 1);
    $('run-facts').innerHTML = '<div><span>Run length</span><b>' + Math.round(st.time) + 's</b></div>' +
      '<div><span>Zone yield</span><b>×' + fmt(D.BAL.ZONE_MUL[S.zone]) + '</b></div>' +
      '<div><span>Hammer</span><b>' + (st.hmOn ? st.hmRate.toFixed(2).replace(/0$/, '') + '/s' : 'locked') + '</b></div>' +
      '<div><span>Combo cap</span><b>×' + st.comboCap.toFixed(1) + '</b></div>';
    $('home-abilities').innerHTML = ['nova', 'slow', 'golden', 'magnet', 'chrono'].map((k) => '<span class="' + (st.ab[k] ? '' : 'locked') + '" title="' + esc(D.ABILITIES[k].name) + '">' + (st.ab[k] ? D.ABILITIES[k].icon : '+') + '</span>').join('');
    const next = cheapest('main'), ng = $('next-goal');
    if (next) {
      const c = C.nodeCost(S, 'main', next), pct = Math.min(100, S.stardust / c * 100);
      ng.innerHTML = '<span class="lbl">Next upgrade</span><b>' + next.icon + ' ' + esc(next.name) + '</b><em>' + fmt(c) + ' ✦</em><div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>';
    } else ng.innerHTML = C.counts(S, 'main').maxed === D.MAIN.nodes.length ? 'The Garden is fully grown! Rebloom for more.' : '';
    let hint = '';
    if (S.runs === 0) hint = 'Tap glowing seeds before they fade. Chain hits for bigger combos!';
    else if (next && S.stardust >= C.nodeCost(S, 'main', next)) hint = 'You can afford an upgrade - open the Garden tab';
    $('home-hint').textContent = hint;
  }
  function startRun() {
    if (game.isRunning() || S.pending) return;
    game.start(S.zone);
  }

  // ---------- summary ----------
  const sumFx = { parts: null, ctx: null, raf: 0, t: 0, last: 0 };
  function sumLoop(ts) {
    if ($('summary').hidden) return;
    sumFx.raf = requestAnimationFrame(sumLoop);
    const cv = $('sum-fx'), dt = Math.min(0.05, (ts - sumFx.last) / 1000 || 0.016); sumFx.last = ts;
    if (cv.width !== cv.clientWidth) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
    sumFx.t -= dt;
    if (sumFx.t <= 0) { sumFx.t = 0.3 + Math.random() * 0.3; sumFx.parts.burst(cv.width * (0.15 + Math.random() * 0.7), cv.height * (0.15 + Math.random() * 0.4), { n: 18, hue: 30 + Math.random() * 60, speed: 220, size: 3.2, star: true, life: 1.1 }); }
    sumFx.parts.update(dt); const c = sumFx.ctx; c.clearRect(0, 0, cv.width, cv.height); sumFx.parts.draw(c);
  }
  function showSummary(sum) {
    const best = sum.total > S.bestRun;
    $('summary').hidden = false;
    $('sum-best').textContent = best && S.runs > 0 ? 'NEW BEST' : '';
    const rows = [['Harvested in ' + D.ZONES[sum.zone].name, fmt(sum.raw)]];
    if (sum.collectMul > 1.0001) rows.push(['Collection bonus', '×' + sum.collectMul.toFixed(2)]);
    if (sum.steady > 0) rows.push(['Steady hands (75%+ accuracy)', '+' + Math.round(sum.steady * 100) + '%']);
    if (sum.hammerHits > 0) rows.push(['Hammer pops', String(sum.hammerHits)]);
    if (sum.crits > 0) rows.push(['Critical hits', String(sum.crits)]);
    $('sum-rows').innerHTML = rows.map((r, i) => '<div class="r" style="animation-delay:' + (0.15 + i * 0.12) + 's"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    $('sum-stats').innerHTML = '<div><b>' + sum.hits + '</b><small>pops</small></div><div><b>' + sum.maxCombo + '</b><small>best combo</small></div><div><b>' + Math.round(sum.accuracy * 100) + '%</b><small>accuracy</small></div>';
    // what the haul buys
    const after = S.stardust + sum.total; let n = 0, cheap = null, cc = Infinity;
    D.MAIN.nodes.forEach((nd) => { const s2 = C.nodeState(S, 'main', nd); if (s2 === 'available' || s2 === 'owned') { const c = C.nodeCost(S, 'main', nd); if (c <= after) n++; if (c < cc) { cc = c; cheap = nd; } } });
    $('sum-next').innerHTML = n > 0 ? 'You can afford <b>' + n + '</b> upgrade' + (n > 1 ? 's' : '') + '!' : cheap ? 'Next: ' + cheap.icon + ' ' + esc(cheap.name) + ' (' + fmt(cc) + ')' : '';
    // count-up
    const el = $('sum-total'), t0 = performance.now(), dur = 1200;
    (function tick(t) { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(sum.total * e); if (k < 1 && !$('summary').hidden) requestAnimationFrame(tick); else el.textContent = fmt(sum.total); })(t0);
    if (!sumFx.parts) { sumFx.parts = FX.Particles(); sumFx.ctx = $('sum-fx').getContext('2d'); }
    sumFx.parts.clear(); sumFx.t = 0; cancelAnimationFrame(sumFx.raf); sumFx.raf = requestAnimationFrame(sumLoop);
    FX.haptic([20, 30, 20]);
  }
  function collect() {
    const p = C.collectPending(S);
    $('summary').hidden = true; cancelAnimationFrame(sumFx.raf);
    renderTop(); save(); renderHome(); updateBadges();
    return p;
  }

  // ---------- upgrade maps ----------
  function makeMap(kind, host) {
    maps[kind] = MAP.create(host, {
      kind,
      map: D.MAPS[kind],
      level: (n) => C.level(S, kind, n.id),
      state: (n) => C.nodeState(S, kind, n),
      affordable: (n) => C.canBuy(S, kind, n),
      cost: (n) => fmt(C.nodeCost(S, kind, n)),
      onTap: (n) => { const h = $('hint-garden'); if (h) h.classList.add('gone'); if (n) select(kind, n); else clearSel(); }
    });
  }
  function select(kind, n) {
    if (sel && sel.kind !== kind && maps[sel.kind]) maps[sel.kind].select(null);
    sel = { kind, id: n.id };
    maps[kind].select(n.id);
    maps[kind].centerOn(n.id, null, false);
    renderSheet();
  }
  function clearSel() {
    if (sel && maps[sel.kind]) maps[sel.kind].select(null);
    sel = null; $('sheet').hidden = true;
  }
  function nowText(n, kind) {
    const f = n.fx, l = C.level(S, kind, n.id), st = D.STATS[f.s]; if (!l || !st || f.s === 'ab' || f.s === 'zone') return '';
    const stt = C.stats(S);
    if (f.s === 'missLoss') return 'Now: a miss costs ' + Math.round(stt.missLoss * 100) + '% of your combo';
    const tot = f.m !== undefined ? +Math.pow(f.m, l).toFixed(2) : +(f.a * l).toFixed(2);
    return 'This node now: ' + st.fmt(tot);
  }
  function renderSheet() {
    if (!sel) { $('sheet').hidden = true; return; }
    const kind = sel.kind, n = D.MAPS[kind].byId[sel.id], l = C.level(S, kind, n.id);
    $('sheet').hidden = false;
    $('sh-ic').textContent = n.icon; $('sh-name').textContent = n.name;
    const buy = $('sh-buy');
    if (n.root) {
      $('sh-lv').textContent = 'Where it all begins'; $('sh-desc').textContent = kind === 'main' ? 'Your Cosmic Seed. Every upgrade grows from here - buy a glowing node next to it.' : kind === 'mem' ? 'The root of your Memory. Perks here survive every Rebloom.' : 'The heart of the Constellation. Perks here survive every Supernova.';
      $('sh-now').textContent = ''; buy.className = 'btn big off'; buy.disabled = true; buy.textContent = 'Planted ✓'; return;
    }
    const st = C.nodeState(S, kind, n);
    $('sh-lv').textContent = (st === 'locked' ? 'Locked' : 'Level ' + l + ' / ' + n.max) + (st === 'maxed' ? ' · MAXED' : '');
    $('sh-desc').textContent = D.describe(n);
    $('sh-now').textContent = st === 'locked' ? 'Grow any connected node first: ' + n.parents.map((p) => D.MAPS[kind].byId[p].name).join(' or ') : nowText(n, kind);
    if (st === 'maxed') { buy.className = 'btn big off'; buy.disabled = true; buy.textContent = 'Maxed ✓'; }
    else if (st === 'locked') { buy.className = 'btn big off'; buy.disabled = true; buy.textContent = 'Locked'; }
    else {
      const c = C.nodeCost(S, kind, n), ok = S[C.CUR[kind]] >= c;
      buy.disabled = false; buy.className = 'btn big ' + (ok ? 'good' : 'off');
      buy.innerHTML = (l ? 'Upgrade' : 'Unlock') + ' · ' + fmt(c) + ' ' + CURICON[kind] + (ok ? '' : '<small>need ' + fmt(c - S[C.CUR[kind]]) + ' more</small>');
    }
  }
  function buyNode() {
    if (!sel) return;
    const kind = sel.kind, n = D.MAPS[kind].byId[sel.id];
    if (!C.canBuy(S, kind, n)) { FX.haptic(30); toast('Not enough ' + CURNAME[kind] + ' yet'); return; }
    C.buy(S, kind, n.id);
    maps[kind].refresh(); maps[kind].burst(n.id); FX.haptic(15);
    if (n.fx.s === 'ab') toast('New ability: <b>' + D.ABILITIES[n.fx.k].icon + ' ' + D.ABILITIES[n.fx.k].name + '</b>');
    else if (n.fx.s === 'zone') toast('New zone: <b>' + D.ZONES[n.fx.z].icon + ' ' + D.ZONES[n.fx.z].name + '</b>');
    else if (C.level(S, kind, n.id) >= n.max) toast('<b>' + esc(n.name) + '</b> maxed!');
    afterChange(); renderSheet();
  }
  function growAll(kind) {
    let count = 0, guard = 0; const bursts = [];
    while (guard++ < 800) {
      const n = cheapest(kind); if (!n || !C.canBuy(S, kind, n)) break;
      C.buy(S, kind, n.id); count++; if (bursts.length < 12 && bursts.indexOf(n.id) < 0) bursts.push(n.id);
    }
    if (!count) { toast('Nothing affordable yet - go collect more ' + CURNAME[kind] + '!'); FX.haptic(30); return; }
    maps[kind].refresh(); bursts.forEach((id, i) => setTimeout(() => maps[kind].burst(id), i * 50));
    FX.haptic([15, 20, 15]); toast('Grew <b>' + count + '</b> upgrade' + (count > 1 ? 's' : '') + '!');
    afterChange(); renderSheet();
  }
  function afterChange() { renderTop(); updateBadges(); if (curTab === 'prestige') renderPres(); saveSoon(); }

  // ---------- prestige ----------
  function renderPres() {
    document.querySelectorAll('#pres-seg button').forEach((b) => { b.classList.toggle('on', b.dataset.p === presKind); });
    const novaBtn = document.querySelector('#pres-seg button[data-p="core"]');
    const revealed = C.novaRevealed(S); novaBtn.disabled = !revealed; novaBtn.textContent = revealed ? 'Supernova' : '🔒 Supernova';
    const card = $('pres-card');
    if (presKind === 'mem') {
      const g = C.rebloomGain(S), req = D.BAL.REB_REQ;
      const pct = g > 0 ? 100 : Math.min(100, Math.log10(S.cycleEarned + 1) / Math.log10(req) * 100);
      card.innerHTML = '<div class="pc-info">Seeds of Memory <b>' + fmt(S.seeds) + '</b><br>' + (g > 0 ? 'Rebloom now for <b>+' + fmt(g) + '</b> Seeds' : 'Earn <b>' + fmt(req) + '</b> Stardust in one cycle to Rebloom') + '<div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div><small>This cycle: ' + fmt(S.cycleEarned) + ' ✦</small></div><button class="btn ' + (g > 0 ? 'glow' : 'off') + '" id="btn-prestige">Rebloom</button>';
    } else {
      const g = C.novaGain(S), req = D.BAL.NOVA_REQ;
      const pct = g > 0 ? 100 : Math.min(100, S.seedsEra / req * 100);
      card.innerHTML = '<div class="pc-info">Star Cores <b>' + fmt(S.cores) + '</b><br>' + (g > 0 ? 'Supernova now for <b>+' + fmt(g) + '</b> Cores' : 'Gather <b>' + fmt(req) + '</b> Seeds this era to Supernova') + '<div class="bar"><i style="width:' + pct.toFixed(0) + '%"></i></div><small>Seeds this era: ' + fmt(S.seedsEra) + ' ❀</small></div><button class="btn ' + (g > 0 ? 'glow' : 'off') + '" id="btn-prestige">Supernova</button>';
    }
    $('btn-prestige').addEventListener('click', () => confirmPrestige(presKind));
  }
  function setPresKind(k) {
    if (k === 'core' && !C.novaRevealed(S)) return;
    presKind = k; clearSel();
    $('map-mem').hidden = k !== 'mem'; $('map-core').hidden = k !== 'core';
    renderPres(); showMap(k);
  }
  function confirmPrestige(kind) {
    const g = kind === 'mem' ? C.rebloomGain(S) : C.novaGain(S);
    if (g < 1) { toast(kind === 'mem' ? 'Not enough Stardust earned this cycle yet.' : 'Not enough Seeds gathered this era yet.'); return; }
    if (kind === 'mem') modal('<div class="big-ic">🌸</div><h1>Rebloom?</h1><p>Gain <b>' + fmt(g) + ' Seeds of Memory</b>.</p><ul><li>Resets: Stardust and the whole Garden map</li><li>Keeps: Seeds, the Memory map, Cores, stats</li></ul><p class="muted">Memory perks make every next garden grow faster.</p>', [{ text: 'Not yet' }, { text: 'Rebloom!', cls: 'good', fn: () => doPrestige('mem') }]);
    else modal('<div class="big-ic">🌟</div><h1>Supernova?</h1><p>Gain <b>' + fmt(g) + ' Star Cores</b>.</p><ul><li>Resets: Stardust, the Garden map, Seeds and the Memory map' + (C.stats(S).memKeep > 0 ? ' (you keep ' + Math.round(Math.min(1, C.stats(S).memKeep) * 100) + '% of Memory levels)' : '') + '</li><li>Keeps: Star Cores, the Constellation map, stats</li></ul><p class="muted">Constellation perks are permanent.</p>', [{ text: 'Not yet' }, { text: 'Go Supernova!', cls: 'good', fn: () => doPrestige('core') }]);
  }
  function doPrestige(kind) {
    const g = kind === 'mem' ? C.rebloom(S) : C.supernova(S);
    if (!g) return;
    bigFlash(); FX.haptic([40, 60, 40, 60, 80]);
    clearSel(); maps.main.refresh(); maps.mem.refresh(); maps.core.refresh();
    renderTop(); renderPres(); renderHome(); updateBadges(); save();
    setTimeout(() => modal('<div class="big-ic">' + (kind === 'mem' ? '🌸' : '🌟') + '</div><h1>' + (kind === 'mem' ? 'Reborn!' : 'Supernova!') + '</h1><p>You gained <b>' + fmt(g) + (kind === 'mem' ? ' Seeds of Memory' : ' Star Cores') + '</b>.</p><p class="muted">Spend them on the ' + (kind === 'mem' ? 'Memory' : 'Constellation') + ' map, then grow a stronger garden.</p>', [{ text: 'Spend ' + (kind === 'mem' ? 'Seeds' : 'Cores'), cls: 'good', fn: () => { presKind = kind; setPresKind(kind); switchTab('prestige'); } }]), 450);
  }

  // ---------- more tab ----------
  function renderMore() {
    const rows = [
      ['Runs played', S.runs], ['Total pops', S.totalHits], ['Best run', fmt(S.bestRun) + ' ✦'], ['Best combo', S.bestCombo],
      ['Time in runs', C.fmtTime(S.playSeconds)], ['Stardust earned (all-time)', fmt(S.lifetime)],
      ['Reblooms', S.reblooms], ['Supernovas', S.novas]
    ];
    ['main', 'mem', 'core'].forEach((k) => { const c = C.counts(S, k); rows.push([{ main: 'Garden', mem: 'Memory', core: 'Constellation' }[k] + ' maxed', c.maxed + ' / ' + c.total + ' nodes']); });
    rows.push(['Run length', Math.round(C.stats(S).time) + 's']);
    $('stats').innerHTML = rows.map((r) => '<div class="stats-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    $('set-fx').checked = S.settings.fx; $('set-shake').checked = S.settings.shake; $('set-haptics').checked = S.settings.haptics; $('set-sci').checked = S.settings.sci;
  }
  function applySettings() { FX.on = S.settings.fx; FX.shake = S.settings.shake; FX.haptics = S.settings.haptics; }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Copied!'), () => toast('Select the text and copy it manually'));
    else toast('Select the text and copy it manually');
  }
  function exportSave() {
    const text = C.exportString(S);
    modal('<h1>Export save</h1><p>Copy this text and keep it somewhere safe.</p><textarea id="exp-text" readonly></textarea>', [{ text: 'Close' }, { text: 'Copy', cls: 'good', keep: true, fn: () => { $('exp-text').select(); copyText(text); } }]);
    $('exp-text').value = text;
  }
  function looksOld(txt) {
    try { const j = JSON.parse(txt.charAt(0) === '{' ? txt : decodeURIComponent(escape(atob(txt)))); return !!(j && typeof j === 'object'); } catch (e) { return false; }
  }
  function importSave() {
    modal('<h1>Import save</h1><p>Paste an exported save. <b>This replaces your current garden.</b></p><textarea id="imp-text" placeholder="SC2:..."></textarea>', [{ text: 'Cancel' }, {
      text: 'Import', cls: 'danger', keep: true, fn: () => {
        const txt = $('imp-text').value.trim(), st = C.parse(txt);
        if (!st) { toast(looksOld(txt) ? 'That save is from the old version and cannot be imported.' : 'That does not look like a valid save.'); return; }
        resetting = true;
        try { localStorage.setItem(SAVE_KEY, C.serialize(st)); } catch (e) { toast('Could not write the save'); resetting = false; return; }
        location.reload();
      }
    }]);
  }
  function hardReset() {
    modal('<div class="big-ic">⚠️</div><h1>Hard reset?</h1><p>This erases <b>everything</b>: Stardust, Seeds, Cores and every upgrade. It cannot be undone.</p>', [{ text: 'Keep playing' }, { text: 'Erase all', cls: 'danger', fn: () => { resetting = true; try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } location.reload(); } }]);
  }
  function oldSaveNotice() {
    modal('<div class="big-ic">🌱</div><h1>Seedling Cosmos was reborn</h1><p>This version is a brand-new game: timed runs, a giant upgrade map and two prestige maps.</p><p>Saves from the old version are not compatible, so your garden has been <b>reset</b>. Thanks for planting the first seed!</p>', [{ text: 'Let\'s grow!', cls: 'good', fn: () => { S.seen.oldReset = 2; save(); } }]);
  }

  // ---------- boot ----------
  function init() {
    S = load();
    save(); // persist right away so a reset-notice flag survives an early close
    applySettings();
    stars = FX.Starfield($('stars'));
    orb = FX.Orb($('orb'));
    buildTop();
    makeMap('main', $('map-main')); makeMap('mem', $('map-mem')); makeMap('core', $('map-core'));
    game = GAME.create({ state: S, canvas: $('run-canvas'), onEnd: (sum) => { save(); showSummary(sum); }, onQuit: () => { switchTab(curTab); } });

    document.querySelectorAll('#nav button').forEach((b) => b.addEventListener('click', () => { if (!game.isRunning()) switchTab(b.dataset.tab); }));
    $('btn-start').addEventListener('click', startRun);
    $('zone-prev').addEventListener('click', () => { if (S.zone > 0) { S.zone--; S.zonePicked = true; orb.bump(); renderHome(); saveSoon(); } });
    $('zone-next').addEventListener('click', () => { if (S.zone < C.stats(S).maxZone) { S.zone++; S.zonePicked = true; orb.bump(); renderHome(); saveSoon(); } });
    $('sum-run').addEventListener('click', () => { collect(); startRun(); });
    $('sum-spend').addEventListener('click', () => { collect(); switchTab('garden'); const n = cheapest('main'); if (n && C.canBuy(S, 'main', n)) setTimeout(() => select('main', n), 400); });
    $('sh-buy').addEventListener('click', buyNode);
    $('sh-x').addEventListener('click', clearSel);
    $('btn-grow').addEventListener('click', () => growAll('main'));
    $('btn-grow-p').addEventListener('click', () => growAll(presKind));
    $('btn-center').addEventListener('click', () => maps.main.fit());
    $('btn-zin').addEventListener('click', () => maps.main.zoomBy(1.35)); $('btn-zout').addEventListener('click', () => maps.main.zoomBy(1 / 1.35));
    $('btn-pcenter').addEventListener('click', () => maps[presKind].fit());
    $('btn-pzin').addEventListener('click', () => maps[presKind].zoomBy(1.35)); $('btn-pzout').addEventListener('click', () => maps[presKind].zoomBy(1 / 1.35));
    document.querySelectorAll('#pres-seg button').forEach((b) => b.addEventListener('click', () => setPresKind(b.dataset.p)));
    ['fx', 'shake', 'haptics', 'sci'].forEach((k) => $('set-' + k).addEventListener('change', (e) => { S.settings[k] = e.target.checked; applySettings(); renderTop(); saveSoon(); }));
    $('btn-save').addEventListener('click', () => { save(); toast('Saved'); });
    $('btn-export').addEventListener('click', exportSave); $('btn-import').addEventListener('click', importSave); $('btn-reset').addEventListener('click', hardReset);
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

    renderTop(); renderHome(); updateBadges();
    setInterval(() => { if (!document.hidden) { updateBadges(); if (curTab === 'play' && !game.isRunning()) renderHome(); } }, 1500);
    setInterval(save, 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    addEventListener('pagehide', save);

    if (S.pending) showSummary(S.pending);           // a run finished but was never collected
    else if (S.seen.oldReset === 1) oldSaveNotice(); // one-time notice after an old-format save was reset

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      const had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Update installed - <b>reload</b> for the newest version', 6000); });
    }
    window.__SC = { get S() { return S; }, game, maps, switchTab, select, save };
  }
  init();
})();
