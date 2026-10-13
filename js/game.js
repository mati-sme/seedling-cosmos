/* Seedling Cosmos v2 - run screen: renders the headless run engine to a canvas, handles input and all the juice. */
(function (root) {
  'use strict';
  const C = root.SC_CORE, D = root.SC_DATA, FX = root.SC_FX;
  const TAU = Math.PI * 2, rnd = Math.random;
  const AB_ORDER = ['nova', 'slow', 'golden', 'magnet', 'chrono'];
  const KIND_HUE = { gold: 48, comet: 22, pod: 135, orb: 170, spore: 295 };
  const MILESTONES = [10, 25, 50, 100, 200, 400, 800, 1600];

  function create(o) {
    const S = o.state, canvas = o.canvas, ctx = canvas.getContext('2d');
    const $ = (id) => document.getElementById(id);
    const hud = { fill: $('run-time-fill'), txt: $('run-time-txt'), score: $('run-score'), cx: $('combo-x'), cn: $('combo-n'), cf: $('combo-fill'), combo: $('run-combo'), banner: $('run-banner'), abil: $('run-abilities'), pauseOv: $('run-pause-ov'), root: $('run'), zone: $('run-zone') };
    const parts = FX.Particles();
    let run = null, phase = 'idle', last = 0, W = 1, Hpx = 1, dpr = 1, count = 0, countShown = -1, endT = 0;
    let shakeMag = 0, flash = null, tint = null, shownScore = 0, lastMilestone = 0, stars = [], abBtns = {}, zoneHue = 140, tapRipples = [];
    let comboPrev = 0, raf = 0;

    function resize() {
      const r = canvas.getBoundingClientRect(); if (!r.width) return;
      dpr = Math.min(root.devicePixelRatio || 1, 2);
      W = r.width; Hpx = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(Hpx * dpr);
      if (run) run.H = Hpx / W;
      stars = []; for (let i = 0; i < 46; i++) stars.push({ x: rnd() * W, y: rnd() * Hpx, z: 0.3 + rnd(), p: rnd() * TAU });
    }
    if (root.ResizeObserver) new ResizeObserver(resize).observe(canvas);

    // ---------- banner ----------
    function banner(text, cls) {
      const b = hud.banner; b.textContent = text; b.className = 'show ' + (cls || '');
      b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    }
    function clearBanner() { hud.banner.className = ''; }

    // ---------- abilities ----------
    function buildAbilities(st) {
      hud.abil.innerHTML = ''; abBtns = {};
      AB_ORDER.forEach((k, i) => {
        if (!st.ab[k]) return;
        const A = D.ABILITIES[k], b = document.createElement('button');
        b.className = 'ab ready'; b.type = 'button'; b.setAttribute('aria-label', A.name);
        b.innerHTML = '<span class="ai">' + A.icon + '</span><i class="cd"></i><small>' + (i + 1) + '</small>';
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); useAbility(k); });
        hud.abil.appendChild(b); abBtns[k] = { b, p: -1 };
      });
    }
    function useAbility(k) { if (phase === 'run' && run) { if (C.useAbility(run, k)) processEvents(); } }
    function updateAbilities() {
      for (const k in abBtns) {
        const A = D.ABILITIES[k], x = abBtns[k];
        const used = k === 'chrono' && run.used.chrono;
        const maxcd = Math.max(3, A.cd * run.st.abCd), frac = used ? 0 : 1 - Math.min(1, run.cd[k] / maxcd);
        const q = Math.round(frac * 50);
        if (q !== x.p) { x.p = q; x.b.style.setProperty('--p', (frac * 360).toFixed(0) + 'deg'); x.b.classList.toggle('ready', frac >= 0.999); x.b.classList.toggle('used', used); }
      }
    }

    // ---------- events -> juice ----------
    const px = (v) => v * W;
    function shake(m) { if (FX.shake && FX.on) shakeMag = Math.max(shakeMag, m); }
    function doFlash(hue, a) { if (FX.on) flash = { h: hue, a: a || 0.35 }; }
    function processEvents() {
      const evs = run.ev; if (!evs.length) return;
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        switch (e.type) {
          case 'hit': onHit(e); break;
          case 'podhit': parts.burst(px(e.x), px(e.y), { n: 6, hue: 135, speed: 120, size: 3 }); FX.haptic(8); break;
          case 'miss':
            parts.ring(px(e.x), px(e.y), 220, 22, 0.3);
            if (e.lost > 0) parts.text(px(e.x), px(e.y) - 14, '-' + e.lost, { color: '#ff8aa0', size: 16, life: 0.7 });
            break;
          case 'spore':
            shake(11); doFlash(350, 0.4); FX.haptic([30, 30, 40]);
            parts.burst(px(e.x), px(e.y), { n: 22, hue: 320, speed: 200, size: 3.5 });
            parts.text(px(e.x), px(e.y), e.pen ? '-' + e.pen + 's' : 'SPORE!', { color: '#ff5d8a', size: 28, glow: '#ff1f66', pop: true, life: 1.1 });
            break;
          case 'shield': parts.text(px(e.x), px(e.y), 'Shrugged off!', { color: '#7cf0b4', size: 18 }); parts.ring(px(e.x), px(e.y), 150, 40, 0.4); break;
          case 'expire': if (e.kind !== 'spore') parts.burst(px(e.x), px(e.y), { n: 3, hue: 230, speed: 40, grav: -20, size: 2, life: 0.5 }); break;
          case 'combolost': parts.text(W / 2, Hpx * 0.32, 'Combo lost', { color: '#b9b2ff', size: 20, life: 0.9 }); shake(3); break;
          case 'ability': onAbility(e.k); break;
          case 'end': break;
        }
      }
      evs.length = 0;
    }
    function onHit(e) {
      const x = px(e.x), y = px(e.y), hue = e.kind === 'mote' ? zoneHue : KIND_HUE[e.kind];
      const combo = e.combo, big = e.kind === 'pod' || e.kind === 'comet' || e.crit;
      if (e.via === 'auto') { parts.burst(x, y, { n: 4, hue, speed: 80, size: 2.5, life: 0.5 }); parts.text(x, y - 6, C.fmt(e.val), { color: '#a9c7ff', size: 12, life: 0.6 }); return; }
      parts.burst(x, y, { n: Math.min(30, 7 + (big ? 10 : 0) + Math.floor(combo / 6)), hue, speed: big ? 230 : 160, size: big ? 4 : 3, star: e.kind === 'gold' || e.crit });
      if (big) parts.ring(x, y, hue, 56, 0.4);
      const sz = Math.min(34, 15 + Math.log10(e.val + 1) * 1.4 + (e.crit ? 8 : 0));
      if (e.kind === 'orb') parts.text(x, y - 10, '+' + (e.orbT ? e.orbT.toFixed(1).replace(/\.0$/, '') : '0') + 's', { color: '#7df5e3', size: 22, glow: '#00e5c0', pop: true });
      else parts.text(x, y - 8, (e.crit ? 'CRIT ' : '') + '+' + C.fmt(e.val), { color: e.crit ? '#fff' : e.kind === 'gold' ? '#ffd86b' : '#eaf2ff', size: sz, glow: e.crit ? '#ff4fd0' : e.kind === 'gold' ? '#ff9d00' : null, pop: e.crit || big });
      if (e.crit) { shake(7); FX.haptic(18); doFlash(320, 0.18); } else if (e.kind === 'pod' || e.kind === 'comet') { shake(5); FX.haptic(14); } else FX.haptic(6);
      if (e.via === 'nova') { /* nova draws its own big wave */ }
      // combo milestones
      for (let i = 0; i < MILESTONES.length; i++) {
        const m = MILESTONES[i];
        if (combo >= m && comboPrev < m) {
          banner('COMBO ' + m + '!', 'combo'); shake(9); FX.haptic([20, 20, 30]);
          parts.ring(W / 2, Hpx * 0.5, 50 + i * 25, Math.min(W, Hpx) * 0.6, 0.7);
          parts.burst(W / 2, Hpx * 0.45, { n: 30, hue: 50 + i * 30, speed: 280, size: 4, star: true, life: 1 });
        }
      }
      comboPrev = combo;
      // pulse the combo HUD
      hud.combo.classList.remove('bump'); void hud.combo.offsetWidth; hud.combo.classList.add('bump');
    }
    function onAbility(k) {
      FX.haptic(25);
      if (k === 'nova') { shake(14); doFlash(50, 0.55); parts.ring(W / 2, Hpx / 2, 50, Math.max(W, Hpx), 0.7); parts.ring(W / 2, Hpx / 2, 190, Math.max(W, Hpx) * 0.7, 0.5); banner('NOVA!', 'abil'); }
      else if (k === 'slow') { tint = { h: 215, t: run.fx.slow, max: run.fx.slow }; doFlash(215, 0.3); banner('TIME BLOOM', 'abil'); }
      else if (k === 'golden') { tint = { h: 48, t: run.fx.golden, max: run.fx.golden }; doFlash(48, 0.4); banner('GOLDEN HOUR', 'abil'); }
      else if (k === 'magnet') { tint = { h: 280, t: run.fx.magnet, max: run.fx.magnet }; doFlash(280, 0.3); banner('GRAVITY WELL', 'abil'); }
      else if (k === 'chrono') { doFlash(25, 0.4); banner('SECOND DAWN +' + Math.round(D.ABILITIES.chrono.time * run.st.abPow) + 's', 'abil'); parts.ring(W / 2, Hpx / 2, 25, Math.max(W, Hpx) * 0.6, 0.7); }
    }

    // ---------- input ----------
    canvas.addEventListener('pointerdown', (e) => {
      if (phase !== 'run' || !run) return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.width;
      C.tapRun(run, x, y);
      tapRipples.push({ x: x * W, y: y * W, l: 1 });
      processEvents();
    });
    root.addEventListener('keydown', (e) => {
      if (phase !== 'run') return;
      const i = '12345'.indexOf(e.key); if (i >= 0) { const ks = AB_ORDER.filter((k) => abBtns[k]); const k = AB_ORDER[i]; if (abBtns[k]) useAbility(k); else if (ks[i]) useAbility(ks[i]); }
    });

    // ---------- drawing ----------
    function drawBg(t, dt) {
      const g = ctx.createLinearGradient(0, 0, 0, Hpx);
      g.addColorStop(0, 'hsl(' + (zoneHue + 230) % 360 + ',55%,9%)'); g.addColorStop(1, 'hsl(' + zoneHue + ',50%,13%)');
      ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, Hpx + 40);
      const slow = run && run.fx.slow > 0 ? 0.3 : 1;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]; s.y += s.z * 14 * dt * slow; if (s.y > Hpx) { s.y = -2; s.x = rnd() * W; }
        ctx.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.002 * s.z + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, 1.6 * s.z, 1.6 * s.z);
      }
      ctx.globalAlpha = 1;
      // soft zone glow at the bottom
      const gg = ctx.createRadialGradient(W / 2, Hpx * 1.05, 10, W / 2, Hpx * 1.05, Hpx * 0.8);
      gg.addColorStop(0, 'hsla(' + zoneHue + ',80%,45%,.35)'); gg.addColorStop(1, 'hsla(' + zoneHue + ',80%,45%,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, Hpx);
    }
    function glowDot(x, y, r, hue, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'hsla(' + hue + ',95%,70%,' + a + ')'); g.addColorStop(1, 'hsla(' + hue + ',95%,60%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    function drawTarget(t, time) {
      const x = px(t.x), y = px(t.y); let r = px(t.r);
      const kHue = t.kind === 'mote' ? zoneHue : KIND_HUE[t.kind];
      const ease = Math.min(1, t.age / 0.2), pop = 1 + Math.sin(ease * Math.PI) * 0.25;
      let sc = ease < 1 ? ease * pop : 1;
      const fade = Math.min(1, t.life / 0.5); // fades in the last half second
      if (t.hp !== t.hpShown) { if (t.hpShown !== undefined) t.wob = 1; t.hpShown = t.hp; }
      if (t.wob > 0) { sc *= 1 + Math.sin(t.wob * 12) * 0.12 * t.wob; t.wob = Math.max(0, t.wob - 0.05); }
      sc *= 1 + Math.sin(time * 0.006 + t.id) * 0.04;
      r *= sc;
      ctx.globalAlpha = Math.max(0.15, fade);
      ctx.globalCompositeOperation = 'lighter'; glowDot(x, y, r * 2.1, kHue, t.kind === 'spore' ? 0.35 : 0.5); ctx.globalCompositeOperation = 'source-over';
      if (t.kind === 'comet') {
        const sp = Math.hypot(t.vx, t.vy) || 1, nx = -t.vx / sp, ny = -t.vy / sp;
        const tg = ctx.createLinearGradient(x, y, x + nx * r * 5, y + ny * r * 5);
        tg.addColorStop(0, 'hsla(' + kHue + ',100%,70%,.9)'); tg.addColorStop(1, 'hsla(' + kHue + ',100%,60%,0)');
        ctx.strokeStyle = tg; ctx.lineWidth = r * 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + nx * r * 5, y + ny * r * 5); ctx.stroke();
      }
      // body
      const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      if (t.kind === 'spore') { bg.addColorStop(0, 'hsl(300,55%,35%)'); bg.addColorStop(1, 'hsl(285,60%,12%)'); }
      else if (t.kind === 'gold') { bg.addColorStop(0, 'hsl(55,100%,85%)'); bg.addColorStop(1, 'hsl(40,95%,48%)'); }
      else if (t.kind === 'pod') { bg.addColorStop(0, 'hsl(135,60%,60%)'); bg.addColorStop(1, 'hsl(150,60%,20%)'); }
      else if (t.kind === 'orb') { bg.addColorStop(0, 'hsl(175,90%,85%)'); bg.addColorStop(1, 'hsl(190,80%,40%)'); }
      else if (t.kind === 'comet') { bg.addColorStop(0, '#fff'); bg.addColorStop(1, 'hsl(' + kHue + ',95%,55%)'); }
      else { bg.addColorStop(0, 'hsl(' + zoneHue + ',85%,88%)'); bg.addColorStop(1, 'hsl(' + zoneHue + ',70%,42%)'); }
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'hsla(' + kHue + ',90%,85%,.7)'; ctx.stroke();
      // details
      if (t.kind === 'spore') {
        ctx.strokeStyle = 'hsl(330,90%,60%)'; ctx.lineWidth = 2.2;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + time * 0.002; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); ctx.stroke(); }
        ctx.fillStyle = 'hsl(350,100%,60%)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.1, r * 0.14, 0, TAU); ctx.arc(x + r * 0.25, y - r * 0.1, r * 0.14, 0, TAU); ctx.fill();
      } else if (t.kind === 'gold') {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; const a0 = time * 0.003 + t.id;
        for (let i = 0; i < 4; i++) { const a = a0 + i * TAU / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 1.1); ctx.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6); ctx.stroke(); }
      } else if (t.kind === 'orb') {
        ctx.strokeStyle = '#06424a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.55); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.4, y + r * 0.15); ctx.stroke();
      } else if (t.kind === 'pod') {
        for (let i = 0; i < t.hp0; i++) { const a = -Math.PI / 2 + (i + 0.5) * TAU / t.hp0; ctx.fillStyle = i < t.hp ? '#e9ffd8' : 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.14, 0, TAU); ctx.fill(); }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.2, 0, TAU); ctx.fill();
      }
      // lifetime ring
      if (t.kind !== 'comet') {
        ctx.strokeStyle = 'hsla(' + kHue + ',90%,80%,.55)'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.arc(x, y, r * 1.22, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, t.life / t.max)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    function drawWorld(t, dt) {
      const time = t;
      // magnet swirl
      if (run.fx.magnet > 0) {
        const cx = W / 2, cy = Hpx / 2;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { const rr = W * (0.09 + i * 0.04) * (1 + Math.sin(time * 0.006 + i) * 0.08); ctx.strokeStyle = 'hsla(280,90%,70%,' + (0.5 - i * 0.12) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr, time * 0.004 * (i % 2 ? -1 : 1), time * 0.004 + 4.2); ctx.stroke(); }
        glowDot(cx, cy, W * 0.14, 280, 0.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < run.targets.length; i++) drawTarget(run.targets[i], time);
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000)); last = ts;
      if (phase === 'idle') return;
      if (phase === 'paused') return;
      if (W < 2) resize();
      // simulation
      if (phase === 'countdown') {
        count -= dt; const c = Math.ceil(count);
        if (c !== countShown) { countShown = c; if (c > 0) banner(String(c), 'count'); }
        if (count <= 0) { phase = 'run'; banner('GO!', 'count go'); FX.haptic(15); }
      } else if (phase === 'run') {
        let rem = dt; while (rem > 0) { const sub = Math.min(rem, 1 / 60); C.stepRun(run, sub); rem -= sub; if (run.over) break; }
        processEvents();
        if (run.over) { phase = 'ending'; endT = 1; banner("TIME'S UP!", 'abil'); shake(8); doFlash(50, 0.3); FX.haptic([30, 40, 30]); }
      } else if (phase === 'ending') {
        run.targets.length = 0;
        endT -= dt; if (endT <= 0) { phase = 'idle'; const sum = C.endRun(S, run); hud.root.classList.remove('on'); clearBanner(); o.onEnd(sum); }
      }
      parts.update(dt);
      // render
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let sx = 0, sy = 0; if (shakeMag > 0.2) { sx = (rnd() - 0.5) * shakeMag * 2; sy = (rnd() - 0.5) * shakeMag * 2; shakeMag *= Math.pow(0.0006, dt); } else shakeMag = 0;
      ctx.translate(sx, sy);
      drawBg(ts, dt);
      if (run) drawWorld(ts, dt);
      for (let i = tapRipples.length - 1; i >= 0; i--) { const r = tapRipples[i]; r.l -= dt * 4; if (r.l <= 0) { tapRipples.splice(i, 1); continue; } ctx.strokeStyle = 'rgba(255,255,255,' + r.l * 0.5 + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(r.x, r.y, 8 + (1 - r.l) * 18, 0, TAU); ctx.stroke(); }
      parts.draw(ctx);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // tint & flash overlays
      if (tint && run) {
        const key = tint.h === 215 ? 'slow' : tint.h === 48 ? 'golden' : 'magnet', left = run.fx[key];
        if (left <= 0) tint = null; else {
          const a = Math.min(1, left / 0.5) * 0.14, g = ctx.createRadialGradient(W / 2, Hpx / 2, Math.min(W, Hpx) * 0.3, W / 2, Hpx / 2, Math.max(W, Hpx) * 0.75);
          g.addColorStop(0, 'hsla(' + tint.h + ',90%,60%,0)'); g.addColorStop(1, 'hsla(' + tint.h + ',90%,60%,' + (a * 3) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hpx);
        }
      }
      if (flash) { ctx.fillStyle = 'hsla(' + flash.h + ',95%,70%,' + flash.a + ')'; ctx.fillRect(0, 0, W, Hpx); flash.a -= dt * 1.6; if (flash.a <= 0) flash = null; }
      // HUD
      if (run) {
        const st = run.st, frac = Math.max(0, run.left / Math.max(run.dur, run.left));
        hud.fill.style.transform = 'scaleX(' + frac.toFixed(3) + ')';
        hud.fill.classList.toggle('low', run.left < 6);
        const tx = Math.ceil(run.left) + 's'; if (hud.txt.textContent !== tx) hud.txt.textContent = tx;
        const target = run.earned * st.collect; shownScore += (target - shownScore) * Math.min(1, dt * 12);
        hud.score.textContent = C.fmt(shownScore, S.settings.sci);
        const m = C.comboMult(run);
        hud.cx.textContent = '×' + m.toFixed(2);
        hud.cn.textContent = run.combo > 0 ? run.combo + ' COMBO' : 'COMBO';
        hud.cf.style.transform = 'scaleX(' + (run.combo > 0 ? Math.max(0, run.comboT / st.comboWin) : 0).toFixed(3) + ')';
        hud.combo.style.setProperty('--h', Math.min(320, 40 + run.combo * 3));
        hud.combo.classList.toggle('hot', run.combo >= 25); hud.combo.classList.toggle('idle', run.combo === 0);
        if (run.combo === 0) comboPrev = 0;
        updateAbilities();
      }
    }
    raf = requestAnimationFrame(frame);

    // ---------- control ----------
    function start(zone) {
      hud.root.classList.add('on'); // must be visible before measuring the canvas
      resize();
      zoneHue = D.ZONES[zone].hue;
      run = C.createRun(S, zone, Math.random, Hpx / W, true);
      parts.clear(); tapRipples = []; shakeMag = 0; flash = null; tint = null; shownScore = 0; comboPrev = 0;
      hud.zone.textContent = D.ZONES[zone].icon + ' ' + D.ZONES[zone].name;
      buildAbilities(run.st); hud.pauseOv.hidden = true;
      phase = 'countdown'; count = 3; countShown = -1; last = performance.now();
    }
    function pause() { if (phase === 'run' || phase === 'countdown') { o.prevPhase = phase; phase = 'paused'; hud.pauseOv.hidden = false; } }
    function resume() { if (phase === 'paused') { phase = o.prevPhase || 'run'; hud.pauseOv.hidden = true; last = performance.now(); } }
    function quit() { phase = 'idle'; run = null; hud.root.classList.remove('on'); hud.pauseOv.hidden = true; clearBanner(); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    $('run-pause').addEventListener('click', pause);
    $('run-resume').addEventListener('click', resume);
    $('run-quit').addEventListener('click', () => { quit(); if (o.onQuit) o.onQuit(); });

    return { start, pause, resume, quit, isRunning: () => phase !== 'idle', resize, getRun: () => run };
  }

  root.SC_GAME = { create };
})(typeof self !== 'undefined' ? self : this);
