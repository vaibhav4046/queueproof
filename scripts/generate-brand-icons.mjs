#!/usr/bin/env node
/**
 * Rasterises the QueueProof brand mark from the canonical SVG sources into every
 * binary icon surface the app ships. Run after editing public/queueproof-favicon-v2.svg
 * or public/queueproof-app-icon-v2.svg so the PNG/ICO assets never drift from the vector.
 *
 *   node scripts/generate-brand-icons.mjs
 *
 * Output contract (asserted by tests/design-system.test.ts):
 *   queueproof-favicon-v2-32.png      32x32   RGBA  (colour type 6, transparent-capable)
 *   queueproof-apple-touch-icon-v2.png 180x180 RGB  (colour type 2, iOS rejects alpha)
 *   queueproof-icon-v2-192.png        192x192
 *   queueproof-icon-v2-512.png        512x512
 *   queueproof-favicon-v2.ico         16 + 32 + 48 PNG-in-ICO
 *   favicon.ico                       byte-identical copy of the above
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = join(process.cwd(), "public");
const BRAND_BACKGROUND = "#070605";
const ICO_SIZES = [16, 32, 48];

const read = (name) => readFileSync(join(PUBLIC_DIR, name));
const write = (name, buffer) => {
  writeFileSync(join(PUBLIC_DIR, name), buffer);
  return `${name} (${buffer.length.toLocaleString()} bytes)`;
};

const roundedMark = read("queueproof-favicon-v2.svg");
const squareMark = read("queueproof-app-icon-v2.svg");

/** Renders an SVG at an exact pixel size, keeping the alpha channel. */
const renderRgba = (svg, size) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toBuffer();

/** Renders an SVG flattened onto the brand background with no alpha channel. */
const renderRgb = (svg, size) =>
  sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: BRAND_BACKGROUND })
    .flatten({ background: BRAND_BACKGROUND })
    .removeAlpha()
    .toColourspace("srgb")
    .png({ compressionLevel: 9, palette: false, effort: 10 })
    .toBuffer();

/** Packs PNG buffers into a classic ICO container (PNG-in-ICO, supported since IE11). */
function packIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at); // width
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1); // height
    directory.writeUInt8(0, at + 2); // palette size (0 = truecolour)
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

const written = [];

written.push(write("queueproof-favicon-v2-32.png", await renderRgba(roundedMark, 32)));
written.push(write("queueproof-apple-touch-icon-v2.png", await renderRgb(squareMark, 180)));
written.push(write("queueproof-icon-v2-192.png", await renderRgba(squareMark, 192)));
written.push(write("queueproof-icon-v2-512.png", await renderRgba(squareMark, 512)));

const icoEntries = [];
for (const size of ICO_SIZES) {
  icoEntries.push({ size, png: await renderRgba(roundedMark, size) });
}
const ico = packIco(icoEntries);
written.push(write("queueproof-favicon-v2.ico", ico));
written.push(write("favicon.ico", ico));

console.log(`Regenerated QueueProof brand icons:\n  ${written.join("\n  ")}`);
