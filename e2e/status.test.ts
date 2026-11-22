import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, resetEnv, statusUser} from "./setup"

const intent = `status`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: StatusPage`, () => {
  it(`/status with no jobs shows an empty queue and 0/50 session`, async () => {
    const responses = await e2e.sendText(`/status`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `default`, {jobs: [], queueSize: 0, sessionCount: 0, sessionMax: 50}, `id`),
    )
  })

  it(`/status lists a queued job with its prompt, status, and percent`, async () => {
    await e2e.sendPhoto(statusUser)
    e2e.clearCalls()
    const responses = await e2e.sendText(`/status`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    const text = e2e.extractText(reply)
    expect(text).toContain(`4K Upscale + Colorize`)
    expect(text).toContain(`dalam antrean`)
    expect(text).toContain(`5%`)
    expect(text).toContain(`Antrean: 1 job menunggu`)
    expect(text).toContain(`0/50`)
  })

  it(`shows the status from the Status button (callback)`, async () => {
    const responses = await e2e.sendCallbackQuery(`status`, statusUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `default`, {jobs: [], queueSize: 0, sessionCount: 0, sessionMax: 50}, `id`),
    )
  })
})

describe(`E2E: StatusPage session counter`, () => {
  it(`reflects the stored Gemini session count`, async () => {
    await bot.db.session.nextRequest()
    await bot.db.session.setChatUrl(`https://gemini.google.com/app/abc`)
    await bot.db.session.nextRequest()
    const responses = await e2e.sendText(`/status`, statusUser)
    expect(e2e.extractText(e2e.lastCall(`sendMessage`)!)).toContain(`2/50`)
  })
})
