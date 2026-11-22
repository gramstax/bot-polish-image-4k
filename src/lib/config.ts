import {homedir} from "node:os"
import {join} from "node:path"

/** Runtime config — all secrets and paths come from env, never hardcoded. */
export interface AppConfigData {
  mockAi: boolean
  allowedIds: Set<number>
  dbPath: string
  /** Local directory for job photos (input + polished result). */
  jobsDir: string
  /** Path to the moli binary. */
  moliBin: string
  /** Persistent Moli profile dir — the Google login session lives here. */
  moliProfileDir: string
  /** CDP port Moli serves on. */
  moliPort: number
  /** HTTP proxy Moli must use (it does NOT read proxy env vars). */
  moliProxy: string
  /** Gemini chat URL to reuse; empty = start a new chat on first use. */
  geminiChatUrl: string
  /** Gemini web base URL. */
  geminiBaseUrl: string
}

export class AppConfig {
  private static current: AppConfigData = AppConfig.load()

  static load(env: NodeJS.ProcessEnv = process.env): AppConfigData {
    return {
      mockAi: env.POLISH_MOCK_AI === `1` || env.POLISH_MOCK_AI === `true`,
      allowedIds: AppConfig.parseIds(env.POLISH_ALLOWED_IDS ?? ``),
      dbPath: env.DB_PATH ?? `./data`,
      jobsDir: (env.POLISH_JOBS_DIR ?? ``).trim() || `./jobs`,
      moliBin: (env.MOLI_BIN ?? ``).trim() || join(homedir(), `.local`, `bin`, `moli`),
      moliProfileDir: (env.MOLI_PROFILE_DIR ?? ``).trim() || `./moli-profile`,
      moliPort: AppConfig.parsePort(env.MOLI_PORT ?? ``, 9222),
      moliProxy: (env.MOLI_PROXY ?? ``).trim() || (env.HTTP_PROXY ?? ``).trim(),
      geminiChatUrl: (env.GEMINI_CHAT_URL ?? ``).trim(),
      geminiBaseUrl: (env.GEMINI_BASE_URL ?? ``).trim().replace(/\/+$/, ``) || `https://gemini.google.com`,
    }
  }

  static get(): AppConfigData {
    return AppConfig.current
  }

  static set(next: AppConfigData): void {
    AppConfig.current = next
  }

  /** Telegram ids that may use the bot; empty = everyone allowed (dev mode). */
  static allowedIds(env: NodeJS.ProcessEnv = process.env): Set<number> {
    // When AppConfig.load already ran with the current env, use the cache;
    // when env changed after load (tests), read it again from env.
    const fromEnv = AppConfig.parseIds(env.POLISH_ALLOWED_IDS ?? ``)
    if (fromEnv.size > 0) return fromEnv
    return AppConfig.current.allowedIds
  }

  static parseIds(raw: string): Set<number> {
    const out = new Set<number>()
    for (const part of raw.split(`,`)) {
      const n = Number(part.trim())
      if (Number.isFinite(n) && n > 0) out.add(Math.floor(n))
    }
    return out
  }

  static parsePort(raw: string, fallback: number): number {
    const n = Number(raw.trim())
    return Number.isFinite(n) && n > 0 && n < 65536 ? Math.floor(n) : fallback
  }

  /**
   * Mock is active ONLY when POLISH_MOCK_AI=1. There is no API fallback
   * for this bot: live mode drives the Gemini website through Moli, and
   * without a logged-in Google session the job fails honestly at
   * runtime (login-needed) instead of silently returning a fake image.
   * Reads env DIRECTLY (not the load-time cache): e2e setup sets env
   * after the module is imported, so a cache would go stale.
   */
  static isMock(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.POLISH_MOCK_AI === `1` || env.POLISH_MOCK_AI === `true`
  }
}
