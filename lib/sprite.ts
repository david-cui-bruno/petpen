// Post-process AI-generated sprites: knock out the (fake) "transparent"
// checkerboard + white border that Gemini draws and replace with real alpha.
//
// Strategy: flood fill from the four corners. Any pixel that's "background-ish"
// (white-ish OR a known checker gray) and reachable from a corner without
// crossing the dog's dark outline gets alpha set to 0. The outline itself
// stops the flood so the dog stays intact.

import sharp from "sharp";

interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgbAt(buf: Buffer, idx: number): RGB {
  return { r: buf[idx], g: buf[idx + 1], b: buf[idx + 2] };
}

function isWhiteish({ r, g, b }: RGB): boolean {
  return r >= 235 && g >= 235 && b >= 235;
}

function isCheckerGray({ r, g, b }: RGB): boolean {
  // Gemini's "transparent" checker uses ~#C0C0C0 / #DCDCDC / similar light grays
  return (
    r >= 180 &&
    r <= 230 &&
    g >= 180 &&
    g <= 230 &&
    b >= 180 &&
    b <= 230 &&
    Math.abs(r - g) < 12 &&
    Math.abs(g - b) < 12
  );
}

function isBackgroundPixel(buf: Buffer, idx: number): boolean {
  const c = rgbAt(buf, idx);
  return isWhiteish(c) || isCheckerGray(c);
}

export async function makeTransparentBg(input: Buffer): Promise<Buffer> {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA buffer, got ${channels}-channel`);
  }
  const buf = Buffer.from(data);

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
    if (!isBackgroundPixel(buf, pIdx)) continue;
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
