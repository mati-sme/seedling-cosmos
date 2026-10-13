/* Seedling Cosmos v2 - visual effects: starfield, zone orb, canvas particle/popup system, haptics. */
(function (root) {
  'use strict';
  const FX = { on: true, shake: true, haptics: true };
  const reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TAU = Math.PI * 2, rnd = Math.random;
  FX.reduce = reduce;

  FX.haptic = function (ms) {
    if (FX.haptics && !reduce && root.navigator && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  };

  // ---------- background starfield ----------
  FX.Starfield = function (canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, hue = 250, targetHue = 250, stars = [], shoot = null;
    function resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 1.5);
      w = canvas.width = Math.floor(innerWidth * dpr); h = canvas.height = Math.floor(innerHeight * dpr);
      const n = Math.min(150, Math.floor(w * h / 9000));
      stars = [];
      for (let i = 0; i < n; i++) stars.push({ x: rnd() * w, y: rnd() * h, z: 0.3 + rnd() * 0.9, p: rnd() * TAU, s: 0.6 + rnd() * 1.6 });
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      hue += (targetHue - hue) * 0.02;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.8);
      g.addColorStop(0, 'hsla(' + hue + ',60%,22%,.55)');
      g.addColorStop(0.5, 'hsla(' + (hue + 40) + ',55%,10%,.35)');
      g.addColorStop(1, 'rgba(5,4,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!reduce) { s.y += s.z * 0.24; if (s.y > h) { s.y = -2; s.x = rnd() * w; } }
        ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.0015 * s.z + s.p));
        ctx.fillStyle = i % 7 === 0 ? 'hsl(' + hue + ',90%,80%)' : '#fff';
        ctx.fillRect(s.x, s.y, s.s * s.z, s.s * s.z);
      }
      ctx.globalAlpha = 1;
      if (!reduce) {
        if (!shoot && rnd() < 0.002) shoot = { x: rnd() * w, y: rnd() * h * 0.5, vx: 6 + rnd() * 5, vy: 3 + rnd() * 3, life: 1 };
        if (shoot) {
          ctx.strokeStyle = 'rgba(255,255,255,' + shoot.life + ')'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(shoot.x - shoot.vx * 4, shoot.y - shoot.vy * 4); ctx.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.02;
          if (shoot.life <= 0) shoot = null;
        }
      }
    }
    resize(); addEventListener('resize', resize); requestAnimationFrame(frame);
    return { setHue(v) { targetHue = v; } };
  };

  // ---------- zone orb for the home screen ----------
  FX.Orb = function (canvas) {
    const ctx = canvas.getContext('2d');
    let hue = 140, zone = 0, bumped = 0;
    const api = { visible: true };
    const motes = [];
    for (let i = 0; i < 26; i++) motes.push({ a: rnd() * TAU, r: 70 + rnd() * 80, s: 0.2 + rnd() * 0.5, z: 0.6 + rnd() * 2 });
    function frame(t) {
      requestAnimationFrame(frame);
      if (!api.visible || document.hidden) return;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2), size = Math.max(120, Math.round(r.width * dpr));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      const k = canvas.width / 300, sec = t / 1000;
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, 300, 300);
      const cx = 150, cy = 150, br = 1 + bumped * 0.08; bumped *= 0.9;
      let g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150);
      g.addColorStop(0, 'hsla(' + hue + ',90%,60%,.5)'); g.addColorStop(1, 'hsla(' + hue + ',90%,50%,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 300, 300);
      const R = 62 * br;
      g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, 'hsl(' + hue + ',80%,78%)'); g.addColorStop(0.6, 'hsl(' + hue + ',65%,45%)'); g.addColorStop(1, 'hsl(' + (hue + 30) + ',60%,18%)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      // bands vary with the zone number so each zone reads differently
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      const nb = 3 + (zone % 3);
      for (let i = 0; i < nb; i++) {
        const y = cy - R + ((i + 0.5) / nb) * R * 2 + Math.sin(sec * 0.6 + i) * 4;
        ctx.fillStyle = 'hsla(' + (hue + 40 + i * 20) + ',70%,70%,.18)'; ctx.fillRect(cx - R, y - 6, R * 2, 12);
      }
      ctx.restore();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.4 + Math.sin(sec * 0.3) * 0.05); ctx.scale(1, 0.32);
      ctx.strokeStyle = 'hsla(' + (hue + 20) + ',80%,75%,.55)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 0, R * 1.55, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      motes.forEach((m) => {
        const a = m.a + sec * m.s * 0.4, x = cx + Math.cos(a) * m.r, y = cy + Math.sin(a) * m.r * 0.5;
        ctx.fillStyle = 'hsla(' + (hue + m.z * 20) + ',95%,75%,.8)'; ctx.beginPath(); ctx.arc(x, y, m.z, 0, TAU); ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
    }
    api.setZone = function (z, h) { zone = z; hue = h; };
    api.bump = function () { bumped = 1; };
    requestAnimationFrame(frame);
    return api;
  };

  // ---------- canvas particle / popup system (used by the run screen) ----------
  FX.Particles = function () {
    const parts = [], texts = [], rings = [];
    const MAXP = 420;
    return {
      burst(x, y, o) {
        if (!FX.on) return;
        o = o || {};
        const n = Math.min(o.n || 10, MAXP - parts.length), hue = o.hue === undefined ? 50 : o.hue, sp = o.speed || 160;
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, v = (0.35 + rnd()) * sp;
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.grav === undefined ? 220 : o.grav, life: 1, d: (1 / (o.life || 0.7)) * (0.7 + rnd() * 0.6), s: (o.size || 3) * (0.6 + rnd() * 0.9), h: hue + (rnd() - 0.5) * (o.spread || 40), star: !!o.star && rnd() < 0.5 });
        }
      },
      ring(x, y, hue, r, life) { if (FX.on) rings.push({ x, y, h: hue, r: 6, R: r || 60, life: 1, d: 1 / (life || 0.45) }); },
      text(x, y, str, o) {
        if (!FX.on || texts.length > 40) return;
        o = o || {};
        texts.push({ x, y, str, size: o.size || 18, color: o.color || '#ffd86b', glow: o.glow, life: 1, d: 1 / (o.life || 0.9), vy: o.vy || -60, pop: o.pop ? 1 : 0 });
      },
      update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life -= p.d * dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
        }
        for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= t.d * dt; t.y += t.vy * dt; t.vy *= 0.96; if (t.life <= 0) texts.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= r.d * dt; r.r += (r.R - r.r) * Math.min(1, dt * 9); if (r.life <= 0) rings.splice(i, 1); }
      },
      draw(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i]; ctx.strokeStyle = 'hsla(' + r.h + ',95%,70%,' + Math.max(0, r.life * 0.8) + ')'; ctx.lineWidth = 2 + r.life * 4;
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
        }
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i], sz = p.s * (0.4 + p.life * 0.8);
          ctx.fillStyle = 'hsla(' + p.h + ',95%,68%,' + Math.min(1, p.life * 1.4) + ')';
          if (p.star) { ctx.fillRect(p.x - sz * 1.6, p.y - 0.7, sz * 3.2, 1.4); ctx.fillRect(p.x - 0.7, p.y - sz * 1.6, 1.4, sz * 3.2); }
          else { ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, TAU); ctx.fill(); }
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i], a = Math.min(1, t.life * 2.2), sc = t.pop ? 1 + Math.max(0, (t.life - 0.8)) * 2.5 : 1;
          ctx.font = '800 ' + Math.round(t.size * sc) + 'px system-ui, sans-serif';
          ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(8,4,30,.85)'; ctx.strokeText(t.str, t.x, t.y);
          if (t.glow) { ctx.shadowColor = t.glow; ctx.shadowBlur = 14; }
          ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y); ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      },
      clear() { parts.length = 0; texts.length = 0; rings.length = 0; }
    };
  };

  root.SC_FX = FX;
})(typeof self !== 'undefined' ? self : this);
