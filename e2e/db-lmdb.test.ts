import {beforeEach, describe, expect, it} from "bun:test"
import {bot, dbUser, e2e, resetEnv} from "./setup"

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: LMDB stores (user + jobs + session)`, () => {
  it(`user createIfNotExists is idempotent`, async () => {
    // data-e2e persists across runs, so the row may already exist from a
    // previous run — assert idempotency, not first-run creation.
    await bot.db.user.createIfNotExists(dbUser.user.id, {username: `dbuser`, firstName: `Db`})
    const second = await bot.db.user.createIfNotExists(dbUser.user.id, {username: `dbuser`, firstName: `Db`})
    expect(second.created).toBe(false)
    expect(second.user.username).toBe(`dbuser`)
    expect(bot.db.user.count()).toBeGreaterThan(0)
  })

  it(`job queue is FIFO and drains in order`, async () => {
    const draft = {
      userId: dbUser.user.id,
      chatId: dbUser.user.id,
      photoPath: `/tmp/input.png`,
      promptId: `upscale-colorize` as const,
      promptText: `upscale it`,
      promptName: `4K Upscale + Colorize`,
    }
    const a = await bot.db.jobs.enqueue(draft)
    const b = await bot.db.jobs.enqueue(draft)
    expect(bot.db.jobs.queueSize()).toBe(2)
    expect(await bot.db.jobs.dequeueJobId()).toBe(a.id)
    expect(await bot.db.jobs.dequeueJobId()).toBe(b.id)
    expect(await bot.db.jobs.dequeueJobId()).toBeUndefined()
  })

  it(`session counter starts a new chat on the first request`, async () => {
    const next = await bot.db.session.nextRequest()
    expect(next.requestCount).toBeGreaterThanOrEqual(1)
    expect(next.requestCount).toBeLessThanOrEqual(50)
  })

  it(`usage reports map pressure`, () => {
    const usage = bot.db.usage()
    expect(usage.total).toBeGreaterThan(0)
  })
})
