/* Seedling Cosmos v4 - visual effects: print-style background, specimen planet, flat confetti/popup system, haptics. */
(function (root) {
  'use strict';
  const FX = { on: true, shake: true, haptics: true };
  const reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TAU = Math.PI * 2, rnd = Math.random;
  FX.reduce = reduce;
  FX.INK = '#12211f';
  FX.PAPER = '#f4ead5';
  FX.FONT_D = '"Rockwell","Rockwell Nova","Roboto Slab","Cambria","Georgia",serif';
  FX.FONT_N = 'ui-monospace,"SF Mono","Menlo","Consolas","DejaVu Sans Mono",monospace';

  FX.haptic = function (ms) {
    if (FX.haptics && !reduce && root.navigator && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  };

  // ---------- page background: halftone dots, plus-sign stars and orbit lines ----------
  FX.Starfield = function (canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, hue = 160, targetHue = 160, crosses = [];
    function resize() {
      dpr = Math.min(root.devicePixelRatio || 1, 1.5);
      w = canvas.width = Math.floor(innerWidth * dpr); h = canvas.height = Math.floor(innerHeight * dpr);
      crosses = [];
      for (let i = 0; i < 26; i++) crosses.push({ x: rnd() * w, y: rnd() * h, s: (3 + rnd() * 4) * dpr, p: rnd() * TAU, v: (0.1 + rnd() * 0.2) * dpr });
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      hue += (targetHue - hue) * 0.04;
      ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ',32%,9%)'; ctx.fillRect(0, 0, w, h);
      const sec = reduce ? 0 : t / 1000, cell = 26 * dpr;
      // halftone: dot size follows a slow diagonal wave
      ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ',30%,16%)';
      for (let y = 0, row = 0; y < h + cell; y += cell, row++) {
        for (let x = (row % 2) * cell / 2; x < w + cell; x += cell) {
          const k = 0.5 + 0.5 * Math.sin((x + y) * 0.006 / dpr - sec * 0.5);
          ctx.beginPath(); ctx.arc(x, y, (1.2 + k * 2.6) * dpr, 0, TAU); ctx.fill();
        }
      }
      // orbit lines
      ctx.strokeStyle = 'hsl(' + hue.toFixed(0) + ',30%,22%)'; ctx.lineWidth = 2 * dpr; ctx.setLineDash([10 * dpr, 12 * dpr]);
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(w * 0.95, h * 0.1, (150 + i * 90) * dpr, 0, TAU); ctx.stroke(); }
      ctx.setLineDash([]);
      // plus stars
      ctx.strokeStyle = 'hsl(' + hue.toFixed(0) + ',55%,70%)'; ctx.lineWidth = 1.6 * dpr; ctx.lineCap = 'square';
      for (let i = 0; i < crosses.length; i++) {
        const c = crosses[i];
        if (!reduce) { c.y += c.v; if (c.y > h + 10) { c.y = -10; c.x = rnd() * w; } }
        ctx.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(sec * 1.4 + c.p));
        ctx.beginPath(); ctx.moveTo(c.x - c.s, c.y); ctx.lineTo(c.x + c.s, c.y); ctx.moveTo(c.x, c.y - c.s); ctx.lineTo(c.x, c.y + c.s); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    resize(); addEventListener('resize', resize); requestAnimationFrame(frame);
    return { setHue(v) { targetHue = v; } };
  };

  // ---------- specimen planet for the home plate (flat shapes, thick ink outlines) ----------
  FX.Orb = function (canvas) {
    const ctx = canvas.getContext('2d');
    let hue = 140, zone = 0, bumped = 0;
    const api = { visible: true };
    const INK = FX.INK;
    const moons = [{ a: 0.6, s: 0.5, r: 9 }, { a: 3.3, s: -0.32, r: 6 }];
    function ellipseHalf(cx, cy, rx, ry, rot, a0, a1) { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, a0, a1); }
    function frame(t) {
      requestAnimationFrame(frame);
      if (!api.visible || document.hidden) return;
      const r = canvas.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2), size = Math.max(120, Math.round(r.width * dpr));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
      const k = canvas.width / 300, sec = reduce ? 0 : t / 1000;
      ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, 300, 300);
      const cx = 150, cy = 150, R = 66 * (1 + bumped * 0.08); bumped *= 0.88;
      const rot = -0.38 + Math.sin(sec * 0.4) * 0.03;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // orbit guide
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.setLineDash([4, 7]); ctx.strokeStyle = 'rgba(18,33,31,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 2.05, R * 0.78, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      const ring = (a0, a1) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.strokeStyle = INK; ctx.lineWidth = 17; ellipseHalf(0, 0, R * 1.6, R * 0.5, 0, a0, a1); ctx.stroke();
        ctx.strokeStyle = 'hsl(' + (hue + 40) + ',85%,64%)'; ctx.lineWidth = 9; ellipseHalf(0, 0, R * 1.6, R * 0.5, 0, a0, a1); ctx.stroke();
        ctx.restore();
      };
      ring(Math.PI, TAU); // back half of the ring
      // hard offset shadow, body, bands
      ctx.fillStyle = 'rgba(18,33,31,.55)'; ctx.beginPath(); ctx.arc(cx + 7, cy + 8, R, 0, TAU); ctx.fill();
      ctx.fillStyle = 'hsl(' + hue + ',58%,60%)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
      const nb = 3 + (zone % 3);
      for (let i = 0; i < nb; i++) {
        const y = cy - R + ((i + 0.6) / (nb + 0.3)) * R * 2 + Math.sin(sec * 0.5 + i) * 3;
        ctx.fillStyle = i % 2 ? 'hsl(' + (hue + 28) + ',60%,70%)' : 'hsl(' + (hue - 12) + ',55%,44%)';
        ctx.fillRect(cx - R, y - 7 - (i % 3) * 2, R * 2, 14 + (i % 3) * 4);
      }
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(cx - R * 0.55, cy - R * 0.5, R * 0.55, 0, TAU); ctx.fill(); // hard highlight
      ctx.fillStyle = 'rgba(18,33,31,.28)'; ctx.beginPath(); ctx.arc(cx + R * 0.95, cy + R * 0.7, R * 0.95, 0, TAU); ctx.fill(); // hard terminator
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ring(0, Math.PI); // front half of the ring
      for (let i = 0; i < moons.length; i++) {
        const m = moons[i], a = m.a + sec * m.s, ex = Math.cos(a) * R * 2.05, ey = Math.sin(a) * R * 0.78;
        const mx = cx + ex * Math.cos(rot) - ey * Math.sin(rot), my = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
        ctx.fillStyle = i ? '#ffc13b' : '#ff6b4a'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mx, my, m.r, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    api.setZone = function (z, h) { zone = z; hue = h; };
    api.bump = function () { bumped = 1; };
    requestAnimationFrame(frame);
    return api;
  };

  // ---------- flat confetti / popup system (run screen + summary) ----------
  FX.Particles = function () {
    const parts = [], texts = [], rings = [];
    const MAXP = 360;
    return {
      burst(x, y, o) {
        if (!FX.on) return;
        o = o || {};
        const n = Math.min(o.n || 10, MAXP - parts.length), hue = o.hue === undefined ? 50 : o.hue, sp = o.speed || 160;
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU, v = (0.35 + rnd()) * sp;
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.grav === undefined ? 220 : o.grav, life: 1, d: (1 / (o.life || 0.7)) * (0.7 + rnd() * 0.6), s: (o.size || 3) * (0.8 + rnd() * 1.0), h: hue + (rnd() - 0.5) * (o.spread || 40), shape: o.star && rnd() < 0.5 ? 2 : (rnd() < 0.55 ? 1 : 0), rot: rnd() * TAU, vr: (rnd() - 0.5) * 12 });
        }
      },
      ring(x, y, hue, r, life) { if (FX.on) rings.push({ x, y, h: hue, r: 6, R: r || 60, life: 1, d: 1 / (life || 0.45) }); },
      text(x, y, str, o) {
        if (!FX.on || texts.length > 40) return;
        o = o || {};
        texts.push({ x, y, str, size: o.size || 18, color: o.color || '#ffc13b', glow: o.glow, life: 1, d: 1 / (o.life || 0.9), vy: o.vy || -60, pop: o.pop ? 1 : 0 });
      },
      update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life -= p.d * dt;
          if (p.life <= 0) { parts.splice(i, 1); continue; }
          p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.rot += p.vr * dt;
        }
        for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= t.d * dt; t.y += t.vy * dt; t.vy *= 0.96; if (t.life <= 0) texts.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= r.d * dt; r.r += (r.R - r.r) * Math.min(1, dt * 9); if (r.life <= 0) rings.splice(i, 1); }
      },
      draw(ctx) {
        ctx.lineJoin = 'round';
        for (let i = 0; i < rings.length; i++) {
          const r = rings[i]; ctx.globalAlpha = Math.max(0, Math.min(1, r.life * 1.2));
          ctx.strokeStyle = 'hsl(' + r.h + ',90%,66%)'; ctx.lineWidth = 2 + r.life * 5; ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i], sz = p.s * (0.5 + p.life * 0.7);
          ctx.globalAlpha = Math.min(1, p.life * 1.6); ctx.fillStyle = 'hsl(' + p.h + ',88%,62%)';
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          if (p.shape === 0) ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
          else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, sz, 0, TAU); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(0, -sz * 1.8); ctx.lineTo(sz * 0.6, 0); ctx.lineTo(0, sz * 1.8); ctx.lineTo(-sz * 0.6, 0); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i], a = Math.min(1, t.life * 2.2), sc = t.pop ? 1 + Math.max(0, (t.life - 0.8)) * 2.5 : 1;
          ctx.font = '900 ' + Math.round(t.size * sc) + 'px ' + FX.FONT_N;
          ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.strokeStyle = FX.INK; ctx.strokeText(t.str, t.x, t.y);
          if (t.glow) { ctx.fillStyle = t.glow; ctx.fillText(t.str, t.x + 2, t.y + 3); } // hard offset "misprint" shadow
          ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
        }
        ctx.globalAlpha = 1;
      },
      clear() { parts.length = 0; texts.length = 0; rings.length = 0; }
    };
  };

  root.SC_FX = FX;
})(typeof self !== 'undefined' ? self : this);
