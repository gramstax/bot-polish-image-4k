/**
 * Metadata strip — the restored-content-factory rule, enforced here
 * before ANY polished image reaches a user: re-encode the image and
 * drop C2PA / SynthID / XMP metadata, then byte-scan the output to
 * prove it is gone. A result that still carries markers is refused,
 * never sent.
 *
 * Implementation: sharp re-encodes (JPEG q95, PNG default) and never
 * calls withMetadata(), so no EXIF/XMP/JUMBF segments survive. The
 * byte scan is the proof: it looks for the marker strings in the
 * output bytes, the same check the factory uses (PIL re-save q95 +
 * byte-scan).
 */
import {readFile} from "node:fs/promises"
import sharp from "sharp"

/** Byte strings that must not survive the strip (case-insensitive). */
export const AI_MARKERS = [`c2pa`, `synthid`, `xmp`, `jumbf`, `c2pa_manifest`, `http://ns.adobe.com/xap/1.0/`] as const

/** True when the bytes contain any AI-metadata marker. */
export function hasAiMarkers(bytes: Buffer): boolean {
  const lower = bytes.toString(`latin1`).toLowerCase()
  return AI_MARKERS.some((marker) => lower.includes(marker))
}

/**
 * Re-encode `inputPath` to `outputPath`, dropping all metadata.
 * JPEG → JPEG q95; PNG → PNG; anything else → JPEG q95.
 */
export async function stripMetadata(inputPath: string, outputPath: string): Promise<string> {
  const image = sharp(inputPath)
  const meta = await image.metadata()
  if (meta.format === `png`) {
    await image.png().toFile(outputPath)
  } else {
    await image.jpeg({quality: 95}).toFile(outputPath)
  }
  return outputPath
}

/**
 * Strip + verify: re-encode, then byte-scan the output. Throws when a
 * marker survives — the caller must fail the job, never send the file.
 */
export async function stripAndVerify(inputPath: string, outputPath: string): Promise<string> {
  await stripMetadata(inputPath, outputPath)
  const bytes = await readFile(outputPath)
  if (hasAiMarkers(bytes)) {
    throw new Error(`metadata strip failed: AI markers still present in ${outputPath}`)
  }
  return outputPath
}
