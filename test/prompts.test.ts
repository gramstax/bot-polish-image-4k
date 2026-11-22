import {describe, expect, it} from "bun:test"
import {
  COLORIZE_SENTENCE,
  PROMPT_PRESETS,
  PROMPT_UPSCALE_COLORIZE,
  PROMPT_UPSCALE_ONLY,
  SESSION_MAX_REQUESTS,
  findPreset,
  resolvePromptText,
} from "../src/lib/prompts"

describe(`prompt presets`, () => {
  it(`the default preset is the verbatim prompt, colorize sentence included`, () => {
    expect(PROMPT_UPSCALE_COLORIZE).toContain(`Upscale the uploaded image to 4K resolution`)
    expect(PROMPT_UPSCALE_COLORIZE).toContain(`preserving 100 % character consistency`)
    expect(PROMPT_UPSCALE_COLORIZE).toContain(COLORIZE_SENTENCE)
    expect(PROMPT_UPSCALE_COLORIZE).toContain(`Output a crisp, highly detailed, ultra-high-resolution image suitable for print and professional display.`)
  })

  it(`the upscale-only preset is the same prompt WITHOUT the colorize sentence`, () => {
    expect(PROMPT_UPSCALE_ONLY).not.toContain(COLORIZE_SENTENCE)
    expect(PROMPT_UPSCALE_ONLY).not.toContain(`colorize it`)
    expect(PROMPT_UPSCALE_ONLY.startsWith(PROMPT_UPSCALE_COLORIZE.slice(0, 200))).toBe(true)
    expect(PROMPT_UPSCALE_ONLY.endsWith(`suitable for print and professional display.`)).toBe(true)
  })

  it(`three presets exist: colorize (default), upscale-only, custom`, () => {
    expect(PROMPT_PRESETS.map((p) => p.id)).toEqual([`upscale-colorize`, `upscale-only`, `custom`])
    expect(findPreset(`upscale-colorize`)?.text).toBe(PROMPT_UPSCALE_COLORIZE)
    expect(findPreset(`upscale-only`)?.text).toBe(PROMPT_UPSCALE_ONLY)
    expect(findPreset(`custom`)?.text).toBe(``)
    expect(findPreset(`nope`)).toBeUndefined()
  })

  it(`one chat session holds at most 50 requests`, () => {
    expect(SESSION_MAX_REQUESTS).toBe(50)
  })
})

describe(`resolvePromptText`, () => {
  it(`defaults to the colorize preset when nothing is selected`, () => {
    expect(resolvePromptText(undefined, undefined)).toBe(PROMPT_UPSCALE_COLORIZE)
    expect(resolvePromptText(`upscale-colorize`, undefined)).toBe(PROMPT_UPSCALE_COLORIZE)
    expect(resolvePromptText(`upscale-only`, undefined)).toBe(PROMPT_UPSCALE_ONLY)
  })

  it(`returns the user's custom text for the custom preset`, () => {
    expect(resolvePromptText(`custom`, `  make it pop  `)).toBe(`make it pop`)
  })

  it(`returns undefined for custom with no saved text (caller must ask first)`, () => {
    expect(resolvePromptText(`custom`, undefined)).toBeUndefined()
    expect(resolvePromptText(`custom`, `   `)).toBeUndefined()
  })

  it(`falls back to the default preset for an unknown id`, () => {
    expect(resolvePromptText(`nope` as never, undefined)).toBe(PROMPT_UPSCALE_COLORIZE)
  })
})
