import {describe, expect, it} from "bun:test"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import sharp from "sharp"
import {mockPhotoBytes, saveMockPhoto} from "../src/lib/photos"

describe(`saveMockPhoto`, () => {
  it(`writes a fixture PNG that sharp can read`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `polish-photo-`))
    try {
      const path = await saveMockPhoto(dir)
      expect(path).toBe(join(dir, `input.png`))
      const meta = await sharp(path).metadata()
      expect(meta.format).toBe(`png`)
      expect(meta.width).toBe(1)
      expect(meta.height).toBe(1)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })

  it(`the fixture bytes are a valid 1x1 PNG`, () => {
    expect(mockPhotoBytes()[0]).toBe(0x89)
    expect(mockPhotoBytes()[1]).toBe(0x50) // "P" of PNG
  })
})
