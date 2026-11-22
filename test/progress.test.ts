import {describe, expect, it} from "bun:test"
import {jobMessage, progressText} from "../src/lib/progress"

describe(`progressText`, () => {
  it(`shows percent, stage, and queue position in English`, () => {
    const text = progressText(`en`, 40, `prompt-sent`, 2)
    expect(text).toContain(`40%`)
    expect(text).toContain(`prompt sent`)
    expect(text).toContain(`queue #2`)
  })

  it(`shows the same in Indonesian`, () => {
    const text = progressText(`id`, 60, `generating`, 1)
    expect(text).toContain(`60%`)
    expect(text).toContain(`Gemini sedang membuat`)
    expect(text).toContain(`antrean #1`)
  })
})

describe(`jobMessage`, () => {
  it(`done is short and bilingual`, () => {
    expect(jobMessage(`en`, `done`)).toContain(`Polish done`)
    expect(jobMessage(`id`, `done`)).toContain(`Polish selesai`)
  })

  it(`login failure tells the user the owner must log in once`, () => {
    expect(jobMessage(`en`, `failed-login`)).toContain(`log in once`)
    expect(jobMessage(`id`, `failed-login`)).toContain(`login sekali`)
  })

  it(`every failure kind has a distinct English message`, () => {
    const kinds = [`failed-timeout`, `failed-upload`, `failed-download`, `failed-browser`, `failed-strip`, `failed-interrupted`, `failed-generic`] as const
    const texts = kinds.map((k) => jobMessage(`en`, k))
    expect(new Set(texts).size).toBe(kinds.length)
  })
})
