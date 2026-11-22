/**
 * MoliManager — spawn and manage the `moli serve` browser process the
 * bot drives over CDP with playwright-core.
 *
 * Rules learned from the probe (~/workspace/polish-bot-probe/REPORT.md):
 * - Moli does NOT read proxy env vars: the bot MUST pass
 *   `--http-proxy` explicitly, or egress to Google fails.
 * - The profile dir persists the Google login cookies across restarts.
 * - The proxy URL carries credentials — it is NEVER logged. Only a
 *   masked "proxy set / not set" note is logged.
 * - One Moli process serves one browser; the worker reuses its single
 *   tab for the Gemini chat session.
 */
import {spawn, type Subprocess} from "bun"
import {mkdirSync} from "node:fs"
import {chromium, type Browser, type Page} from "playwright-core"
import {LogHe} from "~/helpers/log"
import type {AppConfigData} from "./config"

export interface IMoliConfig {
  bin: string
  profileDir: string
  port: number
  proxy: string
}

/** Build the exact `moli serve` argv (pure — unit-tested, no side effects). */
export function buildMoliArgs(cfg: IMoliConfig): string[] {
  const args = [`serve`, `--layout`, `-p`, String(cfg.port), `-P`, cfg.profileDir, `--log-level`, `error`]
  if (cfg.proxy.trim() !== ``) args.push(`--http-proxy`, cfg.proxy.trim())
  return args
}

export function moliConfigFromApp(cfg: AppConfigData): IMoliConfig {
  return {bin: cfg.moliBin, profileDir: cfg.moliProfileDir, port: cfg.moliPort, proxy: cfg.moliProxy}
}

export function cdpUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

export class MoliManager {
  private _proc: Subprocess | undefined
  private _browser: Browser | undefined
  private _starting: Promise<Browser> | undefined

  constructor(private readonly cfg: IMoliConfig) {}

  get running(): boolean {
    return this._proc !== undefined && this._browser !== undefined
  }

  /** Start Moli (if not running) and connect over CDP. Safe to call repeatedly. */
  async ensureBrowser(): Promise<Browser> {
    if (this._browser !== undefined) {
      try {
        if (this._browser.isConnected()) return this._browser
      } catch {
        // Dropped connection — fall through to restart.
      }
      await this.stop()
    }
    if (this._starting !== undefined) return this._starting
    this._starting = this.startAndConnect()
    try {
      return await this._starting
    } finally {
      this._starting = undefined
    }
  }

  /** Reuse the browser's first tab (the Gemini chat lives there), or open one. */
  async ensurePage(browser: Browser): Promise<Page> {
    const context = browser.contexts()[0] ?? (await browser.newContext())
    return context.pages()[0] ?? (await context.newPage())
  }

  /** Kill Moli and drop the CDP connection. */
  async stop(): Promise<void> {
    const browser = this._browser
    this._browser = undefined
    if (browser !== undefined) {
      try {
        await browser.close()
      } catch {
        // Already gone.
      }
    }
    const proc = this._proc
    this._proc = undefined
    if (proc !== undefined) {
      try {
        proc.kill()
      } catch {
        // Already gone.
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  private async startAndConnect(): Promise<Browser> {
    mkdirSync(this.cfg.profileDir, {recursive: true})
    // Log the command WITHOUT the proxy value (it carries credentials).
    LogHe.info(`[moli] starting serve on port ${this.cfg.port}, profile ${this.cfg.profileDir}, proxy ${this.cfg.proxy.trim() === `` ? `not set` : `set`}`)
    const proc = spawn([this.cfg.bin, ...buildMoliArgs(this.cfg)], {stdout: `ignore`, stderr: `ignore`})
    this._proc = proc
    try {
      await this.waitForCdp()
      const browser = await chromium.connectOverCDP(cdpUrl(this.cfg.port))
      this._browser = browser
      LogHe.info(`[moli] CDP connected on port ${this.cfg.port}`)
      return browser
    } catch (err) {
      await this.stop()
      throw err
    }
  }

  private async waitForCdp(timeoutMs = 30_000): Promise<void> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (this._proc?.exitCode !== null && this._proc?.exitCode !== undefined) {
        throw new Error(`moli serve exited early (code ${this._proc.exitCode})`)
      }
      try {
        const res = await fetch(`${cdpUrl(this.cfg.port)}/json/version`)
        if (res.ok) return
      } catch {
        // Not up yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error(`moli CDP did not come up on port ${this.cfg.port} within ${timeoutMs}ms`)
  }
}
