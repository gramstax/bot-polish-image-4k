import {describe, expect, it} from "bun:test"
import {AppConfig} from "../src/lib/config"

describe(`AppConfig.load`, () => {
  it(`defaults to mock off, ./data, ./jobs, moli defaults, port 9222`, () => {
    const c = AppConfig.load({} as NodeJS.ProcessEnv)
    expect(c.mockAi).toBe(false)
    expect(c.dbPath).toBe(`./data`)
    expect(c.jobsDir).toBe(`./jobs`)
    expect(c.moliBin.endsWith(`.local/bin/moli`)).toBe(true)
    expect(c.moliProfileDir).toBe(`./moli-profile`)
    expect(c.moliPort).toBe(9222)
    expect(c.geminiChatUrl).toBe(``)
    expect(c.geminiBaseUrl).toBe(`https://gemini.google.com`)
  })

  it(`reads polish env overrides`, () => {
    const c = AppConfig.load({
      POLISH_MOCK_AI: `1`,
      POLISH_ALLOWED_IDS: `123, 456`,
      POLISH_JOBS_DIR: `/tmp/jobs`,
      MOLI_BIN: `/usr/bin/moli`,
      MOLI_PROFILE_DIR: `/tmp/moli-profile`,
      MOLI_PORT: `9333`,
      MOLI_PROXY: `http://proxy:3128`,
      GEMINI_CHAT_URL: `https://gemini.google.com/app/abc123`,
      GEMINI_BASE_URL: `https://gemini.google.com/`,
    } as NodeJS.ProcessEnv)
    expect(c.mockAi).toBe(true)
    expect(c.allowedIds.has(123)).toBe(true)
    expect(c.allowedIds.has(456)).toBe(true)
    expect(c.jobsDir).toBe(`/tmp/jobs`)
    expect(c.moliBin).toBe(`/usr/bin/moli`)
    expect(c.moliProfileDir).toBe(`/tmp/moli-profile`)
    expect(c.moliPort).toBe(9333)
    expect(c.moliProxy).toBe(`http://proxy:3128`)
    expect(c.geminiChatUrl).toBe(`https://gemini.google.com/app/abc123`)
    expect(c.geminiBaseUrl).toBe(`https://gemini.google.com`)
  })

  it(`falls back to port 9222 for a bad MOLI_PORT`, () => {
    expect(AppConfig.load({MOLI_PORT: `abc`} as NodeJS.ProcessEnv).moliPort).toBe(9222)
    expect(AppConfig.load({MOLI_PORT: `0`} as NodeJS.ProcessEnv).moliPort).toBe(9222)
  })

  it(`falls back to $HTTP_PROXY when MOLI_PROXY is empty`, () => {
    expect(AppConfig.load({HTTP_PROXY: `http://proxy:3128`} as NodeJS.ProcessEnv).moliProxy).toBe(`http://proxy:3128`)
  })
})

describe(`AppConfig.isMock`, () => {
  it(`POLISH_MOCK_AI=1 always mocks`, () => {
    expect(AppConfig.isMock({POLISH_MOCK_AI: `1`} as NodeJS.ProcessEnv)).toBe(true)
    expect(AppConfig.isMock({POLISH_MOCK_AI: `true`} as NodeJS.ProcessEnv)).toBe(true)
  })

  it(`anything else is live (no API fallback for this bot)`, () => {
    expect(AppConfig.isMock({} as NodeJS.ProcessEnv)).toBe(false)
    expect(AppConfig.isMock({POLISH_MOCK_AI: `0`} as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe(`AppConfig.parseIds`, () => {
  it(`parses comma-separated ids, ignores junk`, () => {
    expect([...AppConfig.parseIds(`1, 2, x, -5, 0`)]).toEqual([1, 2])
    expect(AppConfig.parseIds(``).size).toBe(0)
  })
})
