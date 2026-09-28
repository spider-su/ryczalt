import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const root = resolve(import.meta.dirname, '..');
const input = PNG.sync.read(readFileSync(resolve(root, 'assets/brand/ryczalt-app-icon.png')));
const RED = [197, 38, 50];
const WHITE = [255, 255, 255];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function blank(width, height = width) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function sample(source, x, y) {
  const x0 = clamp(Math.floor(x), 0, source.width - 1);
  const y0 = clamp(Math.floor(y), 0, source.height - 1);
  const x1 = Math.min(x0 + 1, source.width - 1);
  const y1 = Math.min(y0 + 1, source.height - 1);
  const fx = clamp(x - x0, 0, 1);
  const fy = clamp(y - y0, 0, 1);
  const result = [];
  for (let channel = 0; channel < 4; channel++) {
    const a = source.data[(y0 * source.width + x0) * 4 + channel];
    const b = source.data[(y0 * source.width + x1) * 4 + channel];
    const c = source.data[(y1 * source.width + x0) * 4 + channel];
    const d = source.data[(y1 * source.width + x1) * 4 + channel];
    result.push(Math.round((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy));
  }
  return result;
}

function resize(source, size, height = size) {
  const target = blank(size, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < size; x++) {
    const pixel = sample(source, (x + 0.5) * source.width / size - 0.5, (y + 0.5) * source.height / height - 0.5);
    target.data.set(pixel, (y * size + x) * 4);
  }
  return target;
}

function save(path, image) {
  const target = resolve(root, path);
  writeFileSync(target, PNG.sync.write({ ...image, depth: 8, colorType: 6, inputColorType: 6 }));
}

function makeMask(box) {
  const mask = blank(input.width, input.height);
  for (let y = box.top; y <= box.bottom; y++) for (let x = box.left; x <= box.right; x++) {
    const index = (y * input.width + x) * 4;
    const r = input.data[index]; const g = input.data[index + 1]; const b = input.data[index + 2];
    const low = Math.min(r, g, b); const high = Math.max(r, g, b);
    if (low < 135 || high - low > 65) continue;
    const alpha = Math.round(clamp((low - 110) / 145, 0, 1) * 255);
    mask.data[index] = 255; mask.data[index + 1] = 255; mask.data[index + 2] = 255; mask.data[index + 3] = alpha;
  }
  return mask;
}

// These bounds select the visible white R, house, and chimney from the approved master.
// They intentionally exclude the glossy red field and its highlights.
const rOnly = makeMask({ left: 156, top: 188, right: 865, bottom: 870 });
const fullMark = makeMask({ left: 156, top: 188, right: 1028, bottom: 948 });

function getBounds(mask) {
  let left = mask.width; let top = mask.height; let right = -1; let bottom = -1;
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    if (!mask.data[(y * mask.width + x) * 4 + 3]) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return { left, top, right, bottom };
}

function placeMask(mask, size, scale, background = null, foreground = WHITE) {
  const bounds = getBounds(mask);
  const target = blank(size);
  if (background) for (let i = 0; i < target.data.length; i += 4) {
    target.data[i] = background[0]; target.data[i + 1] = background[1]; target.data[i + 2] = background[2]; target.data[i + 3] = 255;
  }
  const sourceCenterX = (bounds.left + bounds.right + 1) / 2;
  const sourceCenterY = (bounds.top + bounds.bottom + 1) / 2;
  const center = (size - 1) / 2;
  const targetWidth = (bounds.right - bounds.left + 1) * scale;
  const targetHeight = (bounds.bottom - bounds.top + 1) * scale;
  const left = center - targetWidth / 2;
  const top = center - targetHeight / 2;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(size, Math.ceil(top + targetHeight)); y++) {
    for (let x = Math.max(0, Math.floor(left)); x < Math.min(size, Math.ceil(left + targetWidth)); x++) {
      const sourceX = sourceCenterX + (x + 0.5 - center) / scale;
      const sourceY = sourceCenterY + (y + 0.5 - center) / scale;
      const pixel = sample(mask, sourceX, sourceY);
      const alpha = pixel[3] / 255;
      if (alpha <= 0) continue;
      const index = (y * size + x) * 4;
      if (background) {
        target.data[index] = Math.round(foreground[0] * alpha + background[0] * (1 - alpha));
        target.data[index + 1] = Math.round(foreground[1] * alpha + background[1] * (1 - alpha));
        target.data[index + 2] = Math.round(foreground[2] * alpha + background[2] * (1 - alpha));
        target.data[index + 3] = 255;
      } else {
        target.data[index] = foreground[0]; target.data[index + 1] = foreground[1]; target.data[index + 2] = foreground[2];
        target.data[index + 3] = pixel[3];
      }
    }
  }
  return target;
}

function adaptiveForeground(size) {
  const bounds = getBounds(fullMark);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const farthest = Math.max(...[
    [bounds.left, bounds.top], [bounds.left, bounds.bottom],
    [bounds.right, bounds.top], [bounds.right, bounds.bottom],
  ].map(([x, y]) => Math.hypot(x - centerX, y - centerY)));
  return placeMask(fullMark, size, size * 0.32 / farthest);
}

function faviconIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  const payloads = [];
  for (const image of images) {
    const png = PNG.sync.write({ ...image, depth: 8, colorType: 6, inputColorType: 6 });
    const entry = Buffer.alloc(16);
    entry[0] = image.width === 256 ? 0 : image.width; entry[1] = image.height === 256 ? 0 : image.height;
    entry[2] = 0; entry[3] = 0; entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(offset, 12);
    entries.push(entry); payloads.push(png); offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...payloads]);
}

const master = resize(input, 1024);
save('assets/brand/app-icon.png', master);
save('assets/brand/adaptive-foreground.png', adaptiveForeground(1024));
save('assets/brand/splash.png', placeMask(fullMark, 512, 512 * 0.56 / Math.max(input.width, input.height), null, RED));

const smallR = [16, 32].map((size) => placeMask(rOnly, size, size * 0.82 / (getBounds(rOnly).right - getBounds(rOnly).left + 1), RED));
save('public/favicon-16.png', smallR[0]);
save('public/favicon-32.png', resize(master, 32));
save('public/favicon-48.png', resize(master, 48));
save('public/favicon.png', resize(master, 48));
save('public/apple-touch-icon.png', resize(master, 180));
save('public/pwa-192.png', resize(master, 192));
save('public/pwa-512.png', resize(master, 512));
save('public/pwa-maskable-512.png', (() => {
  const target = blank(512);
  for (let i = 0; i < target.data.length; i += 4) {
    target.data[i] = RED[0]; target.data[i + 1] = RED[1]; target.data[i + 2] = RED[2]; target.data[i + 3] = 255;
  }
  const mark = adaptiveForeground(512);
  for (let i = 0; i < target.data.length; i += 4) {
    const alpha = mark.data[i + 3] / 255;
    if (!alpha) continue;
    target.data[i] = Math.round(WHITE[0] * alpha + RED[0] * (1 - alpha));
    target.data[i + 1] = Math.round(WHITE[1] * alpha + RED[1] * (1 - alpha));
    target.data[i + 2] = Math.round(WHITE[2] * alpha + RED[2] * (1 - alpha));
  }
  return target;
})());
writeFileSync(resolve(root, 'public/favicon.ico'), faviconIco([smallR[0], resize(master, 32)]));
console.log('Generated Ryczałt icons from assets/brand/ryczalt-app-icon.png.');
