import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, helpEnUser, helpUser, resetEnv, startUser} from "./setup"

const intent = `help`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: HelpPage`, () => {
  it(`/help renders the full help (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/help`, helpUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })

  it(`/help renders the English variant for an en user`, async () => {
    const responses = await e2e.sendText(`/help`, helpEnUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `en`))
  })

  it(`shows the same help from the Help button (callback)`, async () => {
    await e2e.sendText(`/start`, startUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`help`, helpUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
  })
})
