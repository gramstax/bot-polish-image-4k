import {describe, expect, it} from "bun:test"
import {KeyboardGBlock} from "../src/blocks/g-keyboard"

/**
 * The multi-language keyboard block: each keyboard's labels are defined
 * ONCE (one `{default, id}` object in KeyboardGBlock.label) and `_build`
 * emits BOTH `<g-keyboard>` variants from it — no page template ever
 * writes the EN and ID keyboards twice (Damar 2026-11-19 ~14:58 WIB).
 */
describe(`KeyboardGBlock`, () => {
  it(`mainMenu emits one block per language from a single definition`, () => {
    const out = KeyboardGBlock.mainMenu()
    expect(out).toContain(`<g-keyboard type="inline" lang="default">🖼️ Polish, ✨ Prompts, 📊 Status, 🌐 Language, 🆘 Help</g-keyboard>`)
    expect(out).toContain(`<g-keyboard type="inline" lang="id">🖼️ Polish, ✨ Prompt, 📊 Status, 🌐 Bahasa, 🆘 Bantuan</g-keyboard>`)
    // Each label appears exactly once per variant — no duplication.
    expect(out.split(`🖼️ Polish`).length - 1).toBe(2)
  })

  it(`promptPicker emits one block per language from a single definition`, () => {
    const out = KeyboardGBlock.promptPicker()
    expect(out).toContain(`<g-keyboard type="inline" lang="default">4K Upscale + Colorize, 4K Upscale only, ✏️ Custom prompt, ⬅️ Back</g-keyboard>`)
    expect(out).toContain(`<g-keyboard type="inline" lang="id">4K Upscale + Colorize, 4K Upscale saja, ✏️ Prompt custom, ⬅️ Kembali</g-keyboard>`)
  })

  it(`languagePicker emits one block per language from a single definition`, () => {
    const out = KeyboardGBlock.languagePicker()
    expect(out).toContain(`<g-keyboard type="inline" lang="default">🇬🇧 English, 🇮🇩 Indonesia, ⬅️ Back</g-keyboard>`)
    expect(out).toContain(`<g-keyboard type="inline" lang="id">🇬🇧 English, 🇮🇩 Indonesia, ⬅️ Kembali</g-keyboard>`)
  })

  it(`a single-language build returns only that variant`, () => {
    const out = KeyboardGBlock.back(`id`)
    expect(out).toContain(`⬅️ Kembali`)
    expect(out).not.toContain(`⬅️ Back`)
  })

  it(`home/back/cancel/backHome still build both variants`, () => {
    expect(KeyboardGBlock.home()).toContain(`🏠 Home`)
    expect(KeyboardGBlock.home()).toContain(`🏠 Beranda`)
    expect(KeyboardGBlock.backHome()).toContain(`⬅️ Back, 🏠 Home`)
    expect(KeyboardGBlock.backHome()).toContain(`⬅️ Kembali, 🏠 Beranda`)
  })
})
