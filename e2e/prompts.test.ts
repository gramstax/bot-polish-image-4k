import {beforeEach, describe, expect, it} from "bun:test"
import {bot, e2e, promptsEnUser, promptsUser, resetEnv} from "./setup"

const intent = `prompts`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: PromptsPage`, () => {
  it(`/prompts shows the picker with the current preset (Indonesian)`, async () => {
    const responses = await e2e.sendText(`/prompts`, promptsUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(reply).toBeDefined()
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `default`, {current: `4K Upscale + Colorize`, custom: ``}, `id`),
    )
    expect(e2e.extractButtonLabels(reply)).toEqual([
      `4K Upscale + Colorize`,
      `4K Upscale saja`,
      `✏️ Prompt custom`,
      `⬅️ Kembali`,
    ])
  })

  it(`/prompts shows the English picker for an en user`, async () => {
    const responses = await e2e.sendText(`/prompts`, promptsEnUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `default`, {current: `4K Upscale + Colorize`, custom: ``}, `en`),
    )
    expect(e2e.extractButtonLabels(reply)).toEqual([
      `4K Upscale + Colorize`,
      `4K Upscale only`,
      `✏️ Custom prompt`,
      `⬅️ Back`,
    ])
  })

  it(`shows the same picker from the Prompts button (callback)`, async () => {
    const responses = await e2e.sendCallbackQuery(`prompts`, promptsUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(intent, `default`, {current: `4K Upscale + Colorize`, custom: ``}, `id`),
    )
  })

  it(`picking "4K Upscale only" saves the preset`, async () => {
    await e2e.sendText(`/prompts`, promptsUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`prompts:set-upscale-only:0`, promptsUser)
    expect(responses.length).toBeGreaterThan(0)
    const reply = e2e.lastCall(`editMessageText`)!
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `done`, {current: `4K Upscale only`}, `id`))
    expect(bot.db.user.promptPref(4403).promptId).toBe(`upscale-only`)
  })

  it(`picking Custom asks for the prompt text, then free text saves it`, async () => {
    await e2e.sendText(`/prompts`, promptsUser)
    e2e.clearCalls()
    const responses = await e2e.sendCallbackQuery(`prompts:set-custom:0`, promptsUser)
    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.extractText(e2e.lastCall(`editMessageText`)!)).toBe(e2e.gmsg(intent, `type`, {}, `id`))
    expect(bot.db.user.promptPref(4403).promptState).toBe(`awaiting-custom`)
    e2e.clearCalls()
    await e2e.sendText(`make it pop, keep the face`, promptsUser)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(`polish`, `ack`, {state: `custom-saved`, position: 0, promptName: ``}, `id`),
    )
    const pref = bot.db.user.promptPref(4403)
    expect(pref.customPrompt).toBe(`make it pop, keep the face`)
    expect(pref.promptState).toBe(`idle`)
  })

  it(`a photo after saving a custom prompt uses the custom text`, async () => {
    await bot.db.user.setPromptId(4403, `custom`, {username: `promptsuser`, firstName: `P`})
    await bot.db.user.setCustomPrompt(4403, `make it pop`, {username: `promptsuser`, firstName: `P`})
    await e2e.sendPhoto(promptsUser)
    const ids = bot.db.user.recentJobIds(4403)
    const job = bot.db.jobs.find(ids[0]!)
    expect(job?.promptId).toBe(`custom`)
    expect(job?.promptText).toBe(`make it pop`)
  })

  it(`a photo with custom selected but no saved text asks for the prompt first`, async () => {
    await bot.db.user.setPromptId(4403, `custom`, {username: `promptsuser`, firstName: `P`})
    await e2e.sendPhoto(promptsUser)
    const reply = e2e.lastCall(`sendMessage`)!
    expect(e2e.extractText(reply)).toBe(
      e2e.gmsg(`polish`, `default`, {state: `need-custom`, position: 0, promptName: ``}, `id`),
    )
    expect(bot.db.user.recentJobIds(4403).length).toBe(0)
    expect(bot.db.jobs.queueSize()).toBe(0)
  })
})
