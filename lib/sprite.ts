// Post-process AI-generated sprites: remove the (fake) "transparent"
// background Gemini paints in.
//
// Strategy:
//   1. Walk the image perimeter and count exact RGB occurrences.
//   2. Treat any color making up >=1% of perimeter pixels as a "background
//      anchor."
//   3. Flood-fill from the four corners. A pixel counts as background if
//      its RGB is within +/- TOLERANCE of any anchor (per channel). The
//      tolerance bridges the compression-noise variants Gemini emits
//      around its dominant background tones — without tolerance the flood
//      stops at the first off-by-one neighbor.
//
// Tolerance of 8 catches near-white-and-light-gray clusters but stays well
// clear of saturated subject colors. The dog's dark outline still bounds
// the fill, so the subject body is never touched.

import sharp from "sharp";

const PERIMETER_FREQ_THRESHOLD = 0.01;
const TOLERANCE = 8;

interface Anchor {
  r: number;
  g: number;
  b: number;
}

function collectAnchors(buf: Buffer, width: number, height: number): Anchor[] {
  const counts = new Map<string, number>();
  function sample(x: number, y: number) {
    const i = (y * width + x) * 4;
    const key = `${buf[i]},${buf[i + 1]},${buf[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(0, y);
    sample(width - 1, y);
  }
  const perimeterPixels = 2 * width + 2 * (height - 2);
  const minCount = Math.max(1, perimeterPixels * PERIMETER_FREQ_THRESHOLD);
  const anchors: Anchor[] = [];
  for (const [key, count] of counts) {
    if (count >= minCount) {
      const [r, g, b] = key.split(",").map(Number);
      anchors.push({ r, g, b });
    }
  }
  return anchors;
}

export async function makeTransparentBg(input: Buffer): Promise<Buffer> {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA buffer, got ${channels}-channel`);
  }
  const buf = Buffer.from(data);

  const anchors = collectAnchors(buf, width, height);
  if (anchors.length === 0) {
    return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  function isBg(pIdx: number): boolean {
    const r = buf[pIdx];
    const g = buf[pIdx + 1];
    const b = buf[pIdx + 2];
    for (const a of anchors) {
      if (
        Math.abs(r - a.r) <= TOLERANCE &&
        Math.abs(g - a.g) <= TOLERANCE &&
        Math.abs(b - a.b) <= TOLERANCE
      ) {
        return true;
      }
    }
    return false;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [
    0,
    width - 1,
    (height - 1) * width,
    (height - 1) * width + (width - 1),
  ];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    const pIdx = idx * 4;
    if (!isBg(pIdx)) continue;
    visited[idx] = 1;
    buf[pIdx + 3] = 0;

    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
