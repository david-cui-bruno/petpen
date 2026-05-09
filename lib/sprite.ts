// Post-process AI-generated sprites: remove the (fake) "transparent"
// background Gemini paints in (typically a checkerboard + white border).
//
// Strategy: sample colors along the image perimeter — those ARE the
// background, by definition, since the subject doesn't touch the edge.
// Then flood-fill from the four corners, zeroing alpha on any pixel whose
// exact RGB matches a perimeter color. The subject's dark outline stops
// the flood so the sprite stays intact.
//
// Self-adapting (no hardcoded thresholds) so it works for whatever
// background Gemini decides to paint that day.

import sharp from "sharp";

const PERIMETER_FREQ_THRESHOLD = 0.01; // a color must be ≥1% of perimeter pixels to count as bg

function rgbKey(r: number, g: number, b: number): string {
  return `${r},${g},${b}`;
}

function collectBackgroundColors(
  buf: Buffer,
  width: number,
  height: number
): Set<string> {
  const counts = new Map<string, number>();
  function sample(x: number, y: number) {
    const i = (y * width + x) * 4;
    const key = rgbKey(buf[i], buf[i + 1], buf[i + 2]);
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
  const bg = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= minCount) bg.add(key);
  }
  return bg;
}

export async function makeTransparentBg(input: Buffer): Promise<Buffer> {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA buffer, got ${channels}-channel`);
  }
  const buf = Buffer.from(data);

  const bgColors = collectBackgroundColors(buf, width, height);
  if (bgColors.size === 0) {
    // Couldn't identify a background; return as-is rather than mangle the sprite.
    return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  function isBg(pIdx: number): boolean {
    return bgColors.has(rgbKey(buf[pIdx], buf[pIdx + 1], buf[pIdx + 2]));
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
