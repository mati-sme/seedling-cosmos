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
  <rect width="512" height="512" fill="#f4ead5"/>
  <circle cx="256" cy="316" r="212" fill="none" stroke="#12211f" stroke-width="7" stroke-dasharray="4 22" stroke-linecap="round" opacity=".55"/>
  <circle cx="282" cy="346" r="140" fill="#12211f" opacity=".9"/>
  <circle cx="256" cy="316" r="140" fill="#ffc13b" stroke="#12211f" stroke-width="22"/>
  <path d="M256 190 L256 128" stroke="#12211f" stroke-width="30" stroke-linecap="round"/>
  <ellipse cx="204" cy="108" rx="64" ry="30" transform="rotate(-32 204 108)" fill="#3ed6a0" stroke="#12211f" stroke-width="18"/>
  <ellipse cx="312" cy="96" rx="64" ry="30" transform="rotate(32 312 96)" fill="#3ed6a0" stroke="#12211f" stroke-width="18"/>
  <circle cx="400" cy="432" r="30" fill="#ff6b4a" stroke="#12211f" stroke-width="14"/>
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
const INK = [18, 33, 31];
// flat-colour icon: layered shapes with ink outlines; unit coords (u,v in [-1,1]); k scales the artwork (maskable uses a smaller safe zone)
function colorAt(u, v, k) {
  u /= k; v /= k;
  let c = [244, 234, 213];
  const circ = (cx, cy, R, fill, ow) => { const d = Math.hypot(u - cx, v - cy) - R; if (d < 0) c = fill; if (ow && d < ow / 2 && d > -ow / 2) c = INK; if (ow && d < 0 && d > -ow) c = INK; };
  // dashed orbit
  { const dx = u, dy = v - 0.234, d = Math.hypot(dx, dy) - 0.828, a = Math.atan2(dy, dx); if (Math.abs(d) < 0.014 && Math.sin(a * 36) > 0.2) c = [130, 122, 100]; }
  // shadow + planet
  if (Math.hypot(u - 0.1, v - 0.355) < 0.547) c = INK;
  circ(0, 0.234, 0.547, [255, 193, 59], 0.086);
  // stem and leaves
  if (Math.abs(u) < 0.058 && v > -0.55 && v < -0.18) c = INK;
  const leaf = (cx, cy, ang, rx, ry, col) => {
    const dx = u - cx, dy = v - cy, ca = Math.cos(-ang), sa = Math.sin(-ang);
    const x = dx * ca - dy * sa, y = dx * sa + dy * ca, f = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
    if (f < 1 + 0.07 / ry * 0.45) c = INK;
    if (f < 1 - 0.07 / ry * 0.45 + 0.0) c = col;
  };
  leaf(-0.2, -0.578, -0.5585, 0.25, 0.117, [62, 214, 160]);
  leaf(0.211, -0.625, 0.5585, 0.25, 0.117, [62, 214, 160]);
  circ(0.5625, 0.6875, 0.117, [255, 107, 74], 0.055);
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
