import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, polishEnUser, polishUser, resetEnv} from "./setup"

const intent = `polish`

function sendMessages() {
  return e2e.calls.filter((c) => c.method === `sendMessage`)
}

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: PolishPage`, () => {
  it(`/polish without a photo shows the prompt (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/polish`, polishUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `prompt`, position: 0, promptName: ``}, `id`))
  })

  it(`/polish shows the English prompt for an en user`, async () => {
    const responses = await e2e.sendText(`/polish`, polishEnUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `prompt`, position: 0, promptName: ``}, `en`))
  })

  it(`a photo enqueues a job and ACKs immediately with queue position + prompt name`, async () => {
    const responses = await e2e.sendPhoto(polishUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.calls.some((c) => c.method === `sendChatAction`)).toBe(true)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `ack`, {state: `ack`, position: 1, promptName: `4K Upscale + Colorize`}, `id`),
    )
    // The job is queued (the worker never runs in e2e) with 5% progress.
    const ids = bot.db.user.recentJobIds(4401)
    expect(ids.length).toBe(1)
    const job = bot.db.jobs.find(ids[0]!)
    expect(job?.status).toBe(`queued`)
    expect(job?.percent).toBe(5)
    expect(job?.promptId).toBe(`upscale-colorize`)
    expect(bot.db.jobs.queueSize()).toBe(1)
  })

  it(`a photo with a caption uses the caption as a one-off custom prompt`, async () => {
    await e2e.sendPhoto({...polishUser, caption: `make the sky dramatic`})
    const ids = bot.db.user.recentJobIds(4401)
    expect(ids.length).toBe(1)
    const job = bot.db.jobs.find(ids[0]!)
    expect(job?.promptId).toBe(`custom`)
    expect(job?.promptText).toBe(`make the sky dramatic`)
    expect(job?.promptName).toBe(`Custom (caption)`)
    // The stored preset is untouched by a caption override.
    expect(bot.db.user.promptPref(4401).promptId).toBe(`upscale-colorize`)
  })

  it(`a second photo is queue position 2`, async () => {
    await e2e.sendPhoto(polishUser)
    e2e.clearCalls()
    await e2e.sendPhoto(polishUser)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `ack`, {state: `ack`, position: 2, promptName: `4K Upscale + Colorize`}, `id`),
    )
    expect(bot.db.jobs.queueSize()).toBe(2)
  })

  it(`free text that is not a custom prompt shows the prompt, not an error`, async () => {
    const responses = await e2e.sendText(`hello there`, polishUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toContain(`Polish foto ke 4K`)
  })

  it(`/polish with an argument still shows the prompt (no args expected)`, async () => {
    const responses = await e2e.sendText(`/polish anything`, polishUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `prompt`, position: 0, promptName: ``}, `id`))
  })

  it(`shows the prompt from the Polish button (callback)`, async () => {
    const responses = await e2e.sendCallbackQuery(`polish`, polishUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {state: `prompt`, position: 0, promptName: ``}, `id`))
  })
})
