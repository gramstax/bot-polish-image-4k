import {beforeEach, describe, expect, it} from "bun:test"
import {bot, coverageUser, deniedUser, e2e, noUsernameUser, resetEnv} from "./setup"

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
  process.env.POLISH_ALLOWED_IDS = ``
})

describe(`coverage: AllowList guard (hookBeforeRoute)`, () => {
  it(`denies a user not on POLISH_ALLOWED_IDS and explains why`, async () => {
    process.env.POLISH_ALLOWED_IDS = `4952`
    try {
      const responses = await e2e.sendText(`/start`, deniedUser)
      expect(responses.length).toBeGreaterThan(0)
      expect(responses[0]!.method).toBe(`sendMessage`)
      expect(e2e.extractText(responses[0]!)).toContain(`hanya melayani pengguna yang diizinkan`)
      expect(e2e.extractText(responses[0]!)).not.toContain(`aku Polish 4K`)
    } finally {
      process.env.POLISH_ALLOWED_IDS = ``
    }
  })

  it(`allows a user on POLISH_ALLOWED_IDS`, async () => {
    process.env.POLISH_ALLOWED_IDS = `4952`
    try {
      const responses = await e2e.sendText(`/start`, coverageUser)
      const reply = e2e.lastCall(`sendMessage`)!
      expect(reply).toBeDefined()
      expect(e2e.extractText(reply)).toContain(`aku Polish 4K`)
    } finally {
      process.env.POLISH_ALLOWED_IDS = ``
    }
  })

  it(`allows a user without a Telegram username (no username guard)`, async () => {
    const responses = await e2e.sendText(`/start`, noUsernameUser)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toContain(`aku Polish 4K`)
  })
})

describe(`coverage: recent jobs cap`, () => {
  it(`history keeps only the newest 5 job ids`, async () => {
    const profile = {username: `coverageuser`, firstName: `C`}
    for (let i = 1; i <= 6; i++) {
      await bot.db.user.addRecentJob(4952, `job-${i}`, profile)
    }
    expect(bot.db.user.recentJobIds(4952)).toEqual([`job-6`, `job-5`, `job-4`, `job-3`, `job-2`])
  })
})
