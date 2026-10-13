/* Seedling Cosmos v2 - pannable / pinch-zoomable upgrade map (SVG), shared by all three upgrade trees. */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const CIRC = 2 * Math.PI * 31;
  const MIN_S = 0.28, MAX_S = 2.4;

  /* opts: {
       map: {nodes, byId, edges, labels}, level(n) -> int, state(n) -> 'locked'|'available'|'owned'|'maxed',
       affordable(n) -> bool, cost(n) -> string, onTap(node|null) } */
  function create(host, opts) {
    const map = opts.map;
    host.classList.add('map-host');
    const svg = el('svg', { class: 'map-svg', width: '100%', height: '100%' }, host);
    const world = el('g', { class: 'world' }, svg);
    const gLabels = el('g', { class: 'labels' }, world), gEdges = el('g', { class: 'edges' }, world), gNodes = el('g', { class: 'nodes' }, world), gFx = el('g', { class: 'fxl' }, world);
    let s = 0.8, tx = 0, ty = 0, vw = 0, vh = 0, selected = null, anim = 0, inertia = 0;
    const view = { el: host, remembered: false };

    // bounds of the world
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    map.nodes.concat([map.byId.seed]).forEach((n) => { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y); });
    const PAD = 170; minX -= PAD; maxX += PAD; minY -= PAD; maxY += PAD;

    // ---- build graph ----
    (map.labels || []).forEach((l) => { const t = el('text', { class: 'blabel', x: l.x, y: l.y, 'text-anchor': 'middle' }, gLabels); t.textContent = l.text; });
    const edgeEls = map.edges.map((e) => {
      const a = map.byId[e[0]], b = map.byId[e[1]];
      return { a: e[0], b: e[1], line: el('line', { class: 'edge', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gEdges) };
    });
    const nodeEls = {};
    function addNode(n) {
      const root_ = !!n.root;
      const g = el('g', { class: 'node', 'data-id': n.id, transform: 'translate(' + n.x + ',' + n.y + ')' }, gNodes);
      const sc = root_ ? 1.15 : 1;
      el('circle', { class: 'halo', r: 42 * sc }, g);
      el('circle', { class: 'ring-bg', r: 31 * sc }, g);
      const fg = el('circle', { class: 'ring-fg', r: 31 * sc, 'stroke-dasharray': CIRC * sc + ' ' + CIRC * sc, 'stroke-dashoffset': CIRC * sc, transform: 'rotate(-90)' }, g);
      el('circle', { class: 'body', r: 26 * sc }, g);
      const ico = el('text', { class: 'ico', y: 9, 'text-anchor': 'middle' }, g); ico.textContent = n.icon;
      const lvl = el('text', { class: 'lvl', y: 50, 'text-anchor': 'middle' }, g);
      const cost = el('text', { class: 'cost', y: 66, 'text-anchor': 'middle' }, g);
      const lock = el('text', { class: 'lock', y: -26, x: 22, 'text-anchor': 'middle' }, g); lock.textContent = '🔒';
      nodeEls[n.id] = { g, fg, lvl, cost, lock, sc };
    }
    addNode(map.byId.seed); map.nodes.forEach(addNode);

    function refresh() {
      const lv = (n) => (n.root ? 1 : opts.level(n));
      edgeEls.forEach((e) => {
        const a = map.byId[e.a], b = map.byId[e.b];
        const cls = lv(a) > 0 && lv(b) > 0 ? 'edge on' : lv(a) > 0 ? 'edge open' : 'edge off';
        if (e.line.getAttribute('class') !== cls) e.line.setAttribute('class', cls);
      });
      const all = map.nodes.concat([map.byId.seed]);
      all.forEach((n) => {
        const o = nodeEls[n.id];
        const st = n.root ? 'maxed' : opts.state(n), l = lv(n);
        const aff = !n.root && (st === 'available' || st === 'owned') && opts.affordable(n);
        o.g.setAttribute('class', 'node ' + st + (aff ? ' afford' : '') + (n.root ? ' rootn' : '') + (selected === n.id ? ' sel' : ''));
        o.fg.setAttribute('stroke-dashoffset', (CIRC * o.sc * (1 - (n.max > 0 ? l / n.max : 1))).toFixed(1));
        o.lvl.textContent = !n.root && n.max > 1 && l > 0 ? l + '/' + n.max : '';
        o.cost.textContent = !n.root && (st === 'available' || st === 'owned') ? opts.cost(n) : '';
        o.lock.style.display = st === 'locked' ? '' : 'none';
      });
    }

    // ---- view transform ----
    function clamp() {
      const w = (maxX - minX) * s, h = (maxY - minY) * s;
      tx = w <= vw ? (vw - w) / 2 - minX * s : Math.min(-minX * s, Math.max(vw - maxX * s, tx));
      ty = h <= vh ? (vh - h) / 2 - minY * s : Math.min(-minY * s, Math.max(vh - maxY * s, ty));
    }
    function apply() { clamp(); world.setAttribute('transform', 'translate(' + tx.toFixed(1) + ',' + ty.toFixed(1) + ') scale(' + s.toFixed(3) + ')'); host.style.setProperty('--ms', s.toFixed(3)); host.classList.toggle('zoom-far', s < 0.55); }
    function measure() { const r = host.getBoundingClientRect(); vw = r.width; vh = r.height; return r; }
    function zoomAt(px, py, ns) {
      ns = Math.min(MAX_S, Math.max(MIN_S, ns));
      const wx = (px - tx) / s, wy = (py - ty) / s;
      s = ns; tx = px - wx * s; ty = py - wy * s; apply();
    }
    function animateTo(ntx, nty, ns, ms) {
      cancelAnimationFrame(anim);
      const t0 = performance.now(), sx = tx, sy = ty, ss = s;
      (function step(t) {
        const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
        s = ss + (ns - ss) * e; tx = sx + (ntx - sx) * e; ty = sy + (nty - sy) * e; apply();
        if (k < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    view.centerOn = function (id, ns, instant) {
      measure(); if (!vw) return;
      const n = id ? map.byId[id] : map.byId.seed; ns = ns || s;
      ns = Math.min(MAX_S, Math.max(MIN_S, ns));
      // aim slightly above the middle so the bottom sheet does not cover the node
      const ntx = vw / 2 - n.x * ns, nty = vh * 0.42 - n.y * ns;
      if (instant) { s = ns; tx = ntx; ty = nty; apply(); } else animateTo(ntx, nty, ns, 380);
      view.remembered = true;
    };
    view.fit = function () {
      measure(); if (!vw) return;
      const ns = Math.min(MAX_S, Math.max(MIN_S, Math.min(vw / (maxX - minX), vh / (maxY - minY))));
      animateTo((vw - (maxX - minX) * ns) / 2 - minX * ns, (vh - (maxY - minY) * ns) / 2 - minY * ns, ns, 400);
    };
    view.zoomBy = function (f) { measure(); cancelAnimationFrame(anim); zoomAt(vw / 2, vh / 2, s * f); };
    view.show = function () { measure(); apply(); };
    view.select = function (id) { selected = id; refresh(); };
    view.refresh = refresh;
    view.burst = function (id) {
      const n = map.byId[id]; if (!n) return;
      const c = el('circle', { class: 'ripple', cx: n.x, cy: n.y, r: 30 }, gFx);
      c.addEventListener('animationend', () => c.remove());
      const o = nodeEls[id]; if (o) { o.g.classList.remove('buyfx'); void o.g.getBoundingClientRect(); o.g.classList.add('buyfx'); }
    };

    // ---- gestures: one-finger pan, two-finger pinch, wheel zoom, inertia, tap-to-select ----
    const ptrs = new Map();
    let start = null, pinch = null, vel = { x: 0, y: 0 }, lastMove = 0;
    host.addEventListener('pointerdown', (e) => {
      cancelAnimationFrame(anim); cancelAnimationFrame(inertia);
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        const tgt = e.target.closest ? e.target.closest('.node') : null;
        start = { x: e.clientX, y: e.clientY, tx, ty, moved: false, id: tgt ? tgt.getAttribute('data-id') : null };
        vel = { x: 0, y: 0 };
      } else if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s };
        if (start) start.moved = true;
      }
    });
    host.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = host.getBoundingClientRect();
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = Array.from(ptrs.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
        // pan with the midpoint movement while zooming around it
        tx += (e.clientX - prev.x) / 2; ty += (e.clientY - prev.y) / 2;
        zoomAt(cx, cy, pinch.s * d / pinch.d);
      } else if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) > 7) start.moved = true;
        if (start.moved) {
          const now = performance.now(), dt = Math.max(1, now - lastMove); lastMove = now;
          vel = { x: (e.clientX - prev.x) / dt * 16, y: (e.clientY - prev.y) / dt * 16 };
          tx = start.tx + dx; ty = start.ty + dy; apply();
        }
      }
    });
    function up(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0 && start) {
        if (!start.moved && e.type === 'pointerup') { if (opts.onTap) opts.onTap(start.id ? map.byId[start.id] : null); }
        else if (start.moved && !pinchedRecently() && (Math.abs(vel.x) > 1 || Math.abs(vel.y) > 1)) {
          (function coast() { vel.x *= 0.92; vel.y *= 0.92; tx += vel.x; ty += vel.y; apply(); if (Math.abs(vel.x) > 0.3 || Math.abs(vel.y) > 0.3) inertia = requestAnimationFrame(coast); })();
        }
        start = null;
      } else if (ptrs.size === 1) {
        // went from pinch back to one finger: restart the pan from here
        const p = Array.from(ptrs.values())[0]; start = { x: p.x, y: p.y, tx, ty, moved: true, id: null };
      }
    }
    let lastPinch = 0;
    function pinchedRecently() { return performance.now() - lastPinch < 150; }
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('pointermove', () => { if (pinch) lastPinch = performance.now(); });
    host.addEventListener('wheel', (e) => {
      e.preventDefault(); cancelAnimationFrame(anim);
      const r = host.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, s * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    if (root.ResizeObserver) new ResizeObserver(() => { if (host.clientWidth) { measure(); apply(); } }).observe(host);

    refresh();
    return view;
  }

  root.SC_MAP = { create };
})(typeof self !== 'undefined' ? self : this);
