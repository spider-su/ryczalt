import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const blue = [23, 105, 224];
const white = [255, 255, 255];
const pale = [207, 226, 255];
const dark = [21, 34, 56];

const segments = [
  { a: [13, 13], b: [29, 13], width: 4, color: null },
  { a: [21, 13], b: [21, 35], width: 4, color: null },
  { a: [13, 35], b: [27, 35], width: 4, color: null },
  { a: [24, 30], b: [31, 23], width: 3.2, color: 'accent' },
  { a: [31, 23], b: [34, 25], width: 3.2, color: 'accent' },
  { a: [34, 25], b: [41, 16], width: 3.2, color: 'accent' },
  { a: [35, 16], b: [41, 16], width: 3.2, color: 'accent' },
  { a: [41, 16], b: [41, 22], width: 3.2, color: 'accent' }
];

function distanceToSegment(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax; const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

function sampleAt(nx, ny, { background, mark, splash = false, adaptive = false }) {
  const coords = splash ? [nx * 64 - 8, ny * 64 - 8] : [nx * 48, ny * 48];
  const [x, y] = coords;
  let color = background ? blue : null;
  if (mark) {
    for (const segment of segments) {
      if (distanceToSegment(x, y, segment.a, segment.b) <= segment.width / 2) {
        color = segment.color ? (mark === 'white' ? pale : mark === 'dark' ? dark : blue) : mark === 'white' ? white : mark === 'dark' ? dark : blue;
      }
    }
  }
  if (adaptive && !color) return [0, 0, 0, 0];
  return color ? [...color, 255] : [0, 0, 0, 0];
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function renderPng(size, options) {
  const supersample = size <= 48 ? 4 : 2;
  const width = size * supersample;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1); raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const sums = [0, 0, 0, 0];
      for (let sy = 0; sy < supersample; sy++) for (let sx = 0; sx < supersample; sx++) {
        const sample = sampleAt((x + (sx + 0.5) / supersample) / size, (y + (sy + 0.5) / supersample) / size, options);
        for (let channel = 0; channel < 4; channel++) sums[channel] += sample[channel];
      }
      const offset = row + 1 + x * 4;
      for (let channel = 0; channel < 4; channel++) raw[offset + channel] = Math.round(sums[channel] / (supersample * supersample));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function save(path, size, options) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderPng(size, options));
}

for (const size of [16, 32, 48]) save(`public/favicon-${size}.png`, size, { background: true, mark: 'white' });
save('public/apple-touch-icon.png', 180, { background: true, mark: 'white' });
save('public/pwa-192.png', 192, { background: true, mark: 'white' });
save('public/pwa-512.png', 512, { background: true, mark: 'white' });
save('public/pwa-maskable-512.png', 512, { background: true, mark: 'white' });
save('assets/brand/app-icon.png', 1024, { background: true, mark: 'white' });
save('assets/brand/adaptive-foreground.png', 1024, { mark: 'white', adaptive: true });
save('assets/brand/splash.png', 512, { mark: 'blue', splash: true });
console.log('Generated Investory icon assets at 16, 32, 48, 180, 192, 512, and 1024 px.');
