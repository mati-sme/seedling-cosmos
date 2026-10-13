/* Seedling Cosmos - visual effects: animated starfield, procedural planet/galaxy, particles, popups. */
(function (root) {
  'use strict';
  const FX = { on: true };
  const reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TAU = Math.PI * 2;
  const rnd = Math.random;

  // ---------- starfield ----------
  FX.Starfield = function (canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, hue = 250, targetHue = 250, stars = [], shoot = null;
    function resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 1.5);
      w = canvas.width = Math.floor(innerWidth * dpr); h = canvas.height = Math.floor(innerHeight * dpr);
      const n = Math.min(140, Math.floor(w * h / 9000));
      stars = [];
      for (let i = 0; i < n; i++) stars.push({ x: rnd() * w, y: rnd() * h, z: 0.3 + rnd() * 0.9, p: rnd() * TAU, s: 0.6 + rnd() * 1.6 });
    }
    function frame(t) {
      hue += (targetHue - hue) * 0.02;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, Math.max(w, h) * 0.8);
      g.addColorStop(0, 'hsla(' + hue + ',60%,22%,.55)');
      g.addColorStop(0.5, 'hsla(' + (hue + 40) + ',55%,10%,.35)');
      g.addColorStop(1, 'rgba(5,4,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const drift = reduce ? 0 : 0.08;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.y += s.z * drift * 3; if (s.y > h) { s.y = -2; s.x = rnd() * w; }
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.0015 * s.z + s.p));
        ctx.globalAlpha = a; ctx.fillStyle = i % 7 === 0 ? 'hsl(' + hue + ',90%,80%)' : '#fff';
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
      requestAnimationFrame(frame);
    }
    resize();
    addEventListener('resize', resize);
    requestAnimationFrame(frame);
    return { setHue(v) { targetHue = v; } };
  };

  // ---------- planet / galaxy ----------
  FX.Planet = function (canvas) {
    const ctx = canvas.getContext('2d');
    let zone = 0, hue = 140, scale = 1, parts = [], pts = null, last = 0, spawnT = 0;
    const api = { visible: true };
    function resize() {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      const size = Math.max(120, Math.round(r.width * dpr));
      if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    }
    function buildGalaxy() {
      const arms = 2 + Math.floor(Math.max(0, zone - 4) / 2);
      pts = [];
      for (let i = 0; i < 420; i++) {
        const arm = i % arms, r = Math.pow(rnd(), 0.75) * 150;
        pts.push({ r, a: r * 0.042 + arm * TAU / arms + (rnd() - 0.5) * 0.5, s: 0.8 + rnd() * 2.2, l: 60 + rnd() * 30, h: (rnd() - 0.5) * 40 });
      }
    }
    function glow(cx, cy, r, h, a) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'hsla(' + h + ',90%,65%,' + a + ')'); g.addColorStop(1, 'hsla(' + h + ',90%,50%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
    function sphere(cx, cy, r, h, s, l) {
      const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
      g.addColorStop(0, 'hsl(' + h + ',' + s + '%,' + (l + 22) + '%)'); g.addColorStop(1, 'hsl(' + h + ',' + s + '%,' + (l - 14) + '%)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
    function leaf(x, y, ang, len, h) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = 'hsl(' + h + ',70%,55%)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -len * 0.45, len, 0); ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0); ctx.fill();
      ctx.restore();
    }
    function body(t) {
      const cx = 170, cy = 170, sec = t / 1000;
      glow(cx, cy, 165, hue, 0.35);
      if (zone === 0) {
        ctx.save(); ctx.translate(cx, cy + 8 + Math.sin(sec * 1.6) * 3);
        const g = ctx.createRadialGradient(-10, -16, 4, 0, 0, 50);
        g.addColorStop(0, 'hsl(' + hue + ',80%,78%)'); g.addColorStop(0.6, 'hsl(' + hue + ',65%,45%)'); g.addColorStop(1, 'hsl(' + hue + ',55%,22%)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 38, 50, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'hsla(' + hue + ',80%,85%,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 38, 50, 0, 0.3, 2.2); ctx.stroke();
        const sw = Math.sin(sec * 2) * 0.12;
        leaf(0, -46, -2.3 + sw, 36, hue + 10); leaf(0, -46, -0.85 - sw, 36, hue + 20);
        ctx.restore();
      } else if (zone === 1) {
        sphere(cx, cy, 64, 120, 18, 48);
        ctx.fillStyle = 'rgba(0,0,0,.16)';
        [[-20, -10, 11], [18, 14, 14], [-6, 30, 8], [26, -26, 7]].forEach((c) => { ctx.beginPath(); ctx.arc(cx + c[0], cy + c[1], c[2], 0, TAU); ctx.fill(); });
        const sw = Math.sin(sec * 2) * 0.1;
        leaf(cx + 4, cy - 62, -2.2 + sw, 30, 130); leaf(cx + 4, cy - 62, -0.9 - sw, 30, 140);
        glow(cx, cy, 90, 120, 0.15);
      } else if (zone === 2) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 86, 0, TAU); ctx.clip();
        sphere(cx, cy, 86, 205, 60, 36);
        for (let i = 0; i < 7; i++) {
          const a = sec * 0.35 + i * 0.9, c = Math.cos(a);
          if (c < -0.2) continue;
          const x = cx + Math.sin(a) * 70 * 0.95, y = cy + Math.sin(i * 2.3) * 48;
          ctx.fillStyle = 'hsl(' + (hue + i * 6) + ',55%,45%)';
          ctx.beginPath(); ctx.ellipse(x, y, 26 * (0.4 + c * 0.6), 20, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = 'hsl(' + (330 + i * 20) + ',90%,75%)';
          ctx.beginPath(); ctx.arc(x - 6, y - 3, 3, 0, TAU); ctx.arc(x + 7, y + 4, 2.5, 0, TAU); ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = 'hsla(190,90%,75%,.35)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(cx, cy, 90, 0, TAU); ctx.stroke();
      } else if (zone === 3) {
        glow(cx, cy, 70, 48, 0.9);
        sphere(cx, cy, 30, 48, 100, 58);
        [[78, 12, 150, 0.7], [112, 16, 200, 0.5], [146, 11, 310, 0.35]].forEach((p, i) => {
          ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(cx, cy, p[0], p[0] * 0.55, 0, 0, TAU); ctx.stroke();
          const a = sec * p[3] + i * 2;
          sphere(cx + Math.cos(a) * p[0], cy + Math.sin(a) * p[0] * 0.55, p[1], p[2], 55, 45);
        });
      } else {
        if (!pts) buildGalaxy();
        const squash = zone < 6 ? 0.62 : 0.85, rot = sec * 0.12;
        glow(cx, cy, 70 + zone * 6, hue, 0.7);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, squash);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], a = p.a + rot * (1.4 - p.r / 200);
          ctx.fillStyle = 'hsla(' + (hue + p.h) + ',85%,' + p.l + '%,.85)';
          ctx.fillRect(Math.cos(a) * p.r - p.s / 2, Math.sin(a) * p.r - p.s / 2, p.s, p.s);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        if (zone >= 6) {
          ctx.save(); ctx.translate(cx, cy); ctx.lineCap = 'round';
          const nb = zone >= 8 ? 10 : 7;
          for (let b = 0; b < nb; b++) {
            const a = b * TAU / nb + Math.sin(sec * 0.4 + b) * 0.05 - Math.PI / 2;
            ctx.strokeStyle = 'hsla(' + (hue + 60) + ',70%,60%,.5)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a + 0.4) * 70, Math.sin(a + 0.4) * 70, Math.cos(a) * 140, Math.sin(a) * 140); ctx.stroke();
            ctx.fillStyle = 'hsla(' + (hue + b * 30) + ',90%,75%,.9)';
            ctx.beginPath(); ctx.arc(Math.cos(a) * 140, Math.sin(a) * 140, 4 + Math.sin(sec * 2 + b) * 1.5, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }
        if (zone >= 9) {
          ctx.save(); ctx.translate(cx, cy); ctx.rotate(sec * 0.2); ctx.globalCompositeOperation = 'lighter';
          for (let r = 0; r < 12; r++) {
            ctx.rotate(TAU / 12);
            const g = ctx.createLinearGradient(0, 0, 160, 0);
            g.addColorStop(0, 'rgba(255,230,140,.5)'); g.addColorStop(1, 'rgba(255,230,140,0)');
            ctx.fillStyle = g; ctx.fillRect(0, -3, 160, 6);
          }
          ctx.restore();
        }
        glow(cx, cy, 26, 50, 1);
      }
    }
    function frame(t) {
      requestAnimationFrame(frame);
      if (!api.visible) return;
      const dt = Math.min(50, t - last); last = t;
      resize();
      ctx.setTransform(canvas.width / 340, 0, 0, canvas.width / 340, 0, 0);
      ctx.clearRect(0, 0, 340, 340);
      scale += (1 - scale) * Math.min(1, dt * 0.014);
      ctx.save(); ctx.translate(170, 170); ctx.scale(scale, scale); ctx.translate(-170, -170);
      body(t);
      ctx.restore();
      if (FX.on && !reduce) {
        spawnT += dt;
        if (spawnT > 220) { spawnT = 0; if (parts.length < 120) parts.push({ x: 170 + (rnd() - 0.5) * 220, y: 170 + (rnd() - 0.5) * 220, vx: (rnd() - 0.5) * 0.15, vy: -0.1 - rnd() * 0.2, life: 1, d: 0.006, s: 1 + rnd() * 1.6, h: hue + rnd() * 40 }); }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx * dt * 0.06 * 16; p.y += p.vy * dt * 0.06 * 16; if (p.g) p.vy += p.g * dt * 0.06;
        p.life -= p.d * dt * 0.06 * 1.6;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = 'hsla(' + p.h + ',95%,70%,' + p.life + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.5 + p.life * 0.7), 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    api.setZone = function (z, h) { if (z !== zone) { zone = z; pts = null; } hue = h; };
    api.bounce = function () { scale = 1.1; };
    api.burst = function (x, y, n, h, speed) {
      if (!FX.on) return;
      n = Math.min(n, 140 - parts.length);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, v = (0.6 + rnd()) * (speed || 1);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.3, g: 0.01, life: 1, d: 0.012 + rnd() * 0.01, s: 1.4 + rnd() * 2.4, h: h + (rnd() - 0.5) * 50 });
      }
    };
    requestAnimationFrame(frame);
    return api;
  };

  // ---------- floating popups ----------
  let popCount = 0;
  FX.popup = function (layer, x, y, text, crit) {
    if (!FX.on || popCount > 28) return;
    const el = document.createElement('div');
    el.className = 'pop' + (crit ? ' crit' : '');
    el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    popCount++;
    el.addEventListener('animationend', () => { el.remove(); popCount--; });
    layer.appendChild(el);
  };

  root.SC_FX = FX;
})(typeof self !== 'undefined' ? self : this);
