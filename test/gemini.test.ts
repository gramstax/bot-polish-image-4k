import {describe, expect, it} from "bun:test"
import {mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {SEND_BUTTON_SELECTORS, STAGE_PERCENTS, isLoginWall, mockPolish} from "../src/lib/gemini"
import {mockPhotoBytes} from "../src/lib/photos"

describe(`isLoginWall`, () => {
  it(`is a wall when the prompt box is absent and a Sign in button shows`, () => {
    expect(isLoginWall({url: `https://gemini.google.com/`, bodyText: `Sign in to save activity`, promptBoxCount: 0})).toBe(true)
  })

  it(`is a wall on Google's login host even without the button text`, () => {
    expect(isLoginWall({url: `https://accounts.google.com/signin`, bodyText: `something else`, promptBoxCount: 0})).toBe(true)
  })

  it(`is NOT a wall when the prompt box is present`, () => {
    expect(isLoginWall({url: `https://gemini.google.com/`, bodyText: `Sign in`, promptBoxCount: 1})).toBe(false)
  })

  it(`is NOT a wall on a plain logged-out page without a Sign in button`, () => {
    expect(isLoginWall({url: `https://gemini.google.com/`, bodyText: `Ask Gemini`, promptBoxCount: 0})).toBe(false)
  })
})

describe(`STAGE_PERCENTS`, () => {
  it(`rises from browser-ready to done at 100`, () => {
    const percents = Object.values(STAGE_PERCENTS)
    expect(percents[0]).toBe(15)
    expect(percents[percents.length - 1]).toBe(100)
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]!).toBeGreaterThan(percents[i - 1]!)
    }
  })

  it(`send-button candidates exist (selectors are unproven until a logged-in run)`, () => {
    expect(SEND_BUTTON_SELECTORS.length).toBeGreaterThan(0)
  })
})

describe(`mockPolish`, () => {
  it(`copies the input as the result and reports every stage in order`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `polish-mock-`))
    try {
      const input = join(dir, `input.png`)
      const out = join(dir, `result.png`)
      const {writeFileSync} = await import("node:fs")
      writeFileSync(input, mockPhotoBytes())
      const seen: number[] = []
      const result = await mockPolish(input, out, ({percent}) => {
        seen.push(percent)
      })
      expect(result.resultPath).toBe(out)
      expect(seen).toEqual([15, 25, 40, 60, 85, 100])
      expect(readFileSync(out).equals(mockPhotoBytes())).toBe(true)
    } finally {
      rmSync(dir, {recursive: true, force: true})
    }
  })
})
