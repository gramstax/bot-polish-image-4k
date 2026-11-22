import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, resetEnv, startEnUser, startUser, polishUser} from "../setup"

const intent = `start`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: StartPage`, () => {
  it(`respond to /start command with welcome message and full keyboard (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/start`, startUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {userName: `poluser`}, `id`))
    // The menu keyboard comes from the single KeyboardGBlock.mainMenu()
    // definition (EN + ID variants emitted by _build) — labels in ID here.
    expect(e2e.extractButtonLabels(reply)).toEqual([`🖼️ Polish`, `✨ Prompt`, `📊 Status`, `🌐 Bahasa`, `🆘 Bantuan`])
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`respond to /start command with welcome message and full keyboard (English)`, async () => {
    const responses = await e2e.sendText(`/start`, startEnUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {userName: `polen`}, `en`))
    expect(e2e.extractButtonLabels(reply)).toEqual([`🖼️ Polish`, `✨ Prompts`, `📊 Status`, `🌐 Language`, `🆘 Help`])
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `en`))
  })

  it(`edits the welcome page from a callback`, async () => {
    await e2e.sendText(`/start`, startUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(intent, startUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(responses[0]!.method).toBe(`editMessageText`)
    expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(intent, `default`, {userName: `poluser`}, `id`))
    expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(intent, `default`, `inline`, {}, `id`))
  })

  it(`navigates to Polish from the Start keyboard`, async () => {
    await e2e.sendText(`/start`, startUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`polish`, polishUser)
    expect(responses.map((c) => c.method)).toContain(`editMessageText`)
    expect(e2e.extractText(e2e.lastCall(`editMessageText`)!)).toContain(`Polish foto ke 4K`)
  })
})
