import sharp from "sharp";

export async function resizeAndStripExif(
  buffer: Buffer,
  maxDimension = 800
): Promise<Buffer> {
  // sharp's default is to drop all metadata in the output. We do NOT call
  // withMetadata(), which would merge source metadata back in (including GPS).
  // .rotate() with no args reads the EXIF orientation tag and bakes the
  // rotation into pixels before metadata is dropped.
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}
