#!/usr/bin/env node
/* Generates icons/icon.svg and PNG icons (no dependencies). Usage: node tools/make-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ---------- SVG ----------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="#2d2088"/><stop offset="1" stop-color="#070618"/></radialGradient>
    <radialGradient id="pl" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#b8ffd9"/><stop offset=".55" stop-color="#3fcf8e"/><stop offset="1" stop-color="#14684c"/></radialGradient>
    <radialGradient id="gl" cx="50%" cy="50%" r="50%"><stop offset=".6" stop-color="#7cf0b4" stop-opacity=".55"/><stop offset="1" stop-color="#7cf0b4" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g fill="#fff"><circle cx="70" cy="80" r="3"/><circle cx="430" cy="64" r="2.5"/><circle cx="460" cy="190" r="3.5"/><circle cx="52" cy="300" r="2.5"/>
  <circle cx="120" cy="440" r="3"/><circle cx="410" cy="452" r="3"/><circle cx="250" cy="40" r="2"/><circle cx="380" cy="300" r="2"/></g>
  <circle cx="256" cy="288" r="215" fill="url(#gl)"/>
  <circle cx="256" cy="288" r="140" fill="url(#pl)"/>
  <path d="M256 160 L256 120" stroke="#b8ffd9" stroke-width="9" stroke-linecap="round"/>
  <ellipse cx="205" cy="108" rx="58" ry="26" transform="rotate(-32 205 108)" fill="#b8ffd9"/>
  <ellipse cx="310" cy="96" rx="58" ry="26" transform="rotate(32 310 96)" fill="#8ff5c0"/>
  <circle cx="400" cy="400" r="14" fill="#ffd86b"/>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);

// ---------- PNG rasteriser ----------
const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const STARS = [[-.73, -.69, .012], [.68, -.75, .01], [.8, -.26, .014], [-.8, .17, .01], [-.53, .72, .012], [.6, .77, .012], [-.02, -.84, .008], [.48, .17, .008]];

// color at unit coords (u,v in [-1,1]); k scales the artwork (maskable uses a smaller safe zone)
function colorAt(u, v, k) {
  u /= k; v /= k;
  const d = Math.hypot(u, v * 0.96);
  let c = mix([45, 32, 136], [7, 6, 24], clamp(d / 1.15, 0, 1));
  for (const s of STARS) if (Math.hypot(u - s[0], v - s[1]) < s[2]) c = [255, 255, 255];
  const pu = u, pv = v - 0.125, pd = Math.hypot(pu, pv), R = 0.547;
  if (pd > R) { const g = Math.exp(-(pd - R) * 5.5) * 0.55; c = mix(c, [124, 240, 180], g); }
  else {
    const lx = pu + 0.2, ly = pv + 0.3, t = clamp(Math.hypot(lx, ly) / (R * 1.35), 0, 1);
    c = t < 0.55 ? mix([184, 255, 217], [63, 207, 142], t / 0.55) : mix([63, 207, 142], [20, 104, 76], (t - 0.55) / 0.45);
  }
  if (Math.abs(u) < 0.02 && v > -0.55 && v < -0.37) c = [184, 255, 217];
  const leaf = (cx, cy, ang, rx, ry, col) => {
    const dx = u - cx, dy = v - cy, ca = Math.cos(-ang), sa = Math.sin(-ang);
    const x = dx * ca - dy * sa, y = dx * sa + dy * ca;
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) < 1) c = col;
  };
  leaf(-0.2, -0.578, -0.5585, 0.227, 0.102, [184, 255, 217]);
  leaf(0.211, -0.625, 0.5585, 0.227, 0.102, [143, 245, 192]);
  if (Math.hypot(u - 0.5625, v - 0.5625) < 0.055) c = [255, 216, 107];
  return c;
}
function render(size, k) {
  const buf = Buffer.alloc(size * size * 4), SS = 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const c = colorAt(((x + (sx + 0.5) / SS) / size) * 2 - 1, ((y + (sy + 0.5) / SS) / size) * 2 - 1, k);
      r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * size + x) * 4, n = SS * SS;
    buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = 255;
  }
  return encodePng(size, size, buf);
}
fs.writeFileSync(path.join(OUT, 'icon-192.png'), render(192, 1));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), render(512, 1));
fs.writeFileSync(path.join(OUT, 'maskable-512.png'), render(512, 0.78));
console.log('icons written to', OUT);
