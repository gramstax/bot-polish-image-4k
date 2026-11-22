import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, forgetUser, resetEnv} from "./setup"

const intent = `forget`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: ForgetPage`, () => {
  it(`clears the user's recent polish jobs + custom prompt and confirms`, async () => {
    await e2e.sendPhoto(forgetUser)
    await bot.db.user.setCustomPrompt(4901, `make it pop`, {username: `forgetuser`, firstName: `F`})
    expect(bot.db.user.recentJobIds(4901).length).toBe(1)
    e2e.clearCalls()
    const responses = await e2e.sendText(`/forget`, forgetUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}, `id`))
    expect(bot.db.user.recentJobIds(4901).length).toBe(0)
    expect(bot.db.user.promptPref(4901).customPrompt).toBe(``)
  })

  it(`after /forget, a new photo starts a fresh history`, async () => {
    await e2e.sendPhoto(forgetUser)
    await e2e.sendText(`/forget`, forgetUser)
    e2e.clearCalls()
    await e2e.sendPhoto(forgetUser)
    expect(bot.db.user.recentJobIds(4901).length).toBe(1)
  })
})
