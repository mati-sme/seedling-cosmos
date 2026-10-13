/* Seedling Cosmos - UI, game loop, save/load, PWA registration. */
(function () {
  'use strict';
  const C = window.SC_CORE, D = window.SC_DATA, FX = window.SC_FX;
  const SAVE_KEY = 'seedling-cosmos-save-v1';
  const ZONE_ICONS = ['🌱', '🌙', '🌍', '☀️', '🌌', '🌀', '🌳', '🕳️', '🌸', '🔮'];
  const MEM_ICON = '🌰', CORE_ICON = '💠';
  const $ = (id) => document.getElementById(id);

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) { const c = arguments[i]; if (c) el.append(c); }
    return el;
  }

  // ---------- state & persistence ----------
  let S, resetting = false;
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return C.deserialize(raw);
    } catch (e) { console.warn('Save load failed', e); }
    return C.newState();
  }
  function save() {
    if (resetting) return;
    S.last = Date.now();
    try { localStorage.setItem(SAVE_KEY, C.serialize(S)); } catch (e) { console.warn('Save failed', e); }
  }
  const f = (n) => C.fmt(n, S.set.sci);

  // ---------- toasts & modals ----------
  function toast(html, cls) {
    const box = $('toasts');
    const el = h('div', { class: 'toast ' + (cls || ''), html });
    box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), 4100);
  }
  const mq = [];
  let mOpen = false;
  function modal(o) { mq.push(o); if (!mOpen) nextModal(); }
  function nextModal() {
    const o = mq.shift();
    if (!o) { mOpen = false; $('modal').hidden = true; return; }
    mOpen = true;
    const box = $('modal-box');
    box.textContent = '';
    if (o.icon) box.append(h('div', { class: 'big-ic', text: o.icon }));
    if (o.title) box.append(h('h1', { text: o.title }));
    if (o.html) box.append(h('div', { html: o.html }));
    if (o.node) box.append(o.node);
    const btns = h('div', { class: 'btns' });
    (o.buttons || [{ text: 'Continue' }]).forEach((b) => {
      const el = h('button', { class: 'btn ' + (b.cls || ''), text: b.text });
      el.onclick = () => {
        mOpen = false; $('modal').hidden = true;
        if (b.fn) b.fn();
        if (!mOpen) nextModal();
      };
      btns.append(el);
    });
    box.append(btns);
    $('modal').hidden = false;
  }
  function confirmBox(title, html, okText, fn, cls) {
    modal({ title, html, buttons: [{ text: 'Cancel' }, { text: okText, cls: cls || 'good', fn }] });
  }

  // ---------- events: fanfare ----------
  function fanfareZone(z) {
    const zn = D.ZONES[z];
    const items = [];
    Object.keys(D.RES).forEach((r) => { if (D.RES[r].zone === z && z > 0) items.push('New resource: ' + D.RES[r].icon + ' ' + D.RES[r].name); });
    D.GENS.forEach((g) => { if (g.zone === z && z > 0) items.push('New helper: ' + g.icon + ' ' + g.name); });
    modal({
      icon: ZONE_ICONS[z] || '✨', title: zn.name,
      html: '<p>' + zn.desc + '</p>' + (items.length ? '<ul>' + items.map((i) => '<li>' + i + '</li>').join('') + '</ul>' : ''),
      buttons: [{ text: 'Onward!', cls: 'good' }]
    });
    planet.burst(170, 170, 90, zn.hue, 2.2);
  }
  function handleEvents(ev) {
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'zone') fanfareZone(e.z);
      else if (e.type === 'ms') {
        const ms = D.MILESTONES.filter((m) => m.id === e.id)[0];
        if (e.id === 'complete') modal({ icon: '🔮', title: ms.name, html: '<p>' + ms.text + '</p>', buttons: [{ text: 'Keep growing', cls: 'good' }] });
        else toast('🔓 <b>' + ms.name + '</b><br>' + ms.text);
        refreshNav(true);
      } else if (e.type === 'ach') {
        const a = D.ACH.filter((x) => x.id === e.id)[0];
        toast('🏆 <b>' + a.name + '</b><br>' + a.desc, 'ach');
        achDirty = true;
      } else if (e.type === 'rebloom') { toast('🌸 Auto-Rebloom: <b>+' + f(e.gain) + '</b> Seeds of Memory'); structDirty = true; }
      else if (e.type === 'supernova') { toast('💥 Auto-Supernova: <b>+' + f(e.gain) + '</b> Star Cores'); structDirty = true; }
    }
  }

  // ---------- tabs ----------
  let tab = 'garden', structDirty = true, achDirty = true;
  const navBtns = Array.prototype.slice.call(document.querySelectorAll('#nav button'));
  function showTab(name) {
    tab = name;
    document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.id === 'tab-' + name));
    navBtns.forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    planet.visible = name === 'garden';
    $('main').scrollTop = 0;
    structDirty = true;
    updateTab(true);
  }
  navBtns.forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  function refreshNav() {
    const vis = { helpers: S.ms.helpers, upgrades: S.ms.upgrades, prestige: S.ms.prestige, trophies: S.ms.trophies };
    navBtns.forEach((b) => { if (vis[b.dataset.tab] !== undefined) b.hidden = !vis[b.dataset.tab]; });
  }

  // ---------- top bar ----------
  let chipKey = '', chips = {};
  function updateTop() {
    const keys = D.RES_ORDER.filter((r) => S.life.bestZone >= D.RES[r].zone);
    if (S.memAll > 0 || S.mem > 0) keys.push('mem');
    if (S.life.coreAll > 0) keys.push('cores');
    const key = keys.join();
    if (key !== chipKey) {
      chipKey = key; chips = {};
      const root = $('res'); root.textContent = '';
      keys.forEach((k) => {
        const meta = k === 'mem' ? { name: 'Seeds of Memory', icon: MEM_ICON } : k === 'cores' ? { name: 'Star Cores', icon: CORE_ICON } : D.RES[k];
        const b = h('b'), sm = h('small');
        const el = h('div', { class: 'chip' + (k === 'sd' ? ' main' : '') }, b, sm);
        el.dataset.name = meta.name; el.dataset.icon = meta.icon;
        root.append(el); chips[k] = { b, sm };
      });
    }
    const r = C.rates(S);
    for (const k in chips) {
      const c = chips[k];
      let v, rate;
      if (k === 'mem') { v = S.mem; rate = null; } else if (k === 'cores') { v = S.cores; rate = null; } else { v = S.res[k]; rate = r[k]; }
      const meta = c.b.parentNode.dataset;
      const t1 = meta.icon + ' ' + f(v), t2 = rate !== null ? meta.name + ' · ' + f(rate) + '/s' : meta.name;
      if (c.b.textContent !== t1) c.b.textContent = t1;
      if (c.sm.textContent !== t2) c.sm.textContent = t2;
    }
  }

  // ---------- garden ----------
  let planet, stars, lastZoneShown = -1, tabCache = {};
  function updateGarden() {
    const z = D.ZONES[S.zone], nz = D.ZONES[S.zone + 1];
    if (S.zone !== lastZoneShown) {
      lastZoneShown = S.zone;
      $('zone-name').textContent = z.name; $('zone-desc').textContent = z.desc;
      planet.setZone(S.zone, z.hue); stars.setHue(z.hue + 100);
    }
    const p = C.zoneProgress(S);
    $('zone-fill').style.width = (p * 100).toFixed(1) + '%';
    $('zone-label').textContent = nz ? 'Next: ' + nz.name + ' at ' + f(nz.thr) + ' ✦ (' + Math.floor(p * 100) + '%)' : 'The Worldtree stands complete';
    const m = S._m, rt = C.rates(S);
    $('st-tap').textContent = f(C.tapValue(S));
    $('st-sps').textContent = f(rt.sd);
    $('st-auto').textContent = f(m.autoTap);
    $('tap-hint').style.opacity = S.life.taps > 8 ? 0 : 1;
    const g = C.rebloomGain(S), btn = $('rebloom-banner');
    btn.hidden = !(S.ms.prestige && g >= 1);
    if (!btn.hidden) btn.textContent = '🌸 Rebloom ready: +' + f(g) + ' Seeds of Memory';
  }
  $('rebloom-banner').onclick = () => showTab('prestige');

  // ---------- helpers tab ----------
  let genRefs = [], genKey = '';
  function buildGens() {
    const list = $('gen-list');
    const vis = D.GENS.filter((g) => C.genVisible(S, g));
    const next = D.GENS.filter((g) => !C.genVisible(S, g)).sort((a, b) => a.zone - b.zone)[0];
    const key = vis.map((g) => g.id).join() + '|' + (next ? next.id : '');
    if (key === genKey) return;
    genKey = key; list.textContent = ''; genRefs = [];
    vis.forEach((g) => {
      const cnt = h('em'), ds = h('div', { class: 'ds' }), tot = h('div', { class: 'ds' });
      const bl = h('b'), bs = h('span');
      const btn = h('button', { class: 'btn buy' }, bl, bs);
      const el = h('div', { class: 'item' }, h('div', { class: 'ic', text: g.icon }),
        h('div', { class: 'body' }, h('div', { class: 'nm' }, h('span', { text: g.name }), cnt), ds, tot), btn);
      btn.onclick = () => {
        const mode = S.set.buy;
        if (C.buyGen(S, g.id, mode)) { planet.burst(170, 200, 8, 140); updateGens(); } else btn.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 150 });
      };
      list.append(el);
      genRefs.push({ g, el, cnt, ds, tot, bl, bs, btn });
    });
    if (next) list.append(h('div', { class: 'item locked' }, h('div', { class: 'ic', text: '🔒' }),
      h('div', { class: 'body' }, h('div', { class: 'nm', text: '???' }), h('div', { class: 'ds', text: 'Discover the ' + D.ZONES[next.zone].name + ' to meet a new helper.' }))));
  }
  function updateGens() {
    buildGens();
    const m = S._m, mode = S.set.buy;
    genRefs.forEach((r) => {
      const g = r.g, n = S.gens[g.id] || 0;
      let per = g.out * (m.gen[g.id] || 1) * m.genAll;
      per *= g.makes === 'sd' ? m.staticMul * C.dyn(S) : m.res[g.makes];
      const k = mode === 'max' ? Math.max(1, C.genMax(S, g)) : mode;
      const cost = C.genCost(S, g, k);
      const can = S.res[g.costRes] >= cost;
      r.cnt.textContent = 'x' + n;
      r.ds.textContent = g.desc;
      r.tot.textContent = D.RES[g.makes].icon + ' ' + f(per) + '/s each · ' + f(per * n) + '/s total';
      r.bl.textContent = 'Buy ' + k;
      r.bs.textContent = f(cost) + ' ' + D.RES[g.costRes].icon;
      r.btn.classList.toggle('off', !can);
      r.el.classList.toggle('can', can);
    });
    updateAutoPanel();
  }
  let autoKey = '';
  function updateAutoPanel() {
    const m = S._m, panel = $('auto-panel');
    const key = [m.autoGens, m.autoRes, m.autoUps, m.autoRe, m.autoSn].join();
    panel.hidden = !S.ms.automation;
    $('buy-modes').hidden = !S.ms.bulk;
    if (!S.ms.bulk) S.set.buy = 1;
    if (key === autoKey) return;
    autoKey = key; panel.textContent = '';
    panel.append(h('b', { text: 'Automation' }));
    const row = (label, get, set) => {
      const cb = h('input', { type: 'checkbox' }); cb.checked = get(); cb.onchange = () => set(cb.checked);
      panel.append(h('label', { class: 'auto-row' }, h('span', { text: label }), cb));
    };
    if (m.autoGens > 0 || m.autoRes > 0) row('Auto-buy helpers', () => S.auto.gens, (v) => { S.auto.gens = v; });
    if (m.autoUps) row('Auto-buy upgrades', () => S.auto.ups, (v) => { S.auto.ups = v; });
    if (m.autoRe) row('Auto-Rebloom', () => S.auto.re, (v) => { S.auto.re = v; });
    if (m.autoSn) row('Auto-Supernova', () => S.auto.sn, (v) => { S.auto.sn = v; });
    if (m.autoRe || m.autoSn) {
      const sel = h('select');
      [25, 50, 100, 200, 400].forEach((p) => sel.append(h('option', { value: p, text: p + '%' })));
      sel.value = S.auto.pct; sel.onchange = () => { S.auto.pct = +sel.value; };
      panel.append(h('div', { class: 'auto-row' }, h('span', { text: 'Prestige when gain ≥ this % of current total' }), sel));
    }
  }
  document.querySelectorAll('#buy-modes button').forEach((b) => {
    b.onclick = () => {
      S.set.buy = b.dataset.mode === 'max' ? 'max' : +b.dataset.mode;
      document.querySelectorAll('#buy-modes button').forEach((x) => x.classList.toggle('on', x === b));
      updateGens();
    };
  });

  // ---------- upgrades tab ----------
  let upKey = '', upRefs = [];
  function upIcon(u) {
    const f = u.fx;
    if (f.g) return D.GEN_BY_ID[f.g].icon;
    if (f.r) return D.RES[f.r].icon;
    if (f.tap) return '👆'; if (f.tapSps) return '🎵'; if (f.crit || f.critMul) return '🍀'; if (f.autoTap) return '🤖';
    if (f.all) return '🌞'; if (f.costMul) return '🏷️'; if (f.autoGens || f.autoRes) return '📖'; return '🌙';
  }
  function updateUpgrades() {
    const ups = C.visibleUps(S).sort((a, b) => a.cost - b.cost);
    const key = ups.map((u) => u.id).join();
    if (key !== upKey) {
      upKey = key; upRefs = [];
      const list = $('up-list'); list.textContent = '';
      if (ups.length) {
        const all = h('button', { class: 'btn small', text: 'Buy all affordable', style: 'margin-bottom:8px;width:100%' });
        all.onclick = () => { let n = 0; C.visibleUps(S).sort((a, b) => a.cost - b.cost).forEach((u) => { if (C.buyUp(S, u.id)) n++; }); if (n) toast('Bought ' + n + ' upgrade' + (n > 1 ? 's' : '')); updateUpgrades(); };
        list.append(all);
      } else list.append(h('p', { class: 'muted center', text: 'No upgrades available yet. Keep growing!' }));
      ups.forEach((u) => {
        const bl = h('b'), bs = h('span');
        const btn = h('button', { class: 'btn buy' }, bl, bs);
        const el = h('div', { class: 'item' }, h('div', { class: 'ic', text: upIcon(u) }),
          h('div', { class: 'body' }, h('div', { class: 'nm', text: u.name }), h('div', { class: 'ds', text: u.desc })), btn);
        btn.onclick = () => { if (C.buyUp(S, u.id)) { planet.burst(170, 170, 10, 50); upKey = ''; updateUpgrades(); } };
        bl.textContent = f(u.cost); bs.textContent = D.RES[u.res].icon + ' ' + D.RES[u.res].name;
        list.append(el); upRefs.push({ u, el, btn });
      });
    }
    upRefs.forEach((r) => { const can = S.res[r.u.res] >= r.u.cost; r.el.classList.toggle('can', can); r.btn.classList.toggle('off', !can); });
    $('up-info').textContent = Object.keys(S.ups).length + ' upgrades active this run · ' + S.life.upsb + ' bought in total';
  }

  // ---------- prestige tab ----------
  let pre = null;
  function buildTree(container, tree, kind) {
    const refs = [];
    tree.forEach((n) => {
      const lv = h('div', { class: 'lv' }), cost = h('div', { class: 'cost' });
      const b = h('button', { class: 'node' }, h('b', { text: n.name }), h('small', { text: n.desc }), lv, cost);
      b.onclick = () => {
        const ok = kind === 'mem' ? C.buyMem(S, n.id) : C.buyCore(S, n.id);
        if (ok) { planet.burst(170, 170, 16, kind === 'mem' ? 140 : 210); updatePrestige(); }
      };
      container.append(b); refs.push({ n, b, lv, cost });
    });
    return refs;
  }
  function updateTree(refs, levels, cur, icon) {
    refs.forEach((r) => {
      const l = levels[r.n.id] || 0, maxed = l >= r.n.max;
      r.lv.textContent = r.n.max === 1 ? (l ? 'Unlocked' : 'Locked') : 'Level ' + l + '/' + r.n.max;
      const c = maxed ? 0 : C.treeCost(r.n, l);
      r.cost.textContent = maxed ? 'MAX' : icon + ' ' + f(c);
      r.b.classList.toggle('max', maxed);
      r.b.classList.toggle('can', !maxed && cur >= c);
    });
  }
  function buildPrestige() {
    const rc = $('rebloom-card'), sc = $('sn-card');
    const mk = (root, kind) => {
      const info = h('p', { class: 'muted' }), bar = h('div', { class: 'bar' }, h('i'), h('span'));
      const gain = h('div', { class: 'big-num' }), sub = h('div', { class: 'muted' });
      const btn = h('button', { class: 'btn big' });
      root.append(info, bar, h('div', { style: 'text-align:center;margin:10px 0 2px' }, gain, sub), btn);
      return { info, bar, fill: bar.firstChild, label: bar.lastChild, gain, sub, btn };
    };
    pre = { re: mk(rc), sn: mk(sc) };
    pre.re.info.textContent = 'Reset your garden (Stardust, helpers, upgrades) to gather Seeds of Memory. Seeds boost all production and buy permanent upgrades.';
    pre.sn.info.textContent = 'Ignite a star: resets Seeds of Memory and the Memory tree too, but grants Star Cores, which are permanent forever and power the Constellation.';
    pre.re.btn.onclick = () => {
      const g = C.rebloomGain(S);
      if (g < 1) return;
      confirmBox('Rebloom?', '<p>Your Stardust, helpers and upgrades reset.<br>You gain <b>' + f(g) + ' ' + MEM_ICON + ' Seeds of Memory</b>.</p>', 'Rebloom!', doRebloom);
    };
    pre.sn.btn.onclick = () => {
      const g = C.supernovaGain(S);
      if (g < 1) return;
      confirmBox('Supernova?', '<p>Everything resets, <b>including Seeds of Memory and the Memory tree</b>.<br>You gain <b>' + f(g) + ' ' + CORE_ICON + ' Star Cores</b>.</p>', 'Go Supernova!', doSupernova, 'danger');
    };
    pre.memRefs = buildTree($('mem-tree'), D.MEM_TREE, 'mem');
    pre.coreRefs = buildTree($('core-tree'), D.CORE_TREE, 'core');
  }
  function updatePrestige() {
    if (!pre) buildPrestige();
    const T = D.T, g = C.rebloomGain(S), re = pre.re;
    const p = Math.min(1, Math.log10(Math.max(1, S.run.sd)) / Math.log10(T.RE_REQ));
    re.fill.style.width = (p * 100).toFixed(1) + '%';
    re.label.textContent = g >= 1 ? 'Ready' : f(S.run.sd) + ' / ' + f(T.RE_REQ) + ' ✦ needed';
    re.gain.textContent = g >= 1 ? '+' + f(g) + ' ' + MEM_ICON : MEM_ICON + ' —';
    const mult = 1 + T.MEM_BONUS * Math.pow(S.memAll, T.MEM_EXP);
    re.sub.textContent = f(S.memAll) + ' Seeds earned this cycle · production x' + f(mult);
    re.btn.textContent = g >= 1 ? '🌸 Rebloom' : 'Not ready'; re.btn.classList.toggle('off', g < 1);
    updateTree(pre.memRefs, S.memUp, S.mem, MEM_ICON);
    $('sn-section').hidden = !S.ms.supernova;
    if (S.ms.supernova) {
      const sg = C.supernovaGain(S), sn = pre.sn, req = C.snReq(S);
      sn.fill.style.width = Math.min(100, S.memAll / req * 100).toFixed(1) + '%';
      sn.label.textContent = sg >= 1 ? 'Ready' : f(S.memAll) + ' / ' + f(req) + ' Seeds ' + MEM_ICON + ' earned';
      sn.gain.textContent = sg >= 1 ? '+' + f(sg) + ' ' + CORE_ICON : CORE_ICON + ' —';
      sn.sub.textContent = f(S.life.coreAll) + ' Star Cores earned · production x' + f(1 + T.CORE_BONUS * Math.pow(S.life.coreAll, T.CORE_EXP));
      sn.btn.textContent = sg >= 1 ? '💥 Supernova' : 'Not ready'; sn.btn.classList.toggle('off', sg < 1);
      updateTree(pre.coreRefs, S.coreUp, S.cores, CORE_ICON);
    }
  }
  function afterPrestige() {
    genKey = ''; upKey = ''; structDirty = true;
    handleEvents(C.check(S));
    planet.burst(170, 170, 100, 330, 2.5);
    save(); refreshNav();
  }
  function doRebloom() {
    const r = C.rebloom(S);
    if (!r) return;
    afterPrestige();
    modal({ icon: '🌸', title: 'Rebloom!', html: '<p>The garden resets, but its memory remains.<br><b>+' + f(r.gain) + ' ' + MEM_ICON + ' Seeds of Memory</b></p><p>Spend them in the Tree of Memory.</p>', buttons: [{ text: 'To the Tree', cls: 'good', fn: () => showTab('prestige') }] });
  }
  function doSupernova() {
    const r = C.supernova(S);
    if (!r) return;
    afterPrestige();
    modal({ icon: '💥', title: 'Supernova!', html: '<p>A star is born from your garden.<br><b>+' + f(r.gain) + ' ' + CORE_ICON + ' Star Cores</b></p><p>Cores are permanent. Spend them in the Constellation.</p>', buttons: [{ text: 'To the Constellation', cls: 'good', fn: () => showTab('prestige') }] });
  }

  // ---------- trophies ----------
  let achRefs = null;
  function updateTrophies() {
    if (!achRefs) {
      achRefs = {};
      const list = $('ach-list');
      D.ACH.forEach((a) => {
        const el = h('div', { class: 'ach' }, h('b', { text: a.name }), h('span', { text: a.desc }));
        list.append(el); achRefs[a.id] = el;
      });
    }
    let n = 0;
    D.ACH.forEach((a) => { const has = !!S.ach[a.id]; if (has) n++; achRefs[a.id].classList.toggle('have', has); });
    $('ach-info').textContent = n + ' / ' + D.ACH.length + ' unlocked · +' + (n * D.T.ACH_BONUS * S._m.achMul * 100).toFixed(0) + '% production';
    const L = S.life, rows = [
      ['Time played', C.fmtTime(L.time)], ['Taps', f(L.taps)], ['Critical taps', f(Math.floor(L.crits))], ['Stardust produced', f(L.sd)],
      ['Best Stardust/s', f(L.bestSps)], ['Helpers owned', f(C.totalGens(S))], ['Upgrades bought', f(L.upsb)],
      ['Best zone', D.ZONES[L.bestZone].name], ['Reblooms', f(L.reblooms)], ['Seeds of Memory earned', f(L.memAll)],
      ['Supernovas', f(L.supernovas)], ['Star Cores earned', f(L.coreAll)], ['Offline returns', f(L.offl)]
    ];
    const box = $('stats'); box.textContent = '';
    rows.forEach((r) => box.append(h('div', { class: 'row' }, h('span', { text: r[0] }), h('b', { text: r[1] }))));
  }

  // ---------- settings ----------
  function copyText(ta) {
    ta.select(); ta.setSelectionRange(0, 1e7);
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value); else document.execCommand('copy');
      toast('Save copied to clipboard');
    } catch (e) { toast('Select the text and copy it manually'); }
  }
  function setupSettings() {
    $('set-fx').checked = S.set.fx; $('set-sci').checked = S.set.sci;
    $('set-fx').onchange = (e) => { S.set.fx = e.target.checked; FX.on = S.set.fx; };
    $('set-sci').onchange = (e) => { S.set.sci = e.target.checked; };
    $('btn-save').onclick = () => { save(); toast('Game saved'); };
    $('btn-export').onclick = () => {
      S.life.exp++; handleEvents(C.check(S)); save();
      const ta = h('textarea', { readonly: 'readonly' }); ta.value = C.exportSave(S);
      modal({ title: 'Export save', html: '<p>Copy this text and keep it safe. Use Import to restore it.</p>', node: ta, buttons: [{ text: 'Close' }, { text: 'Copy', cls: 'good', fn: () => { copyText(ta); } }] });
      ta.onclick = () => ta.select();
    };
    $('btn-import').onclick = () => {
      const ta = h('textarea', { placeholder: 'Paste your save text here (starts with SC1:)' });
      modal({
        title: 'Import save', html: '<p>This <b>replaces</b> your current game.</p>', node: ta,
        buttons: [{ text: 'Cancel' }, {
          text: 'Import', cls: 'danger', fn: () => {
            try { const ns = C.importSave(ta.value); S = ns; save(); location.reload(); } catch (e) { toast('Import failed: ' + e.message); }
          }
        }]
      });
    };
    $('btn-reset').onclick = () => confirmBox('Hard reset?', '<p>This <b>permanently deletes</b> all progress, including Seeds of Memory, Star Cores and achievements.</p>', 'Delete everything', () => {
      resetting = true; localStorage.removeItem(SAVE_KEY); location.reload();
    }, 'danger');
  }

  // ---------- tab dispatcher ----------
  function updateTab(force) {
    if (tab === 'garden') updateGarden();
    else if (tab === 'helpers') updateGens();
    else if (tab === 'upgrades') updateUpgrades();
    else if (tab === 'prestige') updatePrestige();
    else if (tab === 'trophies' && (achDirty || force || S.life.time % 5 < 0.3)) { updateTrophies(); achDirty = false; }
  }
  function updateDots() {
    const dot = (name, on) => { const b = navBtns.filter((x) => x.dataset.tab === name)[0]; if (b) b.querySelector('u').classList.toggle('show', on && tab !== name); };
    dot('helpers', D.SD_GENS.some((g) => C.genVisible(S, g) && S.res.sd >= C.genCost(S, g, 1)));
    dot('upgrades', C.visibleUps(S).some((u) => S.res[u.res] >= u.cost));
    dot('prestige', C.rebloomGain(S) >= 1 || C.supernovaGain(S) >= 1);
  }

  // ---------- offline ----------
  function doOffline(gap) {
    const r = C.offline(S, gap);
    if (gap >= 60) {
      const lines = D.RES_ORDER.filter((k) => S.life.bestZone >= D.RES[k].zone && r.gained[k] > 0)
        .map((k) => '<li>' + D.RES[k].icon + ' +' + f(r.gained[k]) + ' ' + D.RES[k].name + '</li>').join('');
      modal({
        icon: '🌙', title: 'Welcome back!',
        html: '<p>You were away for <b>' + C.fmtTime(r.secs) + '</b>.<br>Your garden kept growing for up to <b>' + C.fmtTime(r.used) + '</b>' + (r.capped ? ' (offline cap reached)' : '') +
          ' at <b>' + Math.round(r.eff * 100) + '%</b> efficiency.</p><ul>' + lines + '</ul>',
        buttons: [{ text: 'Lovely!', cls: 'good' }]
      });
    }
    handleEvents(r.events);
    save();
  }

  // ---------- main loop ----------
  let acc = 0, slow = 0;
  function loop() {
    const now = Date.now();
    let gap = (now - S.last) / 1000;
    if (!(gap > 0)) gap = 0;
    S.last = now;
    if (gap > 10) doOffline(gap);
    else { const ev = C.tick(S, gap); if (ev.length) handleEvents(ev); }
    updateTop();
    acc += gap; slow += gap;
    if (tab === 'garden') updateGarden();
    if (acc >= 0.25) { acc = 0; if (tab !== 'garden') updateTab(false); }
    if (slow >= 1) { slow = 0; updateDots(); }
  }

  // ---------- init ----------
  function init() {
    S = load();
    FX.on = S.set.fx;
    stars = FX.Starfield($('stars'));
    planet = FX.Planet($('planet'));
    handleEvents([]); C.check(S);
    refreshNav(); setupSettings();
    document.querySelectorAll('#buy-modes button').forEach((x) => x.classList.toggle('on', x.dataset.mode === String(S.set.buy)));

    const cv = $('planet');
    function doTap(cx, cy) {
      const rect = cv.getBoundingClientRect();
      const x = (cx - rect.left) / rect.width * 340, y = (cy - rect.top) / rect.height * 340;
      const r = C.tap(S, 1);
      planet.bounce();
      planet.burst(x, y, r.crit ? 28 : 7, D.ZONES[S.zone].hue + 20, r.crit ? 1.8 : 1);
      FX.popup($('pop-layer'), x / 340 * rect.width, y / 340 * rect.height - 10, '+' + f(r.amt) + (r.crit ? '!' : ''), r.crit);
      if (r.crit && navigator.vibrate) navigator.vibrate(10);
    }
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); doTap(e.clientX, e.clientY); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.tabIndex = 0;
    cv.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const r = cv.getBoundingClientRect(); doTap(r.left + r.width / 2, r.top + r.height / 2); } });

    const gap = (Date.now() - S.last) / 1000;
    if (gap > 10) doOffline(gap);
    updateTop(); updateGarden();
    setInterval(loop, 100);
    setInterval(save, 10000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else loop(); });
    addEventListener('pagehide', save);
    window.SC_DEBUG = { get state() { return S; }, core: C };

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
    }
  }
  init();
})();
