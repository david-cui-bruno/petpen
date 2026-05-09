import sharp from "sharp";

export async function resizeAndStripExif(
  buffer: Buffer,
  maxDimension = 800
): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // honor EXIF orientation before stripping
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .withMetadata({ exif: {}, icc: undefined }) // strip EXIF + ICC
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}
